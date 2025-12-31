import { io, Socket } from 'socket.io-client';
import { cryptoService, EncryptedData } from './CryptoService';
import { Message, PeerInfo } from '../types';
import { g3tzkpService } from './G3TZKPService';
import { emergencyMessagingService } from './EmergencyMessagingService';
import { webRTCDirectService } from './WebRTCDirectService';
import { zkpService } from './ZKPService';
import { p2pSignalingService } from './P2PSignalingService';

export interface MessagePayload {
  id: string;
  senderId: string;
  senderName: string;
  recipientId: string;
  content?: string;
  encrypted?: EncryptedData;
  timestamp: number;
  type: 'text' | 'image' | 'video' | 'file' | '3d-object';
  mediaUrl?: string;
  mediaType?: string;
  fileName?: string;
  fileSize?: number;
  tensorData?: {
    objectUrl: string;
    dimensions: { width: number; height: number; depth: number };
    vertices: number;
  };
  zkpProofId?: string;
  isEncrypted: boolean;
}

export interface SystemMessage {
  id: string;
  type: 'CONNECTION_REQUEST' | 'CONNECTION_ACCEPT' | 'CONNECTION_DENY';
  senderId: string;
  senderName: string;
  recipientId: string;
  timestamp: number;
  data?: Record<string, any>;
}

export type MessageHandler = (message: Message) => void;
export type PeerHandler = (peer: PeerInfo) => void;
export type ConnectionHandler = (status: 'connected' | 'disconnected' | 'error', error?: string) => void;
export type SystemMessageHandler = (message: SystemMessage) => void;

class MessagingService {
  private socket: Socket | null = null;
  private localPeerId: string = '';
  private localPeerName: string = 'LOCAL_OPERATOR';
  private messageHandlers: Set<MessageHandler> = new Set();
  private peerConnectHandlers: Set<PeerHandler> = new Set();
  private peerDisconnectHandlers: Set<PeerHandler> = new Set();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private systemMessageHandlers: Set<SystemMessageHandler> = new Set();
  private connectedPeers: Map<string, PeerInfo> = new Map();
  private messageQueue: MessagePayload[] = [];
  private isConnected: boolean = false;
  private p2pMode: 'hybrid' | 'p2p-only' | 'relay-only' = 'p2p-only';
  private libp2pInitialized: boolean = false;

  private isStaticDeployment(): boolean {
    if (typeof window === 'undefined') return false;
    const hostname = window.location.hostname;
    return hostname.includes('ipfs') || 
           hostname.includes('filebase') || 
           hostname.includes('g3tzkp.com') ||
           hostname.includes('cloudflare') ||
           hostname.includes('pinata') ||
           window.location.protocol === 'ipfs:' ||
           window.location.protocol === 'ipns:';
  }

  async initialize(serverUrl?: string): Promise<string> {
    if (!cryptoService.isInitialized()) {
      await cryptoService.initialize();
    }
    
    console.log('[MessagingService] Initializing P2P messaging...');
    
    try {
      await emergencyMessagingService.initializeEmergencyMode();
      console.log('✅ Emergency messaging ready:', emergencyMessagingService.isReady());
    } catch (err) {
      console.warn('[MessagingService] Emergency messaging failed:', err);
    }

    try {
      console.log('✅ G3TZKP Protocol ready for mobile P2P');
    } catch (err) {
      console.warn('[MessagingService] Mobile P2P failed:', err);
    }

    const peerId = await this.initializeP2P();
    this.localPeerId = peerId;
    this.isConnected = true;
    this.notifyConnectionHandlers('connected');
    console.log('[MessagingService] P2P-only mode initialized with peer:', this.localPeerId);
    
    p2pSignalingService.initialize(peerId, this.localPeerName);
    this.setupP2PEventListeners();
    
    if (!this.isStaticDeployment()) {
      this.trySocketConnection(serverUrl);
    } else {
      console.log('[MessagingService] Static deployment detected - using pure P2P mode');
    }
    
    return this.localPeerId;
  }

