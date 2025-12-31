// Complete type definitions - NO STUBS

export enum NodeType {
  MOBILE = "mobile",
  DESKTOP = "desktop", 
  PWA = "pwa",
  RELAY = "relay",
  VERIFIER = "verifier"
}

export enum NetworkMode {
  LOCAL_P2P = "local_p2p",
  IPFS_PUBSUB = "ipfs_pubsub",
  HYBRID = "hybrid",
  OFFLINE = "offline"
}

export enum MessageType {
  TEXT = "text",
  FILE = "file",
  IMAGE = "image",
  AUDIO = "audio",
  VIDEO = "video",
  SYSTEM = "system"
}

export enum MessageStatus {
  PENDING = "pending",
  SENT = "sent",
  DELIVERED = "delivered",
  READ = "read",
  FAILED = "failed"
}

export interface G3ZKPConfig {
  node: {
    type: NodeType;
    id: string;
    version: string;
    capabilities: string[];
    publicKey: Uint8Array;
  };
  network: {
    mode: NetworkMode;
    bootstrapNodes: string[];
    enableRelay: boolean;
    enableNatTraversal: boolean;
    maxConnections: number;
    connectionTimeout: number;
    localPort: number;
    httpPort: number;
    metricsPort: number;
  };
  security: {
    zkpCircuitVersion: string;
    encryptionProtocol: string;
    forwardSecrecy: boolean;
    postCompromiseSecurity: boolean;
    auditLevel: "basic" | "standard" | "paranoid";
    keyRotationInterval: number;
  };
  storage: {
    messageRetentionDays: number;
    maxMessageSize: number;
    enableEphemeral: boolean;
    cacheSize: number;
    encryptAtRest: boolean;
    dataPath: string;
  };
  messenger: {
    provisionMode: "AUTO" | "ON" | "OFF";
    minProofs: number;
    proofExpirationDays: number;
    messageRetentionDays: number;
    maxMessageSize: number;
    bandwidthCapacity: number;
    messageStorage: number;
    maxConnections: number;
  };
}

export interface Message {
  id: string;
  conversationId: string;
  sender: Uint8Array;
  recipient: Uint8Array;
  content: Uint8Array;
  contentType: MessageType;
  timestamp: Date;
  hash: string;
  status: MessageStatus;
  metadata: {
    encryptionVersion: string;
    zkpProofId?: string;
    ephemeral: boolean;
    expiresAt?: Date;
  };
}

export interface EncryptedMessage {
  ciphertext: Uint8Array;
  mac: Uint8Array;
  header: {
    ratchetPublicKey: Uint8Array;
    previousChainLength: number;
    messageNumber: number;
  };
  metadata: {
    messageId: string;
    encryptionVersion: string;
    timestamp: Date;
    keyId: string;
  };
}

export interface ZKProof {
  circuitId: string;
  proof: Uint8Array;
  publicSignals: bigint[];
  metadata: {
    proofId: string;
    generationTime: number;
    circuitConstraints: number;
    timestamp: Date;
    proverId: string;
  };
  verificationKey?: Uint8Array;
}

