import { Level } from 'level';
import { EventEmitter } from 'events';
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
  ephemeralKey: Uint8Array;
  chainKey: Uint8Array;
  previousChainKey: Uint8Array;
  currentRatchetKey: { publicKey: Uint8Array; secretKey: Uint8Array };
  messageNumber: number;
  previousChainLength: number;
  keyId: string;
  createdAt: Date;
  lastActivity: Date;
}

export interface ZKProof {
  id: string;
  circuitId: string;
  proof: Uint8Array;
  publicSignals: string[];
  metadata: {
    proofId: string;
    generationTime: number;
    circuitConstraints: number;
    timestamp: Date;
    proverId: string;
  };
  verificationKey?: Uint8Array;
}

export interface StorageStats {
  totalMessages: number;
  totalSessions: number;
  totalProofs: number;
  totalConversations: number;
  storageSize: number;
  encrypted: boolean;
  lastCompaction: Date | null;
  dbPath: string;
}

export interface StorageConfig {
  dataPath: string;
  encryptionKey?: Uint8Array;
  enableEncryption: boolean;
  cacheSize: number;
  maxOpenFiles: number;
  compressionEnabled: boolean;
  autoCompactInterval: number;
  messageRetentionDays: number;
  proofRetentionDays: number;
}

export interface ConversationInfo {
  id: string;
  participants: string[];
  lastMessageAt: Date;
  messageCount: number;
  unreadCount: number;
  metadata: Record<string, any>;
}

export class G3ZKPStorageEngine extends EventEmitter {
  private db: Level<string, string> | null = null;
  private config: StorageConfig;
  private encryption: StorageEncryption | null = null;
  private stats: StorageStats;
  private initialized: boolean = false;
  private compactionTimer: NodeJS.Timeout | null = null;
  private retentionTimer: NodeJS.Timeout | null = null;
  private cache: Map<string, any> = new Map();
  private cacheMaxSize: number = 1000;

  constructor(config: Partial<StorageConfig> = {}) {
    super();
    this.config = {
      dataPath: config.dataPath || './data/storage',
      encryptionKey: config.encryptionKey,
      enableEncryption: config.enableEncryption ?? true,
      cacheSize: config.cacheSize || 100 * 1024 * 1024,
      maxOpenFiles: config.maxOpenFiles || 1000,
      compressionEnabled: config.compressionEnabled ?? true,
      autoCompactInterval: config.autoCompactInterval || 3600000,
      messageRetentionDays: config.messageRetentionDays || 30,
      proofRetentionDays: config.proofRetentionDays || 90
    };
    this.stats = {
      totalMessages: 0,
      totalSessions: 0,
      totalProofs: 0,
      totalConversations: 0,
      storageSize: 0,
      encrypted: this.config.enableEncryption,
      lastCompaction: null,
      dbPath: this.config.dataPath
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.config.enableEncryption) {
      if (!this.config.encryptionKey) {
        this.config.encryptionKey = StorageEncryption.generateKey();
      }
      this.encryption = new StorageEncryption(this.config.encryptionKey);
    }

    this.db = new Level<string, string>(this.config.dataPath, {
      valueEncoding: 'utf8',
      keyEncoding: 'utf8'
    });

    await this.db.open();

    await this.loadStats();

    if (this.config.autoCompactInterval > 0) {
      this.compactionTimer = setInterval(() => {
        this.runCompaction();
      }, this.config.autoCompactInterval);
    }

    this.retentionTimer = setInterval(() => {
      this.enforceRetentionPolicies();
    }, 86400000);

    this.initialized = true;
    this.emit('initialized', { dbPath: this.config.dataPath, encrypted: this.config.enableEncryption });
  }

