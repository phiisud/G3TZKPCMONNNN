import { BrowserLevel } from 'browser-level';
import EventEmitter from 'eventemitter3';
import { StorageEncryption } from './storage-encryption';

const DB_MESSAGE_PREFIX = 'msg:';
const DB_SESSION_PREFIX = 'session:';
const DB_PROOF_PREFIX = 'proof:';
const DB_CONVERSATION_PREFIX = 'conv:';
const DB_PEER_PREFIX = 'peer:';
const DB_META_PREFIX = 'meta:';
const DB_INDEX_PREFIX = 'idx:';

export interface Message {
  id: string;
  conversationId: string;
  sender: Uint8Array;
  recipient: Uint8Array;
  content: Uint8Array;
  contentType: string;
  timestamp: Date;
  hash: string;
  status: string;
  metadata: {
    encryptionVersion: string;
    zkpProofId?: string;
    ephemeral: boolean;
    expiresAt?: Date;
  };
}

export interface Session {
  id: string;
  peerId: string;
  identityKey: Uint8Array;
  signedPreKey: Uint8Array;
  oneTimePreKey?: Uint8Array;
  createdAt: Date;
  lastActivity: Date;
}

export interface ZKProof {
  id: string;
  messageId: string;
  proof: any;
  publicSignals: string[];
  circuitId: string;
  createdAt: Date;
  verified: boolean;
}

export interface StorageConfig {
  dbPath: string;
  encryptionKey?: Uint8Array;
  messageRetentionDays?: number;
  maxMessageSize?: number;
  enableEphemeral?: boolean;
  cacheSize?: number;
  encryptAtRest?: boolean;
}

export interface StorageStats {
  totalMessages: number;
  totalSessions: number;
  totalProofs: number;
  databaseSize: number;
  encryptedChunks: number;
  cacheHitRate: number;
}

export interface ConversationInfo {
  id: string;
  peerId: string;
  lastMessage?: Message;
  unreadCount: number;
  messageCount: number;
  createdAt: Date;
  lastActivity: Date;
}

export class G3ZKPStorageEngine extends EventEmitter {
  private db!: BrowserLevel<string, any>;
  private encryption?: StorageEncryption;
  private config: StorageConfig;
  private isInitialized = false;
  private messageCache: Map<string, Message> = new Map();
  private sessionCache: Map<string, Session> = new Map();
  private stats: StorageStats = {
    totalMessages: 0,
    totalSessions: 0,
    totalProofs: 0,
    databaseSize: 0,
    encryptedChunks: 0,
    cacheHitRate: 0,
  };

