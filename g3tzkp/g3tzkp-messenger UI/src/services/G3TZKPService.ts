import { g3tzkpCrypto, EncryptedPayload } from './G3TZKPCrypto';
import { g3tzkpSignaling, SignalingOffer, SignalingAnswer, SignalingData } from './G3TZKPSignaling';

export interface G3TZKPPeer {
  peerId: string;
  publicKey: JsonWebKey;
  connected: boolean;
  lastSeen: number;
}

export interface G3TZKPMessage {
  id: string;
  from: string;
  to: string;
  timestamp: number;
  type: 'TEXT' | 'FILE' | 'PRESENCE';
  payload: EncryptedPayload;
}

type MessageHandler = (from: string, content: string, type: string) => void;
type PeerHandler = (peer: G3TZKPPeer) => void;

class G3TZKPProtocolService {
  private initialized = false;
  private localPeerId = '';
  private peers: Map<string, G3TZKPPeer> = new Map();
  
  private messageHandlers: MessageHandler[] = [];
  private peerConnectHandlers: PeerHandler[] = [];
  private peerDisconnectHandlers: PeerHandler[] = [];

  async initialize(): Promise<string> {
    if (this.initialized) {
      return this.localPeerId;
    }

    console.log('[G3TZKP] Initializing G3TZKP Protocol...');

    this.localPeerId = await g3tzkpCrypto.initialize();

    g3tzkpSignaling.setCallbacks({
      onMessage: (peerId, data) => this.handleIncomingData(peerId, data),
      onConnected: (peerId) => this.handlePeerConnected(peerId),
      onDisconnected: (peerId) => this.handlePeerDisconnected(peerId)
    });

    this.initialized = true;
    console.log('[G3TZKP] Protocol initialized. Peer ID:', this.localPeerId);

    return this.localPeerId;
  }

  getPeerId(): string {
    return this.localPeerId;
  }

  getPublicKey(): JsonWebKey | null {
    return g3tzkpCrypto.getPublicKey();
  }

  async createConnectionOffer(): Promise<SignalingOffer> {
    if (!this.initialized) await this.initialize();
    
    const publicKey = g3tzkpCrypto.getPublicKey();
    if (!publicKey) throw new Error('No public key available');

    console.log('[G3TZKP] Creating connection offer...');
    return g3tzkpSignaling.createOffer(this.localPeerId, publicKey);
  }

  async processConnectionOffer(offer: SignalingOffer): Promise<SignalingAnswer> {
    if (!this.initialized) await this.initialize();

    const publicKey = g3tzkpCrypto.getPublicKey();
    if (!publicKey) throw new Error('No public key available');

    console.log('[G3TZKP] Processing offer from:', offer.peerId);

    this.peers.set(offer.peerId, {
      peerId: offer.peerId,
      publicKey: offer.publicKey,
      connected: false,
      lastSeen: Date.now()
    });

    return g3tzkpSignaling.createAnswer(offer, this.localPeerId, publicKey);
  }

  async completeConnection(answer: SignalingAnswer): Promise<void> {
    console.log('[G3TZKP] Completing connection with:', answer.peerId);

    this.peers.set(answer.peerId, {
      peerId: answer.peerId,
      publicKey: answer.publicKey,
      connected: false,
      lastSeen: Date.now()
    });

    await g3tzkpSignaling.processAnswer(answer, this.localPeerId);
  }

  encodeSignalingData(data: SignalingData): string {
    return g3tzkpSignaling.compressForQR(data);
  }

  decodeSignalingData(encoded: string): SignalingData {
    return g3tzkpSignaling.decompressFromQR(encoded);
  }

  async sendMessage(peerId: string, content: string, type: 'TEXT' | 'FILE' | 'PRESENCE' = 'TEXT'): Promise<boolean> {
    const peer = this.peers.get(peerId);
    if (!peer) {
      console.error('[G3TZKP] Unknown peer:', peerId);
      return false;
    }

    if (!g3tzkpSignaling.isConnected(peerId)) {
      console.error('[G3TZKP] Not connected to peer:', peerId);
      return false;
    }

    try {
      const encrypted = await g3tzkpCrypto.encryptForPeer(peer.publicKey, content);

      const message: G3TZKPMessage = {
        id: crypto.randomUUID(),
        from: this.localPeerId,
        to: peerId,
        timestamp: Date.now(),
        type,
        payload: encrypted
      };

      const messageBytes = new TextEncoder().encode(JSON.stringify(message));
      const sent = g3tzkpSignaling.send(peerId, messageBytes);

      if (sent) {
        console.log('[G3TZKP] Message sent to:', peerId);
      }

      return sent;
    } catch (e) {
      console.error('[G3TZKP] Failed to send message:', e);
      return false;
    }
  }

  private async handleIncomingData(peerId: string, data: Uint8Array): Promise<void> {
    try {
      const messageJson = new TextDecoder().decode(data);
      const message: G3TZKPMessage = JSON.parse(messageJson);

      const content = await g3tzkpCrypto.decryptFromPeer(message.payload);

      console.log('[G3TZKP] Received message from:', peerId, 'type:', message.type);

      for (const handler of this.messageHandlers) {
        handler(peerId, content, message.type);
      }
    } catch (e) {
      console.error('[G3TZKP] Failed to process incoming data:', e);
    }
  }

  private handlePeerConnected(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.connected = true;
      peer.lastSeen = Date.now();
      
      console.log('[G3TZKP] Peer connected:', peerId);
      
      for (const handler of this.peerConnectHandlers) {
        handler(peer);
      }
    }
  }

  private handlePeerDisconnected(peerId: string): void {
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.connected = false;
      
      console.log('[G3TZKP] Peer disconnected:', peerId);
      
      for (const handler of this.peerDisconnectHandlers) {
        handler(peer);
      }
    }
  }

  onMessage(handler: MessageHandler): void {
    this.messageHandlers.push(handler);
  }

  onPeerConnect(handler: PeerHandler): void {
    this.peerConnectHandlers.push(handler);
  }

  onPeerDisconnect(handler: PeerHandler): void {
    this.peerDisconnectHandlers.push(handler);
  }

  isConnected(peerId: string): boolean {
    return g3tzkpSignaling.isConnected(peerId);
  }

  getConnectedPeers(): G3TZKPPeer[] {
    return Array.from(this.peers.values()).filter(p => p.connected);
  }

  getAllPeers(): G3TZKPPeer[] {
    return Array.from(this.peers.values());
  }

  getPeer(peerId: string): G3TZKPPeer | undefined {
    return this.peers.get(peerId);
  }

  disconnect(peerId: string): void {
    g3tzkpSignaling.disconnect(peerId);
    const peer = this.peers.get(peerId);
    if (peer) {
      peer.connected = false;
    }
  }

  disconnectAll(): void {
    g3tzkpSignaling.disconnectAll();
    for (const peer of this.peers.values()) {
      peer.connected = false;
    }
  }

  getStats(): {
    peerId: string;
    totalPeers: number;
    connectedPeers: number;
    protocol: string;
  } {
    return {
      peerId: this.localPeerId,
      totalPeers: this.peers.size,
      connectedPeers: this.getConnectedPeers().length,
      protocol: 'G3TZKP/1.0'
    };
  }
}

export const g3tzkpService = new G3TZKPProtocolService();
