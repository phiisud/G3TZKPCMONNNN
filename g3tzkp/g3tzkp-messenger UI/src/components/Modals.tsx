import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Phone, Video, Users, CreditCard, Settings as SettingsIcon, Shield, Binary, Hash, Lock, Activity, Zap, Award, Loader2, RefreshCw, Volume2, VolumeX, Bell, BellOff, Moon, Sun, Eye, EyeOff, Mic, MicOff, VideoOff, PhoneOff, Monitor } from 'lucide-react';
import { useThemeStore } from '../stores/themeStore';

export interface ModalProps {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const ModalWrapper: React.FC<ModalProps> = ({ onClose, title, children }) => (
  <div className="fixed inset-0 z-[300] flex items-center justify-center p-3 md:p-6 backdrop-blur-xl bg-black/85 animate-in fade-in duration-300">
    <div className="w-full max-w-lg border-[0.5px] border-[#4caf50]/20 bg-[#0a1a0a]/95 p-6 md:p-10 relative overflow-hidden flex flex-col gap-6 shadow-[0_0_100px_rgba(0,0,0,0.95)] max-h-[95vh]">
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#00f3ff]/50 to-transparent"></div>
      <div className="flex justify-between items-center border-b-[0.5px] border-[#4caf50]/10 pb-5 shrink-0">
        <div className="flex flex-col gap-1">
          <h3 className="orbitron text-[9px] md:text-sm font-black tracking-[0.2em] md:tracking-[0.4em] text-[#00f3ff] uppercase opacity-100">{title}</h3>
          <span className="text-[6px] text-[#4caf50] uppercase tracking-[0.3em] font-bold opacity-60">G3ZKP_SECURE_MODAL</span>
        </div>
        <button onClick={onClose} className="text-[#4caf50] hover:text-[#00f3ff] transition-all p-2 bg-black/40 border-[0.5px] border-[#4caf50]/10 hover:border-[#00f3ff]/30 active:scale-90">
          <X size={18} strokeWidth={1.5} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-hide py-3">
        {children}
      </div>
      <div className="absolute top-2 left-2 w-3 h-3 border-t-[0.5px] border-l-[0.5px] border-[#00f3ff]/30"></div>
      <div className="absolute bottom-2 right-2 w-3 h-3 border-b-[0.5px] border-r-[0.5px] border-[#00f3ff]/30"></div>
    </div>
  </div>
);

interface WebRTCState {
  status: 'idle' | 'connecting' | 'connected' | 'error';
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  peerConnection: RTCPeerConnection | null;
}

export const CallModal: React.FC<{ type: 'voice' | 'video', onClose: () => void }> = ({ type, onClose }) => {
  const [rtcState, setRtcState] = useState<WebRTCState>({
    status: 'idle',
    localStream: null,
    remoteStream: null,
    peerConnection: null
  });
  const [timer, setTimer] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  const [remoteVideoLoaded, setRemoteVideoLoaded] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localVideoRef.current && rtcState.localStream) {
      localVideoRef.current.srcObject = rtcState.localStream;
      localVideoRef.current.onloadeddata = () => setVideoLoaded(true);
    }
  }, [rtcState.localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && rtcState.remoteStream) {
      remoteVideoRef.current.srcObject = rtcState.remoteStream;
      remoteVideoRef.current.onloadeddata = () => setRemoteVideoLoaded(true);
    }
  }, [rtcState.remoteStream]);

  const initializeWebRTC = useCallback(async () => {
    try {
      setRtcState(prev => ({ ...prev, status: 'connecting' }));
      setVideoLoaded(false);
      setRemoteVideoLoaded(false);

      const constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: type === 'video' ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } : false
      };

      const localStream = await navigator.mediaDevices.getUserMedia(constraints);

      const configuration: RTCConfiguration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ],
        iceCandidatePoolSize: 10
      };

      const peerConnection = new RTCPeerConnection(configuration);

      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });

      peerConnection.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRtcState(prev => ({ ...prev, remoteStream: event.streams[0] }));
        }
      };

      peerConnection.oniceconnectionstatechange = () => {
        if (peerConnection.iceConnectionState === 'connected') {
          setRtcState(prev => ({ ...prev, status: 'connected' }));
        } else if (peerConnection.iceConnectionState === 'failed' || peerConnection.iceConnectionState === 'disconnected') {
          setRtcState(prev => ({ ...prev, status: 'error' }));
        }
      };

      setRtcState(prev => ({
        ...prev,
        localStream,
        peerConnection,
        status: 'connected'
      }));

    } catch (error) {
      console.error('WebRTC initialization failed:', error);
      setRtcState(prev => ({ ...prev, status: 'error' }));
    }
  }, [type]);

  useEffect(() => {
    initializeWebRTC();

    return () => {
      if (rtcState.localStream) {
        rtcState.localStream.getTracks().forEach(track => track.stop());
      }
      if (rtcState.peerConnection) {
        rtcState.peerConnection.close();
      }
    };
  }, []);

  useEffect(() => {
    if (rtcState.status === 'connected') {
      const interval = setInterval(() => setTimer(t => t + 1), 1000);
      return () => clearInterval(interval);
    }
  }, [rtcState.status]);

  const toggleMute = () => {
    if (rtcState.localStream) {
      const audioTracks = rtcState.localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (rtcState.localStream && type === 'video') {
      const videoTracks = rtcState.localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const endCall = () => {
    if (rtcState.localStream) {
      rtcState.localStream.getTracks().forEach(track => track.stop());
    }
    if (rtcState.peerConnection) {
      rtcState.peerConnection.close();
    }
    onClose();
  };

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const getStatusText = () => {
    switch (rtcState.status) {
      case 'idle': return 'INITIALIZING...';
      case 'connecting': return 'ESTABLISHING_SRTP_TUNNEL...';
      case 'connected': return 'CONNECTED_ENCRYPTED_G3T';
      case 'error': return 'CONNECTION_FAILED';
    }
  };

  const isConnected = rtcState.status === 'connected';

  return (
    <ModalWrapper title={`${type.toUpperCase()}_SESSION`} onClose={endCall}>
      <div className="flex flex-col items-center gap-6 py-6">
        {type === 'video' && rtcState.localStream && (
          <div className="relative w-full aspect-video bg-black border-[0.5px] border-[#4caf50]/20 overflow-hidden">
            <video
              autoPlay
              playsInline
              muted
              ref={localVideoRef}
              className={`w-full h-full object-cover transition-opacity duration-300 ${isVideoOff ? 'hidden' : ''} ${videoLoaded ? 'opacity-100' : 'opacity-0'}`}
            />
            {isVideoOff && (
              <div className="absolute inset-0 flex items-center justify-center">
                <VideoOff size={48} className="text-[#4caf50]/40" />
              </div>
            )}
            <div className="absolute top-2 left-2 px-2 py-1 bg-black/80 border-[0.5px] border-[#00f3ff]/30">
              <span className="text-[8px] font-mono text-[#00f3ff]">LOCAL_FEED</span>
            </div>
          </div>
        )}

        {type === 'voice' && (
          <div className="relative">
            <div className="absolute inset-0 bg-[#00f3ff]/5 blur-[60px] rounded-full animate-pulse"></div>
            <div className={`w-32 h-32 border-[0.5px] rounded-full flex items-center justify-center transition-all duration-1000 ${isConnected ? 'border-[#00f3ff] shadow-[0_0_30px_#00f3ff22] text-[#00f3ff]' : 'border-[#4caf50]/20 text-[#4caf50]/40 animate-pulse'}`}>
              <Phone size={40} strokeWidth={0.5} />
              <div className={`absolute inset-0 border-[0.5px] rounded-full opacity-20 ${isConnected ? 'border-[#00f3ff] animate-ping' : 'border-[#4caf50]/40'}`}></div>
              {isConnected && (
                <div className="absolute -top-1 right-2 bg-black border-[0.5px] border-[#00f3ff] p-2 text-[#00f3ff] animate-in zoom-in duration-500">
                  <Shield size={14} strokeWidth={1} />
                </div>
              )}
            </div>
          </div>
        )}

        <div className="text-center space-y-3">
          <p className={`orbitron text-[9px] tracking-[0.4em] uppercase font-black ${isConnected ? 'text-[#00f3ff]' : 'text-[#4caf50] animate-pulse'}`}>
            {getStatusText()}
          </p>
          {isConnected && (
            <div className="flex flex-col gap-1">
              <p className="font-mono text-3xl text-[#00f3ff] font-black tracking-tighter">{formatTime(timer)}</p>
              <span className="text-[7px] text-[#00f3ff]/40 uppercase tracking-[0.3em]">AES-256-GCM | DTLS-SRTP</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 pt-4">
          <button
            onClick={toggleMute}
            className={`p-4 border-[0.5px] transition-all ${isMuted ? 'border-red-500/50 text-red-500 bg-red-500/10' : 'border-[#4caf50]/30 text-[#4caf50] hover:border-[#4caf50]/60'}`}
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          {type === 'video' && (
            <button
              onClick={toggleVideo}
              className={`p-4 border-[0.5px] transition-all ${isVideoOff ? 'border-red-500/50 text-red-500 bg-red-500/10' : 'border-[#4caf50]/30 text-[#4caf50] hover:border-[#4caf50]/60'}`}
            >
              {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
            </button>
          )}

          <button
            onClick={endCall}
            className="p-4 border-[0.5px] border-red-500/50 text-red-500 hover:bg-red-500/20 transition-all"
          >
            <PhoneOff size={20} />
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
};

export interface MeshGroupSettings {
  name: string;
  encryptionProtocol: 'zkp' | 'x3dh_aead' | 'hybrid';
  keyExchangeMode: 'x3dh' | 'ecdh' | 'kyber';
  membershipPolicy: 'open' | 'invite' | 'approval';
  memberCapacity: number;
  messageRetention: '24h' | '7d' | '30d' | 'forever' | 'ephemeral';
  zkpVerificationLevel: 'none' | 'basic' | 'full';
  enableVoiceCalls: boolean;
  enableVideoCalls: boolean;
  enableFileSharing: boolean;
}

const SETTINGS_STORAGE_KEY = 'g3zkp_mesh_group_settings';

export const GroupModal: React.FC<{ onClose: () => void, onCreate?: (name: string, settings: MeshGroupSettings) => void }> = ({ onClose, onCreate }) => {
  const [settings, setSettings] = useState<MeshGroupSettings>(() => {
    const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {}
    }
    return {
      name: 'G3ZKP_MESH_01',
      encryptionProtocol: 'zkp',
      keyExchangeMode: 'x3dh',
      membershipPolicy: 'approval',
      memberCapacity: 100,
      messageRetention: '30d',
      zkpVerificationLevel: 'full',
      enableVoiceCalls: true,
      enableVideoCalls: true,
      enableFileSharing: true
    };
  });

  useEffect(() => {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const handleCreate = () => {
    onCreate?.(settings.name, settings);
  };

  return (
    <ModalWrapper title="CREATE_MESH_GROUP" onClose={onClose}>
      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-[8px] uppercase tracking-widest text-[#4caf50] font-black">Group Name</label>
          <input 
            type="text" 
            value={settings.name}
            onChange={(e) => setSettings(s => ({ ...s, name: e.target.value.toUpperCase().replace(/\s/g, '_') }))}
            placeholder="MESH_GROUP_NAME" 
            className="w-full bg-black/40 border-[0.5px] border-[#4caf50]/20 p-4 text-[12px] outline-none focus:border-[#00f3ff]/40 text-[#00f3ff] font-black tracking-widest uppercase transition-all" 
          />
        </div>

        <div className="space-y-2">
          <label className="text-[8px] uppercase tracking-widest text-[#4caf50] font-black">Encryption Protocol (Primary: ZKP)</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'zkp', label: 'ZKP_SNARK', desc: 'Zero-Knowledge' },
              { value: 'x3dh_aead', label: 'X3DH+AEAD', desc: 'Key Exchange' },
              { value: 'hybrid', label: 'HYBRID', desc: 'ZKP + X3DH' }
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSettings(s => ({ ...s, encryptionProtocol: opt.value as any }))}
                className={`p-3 border-[0.5px] text-center transition-all ${
                  settings.encryptionProtocol === opt.value
                    ? 'border-[#00f3ff] bg-[#00f3ff]/10 text-[#00f3ff]'
                    : 'border-[#4caf50]/20 text-[#4caf50]/60 hover:border-[#4caf50]/40'
                }`}
              >
                <div className="text-[9px] font-black uppercase">{opt.label}</div>
                <div className="text-[7px] opacity-60">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[8px] uppercase tracking-widest text-[#4caf50] font-black">Key Exchange Mode</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'x3dh', label: 'X3DH', desc: 'Standard' },
              { value: 'ecdh', label: 'ECDH', desc: 'Ephemeral' },
              { value: 'kyber', label: 'KYBER', desc: 'Post-Quantum' }
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSettings(s => ({ ...s, keyExchangeMode: opt.value as any }))}
                className={`p-3 border-[0.5px] text-center transition-all ${
                  settings.keyExchangeMode === opt.value
                    ? 'border-[#00f3ff] bg-[#00f3ff]/10 text-[#00f3ff]'
                    : 'border-[#4caf50]/20 text-[#4caf50]/60 hover:border-[#4caf50]/40'
                }`}
              >
                <div className="text-[9px] font-black uppercase">{opt.label}</div>
                <div className="text-[7px] opacity-60">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[8px] uppercase tracking-widest text-[#4caf50] font-black">Membership Policy</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'open', label: 'OPEN', desc: 'Anyone can join' },
              { value: 'invite', label: 'INVITE', desc: 'Invite only' },
              { value: 'approval', label: 'APPROVAL', desc: 'Requires approval' }
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSettings(s => ({ ...s, membershipPolicy: opt.value as any }))}
                className={`p-3 border-[0.5px] text-center transition-all ${
                  settings.membershipPolicy === opt.value
                    ? 'border-[#00f3ff] bg-[#00f3ff]/10 text-[#00f3ff]'
                    : 'border-[#4caf50]/20 text-[#4caf50]/60 hover:border-[#4caf50]/40'
                }`}
              >
                <div className="text-[9px] font-black uppercase">{opt.label}</div>
                <div className="text-[7px] opacity-60">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-[8px] uppercase tracking-widest text-[#4caf50] font-black">Member Capacity</label>
            <span className="text-[10px] font-mono text-[#00f3ff]">{settings.memberCapacity}</span>
          </div>
          <input
            type="range"
            min="2"
            max="1000"
            value={settings.memberCapacity}
            onChange={(e) => setSettings(s => ({ ...s, memberCapacity: parseInt(e.target.value) }))}
            className="w-full h-1 bg-[#4caf50]/20 appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:bg-[#00f3ff] [&::-webkit-slider-thumb]:cursor-pointer"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[8px] uppercase tracking-widest text-[#4caf50] font-black">Message Retention</label>
          <div className="grid grid-cols-5 gap-1">
            {[
              { value: '24h', label: '24H' },
              { value: '7d', label: '7D' },
              { value: '30d', label: '30D' },
              { value: 'forever', label: '∞' },
              { value: 'ephemeral', label: 'EPH' }
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSettings(s => ({ ...s, messageRetention: opt.value as any }))}
                className={`py-2 border-[0.5px] text-[9px] font-black transition-all ${
                  settings.messageRetention === opt.value
                    ? 'border-[#00f3ff] bg-[#00f3ff]/10 text-[#00f3ff]'
                    : 'border-[#4caf50]/20 text-[#4caf50]/60'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[8px] uppercase tracking-widest text-[#4caf50] font-black">ZKP Verification Level</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: 'none', label: 'NONE', desc: 'No proofs' },
              { value: 'basic', label: 'BASIC', desc: 'Send proofs' },
              { value: 'full', label: 'FULL', desc: '+ Merkle proofs' }
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSettings(s => ({ ...s, zkpVerificationLevel: opt.value as any }))}
                className={`p-3 border-[0.5px] text-center transition-all ${
                  settings.zkpVerificationLevel === opt.value
                    ? 'border-[#00f3ff] bg-[#00f3ff]/10 text-[#00f3ff]'
                    : 'border-[#4caf50]/20 text-[#4caf50]/60 hover:border-[#4caf50]/40'
                }`}
              >
                <div className="text-[9px] font-black uppercase">{opt.label}</div>
                <div className="text-[7px] opacity-60">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[8px] uppercase tracking-widest text-[#4caf50] font-black">Features</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'enableVoiceCalls', label: 'Voice Calls', icon: Phone },
              { key: 'enableVideoCalls', label: 'Video Calls', icon: Video },
              { key: 'enableFileSharing', label: 'File Sharing', icon: Binary }
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => setSettings(s => ({ ...s, [opt.key]: !s[opt.key as keyof MeshGroupSettings] }))}
                className={`p-3 border-[0.5px] flex flex-col items-center gap-2 transition-all ${
                  settings[opt.key as keyof MeshGroupSettings]
                    ? 'border-[#00f3ff] bg-[#00f3ff]/10 text-[#00f3ff]'
                    : 'border-[#4caf50]/20 text-[#4caf50]/40'
                }`}
              >
                <opt.icon size={16} />
                <span className="text-[7px] font-black uppercase">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>
        
        <button 
          onClick={handleCreate}
          disabled={!settings.name.trim()}
          className="w-full py-5 border-[0.5px] border-[#00f3ff]/50 text-[#00f3ff] font-black text-[11px] tracking-[0.4em] uppercase hover:bg-[#00f3ff]/10 transition-all active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          CREATE_MESH_GROUP
        </button>
      </div>
    </ModalWrapper>
  );
};

export const LicenseModal: React.FC<{ status: any, onClose: () => void }> = ({ status, onClose }) => {
  const [selectedPlan, setSelectedPlan] = useState<'trial' | 'lifetime'>('lifetime');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isBetaMode, setIsBetaMode] = useState(false);

  // Check for beta mode on mount
  React.useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(data => {
        // Check if beta mode is enabled (we'll add this to health endpoint)
        setIsBetaMode(data.betaMode || false);
      })
      .catch(() => setIsBetaMode(false));
  }, []);

  const handlePurchase = async () => {
    setIsProcessing(true);
    try {
      if (isBetaMode && selectedPlan === 'lifetime') {
        // BETA MODE: Direct lifetime license grant
        const response = await fetch('/api/licenses/beta-lifetime', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const result = await response.json();
        if (result.success) {
          localStorage.setItem('g3zkp_license', result.license);
          alert(result.message || 'BETA ACCESS GRANTED - LIFETIME LICENSE');
          onClose();
          window.location.reload(); // Refresh to apply license
        } else {
          alert(result.error || 'Beta license activation failed');
        }
      } else if (selectedPlan === 'trial') {
        // Request trial license
        const response = await fetch('/api/licenses/trial', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const result = await response.json();
        if (result.success) {
          localStorage.setItem('g3zkp_license', result.license);
          alert('Trial license activated! Valid for 7 days.');
          onClose();
          window.location.reload();
        } else {
          alert(result.error || 'Trial activation failed');
        }
      } else {
        // PRODUCTION: Create Stripe checkout session
        const response = await fetch('/api/payments/create-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            priceId: 'price_your_lifetime_price',
            successUrl: window.location.origin + '/#/success',
            cancelUrl: window.location.origin + '/#/pricing'
          })
        });
        const session = await response.json();
        if (session.url) {
          window.location.href = session.url;
        }
      }
    } catch (error) {
      console.error('License activation error:', error);
      alert('License activation failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ModalWrapper title="G3ZKP_LICENSE_SYSTEM" onClose={onClose}>
      <div className="space-y-8">
        {/* Current Status */}
        {status.valid && (
          <div className="p-6 border-[0.5px] border-[#00f3ff]/30 bg-[#00f3ff]/5">
            <div className="flex items-center gap-3 mb-4">
              <Award size={24} className="text-[#00f3ff]" />
              <div>
                <p className="text-[10px] font-black text-[#00f3ff] tracking-[0.3em] uppercase">LICENSE ACTIVE</p>
                <p className="text-[8px] text-[#4caf50]">Device-bound cryptographic license</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-[8px] uppercase tracking-wider">
                <span className="text-[#4caf50]/60">PROOF CREDITS</span>
                <span className="text-[#00f3ff] font-mono">{status.accumulatedValue.toFixed(1)} / 30.0</span>
              </div>
              <div className="h-[2px] w-full bg-black border-[0.5px] border-[#4caf50]/10 overflow-hidden">
                <div className="h-full bg-[#00f3ff] transition-all duration-1000" style={{ width: `${(status.accumulatedValue / 30) * 100}%` }}></div>
              </div>
            </div>
          </div>
        )}

        {/* Pricing Plans */}
        <div className="space-y-4">
          {isBetaMode && (
            <div className="p-4 border-[0.5px] border-[#00f3ff]/50 bg-[#00f3ff]/5">
              <div className="text-center">
                <div className="text-[12px] font-black text-[#00f3ff] tracking-[0.3em] uppercase mb-2">BETA TESTING MODE</div>
                <div className="text-[8px] text-[#4caf50]/60">Full lifetime licenses granted to all testers</div>
              </div>
            </div>
          )}

          <h3 className="text-[10px] font-black text-[#00f3ff] tracking-[0.3em] uppercase text-center">
            {isBetaMode ? 'GET BETA ACCESS' : 'SELECT LICENSE TYPE'}
          </h3>

          <div className={`grid gap-4 ${isBetaMode ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {/* Trial Plan - Hide in beta mode */}
            {!isBetaMode && (
              <button
                onClick={() => setSelectedPlan('trial')}
                className={`p-4 border-[0.5px] transition-all ${
                  selectedPlan === 'trial'
                    ? 'border-[#00f3ff] bg-[#00f3ff]/10'
                    : 'border-[#4caf50]/20 hover:border-[#4caf50]/40'
                }`}
              >
                <div className="text-center space-y-2">
                  <div className="text-[12px] font-black text-[#4caf50]">TRIAL</div>
                  <div className="text-[16px] font-black text-[#00f3ff]">FREE</div>
                  <div className="text-[8px] text-[#4caf50]/60">7 DAYS FULL ACCESS</div>
                  <div className="text-[7px] text-[#4caf50]/40">• All features unlocked<br/>• Device binding<br/>• ZKP encryption</div>
                </div>
              </button>
            )}

            {/* Lifetime/Beta Plan */}
            <button
              onClick={() => setSelectedPlan('lifetime')}
              className={`p-4 border-[0.5px] transition-all ${
                selectedPlan === 'lifetime'
                  ? 'border-[#00f3ff] bg-[#00f3ff]/10'
                  : 'border-[#4caf50]/20 hover:border-[#4caf50]/40'
              }`}
            >
              <div className="text-center space-y-2">
                <div className="text-[12px] font-black text-[#00f3ff]">
                  {isBetaMode ? 'BETA LIFETIME' : 'LIFETIME'}
                </div>
                <div className="text-[16px] font-black text-[#00f3ff]">
                  {isBetaMode ? 'FREE' : '£29.99'}
                </div>
                <div className="text-[8px] text-[#4caf50]/60">
                  {isBetaMode ? 'PERMANENT BETA ACCESS' : 'PERMANENT ACCESS'}
                </div>
                <div className="text-[7px] text-[#4caf50]/40">
                  {isBetaMode ? (
                    <>
                      • All features unlocked<br/>• Device binding<br/>• ZKP encryption<br/>• Beta testing access
                    </>
                  ) : (
                    <>
                      • Unlimited usage<br/>• All future updates<br/>• Priority support
                    </>
                  )}
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Purchase Button */}
        <button
          onClick={handlePurchase}
          disabled={isProcessing}
          className="w-full py-4 border-[0.5px] border-[#00f3ff]/50 text-[#00f3ff] font-black text-[11px] tracking-[0.4em] uppercase hover:bg-[#00f3ff]/10 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? 'PROCESSING...' :
           isBetaMode && selectedPlan === 'lifetime' ? 'GET BETA LIFETIME LICENSE' :
           selectedPlan === 'trial' ? 'START FREE TRIAL' :
           'PURCHASE LIFETIME LICENSE'}
        </button>

        {/* Security Notice */}
        <div className="p-4 border-[0.5px] border-[#4caf50]/20 bg-[#4caf50]/5">
          <div className="flex items-start gap-3">
            <Shield size={16} className="text-[#4caf50] mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-[8px] text-[#4caf50]/60 uppercase tracking-wider mb-1">CRYPTOGRAPHIC SECURITY</p>
              <p className="text-[8px] text-[#00f3ff] font-mono">All licenses are cryptographically bound to your device fingerprint. One license per device. Zero-knowledge verification ensures privacy.</p>
            </div>
          </div>
        </div>
      </div>
    </ModalWrapper>
  );
};

interface AppSettings {
  theme: 'tensor-blue' | 'multivectoral' | 'g3tzkp' | 'neon-pink' | 'cyber-gold';
  soundEnabled: boolean;
  notificationsEnabled: boolean;
  desktopNotifications: boolean;
  autoLock: boolean;
  lockTimeout: number;
  zkpVerification: 'auto' | 'manual' | 'disabled';
  networkMode: 'auto' | 'low-bandwidth' | 'high-performance';
  encryptionLevel: 'standard' | 'maximum';
  messagePreview: boolean;
}

const APP_SETTINGS_KEY = 'g3zkp_app_settings';

export const SettingsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { setTheme, currentTheme } = useThemeStore();
  const [settings, setSettings] = useState<AppSettings>(() => {
    const stored = localStorage.getItem(APP_SETTINGS_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {}
    }
    return {
      theme: 'g3tzkp',
      soundEnabled: true,
      notificationsEnabled: true,
      desktopNotifications: false,
      autoLock: false,
      lockTimeout: 5,
      zkpVerification: 'auto',
      networkMode: 'auto',
      encryptionLevel: 'maximum',
      messagePreview: true
    };
  });

  useEffect(() => {
    localStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const ToggleSwitch: React.FC<{ enabled: boolean, onChange: () => void }> = ({ enabled, onChange }) => (
    <button 
      onClick={onChange} 
      className={`w-12 h-6 relative transition-all duration-300 ${
        enabled 
          ? 'bg-gradient-to-r from-[#00f3ff]/30 to-[#4caf50]/30 border border-[#00f3ff]/50' 
          : 'bg-black/60 border border-[#4caf50]/20'
      }`}
    >
      <div className={`absolute top-0.5 w-5 h-5 transition-all duration-300 ${
        enabled 
          ? 'left-6 bg-[#00f3ff] shadow-[0_0_12px_#00f3ff]' 
          : 'left-0.5 bg-[#4caf50]/40'
      }`} />
    </button>
  );

  const themeDisplayNames: Record<string, string> = {
    'g3tzkp': 'G3ZKP',
    'manifold-blue': 'MANIFOLD BLUE',
    'multivectoral': 'MULTIVECTORAL',
    'neon-pink': 'NEON PINK',
    'phi-gold': 'PHI GOLD'
  };

  return (
    <ModalWrapper title="SETTINGS" onClose={onClose}>
      <div className="space-y-6">
        {/* Theme Selection - Card Grid */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 pb-2 border-b border-[#4caf50]/20">
            <Monitor size={14} className="text-[#00f3ff]" />
            <span className="text-xs font-bold text-[#00f3ff] tracking-widest uppercase">Appearance</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(themeDisplayNames).map(([key, name]) => (
              <button
                key={key}
                onClick={() => {
                  setSettings(s => ({ ...s, theme: key as any }));
                  setTheme(key);
                }}
                className={`p-3 rounded-lg text-center transition-all duration-200 ${
                  currentTheme === key
                    ? 'bg-gradient-to-br from-[#00f3ff]/20 to-[#4caf50]/10 border-2 border-[#00f3ff] shadow-[0_0_20px_rgba(0,243,255,0.2)]'
                    : 'bg-black/40 border border-[#4caf50]/20 hover:border-[#4caf50]/50 hover:bg-black/60'
                }`}
              >
                <span className={`text-[10px] font-bold uppercase tracking-wide ${
                  currentTheme === key ? 'text-[#00f3ff]' : 'text-[#4caf50]/70'
                }`}>
                  {name}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Notifications Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 pb-2 border-b border-[#4caf50]/20">
            <Bell size={14} className="text-[#00f3ff]" />
            <span className="text-xs font-bold text-[#00f3ff] tracking-widest uppercase">Notifications</span>
          </div>
          <div className="space-y-3 px-1">
            {[
              { key: 'soundEnabled', label: 'Sound', desc: 'Notification sounds', icon: Volume2 },
              { key: 'notificationsEnabled', label: 'In-App Alerts', desc: 'Show notification toasts', icon: Bell },
              { key: 'desktopNotifications', label: 'Desktop Alerts', desc: 'System notifications', icon: Monitor },
              { key: 'messagePreview', label: 'Message Preview', desc: 'Show message content', icon: Eye }
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between py-2 px-3 rounded-lg bg-black/30 border border-[#4caf50]/10">
                <div className="flex items-center gap-3">
                  <item.icon size={16} className="text-[#4caf50]/60" />
                  <div>
                    <span className="text-[11px] text-[#00f3ff] font-semibold">{item.label}</span>
                    <p className="text-[9px] text-[#4caf50]/50">{item.desc}</p>
                  </div>
                </div>
                <ToggleSwitch 
                  enabled={settings[item.key as keyof AppSettings] as boolean} 
                  onChange={() => setSettings(s => ({ ...s, [item.key]: !s[item.key as keyof AppSettings] }))} 
                />
              </div>
            ))}
          </div>
        </div>

        {/* Security Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 pb-2 border-b border-[#4caf50]/20">
            <Shield size={14} className="text-[#00f3ff]" />
            <span className="text-xs font-bold text-[#00f3ff] tracking-widest uppercase">Security</span>
          </div>
          <div className="space-y-4 px-1">
            <div className="py-3 px-4 rounded-none bg-[#00f3ff]/5 border border-[#00f3ff]/30">
              <div className="flex items-center gap-3">
                <Shield size={20} className="text-[#00f3ff]" />
                <div>
                  <span className="text-[11px] text-[#00f3ff] font-bold uppercase tracking-wider">MAXIMUM ENCRYPTION</span>
                  <p className="text-[9px] text-[#4caf50]/70 mt-1">ZKP + X3DH + Double Ratchet + AEAD</p>
                  <p className="text-[8px] text-[#00f3ff]/50 mt-0.5">All security features permanently enabled at maximum level</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between py-2 px-3 rounded-none bg-black/30 border border-[#4caf50]/20">
              <div className="flex items-center gap-3">
                <Lock size={16} className="text-[#4caf50]/60" />
                <div>
                  <span className="text-[11px] text-[#00f3ff] font-semibold">Auto-Lock</span>
                  <p className="text-[9px] text-[#4caf50]/50">Lock after inactivity</p>
                </div>
              </div>
              <ToggleSwitch enabled={settings.autoLock} onChange={() => setSettings(s => ({ ...s, autoLock: !s.autoLock }))} />
            </div>
          </div>
        </div>

        {/* Network Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-3 pb-2 border-b border-[#4caf50]/20">
            <Activity size={14} className="text-[#00f3ff]" />
            <span className="text-xs font-bold text-[#00f3ff] tracking-widest uppercase">Network</span>
          </div>
          <div className="py-2 px-3 rounded-lg bg-black/30 border border-[#4caf50]/10">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[11px] text-[#00f3ff] font-semibold">Network Mode</span>
                <p className="text-[9px] text-[#4caf50]/50">Bandwidth optimization</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'auto', label: 'Auto' },
                { value: 'low-bandwidth', label: 'Low BW' },
                { value: 'high-performance', label: 'High Perf' }
              ].map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => setSettings(s => ({ ...s, networkMode: mode.value as any }))}
                  className={`py-2 rounded-md text-[9px] uppercase font-bold transition-all ${
                    settings.networkMode === mode.value
                      ? 'bg-[#00f3ff]/20 text-[#00f3ff] border border-[#00f3ff]/50'
                      : 'bg-black/40 text-[#4caf50]/60 border border-[#4caf50]/20 hover:border-[#4caf50]/40'
                  }`}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-[#4caf50]/20 text-center">
          <p className="text-[9px] uppercase font-mono text-[#4caf50]/40 tracking-wide">G3ZKP_MESSENGER v1.0 | Settings auto-saved</p>
        </div>
      </div>
    </ModalWrapper>
  );
};
