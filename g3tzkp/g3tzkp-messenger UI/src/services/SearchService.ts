import axios from 'axios';

export interface SearchResult {
  id: string;
  name: string;
  address: string;
  lat: number;
  lon: number;
  type: string;
  distance?: number;
  importance: number;
}

class SearchService {
  private cache = new Map<string, SearchResult[]>();
  private abortController: AbortController | null = null;

  async search(
    query: string,
    currentLocation?: { lat: number; lon: number },
    maxResults: number = 10
  ): Promise<SearchResult[]> {
    if (!query.trim()) return [];

    if (this.abortController) {
      this.abortController.abort();
    }

    const cacheKey = `${query}|${currentLocation?.lat}|${currentLocation?.lon}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    this.abortController = new AbortController();

    try {
      const params: any = {
        q: query,
        format: 'json',
        addressdetails: 1,
        limit: 50
      };

      if (currentLocation) {
        const radius = 0.7;
        params.viewbox = [
          currentLocation.lon - radius,
          currentLocation.lat + radius,
          currentLocation.lon + radius,
          currentLocation.lat - radius
        ].join(',');
        params.bounded = 0;
      }

      const response = await axios.get(
        'https://nominatim.openstreetmap.org/search',
        {
          params,
          headers: {
            'User-Agent': 'G3ZKP-Messenger/1.0'
          },
          signal: this.abortController.signal
        }
      );

      let results: SearchResult[] = response.data.map((item: any) => ({
        id: item.place_id,
        name: item.name || item.display_name.split(',')[0],
        address: item.display_name,
        lat: parseFloat(item.lat),
        lon: parseFloat(item.lon),
        type: item.type,
        importance: parseFloat(item.importance || '0')
      }));

      if (currentLocation) {
        results = results.map(result => ({
          ...result,
          distance: this.calculateDistance(
            currentLocation.lat,
            currentLocation.lon,
            result.lat,
            result.lon
          )
        }));

        results.sort((a, b) => {
          const distA = a.distance || Infinity;
          const distB = b.distance || Infinity;
          const maxDistance = 80467;

          if (distA <= maxDistance && distB <= maxDistance) {
            return distA - distB;
          } else if (distA <= maxDistance) {
            return -1;
          } else if (distB <= maxDistance) {
            return 1;
          } else {
            return b.importance - a.importance;
          }
        });
      } else {
        results.sort((a, b) => b.importance - a.importance);
      }

      results = results.slice(0, maxResults);
      this.cache.set(cacheKey, results);

      if (this.cache.size > 20) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }

      return results;
    } catch (error) {
      if (axios.isCancel(error)) {
        return [];
      }
      console.error('[SearchService] Search error:', error);
      return [];
    }
  }

  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    } else if (meters < 10000) {
      return `${(meters / 1000).toFixed(1)}km`;
    } else if (meters < 1609344) {
      return `${Math.round(meters / 1000)}km`;
    } else {
      return `${Math.round(meters / 1609.344)}mi`;
    }
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const searchService = new SearchService();
export default searchService;
