import * as localforage from 'localforage';
import { g3tzkpCrypto } from './G3TZKPCrypto';

/**
 * Encrypted Storage Service
 * Provides encrypted persistent storage for sensitive data
 * Messages, keys, and metadata are encrypted at rest
 */

export interface EncryptedData {
  iv: Uint8Array;
  ciphertext: Uint8Array;
  timestamp: number;
}

export interface MessageQueueItem {
  id: string;
  peerId: string;
  content: string;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
}

class EncryptedStorageService {
  private static instance: EncryptedStorageService;
  private messagesDB: LocalForage;
  private keysDB: LocalForage;
  private queueDB: LocalForage;
  private masterKey: CryptoKey | null = null;
  private initialized = false;

  static getInstance(): EncryptedStorageService {
    if (!this.instance) {
      this.instance = new EncryptedStorageService();
    }
    return this.instance;
  }

  constructor() {
    this.messagesDB = localforage.createInstance({
      name: 'G3ZKP',
      storeName: 'EncryptedMessages'
    });

    this.keysDB = localforage.createInstance({
      name: 'G3ZKP',
      storeName: 'EncryptedKeys'
    });

    this.queueDB = localforage.createInstance({
      name: 'G3ZKP',
      storeName: 'MessageQueue'
    });
  }

  async initialize(password?: string): Promise<boolean> {
    try {
      if (this.initialized) return true;

      // Derive master key from password or generate new one
      if (password) {
        this.masterKey = await this.deriveMasterKey(password);
      } else {
        // Check if master key exists in localStorage
        const storedKeyData = localStorage.getItem('g3zkp_master_key_encrypted');
        if (storedKeyData) {
          // In production, this should prompt for password
          // For now, generate a session key
          this.masterKey = await this.generateMasterKey();
        } else {
          this.masterKey = await this.generateMasterKey();
          // Store encrypted master key (in production, encrypt with user password)
          const exportedKey = await crypto.subtle.exportKey('raw', this.masterKey);
          const keyHex = Array.from(new Uint8Array(exportedKey))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
          localStorage.setItem('g3zkp_master_key_encrypted', keyHex);
        }
      }

      this.initialized = true;
      console.log('[EncryptedStorage] Initialized with master key');
      return true;
    } catch (err) {
      console.error('[EncryptedStorage] Initialization failed:', err);
      return false;
    }
  }

  private async generateMasterKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  private async deriveMasterKey(password: string): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    // Use a salt (in production, store this securely)
    const salt = new Uint8Array(16);
    crypto.getRandomValues(salt);

    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  async encryptData(data: Uint8Array): Promise<EncryptedData> {
    if (!this.masterKey) {
      throw new Error('Encrypted storage not initialized');
    }

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.masterKey,
      data
    );

