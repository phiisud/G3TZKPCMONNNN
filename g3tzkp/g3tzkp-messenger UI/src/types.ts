export type MessageStatus = 'pending' | 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
export type MessageType = 'text' | 'file' | 'image' | 'video' | 'voice' | 'system' | '3d-object';

export interface TensorData {
  objectUrl: string;
  dimensions: { width: number; height: number; depth: number };
  vertices: number;
  tensorField?: {
    pixelCount: number;
    resolution: number;
    phiValue: number;
    piValue: number;
  };
  flowerOfLife?: {
    generations: number;
    rayCount: number;
    sacredGeometryScale: number;
  };
  originalFiles?: {
    fileId: string;
    fileName: string;
    url: string;
    mimeType: string;
    size: number;
  }[];
  thumbnailDataUrl?: string;
  createdAt?: number;
}

export interface VoiceMessageData {
  audioUrl: string;
  duration: number;
  waveformData: number[];
  transcript?: string;
}

export interface Message {
  id: string;
  content: string;
  sender: string;
  recipient?: string;
  timestamp: number;
  status: MessageStatus;
  type: MessageType;
  isZkpVerified: boolean;
  isMe: boolean;
  replyTo?: string;
  fileProgress?: number;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  mediaUrl?: string;
  mediaType?: string;
  tensorData?: TensorData;
  voiceData?: VoiceMessageData;
  proofId?: string;
  reactions?: MessageReaction[];
  threadCount?: number;
  editedAt?: number;
  deletedAt?: number;
  altText?: string;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  users: string[];
  includesMe: boolean;
}

export interface Conversation {
  id: string;
  name: string;
  participantPublicKey: string;
  lastMessage: Message | null;
  unreadCount: number;
  isGroup: boolean;
  updatedAt: number;
}

export interface LicenseStatus {
  valid: boolean;
  expiresAt: number;
  expiresInDays: number;
  accumulatedValue: number;
}

export interface PeerInfo {
  id?: string;
  peerId: string;
  publicKey?: string;
  status?: 'online' | 'away' | 'offline';
  lastSeen?: number;
  addresses?: string[];
  protocols?: string[];
  connectedAt?: number;
}

export interface NetworkStats {
  messagesSent: number;
  messagesReceived: number;
  routesCached: number;
  peersDiscovered: number;
}

export interface StorageStats {
  messageCount: number;
  totalSize: number;
  sessionCount: number;
  zkProofCount: number;
  indexSize?: number;
  conversationCount?: number;
  cacheHitRate?: number;
  lastCompaction?: number;
}

export enum UIState {
  INITIALIZING = 'INITIALIZING',
  NETWORK_MAP = 'NETWORK_MAP',
  COMMUNICATION = 'COMMUNICATION',
  CRYPTO_VERIFICATION = 'CRYPTO_VERIFICATION'
}

export type ModalType = 'none' | 'call_voice' | 'call_video' | 'group' | 'license' | 'settings' | 'new_chat' | 'group_settings' | 'join_requests' | 'member_management' | 'user_profile';

// ============================================
// MESH GROUPS SYSTEM - Reddit-Style Communities
// ============================================

export enum MeshGroupRole {
  OWNER = 'owner',
  ADMIN = 'admin', 
  MODERATOR = 'moderator',
  MEMBER = 'member',
  PENDING = 'pending',
  BANNED = 'banned'
}

export enum JoinRequestStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired'
}

export interface MeshGroupPermissions {
  canPost: boolean;
  canReply: boolean;
  canInvite: boolean;
  canKick: boolean;
  canBan: boolean;
  canMute: boolean;
  canPinMessages: boolean;
  canDeleteMessages: boolean;
  canEditGroupInfo: boolean;
  canManageRoles: boolean;
  canApproveJoinRequests: boolean;
  canManagePermissions: boolean;
}

