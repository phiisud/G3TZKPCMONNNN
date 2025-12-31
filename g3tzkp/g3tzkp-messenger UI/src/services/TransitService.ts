import { Coordinate } from '../types/navigation';
import { europeanTransitService, TransitJourney as EuropeanJourney } from './EuropeanTransitService';

export interface TransitLeg {
  mode: 'tube' | 'bus' | 'train' | 'tram' | 'dlr' | 'overground' | 'elizabeth-line' | 'walking' | 'cycling';
  lineName?: string;
  lineColor?: string;
  departureTime: string;
  arrivalTime: string;
  duration: number;
  departureStop: TransitStop;
  arrivalStop: TransitStop;
  intermediateStops?: TransitStop[];
  instruction: string;
  path?: Coordinate[];
  realtime?: {
    expectedDeparture?: string;
    expectedArrival?: string;
    delay?: number;
    platform?: string;
    status?: 'on-time' | 'delayed' | 'cancelled';
  };
}

export interface TransitStop {
  id: string;
  name: string;
  coordinate: Coordinate;
  platform?: string;
  naptanId?: string;
}

export interface TransitJourney {
  id: string;
  startTime: string;
  arrivalTime: string;
  duration: number;
  legs: TransitLeg[];
  fare?: {
    total: number;
    currency: string;
    zones?: string;
  };
  disruptions?: TransitDisruption[];
}

export interface TransitDisruption {
  severity: 'minor' | 'moderate' | 'severe';
  description: string;
  affectedLines?: string[];
  validityPeriod?: { from: string; to: string };
}

export interface LineStatus {
  lineId: string;
  lineName: string;
  mode: string;
  status: 'Good Service' | 'Minor Delays' | 'Severe Delays' | 'Part Suspended' | 'Suspended' | 'Planned Closure';
  reason?: string;
}

// FIXED: Set API_BASE to point to messaging server
const getApiBase = () => {
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'https:' : 'http:';
    const hostname = window.location.hostname;
    const port = hostname === 'localhost' || hostname === '127.0.0.1' ? ':3001' : '';
    return `${protocol}//${hostname}${port}`;
  }
  return '';
};

const API_BASE = getApiBase();

const MODE_COLORS: Record<string, string> = {
  'tube': '#0019A8',
  'bus': '#DC241F',
  'dlr': '#00AFAD',
  'overground': '#EE7C0E',
  'tram': '#84B817',
  'elizabeth-line': '#6950A1',
  'train': '#1C3F94',
  'walking': '#666666',
  'cycling': '#4CAF50'
};

const TUBE_LINE_COLORS: Record<string, string> = {
  'bakerloo': '#B36305',
  'central': '#E32017',
  'circle': '#FFD300',
  'district': '#00782A',
  'hammersmith-city': '#F3A9BB',
  'jubilee': '#A0A5A9',
  'metropolitan': '#9B0056',
  'northern': '#000000',
  'piccadilly': '#003688',
  'victoria': '#0098D4',
  'waterloo-city': '#95CDBA'
};

class TransitService {
  private cache: Map<string, { data: any; expires: number }> = new Map();

  constructor() {}

  hasApiKey(): boolean {
    return true;
  }

  private async fetch(endpoint: string, params: Record<string, string> = {}): Promise<any> {
    const cacheKey = endpoint + JSON.stringify(params);
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }

