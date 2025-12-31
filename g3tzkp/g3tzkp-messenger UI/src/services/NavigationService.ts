import { Coordinate, Route, SearchResult, OfflineRegion, PrivacySettings } from '../types/navigation';
import { g3tzkpService } from './G3TZKPService';
import { createAndSignReport, GeoLocation, TrafficData } from './geo/GeoBroadcastTypes';
import nacl from 'tweetnacl';

const DEFAULT_PRIVACY: PrivacySettings = {
  locationObfuscation: true,
  routeTracking: false,
  dataPersistence: 'ephemeral',
  p2pUpdates: false
};

const OSRM_BASE_URL = 'https://router.project-osrm.org';
const NOMINATIM_BASE_URL = 'https://nominatim.openstreetmap.org';

class NavigationService {
  private baseUrl: string;
  private privacySettings: PrivacySettings;
  private watchId: number | null = null;
  private locationListeners: ((coord: Coordinate, heading: number, speed: number) => void)[] = [];
  private routeCache: Map<string, Route[]> = new Map();
  private searchCache: Map<string, SearchResult[]> = new Map();
  private currentHeading: number = 0;
  private currentSpeed: number = 0;
  private currentPosition: Coordinate | null = null;
  private trafficReportInterval: NodeJS.Timeout | null = null;
  private lastTrafficReportTime: number = 0;
  private isNavigating: boolean = false;
  private p2pKeyPair: { publicKey: Uint8Array; secretKey: Uint8Array } | null = null;
  private readonly TRAFFIC_REPORT_INTERVAL_MS = 30000;
  private readonly MIN_SPEED_FOR_REPORT = 5;

  constructor() {
    this.baseUrl = '';
    this.privacySettings = DEFAULT_PRIVACY;
    this.initializeP2PKeys();
  }

  private initializeP2PKeys(): void {
    try {
      const storedKeys = localStorage.getItem('g3zkp_navigation_keys');
      if (storedKeys) {
        const parsed = JSON.parse(storedKeys);
        this.p2pKeyPair = {
          publicKey: new Uint8Array(Object.values(parsed.publicKey)),
          secretKey: new Uint8Array(Object.values(parsed.secretKey))
        };
      } else {
        this.p2pKeyPair = nacl.sign.keyPair();
        localStorage.setItem('g3zkp_navigation_keys', JSON.stringify({
          publicKey: Array.from(this.p2pKeyPair.publicKey),
          secretKey: Array.from(this.p2pKeyPair.secretKey)
        }));
      }
      console.log('[NavigationService] P2P keys initialized');
    } catch (error) {
      console.error('[NavigationService] Failed to initialize P2P keys:', error);
      this.p2pKeyPair = nacl.sign.keyPair();
    }
  }

  private obfuscatePosition(coord: Coordinate, level: 'low' | 'medium' | 'high' | 'maximum' = 'medium'): Coordinate {
    if (!this.privacySettings.locationObfuscation) return coord;
    const offsets: Record<string, number> = { low: 0.0001, medium: 0.0005, high: 0.001, maximum: 0.005 };
    const offset = offsets[level] || 0.0005;
    return [
      coord[0] + (Math.random() * offset * 2 - offset),
      coord[1] + (Math.random() * offset * 2 - offset)
    ];
  }