export const DEFAULT_PERMISSIONS: Record<MeshGroupRole, MeshGroupPermissions> = {
  [MeshGroupRole.OWNER]: {
    canPost: true,
    canReply: true,
    canInvite: true,
    canKick: true,
    canBan: true,
    canMute: true,
    canPinMessages: true,
    canDeleteMessages: true,
    canEditGroupInfo: true,
    canManageRoles: true,
    canApproveJoinRequests: true,
    canManagePermissions: true
  },
  [MeshGroupRole.ADMIN]: {
    canPost: true,
    canReply: true,
    canInvite: true,
    canKick: true,
    canBan: true,
    canMute: true,
    canPinMessages: true,
    canDeleteMessages: true,
    canEditGroupInfo: true,
    canManageRoles: false,
    canApproveJoinRequests: true,
    canManagePermissions: false
  },
  [MeshGroupRole.MODERATOR]: {
    canPost: true,
    canReply: true,
    canInvite: true,
    canKick: true,
    canBan: false,
    canMute: true,
    canPinMessages: true,
    canDeleteMessages: true,
    canEditGroupInfo: false,
    canManageRoles: false,
    canApproveJoinRequests: true,
    canManagePermissions: false
  },
  [MeshGroupRole.MEMBER]: {
    canPost: true,
    canReply: true,
    canInvite: false,
    canKick: false,
    canBan: false,
    canMute: false,
    canPinMessages: false,
    canDeleteMessages: false,
    canEditGroupInfo: false,
    canManageRoles: false,
    canApproveJoinRequests: false,
    canManagePermissions: false
  },
  [MeshGroupRole.PENDING]: {
    canPost: false,
    canReply: false,
    canInvite: false,
    canKick: false,
    canBan: false,
    canMute: false,
    canPinMessages: false,
    canDeleteMessages: false,
    canEditGroupInfo: false,
    canManageRoles: false,
    canApproveJoinRequests: false,
    canManagePermissions: false
  },
  [MeshGroupRole.BANNED]: {
    canPost: false,
    canReply: false,
    canInvite: false,
    canKick: false,
    canBan: false,
    canMute: false,
    canPinMessages: false,
    canDeleteMessages: false,
    canEditGroupInfo: false,
    canManageRoles: false,
    canApproveJoinRequests: false,
    canManagePermissions: false
  }
};

export interface MeshGroupMember {
  id: string;
  peerId: string;
  displayName: string;
  role: MeshGroupRole;
  joinedAt: number;
  lastSeenAt: number;
  permissions: MeshGroupPermissions;
  isMuted: boolean;
  mutedUntil?: number;
  avatar?: string;
  publicKey: string;
  isOnline: boolean;
  statusMessage?: string;
}

export interface JoinRequest {
  id: string;
  groupId: string;
  requesterId: string;
  requesterName: string;
  requesterPublicKey: string;
  requestMessage?: string;
  status: JoinRequestStatus;
  createdAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
  rejectionReason?: string;
}

export interface MeshGroup {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  createdBy: string;
  updatedAt: number;
  memberCount: number;
  members: MeshGroupMember[];
  pendingRequests: JoinRequest[];
  settings: MeshGroupSettings;
  pinnedMessages: string[];
  avatar?: string;
  isPrivate: boolean;
  requiresApproval: boolean;
  lastActivity: number;
  unreadCount: number;
  zkpVerified: boolean;
  encryptionEnabled: boolean;
}

export interface MeshGroupSettings {
  allowJoinRequests: boolean;
  requireApproval: boolean;
  maxMembers: number;
  messageRetentionDays: number;
  allowFileSharing: boolean;
  maxFileSizeMb: number;
  allowVoiceCalls: boolean;
  allowVideoCalls: boolean;
  slowModeSeconds: number;
  antiSpamEnabled: boolean;
  zkpRequired: boolean;
  encryptionLevel: 'standard' | 'enhanced' | 'paranoid';
  inviteLinkEnabled: boolean;
  inviteLink?: string;
  inviteLinkExpiry?: number;
}

