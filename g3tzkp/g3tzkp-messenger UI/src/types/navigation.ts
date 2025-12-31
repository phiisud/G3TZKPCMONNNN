export type Coordinate = [number, number];

export interface BoundingBox {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

export interface RouteStep {
  distance: number;
  duration: number;
  geometry: {
    type: 'LineString';
    coordinates: Coordinate[];
  };
  instruction: string;
  name: string;
  mode?: string;
  driving_side?: string;
  weight?: number;
  maneuver: {
    type: string;
    modifier?: string;
    instruction: string;
    bearing_after: number;
    bearing_before?: number;
    location: Coordinate;
  };
}

export interface RouteLeg {
  steps: RouteStep[];
  distance: number;
  duration: number;
  summary: string;
}

export interface Route {
  id: string;
  geometry: {
    type: 'LineString';
    coordinates: Coordinate[];
  };
  distance: number;
  duration: number;
  legs: RouteLeg[];
  summary?: string;
  weight?: number;
  weight_name?: string;
  privacy?: {
    obfuscated: boolean;
    fuzzyPoints: Array<{
      original: Coordinate;
      displayed: Coordinate;
    }>;
    timestamp: number;
    sessionId: string | null;
  };
}

export interface SearchResult {
  id: string;
  name: string;
  coordinate: Coordinate;
  bbox?: BoundingBox;
  type: string;
  category: string;
  address: Record<string, string>;
}

export interface OfflineRegion {
  id: string;
  name: string;
  bbox: [number, number, number, number];
  zoomRange: [number, number];
  size: number;
  downloaded: number;
  expires?: number;
  hash?: string;
  status: 'queued' | 'downloading' | 'complete' | 'failed';
  progress: number;
}

export interface TrafficSegment {
  id: string;
  geometry: {
    type: 'LineString';
    coordinates: Coordinate[];
  };
  speed: number;
  congestion: number;
  timestamp: number;
  source: 'user' | 'official' | 'inferred';
  confidence: number;
  region: string;
}

export interface NavigationState {
  currentLocation: Coordinate | null;
  destination: Coordinate | null;
  waypoints: Coordinate[];
  currentRoute: Route | null;
  alternativeRoutes: Route[];
  isNavigating: boolean;
  currentStepIndex: number;
  distanceToNextStep: number;
  timeToDestination: number;
  heading: number;
  speed: number;
  offlineRegions: OfflineRegion[];
  trafficSegments: TrafficSegment[];
}

export interface PrivacySettings {
  locationObfuscation: boolean;
  routeTracking: boolean;
  dataPersistence: 'ephemeral' | 'session' | 'permanent';
  p2pUpdates: boolean;
}
