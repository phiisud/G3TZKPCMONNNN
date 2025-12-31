import { Coordinate } from '../types/navigation';
import { PrivacyService } from './PrivacyService';
import { io, Socket } from 'socket.io-client';
import { g3tzkpService } from './G3TZKPService';
import { createAndSignReport, GeoLocation, HazardData } from './geo/GeoBroadcastTypes';
import nacl from 'tweetnacl';

export interface TrafficReport {
  id: string;
  location: Coordinate;
  speed: number;
  timestamp: number;
  roadType: string;
  confidence: number;
  sessionId: string;
  encrypted: boolean;
}

export interface TrafficIncident {
  id: string;
  type: 'accident' | 'congestion' | 'road_closure' | 'hazard' | 'police' | 'speed_camera' | 'construction' | 'weather';
  location: Coordinate;
  severity: number;
  description: string;
  timestamp: number;
  expiresAt: number;
  distance: number;
  verified: boolean;
  verificationCount: number;
  source: 'user' | 'official' | 'sensor';
}

export interface RoadCondition {
  type: 'wet' | 'icy' | 'foggy' | 'windy' | 'bumpy' | 'smooth' | 'gravel' | 'potholes';
  location: Coordinate;
  severity: number;
  description: string;
  timestamp: number;
}

export interface HazardReport {
  type: 'police' | 'accident' | 'hazard' | 'speed_camera';
  location: Coordinate;
  timestamp: number;
  direction: number;
  confidence: number;
  additionalInfo: string;
}

interface StoredHazard extends HazardReport {
  id: string;
  expiresAt: number;
  verificationCount: number;
}

const getSocketUrl = (): string => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    const isSecure = window.location.protocol === 'https:';
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `http://${hostname}:${import.meta.env.VITE_MESSAGING_PORT || 3001}`;
    }
    const port = window.location.port || (isSecure ? '443' : '80');
    return isSecure 
      ? `https://${hostname}${port !== '443' ? ':' + port : ''}`
      : `http://${hostname}${port !== '80' ? ':' + port : ''}`;
  }
  return `http://localhost:${import.meta.env.VITE_MESSAGING_PORT || 3001}`;
};

const SOCKET_URL = getSocketUrl();

class TrafficServiceClass {
  private socket: Socket | null = null;
  private connected: boolean = false;
  private trafficCache: Map<string, TrafficReport[]> = new Map();
  private hazardsCache: Map<string, StoredHazard[]> = new Map();
  private listeners: Map<string, ((data: any) => void)[]> = new Map();
  private pendingHazardRequests: Map<string, { resolve: (data: any) => void; timeout: NodeJS.Timeout }> = new Map();
  private p2pKeyPair: { publicKey: Uint8Array; secretKey: Uint8Array } | null = null;

  constructor() {
    this.loadFromStorage();
    this.connect();
    this.initializeP2PKeys();
  }

  private initializeP2PKeys(): void {
    try {
      const storedKeys = localStorage.getItem('g3zkp_traffic_keys');
      if (storedKeys) {
        const parsed = JSON.parse(storedKeys);
        this.p2pKeyPair = {
          publicKey: new Uint8Array(Object.values(parsed.publicKey)),
          secretKey: new Uint8Array(Object.values(parsed.secretKey))
        };
      } else {
        this.p2pKeyPair = nacl.sign.keyPair();
        localStorage.setItem('g3zkp_traffic_keys', JSON.stringify({
          publicKey: Array.from(this.p2pKeyPair.publicKey),
          secretKey: Array.from(this.p2pKeyPair.secretKey)
        }));
      }
      console.log('[TrafficService] P2P keys initialized');
    } catch (error) {
      console.error('[TrafficService] Failed to initialize P2P keys:', error);
      this.p2pKeyPair = nacl.sign.keyPair();
    }
  }