  async getCurrentPosition(): Promise<Coordinate> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coord: Coordinate = [position.coords.longitude, position.coords.latitude];
          this.currentHeading = position.coords.heading || 0;
          this.currentSpeed = (position.coords.speed || 0) * 3.6;
          resolve(this.obfuscatePosition(coord));
        },
        (error) => {
          reject(new Error(`Location error: ${error.message}`));
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  }

  startWatchingPosition(callback: (coord: Coordinate, heading: number, speed: number) => void): void {
    if (!navigator.geolocation) return;

    this.locationListeners.push(callback);

    if (this.watchId === null) {
      this.watchId = navigator.geolocation.watchPosition(
        (position) => {
          const coord: Coordinate = [position.coords.longitude, position.coords.latitude];
          this.currentHeading = position.coords.heading || this.currentHeading;
          this.currentSpeed = (position.coords.speed || 0) * 3.6;
          const obfuscated = this.obfuscatePosition(coord);
          this.locationListeners.forEach(listener => listener(obfuscated, this.currentHeading, this.currentSpeed));
        },
        (error) => console.error('Watch position error:', error),
        { enableHighAccuracy: true, maximumAge: 1000 }
      );
    }
  }

  stopWatchingPosition(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.locationListeners = [];
  }

  getHeading(): number { return this.currentHeading; }
  getSpeed(): number { return this.currentSpeed; }

  startNavigation(): void {
    if (this.isNavigating) return;
    
    this.isNavigating = true;
    console.log('[NavigationService] Starting active navigation with traffic reporting');
    
    this.startWatchingPosition((coord, heading, speed) => {
      this.currentPosition = coord;
      this.currentHeading = heading;
      this.currentSpeed = speed;
    });
    
    this.trafficReportInterval = setInterval(() => {
      this.generateTrafficReport();
    }, this.TRAFFIC_REPORT_INTERVAL_MS);
  }

  stopNavigation(): void {
    this.isNavigating = false;
    
    if (this.trafficReportInterval) {
      clearInterval(this.trafficReportInterval);
      this.trafficReportInterval = null;
    }
    
    this.stopWatchingPosition();
    console.log('[NavigationService] Stopped active navigation');
  }

  private async generateTrafficReport(): Promise<void> {
    if (!this.p2pKeyPair || !g3tzkpService.isInitialized()) {
      return;
    }

    if (!this.currentPosition || this.currentSpeed < this.MIN_SPEED_FOR_REPORT) {
      return;
    }

    const now = Date.now();
    if (now - this.lastTrafficReportTime < this.TRAFFIC_REPORT_INTERVAL_MS * 0.9) {
      return;
    }

    try {
      const location: GeoLocation = {
        latitude: this.currentPosition[1],
        longitude: this.currentPosition[0],
        timestamp: now,
        heading: this.currentHeading,
        speed: this.currentSpeed,
        accuracy: 10
      };

      const trafficData: TrafficData = {
        speed: this.currentSpeed,
        freeFlowSpeed: this.estimateFreeFlowSpeed(),
        congestionLevel: this.calculateCongestionLevel(),
        sampleCount: 1,
        direction: this.currentHeading
      };

      const signedReport = await createAndSignReport(
        'TRAFFIC_SPEED',
        location,
        trafficData,
        this.p2pKeyPair.secretKey,
        this.p2pKeyPair.publicKey
      );

      const success = await g3tzkpService.broadcastGeoReport(signedReport, 'TRAFFIC');
      if (success) {
        this.lastTrafficReportTime = now;
        console.log(`[NavigationService] Traffic report broadcast: ${this.currentSpeed.toFixed(1)} km/h`);
      }
    } catch (error) {
      console.error('[NavigationService] Failed to generate traffic report:', error);
    }
  }

  private estimateFreeFlowSpeed(): number {
    return 50;
  }

  private calculateCongestionLevel(): number {
    const freeFlow = this.estimateFreeFlowSpeed();
    if (this.currentSpeed >= freeFlow * 0.9) return 0;
    if (this.currentSpeed >= freeFlow * 0.7) return 0.25;
    if (this.currentSpeed >= freeFlow * 0.5) return 0.5;
    if (this.currentSpeed >= freeFlow * 0.3) return 0.75;
    return 1.0;
  }

  isActiveNavigation(): boolean {
    return this.isNavigating;
  }

  async calculateRoute(
    waypoints: Coordinate[],
    profile: 'car' | 'bike' | 'foot' = 'car',
    alternatives: number = 1
  ): Promise<Route[]> {
    if (waypoints.length < 2) return [];

    const cacheKey = `${waypoints.map(w => w.join(',')).join('_')}_${profile}`;
    const cached = this.routeCache.get(cacheKey);
    if (cached) return cached;

    try {
      const coords = waypoints.map(w => `${w[0]},${w[1]}`).join(';');
      const url = `${OSRM_BASE_URL}/route/v1/${profile === 'car' ? 'driving' : profile === 'bike' ? 'cycling' : 'foot'}/${coords}?alternatives=${alternatives}&steps=true&overview=full&annotations=true&geometries=geojson`;

      const response = await fetch(url, {
        headers: { 'User-Agent': 'G3ZKP-Navigator/1.0' }
      });

      if (!response.ok) throw new Error(`OSRM routing failed: ${response.status}`);

      const data = await response.json();

      if (data.code !== 'Ok') throw new Error(data.message || 'OSRM error');

      const routes: Route[] = data.routes.map((route: any, index: number) => ({
        id: `route_${Date.now()}_${index}`,
        geometry: route.geometry,
        distance: route.distance,
        duration: route.duration,
        legs: route.legs.map((leg: any) => ({
          distance: leg.distance,
          duration: leg.duration,
          summary: leg.summary || '',
          steps: leg.steps.map((step: any) => ({
            distance: step.distance,
            duration: step.duration,
            geometry: step.geometry,
            name: step.name || 'Road',
            instruction: step.maneuver?.instruction || this.generateInstruction(step),
            maneuver: {
              type: step.maneuver?.type || 'continue',
              modifier: step.maneuver?.modifier,
              instruction: step.maneuver?.instruction || this.generateInstruction(step),
              bearing_after: step.maneuver?.bearing_after || 0,
              bearing_before: step.maneuver?.bearing_before || 0,
              location: step.maneuver?.location || waypoints[0]
            }
          }))
        })),
        summary: `${(route.distance / 1000).toFixed(1)} km, ${Math.round(route.duration / 60)} min`,
        privacy: {
          obfuscated: this.privacySettings.locationObfuscation,
          fuzzyPoints: [],
          timestamp: Date.now(),
          sessionId: null
        }
      }));

      this.routeCache.set(cacheKey, routes);
      setTimeout(() => this.routeCache.delete(cacheKey), 5 * 60 * 1000);

      return routes;
    } catch (error) {
      console.warn('OSRM routing failed, using fallback:', error);
      return this.generateFallbackRoute(waypoints);
    }
  }

  private generateInstruction(step: any): string {
    const type = step.maneuver?.type || 'continue';
    const modifier = step.maneuver?.modifier || '';
    const name = step.name || 'the road';
    switch (type) {
      case 'turn': return `Turn ${modifier} onto ${name}`;
      case 'new name': return `Continue onto ${name}`;
      case 'depart': return `Head ${modifier} on ${name}`;
      case 'arrive': return `You have arrived at your destination`;
      case 'merge': return `Merge ${modifier} onto ${name}`;
      case 'ramp': return `Take the ramp ${modifier}`;
      case 'fork': return `Keep ${modifier} at the fork`;
      case 'roundabout': return `Enter the roundabout, take the exit onto ${name}`;
      case 'exit roundabout': return `Exit onto ${name}`;
      default: return `Continue on ${name}`;
    }
  }

  async getSpeedLimit(location: Coordinate): Promise<number | null> {
    try {
      const url = `https://overpass-api.de/api/interpreter?data=[out:json];way(around:50,${location[1]},${location[0]})[maxspeed];out;`;
      const response = await fetch(url);
      if (!response.ok) return null;
      const data = await response.json();
      if (data.elements?.length > 0) {
        const maxspeed = data.elements[0].tags?.maxspeed;
        if (maxspeed) {
          const limit = parseInt(maxspeed);
          return isNaN(limit) ? null : limit;
        }
      }
      return null;
    } catch { return null; }
  }

  private generateFallbackRoute(waypoints: Coordinate[]): Route[] {
    if (waypoints.length < 2) return [];

    const start = waypoints[0];
    const end = waypoints[waypoints.length - 1];
    
    const distance = this.calculateDistance(start, end);
    const duration = distance / 50 * 3600;

    const coordinates: Coordinate[] = [];
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      coordinates.push([
        start[0] + (end[0] - start[0]) * t,
        start[1] + (end[1] - start[1]) * t
      ]);
    }

    return [{
      id: `route_${Date.now()}`,
      geometry: {
        type: 'LineString',
        coordinates
      },
      distance: distance * 1000,
      duration,
      legs: [{
        steps: [{
          distance: distance * 1000,
          duration,
          geometry: { type: 'LineString', coordinates },
          instruction: 'Proceed to destination',
          name: 'Route',
          maneuver: {
            type: 'depart',
            instruction: 'Start navigation',
            bearing_after: 0,
            location: start
          }
        }],
        distance: distance * 1000,
        duration,
        summary: `${(distance).toFixed(1)} km`
      }],
      summary: `Direct route (${(distance).toFixed(1)} km)`,
      privacy: {
        obfuscated: this.privacySettings.locationObfuscation,
        fuzzyPoints: [],
        timestamp: Date.now(),
        sessionId: null
      }
    }];
  }

  private calculateDistance(coord1: Coordinate, coord2: Coordinate): number {
    const R = 6371;
    const dLat = this.toRad(coord2[1] - coord1[1]);
    const dLon = this.toRad(coord2[0] - coord1[0]);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.toRad(coord1[1])) * Math.cos(this.toRad(coord2[1])) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  async search(
    query: string,
    options?: {
      bbox?: [number, number, number, number];
      nearLocation?: Coordinate;
      radiusMiles?: number;
    }
  ): Promise<SearchResult[]> {
    if (!query.trim()) return [];

    const cacheKey = `search_${query}_${options?.nearLocation?.join(',')}_${options?.radiusMiles}`;
    const cached = this.searchCache.get(cacheKey);
    if (cached) return cached;

    try {
      // Use backend proxy instead of direct Nominatim calls
      const params = new URLSearchParams({
        q: query,
        format: 'jsonv2',
        addressdetails: '1',
        limit: '15',
        dedupe: '1'
      });

      if (options?.nearLocation && options?.radiusMiles) {
        const radiusKm = options.radiusMiles * 1.60934;
        const latOffset = radiusKm / 111.32;
        const lonOffset = radiusKm / (111.32 * Math.cos(options.nearLocation[1] * Math.PI / 180));

        const viewbox = [
          options.nearLocation[0] - lonOffset,
          options.nearLocation[1] + latOffset,
          options.nearLocation[0] + lonOffset,
          options.nearLocation[1] - latOffset
        ].join(',');

        params.set('viewbox', viewbox);
        params.set('bounded', '0');
      } else if (options?.bbox) {
        params.set('viewbox', options.bbox.join(','));
        params.set('bounded', '1');
      }

      // Call backend proxy endpoint
      const response = await fetch(`/api/navigation/search?${params}`);

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status}`);
      }

      let results = await response.json();

      let searchResults: SearchResult[] = results.map((item: Record<string, string>) => ({
        id: `osm:${item.osm_type?.[0] || 'n'}${item.osm_id}`,
        name: item.display_name,
        coordinate: [parseFloat(item.lon), parseFloat(item.lat)] as Coordinate,
        type: item.type,
        category: item.class,
        address: item.address || {},
        importance: parseFloat(item.importance || '0'),
        distance: options?.nearLocation
          ? this.calculateDistance(options.nearLocation, [parseFloat(item.lon), parseFloat(item.lat)])
          : undefined
      }));

      if (options?.nearLocation) {
        searchResults.sort((a, b) => {
          const distA = (a as any).distance ?? Infinity;
          const distB = (b as any).distance ?? Infinity;
          const importanceA = (a as any).importance || 0;
          const importanceB = (b as any).importance || 0;
          const scoreA = importanceA * 10 - distA * 0.1;
          const scoreB = importanceB * 10 - distB * 0.1;
          return scoreB - scoreA;
        });
      }

      this.searchCache.set(cacheKey, searchResults);
      setTimeout(() => this.searchCache.delete(cacheKey), 30 * 1000);

      return searchResults.slice(0, 10);
    } catch (error) {
      console.error('Search error:', error);
      return [];
    }
  }

  async reverseGeocode(coord: Coordinate): Promise<string> {
    try {
      const response = await fetch(
        `${this.baseUrl}/api/navigation/reverse?lat=${coord[1]}&lon=${coord[0]}`
      );

      if (!response.ok) return 'Unknown location';

      const data = await response.json();
      return data.display_name || 'Unknown location';
    } catch {
      return 'Unknown location';
    }
  }

  async downloadRegion(
    bbox: [number, number, number, number],
    name: string,
    zoomRange: [number, number] = [0, 14]
  ): Promise<{ jobId: string; estimatedSize: number }> {
    try {
      const response = await fetch(`${this.baseUrl}/api/navigation/maps/download`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          region: { bbox, name, zoomRange },
          priority: 'high'
        })
      });

      if (!response.ok) throw new Error('Download request failed');

      return await response.json();
    } catch (error) {
      console.error('Download region error:', error);
      throw error;
    }
  }

  async getDownloadStatus(jobId: string): Promise<OfflineRegion> {
    const response = await fetch(`${this.baseUrl}/api/navigation/maps/status/${jobId}`);
    return await response.json();
  }

  async getOfflineRegions(): Promise<OfflineRegion[]> {
    const stored = localStorage.getItem('g3zkp_offline_regions');
    return stored ? JSON.parse(stored) : [];
  }

  async deleteOfflineRegion(regionId: string): Promise<void> {
    const regions = await this.getOfflineRegions();
    const updated = regions.filter(r => r.id !== regionId);
    localStorage.setItem('g3zkp_offline_regions', JSON.stringify(updated));
  }

  setPrivacySettings(settings: Partial<PrivacySettings>): void {
    this.privacySettings = { ...this.privacySettings, ...settings };
  }

  getPrivacySettings(): PrivacySettings {
    return { ...this.privacySettings };
  }
}

export const navigationService = new NavigationService();
export default navigationService;
