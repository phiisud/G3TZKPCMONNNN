import { CallSession } from '../types/peer';

interface RTCCallSession {
  session: CallSession;
  peerConnection: RTCPeerConnection;
  localStream?: MediaStream;
  remoteStream?: MediaStream;
  dataChannel?: RTCDataChannel;
}

type StreamHandler = (stream: MediaStream) => void;
type CallStateHandler = (sessionId: string, state: RTCPeerConnectionState) => void;

class WebRTCCallingService {
  private rtcSessions: Map<string, RTCCallSession> = new Map();
  private iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ];
  
  private remoteStreamHandlers: Set<StreamHandler> = new Set();
  private callStateHandlers: Set<CallStateHandler> = new Set();

  async startCall(session: CallSession, isVideoCall: boolean): Promise<RTCSessionDescriptionInit> {
    const peerConnection = new RTCPeerConnection({ iceServers: this.iceServers });
    
    const localStream = await this.getLocalMediaStream(isVideoCall);
    
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    const dataChannel = peerConnection.createDataChannel('g3tzkp-call', { ordered: true });
    this.setupDataChannel(dataChannel, session.sessionId);

    const rtcSession: RTCCallSession = {
      session,
      peerConnection,
      localStream,
      dataChannel
    };

    this.setupPeerConnectionHandlers(rtcSession);
    this.rtcSessions.set(session.sessionId, rtcSession);

    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: isVideoCall
    });
    
    await peerConnection.setLocalDescription(offer);

    return offer;
  }

  async answerCall(session: CallSession, offer: RTCSessionDescriptionInit, isVideoCall: boolean): Promise<RTCSessionDescriptionInit> {
    const peerConnection = new RTCPeerConnection({ iceServers: this.iceServers });
    
    const localStream = await this.getLocalMediaStream(isVideoCall);
    
    localStream.getTracks().forEach(track => {
      peerConnection.addTrack(track, localStream);
    });

    const rtcSession: RTCCallSession = {
      session,
      peerConnection,
      localStream
    };

    this.setupPeerConnectionHandlers(rtcSession);
    this.rtcSessions.set(session.sessionId, rtcSession);

    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    return answer;
  }

  async addAnswer(sessionId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const rtcSession = this.rtcSessions.get(sessionId);
    if (!rtcSession) {
      throw new Error('RTC session not found');
    }

    await rtcSession.peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }

  async addIceCandidate(sessionId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const rtcSession = this.rtcSessions.get(sessionId);
    if (!rtcSession) {
      throw new Error('RTC session not found');
    }

    try {
      await rtcSession.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Failed to add ICE candidate:', error);
    }
  }

  async toggleAudio(sessionId: string, enabled: boolean): Promise<void> {
    const rtcSession = this.rtcSessions.get(sessionId);
    if (!rtcSession?.localStream) return;

    rtcSession.localStream.getAudioTracks().forEach(track => {
      track.enabled = enabled;
    });
  }

  async toggleVideo(sessionId: string, enabled: boolean): Promise<void> {
    const rtcSession = this.rtcSessions.get(sessionId);
    if (!rtcSession?.localStream) return;

    rtcSession.localStream.getVideoTracks().forEach(track => {
      track.enabled = enabled;
    });
  }

  async endCall(sessionId: string): Promise<void> {
    const rtcSession = this.rtcSessions.get(sessionId);
    if (!rtcSession) return;

    if (rtcSession.localStream) {
      rtcSession.localStream.getTracks().forEach(track => track.stop());
    }

    if (rtcSession.remoteStream) {
      rtcSession.remoteStream.getTracks().forEach(track => track.stop());
    }

    if (rtcSession.dataChannel) {
      rtcSession.dataChannel.close();
    }

    rtcSession.peerConnection.close();
    this.rtcSessions.delete(sessionId);
  }

  getLocalStream(sessionId: string): MediaStream | undefined {
    return this.rtcSessions.get(sessionId)?.localStream;
  }

  getRemoteStream(sessionId: string): MediaStream | undefined {
    return this.rtcSessions.get(sessionId)?.remoteStream;
  }

  onRemoteStream(handler: StreamHandler): () => void {
    this.remoteStreamHandlers.add(handler);
    return () => this.remoteStreamHandlers.delete(handler);
  }

  onCallStateChange(handler: CallStateHandler): () => void {
    this.callStateHandlers.add(handler);
    return () => this.callStateHandlers.delete(handler);
  }

  private async getLocalMediaStream(isVideoCall: boolean): Promise<MediaStream> {
    try {
      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: isVideoCall ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } : false
      };

      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      console.error('Failed to get local media stream:', error);
      throw new Error('Failed to access camera/microphone');
    }
  }

  private setupPeerConnectionHandlers(rtcSession: RTCCallSession): void {
    const { peerConnection, session } = rtcSession;

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.handleIceCandidate(session.sessionId, event.candidate);
      }
    };

    peerConnection.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        rtcSession.remoteStream = event.streams[0];
        this.notifyRemoteStream(event.streams[0]);
      }
    };

    peerConnection.onconnectionstatechange = () => {
      this.notifyCallStateChange(session.sessionId, peerConnection.connectionState);
      
      if (peerConnection.connectionState === 'disconnected' || 
          peerConnection.connectionState === 'failed' ||
          peerConnection.connectionState === 'closed') {
        this.endCall(session.sessionId);
      }
    };

    peerConnection.ondatachannel = (event) => {
      this.setupDataChannel(event.channel, session.sessionId);
    };
  }

  private setupDataChannel(dataChannel: RTCDataChannel, sessionId: string): void {
    dataChannel.onopen = () => {
      console.log('[WebRTC] Data channel opened for session:', sessionId);
    };

    dataChannel.onmessage = (event) => {
      console.log('[WebRTC] Data channel message:', event.data);
    };

    dataChannel.onerror = (error) => {
      console.error('[WebRTC] Data channel error:', error);
    };
  }

  private async handleIceCandidate(sessionId: string, candidate: RTCIceCandidate): Promise<void> {
    try {
      const { g3tzkpService } = await import('./G3TZKPService');
      const rtcSession = this.rtcSessions.get(sessionId);
      if (!rtcSession) return;

      const iceMessage = {
        type: 'ICE_CANDIDATE',
        sessionId,
        candidate: candidate.toJSON(),
        timestamp: Date.now()
      };

      const recipientId = rtcSession.session.recipientId;
      await g3tzkpService.sendMessage(recipientId, JSON.stringify(iceMessage), 'TEXT');
    } catch (error) {
      console.error('Failed to send ICE candidate:', error);
    }
  }

  private notifyRemoteStream(stream: MediaStream): void {
    this.remoteStreamHandlers.forEach(handler => handler(stream));
  }

  private notifyCallStateChange(sessionId: string, state: RTCPeerConnectionState): void {
    this.callStateHandlers.forEach(handler => handler(sessionId, state));
  }
}

export const webRTCCallingService = new WebRTCCallingService();
