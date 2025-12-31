export interface WebRTCConfig {
  iceServers?: RTCIceServer[];
  maxConnections?: number;
  dataChannelConfig?: RTCDataChannelInit;
}

export interface PeerConnection {
  peerId: string;
  connection: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
  status: 'connecting' | 'connected' | 'disconnected' | 'failed';
  createdAt: number;
  lastActivity: number;
}

export type MessageHandler = (peerId: string, data: Uint8Array) => void;
export type ConnectionHandler = (peerId: string, status: 'connected' | 'disconnected' | 'failed') => void;

class WebRTCDirectService {
  private peerConnections: Map<string, PeerConnection> = new Map();
  private messageHandlers: Set<MessageHandler> = new Set();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private config: WebRTCConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: WebRTCConfig = {}) {
    this.config = {
      iceServers: config.iceServers || [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' },
        { urls: 'stun:stun4.l.google.com:19302' }
      ],
      maxConnections: config.maxConnections || 20,
      dataChannelConfig: config.dataChannelConfig || {
        ordered: true,
        maxPacketLifeTime: 3000,
        maxRetransmits: 5
      }
    };

    this.startCleanupTimer();
  }

  async createDirectConnection(peerId: string): Promise<RTCDataChannel> {
    if (this.peerConnections.has(peerId)) {
      const existing = this.peerConnections.get(peerId)!;
      if (existing.status === 'connected' && existing.dataChannel) {
        return existing.dataChannel;
      }
    }

    return new Promise((resolve, reject) => {
      try {
        const pc = new RTCPeerConnection({
          iceServers: this.config.iceServers,
          iceTransportPolicy: 'all',
          bundlePolicy: 'max-bundle',
          rtcpMuxPolicy: 'require'
        });

        const dataChannel = pc.createDataChannel('g3zkp-messages', {
          ...this.config.dataChannelConfig,
          protocol: 'g3zkp'
        });

        dataChannel.binaryType = 'arraybuffer';

        const peerConnection: PeerConnection = {
          peerId,
          connection: pc,
          dataChannel,
          status: 'connecting',
          createdAt: Date.now(),
          lastActivity: Date.now()
        };

        this.setupDataChannelHandlers(dataChannel, peerId);
        this.setupPeerConnectionHandlers(pc, peerConnection);
        this.peerConnections.set(peerId, peerConnection);

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            this.emitICECandidate(peerId, event.candidate);
          }
        };

        pc.onconnectionstatechange = () => {
          this.handleConnectionStateChange(peerId, pc.connectionState);
        };

        pc.ondatachannel = (event) => {
          this.setupDataChannelHandlers(event.channel, peerId);
        };

        const timeout = setTimeout(() => {
          if (peerConnection.status === 'connecting') {
            reject(new Error('Connection timeout'));
            this.closePeerConnection(peerId);
          }
        }, 30000);

        dataChannel.onopen = () => {
          clearTimeout(timeout);
          peerConnection.status = 'connected';
          peerConnection.lastActivity = Date.now();
          this.notifyConnectionHandlers(peerId, 'connected');
          resolve(dataChannel);
        };

        dataChannel.onerror = (error) => {
          clearTimeout(timeout);
          reject(error);
        };

      } catch (error) {
        reject(error);
      }
    });
  }

  private setupDataChannelHandlers(dataChannel: RTCDataChannel, peerId: string): void {
    dataChannel.binaryType = 'arraybuffer';

    dataChannel.onmessage = (event) => {
      const peerConnection = this.peerConnections.get(peerId);
      if (peerConnection) {
        peerConnection.lastActivity = Date.now();
      }

      const data = new Uint8Array(event.data);
      this.messageHandlers.forEach(handler => handler(peerId, data));
    };

    dataChannel.onopen = () => {
      const peerConnection = this.peerConnections.get(peerId);
      if (peerConnection) {
        peerConnection.status = 'connected';
        peerConnection.lastActivity = Date.now();
        this.notifyConnectionHandlers(peerId, 'connected');
      }
    };

    dataChannel.onclose = () => {
      const peerConnection = this.peerConnections.get(peerId);
      if (peerConnection) {
        peerConnection.status = 'disconnected';
        this.notifyConnectionHandlers(peerId, 'disconnected');
      }
    };

    dataChannel.onerror = (error) => {
      const peerConnection = this.peerConnections.get(peerId);
      if (peerConnection) {
        peerConnection.status = 'failed';
        this.notifyConnectionHandlers(peerId, 'failed');
      }
    };
  }

  private setupPeerConnectionHandlers(pc: RTCPeerConnection, peerConnection: PeerConnection): void {
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        peerConnection.status = 'failed';
        this.notifyConnectionHandlers(peerConnection.peerId, 'failed');
      }
    };
  }

  private handleConnectionStateChange(peerId: string, state: RTCPeerConnectionState): void {
    const peerConnection = this.peerConnections.get(peerId);
    if (!peerConnection) return;

    switch (state) {
      case 'connected':
        peerConnection.status = 'connected';
        this.notifyConnectionHandlers(peerId, 'connected');
        break;
      case 'disconnected':
      case 'failed':
      case 'closed':
        peerConnection.status = 'disconnected';
        this.notifyConnectionHandlers(peerId, 'disconnected');
        break;
    }
  }

  async sendMessage(peerId: string, data: Uint8Array): Promise<boolean> {
    try {
      const peerConnection = this.peerConnections.get(peerId);

      if (!peerConnection || !peerConnection.dataChannel) {
        const dataChannel = await this.createDirectConnection(peerId);
        if (dataChannel.readyState === 'open') {
          dataChannel.send(data);
          return true;
        }
        return false;
      }

      if (peerConnection.dataChannel.readyState === 'open') {
        peerConnection.dataChannel.send(data);
        peerConnection.lastActivity = Date.now();
        return true;
      } else if (peerConnection.status === 'connecting') {
        return new Promise((resolve) => {
          const checkReady = setInterval(() => {
            if (peerConnection.dataChannel?.readyState === 'open') {
              clearInterval(checkReady);
              peerConnection.dataChannel.send(data);
              peerConnection.lastActivity = Date.now();
              resolve(true);
            }
          }, 100);

          setTimeout(() => {
            clearInterval(checkReady);
            resolve(false);
          }, 5000);
        });
      }

      return false;
    } catch (error) {
      console.error('WebRTC send failed:', error);
      return false;
    }
  }

  async handleOffer(peerId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    try {
      let peerConnection = this.peerConnections.get(peerId);

      if (!peerConnection) {
        const pc = new RTCPeerConnection({
          iceServers: this.config.iceServers,
          iceTransportPolicy: 'all',
          bundlePolicy: 'max-bundle',
          rtcpMuxPolicy: 'require'
        });

        peerConnection = {
          peerId,
          connection: pc,
          dataChannel: null,
          status: 'connecting',
          createdAt: Date.now(),
          lastActivity: Date.now()
        };

        this.setupPeerConnectionHandlers(pc, peerConnection);
        this.peerConnections.set(peerId, peerConnection);

        pc.ondatachannel = (event) => {
          peerConnection!.dataChannel = event.channel;
          this.setupDataChannelHandlers(event.channel, peerId);
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            this.emitICECandidate(peerId, event.candidate);
          }
        };

        pc.onconnectionstatechange = () => {
          this.handleConnectionStateChange(peerId, pc.connectionState);
        };
      }

      await peerConnection.connection.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await peerConnection.connection.createAnswer();
      await peerConnection.connection.setLocalDescription(answer);

      this.emitAnswer(peerId, answer);
    } catch (error) {
      console.error('Failed to handle offer:', error);
      this.closePeerConnection(peerId);
    }
  }

  async handleAnswer(peerId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    try {
      const peerConnection = this.peerConnections.get(peerId);
      if (peerConnection) {
        await peerConnection.connection.setRemoteDescription(new RTCSessionDescription(answer));
      }
    } catch (error) {
      console.error('Failed to handle answer:', error);
    }
  }

  async addICECandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    try {
      const peerConnection = this.peerConnections.get(peerId);
      if (peerConnection) {
        await peerConnection.connection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    } catch (error) {
      console.error('Failed to add ICE candidate:', error);
    }
  }

  private notifyConnectionHandlers(peerId: string, status: 'connected' | 'disconnected' | 'failed'): void {
    this.connectionHandlers.forEach(handler => handler(peerId, status));
  }

  private emitICECandidate(peerId: string, candidate: RTCIceCandidate): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('webrtc-ice-candidate', {
        detail: { peerId, candidate: candidate.toJSON() }
      }));
    }
  }

  private emitAnswer(peerId: string, answer: RTCSessionDescriptionInit): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('webrtc-answer', {
        detail: { peerId, answer }
      }));
    }
  }

  closePeerConnection(peerId: string): void {
    const peerConnection = this.peerConnections.get(peerId);
    if (peerConnection) {
      if (peerConnection.dataChannel) {
        peerConnection.dataChannel.close();
      }
      peerConnection.connection.close();
      this.peerConnections.delete(peerId);
      this.notifyConnectionHandlers(peerId, 'disconnected');
    }
  }

  closeAllConnections(): void {
    for (const [peerId] of this.peerConnections) {
      this.closePeerConnection(peerId);
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onConnectionChange(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    return () => this.connectionHandlers.delete(handler);
  }

  getConnectedPeers(): string[] {
    return Array.from(this.peerConnections.entries())
      .filter(([, conn]) => conn.status === 'connected')
      .map(([peerId]) => peerId);
  }

  getPeerStatus(peerId: string): string {
    const peerConnection = this.peerConnections.get(peerId);
    return peerConnection?.status || 'unknown';
  }

  private startCleanupTimer(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 5 * 60 * 1000;

      for (const [peerId, peerConnection] of this.peerConnections) {
        if (now - peerConnection.lastActivity > timeout) {
          console.log(`Cleaning up inactive WebRTC connection: ${peerId}`);
          this.closePeerConnection(peerId);
        }
      }
    }, 30000);
  }

  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.closeAllConnections();
    this.messageHandlers.clear();
    this.connectionHandlers.clear();
  }
}

export const webRTCDirectService = new WebRTCDirectService();
export default webRTCDirectService;
