export interface AppManifest {
  appId: string;
  version: string;
  name: string;
  description: string;
  author: string;
  entryPoint: string;
  files: AppFile[];
  dependencies: string[];
  permissions: AppPermissions;
  cacheStrategy: 'aggressive' | 'moderate' | 'minimal';
  cacheDuration: number;
  deployedAt: number;
  deployedBy: string;
  previousVersion?: string;
  manifestHash: string;
  signature: string;
}

export interface AppFile {
  path: string;
  size: number;
  mimeType: string;
  hash: string;
  content?: string;
  chunks?: ChunkInfo[];
}

export interface ChunkInfo {
  index: number;
  hash: string;
  size: number;
}

export interface AppPermissions {
  network: boolean;
  storage: boolean;
  camera: boolean;
  microphone: boolean;
  location: boolean;
  notifications: boolean;
}

export interface AppDeployment {
  appId: string;
  url: string;
  manifest: AppManifest;
  deployedAt: number;
  peerCount: number;
  totalSize: number;
  fileCount: number;
  chunkCount: number;
}

export interface DeployOptions {
  name: string;
  description?: string;
  version?: string;
  author?: string;
  permissions?: Partial<AppPermissions>;
  cacheStrategy?: 'aggressive' | 'moderate' | 'minimal';
  cacheDuration?: number;
}

export interface CachedApp {
  manifest: AppManifest;
  installedAt: number;
  lastUsed: number;
  cacheExpiry: number;
}

export interface CachedChunk {
  data: ArrayBuffer;
  appId: string;
  cachedAt: number;
  accessCount: number;
}

export interface CachedState {
  data: any;
  updatedAt: number;
  version: number;
}

export interface WebMessage {
  type: 'APP_DEPLOYMENT' | 'APP_CHUNK_REQUEST' | 'APP_CHUNK_RESPONSE' | 'APP_STATE_UPDATE' | 'APP_MANIFEST_REQUEST' | 'APP_MANIFEST_RESPONSE';
  appId: string;
  timestamp: number;
  senderId: string;
  [key: string]: any;
}

export interface AppDeploymentMessage extends WebMessage {
  type: 'APP_DEPLOYMENT';
  version: string;
  manifest: AppManifest;
  signature: string;
}

export interface ChunkRequestMessage extends WebMessage {
  type: 'APP_CHUNK_REQUEST';
  chunkHash: string;
  requesterId: string;
}

export interface ChunkResponseMessage extends WebMessage {
  type: 'APP_CHUNK_RESPONSE';
  chunkHash: string;
  chunkData: ArrayBuffer;
  chunkIndex: number;
}

export interface StateUpdateMessage extends WebMessage {
  type: 'APP_STATE_UPDATE';
  stateKey: string;
  stateData: any;
}

export interface ManifestRequestMessage extends WebMessage {
  type: 'APP_MANIFEST_REQUEST';
  requesterId: string;
}

export interface ManifestResponseMessage extends WebMessage {
  type: 'APP_MANIFEST_RESPONSE';
  manifest: AppManifest;
}

export enum AppLoadState {
  CHECKING_CACHE = 'Checking cache...',
  DISCOVERING_PEERS = 'Finding peers...',
  DOWNLOADING = 'Downloading...',
  VERIFYING = 'Verifying integrity...',
  READY = 'Ready',
  ERROR = 'Load failed'
}

export interface LoadProgress {
  state: AppLoadState;
  progress: number;
  message: string;
}

export type StateUpdateCallback = (key: string, value: any) => void;
export type MessageCallback = (from: string, message: any) => void;
export type LoadProgressCallback = (progress: LoadProgress) => void;
