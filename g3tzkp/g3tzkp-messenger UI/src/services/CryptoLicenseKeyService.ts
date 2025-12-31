import * as crypto from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';

export interface LicenseKey {
  type: 'APP' | 'BUSINESS';
  version: number;
  entityId: string;
  issuedAt: number;
  expiresAt: number;
  keyId: string;
  purpose: 'messenger' | 'business-profile';
  keyMaterial: string;
  hmac: string;
  signature: string;
}

export interface KeyValidationResult {
  valid: boolean;
  reason?: string;
  key?: LicenseKey;
  expired?: boolean;
}

class CryptoLicenseKeyService {
  private masterSecret: Uint8Array | null = null;
  private initialized: boolean = false;

  constructor() {
    this.initializeMasterSecret();
  }

  private initializeMasterSecret(): void {
    const secretKey = process.env.REACT_APP_LICENSE_MASTER_SECRET || 
                      process.env.VITE_LICENSE_MASTER_SECRET ||
                      'g3tzkp-default-master-secret-do-not-use-in-production';
    
    const encoder = new TextEncoder();
    const hash = crypto.hash(encoder.encode(secretKey));
    this.masterSecret = hash;
    this.initialized = true;

    if (!process.env.REACT_APP_LICENSE_MASTER_SECRET && !process.env.VITE_LICENSE_MASTER_SECRET) {
      console.warn('⚠️ WARNING: Using default master secret. Set REACT_APP_LICENSE_MASTER_SECRET for production.');
    }
  }

  async generateAppLicense(userId: string, validityDays: number = 365): Promise<LicenseKey> {
    if (!this.masterSecret) throw new Error('Master secret not initialized');

    const now = Date.now();
    const expiresAt = now + validityDays * 24 * 60 * 60 * 1000;
    const keyId = this.generateKeyId();

    const licenseData = {
      type: 'APP',
      version: 1,
      entityId: userId,
      issuedAt: now,
      expiresAt,
      keyId,
      purpose: 'messenger'
    };

    const keyMaterial = this.generateSecureKeyMaterial(userId, now, keyId);
    const hmac = this.computeHMAC(keyMaterial, this.masterSecret);
    const signature = this.sign(JSON.stringify(licenseData), this.masterSecret);

    return {
      ...licenseData,
      keyMaterial,
      hmac,
      signature
    };
  }

  async generateBusinessLicense(businessId: string, ownerId: string, validityDays: number = 365): Promise<LicenseKey> {
    if (!this.masterSecret) throw new Error('Master secret not initialized');

    const now = Date.now();
    const expiresAt = now + validityDays * 24 * 60 * 60 * 1000;
    const keyId = this.generateKeyId();

    const entityId = `${businessId}:${ownerId}`;
    const licenseData = {
      type: 'BUSINESS',
      version: 1,
      entityId,
      issuedAt: now,
      expiresAt,
      keyId,
      purpose: 'business-profile'
    };

    const keyMaterial = this.generateSecureKeyMaterial(entityId, now, keyId);
    const hmac = this.computeHMAC(keyMaterial, this.masterSecret);
    const signature = this.sign(JSON.stringify(licenseData), this.masterSecret);

    return {
      ...licenseData,
      keyMaterial,
      hmac,
      signature
    };
  }

  validateLicense(license: LicenseKey): KeyValidationResult {
    if (!this.masterSecret) {
      return { valid: false, reason: 'Master secret not initialized' };
    }

    try {
      const now = Date.now();

      if (now > license.expiresAt) {
        return { valid: false, reason: 'License expired', expired: true };
      }

      const expectedHmac = this.computeHMAC(license.keyMaterial, this.masterSecret);
      if (expectedHmac !== license.hmac) {
        return { valid: false, reason: 'HMAC verification failed (possible tampering)' };
      }

      const licenseDataForSignature = {
        type: license.type,
        version: license.version,
        entityId: license.entityId,
        issuedAt: license.issuedAt,
        expiresAt: license.expiresAt,
        keyId: license.keyId,
        purpose: license.purpose
      };

      const expectedSignature = this.sign(JSON.stringify(licenseDataForSignature), this.masterSecret);
      if (expectedSignature !== license.signature) {
        return { valid: false, reason: 'Signature verification failed (key tampering detected)' };
      }

      if (license.version !== 1) {
        return { valid: false, reason: 'Unsupported license version' };
      }

      if (license.type !== 'APP' && license.type !== 'BUSINESS') {
        return { valid: false, reason: 'Invalid license type' };
      }

      return { valid: true, key: license };
    } catch (error) {
      return { valid: false, reason: `Validation error: ${String(error)}` };
    }
  }

  private generateKeyId(): string {
    const randomBytes = crypto.randomBytes(16);
    return encodeBase64(randomBytes);
  }

  private generateSecureKeyMaterial(entityId: string, timestamp: number, keyId: string): string {
    if (!this.masterSecret) throw new Error('Master secret not initialized');

    const encoder = new TextEncoder();
    const combined = encoder.encode(`${entityId}:${timestamp}:${keyId}`);
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

  parseLicenseString(licenseStr: string): LicenseKey | null {
    try {
      const parts = licenseStr.split(':');
      if (parts.length < 7) return null;

      return {
        type: parts[0] as 'APP' | 'BUSINESS',
        version: parseInt(parts[1], 10),
        entityId: parts[2],
        issuedAt: parseInt(parts[3], 10),
        expiresAt: parseInt(parts[4], 10),
        keyId: parts[5],
        purpose: parts[6] as 'messenger' | 'business-profile',
        keyMaterial: parts[7],
        hmac: parts[8],
        signature: parts.slice(9).join(':')
      };
    } catch (error) {
      console.error('Failed to parse license string:', error);
      return null;
    }
  }

  licenseTupleString(license: LicenseKey): string {
    return `${license.type}:${license.version}:${license.entityId}:${license.issuedAt}:${license.expiresAt}:${license.keyId}:${license.purpose}:${license.keyMaterial}:${license.hmac}:${license.signature}`;
  }

  getKeyMetadata(license: LicenseKey): Record<string, any> {
    const now = Date.now();
    const timeRemaining = license.expiresAt - now;
    const daysRemaining = Math.floor(timeRemaining / (24 * 60 * 60 * 1000));

    return {
      type: license.type,
      keyId: license.keyId,
      issuedAt: new Date(license.issuedAt).toISOString(),
      expiresAt: new Date(license.expiresAt).toISOString(),
      daysRemaining,
      isExpired: now > license.expiresAt,
      needsRenewal: daysRemaining < 30
    };
  }

  async rotateKey(oldLicense: LicenseKey): Promise<LicenseKey> {
    const keyValidation = this.validateLicense(oldLicense);
    if (!keyValidation.valid) {
      throw new Error('Cannot rotate invalid license');
    }

    if (oldLicense.type === 'APP') {
      return this.generateAppLicense(oldLicense.entityId);
    } else {
      const [businessId, ownerId] = oldLicense.entityId.split(':');
      return this.generateBusinessLicense(businessId, ownerId);
    }
  }
}

export const cryptoLicenseKeyService = new CryptoLicenseKeyService();
