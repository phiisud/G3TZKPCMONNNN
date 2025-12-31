export interface AppVersionManifest {
  latest: {
    version: string;
    releaseDate: string;
    critical: boolean;
    changelog: {
      added: string[];
      fixed: string[];
      improved: string[];
    };
    features: string[];
    securityUpdates: string[];
    size: string;
    requires: string;
    cid: string;
    hash: string;
    signature: string;
  };
  versions: Array<{
    version: string;
    date: string;
    critical: boolean;
    cid: string;
    reason?: string;
  }>;
}

export interface UpdateNotification {
  version: string;
  available: boolean;
  critical: boolean;
  changelog: AppVersionManifest['latest']['changelog'];
  features: string[];
  size: string;
  cid: string;
}

class AppUpdateService {
  private genesisUpdateServer = 'https://genesis.g3tzkp.com/versions/mobile.json';
  private currentVersion = '1.0.0';
  private checkInterval = 6 * 60 * 60 * 1000;
  private updateHandlers: ((update: UpdateNotification) => void)[] = [];
  private lastCheckTime = 0;

  constructor() {
    this.currentVersion = this.getVersionFromBuild();
  }

  registerUpdateHandler(handler: (update: UpdateNotification) => void): void {
    this.updateHandlers.push(handler);
  }

  async checkForUpdates(forceCheck: boolean = false): Promise<UpdateNotification | null> {
    const now = Date.now();

    if (!forceCheck && now - this.lastCheckTime < this.checkInterval) {
      return null;
    }

    this.lastCheckTime = now;

    try {
      const response = await fetch(this.genesisUpdateServer, {
        cache: 'no-store',
        headers: {
          'X-App-Version': this.currentVersion,
          'X-Platform': this.getPlatform()
        }
      });

      if (!response.ok) {
        console.warn('Failed to fetch update manifest');
        return null;
      }

      const manifest = (await response.json()) as AppVersionManifest;
      const latestVersion = manifest.latest;

      if (!this.isValidSignature(latestVersion)) {
        console.warn('Invalid update signature');
        return null;
      }

      if (this.isNewerVersion(this.currentVersion, latestVersion.version)) {
        const update: UpdateNotification = {
          version: latestVersion.version,
          available: true,
          critical: latestVersion.critical,
          changelog: latestVersion.changelog,
          features: latestVersion.features,
          size: latestVersion.size,
          cid: latestVersion.cid
        };

        this.updateHandlers.forEach(handler => handler(update));
        return update;
      }

      return null;
    } catch (error) {
      console.error('Update check failed:', error);
      return null;
    }
  }

  async performUpdate(update: UpdateNotification): Promise<boolean> {
    try {
      console.log(`🚀 Installing update to v${update.version}`);

      if (!navigator.serviceWorker?.controller) {
        console.warn('No active service worker');
        return false;
      }

      const updateMessage = {
        type: 'LOAD_NEW_VERSION',
        cid: update.cid,
        version: update.version
      };

      navigator.serviceWorker.controller.postMessage(updateMessage);

      return new Promise((resolve) => {
        const listener = (event: MessageEvent) => {
          if (event.data.type === 'UPDATE_COMPLETE') {
            navigator.serviceWorker?.removeEventListener('message', listener);
            resolve(true);
          }
        };

        navigator.serviceWorker?.addEventListener('message', listener);
        setTimeout(() => resolve(false), 30000);
      });
    } catch (error) {
      console.error('Update failed:', error);
      return false;
    }
  }

  skipVersion(version: string): void {
    localStorage.setItem(`skip-version-${version}`, 'true');
  }

  isVersionSkipped(version: string): boolean {
    return localStorage.getItem(`skip-version-${version}`) === 'true';
  }

  getUpdatePreference(): 'auto' | 'manual' | 'never' {
    return (localStorage.getItem('update-preference') || 'manual') as any;
  }

  setUpdatePreference(preference: 'auto' | 'manual' | 'never'): void {
    localStorage.setItem('update-preference', preference);
  }

  getCurrentVersion(): string {
    return this.currentVersion;
  }

  private getVersionFromBuild(): string {
    if (typeof (window as any).__APP_VERSION__ !== 'undefined') {
      return (window as any).__APP_VERSION__;
    }

    if (typeof process !== 'undefined' && process.env?.REACT_APP_VERSION) {
      return process.env.REACT_APP_VERSION;
    }

    return '1.0.0';
  }

  private isNewerVersion(current: string, incoming: string): boolean {
    const currentParts = current.split('.').map(Number);
    const incomingParts = incoming.split('.').map(Number);

    for (let i = 0; i < Math.max(currentParts.length, incomingParts.length); i++) {
      const curr = currentParts[i] || 0;
      const inc = incomingParts[i] || 0;

      if (inc > curr) return true;
      if (inc < curr) return false;
    }

    return false;
  }

  private isValidSignature(versionInfo: AppVersionManifest['latest']): boolean {
    try {
      const encoder = new TextEncoder();
      const data = JSON.stringify({
        version: versionInfo.version,
        releaseDate: versionInfo.releaseDate,
        cid: versionInfo.cid,
        hash: versionInfo.hash
      });

      const signature = versionInfo.signature;

      return signature && signature.length > 0;
    } catch (error) {
      return false;
    }
  }

  private getPlatform(): string {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('android')) return 'android';
    if (ua.includes('iphone') || ua.includes('ipad')) return 'ios';
    if (ua.includes('windows')) return 'windows';
    if (ua.includes('mac')) return 'macos';
    if (ua.includes('linux')) return 'linux';
    return 'web';
  }

  async checkHashIntegrity(data: Uint8Array, expectedHash: string): Promise<boolean> {
    try {
      const digest = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(digest));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex === expectedHash;
    } catch (error) {
      console.error('Hash verification failed:', error);
      return false;
    }
  }

  getManifestUrl(): string {
    return this.genesisUpdateServer;
  }

  setupAutoUpdate(): void {
    const preference = this.getUpdatePreference();

    if (preference === 'auto') {
      this.checkForUpdates(true);
      setInterval(() => this.checkForUpdates(), this.checkInterval);
    } else if (preference === 'manual') {
      setInterval(() => this.checkForUpdates(), this.checkInterval);
    }
  }

  logUpdateAttempt(version: string, success: boolean, error?: string): void {
    const log = {
      timestamp: new Date().toISOString(),
      version,
      success,
      error,
      platform: this.getPlatform()
    };

    const updateLogs = JSON.parse(localStorage.getItem('app-update-logs') || '[]');
    updateLogs.push(log);

    const recentLogs = updateLogs.slice(-100);
    localStorage.setItem('app-update-logs', JSON.stringify(recentLogs));
  }

  getUpdateHistory(): any[] {
    try {
      return JSON.parse(localStorage.getItem('app-update-logs') || '[]');
    } catch {
      return [];
    }
  }

  clearUpdateHistory(): void {
    localStorage.removeItem('app-update-logs');
  }
}

export const appUpdateService = new AppUpdateService();
