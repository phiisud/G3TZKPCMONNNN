/**
 * G3ZKP Production IndexedDB Storage Service
 * Persistent storage for messages, contacts, keys, and application state
 * With encryption for sensitive data using Web Crypto API
 * CryptoKey is stored non-extractable in IndexedDB for security
 */

const DB_NAME = 'g3zkp-messenger';
const DB_VERSION = 3;
const KEY_DB_NAME = 'g3zkp-keystore';
const KEY_DB_VERSION = 1;

interface StoredMessage {
  id: string;
  conversationId: string;
  senderId: string;
  recipientId: string;
  content: string;
  encryptedContent?: string;
  timestamp: number;
  status: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  type: 'text' | 'media' | 'system' | 'tensor';
  metadata?: Record<string, unknown>;
  zkpProofId?: string;
}

interface StoredContact {
  id: string;
  peerId: string;
  displayName: string;
  publicKey: string;
  identityKey?: string;
  addedAt: number;
  lastSeen?: number;
  metadata?: Record<string, unknown>;
  verified: boolean;
  blocked: boolean;
}

interface StoredSession {
  id: string;
  peerId: string;
  encryptedData: string;
  iv: string;
  createdAt: number;
  updatedAt: number;
}

interface StoredKeyPair {
  id: string;
  type: 'identity' | 'signed-prekey' | 'one-time-prekey' | 'ephemeral';
  encryptedData: string;
  iv: string;
  createdAt: number;
  expiresAt?: number;
}

interface AppSettings {
  key: string;
  value: unknown;
  updatedAt: number;
}

interface EncryptedPayload {
  ciphertext: string;
  iv: string;
}

