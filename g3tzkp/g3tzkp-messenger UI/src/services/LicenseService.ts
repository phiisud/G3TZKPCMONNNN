import { DeviceFingerprintService, SignedLicense } from './DeviceFingerprintService';
import { CryptoService } from './CryptoService';

export interface LicenseStatus {
  isValid: boolean;
  licenseType: 'trial' | 'lifetime' | null;
  expiresAt: number | null;
  remainingDays: number;
  features: string[];
  deviceId: string;
}

export class LicenseService {
  private deviceService: DeviceFingerprintService;
  private crypto: CryptoService;
  private readonly STORAGE_KEY = 'g3zkp_license';

  constructor(deviceService: DeviceFingerprintService, cryptoService: CryptoService) {
    this.deviceService = deviceService;
    this.crypto = cryptoService;
  }

  async getLicenseStatus(): Promise<LicenseStatus> {
    const license = await this.getStoredLicense();

    if (!license) {
      // No license - start trial
      return await this.startTrial();
    }

    const isValid = await this.deviceService.verifyLicense(license);

    if (!isValid) {
      // License invalid - clear it
      await this.clearLicense();
      return {
        isValid: false,
        licenseType: null,
        expiresAt: null,
        remainingDays: 0,
        features: [],
        deviceId: await this.deviceService.getDeviceId(),
      };
    }

    return {
      isValid: true,
      licenseType: license.payload.licenseType,
      expiresAt: license.payload.expiresAt,
      remainingDays: this.deviceService.getRemainingTrialDays(license),
      features: license.payload.features,
      deviceId: license.payload.deviceId,
    };
  }

  async startTrial(): Promise<LicenseStatus> {
    const deviceId = await this.deviceService.getDeviceId();
    const license = await this.deviceService.createLicense('trial', deviceId);

    await this.storeLicense(license);

    return {
      isValid: true,
      licenseType: 'trial',
      expiresAt: license.payload.expiresAt,
      remainingDays: 7,
      features: license.payload.features,
      deviceId,
    };
  }

  async activateLifetimeLicense(paymentSessionId: string): Promise<LicenseStatus> {
    // Verify payment with backend
    const response = await fetch('/api/licenses/activate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId: paymentSessionId }),
    });

    if (!response.ok) {
      throw new Error('Failed to activate license');
    }

    const { license: licenseData } = await response.json();
    const license: SignedLicense = JSON.parse(licenseData);

    // Verify the license
    const isValid = await this.deviceService.verifyLicense(license);
    if (!isValid) {
      throw new Error('Invalid license received from server');
    }

    await this.storeLicense(license);

    return {
      isValid: true,
      licenseType: 'lifetime',
      expiresAt: null,
      remainingDays: 0,
      features: license.payload.features,
      deviceId: license.payload.deviceId,
    };
  }

  async exportLicense(): Promise<string> {
    const license = await this.getStoredLicense();
    if (!license) {
      throw new Error('No license found to export');
    }
    return await this.deviceService.exportLicense(license);
  }

  async importLicense(licenseData: string): Promise<LicenseStatus> {
    const license = await this.deviceService.importLicense(licenseData);

    // Verify the imported license
    const isValid = await this.deviceService.verifyLicense(license);
    if (!isValid) {
      throw new Error('Invalid or incompatible license');
    }

    // Check if device already has a license
    const existingLicense = await this.getStoredLicense();
    if (existingLicense) {
      throw new Error('Device already has an active license. Clear existing license first.');
    }

    await this.storeLicense(license);

    return {
      isValid: true,
      licenseType: license.payload.licenseType,
      expiresAt: license.payload.expiresAt,
      remainingDays: this.deviceService.getRemainingTrialDays(license),
      features: license.payload.features,
      deviceId: license.payload.deviceId,
    };
  }

  async clearLicense(): Promise<void> {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  private async getStoredLicense(): Promise<SignedLicense | null> {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (!stored) return null;

    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }

  private async storeLicense(license: SignedLicense): Promise<void> {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(license));
  }

  async hasFullAccess(): Promise<boolean> {
    const status = await this.getLicenseStatus();
    return status.isValid && (status.licenseType === 'lifetime' || status.remainingDays > 0);
  }

  async canUseFeature(feature: string): Promise<boolean> {
    const status = await this.getLicenseStatus();
    return status.isValid && status.features.includes(feature);
  }
}