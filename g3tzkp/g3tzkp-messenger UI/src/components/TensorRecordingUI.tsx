import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Video, Square, Download, Send, AlertCircle, Loader2, X } from 'lucide-react';
import { tensorRecordingService } from '../services/TensorRecordingService';
import { tensorEnvironmentService, EnvironmentType } from '../services/TensorEnvironmentService';

interface TensorRecordingUIProps {
  onClose: () => void;
  recipientPeerId?: string;
  onSendComplete?: (recordingId: string) => void;
}

export const TensorRecordingUI: React.FC<TensorRecordingUIProps> = ({
  onClose,
  recipientPeerId,
  onSendComplete
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [selectedEnvironment, setSelectedEnvironment] = useState<EnvironmentType>('CITY_DIGITAL');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const environments = tensorEnvironmentService.getAllEnvironments();

  useEffect(() => {
    return () => {
      stopRecording();
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
      }
    };
  }, [recordedUrl]);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      
      // Get canvas stream (this records the 3D visualization)
      const canvas = canvasRef.current;
      if (!canvas) {
        throw new Error('Canvas not found');
      }

      // Get canvas stream at 30fps
      const canvasStream = canvas.captureStream(30);
      
      // Combine with audio if available (optional)
      let finalStream = canvasStream;
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioTrack = audioStream.getAudioTracks()[0];
        finalStream = new MediaStream([...canvasStream.getVideoTracks(), audioTrack]);
      } catch (audioErr) {
        console.warn('[TensorRecording] No audio available, recording video only');
      }

      streamRef.current = finalStream;

      // Use webm with VP9 codec for better quality and compatibility
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm')
          ? 'video/webm'
          : 'video/mp4';

      mediaRecorderRef.current = new MediaRecorder(finalStream, {
        mimeType,
        videoBitsPerSecond: 2500000 // 2.5 Mbps for good quality
      });

      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
        setIsRecording(false);
      };

      mediaRecorderRef.current.start(100); // Capture every 100ms
      startTimeRef.current = Date.now();
      setIsRecording(true);

      // Update duration timer
      timerRef.current = window.setInterval(() => {
        setDuration((Date.now() - startTimeRef.current) / 1000);
      }, 100);

    } catch (err) {
      console.error('[TensorRecording] Failed to start recording:', err);
      setError('Failed to start recording. Please check camera/canvas permissions.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setIsRecording(false);
  }, [isRecording]);

  const handleDownload = useCallback(() => {
    if (!recordedBlob || !recordedUrl) return;

    const env = tensorEnvironmentService.getEnvironment(selectedEnvironment);
    const filename = `tensor_${env?.name || 'recording'}_${Date.now()}.webm`;
    
    const a = document.createElement('a');
    a.href = recordedUrl;
    a.download = filename;
    a.click();
  }, [recordedBlob, recordedUrl, selectedEnvironment]);

  const handleSend = useCallback(async () => {
    if (!recordedBlob || !recipientPeerId) return;

    try {
      setIsSending(true);
      setSendProgress(0);
      setError(null);

      const env = tensorEnvironmentService.getEnvironment(selectedEnvironment);
      const filename = `tensor_${env?.name || 'recording'}_${Date.now()}.webm`;

      // Save locally first
      const recording = await tensorRecordingService.saveRecordingLocally(
        recordedBlob,
        filename,
        selectedEnvironment
      );

      // Send to peer
      const success = await tensorRecordingService.sendRecordingToPeer(
        recording.id,
        recipientPeerId,
        (progress) => {
          setSendProgress(progress);
        }
      );

      if (success) {
        onSendComplete?.(recording.id);
        onClose();
      } else {
        throw new Error('Failed to send recording');
      }
    } catch (err) {
      console.error('[TensorRecording] Send failed:', err);
      setError('Failed to send recording. Please try again.');
    } finally {
      setIsSending(false);
    }
  }, [recordedBlob, recipientPeerId, selectedEnvironment, onSendComplete, onClose]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-[500] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-gradient-to-b from-[#0a1a0a] to-[#0d0d0d] border border-[#00f3ff]/40 rounded-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#00f3ff]/20">
          <div>
            <h2 className="text-lg font-bold text-[#00f3ff] uppercase tracking-wider">
              3D Tensor Recording
            </h2>
            <p className="text-xs text-[#4caf50]/60 mt-1">
              Record manifold visualization with audio-reactive geometry
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#4caf50] hover:text-red-500 transition-colors rounded-full hover:bg-red-500/10"
          >
            <X size={20} />
          </button>
        </div>

        {/* Environment Selection */}
        <div className="p-4 border-b border-[#00f3ff]/10">
          <label className="block text-xs text-[#00f3ff]/80 uppercase tracking-wider mb-2">
            Select Environment
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {environments.map((env) => (
              <button
                key={env.id}
                onClick={() => setSelectedEnvironment(env.id)}
                disabled={isRecording}
                className={`p-3 rounded-lg border transition-all ${
                  selectedEnvironment === env.id
                    ? 'bg-[#00f3ff]/20 border-[#00f3ff] text-[#00f3ff]'
                    : 'bg-black/40 border-[#4caf50]/30 text-[#4caf50]/60 hover:border-[#4caf50] hover:text-[#4caf50]'
                } ${isRecording ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="text-xs font-bold uppercase">{env.name}</div>
                <div className="text-[8px] mt-1 opacity-60">{env.primaryManifold}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Canvas Preview */}
        <div className="relative bg-black aspect-video">
          <canvas
            ref={canvasRef}
            className="w-full h-full"
            style={{ display: 'block' }}
          />
          
          {isRecording && (
            <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 bg-red-500/20 border border-red-500 rounded-lg backdrop-blur-sm">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm font-bold text-red-400 uppercase">REC {formatTime(duration)}</span>
            </div>
          )}

          {recordedUrl && !isRecording && (
            <div className="absolute inset-0 flex items-center justify-center">
              <video
                ref={videoRef}
                src={recordedUrl}
                controls
                autoPlay
                loop
                className="max-w-full max-h-full"
              />
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="m-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-400">
            <AlertCircle size={16} />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Controls */}
        <div className="p-4 bg-black/50">
          <div className="flex items-center justify-between gap-4">
            {!recordedBlob ? (
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isSending}
                className={`flex-1 py-4 rounded-lg font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                  isRecording
                    ? 'bg-red-500/20 border-2 border-red-500 text-red-500 hover:bg-red-500/30'
                    : 'bg-[#00f3ff]/20 border-2 border-[#00f3ff] text-[#00f3ff] hover:bg-[#00f3ff]/30'
                }`}
              >
                {isRecording ? (
                  <>
                    <Square size={20} />
                    Stop Recording
                  </>
                ) : (
                  <>
                    <Video size={20} />
                    Start Recording
                  </>
                )}
              </button>
            ) : (
              <>
                <button
                  onClick={handleDownload}
                  disabled={isSending}
                  className="flex-1 py-4 bg-[#4caf50]/20 border-2 border-[#4caf50] text-[#4caf50] rounded-lg font-bold uppercase tracking-wider hover:bg-[#4caf50]/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Download size={20} />
                  Download
                </button>
                
                {recipientPeerId && (
                  <button
                    onClick={handleSend}
                    disabled={isSending}
                    className="flex-1 py-4 bg-[#00f3ff]/20 border-2 border-[#00f3ff] text-[#00f3ff] rounded-lg font-bold uppercase tracking-wider hover:bg-[#00f3ff]/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSending ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        Sending {Math.round(sendProgress)}%
                      </>
                    ) : (
                      <>
                        <Send size={20} />
                        Send to Peer
                      </>
                    )}
                  </button>
                )}
                
                <button
                  onClick={() => {
                    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
                    setRecordedBlob(null);
                    setRecordedUrl(null);
                    setDuration(0);
                  }}
                  disabled={isSending}
                  className="px-4 py-4 bg-gray-700/50 border-2 border-gray-600 text-gray-400 rounded-lg font-bold uppercase hover:bg-gray-700 transition-all disabled:opacity-50"
                >
                  Reset
                </button>
              </>
            )}
          </div>

          <p className="text-xs text-[#4caf50]/60 text-center mt-3 uppercase tracking-wider">
            {!recordedBlob 
              ? isRecording 
                ? 'Recording in progress - click stop when done'
                : 'Click start to record the 3D visualization'
              : 'Review your recording and download or send to peer'
            }
          </p>
        </div>
      </div>
    </div>
  );
};

export default TensorRecordingUI;
