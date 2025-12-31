/**
 * G3ZKP Geo Validation Service
 * Validates incoming geo reports and maintains an in-memory store
 * Handles signature verification and type-specific validation
 */

import {
  SignedGeoReport,
  HazardData,
  TrafficData,
  ReviewData,
  GeoLocation,
  GeoReportType,
  GeoReportValidation,
  verifyReportSignature,
  isReportExpired,
  isWithinRadius
} from './GeoBroadcastTypes';

interface ReportStore {
  hazards: Map<string, SignedGeoReport<HazardData>>;
  traffic: Map<string, SignedGeoReport<TrafficData>>;
  reviews: Map<string, SignedGeoReport<ReviewData>>;
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
  report?: SignedGeoReport;
}

type ReportListener = (report: SignedGeoReport, type: GeoReportType) => void;

class GeoValidationService {
  private store: ReportStore = {
    hazards: new Map(),
    traffic: new Map(),
    reviews: new Map()
  };
  
  private listeners: Set<ReportListener> = new Set();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly MAX_REPORTS_PER_TYPE = 1000;
  private readonly CLEANUP_INTERVAL_MS = 60000;

  constructor() {
    this.startCleanupTask();
  }

  private startCleanupTask(): void {
    if (this.cleanupInterval) return;
    
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredReports();
    }, this.CLEANUP_INTERVAL_MS);
  }

  private cleanupExpiredReports(): void {
    const now = Date.now();
    
    for (const [id, report] of this.store.hazards) {
      if (report.expiresAt < now) {
        this.store.hazards.delete(id);
      }
    }
    
    for (const [id, report] of this.store.traffic) {
      if (report.expiresAt < now) {
        this.store.traffic.delete(id);
      }
    }
    
    console.log(`[GeoValidation] Cleanup complete. Hazards: ${this.store.hazards.size}, Traffic: ${this.store.traffic.size}, Reviews: ${this.store.reviews.size}`);
  }

  async verifyAndProcessReport(
    report: SignedGeoReport
  ): Promise<ValidationResult> {
    const errors: string[] = [];

    if (!report.id || !report.type || !report.location || !report.signature || !report.publicKey) {
      errors.push('Missing required report fields');
      return { isValid: false, errors };
    }

    if (isReportExpired(report)) {
      errors.push('Report has expired');
      return { isValid: false, errors };
    }

    if (!this.validateLocation(report.location)) {
      errors.push('Invalid location data');
      return { isValid: false, errors };
    }

    if (!verifyReportSignature(report)) {
      errors.push('Invalid signature');
      return { isValid: false, errors };
    }

    const typeValidation = this.validateByType(report);
    if (!typeValidation.isValid) {
      return typeValidation;
    }

    if (this.isDuplicate(report)) {
      errors.push('Duplicate report');
      return { isValid: false, errors };
    }

    this.storeReport(report);
    this.notifyListeners(report);

    return { isValid: true, errors: [], report };
  }

  private validateLocation(location: GeoLocation): boolean {
    if (typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
      return false;
    }
    if (location.latitude < -90 || location.latitude > 90) {
      return false;
    }
    if (location.longitude < -180 || location.longitude > 180) {
      return false;
    }
    if (typeof location.timestamp !== 'number' || location.timestamp <= 0) {
      return false;
    }
    return true;
  }

  private validateByType(report: SignedGeoReport): ValidationResult {
    switch (report.type) {
      case 'HAZARD':
        return this.validateHazardReport(report as SignedGeoReport<HazardData>);
      case 'TRAFFIC_SPEED':
        return this.validateTrafficReport(report as SignedGeoReport<TrafficData>);
      case 'BUSINESS_REVIEW':
        return this.validateReviewReport(report as SignedGeoReport<ReviewData>);
      default:
        return { isValid: false, errors: [`Unknown report type: ${report.type}`] };
    }
  }

  private validateHazardReport(report: SignedGeoReport<HazardData>): ValidationResult {
    const errors: string[] = [];
    const data = report.data;

    const validHazardTypes = ['police', 'accident', 'road_closure', 'construction', 'weather', 'speed_camera', 'debris', 'traffic_jam', 'other'];
    if (!validHazardTypes.includes(data.hazardType)) {
      errors.push(`Invalid hazard type: ${data.hazardType}`);
    }

    const validSeverities = ['low', 'medium', 'high', 'critical'];
    if (!validSeverities.includes(data.severity)) {
      errors.push(`Invalid severity: ${data.severity}`);
    }

    return { isValid: errors.length === 0, errors };
  }

  private validateTrafficReport(report: SignedGeoReport<TrafficData>): ValidationResult {
    const errors: string[] = [];
    const data = report.data;

    if (typeof data.speed !== 'number' || data.speed < 0 || data.speed > 300) {
      errors.push('Invalid speed value');
    }

    if (typeof data.congestionLevel !== 'number' || data.congestionLevel < 0 || data.congestionLevel > 1) {
      errors.push('Invalid congestion level');
    }

    return { isValid: errors.length === 0, errors };
  }

  private validateReviewReport(report: SignedGeoReport<ReviewData>): ValidationResult {
    const errors: string[] = [];
    const data = report.data;

    if (!data.businessId || typeof data.businessId !== 'string') {
      errors.push('Invalid business ID');
    }

    if (!data.rating || data.rating < 1 || data.rating > 5) {
      errors.push('Invalid rating (must be 1-5)');
    }

    if (!data.qrProof) {
      errors.push('Missing QR proof for business review');
    } else {
      const qrValidation = this.validateQrProof(data.qrProof);
      if (!qrValidation.isValid) {
        errors.push(...qrValidation.errors);
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  private validateQrProof(qrProof: ReviewData['qrProof']): ValidationResult {
    const errors: string[] = [];

    if (!qrProof.businessPublicKey || !qrProof.signedTimestamp || !qrProof.signature) {
      errors.push('Incomplete QR proof');
      return { isValid: false, errors };
    }

    if (Date.now() > qrProof.validUntil) {
      errors.push('QR proof has expired');
      return { isValid: false, errors };
    }

    return { isValid: errors.length === 0, errors };
  }

  private isDuplicate(report: SignedGeoReport): boolean {
    switch (report.type) {
      case 'HAZARD':
        return this.store.hazards.has(report.id);
      case 'TRAFFIC_SPEED':
        return this.store.traffic.has(report.id);
      case 'BUSINESS_REVIEW':
        return this.store.reviews.has(report.id);
      default:
        return false;
    }
  }

  private storeReport(report: SignedGeoReport): void {
    switch (report.type) {
      case 'HAZARD':
        if (this.store.hazards.size >= this.MAX_REPORTS_PER_TYPE) {
          const oldest = this.findOldestReport(this.store.hazards);
          if (oldest) this.store.hazards.delete(oldest);
        }
        this.store.hazards.set(report.id, report as SignedGeoReport<HazardData>);
        break;
      case 'TRAFFIC_SPEED':
        if (this.store.traffic.size >= this.MAX_REPORTS_PER_TYPE) {
          const oldest = this.findOldestReport(this.store.traffic);
          if (oldest) this.store.traffic.delete(oldest);
        }
        this.store.traffic.set(report.id, report as SignedGeoReport<TrafficData>);
        break;
      case 'BUSINESS_REVIEW':
        if (this.store.reviews.size >= this.MAX_REPORTS_PER_TYPE) {
          const oldest = this.findOldestReport(this.store.reviews);
          if (oldest) this.store.reviews.delete(oldest);
        }
        this.store.reviews.set(report.id, report as SignedGeoReport<ReviewData>);
        break;
    }

    console.log(`[GeoValidation] Stored ${report.type} report: ${report.id}`);
  }

  private findOldestReport<T>(map: Map<string, SignedGeoReport<T>>): string | null {
    let oldestId: string | null = null;
    let oldestTime = Infinity;

    for (const [id, report] of map) {
      if (report.timestamp < oldestTime) {
        oldestTime = report.timestamp;
        oldestId = id;
      }
    }

    return oldestId;
  }

  private notifyListeners(report: SignedGeoReport): void {
    for (const listener of this.listeners) {
      try {
        listener(report, report.type);
      } catch (error) {
        console.error('[GeoValidation] Listener error:', error);
      }
    }
  }

  onReport(listener: ReportListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getHazardsNear(location: GeoLocation, radiusMeters: number = 5000): SignedGeoReport<HazardData>[] {
    const results: SignedGeoReport<HazardData>[] = [];
    const now = Date.now();

    for (const report of this.store.hazards.values()) {
      if (report.expiresAt > now && isWithinRadius(report.location, location, radiusMeters)) {
        results.push(report);
      }
    }

    return results.sort((a, b) => b.timestamp - a.timestamp);
  }

  getTrafficNear(location: GeoLocation, radiusMeters: number = 1000): SignedGeoReport<TrafficData>[] {
    const results: SignedGeoReport<TrafficData>[] = [];
    const now = Date.now();

    for (const report of this.store.traffic.values()) {
      if (report.expiresAt > now && isWithinRadius(report.location, location, radiusMeters)) {
        results.push(report);
      }
    }

    return results.sort((a, b) => b.timestamp - a.timestamp);
  }

  getReviewsForBusiness(businessId: string): SignedGeoReport<ReviewData>[] {
    const results: SignedGeoReport<ReviewData>[] = [];

    for (const report of this.store.reviews.values()) {
      if (report.data.businessId === businessId) {
        results.push(report);
      }
    }

    return results.sort((a, b) => b.timestamp - a.timestamp);
  }

  getReviewsNear(location: GeoLocation, radiusMeters: number = 1000): SignedGeoReport<ReviewData>[] {
    const results: SignedGeoReport<ReviewData>[] = [];

    for (const report of this.store.reviews.values()) {
      if (isWithinRadius(report.location, location, radiusMeters)) {
        results.push(report);
      }
    }

    return results.sort((a, b) => b.timestamp - a.timestamp);
  }

  getStats(): { hazards: number; traffic: number; reviews: number } {
    return {
      hazards: this.store.hazards.size,
      traffic: this.store.traffic.size,
      reviews: this.store.reviews.size
    };
  }

  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.listeners.clear();
    this.store.hazards.clear();
    this.store.traffic.clear();
    this.store.reviews.clear();
  }
}

export const geoValidationService = new GeoValidationService();
export default geoValidationService;
