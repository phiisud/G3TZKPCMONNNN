import * as crypto from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import { LicenseKey } from './CryptoLicenseKeyService';

export interface BusinessVerificationKey extends LicenseKey {
  businessId: string;
  businessName: string;
  crn: string;
  ownerEmail: string;
}

class BusinessKeyService {
  private masterSecret: Uint8Array | null = null;

  constructor() {
    this.initializeMasterSecret();
  }

  private initializeMasterSecret(): void {
    const secretKey = process.env.REACT_APP_BUSINESS_KEY_SECRET || 
                      process.env.VITE_BUSINESS_KEY_SECRET ||
                      'g3tzkp-business-secret-do-not-use-in-production';
    
    const encoder = new TextEncoder();
    const hash = crypto.hash(encoder.encode(secretKey));
    this.masterSecret = hash;
  }

  async generateBusinessVerificationKey(
    businessId: string,
    businessName: string,
    crn: string,
    ownerId: string,
    ownerEmail: string,
    validityDays: number = 365
  ): Promise<BusinessVerificationKey> {
    if (!this.masterSecret) throw new Error('Master secret not initialized');

    const now = Date.now();
    const expiresAt = now + validityDays * 24 * 60 * 60 * 1000;
    const keyId = this.generateKeyId();

    const entityId = `${businessId}:${ownerId}`;
    
    const licenseData = {
      type: 'BUSINESS' as const,
      version: 1,
      entityId,
      issuedAt: now,
      expiresAt,
      keyId,
      purpose: 'business-profile' as const,
      businessId,
      businessName,
      crn,
      ownerEmail
    };

    const keyMaterial = this.generateSecureKeyMaterial(entityId, businessId, now, keyId);
    const hmac = this.computeHMAC(keyMaterial, this.masterSecret);
    const signature = this.sign(JSON.stringify(licenseData), this.masterSecret);

    return {
      ...licenseData,
      keyMaterial,
      hmac,
      signature,
      businessId,
      businessName,
      crn,
      ownerEmail
    };
  }

  validateBusinessKey(key: BusinessVerificationKey): { valid: boolean; reason?: string } {
    if (!this.masterSecret) {
      return { valid: false, reason: 'Master secret not initialized' };
    }

    try {
      const now = Date.now();

      if (now > key.expiresAt) {
        return { valid: false, reason: 'Business verification key expired' };
      }

      const expectedHmac = this.computeHMAC(key.keyMaterial, this.masterSecret);
      if (expectedHmac !== key.hmac) {
        return { valid: false, reason: 'HMAC verification failed - key has been tampered with' };
      }

      const keyDataForSignature = {
        type: key.type,
        version: key.version,
        entityId: key.entityId,
        issuedAt: key.issuedAt,
        expiresAt: key.expiresAt,
        keyId: key.keyId,
        purpose: key.purpose,
        businessId: key.businessId,
        businessName: key.businessName,
        crn: key.crn,
        ownerEmail: key.ownerEmail
      };

      const expectedSignature = this.sign(JSON.stringify(keyDataForSignature), this.masterSecret);
      if (expectedSignature !== key.signature) {
        return { valid: false, reason: 'Signature verification failed - possible key forgery' };
      }

      if (key.type !== 'BUSINESS') {
        return { valid: false, reason: 'Invalid key type - expected BUSINESS' };
      }

      if (!key.businessId || !key.crn || !key.ownerEmail) {
        return { valid: false, reason: 'Missing required business key fields' };
      }

      return { valid: true };
    } catch (error) {
      return { valid: false, reason: `Validation error: ${String(error)}` };
    }
  }

  getBusinessKeyInfo(key: BusinessVerificationKey): Record<string, any> {
    const now = Date.now();
    const timeRemaining = key.expiresAt - now;
    const daysRemaining = Math.floor(timeRemaining / (24 * 60 * 60 * 1000));

    return {
      businessId: key.businessId,
      businessName: key.businessName,
      crn: key.crn,
      ownerEmail: key.ownerEmail,
      keyId: key.keyId,
      issuedAt: new Date(key.issuedAt).toISOString(),
      expiresAt: new Date(key.expiresAt).toISOString(),
      daysRemaining,
      isExpired: now > key.expiresAt,
      needsRenewal: daysRemaining < 30
    };
  }

  rotateBusinessKey(oldKey: BusinessVerificationKey): Promise<BusinessVerificationKey> {
    const validation = this.validateBusinessKey(oldKey);
    if (!validation.valid) {
      return Promise.reject(new Error('Cannot rotate invalid business key'));
    }

    return this.generateBusinessVerificationKey(
      oldKey.businessId,
      oldKey.businessName,
      oldKey.crn,
      oldKey.entityId.split(':')[1],
      oldKey.ownerEmail
    );
  }

  serializeBusinessKey(key: BusinessVerificationKey): string {
    return btoa(JSON.stringify(key));
  }

  deserializeBusinessKey(serialized: string): BusinessVerificationKey | null {
    try {
      return JSON.parse(atob(serialized)) as BusinessVerificationKey;
    } catch (error) {
      console.error('Failed to deserialize business key:', error);
      return null;
    }
  }

  private generateKeyId(): string {
    const randomBytes = crypto.randomBytes(16);
    return encodeBase64(randomBytes);
  }

  private generateSecureKeyMaterial(
    entityId: string,
    businessId: string,
    timestamp: number,
    keyId: string
  ): string {
    if (!this.masterSecret) throw new Error('Master secret not initialized');

    const encoder = new TextEncoder();
    const combined = encoder.encode(`${entityId}:${businessId}:${timestamp}:${keyId}`);
    const keyDerivation = crypto.hash(combined);

    const mixed = new Uint8Array(keyDerivation.length);
    for (let i = 0; i < keyDerivation.length; i++) {
      mixed[i] = keyDerivation[i] ^ this.masterSecret[i % this.masterSecret.length];
    }

    const finalKey = crypto.hash(mixed);
    return encodeBase64(finalKey);
  }

  private computeHMAC(data: string, secret: Uint8Array): string {
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);
    const hmacBytes = this.hmacSHA256(dataBytes, secret);
    return encodeBase64(hmacBytes);
  }

  private hmacSHA256(message: Uint8Array, secret: Uint8Array): Uint8Array {
    const blockSize = 64;
    let key = secret;
    if (key.length > blockSize) {
      key = crypto.hash(key);
    }

    if (key.length < blockSize) {
      const padded = new Uint8Array(blockSize);
      padded.set(key);
      key = padded;
    }

    const opadKey = new Uint8Array(blockSize);
    const ipadKey = new Uint8Array(blockSize);

    for (let i = 0; i < blockSize; i++) {
      opadKey[i] = key[i] ^ 0x5c;
      ipadKey[i] = key[i] ^ 0x36;
    }

    const innerMessage = new Uint8Array(ipadKey.length + message.length);
    innerMessage.set(ipadKey);
    innerMessage.set(message, ipadKey.length);

    const innerHash = crypto.hash(innerMessage);

    const outerMessage = new Uint8Array(opadKey.length + innerHash.length);
    outerMessage.set(opadKey);
    outerMessage.set(innerHash, opadKey.length);

    return crypto.hash(outerMessage);
  }

  private sign(data: string, secret: Uint8Array): string {
    const encoder = new TextEncoder();
    const dataBytes = encoder.encode(data);
    const signature = this.hmacSHA256(dataBytes, secret);
    return encodeBase64(signature);
  }
}

export const businessKeyService = new BusinessKeyService();
