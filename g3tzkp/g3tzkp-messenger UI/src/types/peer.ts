export interface OperatorProfile {
  peerId: string;
  displayName: string;
  avatar?: string;
  bio?: string;
  publicKey: JsonWebKey;
  createdAt: number;
  updatedAt: number;
  isOnline: boolean;
  lastSeen: number;
}

export interface PeerContact {
  peerId: string;
  contactName: string;
  operatorProfile?: OperatorProfile;
  addedAt: number;
  isFavorite: boolean;
  lastMessageAt?: number;
  unreadCount: number;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
}

export interface PeerContactAddRequest {
  peerId: string;
  contactName: string;
}

export interface BusinessPhoto {
  id: string;
  url: string;
  caption?: string;
  order: number;
  uploadedAt: number;
}

export interface BusinessProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  imageUrl?: string;
  inStock: boolean;
  category?: string;
  createdAt: number;
}

export interface BusinessCallAvailability {
  isOpen: boolean;
  nextOpenTime?: number;
  nextCloseTime?: number;
}

export interface CallSession {
  sessionId: string;
  callerId: string;
  callerName: string;
  recipientId: string;
  recipientName: string;
  startTime: number;
  endTime?: number;
  status: 'ringing' | 'active' | 'ended' | 'missed' | 'rejected';
  isVideocall: boolean;
}