class StorageService {
  private db: IDBDatabase | null = null;
  private keyDb: IDBDatabase | null = null;
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;
  private encryptionKey: CryptoKey | null = null;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.doInitialize();
    return this.initPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      await this.initializeKeyStore();
      await this.initializeEncryptionKey();
      await this.openDatabase();
      this.initialized = true;
      console.log('[StorageService] Database initialized with secure key storage');
    } catch (error) {
      console.error('[StorageService] Initialization failed:', error);
      throw error;
    }
  }

  private async initializeKeyStore(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(KEY_DB_NAME, KEY_DB_VERSION);

      request.onerror = () => {
        console.error('[StorageService] Failed to open key store:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.keyDb = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('cryptokeys')) {
          db.createObjectStore('cryptokeys', { keyPath: 'id' });
        }
      };
    });
  }

  private async initializeEncryptionKey(): Promise<void> {
    if (!this.keyDb) {
      throw new Error('Key store not initialized');
    }

    const storedKey = await this.getStoredCryptoKey();
    
    if (storedKey) {
      this.encryptionKey = storedKey;
      return;
    }

    this.encryptionKey = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    await this.storeCryptoKey(this.encryptionKey);
  }

  private async getStoredCryptoKey(): Promise<CryptoKey | null> {
    if (!this.keyDb) return null;

    return new Promise((resolve, reject) => {
      const transaction = this.keyDb!.transaction('cryptokeys', 'readonly');
      const store = transaction.objectStore('cryptokeys');
      const request = store.get('master-key');

      request.onsuccess = () => {
        if (request.result && request.result.key) {
          resolve(request.result.key);
        } else {
          resolve(null);
        }
      };

      request.onerror = () => {
        console.error('[StorageService] Failed to get crypto key:', request.error);
        reject(request.error);
      };
    });
  }

  private async storeCryptoKey(key: CryptoKey): Promise<void> {
    if (!this.keyDb) {
      throw new Error('Key store not initialized');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.keyDb!.transaction('cryptokeys', 'readwrite');
      const store = transaction.objectStore('cryptokeys');
      const request = store.put({
        id: 'master-key',
        key: key,
        created: Date.now()
      });

      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('[StorageService] Failed to store crypto key:', request.error);
        reject(request.error);
      };
    });
  }

  private async openDatabase(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[StorageService] Failed to open database:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        
        this.db.onerror = (event) => {
          console.error('[StorageService] Database error:', event);
        };
        
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.createObjectStores(db);
      };
    });
  }

  private createObjectStores(db: IDBDatabase): void {
    if (!db.objectStoreNames.contains('messages')) {
      const messagesStore = db.createObjectStore('messages', { keyPath: 'id' });
      messagesStore.createIndex('conversationId', 'conversationId', { unique: false });
      messagesStore.createIndex('timestamp', 'timestamp', { unique: false });
      messagesStore.createIndex('senderId', 'senderId', { unique: false });
      messagesStore.createIndex('recipientId', 'recipientId', { unique: false });
      messagesStore.createIndex('status', 'status', { unique: false });
    }

    if (!db.objectStoreNames.contains('contacts')) {
      const contactsStore = db.createObjectStore('contacts', { keyPath: 'id' });
      contactsStore.createIndex('peerId', 'peerId', { unique: true });
      contactsStore.createIndex('displayName', 'displayName', { unique: false });
      contactsStore.createIndex('addedAt', 'addedAt', { unique: false });
    }

    if (!db.objectStoreNames.contains('sessions')) {
      const sessionsStore = db.createObjectStore('sessions', { keyPath: 'id' });
      sessionsStore.createIndex('peerId', 'peerId', { unique: true });
      sessionsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
    }

    if (!db.objectStoreNames.contains('keys')) {
      const keysStore = db.createObjectStore('keys', { keyPath: 'id' });
      keysStore.createIndex('type', 'type', { unique: false });
      keysStore.createIndex('createdAt', 'createdAt', { unique: false });
    }

    if (!db.objectStoreNames.contains('settings')) {
      db.createObjectStore('settings', { keyPath: 'key' });
    }

    if (!db.objectStoreNames.contains('media')) {
      const mediaStore = db.createObjectStore('media', { keyPath: 'id' });
      mediaStore.createIndex('messageId', 'messageId', { unique: false });
      mediaStore.createIndex('type', 'type', { unique: false });
    }
  }

  private async encrypt(data: string): Promise<EncryptedPayload> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedData = new TextEncoder().encode(data);
    
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.encryptionKey,
      encodedData
    );

    return {
      ciphertext: btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
      iv: btoa(String.fromCharCode(...iv))
    };
  }

  private async decrypt(payload: EncryptedPayload): Promise<string> {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    const ciphertext = Uint8Array.from(atob(payload.ciphertext), c => c.charCodeAt(0));
    const iv = Uint8Array.from(atob(payload.iv), c => c.charCodeAt(0));

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      this.encryptionKey,
      ciphertext
    );

    return new TextDecoder().decode(decrypted);
  }

  private async getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    if (!this.initialized || !this.db) {
      await this.initialize();
    }
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    const transaction = this.db.transaction(storeName, mode);
    
    transaction.onerror = (event) => {
      console.error(`[StorageService] Transaction error on ${storeName}:`, event);
    };
    
    transaction.onabort = (event) => {
      console.error(`[StorageService] Transaction aborted on ${storeName}:`, event);
    };
    
    return transaction.objectStore(storeName);
  }

  async saveMessage(message: StoredMessage): Promise<void> {
    const store = await this.getStore('messages', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(message);
      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('[StorageService] Failed to save message:', request.error);
        reject(request.error);
      };
    });
  }

  async getMessage(id: string): Promise<StoredMessage | null> {
    const store = await this.getStore('messages');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => {
        console.error('[StorageService] Failed to get message:', request.error);
        reject(request.error);
      };
    });
  }

  async getMessagesByConversation(conversationId: string, limit = 100): Promise<StoredMessage[]> {
    const store = await this.getStore('messages');
    const index = store.index('conversationId');
    return new Promise((resolve, reject) => {
      const messages: StoredMessage[] = [];
      const request = index.openCursor(IDBKeyRange.only(conversationId), 'prev');
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor && messages.length < limit) {
          messages.push(cursor.value);
          cursor.continue();
        } else {
          resolve(messages.reverse());
        }
      };
      request.onerror = () => {
        console.error('[StorageService] Failed to get messages:', request.error);
        reject(request.error);
      };
    });
  }

  async deleteMessage(id: string): Promise<void> {
    const store = await this.getStore('messages', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('[StorageService] Failed to delete message:', request.error);
        reject(request.error);
      };
    });
  }

  async updateMessageStatus(id: string, status: StoredMessage['status']): Promise<void> {
    const message = await this.getMessage(id);
    if (message) {
      message.status = status;
      await this.saveMessage(message);
    }
  }

  async saveContact(contact: StoredContact): Promise<void> {
    const store = await this.getStore('contacts', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(contact);
      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('[StorageService] Failed to save contact:', request.error);
        reject(request.error);
      };
    });
  }

  async getContact(id: string): Promise<StoredContact | null> {
    const store = await this.getStore('contacts');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => {
        console.error('[StorageService] Failed to get contact:', request.error);
        reject(request.error);
      };
    });
  }

  async getContactByPeerId(peerId: string): Promise<StoredContact | null> {
    const store = await this.getStore('contacts');
    const index = store.index('peerId');
    return new Promise((resolve, reject) => {
      const request = index.get(peerId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => {
        console.error('[StorageService] Failed to get contact:', request.error);
        reject(request.error);
      };
    });
  }

  async getAllContacts(): Promise<StoredContact[]> {
    const store = await this.getStore('contacts');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.error('[StorageService] Failed to get contacts:', request.error);
        reject(request.error);
      };
    });
  }

  async deleteContact(id: string): Promise<void> {
    const store = await this.getStore('contacts', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('[StorageService] Failed to delete contact:', request.error);
        reject(request.error);
      };
    });
  }

  async saveSession(peerId: string, sessionData: Record<string, unknown>): Promise<void> {
    const dataString = JSON.stringify(sessionData);
    const encrypted = await this.encrypt(dataString);
    
    const session: StoredSession = {
      id: `session_${peerId}`,
      peerId,
      encryptedData: encrypted.ciphertext,
      iv: encrypted.iv,
      createdAt: sessionData.createdAt as number || Date.now(),
      updatedAt: Date.now()
    };
    
    const store = await this.getStore('sessions', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(session);
      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('[StorageService] Failed to save session:', request.error);
        reject(request.error);
      };
    });
  }

  async getSession(peerId: string): Promise<Record<string, unknown> | null> {
    const store = await this.getStore('sessions');
    const index = store.index('peerId');
    
    return new Promise((resolve, reject) => {
      const request = index.get(peerId);
      request.onsuccess = async () => {
        const result = request.result as StoredSession | undefined;
        if (!result) {
          resolve(null);
          return;
        }
        
        try {
          const decrypted = await this.decrypt({
            ciphertext: result.encryptedData,
            iv: result.iv
          });
          resolve(JSON.parse(decrypted));
        } catch (error) {
          console.error('[StorageService] Failed to decrypt session:', error);
          reject(error);
        }
      };
      request.onerror = () => {
        console.error('[StorageService] Failed to get session:', request.error);
        reject(request.error);
      };
    });
  }

  async deleteSession(peerId: string): Promise<void> {
    const store = await this.getStore('sessions', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(`session_${peerId}`);
      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('[StorageService] Failed to delete session:', request.error);
        reject(request.error);
      };
    });
  }

  async saveKeyPair(
    id: string,
    type: StoredKeyPair['type'],
    keyData: { publicKey: string; privateKey: string },
    expiresAt?: number
  ): Promise<void> {
    const dataString = JSON.stringify(keyData);
    const encrypted = await this.encrypt(dataString);
    
    const keyPair: StoredKeyPair = {
      id,
      type,
      encryptedData: encrypted.ciphertext,
      iv: encrypted.iv,
      createdAt: Date.now(),
      expiresAt
    };
    
    const store = await this.getStore('keys', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.put(keyPair);
      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('[StorageService] Failed to save key:', request.error);
        reject(request.error);
      };
    });
  }

  async getKeyPair(id: string): Promise<{ publicKey: string; privateKey: string } | null> {
    const store = await this.getStore('keys');
    
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = async () => {
        const result = request.result as StoredKeyPair | undefined;
        if (!result) {
          resolve(null);
          return;
        }
        
        try {
          const decrypted = await this.decrypt({
            ciphertext: result.encryptedData,
            iv: result.iv
          });
          resolve(JSON.parse(decrypted));
        } catch (error) {
          console.error('[StorageService] Failed to decrypt key:', error);
          reject(error);
        }
      };
      request.onerror = () => {
        console.error('[StorageService] Failed to get key:', request.error);
        reject(request.error);
      };
    });
  }

  async getKeyPairsByType(type: StoredKeyPair['type']): Promise<Array<{ id: string; publicKey: string; privateKey: string }>> {
    const store = await this.getStore('keys');
    const index = store.index('type');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(type);
      request.onsuccess = async () => {
        const results = request.result as StoredKeyPair[];
        const decrypted: Array<{ id: string; publicKey: string; privateKey: string }> = [];
        
        for (const result of results) {
          try {
            const data = await this.decrypt({
              ciphertext: result.encryptedData,
              iv: result.iv
            });
            const parsed = JSON.parse(data);
            decrypted.push({ id: result.id, ...parsed });
          } catch (error) {
            console.error('[StorageService] Failed to decrypt key:', error);
          }
        }
        
        resolve(decrypted);
      };
      request.onerror = () => {
        console.error('[StorageService] Failed to get keys:', request.error);
        reject(request.error);
      };
    });
  }

  async deleteKeyPair(id: string): Promise<void> {
    const store = await this.getStore('keys', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('[StorageService] Failed to delete key:', request.error);
        reject(request.error);
      };
    });
  }

  async deleteExpiredKeys(): Promise<number> {
    const store = await this.getStore('keys', 'readwrite');
    const now = Date.now();
    let deletedCount = 0;

    return new Promise((resolve, reject) => {
      const request = store.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const key = cursor.value as StoredKeyPair;
          if (key.expiresAt && key.expiresAt < now) {
            cursor.delete();
            deletedCount++;
          }
          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };
      request.onerror = () => {
        console.error('[StorageService] Failed to delete expired keys:', request.error);
        reject(request.error);
      };
    });
  }

  async setSetting<T>(key: string, value: T): Promise<void> {
    const store = await this.getStore('settings', 'readwrite');
    const setting: AppSettings = {
      key,
      value,
      updatedAt: Date.now()
    };
    return new Promise((resolve, reject) => {
      const request = store.put(setting);
      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('[StorageService] Failed to save setting:', request.error);
        reject(request.error);
      };
    });
  }

  async getSetting<T>(key: string): Promise<T | null> {
    const store = await this.getStore('settings');
    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => {
        const result = request.result as AppSettings | undefined;
        resolve(result ? (result.value as T) : null);
      };
      request.onerror = () => {
        console.error('[StorageService] Failed to get setting:', request.error);
        reject(request.error);
      };
    });
  }

  async deleteSetting(key: string): Promise<void> {
    const store = await this.getStore('settings', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('[StorageService] Failed to delete setting:', request.error);
        reject(request.error);
      };
    });
  }

  async saveMediaBlob(id: string, messageId: string, type: string, blob: Blob): Promise<void> {
    const store = await this.getStore('media', 'readwrite');
    const arrayBuffer = await blob.arrayBuffer();
    return new Promise((resolve, reject) => {
      const request = store.put({
        id,
        messageId,
        type,
        data: arrayBuffer,
        size: blob.size,
        mimeType: blob.type,
        savedAt: Date.now()
      });
      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('[StorageService] Failed to save media:', request.error);
        reject(request.error);
      };
    });
  }

  async getMediaBlob(id: string): Promise<Blob | null> {
    const store = await this.getStore('media');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => {
        if (request.result) {
          const blob = new Blob([request.result.data], { type: request.result.mimeType });
          resolve(blob);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => {
        console.error('[StorageService] Failed to get media:', request.error);
        reject(request.error);
      };
    });
  }

  async deleteMediaBlob(id: string): Promise<void> {
    const store = await this.getStore('media', 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => {
        console.error('[StorageService] Failed to delete media:', request.error);
        reject(request.error);
      };
    });
  }

  async clearAllData(): Promise<void> {
    if (!this.db) {
      await this.initialize();
    }
    if (!this.db) return;

    const storeNames = ['messages', 'contacts', 'sessions', 'keys', 'settings', 'media'];
    
    for (const storeName of storeNames) {
      try {
        const store = await this.getStore(storeName, 'readwrite');
        await new Promise<void>((resolve, reject) => {
          const request = store.clear();
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        console.error(`[StorageService] Failed to clear ${storeName}:`, error);
      }
    }
    
    console.log('[StorageService] All data cleared');
  }

  async getStorageStats(): Promise<{
    messageCount: number;
    contactCount: number;
    sessionCount: number;
    keyCount: number;
    mediaCount: number;
  }> {
    const getCounts = async (storeName: string): Promise<number> => {
      try {
        const store = await this.getStore(storeName);
        return new Promise((resolve, reject) => {
          const request = store.count();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      } catch {
        return 0;
      }
    };

    const [messageCount, contactCount, sessionCount, keyCount, mediaCount] = await Promise.all([
      getCounts('messages'),
      getCounts('contacts'),
      getCounts('sessions'),
      getCounts('keys'),
      getCounts('media')
    ]);

    return { messageCount, contactCount, sessionCount, keyCount, mediaCount };
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    if (this.keyDb) {
      this.keyDb.close();
      this.keyDb = null;
    }
    this.initialized = false;
    this.initPromise = null;
    this.encryptionKey = null;
  }
}

export const storageService = new StorageService();
export { StorageService };
export type { StoredMessage, StoredContact, StoredSession, StoredKeyPair };
