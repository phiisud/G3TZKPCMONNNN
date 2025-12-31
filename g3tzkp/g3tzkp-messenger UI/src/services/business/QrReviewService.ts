/**
 * G3ZKP QR Review Service
 * Handles QR code generation for businesses and proof validation for reviews
 * Ensures customers have physically visited a business before leaving reviews
 */

import nacl from 'tweetnacl';
// uint8arrays removed - use native TextEncoder/TextDecoder
// import { fromString, toString } from 'uint8arrays';
const fromString = (str: string): Uint8Array => new TextEncoder().encode(str);
const toString = (arr: Uint8Array): string => new TextDecoder().decode(arr);
import {
  SignedGeoReport,
  ReviewData,
  GeoLocation,
  createAndSignReport,
  verifyReportSignature
} from '../geo/GeoBroadcastTypes';
import { g3tzkpService } from '../G3TZKPService';

export interface BusinessQrData {
  businessId: string;
  businessName: string;
  businessPublicKey: string;
  signedTimestamp: string;
  signature: string;
  validUntil: number;
  location: {
    latitude: number;
    longitude: number;
  };
}

export interface QrGenerationConfig {
  validityDurationMs: number;
  requireLocation: boolean;
  maxUsages: number;
}

const DEFAULT_QR_CONFIG: QrGenerationConfig = {
  validityDurationMs: 30 * 60 * 1000,
  requireLocation: true,
  maxUsages: 1
};

interface StoredBusinessKeys {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
  businessId: string;
  businessName: string;
  location: GeoLocation;
  createdAt: number;
}

class QrReviewService {
  private businessKeys: Map<string, StoredBusinessKeys> = new Map();
  private usedQrCodes: Map<string, number> = new Map();
  private readonly QR_CLEANUP_INTERVAL = 60 * 60 * 1000;

  constructor() {
    this.startCleanupTask();
  }

  private startCleanupTask(): void {
    setInterval(() => {
      this.cleanupExpiredQrCodes();
    }, this.QR_CLEANUP_INTERVAL);
  }

  private cleanupExpiredQrCodes(): void {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;

    for (const [key, timestamp] of this.usedQrCodes) {
      if (timestamp < oneHourAgo) {
        this.usedQrCodes.delete(key);
      }
    }
  }

  async registerBusiness(
    businessId: string,
    businessName: string,
    location: GeoLocation
  ): Promise<{ publicKey: string; privateKey: string }> {
    const keyPair = nacl.sign.keyPair();

    this.businessKeys.set(businessId, {
      publicKey: keyPair.publicKey,
      privateKey: keyPair.secretKey,
      businessId,
      businessName,
      location,
      createdAt: Date.now()
    });

    return {
      publicKey: toString(keyPair.publicKey, 'base64'),
      privateKey: toString(keyPair.secretKey, 'base64')
    };
  }

  async generateSignedQrCode(
    businessId: string,
    config: Partial<QrGenerationConfig> = {}
  ): Promise<BusinessQrData | null> {
    const business = this.businessKeys.get(businessId);
    if (!business) {
      console.error(`[QrReview] Business not found: ${businessId}`);
      return null;
    }

    const mergedConfig = { ...DEFAULT_QR_CONFIG, ...config };
    const now = Date.now();
    const validUntil = now + mergedConfig.validityDurationMs;

    const timestampPayload = JSON.stringify({
      businessId,
      timestamp: now,
      validUntil,
      nonce: Math.random().toString(36).substring(2, 15)
    });

    const payloadBytes = fromString(timestampPayload);
    const signatureBytes = nacl.sign.detached(payloadBytes, business.privateKey);

    const qrData: BusinessQrData = {
      businessId,
      businessName: business.businessName,
      businessPublicKey: toString(business.publicKey, 'base64'),
      signedTimestamp: timestampPayload,
      signature: toString(signatureBytes, 'base64'),
      validUntil,
      location: {
        latitude: business.location.latitude,
        longitude: business.location.longitude
      }
    };

    console.log(`[QrReview] Generated QR code for business: ${businessName}, valid until: ${new Date(validUntil).toISOString()}`);

    return qrData;
  }

