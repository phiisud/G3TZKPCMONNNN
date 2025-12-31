import { webRTCDirectService } from './WebRTCDirectService';

export interface SignalingPacket {
  type: 'offer' | 'answer' | 'ice';
  peerId: string;
  peerName: string;
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
  timestamp: number;
}

class P2PSignalingService {
  private localPeerId: string = '';
  private localPeerName: string = '';
  private pendingOffers: Map<string, SignalingPacket> = new Map();
  private pendingAnswers: Map<string, SignalingPacket> = new Map();
  private iceCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private connectionCallbacks: Map<string, (success: boolean) => void> = new Map();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('webrtc-ice-candidate', this.handleLocalIceCandidate.bind(this) as EventListener);
      window.addEventListener('webrtc-answer', this.handleLocalAnswer.bind(this) as EventListener);
    }
  }

  initialize(peerId: string, peerName: string) {
    this.localPeerId = peerId;
    this.localPeerName = peerName;
    console.log('[P2P Signaling] Initialized for:', peerId);
  }

  private handleLocalIceCandidate(event: CustomEvent) {
    const { peerId, candidate } = event.detail;
    const candidates = this.iceCandidates.get(peerId) || [];
    candidates.push(candidate);
    this.iceCandidates.set(peerId, candidates);
  }

  private handleLocalAnswer(event: CustomEvent) {
    const { peerId, answer } = event.detail;
    this.pendingAnswers.set(peerId, {
      type: 'answer',
      peerId: this.localPeerId,
      peerName: this.localPeerName,
      payload: answer,
      timestamp: Date.now()
    });
  }

  async createConnectionOffer(targetPeerId: string = 'pending'): Promise<string> {
    console.log('[P2P Signaling] Creating connection offer...');
    
    return new Promise(async (resolve, reject) => {
      try {
        const pc = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' },
          ],
          iceCandidatePoolSize: 10,
        });

        const dataChannel = pc.createDataChannel('g3zkp-messages', {
          ordered: true,
          maxRetransmits: 5
        });

        const candidates: RTCIceCandidateInit[] = [];
        
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            candidates.push(event.candidate.toJSON());
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        await new Promise<void>((res) => {
          const timeout = setTimeout(res, 3000);
          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'complete') {
              clearTimeout(timeout);
              res();
            }
          };
        });

        const packet: SignalingPacket & { iceCandidates: RTCIceCandidateInit[] } = {
          type: 'offer',
          peerId: this.localPeerId,
          peerName: this.localPeerName,
          payload: {
            type: 'offer',
            sdp: pc.localDescription?.sdp
          },
          iceCandidates: candidates,
          timestamp: Date.now()
        };

        const encoded = this.encodePacket(packet);
        
        this.pendingOffers.set(targetPeerId, packet as SignalingPacket);
        
        dataChannel.onopen = () => {
          console.log('[P2P Signaling] Data channel opened!');
          const callback = this.connectionCallbacks.get(targetPeerId);
          if (callback) callback(true);
        };

        (window as any).__pendingP2PConnection = { pc, dataChannel, targetPeerId };

        resolve(encoded);
      } catch (error) {
        reject(error);
      }
    });
  }

  async acceptConnectionOffer(encodedOffer: string): Promise<string> {
    console.log('[P2P Signaling] Accepting connection offer...');
    
    const packet = this.decodePacket(encodedOffer) as SignalingPacket & { iceCandidates?: RTCIceCandidateInit[] };
    
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ],
      iceCandidatePoolSize: 10,
    });

    const candidates: RTCIceCandidateInit[] = [];
    
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        candidates.push(event.candidate.toJSON());
      }
    };

    let resolveDataChannel: (dc: RTCDataChannel) => void;
    const dataChannelPromise = new Promise<RTCDataChannel>((res) => {
      resolveDataChannel = res;
    });

    pc.ondatachannel = (event) => {
      console.log('[P2P Signaling] Received data channel');
      resolveDataChannel(event.channel);
    };

    await pc.setRemoteDescription(new RTCSessionDescription(packet.payload as RTCSessionDescriptionInit));

    if (packet.iceCandidates) {
      for (const candidate of packet.iceCandidates) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    }

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    await new Promise<void>((res) => {
      const timeout = setTimeout(res, 3000);
      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          res();
        }
      };
    });

    const answerPacket: SignalingPacket & { iceCandidates: RTCIceCandidateInit[] } = {
      type: 'answer',
      peerId: this.localPeerId,
      peerName: this.localPeerName,
      payload: {
        type: 'answer',
        sdp: pc.localDescription?.sdp
      },
      iceCandidates: candidates,
      timestamp: Date.now()
    };

    const dataChannel = await dataChannelPromise;
    
    dataChannel.onopen = () => {
      console.log('[P2P Signaling] Connection established with:', packet.peerName);
      this.notifyConnected(packet.peerId, packet.peerName);
    };

    dataChannel.onmessage = (event) => {
      this.handleIncomingMessage(packet.peerId, event.data);
    };

    (window as any).__p2pConnections = (window as any).__p2pConnections || new Map();
    (window as any).__p2pConnections.set(packet.peerId, { pc, dataChannel, peerName: packet.peerName });

    return this.encodePacket(answerPacket);
  }

  async completeConnection(encodedAnswer: string): Promise<boolean> {
    console.log('[P2P Signaling] Completing connection...');
    
    const packet = this.decodePacket(encodedAnswer) as SignalingPacket & { iceCandidates?: RTCIceCandidateInit[] };
    
    const pending = (window as any).__pendingP2PConnection;
    if (!pending) {
      console.error('[P2P Signaling] No pending connection found');
      return false;
    }

    const { pc, dataChannel } = pending;

    await pc.setRemoteDescription(new RTCSessionDescription(packet.payload as RTCSessionDescriptionInit));

    if (packet.iceCandidates) {
      for (const candidate of packet.iceCandidates) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    }

    dataChannel.onmessage = (event: MessageEvent) => {
      this.handleIncomingMessage(packet.peerId, event.data);
    };

    (window as any).__p2pConnections = (window as any).__p2pConnections || new Map();
    (window as any).__p2pConnections.set(packet.peerId, { pc, dataChannel, peerName: packet.peerName });

    console.log('[P2P Signaling] Connection completed with:', packet.peerName);
    this.notifyConnected(packet.peerId, packet.peerName);
    
    delete (window as any).__pendingP2PConnection;
    
    return true;
  }

  sendMessage(peerId: string, message: any): boolean {
    const connections = (window as any).__p2pConnections;
    if (!connections) return false;

    const conn = connections.get(peerId);
    if (!conn || conn.dataChannel.readyState !== 'open') {
      console.log('[P2P Signaling] Cannot send - channel not open for:', peerId);
      return false;
    }

    try {
      conn.dataChannel.send(JSON.stringify(message));
      console.log('[P2P Signaling] Message sent to:', peerId);
      return true;
    } catch (e) {
      console.error('[P2P Signaling] Send failed:', e);
      return false;
    }
  }

  broadcastMessage(message: any): number {
    const connections = (window as any).__p2pConnections;
    if (!connections) return 0;

    let sent = 0;
    for (const [peerId] of connections) {
      if (this.sendMessage(peerId, message)) sent++;
    }
    return sent;
  }

  getConnectedPeers(): { peerId: string; peerName: string }[] {
    const connections = (window as any).__p2pConnections;
    if (!connections) return [];

    const peers: { peerId: string; peerName: string }[] = [];
    for (const [peerId, conn] of connections) {
      if (conn.dataChannel.readyState === 'open') {
        peers.push({ peerId, peerName: conn.peerName });
      }
    }
    return peers;
  }

  private handleIncomingMessage(peerId: string, data: string) {
    try {
      const message = JSON.parse(data);
      console.log('[P2P Signaling] Message received from:', peerId);
      
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('p2p-message', {
          detail: { peerId, message }
        }));
      }
    } catch (e) {
      console.error('[P2P Signaling] Failed to parse message:', e);
    }
  }

  private notifyConnected(peerId: string, peerName: string) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('p2p-connected', {
        detail: { peerId, peerName }
      }));
    }
  }

  encodePacket(packet: any): string {
    const json = JSON.stringify(packet);
    return btoa(unescape(encodeURIComponent(json)));
  }

  decodePacket(encoded: string): SignalingPacket {
    const json = decodeURIComponent(escape(atob(encoded)));
    return JSON.parse(json);
  }

  disconnect(peerId: string) {
    const connections = (window as any).__p2pConnections;
    if (!connections) return;

    const conn = connections.get(peerId);
    if (conn) {
      conn.dataChannel.close();
      conn.pc.close();
      connections.delete(peerId);
      console.log('[P2P Signaling] Disconnected from:', peerId);
    }
  }

  disconnectAll() {
    const connections = (window as any).__p2pConnections;
    if (!connections) return;

    for (const [peerId] of connections) {
      this.disconnect(peerId);
    }
  }
}

export const p2pSignalingService = new P2PSignalingService();
export default p2pSignalingService;