export interface Session {
  id: string;
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

export interface PeerInfo {
  id: string;
  addresses: string[];
  protocols: string[];
  metadata: {
    discoveryMethod: string;
    lastSeen: Date;
    latency?: number;
    nodeType: NodeType;
  };
}

export interface MessageReceipt {
  messageId: string;
  recipientId: string;
  timestamp: Date;
  status: "sent" | "delivered" | "published" | "failed";
  method: "direct" | "pubsub" | "relay";
}

// Local P2P specific types
export interface LocalPeer {
  peerId: string;
  publicKey: Uint8Array;
  nodeType: NodeType;
  capabilities: string[];
  lastSeen: Date;
  address: string; // local network address
}

export interface P2PConnection {
  peerId: string;
  status: "connecting" | "connected" | "disconnected";
  protocols: string[];
  latency?: number;
  bytesSent: number;
  bytesReceived: number;
}

// Security and Audit Types
export interface SecurityFinding {
  id: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  category: "crypto" | "network" | "storage" | "identity" | "zkp";
  location: { file: string; line: number; column: number };
  evidence: string;
  remediation: string[];
  discoveredAt: Date;
}

export interface AuditReport {
  id: string;
  timestamp: Date;
  duration: number;
  findings: SecurityFinding[];
  passed: boolean;
  totalFindings: number;
}

// Configuration Management Types
export interface ProofInputs {
  [key: string]: bigint | bigint[] | string | number;
}

export interface CircuitInfo {
  id: string;
  name: string;
  description: string;
  constraints: number;
  wasmPath?: string;
  zkeyPath?: string;
  verificationKey?: any;
}

// Event System Types
export interface G3ZKPEvents {
  'message:received': Message;
  'message:sent': Message;
  'connection:established': { peerId: string };
  'connection:failed': { peerId: string; error: string };
  'zkp:proof:generated': { circuitId: string; proof: ZKProof };
  'zkp:proof:verified': { circuitId: string; valid: boolean };
  'security:alert': SecurityFinding;
  'error': Error;
  'ready': void;
  'shutdown': void;
}

// Storage Engine Types
export interface StorageStats {
  totalMessages: number;
  totalSessions: number;
  totalProofs: number;
  storageSize: number;
  encrypted: boolean;
}

// Key Management Types
export interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export interface IdentityKeys {
  identityKeyPair: KeyPair;
  signingKeyPair: KeyPair;
  keyId: string;
  createdAt: Date;
}

// Network Types
export interface NetworkStatus {
  connected: boolean;
  peerCount: number;
  mode: NetworkMode;
  localAddress?: string;
  uptime: number;
}

// Application Core Type
export interface G3ZKPApplication {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  isReady(): Promise<boolean>;
  getPeerId(): string;
  getConfig(): G3ZKPConfig;
  crypto: CryptoEngine;
  zkp: ZKPEngine;
  network: NetworkEngine;
  storage: StorageEngine;
  messaging: MessagingEngine;
  audit: AuditEngine;
  on<K extends keyof G3ZKPEvents>(event: K, handler: G3ZKPEvents[K]): void;
  off<K extends keyof G3ZKPEvents>(event: K, handler: G3ZKPEvents[K]): void;
  emit<K extends keyof G3ZKPEvents>(event: K, data: G3ZKPEvents[K]): void;
}

// Engine Interface Types
export interface CryptoEngine {
  initialize(): Promise<void>;
  isReady(): Promise<boolean>;
  generateIdentityKeys(): Promise<IdentityKeys>;
  getIdentityKey(): Uint8Array;
  createSession(peerId: string): Promise<Session>;
  encryptMessage(message: Message, session: Session): Promise<EncryptedMessage>;
  decryptMessage(encryptedMessage: EncryptedMessage, session: Session): Promise<Message>;
}

export interface ZKPEngine {
  initialize(): Promise<void>;
  isInitialized(): Promise<boolean>;
  generateProof(circuitId: string, inputs: ProofInputs): Promise<ZKProof>;
  verifyProof(proof: ZKProof): Promise<boolean>;
  listCircuits(): Promise<CircuitInfo[]>;
}

export interface NetworkEngine {
  initialize(): Promise<void>;
  isConnected(): boolean;
  getConnectedPeers(): string[];
  sendMessage(peerId: string, data: Uint8Array): Promise<MessageReceipt>;
  publishMessage(topic: string, data: Uint8Array): Promise<MessageReceipt>;
  subscribe(topic: string): Promise<void>;
  unsubscribe(topic: string): Promise<void>;
}

export interface StorageEngine {
  initialize(): Promise<void>;
  saveMessage(message: Message): Promise<void>;
  getMessage(id: string): Promise<Message | null>;
  getMessagesByConversation(conversationId: string, limit?: number): Promise<Message[]>;
  saveSession(session: Session): Promise<void>;
  getSession(id: string): Promise<Session | null>;
  deleteMessagesBefore(timestamp: number): Promise<number>;
  getStorageStats(): Promise<StorageStats>;
  isEncrypted(): boolean;
}

export interface MessagingEngine {
  initialize(): Promise<void>;
  sendMessage(conversationId: string, content: string): Promise<Message>;
  getConversations(): Promise<string[]>;
  markMessageRead(messageId: string): Promise<void>;
}

export interface AuditEngine {
  initialize(): Promise<void>;
  runAudit(files: string[]): Promise<AuditReport>;
  startMonitoring(): Promise<void>;
  stopMonitoring(): Promise<void>;
}