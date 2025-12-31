import { io, Socket } from 'socket.io-client';

export interface CallParticipant {
  peerId: string;
  peerName: string;
  stream?: MediaStream;
  connection?: RTCPeerConnection;
}

export interface CallState {
  callId: string;
  callType: 'voice' | 'video';
  status: 'idle' | 'initiating' | 'ringing' | 'connecting' | 'connected' | 'ended' | 'error';
  participants: CallParticipant[];
  localStream: MediaStream | null;
  error?: string;
}

export type CallEventHandler = (state: CallState) => void;
export type IncomingCallHandler = (callId: string, callType: 'voice' | 'video', fromPeerId: string, fromPeerName: string) => void;

const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' }
];

class WebRTCService {
  private socket: Socket | null = null;
  private localPeerId: string = '';
  private localPeerName: string = '';
  private currentCall: CallState | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private pendingIceCandidates: Map<string, RTCIceCandidateInit[]> = new Map();
  private callStateHandlers: Set<CallEventHandler> = new Set();
  private incomingCallHandlers: Set<IncomingCallHandler> = new Set();
  private incomingOffer: RTCSessionDescriptionInit | null = null;
  private isInitialized: boolean = false;
  private cleanupListeners: (() => void) | null = null;

  initialize(socket: Socket, localPeerId: string, localPeerName: string): () => void {
    if (this.isInitialized && this.socket === socket) {
      console.log('[WebRTC] Already initialized, skipping duplicate setup');
      return this.cleanupListeners || (() => {});
    }

    if (this.cleanupListeners) {
      this.cleanupListeners();
    }

    this.socket = socket;
    this.localPeerId = localPeerId;
    this.localPeerName = localPeerName;
    this.cleanupListeners = this.setupSocketListeners();
    this.isInitialized = true;
    console.log('[WebRTC] Service initialized for peer:', localPeerId);
    
    return this.cleanupListeners;
  }

