import { Coordinate } from '../types/navigation';

export type PrivacyLevel = 'low' | 'medium' | 'high' | 'maximum';

export interface PrivacyConfig {
  level: PrivacyLevel;
  locationObfuscation: boolean;
  routeTracking: boolean;
  dataPersistence: 'ephemeral' | 'session' | 'permanent';
  p2pUpdates: boolean;
  shareWithMesh: boolean;
}

const DEFAULT_CONFIG: PrivacyConfig = {
  level: 'medium',
  locationObfuscation: true,
  routeTracking: false,
  dataPersistence: 'ephemeral',
  p2pUpdates: false,
  shareWithMesh: false
};

const OFFSETS: Record<PrivacyLevel, number> = {
  low: 0.0001,
  medium: 0.0005,
  high: 0.001,
  maximum: 0.005
};

export class PrivacyService {
  private static config: PrivacyConfig = { ...DEFAULT_CONFIG };
  private static obfuscationCache: Map<string, Coordinate> = new Map();
  private static sessionSalt: string = Math.random().toString(36).substr(2, 16);

  static obfuscateCoordinate(coord: Coordinate, level?: PrivacyLevel): Coordinate {
    const effectiveLevel = level || this.config.level;
    if (!this.config.locationObfuscation && !level) return coord;

    const cacheKey = `${coord[0].toFixed(4)},${coord[1].toFixed(4)},${effectiveLevel}`;
    const cached = this.obfuscationCache.get(cacheKey);
    if (cached) return cached;

    const offset = OFFSETS[effectiveLevel];
    const seedLon = this.deterministicRandom(coord[0], this.sessionSalt);
    const seedLat = this.deterministicRandom(coord[1], this.sessionSalt);

    const obfuscated: Coordinate = [
      coord[0] + (seedLon - 0.5) * offset * 2,
      coord[1] + (seedLat - 0.5) * offset * 2
    ];

    this.obfuscationCache.set(cacheKey, obfuscated);

    if (this.obfuscationCache.size > 1000) {
      const keys = Array.from(this.obfuscationCache.keys()).slice(0, 500);
      keys.forEach(k => this.obfuscationCache.delete(k));
    }

    return obfuscated;
  }

  static obfuscateRoute(coordinates: Coordinate[], level?: PrivacyLevel): Coordinate[] {
    const effectiveLevel = level || this.config.level;
    const offset = OFFSETS[effectiveLevel];

    const baseOffsetLon = (this.deterministicRandom(coordinates[0]?.[0] || 0, this.sessionSalt) - 0.5) * offset;
    const baseOffsetLat = (this.deterministicRandom(coordinates[0]?.[1] || 0, this.sessionSalt) - 0.5) * offset;

    return coordinates.map(coord => [
      coord[0] + baseOffsetLon + (Math.random() - 0.5) * offset * 0.1,
      coord[1] + baseOffsetLat + (Math.random() - 0.5) * offset * 0.1
    ] as Coordinate);
  }

  static getConfig(): PrivacyConfig {
    return { ...this.config };
  }

  static setConfig(config: Partial<PrivacyConfig>): void {
    this.config = { ...this.config, ...config };
    this.obfuscationCache.clear();
    this.persistConfig();
  }

  static setLevel(level: PrivacyLevel): void {
    this.config.level = level;
    this.obfuscationCache.clear();
    this.persistConfig();
  }

  static getLevel(): PrivacyLevel {
    return this.config.level;
  }

  static getOffset(level?: PrivacyLevel): number {
    return OFFSETS[level || this.config.level];
  }

  static generateAnonymousId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `anon_${timestamp}_${random}`;
  }

  static hashLocation(coord: Coordinate): string {
    const precision = 3;
    const rounded = `${coord[0].toFixed(precision)},${coord[1].toFixed(precision)}`;
    let hash = 0;
    for (let i = 0; i < rounded.length; i++) {
      const char = rounded.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }

  static isDataExpired(timestamp: number): boolean {
    const maxAge: Record<string, number> = {
      ephemeral: 5 * 60 * 1000,
      session: 24 * 60 * 60 * 1000,
      permanent: Infinity
    };
    return Date.now() - timestamp > maxAge[this.config.dataPersistence];
  }

  static clearSession(): void {
    this.sessionSalt = Math.random().toString(36).substr(2, 16);
    this.obfuscationCache.clear();
  }

  private static deterministicRandom(seed: number, salt: string): number {
    const combined = seed.toString() + salt;
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return (Math.abs(hash) % 10000) / 10000;
  }

  private static persistConfig(): void {
    try {
      localStorage.setItem('g3zkp_privacy_config', JSON.stringify(this.config));
    } catch (e) {
      console.error('Failed to persist privacy config:', e);
    }
  }

  static loadConfig(): void {
    try {
      const stored = localStorage.getItem('g3zkp_privacy_config');
      if (stored) {
        this.config = { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.error('Failed to load privacy config:', e);
    }
  }
}

PrivacyService.loadConfig();

export default PrivacyService;
