import { AppManifest, AppFile, ChunkInfo, CachedApp, CachedChunk, CachedState } from '@/types/g3tzkp-web';

const CHUNK_SIZE = 256 * 1024;
const DB_NAME = 'g3tzkp-web-cache';
const DB_VERSION = 1;

class G3TZKPWebCache {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('apps')) {
          db.createObjectStore('apps', { keyPath: 'appId' });
        }

        if (!db.objectStoreNames.contains('chunks')) {
          const chunkStore = db.createObjectStore('chunks', { keyPath: 'hash' });
          chunkStore.createIndex('appId', 'appId', { unique: false });
        }

        if (!db.objectStoreNames.contains('state')) {
          db.createObjectStore('state');
        }
      };
    });

    return this.initPromise;
  }

  async cacheApp(manifest: AppManifest): Promise<void> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const cachedApp: CachedApp = {
      manifest,
      installedAt: Date.now(),
      lastUsed: Date.now(),
      cacheExpiry: Date.now() + manifest.cacheDuration
    };

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['apps'], 'readwrite');
      const store = tx.objectStore('apps');
      const request = store.put({ ...cachedApp, appId: manifest.appId });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getCachedApp(appId: string): Promise<CachedApp | null> {
    await this.initialize();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['apps'], 'readonly');
      const store = tx.objectStore('apps');
      const request = store.get(appId);

      request.onsuccess = () => {
        const cached = request.result as CachedApp | undefined;
        if (cached && cached.cacheExpiry > Date.now()) {
          this.updateLastUsed(appId);
          resolve(cached);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async cacheChunk(hash: string, data: ArrayBuffer, appId: string): Promise<void> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const chunk: CachedChunk & { hash: string } = {
      hash,
      data,
      appId,
      cachedAt: Date.now(),
      accessCount: 0
    };

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['chunks'], 'readwrite');
      const store = tx.objectStore('chunks');
      const request = store.put(chunk);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getCachedChunk(hash: string): Promise<ArrayBuffer | null> {
    await this.initialize();
    if (!this.db) return null;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['chunks'], 'readwrite');
      const store = tx.objectStore('chunks');
      const request = store.get(hash);

      request.onsuccess = () => {
        const chunk = request.result as (CachedChunk & { hash: string }) | undefined;
        if (chunk) {
          chunk.accessCount++;
          store.put(chunk);
          resolve(chunk.data);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async setState(appId: string, key: string, value: any): Promise<void> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const stateKey = `${appId}:${key}`;
    const state: CachedState = {
      data: value,
      updatedAt: Date.now(),
      version: Date.now()
    };

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['state'], 'readwrite');
      const store = tx.objectStore('state');
      const request = store.put(state, stateKey);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getState(appId: string, key: string): Promise<any> {
    await this.initialize();
    if (!this.db) return null;

    const stateKey = `${appId}:${key}`;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['state'], 'readonly');
      const store = tx.objectStore('state');
      const request = store.get(stateKey);

      request.onsuccess = () => {
        const state = request.result as CachedState | undefined;
        resolve(state?.data || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async clearApp(appId: string): Promise<void> {
    await this.initialize();
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['apps', 'chunks', 'state'], 'readwrite');
      
      tx.objectStore('apps').delete(appId);
      
      const chunkStore = tx.objectStore('chunks');
      const chunkIndex = chunkStore.index('appId');
      const chunkRequest = chunkIndex.openCursor(IDBKeyRange.only(appId));
      
      chunkRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getAllApps(): Promise<CachedApp[]> {
    await this.initialize();
    if (!this.db) return [];

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['apps'], 'readonly');
      const store = tx.objectStore('apps');
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result as CachedApp[]);
      request.onerror = () => reject(request.error);
    });
  }

  async getTotalCacheSize(): Promise<number> {
    await this.initialize();
    if (!this.db) return 0;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['chunks'], 'readonly');
      const store = tx.objectStore('chunks');
      const request = store.getAll();

      request.onsuccess = () => {
        const chunks = request.result as CachedChunk[];
        const totalSize = chunks.reduce((sum, chunk) => sum + chunk.data.byteLength, 0);
        resolve(totalSize);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async cleanupExpired(): Promise<number> {
    await this.initialize();
    if (!this.db) return 0;

    const now = Date.now();
    let cleaned = 0;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(['apps', 'chunks'], 'readwrite');
      const appStore = tx.objectStore('apps');
      const appRequest = appStore.openCursor();

      appRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const app = cursor.value as CachedApp;
          if (app.cacheExpiry < now) {
            this.clearApp(app.manifest.appId);
            cleaned++;
          }
          cursor.continue();
        }
      };

      tx.oncomplete = () => resolve(cleaned);
      tx.onerror = () => reject(tx.error);
    });
  }

  splitIntoChunks(data: ArrayBuffer): ChunkInfo[] {
    const chunks: ChunkInfo[] = [];
    const totalSize = data.byteLength;
    let offset = 0;
    let index = 0;

    while (offset < totalSize) {
      const chunkSize = Math.min(CHUNK_SIZE, totalSize - offset);
      const chunkData = data.slice(offset, offset + chunkSize);
      
      chunks.push({
        index,
        hash: this.hashSync(chunkData),
        size: chunkSize
      });

      offset += chunkSize;
      index++;
    }

    return chunks;
  }

  async verifyChunk(data: ArrayBuffer, expectedHash: string): Promise<boolean> {
    const actualHash = await this.hash(data);
    return actualHash === expectedHash;
  }

  async hash(data: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private hashSync(data: ArrayBuffer): string {
    let hash = 0;
    const view = new Uint8Array(data);
    for (let i = 0; i < view.length; i++) {
      hash = ((hash << 5) - hash) + view[i];
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }

  private async updateLastUsed(appId: string): Promise<void> {
    if (!this.db) return;

    const tx = this.db.transaction(['apps'], 'readwrite');
    const store = tx.objectStore('apps');
    const request = store.get(appId);

    request.onsuccess = () => {
      const app = request.result as CachedApp;
      if (app) {
        app.lastUsed = Date.now();
        store.put({ ...app, appId });
      }
    };
  }
}

export const g3tzkpWebCache = new G3TZKPWebCache();
