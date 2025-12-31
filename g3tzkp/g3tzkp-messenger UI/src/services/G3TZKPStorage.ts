import { Message } from '../types';

const DB_NAME = 'G3TZKP_Messenger';
const DB_VERSION = 1;
const MESSAGES_STORE = 'messages';
const PEERS_STORE = 'peers';

interface StoredPeer {
  peerId: string;
  displayName?: string;
  publicKey?: JsonWebKey;
  lastSeen: number;
  addedAt: number;
}

class G3TZKPStorageService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async initialize(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[G3TZKPStorage] Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[G3TZKPStorage] Database opened successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
          const messagesStore = db.createObjectStore(MESSAGES_STORE, { keyPath: 'id' });
          messagesStore.createIndex('peerId', 'peerId', { unique: false });
          messagesStore.createIndex('timestamp', 'timestamp', { unique: false });
          messagesStore.createIndex('peerIdTimestamp', ['peerId', 'timestamp'], { unique: false });
          console.log('[G3TZKPStorage] Messages store created');
        }

        if (!db.objectStoreNames.contains(PEERS_STORE)) {
          const peersStore = db.createObjectStore(PEERS_STORE, { keyPath: 'peerId' });
          peersStore.createIndex('lastSeen', 'lastSeen', { unique: false });
          console.log('[G3TZKPStorage] Peers store created');
        }
      };
    });

    return this.initPromise;
  }

  async saveMessage(peerId: string, message: Message): Promise<void> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([MESSAGES_STORE], 'readwrite');
      const store = transaction.objectStore(MESSAGES_STORE);

      const messageWithPeer = { ...message, peerId };
      const request = store.put(messageWithPeer);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveMessages(peerId: string, messages: Message[]): Promise<void> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([MESSAGES_STORE], 'readwrite');
      const store = transaction.objectStore(MESSAGES_STORE);

      for (const message of messages) {
        const messageWithPeer = { ...message, peerId };
        store.put(messageWithPeer);
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getMessages(peerId: string): Promise<Message[]> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([MESSAGES_STORE], 'readonly');
      const store = transaction.objectStore(MESSAGES_STORE);
      const index = store.index('peerId');
      const request = index.getAll(peerId);

      request.onsuccess = () => {
        const messages = request.result.sort((a, b) => a.timestamp - b.timestamp);
        resolve(messages);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getAllMessages(): Promise<Map<string, Message[]>> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([MESSAGES_STORE], 'readonly');
      const store = transaction.objectStore(MESSAGES_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        const messages = request.result;
        const messageMap = new Map<string, Message[]>();

        for (const msg of messages) {
          const peerId = msg.peerId;
          if (!messageMap.has(peerId)) {
            messageMap.set(peerId, []);
          }
          messageMap.get(peerId)!.push(msg);
        }

        for (const [peerId, msgs] of messageMap.entries()) {
          messageMap.set(peerId, msgs.sort((a, b) => a.timestamp - b.timestamp));
        }

        resolve(messageMap);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async updateMessage(messageId: string, updates: Partial<Message>): Promise<void> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([MESSAGES_STORE], 'readwrite');
      const store = transaction.objectStore(MESSAGES_STORE);
      const getRequest = store.get(messageId);

      getRequest.onsuccess = () => {
        if (getRequest.result) {
          const updated = { ...getRequest.result, ...updates };
          const putRequest = store.put(updated);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        } else {
          resolve();
        }
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  async deleteMessage(messageId: string): Promise<void> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([MESSAGES_STORE], 'readwrite');
      const store = transaction.objectStore(MESSAGES_STORE);
      const request = store.delete(messageId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async savePeer(peer: StoredPeer): Promise<void> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PEERS_STORE], 'readwrite');
      const store = transaction.objectStore(PEERS_STORE);
      const request = store.put(peer);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getPeer(peerId: string): Promise<StoredPeer | null> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PEERS_STORE], 'readonly');
      const store = transaction.objectStore(PEERS_STORE);
      const request = store.get(peerId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllPeers(): Promise<StoredPeer[]> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PEERS_STORE], 'readonly');
      const store = transaction.objectStore(PEERS_STORE);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deletePeer(peerId: string): Promise<void> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([PEERS_STORE], 'readwrite');
      const store = transaction.objectStore(PEERS_STORE);
      const request = store.delete(peerId);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearAllData(): Promise<void> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([MESSAGES_STORE, PEERS_STORE], 'readwrite');
      transaction.objectStore(MESSAGES_STORE).clear();
      transaction.objectStore(PEERS_STORE).clear();

      transaction.oncomplete = () => {
        console.log('[G3TZKPStorage] All data cleared');
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  }
}

export const g3tzkpStorage = new G3TZKPStorageService();