  async saveMessage(message: Message): Promise<void> {
    this.ensureInitialized();

    const key = `${DB_MESSAGE_PREFIX}${message.id}`;
    const serialized = this.serializeMessage(message);
    const value = this.encryption ? this.encryption.encrypt(serialized) : serialized;

    await this.db!.put(key, value);

    const convIndexKey = `${DB_INDEX_PREFIX}conv:${message.conversationId}:${message.timestamp.getTime()}:${message.id}`;
    await this.db!.put(convIndexKey, message.id);

    const timeIndexKey = `${DB_INDEX_PREFIX}time:${message.timestamp.getTime()}:${message.id}`;
    await this.db!.put(timeIndexKey, message.id);

    await this.updateConversationInfo(message.conversationId, message);

    this.cache.set(key, message);
    this.pruneCache();

    this.stats.totalMessages++;
    await this.saveStats();

    this.emit('message:saved', { messageId: message.id, conversationId: message.conversationId });
  }

  async getMessage(id: string): Promise<Message | null> {
    this.ensureInitialized();

    const key = `${DB_MESSAGE_PREFIX}${id}`;

    const cached = this.cache.get(key);
    if (cached) {
      return cached as Message;
    }

    try {
      const value = await this.db!.get(key);
      const decrypted = this.encryption ? this.encryption.decrypt(value) : value;
      const message = this.deserializeMessage(decrypted);

      this.cache.set(key, message);
      this.pruneCache();

      return message;
    } catch (error: any) {
      if (error.code === 'LEVEL_NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  async getMessagesByConversation(conversationId: string, limit: number = 100, before?: Date): Promise<Message[]> {
    this.ensureInitialized();

    const messages: Message[] = [];
    const prefix = `${DB_INDEX_PREFIX}conv:${conversationId}:`;
    const endTimestamp = before ? before.getTime() : Date.now();

    const iterator = this.db!.iterator({
      gte: prefix,
      lte: `${prefix}${endTimestamp}:\xff`,
      reverse: true,
      limit
    });

    try {
      for await (const [_, messageId] of iterator) {
        const message = await this.getMessage(messageId);
        if (message) {
          messages.push(message);
        }
      }
    } finally {
      await iterator.close();
    }

    return messages;
  }

  async deleteMessage(id: string): Promise<boolean> {
    this.ensureInitialized();

    const message = await this.getMessage(id);
    if (!message) {
      return false;
    }

    const key = `${DB_MESSAGE_PREFIX}${id}`;
    await this.db!.del(key);

    const convIndexKey = `${DB_INDEX_PREFIX}conv:${message.conversationId}:${message.timestamp.getTime()}:${id}`;
    await this.db!.del(convIndexKey);

    const timeIndexKey = `${DB_INDEX_PREFIX}time:${message.timestamp.getTime()}:${id}`;
    await this.db!.del(timeIndexKey);

    this.cache.delete(key);
    this.stats.totalMessages = Math.max(0, this.stats.totalMessages - 1);
    await this.saveStats();

    this.emit('message:deleted', { messageId: id });
    return true;
  }

  async deleteMessagesBefore(timestamp: number): Promise<number> {
    this.ensureInitialized();

    let deletedCount = 0;
    const prefix = `${DB_INDEX_PREFIX}time:`;
    const endKey = `${prefix}${timestamp}:\xff`;

    const iterator = this.db!.iterator({
      gte: prefix,
      lte: endKey
    });

    const toDelete: string[] = [];

    try {
      for await (const [indexKey, messageId] of iterator) {
        toDelete.push(messageId);
      }
    } finally {
      await iterator.close();
    }

    for (const messageId of toDelete) {
      const deleted = await this.deleteMessage(messageId);
      if (deleted) {
        deletedCount++;
      }
    }

    this.emit('messages:purged', { count: deletedCount, beforeTimestamp: timestamp });
    return deletedCount;
  }

  async saveSession(session: Session): Promise<void> {
    this.ensureInitialized();

    const key = `${DB_SESSION_PREFIX}${session.id}`;
    const serialized = this.serializeSession(session);
    const value = this.encryption ? this.encryption.encrypt(serialized) : serialized;

    await this.db!.put(key, value);

    const peerIndexKey = `${DB_INDEX_PREFIX}peer-session:${session.peerId}:${session.id}`;
    await this.db!.put(peerIndexKey, session.id);

    this.cache.set(key, session);
    this.pruneCache();

    const existingSession = await this.getSession(session.id);
    if (!existingSession) {
      this.stats.totalSessions++;
      await this.saveStats();
    }

    this.emit('session:saved', { sessionId: session.id, peerId: session.peerId });
  }

  async getSession(id: string): Promise<Session | null> {
    this.ensureInitialized();

    const key = `${DB_SESSION_PREFIX}${id}`;

    const cached = this.cache.get(key);
    if (cached) {
      return cached as Session;
    }

    try {
      const value = await this.db!.get(key);
      const decrypted = this.encryption ? this.encryption.decrypt(value) : value;
      const session = this.deserializeSession(decrypted);

      this.cache.set(key, session);
      this.pruneCache();

      return session;
    } catch (error: any) {
      if (error.code === 'LEVEL_NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  async getSessionsByPeer(peerId: string): Promise<Session[]> {
    this.ensureInitialized();

    const sessions: Session[] = [];
    const prefix = `${DB_INDEX_PREFIX}peer-session:${peerId}:`;

    const iterator = this.db!.iterator({
      gte: prefix,
      lte: `${prefix}\xff`
    });

    try {
      for await (const [_, sessionId] of iterator) {
        const session = await this.getSession(sessionId);
        if (session) {
          sessions.push(session);
        }
      }
    } finally {
      await iterator.close();
    }

    return sessions;
  }

  async deleteSession(id: string): Promise<boolean> {
    this.ensureInitialized();

    const session = await this.getSession(id);
    if (!session) {
      return false;
    }

    const key = `${DB_SESSION_PREFIX}${id}`;
    await this.db!.del(key);

    const peerIndexKey = `${DB_INDEX_PREFIX}peer-session:${session.peerId}:${id}`;
    await this.db!.del(peerIndexKey);

    this.cache.delete(key);
    this.stats.totalSessions = Math.max(0, this.stats.totalSessions - 1);
    await this.saveStats();

    this.emit('session:deleted', { sessionId: id });
    return true;
  }

  async saveProof(proof: ZKProof): Promise<void> {
    this.ensureInitialized();

    const key = `${DB_PROOF_PREFIX}${proof.id}`;
    const serialized = this.serializeProof(proof);
    const value = this.encryption ? this.encryption.encrypt(serialized) : serialized;

    await this.db!.put(key, value);

    const circuitIndexKey = `${DB_INDEX_PREFIX}circuit:${proof.circuitId}:${proof.metadata.timestamp.getTime()}:${proof.id}`;
    await this.db!.put(circuitIndexKey, proof.id);

    this.cache.set(key, proof);
    this.pruneCache();

    this.stats.totalProofs++;
    await this.saveStats();

    this.emit('proof:saved', { proofId: proof.id, circuitId: proof.circuitId });
  }

  async getProof(id: string): Promise<ZKProof | null> {
    this.ensureInitialized();

    const key = `${DB_PROOF_PREFIX}${id}`;

    const cached = this.cache.get(key);
    if (cached) {
      return cached as ZKProof;
    }

    try {
      const value = await this.db!.get(key);
      const decrypted = this.encryption ? this.encryption.decrypt(value) : value;
      const proof = this.deserializeProof(decrypted);

      this.cache.set(key, proof);
      this.pruneCache();

      return proof;
    } catch (error: any) {
      if (error.code === 'LEVEL_NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  async getProofsByCircuit(circuitId: string, limit: number = 100): Promise<ZKProof[]> {
    this.ensureInitialized();

    const proofs: ZKProof[] = [];
    const prefix = `${DB_INDEX_PREFIX}circuit:${circuitId}:`;

    const iterator = this.db!.iterator({
      gte: prefix,
      lte: `${prefix}\xff`,
      reverse: true,
      limit
    });

    try {
      for await (const [_, proofId] of iterator) {
        const proof = await this.getProof(proofId);
        if (proof) {
          proofs.push(proof);
        }
      }
    } finally {
      await iterator.close();
    }

    return proofs;
  }

  async getConversations(): Promise<ConversationInfo[]> {
    this.ensureInitialized();

    const conversations: ConversationInfo[] = [];
    const prefix = DB_CONVERSATION_PREFIX;

    const iterator = this.db!.iterator({
      gte: prefix,
      lte: `${prefix}\xff`
    });

    try {
      for await (const [_, value] of iterator) {
        const decrypted = this.encryption ? this.encryption.decrypt(value) : value;
        const conv = JSON.parse(decrypted) as ConversationInfo;
        conv.lastMessageAt = new Date(conv.lastMessageAt);
        conversations.push(conv);
      }
    } finally {
      await iterator.close();
    }

    return conversations.sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
  }

  async getConversation(id: string): Promise<ConversationInfo | null> {
    this.ensureInitialized();

    const key = `${DB_CONVERSATION_PREFIX}${id}`;

    try {
      const value = await this.db!.get(key);
      const decrypted = this.encryption ? this.encryption.decrypt(value) : value;
      const conv = JSON.parse(decrypted) as ConversationInfo;
      conv.lastMessageAt = new Date(conv.lastMessageAt);
      return conv;
    } catch (error: any) {
      if (error.code === 'LEVEL_NOT_FOUND') {
        return null;
      }
      throw error;
    }
  }

  async markMessageRead(messageId: string): Promise<void> {
    this.ensureInitialized();

    const message = await this.getMessage(messageId);
    if (message) {
      message.status = 'read';
      await this.saveMessage(message);
    }
  }

  async getStorageStats(): Promise<StorageStats> {
    return { ...this.stats };
  }

  isEncrypted(): boolean {
    return this.config.enableEncryption && this.encryption !== null;
  }

  async exportData(): Promise<string> {
    this.ensureInitialized();

    const data: Record<string, any> = {
      messages: [],
      sessions: [],
      proofs: [],
      conversations: [],
      exportedAt: new Date().toISOString()
    };

    const messageIterator = this.db!.iterator({
      gte: DB_MESSAGE_PREFIX,
      lte: `${DB_MESSAGE_PREFIX}\xff`
    });

    try {
      for await (const [_, value] of messageIterator) {
        const decrypted = this.encryption ? this.encryption.decrypt(value) : value;
        data.messages.push(JSON.parse(decrypted));
      }
    } finally {
      await messageIterator.close();
    }

    const sessionIterator = this.db!.iterator({
      gte: DB_SESSION_PREFIX,
      lte: `${DB_SESSION_PREFIX}\xff`
    });

    try {
      for await (const [_, value] of sessionIterator) {
        const decrypted = this.encryption ? this.encryption.decrypt(value) : value;
        data.sessions.push(JSON.parse(decrypted));
      }
    } finally {
      await sessionIterator.close();
    }

    data.conversations = await this.getConversations();

    return JSON.stringify(data, null, 2);
  }

  async importData(jsonData: string): Promise<{ imported: number; errors: number }> {
    this.ensureInitialized();

    let imported = 0;
    let errors = 0;

    try {
      const data = JSON.parse(jsonData);

      if (data.messages && Array.isArray(data.messages)) {
        for (const msgData of data.messages) {
          try {
            const message = this.deserializeMessage(JSON.stringify(msgData));
            await this.saveMessage(message);
            imported++;
          } catch {
            errors++;
          }
        }
      }

      if (data.sessions && Array.isArray(data.sessions)) {
        for (const sessData of data.sessions) {
          try {
            const session = this.deserializeSession(JSON.stringify(sessData));
            await this.saveSession(session);
            imported++;
          } catch {
            errors++;
          }
        }
      }
    } catch {
      errors++;
    }

    return { imported, errors };
  }

  async close(): Promise<void> {
    if (this.compactionTimer) {
      clearInterval(this.compactionTimer);
      this.compactionTimer = null;
    }

    if (this.retentionTimer) {
      clearInterval(this.retentionTimer);
      this.retentionTimer = null;
    }

    if (this.db) {
      await this.db.close();
      this.db = null;
    }

    this.cache.clear();
    this.initialized = false;

    this.emit('closed');
  }

  private async updateConversationInfo(conversationId: string, message: Message): Promise<void> {
    let conv = await this.getConversation(conversationId);

    if (!conv) {
      conv = {
        id: conversationId,
        participants: [],
        lastMessageAt: message.timestamp,
        messageCount: 0,
        unreadCount: 0,
        metadata: {}
      };
      this.stats.totalConversations++;
    }

    conv.lastMessageAt = message.timestamp;
    conv.messageCount++;
    if (message.status !== 'read') {
      conv.unreadCount++;
    }

    const key = `${DB_CONVERSATION_PREFIX}${conversationId}`;
    const serialized = JSON.stringify(conv);
    const value = this.encryption ? this.encryption.encrypt(serialized) : serialized;
    await this.db!.put(key, value);
  }

  private async loadStats(): Promise<void> {
    try {
      const value = await this.db!.get(`${DB_META_PREFIX}stats`);
      const stats = JSON.parse(value);
      this.stats = {
        ...this.stats,
        ...stats,
        lastCompaction: stats.lastCompaction ? new Date(stats.lastCompaction) : null
      };
    } catch {
      await this.recalculateStats();
    }
  }

  private async saveStats(): Promise<void> {
    const statsToSave = {
      totalMessages: this.stats.totalMessages,
      totalSessions: this.stats.totalSessions,
      totalProofs: this.stats.totalProofs,
      totalConversations: this.stats.totalConversations,
      lastCompaction: this.stats.lastCompaction?.toISOString()
    };
    await this.db!.put(`${DB_META_PREFIX}stats`, JSON.stringify(statsToSave));
  }

  private async recalculateStats(): Promise<void> {
    let messages = 0;
    let sessions = 0;
    let proofs = 0;
    let conversations = 0;

    const msgIterator = this.db!.iterator({ gte: DB_MESSAGE_PREFIX, lte: `${DB_MESSAGE_PREFIX}\xff` });
    try {
      for await (const _ of msgIterator) { messages++; }
    } finally {
      await msgIterator.close();
    }

    const sessIterator = this.db!.iterator({ gte: DB_SESSION_PREFIX, lte: `${DB_SESSION_PREFIX}\xff` });
    try {
      for await (const _ of sessIterator) { sessions++; }
    } finally {
      await sessIterator.close();
    }

    const proofIterator = this.db!.iterator({ gte: DB_PROOF_PREFIX, lte: `${DB_PROOF_PREFIX}\xff` });
    try {
      for await (const _ of proofIterator) { proofs++; }
    } finally {
      await proofIterator.close();
    }

    const convIterator = this.db!.iterator({ gte: DB_CONVERSATION_PREFIX, lte: `${DB_CONVERSATION_PREFIX}\xff` });
    try {
      for await (const _ of convIterator) { conversations++; }
    } finally {
      await convIterator.close();
    }

    this.stats.totalMessages = messages;
    this.stats.totalSessions = sessions;
    this.stats.totalProofs = proofs;
    this.stats.totalConversations = conversations;

    await this.saveStats();
  }

  private async runCompaction(): Promise<void> {
    if (!this.db) return;

    try {
      if ('compactRange' in this.db && typeof (this.db as any).compactRange === 'function') {
        await (this.db as any).compactRange(null, null);
      }
      this.stats.lastCompaction = new Date();
      await this.saveStats();
      this.emit('compaction:complete');
    } catch (error) {
      this.emit('compaction:error', { error });
    }
  }

  private async enforceRetentionPolicies(): Promise<void> {
    const messageRetentionMs = this.config.messageRetentionDays * 24 * 60 * 60 * 1000;
    const messageCutoff = Date.now() - messageRetentionMs;

    const deletedMessages = await this.deleteMessagesBefore(messageCutoff);

    this.emit('retention:enforced', { deletedMessages });
  }

  private pruneCache(): void {
    if (this.cache.size > this.cacheMaxSize) {
      const keys = Array.from(this.cache.keys());
      const toRemove = keys.slice(0, keys.length - this.cacheMaxSize);
      for (const key of toRemove) {
        this.cache.delete(key);
      }
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.db) {
      throw new Error('Storage engine not initialized. Call initialize() first.');
    }
  }

  private serializeMessage(message: Message): string {
    return JSON.stringify({
      ...message,
      sender: this.uint8ArrayToBase64(message.sender),
      recipient: this.uint8ArrayToBase64(message.recipient),
      content: this.uint8ArrayToBase64(message.content),
      timestamp: message.timestamp.toISOString(),
      metadata: {
        ...message.metadata,
        expiresAt: message.metadata.expiresAt?.toISOString()
      }
    });
  }

  private deserializeMessage(data: string): Message {
    const parsed = JSON.parse(data);
    return {
      ...parsed,
      sender: this.base64ToUint8Array(parsed.sender),
      recipient: this.base64ToUint8Array(parsed.recipient),
      content: this.base64ToUint8Array(parsed.content),
      timestamp: new Date(parsed.timestamp),
      metadata: {
        ...parsed.metadata,
        expiresAt: parsed.metadata.expiresAt ? new Date(parsed.metadata.expiresAt) : undefined
      }
    };
  }

  private serializeSession(session: Session): string {
    return JSON.stringify({
      ...session,
      identityKey: this.uint8ArrayToBase64(session.identityKey),
      ephemeralKey: this.uint8ArrayToBase64(session.ephemeralKey),
      chainKey: this.uint8ArrayToBase64(session.chainKey),
      previousChainKey: this.uint8ArrayToBase64(session.previousChainKey),
      currentRatchetKey: {
        publicKey: this.uint8ArrayToBase64(session.currentRatchetKey.publicKey),
        secretKey: this.uint8ArrayToBase64(session.currentRatchetKey.secretKey)
      },
      createdAt: session.createdAt.toISOString(),
      lastActivity: session.lastActivity.toISOString()
    });
  }

  private deserializeSession(data: string): Session {
    const parsed = JSON.parse(data);
    return {
      ...parsed,
      identityKey: this.base64ToUint8Array(parsed.identityKey),
      ephemeralKey: this.base64ToUint8Array(parsed.ephemeralKey),
      chainKey: this.base64ToUint8Array(parsed.chainKey),
      previousChainKey: this.base64ToUint8Array(parsed.previousChainKey),
      currentRatchetKey: {
        publicKey: this.base64ToUint8Array(parsed.currentRatchetKey.publicKey),
        secretKey: this.base64ToUint8Array(parsed.currentRatchetKey.secretKey)
      },
      createdAt: new Date(parsed.createdAt),
      lastActivity: new Date(parsed.lastActivity)
    };
  }

  private serializeProof(proof: ZKProof): string {
    return JSON.stringify({
      ...proof,
      proof: this.uint8ArrayToBase64(proof.proof),
      verificationKey: proof.verificationKey ? this.uint8ArrayToBase64(proof.verificationKey) : undefined,
      metadata: {
        ...proof.metadata,
        timestamp: proof.metadata.timestamp.toISOString()
      }
    });
  }

  private deserializeProof(data: string): ZKProof {
    const parsed = JSON.parse(data);
    return {
      ...parsed,
      proof: this.base64ToUint8Array(parsed.proof),
      verificationKey: parsed.verificationKey ? this.base64ToUint8Array(parsed.verificationKey) : undefined,
      metadata: {
        ...parsed.metadata,
        timestamp: new Date(parsed.metadata.timestamp)
      }
    };
  }

  private uint8ArrayToBase64(arr: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < arr.length; i++) {
      binary += String.fromCharCode(arr[i]);
    }
    return btoa(binary);
  }

  private base64ToUint8Array(base64: string): Uint8Array {
    const binary = atob(base64);
    const arr = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      arr[i] = binary.charCodeAt(i);
    }
    return arr;
  }
}