  private connect(): void {
    if (this.socket?.connected) return;

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10
    });

    this.socket.on('connect', () => {
      this.connected = true;
      console.log('[TrafficService] Connected to traffic network');
    });

    this.socket.on('disconnect', () => {
      this.connected = false;
      console.log('[TrafficService] Disconnected from traffic network');
    });

    this.socket.on('hazard_broadcast', (hazard: StoredHazard) => {
      this.cacheHazardReport(hazard);
      this.persistToStorage();
      this.broadcast('hazard_received', hazard);
    });

    this.socket.on('hazard_verified', (data: { id: string; count: number }) => {
      for (const hazards of this.hazardsCache.values()) {
        const hazard = hazards.find(h => h.id === data.id);
        if (hazard) {
          hazard.verificationCount = data.count;
          hazard.expiresAt += 10 * 60 * 1000;
        }
      }
      this.persistToStorage();
      this.broadcast('hazard_verified', data);
    });

    this.socket.on('traffic_update', (report: TrafficReport) => {
      this.cacheTrafficReport(report);
      this.broadcast('traffic_update', report);
    });

    this.socket.on('nearby_hazards', (hazards: StoredHazard[]) => {
      for (const hazard of hazards) {
        this.cacheHazardReport(hazard);
      }
      this.persistToStorage();
    });
  }

  async reportTraffic(data: Omit<TrafficReport, 'id' | 'encrypted' | 'sessionId'>): Promise<void> {
    const report: TrafficReport = {
      ...data,
      id: `traffic_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sessionId: this.getSessionId(),
      encrypted: true,
      location: PrivacyService.obfuscateCoordinate(data.location, 'medium')
    };

    this.cacheTrafficReport(report);

    if (this.socket?.connected) {
      this.socket.emit('traffic_report', report);
    }

    this.broadcast('traffic_report', report);
  }

  async reportHazard(data: HazardReport): Promise<string> {
    const reportId = `hazard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = Date.now() + (data.type === 'police' ? 30 : 60) * 60 * 1000;

    const storedHazard: StoredHazard = {
      ...data,
      id: reportId,
      location: PrivacyService.obfuscateCoordinate(data.location, 'high'),
      expiresAt,
      verificationCount: 1
    };

    this.cacheHazardReport(storedHazard);
    this.persistToStorage();

    if (this.socket?.connected) {
      this.socket.emit('hazard_report', storedHazard);
    }

    this.broadcast('hazard_report', storedHazard);

    await this.broadcastHazardViaP2P(data);

    return reportId;
  }

  private async broadcastHazardViaP2P(data: HazardReport): Promise<void> {
    if (!this.p2pKeyPair || !g3tzkpService.isInitialized()) {
      console.log('[TrafficService] P2P not available, skipping P2P broadcast');
      return;
    }

    try {
      const location: GeoLocation = {
        latitude: data.location[1],
        longitude: data.location[0],
        timestamp: data.timestamp,
        heading: data.direction,
        accuracy: 10
      };

      const hazardTypeMap: Record<string, HazardData['hazardType']> = {
        'police': 'police',
        'accident': 'accident',
        'hazard': 'other',
        'speed_camera': 'speed_camera'
      };

      const hazardData: HazardData = {
        hazardType: hazardTypeMap[data.type] || 'other',
        severity: data.confidence > 0.7 ? 'high' : data.confidence > 0.4 ? 'medium' : 'low',
        description: data.additionalInfo,
        direction: this.getDirectionFromHeading(data.direction)
      };

      const signedReport = await createAndSignReport(
        'HAZARD',
        location,
        hazardData,
        this.p2pKeyPair.secretKey,
        this.p2pKeyPair.publicKey
      );

      const success = await g3tzkpService.broadcastGeoReport(signedReport, 'HAZARD');
      if (success) {
        console.log('[TrafficService] Hazard broadcast via P2P:', signedReport.id);
      }
    } catch (error) {
      console.error('[TrafficService] Failed to broadcast hazard via P2P:', error);
    }
  }

  private getDirectionFromHeading(heading: number): 'northbound' | 'southbound' | 'eastbound' | 'westbound' {
    if (heading >= 315 || heading < 45) return 'northbound';
    if (heading >= 45 && heading < 135) return 'eastbound';
    if (heading >= 135 && heading < 225) return 'southbound';
    return 'westbound';
  }

  async getNearbyIncidents(location: Coordinate, radius: number): Promise<TrafficIncident[]> {
    if (this.socket?.connected) {
      this.socket.emit('get_nearby_hazards', { location, radius });
    }

    this.cleanupExpiredData();
    return this.getCachedIncidents(location, radius);
  }

  async getRoadConditions(_location: Coordinate, _radius: number): Promise<RoadCondition[]> {
    return [];
  }

  async verifyIncident(incidentId: string): Promise<void> {
    for (const hazards of this.hazardsCache.values()) {
      const hazard = hazards.find(h => h.id === incidentId);
      if (hazard) {
        hazard.verificationCount++;
        hazard.expiresAt += 10 * 60 * 1000;
        this.persistToStorage();

        if (this.socket?.connected) {
          this.socket.emit('hazard_verify', { hazardId: incidentId });
        }

        this.broadcast('hazard_verified', { id: incidentId, count: hazard.verificationCount });
        return;
      }
    }
  }

  async getRouteTraffic(routeCoordinates: Coordinate[]): Promise<{
    segments: Array<{ start: Coordinate; end: Coordinate; speed: number | null; congestion: number; incidents: TrafficIncident[]; hasData: boolean }>;
    averageSpeed: number | null;
    congestionLevel: number;
    dataAvailable: boolean;
  }> {
    const segments: any[] = [];
    const sampleInterval = Math.max(1, Math.floor(routeCoordinates.length / 10));
    let hasAnyData = false;

    for (let i = 0; i < routeCoordinates.length - 1; i += sampleInterval) {
      const start = routeCoordinates[i];
      const end = routeCoordinates[Math.min(i + sampleInterval, routeCoordinates.length - 1)];
      const midpoint = this.calculateMidpoint(start, end);
      const incidents = await this.getNearbyIncidents(midpoint, 500);
      const trafficData = this.getTrafficDataForArea(midpoint, 500);
      const hasData = trafficData.length > 0;
      if (hasData) hasAnyData = true;
      const avgSpeed = hasData ? trafficData.reduce((sum, r) => sum + r.speed, 0) / trafficData.length : null;
      const congestion = hasData ? this.calculateCongestionLevel(avgSpeed!, incidents) : incidents.length > 0 ? 0.3 : 0;

      segments.push({ start, end, speed: avgSpeed, congestion, incidents, hasData });
    }

    const segmentsWithData = segments.filter(s => s.hasData);
    const averageSpeed = segmentsWithData.length > 0 
      ? segmentsWithData.reduce((sum, seg) => sum + seg.speed, 0) / segmentsWithData.length 
      : null;
    const congestionLevel = segments.length > 0 
      ? segments.reduce((sum, seg) => sum + seg.congestion, 0) / segments.length 
      : 0;

    return { segments, averageSpeed, congestionLevel, dataAvailable: hasAnyData };
  }

  subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(callback);
    return () => {
      const list = this.listeners.get(event);
      if (list) {
        const idx = list.indexOf(callback);
        if (idx >= 0) list.splice(idx, 1);
      }
    };
  }

  isConnected(): boolean {
    return this.connected;
  }

  private broadcast(event: string, data: any): void {
    const list = this.listeners.get(event);
    if (list) list.forEach(cb => cb(data));
  }

  private getSessionId(): string {
    let sessionId = localStorage.getItem('g3zkp_nav_session');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('g3zkp_nav_session', sessionId);
    }
    return sessionId;
  }

  private getRegionKey(location: Coordinate): string {
    return `${Math.floor(location[1] * 10)},${Math.floor(location[0] * 10)}`;
  }

  private cacheTrafficReport(report: TrafficReport): void {
    const region = this.getRegionKey(report.location);
    if (!this.trafficCache.has(region)) this.trafficCache.set(region, []);
    const reports = this.trafficCache.get(region)!;
    reports.push(report);
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    this.trafficCache.set(region, reports.filter(r => r.timestamp > fiveMinutesAgo));
  }

  private cacheHazardReport(hazard: StoredHazard): void {
    const region = this.getRegionKey(hazard.location);
    if (!this.hazardsCache.has(region)) this.hazardsCache.set(region, []);
    const hazards = this.hazardsCache.get(region)!;
    const existing = hazards.findIndex(h => h.id === hazard.id);
    if (existing >= 0) {
      hazards[existing] = hazard;
    } else {
      hazards.push(hazard);
    }
    const now = Date.now();
    this.hazardsCache.set(region, hazards.filter(h => h.expiresAt > now));
  }

  private getCachedIncidents(location: Coordinate, radius: number): TrafficIncident[] {
    const incidents: TrafficIncident[] = [];
    const now = Date.now();

    for (const hazards of this.hazardsCache.values()) {
      for (const hazard of hazards) {
        if (hazard.expiresAt <= now) continue;
        const distance = this.calculateDistance(location, hazard.location);
        if (distance <= radius) {
          incidents.push({
            id: hazard.id,
            type: hazard.type,
            location: hazard.location,
            severity: hazard.type === 'accident' ? 0.8 : hazard.type === 'police' ? 0.4 : 0.5,
            description: this.getHazardDescription(hazard.type),
            timestamp: hazard.timestamp,
            expiresAt: hazard.expiresAt,
            distance,
            verified: hazard.verificationCount > 2,
            verificationCount: hazard.verificationCount,
            source: 'user'
          });
        }
      }
    }

    return incidents.sort((a, b) => a.distance - b.distance);
  }

  private getHazardDescription(type: string): string {
    const descriptions: Record<string, string> = {
      police: 'Police reported ahead',
      accident: 'Accident reported',
      hazard: 'Road hazard reported',
      speed_camera: 'Speed camera ahead'
    };
    return descriptions[type] || 'Hazard reported';
  }

  private getTrafficDataForArea(location: Coordinate, radius: number): TrafficReport[] {
    const region = this.getRegionKey(location);
    const reports = this.trafficCache.get(region) || [];
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;

    return reports.filter(r => {
      if (r.timestamp < fiveMinutesAgo) return false;
      const distance = this.calculateDistance(location, r.location);
      return distance <= radius;
    });
  }

  private calculateCongestionLevel(speed: number, incidents: TrafficIncident[]): number {
    const baseLevel = speed < 20 ? 0.9 : speed < 40 ? 0.6 : speed < 60 ? 0.3 : 0.1;
    const incidentBonus = incidents.reduce((acc, i) => acc + i.severity * 0.1, 0);
    return Math.min(1, baseLevel + incidentBonus);
  }

  private calculateMidpoint(start: Coordinate, end: Coordinate): Coordinate {
    return [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
  }

  private calculateDistance(coord1: Coordinate, coord2: Coordinate): number {
    const R = 6371000;
    const lat1 = coord1[1] * Math.PI / 180;
    const lat2 = coord2[1] * Math.PI / 180;
    const dLat = (coord2[1] - coord1[1]) * Math.PI / 180;
    const dLon = (coord2[0] - coord1[0]) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private cleanupExpiredData(): void {
    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000;

    for (const [region, reports] of this.trafficCache.entries()) {
      this.trafficCache.set(region, reports.filter(r => r.timestamp > fiveMinutesAgo));
    }

    for (const [region, hazards] of this.hazardsCache.entries()) {
      this.hazardsCache.set(region, hazards.filter(h => h.expiresAt > now));
    }
  }

  private persistToStorage(): void {
    try {
      const hazards: StoredHazard[] = [];
      for (const regionHazards of this.hazardsCache.values()) {
        hazards.push(...regionHazards);
      }
      localStorage.setItem('g3zkp_hazards', JSON.stringify(hazards));
    } catch (e) {
      console.error('Failed to persist traffic data:', e);
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem('g3zkp_hazards');
      if (stored) {
        const hazards: StoredHazard[] = JSON.parse(stored);
        const now = Date.now();
        for (const hazard of hazards) {
          if (hazard.expiresAt > now) {
            this.cacheHazardReport(hazard);
          }
        }
      }
    } catch (e) {
      console.error('Failed to load traffic data:', e);
    }
  }
}

export const TrafficService = new TrafficServiceClass();
export default TrafficService;
