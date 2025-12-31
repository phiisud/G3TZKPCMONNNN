import { CryptoService } from './CryptoService';

export interface DeviceFingerprint {
  userAgent: string;
  language: string;
  platform: string;
  screenResolution: string;
  timezone: string;
  hardwareConcurrency: number;
  deviceMemory: number;
  cookieEnabled: boolean;
  doNotTrack: string | null;
}

export interface SignedLicense {
  payload: {
    deviceId: string;
    deviceCommitment: string;
    nonce: string;
    licenseType: 'trial' | 'lifetime';
    issuedAt: number;
    expiresAt: number | null;
    features: string[];
  };
  signature: string;
}

export class DeviceFingerprintService {
  private crypto: CryptoService;

  constructor(cryptoService: CryptoService) {
    this.crypto = cryptoService;
  }

  async generateFingerprint(): Promise<DeviceFingerprint> {
    const screen = window.screen;
    const navigator = window.navigator;

    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenResolution: `${screen.width}x${screen.height}x${screen.pixelDepth}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      hardwareConcurrency: navigator.hardwareConcurrency || 0,
      deviceMemory: (navigator as any).deviceMemory || 0,
      cookieEnabled: navigator.cookieEnabled,
      doNotTrack: navigator.doNotTrack,
    };
  }

  async getDeviceId(): Promise<string> {
    const fingerprint = await this.generateFingerprint();

    // Create stable device ID from core hardware characteristics
    const stableData = {
      platform: fingerprint.platform,
      timezone: fingerprint.timezone,
      hardwareConcurrency: fingerprint.hardwareConcurrency,
      screenResolution: fingerprint.screenResolution,
    };

    const dataString = JSON.stringify(stableData);
    return await this.crypto.hash(dataString);
  }

  async generateDeviceCommitment(deviceId: string): Promise<{ commitment: string; nonce: string }> {
    const nonce = await this.crypto.generateNonce();
    const commitment = await this.crypto.hash(deviceId + nonce);
    return { commitment, nonce };
  }

  async verifyDeviceCommitment(
    fingerprint: DeviceFingerprint,
    nonce: string,
    commitment: string
  ): Promise<boolean> {
    const currentDeviceId = await this.getDeviceId();
    const expectedCommitment = await this.crypto.hash(currentDeviceId + nonce);
    return expectedCommitment === commitment;
  }

  async createLicense(
    licenseType: 'trial' | 'lifetime',
    deviceId: string
  ): Promise<SignedLicense> {
    const { commitment, nonce } = await this.generateDeviceCommitment(deviceId);

    const payload = {
      deviceId,
      deviceCommitment: commitment,
      nonce,
      licenseType,
      issuedAt: Date.now(),
      expiresAt: licenseType === 'trial' ? Date.now() + (7 * 24 * 60 * 60 * 1000) : null,
      features: ['messaging', 'zkp', 'anti-trafficking', 'p2p'],
    };

    const payloadString = JSON.stringify(payload);
    const signature = await this.crypto.sign(payloadString);

    return {
      payload,
      signature,
    };
  }

  async verifyLicense(license: SignedLicense): Promise<boolean> {
    try {
      const payloadString = JSON.stringify(license.payload);
      const isValidSignature = await this.crypto.verify(
        payloadString,
        license.signature
      );

      if (!isValidSignature) return false;

      // Check expiration
      if (license.payload.expiresAt && Date.now() > license.payload.expiresAt) {
        return false;
      }

      // Verify device commitment
      const fingerprint = await this.generateFingerprint();
      return await this.verifyDeviceCommitment(
        fingerprint,
        license.payload.nonce,
        license.payload.deviceCommitment
      );
    } catch (error) {
      console.error('License verification failed:', error);
      return false;
    }
  }

  async exportLicense(license: SignedLicense): Promise<string> {
    return btoa(JSON.stringify(license));
  }

  async importLicense(licenseData: string): Promise<SignedLicense> {
    return JSON.parse(atob(licenseData));
  }

  isExpired(license: SignedLicense): boolean {
    return license.payload.expiresAt ? Date.now() > license.payload.expiresAt : false;
  }

  getRemainingTrialDays(license: SignedLicense): number {
    if (license.payload.licenseType !== 'trial' || !license.payload.expiresAt) {
      return 0;
    }
    const remaining = license.payload.expiresAt - Date.now();
    return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
  }
}