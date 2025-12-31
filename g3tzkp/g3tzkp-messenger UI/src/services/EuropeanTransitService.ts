/**
 * G3ZKP European Transit Service
 * Client-side wrapper for European-wide transit coverage
 * Routes through backend proxy to hide API keys
 */

import axios from 'axios';

export interface TransitStop {
  id: string;
  name: string;
  lat: number;
  lon: number;
  modes: string[];
  lines?: string[];
  country: string;
  distance?: number;
}

export interface TransitLeg {
  mode: string;
  departure: string;
  arrival: string;
  departureTime?: string;
  arrivalTime?: string;
  distance?: number;
  duration?: number;
  lineName?: string;
  lineColor?: string;
}

export interface TransitJourney {
  duration: number;
  legs: TransitLeg[];
  fare?: {
    total: number;
    currency: string;
  };
}

export interface TransitProvider {
  id: string;
  name: string;
  country: string;
  realtime: boolean;
  available: boolean;
}

export interface JourneyPlanRequest {
  from: { lat: number; lon: number; name?: string };
  to: { lat: number; lon: number; name?: string };
  datetime?: string;
  modes?: string[];
  country?: string;
}

const API_BASE = '';

class EuropeanTransitService {
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private readonly cacheTTL = 5 * 60 * 1000;

  private getCached<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data as T;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: unknown): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  async getProviders(): Promise<{
    providers: TransitProvider[];
    totalCountries: number;
    totalProviders: number;
  }> {
    const cacheKey = 'providers';
    const cached = this.getCached<{
      providers: TransitProvider[];
      totalCountries: number;
      totalProviders: number;
    }>(cacheKey);
    if (cached) return cached;

    try {
      const response = await axios.get(`${API_BASE}/api/transit/europe/providers`);
      this.setCache(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.error('[EuropeanTransit] Failed to get providers:', error);
      return { providers: [], totalCountries: 0, totalProviders: 0 };
    }
  }

  async planJourney(request: JourneyPlanRequest): Promise<{
    journeys: TransitJourney[];
    country: string;
    provider: string;
    _cached?: boolean;
  }> {
    const cacheKey = `journey:${JSON.stringify(request)}`;
    const cached = this.getCached<{
      journeys: TransitJourney[];
      country: string;
      provider: string;
    }>(cacheKey);
    if (cached) return { ...cached, _cached: true };

    try {
      const response = await axios.post(`${API_BASE}/api/transit/europe/plan`, request);
      this.setCache(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.error('[EuropeanTransit] Journey planning failed:', error);
      throw error;
    }
  }

  async getNearbyStops(
    lat: number,
    lon: number,
    radiusMeters = 1000,
    country?: string
  ): Promise<{
    stops: TransitStop[];
    count: number;
    country: string;
    _cached?: boolean;
  }> {
    const cacheKey = `stops:${lat.toFixed(4)}:${lon.toFixed(4)}:${radiusMeters}`;
    const cached = this.getCached<{
      stops: TransitStop[];
      count: number;
      country: string;
    }>(cacheKey);
    if (cached) return { ...cached, _cached: true };

    try {
      const response = await axios.post(`${API_BASE}/api/transit/europe/stops`, {
        lat,
        lon,
        radius: radiusMeters,
        country
      });
      this.setCache(cacheKey, response.data);
      return response.data;
    } catch (error) {
      console.error('[EuropeanTransit] Failed to get nearby stops:', error);
      return { stops: [], count: 0, country: 'EU' };
    }
  }

  async searchLocation(query: string, countryCode?: string): Promise<TransitStop[]> {
    try {
      const params = new URLSearchParams({ query });
      if (countryCode) params.append('country', countryCode);
      
      const response = await axios.get(`${API_BASE}/api/transit/search?${params}`);
      return response.data;
    } catch (error) {
      console.error('[EuropeanTransit] Location search failed:', error);
      return [];
    }
  }

  async getLineStatus(modes?: string[]): Promise<Array<{
    lineId: string;
    lineName: string;
    mode: string;
    status: string;
    reason?: string;
  }>> {
    try {
      const params = modes ? `?modes=${modes.join(',')}` : '';
      const response = await axios.get(`${API_BASE}/api/transit/line-status${params}`);
      return response.data;
    } catch (error) {
      console.error('[EuropeanTransit] Failed to get line status:', error);
      return [];
    }
  }

  async getArrivals(stopId: string, lines?: string[]): Promise<Array<{
    lineId: string;
    lineName: string;
    destinationName: string;
    timeToStation: number;
    expectedArrival: string;
    platform?: string;
  }>> {
    try {
      const params = lines ? `?lines=${lines.join(',')}` : '';
      const response = await axios.get(`${API_BASE}/api/transit/arrivals/${stopId}${params}`);
      return response.data;
    } catch (error) {
      console.error('[EuropeanTransit] Failed to get arrivals:', error);
      return [];
    }
  }

  getModeIcon(mode: string): string {
    const icons: Record<string, string> = {
      'tube': '🚇',
      'subway': '🚇',
      'metro': '🚇',
      'bus': '🚌',
      'train': '🚂',
      'rail': '🚂',
      'tram': '🚊',
      'dlr': '🚈',
      'overground': '🚆',
      'walking': '🚶',
      'cycling': '🚴',
      'ferry': '⛴️',
      'driving': '🚗'
    };
    return icons[mode.toLowerCase()] || '🚌';
  }

  getModeColor(mode: string): string {
    const colors: Record<string, string> = {
      'tube': '#0019A8',
      'subway': '#0019A8',
      'metro': '#0019A8',
      'bus': '#DC241F',
      'train': '#1C3F94',
      'rail': '#1C3F94',
      'tram': '#84B817',
      'dlr': '#00AFAD',
      'overground': '#EE7C0E',
      'walking': '#666666',
      'cycling': '#4CAF50',
      'ferry': '#0066CC',
      'driving': '#333333'
    };
    return colors[mode.toLowerCase()] || '#666666';
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const europeanTransitService = new EuropeanTransitService();
export default europeanTransitService;
