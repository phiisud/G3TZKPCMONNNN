/**
 * G3ZKP Geo Broadcast Types
 * Core TypeScript interfaces for the unified P2P geo-broadcast system
 * Supports: Hazard Reports, Live Traffic Data, QR-Verified Business Reviews
 */

import nacl from 'tweetnacl';
// uint8arrays removed - use native TextEncoder/TextDecoder
// import { fromString, toString } from 'uint8arrays';

// Helper functions to replace uint8arrays
const fromString = (str: string): Uint8Array => new TextEncoder().encode(str);
const toString = (arr: Uint8Array): string => new TextDecoder().decode(arr);

export type GeoReportType = 'HAZARD' | 'TRAFFIC_SPEED' | 'BUSINESS_REVIEW';

export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

export interface HazardData {
  hazardType: 'police' | 'accident' | 'road_closure' | 'construction' | 'weather' | 'speed_camera' | 'debris' | 'traffic_jam' | 'other';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
  direction?: 'northbound' | 'southbound' | 'eastbound' | 'westbound' | 'both' | 'unknown';
  laneAffected?: string;
  expiresAt?: number;
}

export interface TrafficData {
  roadSegmentId?: string;
  speed: number;
  freeFlowSpeed?: number;
  congestionLevel: number;
  sampleCount: number;
  direction?: number;
}

export interface ReviewData {
  businessId: string;
  businessName: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  qrProof: {
    businessPublicKey: string;
    signedTimestamp: string;
    signature: string;
    validUntil: number;
  };
  categories?: string[];
  photos?: string[];
}

export interface SignedGeoReport<T extends HazardData | TrafficData | ReviewData = HazardData | TrafficData | ReviewData> {
  id: string;
  type: GeoReportType;
  location: GeoLocation;
  timestamp: number;
  expiresAt: number;
  data: T;
  signature: string;
  publicKey: string;
  version: string;
}

export interface GeoReportValidation {
  isValid: boolean;
  errors: string[];
  validatedAt: number;
}

export const GEO_BROADCAST_TOPICS = {
  HAZARD: '/g3zkp/geo/hazard/v1',
  TRAFFIC: '/g3zkp/geo/traffic/v1',
  REVIEW: '/g3zkp/business/review/v1'
} as const;

export const REPORT_TTL = {
  HAZARD: 60 * 60 * 1000,
  TRAFFIC_SPEED: 5 * 60 * 1000,
  BUSINESS_REVIEW: 365 * 24 * 60 * 60 * 1000
} as const;

export function generateReportId(type: GeoReportType): string {
  const prefix = type.toLowerCase().replace('_', '-');
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 11);
  return `${prefix}_${timestamp}_${random}`;
}

export function getReportTTL(type: GeoReportType): number {
  switch (type) {
    case 'HAZARD':
      return REPORT_TTL.HAZARD;
    case 'TRAFFIC_SPEED':
      return REPORT_TTL.TRAFFIC_SPEED;
    case 'BUSINESS_REVIEW':
      return REPORT_TTL.BUSINESS_REVIEW;
    default:
      return REPORT_TTL.HAZARD;
  }
}

export function getTopicForType(type: GeoReportType): string {
  switch (type) {
    case 'HAZARD':
      return GEO_BROADCAST_TOPICS.HAZARD;
    case 'TRAFFIC_SPEED':
      return GEO_BROADCAST_TOPICS.TRAFFIC;
    case 'BUSINESS_REVIEW':
      return GEO_BROADCAST_TOPICS.REVIEW;
    default:
      return GEO_BROADCAST_TOPICS.HAZARD;
  }
}

export function createSignaturePayload<T>(
  type: GeoReportType,
  location: GeoLocation,
  data: T,
  timestamp: number
): string {
  return JSON.stringify({
    type,
    location: {
      lat: location.latitude,
      lng: location.longitude,
      ts: location.timestamp
    },
    data,
    timestamp
  });
}

export async function createAndSignReport<T extends HazardData | TrafficData | ReviewData>(
  type: GeoReportType,
  location: GeoLocation,
  data: T,
  privateKey: Uint8Array,
  publicKey: Uint8Array
): Promise<SignedGeoReport<T>> {
  const timestamp = Date.now();
  const id = generateReportId(type);
  const expiresAt = timestamp + getReportTTL(type);

  const payload = createSignaturePayload(type, location, data, timestamp);
  const payloadBytes = fromString(payload);
  
  const signatureBytes = nacl.sign.detached(payloadBytes, privateKey);
  const signature = toString(signatureBytes, 'base64');
  const pubKeyBase64 = toString(publicKey, 'base64');

  return {
    id,
    type,
    location,
    timestamp,
    expiresAt,
    data,
    signature,
    publicKey: pubKeyBase64,
    version: '1.0.0'
  };
}

export function verifyReportSignature<T extends HazardData | TrafficData | ReviewData>(
  report: SignedGeoReport<T>
): boolean {
  try {
    const payload = createSignaturePayload(
      report.type,
      report.location,
      report.data,
      report.timestamp
    );
    const payloadBytes = fromString(payload);
    const signatureBytes = fromString(report.signature, 'base64');
    const publicKeyBytes = fromString(report.publicKey, 'base64');
    
    return nacl.sign.detached.verify(payloadBytes, signatureBytes, publicKeyBytes);
  } catch (error) {
    console.error('[GeoBroadcast] Signature verification failed:', error);
    return false;
  }
}

export function isReportExpired(report: SignedGeoReport): boolean {
  return Date.now() > report.expiresAt;
}

export function calculateDistance(
  loc1: GeoLocation,
  loc2: GeoLocation
): number {
  const R = 6371e3;
  const lat1Rad = loc1.latitude * Math.PI / 180;
  const lat2Rad = loc2.latitude * Math.PI / 180;
  const deltaLat = (loc2.latitude - loc1.latitude) * Math.PI / 180;
  const deltaLng = (loc2.longitude - loc1.longitude) * Math.PI / 180;

  const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
            Math.cos(lat1Rad) * Math.cos(lat2Rad) *
            Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function isWithinRadius(
  reportLocation: GeoLocation,
  centerLocation: GeoLocation,
  radiusMeters: number
): boolean {
  return calculateDistance(reportLocation, centerLocation) <= radiusMeters;
}