    const url = new URL(`${API_BASE}${endpoint}`, window.location.origin);
    Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));

    console.log(`[TransitService] Fetching: ${url.toString()}`);

    try {
      const response = await fetch(url.toString());
      if (!response.ok) {
        throw new Error(`Transit API error: ${response.status} - ${response.statusText}`);
      }

      const data = await response.json();
      this.cache.set(cacheKey, { data, expires: Date.now() + 60000 });
      return data;
    } catch (error) {
      console.error(`[TransitService] Fetch failed for ${endpoint}:`, error);
      throw error;
    }
  }

  async planEuropeanJourney(
    from: Coordinate | string,
    to: Coordinate | string,
    options: {
      modes?: string[];
      country?: string;
    } = {}
  ): Promise<TransitJourney[]> {
    const fromCoord = typeof from === 'string' ? this.parseCoordString(from) : { lat: from[1], lon: from[0] };
    const toCoord = typeof to === 'string' ? this.parseCoordString(to) : { lat: to[1], lon: to[0] };

    try {
      console.log('[TransitService] Planning European journey:', { fromCoord, toCoord, options });
      const result = await europeanTransitService.planJourney({
        from: fromCoord,
        to: toCoord,
        modes: options.modes,
        country: options.country
      });

      return result.journeys.map((j, index) => this.convertEuropeanJourney(j, index));
    } catch (error) {
      console.error('[TransitService] European journey planning failed:', error);
      // Fallback to regular journey planning
      return this.planJourney(from, to, options);
    }
  }

  private parseCoordString(coord: string): { lat: number; lon: number } {
    const [lat, lon] = coord.split(',').map(Number);
    return { lat, lon };
  }

  private convertEuropeanJourney(journey: EuropeanJourney, index: number): TransitJourney {
    return {
      id: `european_journey_${Date.now()}_${index}`,
      startTime: journey.legs[0]?.departureTime || new Date().toISOString(),
      arrivalTime: journey.legs[journey.legs.length - 1]?.arrivalTime || new Date().toISOString(),
      duration: journey.duration,
      legs: journey.legs.map(leg => ({
        mode: this.normalizeMode(leg.mode) as TransitLeg['mode'],
        lineName: leg.lineName,
        lineColor: europeanTransitService.getModeColor(leg.mode),
        departureTime: leg.departureTime || '',
        arrivalTime: leg.arrivalTime || '',
        duration: leg.duration || 0,
        departureStop: {
          id: 'start',
          name: leg.departure,
          coordinate: [0, 0]
        },
        arrivalStop: {
          id: 'end',
          name: leg.arrival,
          coordinate: [0, 0]
        },
        instruction: `Take ${leg.mode} from ${leg.departure} to ${leg.arrival}`,
        path: []
      })),
      fare: journey.fare
    };
  }

  async planJourney(
    from: Coordinate | string,
    to: Coordinate | string,
    options: {
      modes?: string[];
      timeIs?: 'Departing' | 'Arriving';
      time?: string;
      date?: string;
      journeyPreference?: 'LeastInterchange' | 'LeastTime' | 'LeastWalking';
    } = {}
  ): Promise<TransitJourney[]> {
    const fromStr = typeof from === 'string' ? from : `${from[1]},${from[0]}`;
    const toStr = typeof to === 'string' ? to : `${to[1]},${to[0]}`;

    const params: Record<string, string> = {
      from: fromStr,
      to: toStr
    };
    if (options.modes?.length) params.mode = options.modes.join(',');
    if (options.timeIs) params.timeIs = options.timeIs;
    if (options.time) params.time = options.time;
    if (options.date) params.date = options.date;
    if (options.journeyPreference) params.journeyPreference = options.journeyPreference;

    try {
      console.log('[TransitService] Planning journey with params:', params);
      const data = await this.fetch('/api/transit/journey', params);
      
      if (!data || !data.journeys) {
        console.warn('[TransitService] No journeys found in response');
        return [];
      }
      
      return data.journeys.map((journey: any, index: number) => this.parseJourney(journey, index));
    } catch (error) {
      console.error('Failed to plan transit journey:', error);
      
      // If main transit API fails, try European transit as fallback
      if (error instanceof Error && error.message.includes('400')) {
        console.log('[TransitService] TfL API failed, trying European transit fallback');
        return this.planEuropeanJourney(from, to, options);
      }
      
      return [];
    }
  }

  private parseJourney(journey: any, index: number): TransitJourney {
    const legs: TransitLeg[] = (journey.legs || []).map((leg: any) => this.parseLeg(leg));

    return {
      id: `journey_${Date.now()}_${index}`,
      startTime: journey.startDateTime,
      arrivalTime: journey.arrivalDateTime,
      duration: journey.duration,
      legs,
      fare: journey.fare ? {
        total: journey.fare.totalCost / 100,
        currency: 'GBP',
        zones: journey.fare.zones
      } : undefined,
      disruptions: (journey.disruptions || []).map((d: any) => ({
        severity: d.category === 'RealTime' ? 'moderate' : 'minor',
        description: d.description,
        affectedLines: d.affectedRoutes?.map((r: any) => r.name)
      }))
    };
  }

  private parseLeg(leg: any): TransitLeg {
    const mode = this.normalizeMode(leg.mode?.id || 'walking');
    const lineName = leg.routeOptions?.[0]?.name || leg.instruction?.summary;
    
    let lineColor = MODE_COLORS[mode] || '#666666';
    if (mode === 'tube' && lineName) {
      const lineId = lineName.toLowerCase().replace(' line', '').replace(' ', '-');
      lineColor = TUBE_LINE_COLORS[lineId] || lineColor;
    }

    const path: Coordinate[] = [];
    if (leg.path?.lineString) {
      const coords = leg.path.lineString.split(' ');
      for (let i = 0; i < coords.length - 1; i += 2) {
        const [lat, lon] = coords.slice(i, i + 2).map(Number);
        if (!isNaN(lat) && !isNaN(lon)) {
          path.push([lon, lat]);
        }
      }
    }

    return {
      mode: mode as TransitLeg['mode'],
      lineName,
      lineColor,
      departureTime: leg.departureTime,
      arrivalTime: leg.arrivalTime,
      duration: leg.duration,
      departureStop: {
        id: leg.departurePoint?.naptanId || 'unknown',
        name: leg.departurePoint?.commonName || 'Unknown',
        coordinate: [leg.departurePoint?.lon || 0, leg.departurePoint?.lat || 0],
        naptanId: leg.departurePoint?.naptanId
      },
      arrivalStop: {
        id: leg.arrivalPoint?.naptanId || 'unknown',
        name: leg.arrivalPoint?.commonName || 'Unknown',
        coordinate: [leg.arrivalPoint?.lon || 0, leg.arrivalPoint?.lat || 0],
        naptanId: leg.arrivalPoint?.naptanId
      },
      intermediateStops: (leg.path?.stopPoints || []).map((sp: any) => ({
        id: sp.naptanId || sp.id,
        name: sp.name || sp.commonName,
        coordinate: [sp.lon, sp.lat]
      })),
      instruction: leg.instruction?.detailed || leg.instruction?.summary || 'Continue',
      path,
      realtime: {
        platform: leg.departurePoint?.platformName,
        status: 'on-time'
      }
    };
  }

  private normalizeMode(mode: string): string {
    const modeMap: Record<string, string> = {
      'walking': 'walking',
      'cycle': 'cycling',
      'cycling': 'cycling',
      'tube': 'tube',
      'underground': 'tube',
      'bus': 'bus',
      'dlr': 'dlr',
      'overground': 'overground',
      'tram': 'tram',
      'elizabeth-line': 'elizabeth-line',
      'national-rail': 'train',
      'rail': 'train'
    };
    return modeMap[mode.toLowerCase()] || 'walking';
  }

  async getLineStatus(modes?: string[]): Promise<LineStatus[]> {
    try {
      const modeParam = modes?.join(',') || 'tube,dlr,overground,tram,elizabeth-line';
      const data = await this.fetch('/api/transit/line-status', { modes: modeParam });
      
      return (data || []).map((line: any) => ({
        lineId: line.lineId || line.id,
        lineName: line.lineName || line.name,
        mode: line.mode || line.modeName,
        status: line.status || 'Unknown',
        reason: line.reason
      }));
    } catch (error) {
      console.error('Failed to get line status:', error);
      return [];
    }
  }

  async getArrivals(stopId: string, lines?: string[]): Promise<any[]> {
    try {
      const params: Record<string, string> = {};
      if (lines?.length) params.lines = lines.join(',');
      
      const data = await this.fetch(`/api/transit/arrivals/${stopId}`, params);
      return (data || []).sort((a: any, b: any) => a.timeToStation - b.timeToStation);
    } catch (error) {
      console.error('Failed to get arrivals:', error);
      return [];
    }
  }

  async searchStops(query: string): Promise<TransitStop[]> {
    try {
      const data = await this.fetch('/api/transit/search', { query, maxResults: '10' });
      
      return (data || []).map((match: any) => ({
        id: match.id,
        name: match.name,
        coordinate: [match.coordinate?.[0] || match.lon, match.coordinate?.[1] || match.lat] as Coordinate,
        naptanId: match.naptanId || match.id
      }));
    } catch (error) {
      console.error('Failed to search stops:', error);
      return [];
    }
  }

  getModeIcon(mode: string): string {
    const icons: Record<string, string> = {
      'tube': '🚇',
      'bus': '🚌',
      'train': '🚂',
      'tram': '🚊',
      'dlr': '🚈',
      'overground': '🚆',
      'elizabeth-line': '🟣',
      'walking': '🚶',
      'cycling': '🚴'
    };
    return icons[mode] || '🚶';
  }

  getModeColor(mode: string, lineName?: string): string {
    if (mode === 'tube' && lineName) {
      const lineId = lineName.toLowerCase().replace(' line', '').replace(' ', '-');
      return TUBE_LINE_COLORS[lineId] || MODE_COLORS.tube;
    }
    return MODE_COLORS[mode] || '#666666';
  }
}

export const transitService = new TransitService();
export default transitService;