export const DEFAULT_GROUP_SETTINGS: MeshGroupSettings = {
  allowJoinRequests: true,
  requireApproval: true,
  maxMembers: 1000,
  messageRetentionDays: 365,
  allowFileSharing: true,
  maxFileSizeMb: 100,
  allowVoiceCalls: true,
  allowVideoCalls: true,
  slowModeSeconds: 0,
  antiSpamEnabled: true,
  zkpRequired: true,
  encryptionLevel: 'enhanced',
  inviteLinkEnabled: false
};

// ============================================
// OPERATOR PROFILE SYSTEM
// ============================================

export enum OperatorStatus {
  ONLINE = 'online',
  AWAY = 'away',
  BUSY = 'busy',
  OFFLINE = 'offline',
  INVISIBLE = 'invisible'
}

export interface OperatorProfile {
  id: string;
  peerId: string;
  displayName: string;
  publicKey: string;
  avatar?: string;
  status: OperatorStatus;
  statusMessage?: string;
  createdAt: number;
  lastSeenAt: number;
  isVerified: boolean;
  zkpIdentityProof?: string;
  bio?: string;
  settings: OperatorSettings;
}

export interface OperatorSettings {
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  readReceiptsEnabled: boolean;
  typingIndicatorsEnabled: boolean;
  onlineStatusVisible: boolean;
  lastSeenVisible: boolean;
  profilePublic: boolean;
  theme: 'g3tzkp' | 'tensor-blue' | 'multivectoral';
  fontSize: 'small' | 'medium' | 'large';
  language: string;
}

export const DEFAULT_OPERATOR_SETTINGS: OperatorSettings = {
  notificationsEnabled: true,
  soundEnabled: true,
  readReceiptsEnabled: true,
  typingIndicatorsEnabled: true,
  onlineStatusVisible: true,
  lastSeenVisible: true,
  profilePublic: false,
  theme: 'geodesic',
  fontSize: 'medium',
  language: 'en'
};

// ============================================
// NOTIFICATION SYSTEM
// ============================================

export enum NotificationType {
  MESSAGE = 'message',
  MENTION = 'mention',
  JOIN_REQUEST = 'join_request',
  JOIN_APPROVED = 'join_approved',
  JOIN_REJECTED = 'join_rejected',
  ROLE_CHANGED = 'role_changed',
  GROUP_INVITE = 'group_invite',
  CALL_INCOMING = 'call_incoming',
  SYSTEM = 'system'
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  groupId?: string;
  senderId?: string;
  messageId?: string;
  createdAt: number;
  read: boolean;
  actionUrl?: string;
}

// ============================================
// TYPING INDICATOR SYSTEM
// ============================================

export interface TypingUser {
  peerId: string;
  displayName: string;
  startedAt: number;
}

export interface TypingIndicatorState {
  conversationId: string;
  typingUsers: TypingUser[];
}

// ============================================
// MESSAGE ACTIONS
// ============================================

export type MessageAction = 'reply' | 'react' | 'edit' | 'delete' | 'copy' | 'pin' | 'forward';

export const AVAILABLE_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🔥', '✅', '🚀', '👀'];

export interface ThreadMessage {
  parentId: string;
  replies: Message[];
  totalCount: number;
  lastReplyAt: number;
}

// ============================================
// SEARCH SYSTEM
// ============================================

export enum SearchCategory {
  ALL = 'all',
  MESSAGES = 'messages',
  GROUPS = 'groups',
  USERS = 'users',
  FILES = 'files'
}

export interface SearchFilters {
  category: SearchCategory;
  dateFrom?: number;
  dateTo?: number;
  groupId?: string;
  senderId?: string;
  hasFiles?: boolean;
  isVerified?: boolean;
}

export interface SearchResult {
  id: string;
  type: 'message' | 'group' | 'operator' | 'file';
  title: string;
  snippet: string;
  timestamp: number;
  groupId?: string;
  groupName?: string;
  senderId?: string;
  senderName?: string;
  messageId?: string;
  matchedTerms: string[];
  relevanceScore: number;
}

export interface SearchState {
  query: string;
  filters: SearchFilters;
  results: SearchResult[];
  isSearching: boolean;
  hasMore: boolean;
  totalCount: number;
  currentPage: number;
}