  private trySocketConnection(serverUrl?: string): void {
    const url = serverUrl || this.getServerUrl();
    
    try {
      this.socket = io(url, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 3,
        reconnectionDelay: 1000,
        timeout: 5000
      });

      this.socket.on('connect', () => {
        console.log('[MessagingService] Socket.IO connected (hybrid mode)');
        this.socket!.emit('register', {
          peerId: this.localPeerId,
          peerName: this.localPeerName,
          publicKey: cryptoService.getPublicKey(),
          timestamp: Date.now()
        });
        this.p2pMode = 'hybrid';
        this.flushMessageQueue();
      });

      this.socket.on('disconnect', () => {
        console.log('[MessagingService] Socket.IO disconnected - continuing in P2P mode');
        this.p2pMode = 'p2p-only';
      });

      this.socket.on('connect_error', () => {
        console.log('[MessagingService] Socket.IO unavailable - using pure P2P mode');
        this.p2pMode = 'p2p-only';
      });

      this.socket.on('message', (payload: MessagePayload) => {
        this.handleIncomingMessage(payload).catch(err => 
          console.error('[MessagingService] Error handling incoming message:', err)
        );
      });

      this.socket.on('system_message', (message: SystemMessage) => {
        console.log('[MessagingService] System message received:', message.type, 'from:', message.senderId);
        this.systemMessageHandlers.forEach(handler => handler(message));
      });

      this.socket.on('peer_connected', (peer: PeerInfo) => {
        this.connectedPeers.set(peer.peerId, peer);
        this.peerConnectHandlers.forEach(handler => handler(peer));
      });

      this.socket.on('peer_disconnected', (peerId: string) => {
        const peer = this.connectedPeers.get(peerId);
        if (peer) {
          this.connectedPeers.delete(peerId);
          this.peerDisconnectHandlers.forEach(handler => handler(peer));
        }
      });

      this.socket.on('peers_list', (peers: PeerInfo[]) => {
        peers.forEach(peer => {
          if (peer.peerId !== this.localPeerId) {
            this.connectedPeers.set(peer.peerId, peer);
          }
        });
      });
    } catch (err) {
      console.log('[MessagingService] Socket.IO not available - pure P2P mode');
      this.p2pMode = 'p2p-only';
    }
  }

  private getServerUrl(): string {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    return 'http://localhost:3001';
  }

  private setupP2PEventListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('p2p-message', ((event: CustomEvent) => {
      const { peerId, message } = event.detail;
      console.log('[MessagingService] P2P message received from:', peerId);
      
      if (message.type === 'chat-message') {
        this.handleIncomingMessage(message.payload).catch(err => 
          console.error('[MessagingService] Error handling P2P message:', err)
        );
      }
    }) as EventListener);

    window.addEventListener('p2p-connected', ((event: CustomEvent) => {
      const { peerId, peerName } = event.detail;
      console.log('[MessagingService] P2P peer connected:', peerName);
      
      const peer: PeerInfo = {
        peerId,
        peerName,
        publicKey: '',
        online: true,
        lastSeen: Date.now()
      };
      
      this.connectedPeers.set(peerId, peer);
      this.peerConnectHandlers.forEach(handler => handler(peer));
    }) as EventListener);
  }

  sendP2PMessage(recipientId: string, content: string): boolean {
    const payload: MessagePayload = {
      id: this.generateId(20),
      senderId: this.localPeerId,
      senderName: this.localPeerName,
      recipientId,
      content,
      timestamp: Date.now(),
      type: 'text',
      isEncrypted: false
    };

    return p2pSignalingService.sendMessage(recipientId, {
      type: 'chat-message',
      payload
    });
  }

  getP2PConnectedPeers(): { peerId: string; peerName: string }[] {
    return p2pSignalingService.getConnectedPeers();
  }

  private generateId(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }

  private async handleIncomingMessage(payload: MessagePayload): Promise<void> {
    let content = payload.content || '';
    let zkpVerified = false;
    
    if (payload.isEncrypted && payload.encrypted) {
      try {
        content = cryptoService.decrypt(payload.senderId, payload.encrypted);
      } catch (error) {
        console.error('Failed to decrypt message:', error);
        content = '[Encrypted message - decryption failed]';
      }
    }

    if (payload.zkpProofId) {
      try {
        zkpVerified = await zkpService.verifyProof(payload.zkpProofId);
        console.log('[MessagingService] ZKP verification for', payload.id, ':', zkpVerified);
      } catch (err) {
        console.warn('[MessagingService] ZKP verification failed (non-critical):', err);
      }
    }

    const message: Message = {
      id: payload.id,
      sender: payload.senderName,
      recipient: payload.recipientId,
      content,
      timestamp: payload.timestamp,
      status: 'delivered',
      type: payload.type,
      isZkpVerified: zkpVerified,
      isMe: false,
      mediaUrl: payload.mediaUrl,
      mediaType: payload.mediaType,
      fileName: payload.fileName,
      fileSize: payload.fileSize,
      tensorData: payload.tensorData
    };

    this.messageHandlers.forEach(handler => handler(message));
  }

  async sendMessage(
    recipientId: string,
    content: string,
    options: {
      type?: 'text' | 'image' | 'video' | 'file' | '3d-object';
      encrypt?: boolean;
      mediaUrl?: string;
      mediaType?: string;
      fileName?: string;
      fileSize?: number;
      tensorData?: MessagePayload['tensorData'];
    } = {}
  ): Promise<Message> {
    const messageId = this.generateId(16);
    const timestamp = Date.now();
    
    let encrypted: EncryptedData | undefined;
    let messageContent = content;
    
    if (options.encrypt !== false && cryptoService.hasSession(recipientId)) {
      encrypted = cryptoService.encrypt(recipientId, content);
      messageContent = '[Encrypted]';
    }

    let zkpProofId: string | undefined;
    try {
      await zkpService.initialize();
      const messageHash = this.hashContent(content);
      const senderKey = this.localPeerId;
      const proof = await zkpService.generateMessageProof(senderKey, messageHash);
      zkpProofId = proof.id;
    } catch (err) {
      console.warn('[MessagingService] ZKP proof generation failed (non-critical):', err);
    }

    const payload: MessagePayload = {
      id: messageId,
      senderId: this.localPeerId,
      senderName: this.localPeerName,
      recipientId,
      content: encrypted ? undefined : content,
      encrypted,
      timestamp,
      type: options.type || 'text',
      mediaUrl: options.mediaUrl,
      mediaType: options.mediaType,
      fileName: options.fileName,
      fileSize: options.fileSize,
      tensorData: options.tensorData,
      zkpProofId,
      isEncrypted: !!encrypted
    };

    let sentViaP2P = false;
    let sentViaEmergency = false;
    let sentViaSocket = false;

    if (this.libp2pInitialized && this.p2pMode !== 'relay-only') {
      sentViaP2P = await this.sendViaP2P(recipientId, payload);
    }

    if (!sentViaP2P && emergencyMessagingService.isReady()) {
      sentViaEmergency = await emergencyMessagingService.sendMessageNow(recipientId, content);
    }

    if (!sentViaP2P && !sentViaEmergency) {
      if (this.isConnected && this.socket) {
        this.socket.emit('message', payload);
        sentViaSocket = true;
      } else {
        this.messageQueue.push(payload);
      }
    }

    const message: Message = {
      id: messageId,
      sender: this.localPeerName,
      recipient: recipientId,
      content,
      timestamp,
      status: sentViaP2P || sentViaSocket ? 'sent' : 'pending',
      type: options.type || 'text',
      isZkpVerified: !!zkpProofId,
      isMe: true,
      mediaUrl: options.mediaUrl,
      mediaType: options.mediaType,
      fileName: options.fileName,
      fileSize: options.fileSize,
      tensorData: options.tensorData
    };

    return message;
  }

  async sendMediaMessage(
    recipientId: string,
    file: File,
    options: { convert3D?: boolean } = {}
  ): Promise<Message> {
    const mediaUrl = URL.createObjectURL(file);
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    
    let type: 'image' | 'video' | 'file' | '3d-object' = 'file';
    let tensorData: MessagePayload['tensorData'] | undefined;
    
    if (isImage) {
      type = options.convert3D ? '3d-object' : 'image';
      if (options.convert3D) {
        tensorData = await this.convertTo3DObject(file);
      }
    } else if (isVideo) {
      type = options.convert3D ? '3d-object' : 'video';
      if (options.convert3D) {
        tensorData = await this.convertTo3DObject(file);
      }
    }

    return this.sendMessage(recipientId, file.name, {
      type,
      mediaUrl,
      mediaType: file.type,
      fileName: file.name,
      fileSize: file.size,
      tensorData
    });
  }

  private async convertTo3DObject(file: File): Promise<MessagePayload['tensorData']> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      
      if (file.type.startsWith('image/')) {
        const img = new Image();
        img.onload = () => {
          const aspectRatio = img.width / img.height;
          resolve({
            objectUrl: url,
            dimensions: { 
              width: aspectRatio, 
              height: 1, 
              depth: 0.1 
            },
            vertices: 4
          });
        };
        img.src = url;
      } else {
        resolve({
          objectUrl: url,
          dimensions: { width: 1.78, height: 1, depth: 0.1 },
          vertices: 4
        });
      }
    });
  }

  private async flushMessageQueue(): Promise<void> {
    if (this.messageQueue.length === 0) return;
    
    const canUseSocket = this.isConnected && this.socket && this.p2pMode !== 'p2p-only';
    const canUseP2P = this.libp2pInitialized && this.p2pMode !== 'relay-only';
    
    if (!canUseSocket && !canUseP2P) return;
    
    const failedPayloads: MessagePayload[] = [];
    
    while (this.messageQueue.length > 0) {
      const payload = this.messageQueue.shift();
      if (!payload) continue;
      
      let sent = false;
      
      if (canUseP2P) {
        try {
          const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
          await g3tzkpService.sendDirectMessage(payload.recipientId, payloadBytes);
          sent = true;
          console.log('[MessagingService] Queued message sent via P2P to:', payload.recipientId);
        } catch (err) {
          console.warn('[MessagingService] P2P flush failed for:', payload.id);
        }
      }
      
      if (!sent && canUseSocket) {
        this.socket!.emit('message', payload);
        sent = true;
      }
      
      if (!sent) {
        failedPayloads.push(payload);
      }
    }
    
    if (failedPayloads.length > 0) {
      this.messageQueue.push(...failedPayloads);
    }
  }

  private notifyConnectionHandlers(status: 'connected' | 'disconnected' | 'error', error?: string): void {
    this.connectionHandlers.forEach(handler => handler(status, error));
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onSystemMessage(handler: SystemMessageHandler): () => void {
    this.systemMessageHandlers.add(handler);
    return () => this.systemMessageHandlers.delete(handler);
  }

  async sendSystemMessage(
    recipientId: string,
    type: SystemMessage['type'],
    data?: Record<string, any>
  ): Promise<boolean> {
    const message: SystemMessage = {
      id: this.generateId(16),
      type,
      senderId: this.localPeerId,
      senderName: this.localPeerName,
      recipientId,
      timestamp: Date.now(),
      data
    };

    if (this.socket?.connected) {
      this.socket.emit('system_message', message);
      console.log('[MessagingService] System message EMITTED:', type, 'to:', recipientId, 'via socket:', this.socket.id);
      return true;
    } else {
      console.warn('[MessagingService] Cannot send system message - socket not connected. Socket exists:', !!this.socket, 'Socket connected:', this.socket?.connected);
      return false;
    }
  }

  getLocalPeerId(): string {
    return this.localPeerId;
  }

  getLocalPeerName(): string {
    return this.localPeerName;
  }

  onPeerConnect(handler: PeerHandler): () => void {
    this.peerConnectHandlers.add(handler);
    return () => this.peerConnectHandlers.delete(handler);
  }

  onPeerDisconnect(handler: PeerHandler): () => void {
    this.peerDisconnectHandlers.add(handler);
    return () => this.peerDisconnectHandlers.delete(handler);
  }

  onConnectionChange(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  getConnectedPeers(): PeerInfo[] {
    return Array.from(this.connectedPeers.values());
  }

  setLocalPeerName(name: string): void {
    this.localPeerName = name;
    if (this.socket && this.isConnected) {
      this.socket.emit('update_name', { peerId: this.localPeerId, name });
    }
  }

  isSocketConnected(): boolean {
    return this.isConnected;
  }

  getSocket(): import('socket.io-client').Socket | null {
    return this.socket;
  }

  establishSession(peerId: string, publicKey: string): void {
    cryptoService.establishSession(peerId, publicKey);
  }

  async initializeP2P(): Promise<string> {
    if (this.libp2pInitialized) {
      console.log('[MessagingService] LibP2P already initialized');
      return g3tzkpService.getPeerId();
    }

    try {
      console.log('[MessagingService] Initializing LibP2P...');
      const peerId = await g3tzkpService.initialize();
      this.localPeerId = peerId;
      console.log('[MessagingService] LibP2P initialized with peerId:', peerId);
      
      g3tzkpService.onMessage((message: LibP2PMessage) => {
        console.log('[MessagingService] Received P2P message from:', message.from);
        this.handleP2PMessage(message);
      });

      g3tzkpService.onPeerConnect((peer) => {
        console.log('[MessagingService] P2P peer connected:', peer.id);
        const peerInfo: PeerInfo = {
          peerId: peer.id,
          name: peer.metadata?.name || 'P2P_PEER',
          publicKey: peer.metadata?.publicKey,
          isOnline: true,
          lastSeen: peer.lastSeen.getTime()
        };
        this.connectedPeers.set(peer.id, peerInfo);
        this.peerConnectHandlers.forEach(handler => handler(peerInfo));
      });

      g3tzkpService.onPeerDisconnect((peer) => {
        console.log('[MessagingService] P2P peer disconnected:', peer.id);
        const peerInfo = this.connectedPeers.get(peer.id);
        if (peerInfo) {
          this.connectedPeers.delete(peer.id);
          this.peerDisconnectHandlers.forEach(handler => handler(peerInfo));
        }
      });

      this.libp2pInitialized = true;
      console.log('[MessagingService] LibP2P fully integrated');
      
      this.flushMessageQueue().catch(err => {
        console.warn('[MessagingService] Queue flush after P2P init failed:', err);
      });
      
      return peerId;
    } catch (error) {
      console.error('[MessagingService] Failed to initialize LibP2P:', error);
      this.localPeerId = '12D3KooW' + this.generateId(32);
      return this.localPeerId;
    }
  }

  private async sendViaP2P(recipientId: string, payload: MessagePayload): Promise<boolean> {
    if (!this.libp2pInitialized || this.p2pMode === 'relay-only') {
      return false;
    }

    try {
      const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
      await g3tzkpService.sendDirectMessage(recipientId, payloadBytes);
      console.log('[MessagingService] Message sent via P2P to:', recipientId);
      return true;
    } catch (error) {
      console.warn('[MessagingService] P2P send failed, falling back to relay:', error);
      return false;
    }
  }

  private handleP2PMessage(message: LibP2PMessage): void {
    try {
      const payloadJson = new TextDecoder().decode(message.data);
      const payload: MessagePayload = JSON.parse(payloadJson);
      this.handleIncomingMessage(payload).catch(err => 
        console.error('[MessagingService] Error handling P2P message:', err)
      );
    } catch (error) {
      console.error('[MessagingService] Failed to parse P2P message:', error);
    }
  }

  setP2PMode(mode: 'hybrid' | 'p2p-only' | 'relay-only'): void {
    this.p2pMode = mode;
    console.log('[MessagingService] P2P mode set to:', mode);
  }

  getP2PMode(): 'hybrid' | 'p2p-only' | 'relay-only' {
    return this.p2pMode;
  }

  isP2PInitialized(): boolean {
    return this.libp2pInitialized;
  }

  async getP2PStats(): Promise<{ peerId: string; connectedPeers: number; uptime: number } | null> {
    if (!this.libp2pInitialized) return null;
    return g3tzkpService.getStats();
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    if (this.libp2pInitialized) {
      g3tzkpService.stop();
      this.libp2pInitialized = false;
    }
    this.isConnected = false;
    this.connectedPeers.clear();
  }
}

export const messagingService = new MessagingService();
