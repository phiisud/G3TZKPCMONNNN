import { v4 as uuidv4 } from 'uuid';
import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';

export interface G3ZKPLicense {
  id: string;
  purchaserId: string;
  purchaseDate: number;
  expiryDate: number;
  licenseKey: string;
  signature: string;
  deviceLimit: number;
  features: string[];
}

export interface DeviceLink {
  licenseId: string;
  primaryPeerId: string;
  devicePublicKey: string;
  authorizationToken: string;
  expiryTimestamp: number;
}

export interface SyncMessage {
  type: 'sync_request' | 'sync_response' | 'sync_complete';
  deviceId: string;
  licenseId: string;
  lastSyncTimestamp: number;
  messageRange: {
    from: number;
    to: number;
  };
  encryptedMessages: any[];
  proof: any;
}

export interface DeviceState {
  licenseStatus: any;
  lastSyncTimestamp: number;
  deviceCapabilities: string[];
  encryptionKeys: {
    current: Uint8Array;
    previous: Uint8Array[];
  };
  messageWatermark: number;
}

export class DeviceSyncService {
  private deviceId: string;
  private masterKey: Uint8Array;
  private license: G3ZKPLicense | null = null;
  private connectedDevices: Map<string, DeviceState> = new Map();
  private syncInterval: NodeJS.Timeout | null = null;
  private readonly SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.deviceId = uuidv4();
    this.masterKey = nacl.randomBytes(32);
    this.initializeLicense();
    this.startPeriodicSync();
  }

  private async initializeLicense(): Promise<void> {
    // Load license from localStorage or generate demo license
    const storedLicense = localStorage.getItem('g3zkp_license');
    if (storedLicense) {
      this.license = JSON.parse(storedLicense);
    } else {
      // Generate demo license for development
      this.license = {
        id: uuidv4(),
        purchaserId: 'demo_user',
        purchaseDate: Date.now(),
        expiryDate: Date.now() + (10 * 365 * 24 * 60 * 60 * 1000), // 10 years
        licenseKey: encodeBase64(nacl.randomBytes(32)),
        signature: encodeBase64(nacl.randomBytes(64)),
        deviceLimit: -1, // Unlimited
        features: ['messaging', 'navigation', 'sync', 'zkp']
      };
      localStorage.setItem('g3zkp_license', JSON.stringify(this.license));
    }
  }

  async generateDeviceLink(): Promise<string> {
    if (!this.license) throw new Error('License not initialized');

    const deviceKeyPair = nacl.sign.keyPair();
    const authorizationToken = encodeBase64(nacl.randomBytes(32));

    const deviceLink: DeviceLink = {
      licenseId: this.license.id,
      primaryPeerId: this.deviceId,
      devicePublicKey: encodeBase64(deviceKeyPair.publicKey),
      authorizationToken,
      expiryTimestamp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };

    // Store device link temporarily
    localStorage.setItem('pending_device_link', JSON.stringify({
      link: deviceLink,
      privateKey: encodeBase64(deviceKeyPair.secretKey)
    }));

    // Return QR code data
    return JSON.stringify(deviceLink);
  }

  async authorizeDevice(qrCodeData: string): Promise<{ granted: boolean; reason?: string }> {
    try {
      const deviceLink: DeviceLink = JSON.parse(qrCodeData);

      // Verify license matches
      if (!this.license || deviceLink.licenseId !== this.license.id) {
        return { granted: false, reason: 'Invalid license' };
      }

      // Check expiry
      if (deviceLink.expiryTimestamp < Date.now()) {
        return { granted: false, reason: 'Link expired' };
      }

      // Verify signature (simplified for demo)
      const deviceState: DeviceState = {
        licenseStatus: this.license,
        lastSyncTimestamp: 0,
        deviceCapabilities: ['messaging', 'navigation'],
        encryptionKeys: {
          current: nacl.randomBytes(32),
          previous: []
        },
        messageWatermark: 0
      };

      this.connectedDevices.set(deviceLink.primaryPeerId, deviceState);

      // Notify server of new device
      await this.registerDeviceWithServer(deviceLink);

      return { granted: true };
    } catch (error) {
      return { granted: false, reason: 'Invalid QR code' };
    }
  }

  private async registerDeviceWithServer(deviceLink: DeviceLink): Promise<void> {
    // Register device with backend
    const response = await fetch('/api/devices/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: deviceLink.primaryPeerId,
        licenseId: deviceLink.licenseId,
        publicKey: deviceLink.devicePublicKey,
        authorizationToken: deviceLink.authorizationToken
      })
    });

    if (!response.ok) {
      throw new Error('Device registration failed');
    }
  }

  async syncMessages(deviceId: string): Promise<any[]> {
    const deviceState = this.connectedDevices.get(deviceId);
    if (!deviceState) throw new Error('Device not authorized');

    const syncRequest: SyncMessage = {
      type: 'sync_request',
      deviceId: this.deviceId,
      licenseId: this.license!.id,
      lastSyncTimestamp: deviceState.lastSyncTimestamp,
      messageRange: {
        from: deviceState.messageWatermark,
        to: Date.now()
      },
      encryptedMessages: [],
      proof: {} // ZKP proof would go here
    };

    const response = await fetch('/api/messages/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(syncRequest)
    });

    if (!response.ok) throw new Error('Sync failed');

    const syncResponse: SyncMessage = await response.json();

    // Update device state
    deviceState.lastSyncTimestamp = Date.now();
    deviceState.messageWatermark = syncResponse.messageRange.to;

    return syncResponse.encryptedMessages;
  }

  private startPeriodicSync(): void {
    this.syncInterval = setInterval(async () => {
      for (const [deviceId] of this.connectedDevices) {
        try {
          await this.syncMessages(deviceId);
        } catch (error) {
          console.warn(`Failed to sync with device ${deviceId}:`, error);
        }
      }
    }, this.SYNC_INTERVAL_MS);
  }

  getConnectedDevices(): string[] {
    return Array.from(this.connectedDevices.keys());
  }

  getLicenseStatus(): G3ZKPLicense | null {
    return this.license;
  }

  async revokeDevice(deviceId: string): Promise<void> {
    this.connectedDevices.delete(deviceId);

    await fetch('/api/devices/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId })
    });
  }

  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
  }
}

export const deviceSyncService = new DeviceSyncService();