  constructor(config: StorageConfig) {
    super();
    this.config = {
      messageRetentionDays: 30,
      maxMessageSize: 10 * 1024 * 1024,
      enableEphemeral: true,
      cacheSize: 1000,
      encryptAtRest: true,
      ...config,
    };
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Use IndexedDB-based storage for browser
      this.db = new BrowserLevel(this.config.dbPath, {
        valueEncoding: 'json',
      });

      if (this.config.encryptAtRest && this.config.encryptionKey) {
        this.encryption = new StorageEncryption(this.config.encryptionKey);
      }

      await this.db.open();
      await this.loadStats();
      
      this.isInitialized = true;
      this.emit('initialized');
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Storage initialization failed: ${error}`);
    }
  }

  private async loadStats(): Promise<void> {
    try {
      const statsKey = `${DB_META_PREFIX}stats`;
      const stats = await this.db.get(statsKey).catch(() => null);
      if (stats) {
        this.stats = stats;
      }
    } catch (error) {
      // Stats don't exist yet, use defaults
    }
  }

  private async saveStats(): Promise<void> {
    const statsKey = `${DB_META_PREFIX}stats`;
    await this.db.put(statsKey, this.stats);
  }

  async storeMessage(message: Message): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Storage not initialized');
    }

    const key = `${DB_MESSAGE_PREFIX}${message.id}`;
    let data: any = message;

    if (this.encryption) {
      const encrypted = this.encryption.encryptBytes(
        new TextEncoder().encode(JSON.stringify(message))
      );
      data = {
        encrypted: Array.from(encrypted),
      };
      this.stats.encryptedChunks++;
    }

    await this.db.put(key, data);
    
    // Update conversation index
    const convKey = `${DB_CONVERSATION_PREFIX}${message.conversationId}`;
    await this.updateConversationIndex(message);

    this.messageCache.set(message.id, message);
    this.stats.totalMessages++;
    await this.saveStats();

    this.emit('message:stored', message);
  }

  async getMessage(messageId: string): Promise<Message | null> {
    if (!this.isInitialized) {
      throw new Error('Storage not initialized');
    }

    // Check cache first
    if (this.messageCache.has(messageId)) {
      return this.messageCache.get(messageId)!;
    }

    const key = `${DB_MESSAGE_PREFIX}${messageId}`;
    
    try {
      let data = await this.db.get(key);

      if (this.encryption && data.encrypted) {
        const decrypted = this.encryption.decryptBytes(
          new Uint8Array(data.encrypted)
        );
        data = JSON.parse(new TextDecoder().decode(decrypted));
      }

      const message: Message = {
        ...data,
        timestamp: new Date(data.timestamp),
      };

      this.messageCache.set(messageId, message);
      return message;
    } catch (error) {
      return null;
    }
  }

  async getConversationMessages(
    conversationId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Message[]> {
    if (!this.isInitialized) {
      throw new Error('Storage not initialized');
    }

    const messages: Message[] = [];
    const prefix = `${DB_MESSAGE_PREFIX}`;

    const iterator = this.db.iterator({
      gte: prefix,
      lte: prefix + '\uffff',
    });

    for await (const [key, value] of iterator) {
      let data = value;

      if (this.encryption && data.encrypted) {
        const decrypted = this.encryption.decryptBytes(
          new Uint8Array(data.encrypted)
        );
        data = JSON.parse(new TextDecoder().decode(decrypted));
      }

      if (data.conversationId === conversationId) {
        messages.push({
          ...data,
          timestamp: new Date(data.timestamp),
        });
      }
    }

    return messages
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(offset, offset + limit);
  }

  async storeSession(session: Session): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Storage not initialized');
    }

    const key = `${DB_SESSION_PREFIX}${session.id}`;
    await this.db.put(key, session);
    
    this.sessionCache.set(session.id, session);
    this.stats.totalSessions++;
    await this.saveStats();

    this.emit('session:stored', session);
  }

  async getSession(sessionId: string): Promise<Session | null> {
    if (!this.isInitialized) {
      throw new Error('Storage not initialized');
    }

    if (this.sessionCache.has(sessionId)) {
      return this.sessionCache.get(sessionId)!;
    }

    const key = `${DB_SESSION_PREFIX}${sessionId}`;
    
    try {
      const data = await this.db.get(key);
      const session: Session = {
        ...data,
        createdAt: new Date(data.createdAt),
        lastActivity: new Date(data.lastActivity),
      };
      
      this.sessionCache.set(sessionId, session);
      return session;
    } catch (error) {
      return null;
    }
  }

  async storeProof(proof: ZKProof): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Storage not initialized');
    }

    const key = `${DB_PROOF_PREFIX}${proof.id}`;
    await this.db.put(key, proof);
    
    this.stats.totalProofs++;
    await this.saveStats();

    this.emit('proof:stored', proof);
  }

  async getProof(proofId: string): Promise<ZKProof | null> {
    if (!this.isInitialized) {
      throw new Error('Storage not initialized');
    }

    const key = `${DB_PROOF_PREFIX}${proofId}`;
    
    try {
      const data = await this.db.get(key);
      return {
        ...data,
        createdAt: new Date(data.createdAt),
      };
    } catch (error) {
      return null;
    }
  }

  private async updateConversationIndex(message: Message): Promise<void> {
    const key = `${DB_CONVERSATION_PREFIX}${message.conversationId}`;
    
    let conv: ConversationInfo;
    try {
      conv = await this.db.get(key);
      conv.lastMessage = message;
      conv.messageCount++;
      conv.lastActivity = message.timestamp;
      if (message.status === 'received') {
        conv.unreadCount++;
      }
    } catch (error) {
      conv = {
        id: message.conversationId,
        peerId: Buffer.from(message.sender).toString('hex'),
        lastMessage: message,
        unreadCount: message.status === 'received' ? 1 : 0,
        messageCount: 1,
        createdAt: message.timestamp,
        lastActivity: message.timestamp,
      };
    }

    await this.db.put(key, conv);
  }

  async getConversations(): Promise<ConversationInfo[]> {
    if (!this.isInitialized) {
      throw new Error('Storage not initialized');
    }

    const conversations: ConversationInfo[] = [];
    const prefix = DB_CONVERSATION_PREFIX;

    const iterator = this.db.iterator({
      gte: prefix,
      lte: prefix + '\uffff',
    });

    for await (const [, value] of iterator) {
      conversations.push({
        ...value,
        createdAt: new Date(value.createdAt),
        lastActivity: new Date(value.lastActivity),
      });
    }

    return conversations.sort(
      (a, b) => b.lastActivity.getTime() - a.lastActivity.getTime()
    );
  }

  async deleteMessage(messageId: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Storage not initialized');
    }

    const key = `${DB_MESSAGE_PREFIX}${messageId}`;
    await this.db.del(key);
    
    this.messageCache.delete(messageId);
    this.stats.totalMessages = Math.max(0, this.stats.totalMessages - 1);
    await this.saveStats();

    this.emit('message:deleted', messageId);
  }

  async getStats(): Promise<StorageStats> {
    return { ...this.stats };
  }

  async cleanup(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    const retentionMs = this.config.messageRetentionDays! * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - retentionMs);

    const prefix = DB_MESSAGE_PREFIX;
    const iterator = this.db.iterator({
      gte: prefix,
      lte: prefix + '\uffff',
    });

    for await (const [key, value] of iterator) {
      let data = value;

      if (this.encryption && data.encrypted) {
        const decrypted = this.encryption.decryptBytes(
          new Uint8Array(data.encrypted)
        );
        data = JSON.parse(new TextDecoder().decode(decrypted));
      }

      const messageDate = new Date(data.timestamp);
      
      if (messageDate < cutoffDate || (data.metadata?.ephemeral && data.metadata?.expiresAt && new Date(data.metadata.expiresAt) < new Date())) {
        await this.db.del(key);
        this.stats.totalMessages = Math.max(0, this.stats.totalMessages - 1);
      }
    }

    await this.saveStats();
    this.emit('cleanup:complete');
  }

  async close(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    await this.saveStats();
    await this.db.close();
    
    this.messageCache.clear();
    this.sessionCache.clear();
    this.isInitialized = false;

    this.emit('closed');
  }
}
