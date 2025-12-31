import { LicenseKey, KeyValidationResult } from './CryptoLicenseKeyService';

export interface ServiceWorkerLicenseState {
  licenseCached: boolean;
  licenseKey: LicenseKey | null;
  lastValidation: number;
  validationStatus: 'valid' | 'expired' | 'invalid' | 'pending';
}

export class ServiceWorkerLicenseValidator {
  private dbName = 'g3tzkp-license-db';
  private storeName = 'license-state';
  private cacheKeyPrefix = 'license-validated-';

  constructor() {}

  async initializeLicenseValidation(): Promise<ServiceWorkerLicenseState> {
    try {
      const state = await this.getLicenseState();
      return state;
    } catch (error) {
      console.error('License validation initialization failed:', error);
      return {
        licenseCached: false,
        licenseKey: null,
        lastValidation: 0,
        validationStatus: 'pending'
      };
    }
  }

  async validateLicenseOnServiceWorkerStart(): Promise<boolean> {
    const state = await this.getLicenseState();

    if (!state.licenseKey) {
      console.warn('⚠️ No license found - blocking service worker');
      return false;
    }

    const now = Date.now();
    if (now > state.licenseKey.expiresAt) {
      console.warn('⚠️ License expired - blocking service worker');
      return false;
    }

    return true;
  }

  async cacheLicense(licenseKey: LicenseKey): Promise<void> {
    const state: ServiceWorkerLicenseState = {
      licenseCached: true,
      licenseKey,
      lastValidation: Date.now(),
      validationStatus: 'valid'
    };

    await this.saveLicenseState(state);
    await this.cacheValidationState(licenseKey);
  }

  async removeLicense(): Promise<void> {
    const state: ServiceWorkerLicenseState = {
      licenseCached: false,
      licenseKey: null,
      lastValidation: 0,
      validationStatus: 'invalid'
    };

    await this.saveLicenseState(state);
  }

  async validateCachedLicense(): Promise<KeyValidationResult> {
    const state = await this.getLicenseState();

    if (!state.licenseKey) {
      return {
        valid: false,
        reason: 'No cached license found'
      };
    }

    const now = Date.now();

    if (now > state.licenseKey.expiresAt) {
      return {
        valid: false,
        reason: 'License expired',
        expired: true
      };
    }

    if (state.validationStatus !== 'valid') {
      return {
        valid: false,
        reason: `License status: ${state.validationStatus}`
      };
    }

    return {
      valid: true,
      key: state.licenseKey
    };
  }

  async preventAddToHomeScreenBypass(request: Request): Promise<boolean> {
    const state = await this.getLicenseState();

    if (!state.licenseKey) {
      console.warn('🚫 ADD-TO-HOME-SCREEN BYPASS ATTEMPT BLOCKED: No license in cache');
      return false;
    }

    if (Date.now() > state.licenseKey.expiresAt) {
      console.warn('🚫 ADD-TO-HOME-SCREEN BYPASS ATTEMPT BLOCKED: License expired');
      return false;
    }

    const cacheKey = `${this.cacheKeyPrefix}${state.licenseKey.keyId}`;
    const cached = await caches.match(cacheKey);

    if (!cached) {
      console.warn('🚫 ADD-TO-HOME-SCREEN BYPASS ATTEMPT BLOCKED: Validation state not cached');
      return false;
    }

    return true;
  }

  async getServiceWorkerLicenseMetadata(): Promise<Record<string, any>> {
    const state = await this.getLicenseState();

    if (!state.licenseKey) {
      return { licensed: false };
    }

    const now = Date.now();
    const remaining = state.licenseKey.expiresAt - now;
    const daysRemaining = Math.floor(remaining / (24 * 60 * 60 * 1000));

    return {
      licensed: true,
      keyId: state.licenseKey.keyId,
      type: state.licenseKey.type,
      issuedAt: new Date(state.licenseKey.issuedAt).toISOString(),
      expiresAt: new Date(state.licenseKey.expiresAt).toISOString(),
      daysRemaining,
      validationStatus: state.validationStatus,
      lastValidation: new Date(state.lastValidation).toISOString()
    };
  }

  private async getLicenseState(): Promise<ServiceWorkerLicenseState> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(this.storeName, 'readonly');
        const store = transaction.objectStore(this.storeName);
        const getRequest = store.get('current-license');

        getRequest.onsuccess = () => {
          resolve(
            getRequest.result || {
              licenseCached: false,
              licenseKey: null,
              lastValidation: 0,
              validationStatus: 'pending'
            }
          );
        };

        getRequest.onerror = () => {
          reject(new Error('Failed to read license state from IndexedDB'));
        };
      };

      request.onerror = () => {
        reject(new Error('Failed to open license database'));
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  private async saveLicenseState(state: ServiceWorkerLicenseState): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(this.storeName, 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const putRequest = store.put(state, 'current-license');

        putRequest.onsuccess = () => {
          resolve();
        };

        putRequest.onerror = () => {
          reject(new Error('Failed to save license state'));
        };
      };

      request.onerror = () => {
        reject(new Error('Failed to open license database'));
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
    });
  }

  private async cacheValidationState(licenseKey: LicenseKey): Promise<void> {
    try {
      const cacheName = 'g3tzkp-license-validation';
      const cache = await caches.open(cacheName);

      const response = new Response(
        JSON.stringify({
          validated: true,
          keyId: licenseKey.keyId,
          timestamp: Date.now(),
          expiresAt: licenseKey.expiresAt
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );

      const cacheKey = `${this.cacheKeyPrefix}${licenseKey.keyId}`;
      await cache.put(cacheKey, response);
    } catch (error) {
      console.error('Failed to cache validation state:', error);
    }
  }

  async handleServiceWorkerMessage(data: any): Promise<void> {
    switch (data.type) {
      case 'CACHE_LICENSE':
        await this.cacheLicense(data.licenseKey);
        break;

      case 'REMOVE_LICENSE':
        await this.removeLicense();
        break;

      case 'GET_LICENSE_STATE':
        const state = await this.getLicenseState();
        return state as any;

      case 'VALIDATE_LICENSE':
        const result = await this.validateCachedLicense();
        return result as any;

      default:
        console.warn('Unknown license service worker message:', data.type);
    }
  }

  async cleanupExpiredLicenses(): Promise<void> {
    const state = await this.getLicenseState();

    if (
      state.licenseKey &&
      Date.now() > state.licenseKey.expiresAt
    ) {
      console.log('🗑️ Removing expired license');
      await this.removeLicense();
    }
  }

  async getServiceWorkerCacheSize(): Promise<number> {
    try {
      const cacheNames = await caches.keys();
      let totalSize = 0;

      for (const name of cacheNames) {
        const cache = await caches.open(name);
        const keys = await cache.keys();

        for (const request of keys) {
          const response = await cache.match(request);
          if (response) {
            const blob = await response.blob();
            totalSize += blob.size;
          }
        }
      }

      return totalSize;
    } catch (error) {
      console.error('Failed to calculate cache size:', error);
      return 0;
    }
  }
}

export const serviceWorkerLicenseValidator = new ServiceWorkerLicenseValidator();