  private setupSocketListeners(): () => void {
    if (!this.socket) return () => {};

    const socket = this.socket;

    const handleIncomingCall = (data: {
      callId: string;
      callType: 'voice' | 'video';
      fromPeerId: string;
      fromPeerName: string;
      offer: RTCSessionDescriptionInit;
    }) => {
      console.log('[WebRTC] Incoming call from', data.fromPeerName);
      this.incomingOffer = data.offer;
      this.incomingCallHandlers.forEach(handler => 
        handler(data.callId, data.callType, data.fromPeerId, data.fromPeerName)
      );
    };

    const handleCallRinging = (data: { callId: string; targetPeerId: string }) => {
      console.log('[WebRTC] Call ringing:', data.callId);
      if (this.currentCall && this.currentCall.callId === data.callId) {
        this.currentCall.status = 'ringing';
        this.notifyStateChange();
      }
    };

    const handleCallAccepted = async (data: {
      callId: string;
      fromPeerId: string;
      fromPeerName: string;
      answer: RTCSessionDescriptionInit;
    }) => {
      console.log('[WebRTC] Call accepted by', data.fromPeerName);
      const pc = this.peerConnections.get(data.fromPeerId);
      if (pc && data.answer) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          console.log('[WebRTC] Remote description set');
          
          const pending = this.pendingIceCandidates.get(data.fromPeerId) || [];
          for (const candidate of pending) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
          this.pendingIceCandidates.delete(data.fromPeerId);
        } catch (error) {
          console.error('[WebRTC] Error setting remote description:', error);
        }
      }
    };

    const handleCallRejected = (data: { callId: string; fromPeerId: string; reason: string }) => {
      console.log('[WebRTC] Call rejected:', data.reason);
      this.endCall();
      if (this.currentCall) {
        this.currentCall.status = 'ended';
        this.currentCall.error = data.reason;
        this.notifyStateChange();
      }
    };

    const handleCallEnded = (data: { callId: string; fromPeerId: string }) => {
      console.log('[WebRTC] Call ended by remote peer');
      this.endCall();
    };

    const handleCallError = (data: { callId: string; error: string }) => {
      console.error('[WebRTC] Call error:', data.error);
      if (this.currentCall) {
        this.currentCall.status = 'error';
        this.currentCall.error = data.error;
        this.notifyStateChange();
      }
    };

    const handleIceCandidate = async (data: {
      callId: string;
      candidate: RTCIceCandidateInit;
      fromPeerId: string;
    }) => {
      console.log('[WebRTC] Received ICE candidate from', data.fromPeerId);
      const pc = this.peerConnections.get(data.fromPeerId);
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (error) {
          console.error('[WebRTC] Error adding ICE candidate:', error);
        }
      } else {
        if (!this.pendingIceCandidates.has(data.fromPeerId)) {
          this.pendingIceCandidates.set(data.fromPeerId, []);
        }
        this.pendingIceCandidates.get(data.fromPeerId)!.push(data.candidate);
      }
    };

    socket.on('call_incoming', handleIncomingCall);
    socket.on('call_ringing', handleCallRinging);
    socket.on('call_accepted', handleCallAccepted);
    socket.on('call_rejected', handleCallRejected);
    socket.on('call_ended', handleCallEnded);
    socket.on('call_error', handleCallError);
    socket.on('ice_candidate', handleIceCandidate);

    return () => {
      socket.off('call_incoming', handleIncomingCall);
      socket.off('call_ringing', handleCallRinging);
      socket.off('call_accepted', handleCallAccepted);
      socket.off('call_rejected', handleCallRejected);
      socket.off('call_ended', handleCallEnded);
      socket.off('call_error', handleCallError);
      socket.off('ice_candidate', handleIceCandidate);
      this.isInitialized = false;
      this.cleanupListeners = null;
      console.log('[WebRTC] Socket listeners cleaned up');
    };
  }

  async initiateCall(targetPeerId: string, targetPeerName: string, callType: 'voice' | 'video'): Promise<CallState> {
    if (!this.socket) {
      throw new Error('WebRTC service not initialized');
    }

    const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.currentCall = {
      callId,
      callType,
      status: 'initiating',
      participants: [{
        peerId: targetPeerId,
        peerName: targetPeerName
      }],
      localStream: null
    };

    try {
      const localStream = await this.getLocalStream(callType);
      this.currentCall.localStream = localStream;

      const pc = this.createPeerConnection(targetPeerId, localStream);
      this.peerConnections.set(targetPeerId, pc);

      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: callType === 'video'
      });
      await pc.setLocalDescription(offer);

      this.socket.emit('call_initiate', {
        callId,
        callType,
        targetPeerId,
        offer: pc.localDescription
      });

      this.notifyStateChange();
      return this.currentCall;

    } catch (error) {
      this.currentCall.status = 'error';
      this.currentCall.error = error instanceof Error ? error.message : 'Failed to initiate call';
      this.notifyStateChange();
      throw error;
    }
  }

  async acceptCall(callId: string, fromPeerId: string, callType: 'voice' | 'video'): Promise<CallState> {
    if (!this.socket || !this.incomingOffer) {
      throw new Error('No incoming call to accept');
    }

    this.currentCall = {
      callId,
      callType,
      status: 'connecting',
      participants: [{ peerId: fromPeerId, peerName: 'Remote Peer' }],
      localStream: null
    };

    try {
      const localStream = await this.getLocalStream(callType);
      this.currentCall.localStream = localStream;

      const pc = this.createPeerConnection(fromPeerId, localStream);
      this.peerConnections.set(fromPeerId, pc);

      await pc.setRemoteDescription(new RTCSessionDescription(this.incomingOffer));
      
      const pending = this.pendingIceCandidates.get(fromPeerId) || [];
      for (const candidate of pending) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      this.pendingIceCandidates.delete(fromPeerId);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      this.socket.emit('call_accept', {
        callId,
        targetPeerId: fromPeerId,
        answer: pc.localDescription
      });

      this.incomingOffer = null;
      this.notifyStateChange();
      return this.currentCall;

    } catch (error) {
      this.currentCall.status = 'error';
      this.currentCall.error = error instanceof Error ? error.message : 'Failed to accept call';
      this.notifyStateChange();
      throw error;
    }
  }

  rejectCall(callId: string, fromPeerId: string, reason: string = 'User declined'): void {
    if (this.socket) {
      this.socket.emit('call_reject', { callId, targetPeerId: fromPeerId, reason });
    }
    this.incomingOffer = null;
  }

  endCall(): void {
    if (this.currentCall && this.socket) {
      this.currentCall.participants.forEach(p => {
        this.socket!.emit('call_end', {
          callId: this.currentCall!.callId,
          targetPeerId: p.peerId
        });
      });
    }

    this.peerConnections.forEach((pc, peerId) => {
      pc.close();
    });
    this.peerConnections.clear();

    if (this.currentCall?.localStream) {
      this.currentCall.localStream.getTracks().forEach(track => track.stop());
    }

    if (this.currentCall) {
      this.currentCall.status = 'ended';
      this.notifyStateChange();
    }
    
    this.currentCall = null;
    this.incomingOffer = null;
  }

  async addParticipant(peerId: string, peerName: string): Promise<void> {
    if (!this.currentCall || !this.socket || !this.currentCall.localStream) {
      throw new Error('No active call');
    }

    const pc = this.createPeerConnection(peerId, this.currentCall.localStream);
    this.peerConnections.set(peerId, pc);

    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: this.currentCall.callType === 'video'
    });
    await pc.setLocalDescription(offer);

    this.socket.emit('call_initiate', {
      callId: this.currentCall.callId,
      callType: this.currentCall.callType,
      targetPeerId: peerId,
      offer: pc.localDescription
    });

    this.currentCall.participants.push({
      peerId,
      peerName,
      connection: pc
    });

    this.notifyStateChange();
  }

  private async getLocalStream(callType: 'voice' | 'video'): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      },
      video: callType === 'video' ? {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user',
        frameRate: { ideal: 30 }
      } : false
    };

    return navigator.mediaDevices.getUserMedia(constraints);
  }

  private createPeerConnection(peerId: string, localStream: MediaStream): RTCPeerConnection {
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10
    });

    localStream.getTracks().forEach(track => {
      pc.addTrack(track, localStream);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && this.socket && this.currentCall) {
        this.socket.emit('ice_candidate', {
          callId: this.currentCall.callId,
          targetPeerId: peerId,
          candidate: event.candidate.toJSON()
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('[WebRTC] Received remote track');
      if (this.currentCall) {
        const participant = this.currentCall.participants.find(p => p.peerId === peerId);
        if (participant && event.streams[0]) {
          participant.stream = event.streams[0];
          this.notifyStateChange();
        }
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE connection state:', pc.iceConnectionState);
      if (this.currentCall) {
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          this.currentCall.status = 'connected';
          this.notifyStateChange();
        } else if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
          this.currentCall.status = 'error';
          this.currentCall.error = 'Connection lost';
          this.notifyStateChange();
        }
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', pc.connectionState);
    };

    return pc;
  }

  toggleMute(): boolean {
    if (this.currentCall?.localStream) {
      const audioTracks = this.currentCall.localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      return !audioTracks[0]?.enabled;
    }
    return false;
  }

  toggleVideo(): boolean {
    if (this.currentCall?.localStream) {
      const videoTracks = this.currentCall.localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      return !videoTracks[0]?.enabled;
    }
    return false;
  }

  async flipCamera(): Promise<void> {
    if (!this.currentCall?.localStream || this.currentCall.callType !== 'video') return;

    const videoTrack = this.currentCall.localStream.getVideoTracks()[0];
    if (!videoTrack) return;

    const settings = videoTrack.getSettings();
    const newFacingMode = settings.facingMode === 'user' ? 'environment' : 'user';

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: newFacingMode }
      });

      const newVideoTrack = newStream.getVideoTracks()[0];

      this.peerConnections.forEach((pc) => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(newVideoTrack);
        }
      });

      videoTrack.stop();
      
      const oldStream = this.currentCall.localStream;
      const audioTracks = oldStream.getAudioTracks();
      
      const combinedStream = new MediaStream([...audioTracks, newVideoTrack]);
      this.currentCall.localStream = combinedStream;
      
      this.notifyStateChange();
    } catch (error) {
      console.error('[WebRTC] Failed to flip camera:', error);
    }
  }

  getCurrentCall(): CallState | null {
    return this.currentCall;
  }

  onCallStateChange(handler: CallEventHandler): () => void {
    this.callStateHandlers.add(handler);
    return () => this.callStateHandlers.delete(handler);
  }

  onIncomingCall(handler: IncomingCallHandler): () => void {
    this.incomingCallHandlers.add(handler);
    return () => this.incomingCallHandlers.delete(handler);
  }

  private notifyStateChange(): void {
    if (this.currentCall) {
      const state = { ...this.currentCall };
      this.callStateHandlers.forEach(handler => handler(state));
    }
  }

  disconnect(): void {
    this.endCall();
    this.callStateHandlers.clear();
    this.incomingCallHandlers.clear();
  }
}

export const webRTCService = new WebRTCService();