  async validateQrCodeAndCreateReview(
    qrData: BusinessQrData,
    rating: 1 | 2 | 3 | 4 | 5,
    comment: string,
    userLocation: GeoLocation,
    userPrivateKey: Uint8Array,
    userPublicKey: Uint8Array
  ): Promise<{ success: boolean; review?: SignedGeoReport<ReviewData>; error?: string }> {
    const validationResult = this.validateQrCode(qrData);
    if (!validationResult.isValid) {
      return { success: false, error: validationResult.error };
    }

    const distanceMeters = this.calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      qrData.location.latitude,
      qrData.location.longitude
    );

    if (distanceMeters > 500) {
      return {
        success: false,
        error: `Too far from business location (${Math.round(distanceMeters)}m away, max 500m)`
      };
    }

    const qrKey = `${qrData.businessId}_${qrData.signedTimestamp}`;
    if (this.usedQrCodes.has(qrKey)) {
      return { success: false, error: 'This QR code has already been used' };
    }

    const reviewData: ReviewData = {
      businessId: qrData.businessId,
      businessName: qrData.businessName,
      rating,
      comment,
      qrProof: {
        businessPublicKey: qrData.businessPublicKey,
        signedTimestamp: qrData.signedTimestamp,
        signature: qrData.signature,
        validUntil: qrData.validUntil
      },
      categories: [],
      photos: []
    };

    try {
      const review = await createAndSignReport(
        'BUSINESS_REVIEW',
        userLocation,
        reviewData,
        userPrivateKey,
        userPublicKey
      );

      this.usedQrCodes.set(qrKey, Date.now());

      console.log(`[QrReview] Created review for ${qrData.businessName}: ${rating} stars`);

      return { success: true, review };
    } catch (error) {
      console.error('[QrReview] Failed to create review:', error);
      return { success: false, error: 'Failed to create signed review' };
    }
  }

  private validateQrCode(qrData: BusinessQrData): { isValid: boolean; error?: string } {
    if (!qrData.businessId || !qrData.businessPublicKey || !qrData.signedTimestamp || !qrData.signature) {
      return { isValid: false, error: 'Invalid QR code: missing required fields' };
    }

    if (Date.now() > qrData.validUntil) {
      return { isValid: false, error: 'QR code has expired' };
    }

    try {
      const payloadBytes = fromString(qrData.signedTimestamp);
      const signatureBytes = fromString(qrData.signature, 'base64');
      const publicKeyBytes = fromString(qrData.businessPublicKey, 'base64');

      const isValid = nacl.sign.detached.verify(payloadBytes, signatureBytes, publicKeyBytes);
      if (!isValid) {
        return { isValid: false, error: 'Invalid QR code signature' };
      }

      return { isValid: true };
    } catch (error) {
      console.error('[QrReview] QR code validation error:', error);
      return { isValid: false, error: 'Failed to verify QR code signature' };
    }
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    const deltaLat = (lat2 - lat1) * Math.PI / 180;
    const deltaLon = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  async broadcastReview(review: SignedGeoReport<ReviewData>): Promise<boolean> {
    try {
      if (!g3tzkpService.isInitialized()) {
        console.warn('[QrReview] LibP2P not initialized, cannot broadcast review');
        return false;
      }

      const topic = '/g3zkp/business/review/v1';
      const data = fromString(JSON.stringify(review));
      const success = await g3tzkpService.publishMessage(topic, data);

      if (success) {
        console.log(`[QrReview] Broadcast review for ${review.data.businessName}`);
      }

      return success;
    } catch (error) {
      console.error('[QrReview] Failed to broadcast review:', error);
      return false;
    }
  }

  parseQrCodeString(qrString: string): BusinessQrData | null {
    try {
      const parsed = JSON.parse(qrString);
      
      if (!parsed.businessId || !parsed.businessPublicKey || !parsed.signedTimestamp || !parsed.signature) {
        console.error('[QrReview] Invalid QR code format');
        return null;
      }

      return parsed as BusinessQrData;
    } catch (error) {
      console.error('[QrReview] Failed to parse QR code:', error);
      return null;
    }
  }

  generateQrCodeString(qrData: BusinessQrData): string {
    return JSON.stringify(qrData);
  }

  getBusinessKeys(businessId: string): StoredBusinessKeys | undefined {
    return this.businessKeys.get(businessId);
  }

  listRegisteredBusinesses(): string[] {
    return Array.from(this.businessKeys.keys());
  }
}

export const qrReviewService = new QrReviewService();
export default qrReviewService;
