export interface SignalingOffer {
  type: 'offer';
  peerId: string;
  publicKey: JsonWebKey;
  sdp: string;
  iceCandidates: RTCIceCandidateInit[];
}

export interface SignalingAnswer {
  type: 'answer';
  peerId: string;
  publicKey: JsonWebKey;
  sdp: string;
  iceCandidates: RTCIceCandidateInit[];
}

export type SignalingData = SignalingOffer | SignalingAnswer;

export interface ConnectionCallbacks {
  onMessage: (peerId: string, data: Uint8Array) => void;
  onConnected: (peerId: string) => void;
  onDisconnected: (peerId: string) => void;
}

class G3TZKPSignalingService {
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private pendingCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private callbacks: ConnectionCallbacks | null = null;

  private readonly rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' }
    ],
    iceCandidatePoolSize: 10
  };

  setCallbacks(callbacks: ConnectionCallbacks): void {
    this.callbacks = callbacks;
  }

  async createOffer(localPeerId: string, localPublicKey: JsonWebKey): Promise<SignalingOffer> {
    const pc = new RTCPeerConnection(this.rtcConfig);
    const tempId = 'pending_' + Date.now();
    this.peerConnections.set(tempId, pc);

    const iceCandidates: RTCIceCandidateInit[] = [];
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('ICE gathering timeout'));
      }, 30000);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          iceCandidates.push(event.candidate.toJSON());
        }
      };

      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          resolve({
            type: 'offer',
            peerId: localPeerId,
            publicKey: localPublicKey,
            sdp: pc.localDescription!.sdp,
            iceCandidates
          });
        }
      };

      const dc = pc.createDataChannel('g3tzkp', {
        ordered: true
      });
      this.setupDataChannel(dc, tempId);

      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .catch(reject);
    });
  }

  async processAnswer(
    answer: SignalingAnswer,
    localPeerId: string
  ): Promise<void> {
    const tempId = Array.from(this.peerConnections.keys()).find(k => k.startsWith('pending_'));
    if (!tempId) throw new Error('No pending connection found');

    const pc = this.peerConnections.get(tempId)!;
    
    this.peerConnections.delete(tempId);
    this.peerConnections.set(answer.peerId, pc);

    const dc = this.dataChannels.get(tempId);
    if (dc) {
      this.dataChannels.delete(tempId);
      this.dataChannels.set(answer.peerId, dc);
    }

    await pc.setRemoteDescription({
      type: 'answer',
      sdp: answer.sdp
    });

    for (const candidate of answer.iceCandidates) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }

    this.setupConnectionHandlers(pc, answer.peerId);
    console.log('[G3TZKPSignaling] Connection established with:', answer.peerId);
  }

  async createAnswer(
    offer: SignalingOffer,
    localPeerId: string,
    localPublicKey: JsonWebKey
  ): Promise<SignalingAnswer> {
    const pc = new RTCPeerConnection(this.rtcConfig);
    this.peerConnections.set(offer.peerId, pc);

    const iceCandidates: RTCIceCandidateInit[] = [];

    pc.ondatachannel = (event) => {
      this.setupDataChannel(event.channel, offer.peerId);
      this.dataChannels.set(offer.peerId, event.channel);
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('ICE gathering timeout'));
      }, 30000);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          iceCandidates.push(event.candidate.toJSON());
        }
      };

      pc.onicegatheringstatechange = () => {
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          this.setupConnectionHandlers(pc, offer.peerId);
          resolve({
            type: 'answer',
            peerId: localPeerId,
            publicKey: localPublicKey,
            sdp: pc.localDescription!.sdp,
            iceCandidates
          });
        }
      };

      pc.setRemoteDescription({
        type: 'offer',
        sdp: offer.sdp
      })
        .then(() => {
          for (const candidate of offer.iceCandidates) {
            pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
          return pc.createAnswer();
        })
        .then(answer => pc.setLocalDescription(answer))
        .catch(reject);
    });
  }

  private setupDataChannel(dc: RTCDataChannel, peerId: string): void {
    dc.binaryType = 'arraybuffer';

    dc.onopen = () => {
      console.log('[G3TZKPSignaling] DataChannel open with:', peerId);
      this.dataChannels.set(peerId, dc);
      this.callbacks?.onConnected(peerId);
    };

    dc.onclose = () => {
      console.log('[G3TZKPSignaling] DataChannel closed with:', peerId);
      this.dataChannels.delete(peerId);
      this.callbacks?.onDisconnected(peerId);
    };

    dc.onerror = (event) => {
      console.error('[G3TZKPSignaling] DataChannel error with:', peerId, event);
    };

    dc.onmessage = (event) => {
      const data = event.data instanceof ArrayBuffer 
        ? new Uint8Array(event.data)
        : new TextEncoder().encode(event.data);
      this.callbacks?.onMessage(peerId, data);
    };
  }

  private setupConnectionHandlers(pc: RTCPeerConnection, peerId: string): void {
    pc.onconnectionstatechange = () => {
      console.log('[G3TZKPSignaling] Connection state:', peerId, pc.connectionState);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        this.callbacks?.onDisconnected(peerId);
        this.peerConnections.delete(peerId);
        this.dataChannels.delete(peerId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[G3TZKPSignaling] ICE state:', peerId, pc.iceConnectionState);
    };
  }

  send(peerId: string, data: Uint8Array): boolean {
    const dc = this.dataChannels.get(peerId);
    if (!dc || dc.readyState !== 'open') {
      console.warn('[G3TZKPSignaling] Cannot send to:', peerId, 'channel state:', dc?.readyState);
      return false;
    }

    try {
      dc.send(data);
      return true;
    } catch (e) {
      console.error('[G3TZKPSignaling] Send error:', e);
      return false;
    }
  }

  isConnected(peerId: string): boolean {
    const dc = this.dataChannels.get(peerId);
    return dc?.readyState === 'open';
  }

  getConnectedPeers(): string[] {
    return Array.from(this.dataChannels.entries())
      .filter(([_, dc]) => dc.readyState === 'open')
      .map(([peerId]) => peerId);
  }

  disconnect(peerId: string): void {
    const dc = this.dataChannels.get(peerId);
    if (dc) {
      dc.close();
      this.dataChannels.delete(peerId);
    }

    const pc = this.peerConnections.get(peerId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(peerId);
    }
  }

  disconnectAll(): void {
    for (const peerId of this.peerConnections.keys()) {
      this.disconnect(peerId);
    }
  }

  encodeForQR(data: SignalingData): string {
    const json = JSON.stringify(data);
    return btoa(json);
  }

  decodeFromQR(encoded: string): SignalingData {
    const json = atob(encoded);
    return JSON.parse(json);
  }

  compressForQR(data: SignalingData): string {
    const minimal = {
      t: data.type === 'offer' ? 'o' : 'a',
      p: data.peerId,
      k: data.publicKey,
      s: data.sdp,
      i: data.iceCandidates.map(c => ({
        c: c.candidate,
        m: c.sdpMid,
        l: c.sdpMLineIndex
      }))
    };
    return btoa(JSON.stringify(minimal));
  }

  decompressFromQR(encoded: string): SignalingData {
    const minimal = JSON.parse(atob(encoded));
    return {
      type: minimal.t === 'o' ? 'offer' : 'answer',
      peerId: minimal.p,
      publicKey: minimal.k,
      sdp: minimal.s,
      iceCandidates: minimal.i.map((c: { c: string; m: string; l: number }) => ({
        candidate: c.c,
        sdpMid: c.m,
        sdpMLineIndex: c.l
      }))
    };
  }
}

export const g3tzkpSignaling = new G3TZKPSignalingService();