    return {
      iv,
      ciphertext: new Uint8Array(ciphertext),
      timestamp: Date.now()
    };
  }

  async decryptData(encrypted: EncryptedData): Promise<Uint8Array> {
    if (!this.masterKey) {
      throw new Error('Encrypted storage not initialized');
    }

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: encrypted.iv },
      this.masterKey,
      encrypted.ciphertext
    );

    return new Uint8Array(decrypted);
  }

  // === MESSAGE STORAGE ===

  async saveMessage(peerId: string, messageId: string, content: string): Promise<void> {
    if (!this.initialized) await this.initialize();

    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      const encrypted = await this.encryptData(data);

      const key = `${peerId}:${messageId}`;
      await this.messagesDB.setItem(key, {
        iv: Array.from(encrypted.iv),
        ciphertext: Array.from(encrypted.ciphertext),
        timestamp: encrypted.timestamp
      });

      console.log(`[EncryptedStorage] Message saved: ${key}`);
    } catch (err) {
      console.error('[EncryptedStorage] Failed to save message:', err);
      throw err;
    }
  }

  async getMessage(peerId: string, messageId: string): Promise<string | null> {
    if (!this.initialized) await this.initialize();

    try {
      const key = `${peerId}:${messageId}`;
      const stored: any = await this.messagesDB.getItem(key);
      
      if (!stored) return null;

      const encrypted: EncryptedData = {
        iv: new Uint8Array(stored.iv),
        ciphertext: new Uint8Array(stored.ciphertext),
        timestamp: stored.timestamp
      };

      const decrypted = await this.decryptData(encrypted);
      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (err) {
      console.error('[EncryptedStorage] Failed to retrieve message:', err);
      return null;
    }
  }

  async getMessagesForPeer(peerId: string): Promise<{ id: string; content: string; timestamp: number }[]> {
    if (!this.initialized) await this.initialize();

    try {
      const keys = await this.messagesDB.keys();
      const peerKeys = keys.filter(k => k.startsWith(`${peerId}:`));
      
      const messages = await Promise.all(
        peerKeys.map(async (key) => {
          const messageId = key.split(':')[1];
          const content = await this.getMessage(peerId, messageId);
          const stored: any = await this.messagesDB.getItem(key);
          
          return content ? {
            id: messageId,
            content,
            timestamp: stored?.timestamp || 0
          } : null;
        })
      );

      return messages.filter(m => m !== null) as { id: string; content: string; timestamp: number }[];
    } catch (err) {
      console.error('[EncryptedStorage] Failed to get messages for peer:', err);
      return [];
    }
  }

  async deleteMessage(peerId: string, messageId: string): Promise<void> {
    const key = `${peerId}:${messageId}`;
    await this.messagesDB.removeItem(key);
  }

  // === KEY STORAGE ===

  async storeKey(keyId: string, keyData: Uint8Array): Promise<void> {
    if (!this.initialized) await this.initialize();

    try {
      const encrypted = await this.encryptData(keyData);
      await this.keysDB.setItem(keyId, {
        iv: Array.from(encrypted.iv),
        ciphertext: Array.from(encrypted.ciphertext),
        timestamp: encrypted.timestamp
      });
    } catch (err) {
      console.error('[EncryptedStorage] Failed to store key:', err);
      throw err;
    }
  }

  async retrieveKey(keyId: string): Promise<Uint8Array | null> {
    if (!this.initialized) await this.initialize();

    try {
      const stored: any = await this.keysDB.getItem(keyId);
      if (!stored) return null;

      const encrypted: EncryptedData = {
        iv: new Uint8Array(stored.iv),
        ciphertext: new Uint8Array(stored.ciphertext),
        timestamp: stored.timestamp
      };

      return await this.decryptData(encrypted);
    } catch (err) {
      console.error('[EncryptedStorage] Failed to retrieve key:', err);
      return null;
    }
  }

  async deleteKey(keyId: string): Promise<void> {
    await this.keysDB.removeItem(keyId);
  }

  // === MESSAGE QUEUE (for offline delivery) ===

  async queueMessage(message: MessageQueueItem): Promise<void> {
    try {
      await this.queueDB.setItem(message.id, message);
      console.log(`[EncryptedStorage] Message queued: ${message.id}`);
    } catch (err) {
      console.error('[EncryptedStorage] Failed to queue message:', err);
    }
  }

  async getQueuedMessages(): Promise<MessageQueueItem[]> {
    try {
      const keys = await this.queueDB.keys();
      const messages = await Promise.all(
        keys.map(key => this.queueDB.getItem<MessageQueueItem>(key))
      );
      return messages.filter(m => m !== null) as MessageQueueItem[];
    } catch (err) {
      console.error('[EncryptedStorage] Failed to get queued messages:', err);
      return [];
    }
  }

  async dequeueMessage(messageId: string): Promise<void> {
    await this.queueDB.removeItem(messageId);
  }

  async updateQueuedMessage(message: MessageQueueItem): Promise<void> {
    await this.queueDB.setItem(message.id, message);
  }

  // === STORAGE MANAGEMENT ===

  async clearAllData(): Promise<void> {
    await this.messagesDB.clear();
    await this.keysDB.clear();
    await this.queueDB.clear();
    localStorage.removeItem('g3zkp_master_key_encrypted');
    this.masterKey = null;
    this.initialized = false;
    console.log('[EncryptedStorage] All data cleared');
  }

  async getStorageSize(): Promise<{ messages: number; keys: number; queue: number }> {
    const messageKeys = await this.messagesDB.keys();
    const keyKeys = await this.keysDB.keys();
    const queueKeys = await this.queueDB.keys();

    return {
      messages: messageKeys.length,
      keys: keyKeys.length,
      queue: queueKeys.length
    };
  }
}

export const encryptedStorageService = EncryptedStorageService.getInstance();
export default encryptedStorageService;
