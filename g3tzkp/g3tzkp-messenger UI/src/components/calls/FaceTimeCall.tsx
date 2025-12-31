import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Phone, Video, Mic, MicOff, VideoOff, PhoneOff, 
  Volume2, VolumeX, RotateCcw, Sparkles, Hash,
  MessageSquare, Users, ChevronDown, X, UserPlus
} from 'lucide-react';
import { messagingService } from '../../services/MessagingService';
import { webRTCService, CallState } from '../../services/WebRTCService';

interface FaceTimeCallProps {
  type: 'voice' | 'video';
  onClose: () => void;
  contactName?: string;
  contactAvatar?: string;
  targetPeerId?: string;
}

interface WebRTCState {
  status: 'idle' | 'connecting' | 'ringing' | 'connected' | 'error';
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  peerConnection: RTCPeerConnection | null;
}

const FaceTimeCall: React.FC<FaceTimeCallProps> = ({ 
  type, 
  onClose, 
  contactName = 'Unknown',
  contactAvatar,
  targetPeerId
}) => {
  const [rtcState, setRtcState] = useState<WebRTCState>({
    status: 'idle',
    localStream: null,
    remoteStream: null,
    peerConnection: null
  });
  const [timer, setTimer] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [pipPosition, setPipPosition] = useState({ x: 16, y: 16 });
  const [isDraggingPip, setIsDraggingPip] = useState(false);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [participants, setParticipants] = useState<Array<{ peerId: string; peerName: string }>>([]);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (localVideoRef.current && rtcState.localStream) {
      localVideoRef.current.srcObject = rtcState.localStream;
    }
  }, [rtcState.localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && rtcState.remoteStream) {
      remoteVideoRef.current.srcObject = rtcState.remoteStream;
    }
  }, [rtcState.remoteStream]);

  const serviceCleanupRef = useRef<(() => void) | null>(null);
  const stateUnsubscribeRef = useRef<(() => void) | null>(null);

  const initializeWebRTC = useCallback(async () => {
    try {
      setRtcState(prev => ({ ...prev, status: 'connecting' }));
      console.log('[FaceTimeCall] Initializing WebRTC for', type, 'call to', targetPeerId);

      const socket = messagingService.getSocket();
      if (socket) {
        const serviceCleanup = webRTCService.initialize(
          socket,
          messagingService.getLocalPeerId(),
          messagingService.getLocalPeerName()
        );
        serviceCleanupRef.current = serviceCleanup;
      }

      const unsubscribe = webRTCService.onCallStateChange((callState: CallState) => {
        console.log('[FaceTimeCall] Call state changed:', callState.status);
        
        const remoteStream = callState.participants[0]?.stream || null;
        
        setRtcState(prev => ({
          ...prev,
          status: callState.status === 'initiating' ? 'connecting' : callState.status as WebRTCState['status'],
          localStream: callState.localStream,
          remoteStream
        }));

        if (callState.participants.length > 0) {
          setParticipants(callState.participants.map(p => ({
            peerId: p.peerId,
            peerName: p.peerName
          })));
        }
      });
      stateUnsubscribeRef.current = unsubscribe;

      if (targetPeerId) {
        await webRTCService.initiateCall(targetPeerId, contactName, type);
      } else {
        const constraints: MediaStreamConstraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          },
          video: type === 'video' ? {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
            frameRate: { ideal: 30 }
          } : false
        };

        const localStream = await navigator.mediaDevices.getUserMedia(constraints);
        setRtcState(prev => ({
          ...prev,
          localStream,
          status: 'ringing'
        }));
      }

    } catch (error) {
      console.error('[FaceTimeCall] WebRTC initialization failed:', error);
      setRtcState(prev => ({ ...prev, status: 'error' }));
    }
  }, [type, targetPeerId, contactName]);

  useEffect(() => {
    initializeWebRTC();

    return () => {
      console.log('[FaceTimeCall] Cleaning up WebRTC');
      webRTCService.endCall();
      if (stateUnsubscribeRef.current) {
        stateUnsubscribeRef.current();
        stateUnsubscribeRef.current = null;
      }
      if (serviceCleanupRef.current) {
        serviceCleanupRef.current();
        serviceCleanupRef.current = null;
      }
    };
  }, [initializeWebRTC]);

  useEffect(() => {
    if (rtcState.status === 'connected') {
      const interval = setInterval(() => setTimer(t => t + 1), 1000);
      return () => clearInterval(interval);
    }
  }, [rtcState.status]);

  const toggleMute = () => {
    const isMutedNow = webRTCService.toggleMute();
    setIsMuted(isMutedNow);
  };

  const toggleVideo = () => {
    if (type === 'video') {
      const isVideoOffNow = webRTCService.toggleVideo();
      setIsVideoOff(isVideoOffNow);
    }
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
  };

  const flipCamera = async () => {
    if (type === 'video') {
      try {
        await webRTCService.flipCamera();
      } catch (error) {
        console.error('[FaceTimeCall] Failed to flip camera:', error);
      }
    }
  };

  const endCall = () => {
    webRTCService.endCall();
    onClose();
  };

  const addParticipant = async (peerId: string, peerName: string) => {
    try {
      await webRTCService.addParticipant(peerId, peerName);
      setShowAddParticipant(false);
      console.log('[FaceTimeCall] Added participant:', peerName);
    } catch (error) {
      console.error('[FaceTimeCall] Failed to add participant:', error);
    }
  };

  const formatTime = (s: number) => {
    const hours = Math.floor(s / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    const seconds = s % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getStatusText = () => {
    switch (rtcState.status) {
      case 'idle': return 'Initializing...';
      case 'connecting': return 'Connecting...';
      case 'ringing': return 'Ringing...';
      case 'connected': return formatTime(timer);
      case 'error': return 'Call Failed';
    }
  };

  const isConnected = rtcState.status === 'connected';
  const isConnecting = rtcState.status === 'connecting' || rtcState.status === 'ringing';

  const handleScreenTap = () => {
    if (type === 'video' && isConnected) {
      setShowControls(prev => !prev);
      
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      
      if (!showControls) {
        controlsTimeoutRef.current = setTimeout(() => {
          setShowControls(false);
        }, 4000);
      }
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[400] bg-black flex flex-col"
      onClick={handleScreenTap}
    >
      {type === 'video' ? (
        <>
          <div className="absolute inset-0 bg-gradient-to-b from-gray-900 to-black">
            {rtcState.remoteStream ? (
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="w-full h-full object-cover"
              />
            ) : rtcState.localStream && !isVideoOff ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center text-white text-4xl font-semibold">
                  {contactName.charAt(0).toUpperCase()}
                </div>
              </div>
            )}
          </div>

          {rtcState.localStream && !isVideoOff && rtcState.remoteStream && (
            <div 
              className="absolute w-28 h-40 sm:w-32 sm:h-44 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 cursor-move z-50"
              style={{ 
                top: pipPosition.y, 
                right: pipPosition.x,
                transform: 'scaleX(-1)'
              }}
            >
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
          )}

          <div 
            className={`absolute top-0 left-0 right-0 px-6 py-4 bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-300 ${
              showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pt-12 sm:pt-4">
              <button
                onClick={endCall}
                className="p-2 rounded-full hover:bg-white/10 transition-all"
              >
                <ChevronDown size={28} className="text-white" />
              </button>
              
              <div className="text-center">
                <h2 className="text-white text-lg font-semibold">{contactName}</h2>
                <p className="text-white/70 text-sm">
                  {isConnected ? 'FaceTime Video' : getStatusText()}
                </p>
              </div>
              
              <div className="w-10" />
            </div>
          </div>

          <div 
            className={`absolute bottom-0 left-0 right-0 px-6 py-8 bg-gradient-to-t from-black/80 to-transparent transition-opacity duration-300 ${
              showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-center gap-4 pb-8 sm:pb-4">
              <button
                onClick={flipCamera}
                className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-lg flex items-center justify-center hover:bg-white/30 transition-all"
              >
                <RotateCcw size={24} className="text-white" />
              </button>

              <button
                onClick={toggleMute}
                className={`w-14 h-14 rounded-full backdrop-blur-lg flex items-center justify-center transition-all ${
                  isMuted ? 'bg-white text-black' : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
              </button>

              <button
                onClick={endCall}
                className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-all shadow-lg"
              >
                <PhoneOff size={28} className="text-white rotate-[135deg]" />
              </button>

              <button
                onClick={toggleVideo}
                className={`w-14 h-14 rounded-full backdrop-blur-lg flex items-center justify-center transition-all ${
                  isVideoOff ? 'bg-white text-black' : 'bg-white/20 text-white hover:bg-white/30'
                }`}
              >
                {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
              </button>

              <button
                onClick={() => console.log('[FaceTimeCall] Effects feature coming soon')}
                className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-lg flex items-center justify-center hover:bg-white/30 transition-all"
                title="Effects (coming soon)"
              >
                <Sparkles size={24} className="text-white" />
              </button>
            </div>

            {isConnected && (
              <p className="text-center text-white/60 text-sm">
                {formatTime(timer)}
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-gradient-to-b from-gray-800 via-gray-900 to-black" />
          
          <div 
            className={`absolute top-0 left-0 right-0 px-6 py-4 transition-opacity duration-300 ${
              showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            <div className="flex items-center justify-between pt-12 sm:pt-4">
              <button
                onClick={endCall}
                className="p-2 rounded-full hover:bg-white/10 transition-all"
              >
                <X size={24} className="text-white" />
              </button>
              
              <div className="w-10" />
              
              <button 
                onClick={() => setShowAddParticipant(true)}
                className="p-2 rounded-full hover:bg-white/10 transition-all"
                title="Show participants"
              >
                <Users size={24} className="text-white" />
              </button>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center px-6 relative z-10">
            <div className="relative mb-8">
              {contactAvatar ? (
                <img 
                  src={contactAvatar} 
                  alt={contactName}
                  className="w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover"
                />
              ) : (
                <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                  <span className="text-white text-5xl sm:text-6xl font-semibold">
                    {contactName.charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              
              {isConnecting && (
                <div className="absolute inset-0 rounded-full border-4 border-green-400 animate-ping opacity-50" />
              )}
            </div>

            <h2 className="text-white text-2xl sm:text-3xl font-semibold mb-2">
              {contactName}
            </h2>
            
            <p className={`text-lg ${isConnected ? 'text-green-400' : 'text-white/60'}`}>
              {isConnected ? 'FaceTime Audio' : getStatusText()}
            </p>
            
            {isConnected && (
              <p className="text-white text-xl font-light mt-2">
                {formatTime(timer)}
              </p>
            )}
          </div>

          <div className="px-6 pb-12 sm:pb-8 relative z-10">
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={toggleMute}
                className={`w-16 h-16 rounded-full flex flex-col items-center justify-center transition-all ${
                  isMuted ? 'bg-white' : 'bg-white/20 backdrop-blur-lg'
                }`}
              >
                {isMuted ? (
                  <MicOff size={28} className="text-black" />
                ) : (
                  <Mic size={28} className="text-white" />
                )}
              </button>

              <button
                onClick={endCall}
                className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-600 transition-all shadow-lg"
              >
                <PhoneOff size={32} className="text-white rotate-[135deg]" />
              </button>

              <button
                onClick={toggleSpeaker}
                className={`w-16 h-16 rounded-full flex flex-col items-center justify-center transition-all ${
                  !isSpeakerOn ? 'bg-white' : 'bg-white/20 backdrop-blur-lg'
                }`}
              >
                {isSpeakerOn ? (
                  <Volume2 size={28} className="text-white" />
                ) : (
                  <VolumeX size={28} className="text-black" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-center gap-12 mt-8">
              <button 
                onClick={() => console.log('[FaceTimeCall] Keypad feature - DTMF tones')}
                className="flex flex-col items-center gap-1 hover:opacity-80 transition-opacity"
                title="Keypad for DTMF tones"
              >
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                  <Hash size={20} className="text-white" />
                </div>
                <span className="text-white/60 text-xs">Keypad</span>
              </button>
              
              <button 
                onClick={endCall}
                className="flex flex-col items-center gap-1 hover:opacity-80 transition-opacity"
                title="Send message and end call"
              >
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                  <MessageSquare size={20} className="text-white" />
                </div>
                <span className="text-white/60 text-xs">Message</span>
              </button>
              
              <button 
                onClick={() => setShowAddParticipant(true)}
                className="flex flex-col items-center gap-1"
              >
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors">
                  <UserPlus size={20} className="text-white" />
                </div>
                <span className="text-white/60 text-xs">Add</span>
              </button>
            </div>

            {participants.length > 0 && (
              <div className="mt-4 text-center">
                <p className="text-white/60 text-xs">
                  {participants.length + 1} participant{participants.length > 0 ? 's' : ''}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {showAddParticipant && (
        <AddParticipantModal
          onClose={() => setShowAddParticipant(false)}
          onAddParticipant={addParticipant}
        />
      )}
    </div>
  );
};

interface AddParticipantModalProps {
  onClose: () => void;
  onAddParticipant: (peerId: string, peerName: string) => void;
}

const AddParticipantModal: React.FC<AddParticipantModalProps> = ({ onClose, onAddParticipant }) => {
  const [availablePeers, setAvailablePeers] = useState<Array<{ peerId: string; peerName: string }>>([]);

  useEffect(() => {
    const peers = messagingService.getConnectedPeers();
    setAvailablePeers(peers.map(p => ({ peerId: p.id, peerName: p.name })));
  }, []);

  return (
    <div className="absolute inset-0 z-[450] bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center">
      <div className="w-full max-w-md bg-gray-900 rounded-t-3xl sm:rounded-3xl p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-white text-xl font-semibold">Add to Call</h3>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <X size={24} className="text-white" />
          </button>
        </div>

        {availablePeers.length === 0 ? (
          <div className="py-12 text-center">
            <Users size={48} className="text-white/20 mx-auto mb-4" />
            <p className="text-white/60">No peers available</p>
            <p className="text-white/40 text-sm mt-2">Connect with peers in the Mesh to add them to calls</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {availablePeers.map((peer) => (
              <button
                key={peer.peerId}
                onClick={() => onAddParticipant(peer.peerId, peer.peerName)}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-green-500 flex items-center justify-center">
                  <span className="text-white text-lg font-semibold">
                    {peer.peerName.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 text-left">
                  <p className="text-white font-medium">{peer.peerName}</p>
                  <p className="text-white/40 text-sm truncate">{peer.peerId.slice(0, 16)}...</p>
                </div>
                <UserPlus size={20} className="text-cyan-400" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default FaceTimeCall;
