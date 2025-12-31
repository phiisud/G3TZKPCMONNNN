import React, { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff, Volume2, VolumeX } from 'lucide-react';
import { CallSession } from '@/types/peer';
import { webRTCCallingService } from '@/services/WebRTCCallingService';
import { businessCallingService } from '@/services/BusinessCallingService';

interface CallInterfaceProps {
  session: CallSession;
  onEndCall: () => void;
}

export const CallInterface: React.FC<CallInterfaceProps> = ({ session, onEndCall }) => {
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(session.isVideocall);
  const [isSpeakerEnabled, setIsSpeakerEnabled] = useState(true);
  const [callDuration, setCallDuration] = useState(0);
  const [connectionState, setConnectionState] = useState<RTCPeerConnectionState>('new');

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let durationInterval: NodeJS.Timeout;

    if (session.status === 'active') {
      durationInterval = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - session.startTime) / 1000));
      }, 1000);
    }

    return () => {
      if (durationInterval) clearInterval(durationInterval);
    };
  }, [session.status, session.startTime]);

  useEffect(() => {
    const localStream = webRTCCallingService.getLocalStream(session.sessionId);
    if (localStream && localVideoRef.current) {
      localVideoRef.current.srcObject = localStream;
    }

    const unsubRemoteStream = webRTCCallingService.onRemoteStream((stream) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = stream;
      }
    });

    const unsubCallState = webRTCCallingService.onCallStateChange((sessionId, state) => {
      if (sessionId === session.sessionId) {
        setConnectionState(state);
      }
    });

    return () => {
      unsubRemoteStream();
      unsubCallState();
    };
  }, [session.sessionId]);

  const handleToggleAudio = async () => {
    await webRTCCallingService.toggleAudio(session.sessionId, !isAudioEnabled);
    setIsAudioEnabled(!isAudioEnabled);
  };

  const handleToggleVideo = async () => {
    await webRTCCallingService.toggleVideo(session.sessionId, !isVideoEnabled);
    setIsVideoEnabled(!isVideoEnabled);
  };

  const handleEndCall = async () => {
    await businessCallingService.endCall(session.sessionId);
    await webRTCCallingService.endCall(session.sessionId);
    onEndCall();
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusText = (): string => {
    if (session.status === 'ringing') return 'Calling...';
    if (session.status === 'active') return formatDuration(callDuration);
    if (connectionState === 'connecting') return 'Connecting...';
    if (connectionState === 'failed') return 'Connection failed';
    return 'Call in progress';
  };

  return (
    <div className="fixed inset-0 bg-gray-900 z-50 flex flex-col">
      <div className="flex-1 relative">
        {session.isVideocall ? (
          <>
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
            
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="absolute bottom-4 right-4 w-48 h-36 object-cover rounded-lg shadow-lg border-2 border-white"
            />
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-white">
            <div className="w-32 h-32 rounded-full bg-blue-600 flex items-center justify-center mb-8">
              <Phone size={64} />
            </div>
            <h2 className="text-3xl font-bold mb-2">{session.recipientName}</h2>
            <p className="text-xl text-gray-300">{getStatusText()}</p>
            {connectionState === 'connected' && (
              <p className="text-sm text-green-400 mt-2">🟢 Connected</p>
            )}
          </div>
        )}
      </div>

      <div className="bg-gray-800 p-6">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-4 mb-4">
            <button
              onClick={handleToggleAudio}
              className={`p-4 rounded-full transition-all ${
                isAudioEnabled
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
              title={isAudioEnabled ? 'Mute' : 'Unmute'}
            >
              {isAudioEnabled ? <Mic size={24} /> : <MicOff size={24} />}
            </button>

            {session.isVideocall && (
              <button
                onClick={handleToggleVideo}
                className={`p-4 rounded-full transition-all ${
                  isVideoEnabled
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-red-600 hover:bg-red-700 text-white'
                }`}
                title={isVideoEnabled ? 'Turn off camera' : 'Turn on camera'}
              >
                {isVideoEnabled ? <Video size={24} /> : <VideoOff size={24} />}
              </button>
            )}

            <button
              onClick={() => setIsSpeakerEnabled(!isSpeakerEnabled)}
              className={`p-4 rounded-full transition-all ${
                isSpeakerEnabled
                  ? 'bg-gray-700 hover:bg-gray-600 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
              title={isSpeakerEnabled ? 'Mute speaker' : 'Unmute speaker'}
            >
              {isSpeakerEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
            </button>

            <button
              onClick={handleEndCall}
              className="p-4 rounded-full bg-red-600 hover:bg-red-700 text-white transition-all"
              title="End call"
            >
              <PhoneOff size={24} />
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-400">
              Calling {session.recipientName}
            </p>
            {session.status === 'active' && (
              <p className="text-xs text-green-400 mt-1">
                Call duration: {formatDuration(callDuration)}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
