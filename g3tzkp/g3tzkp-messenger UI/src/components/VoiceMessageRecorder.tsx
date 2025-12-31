import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, Play, Pause, Send, Trash2, Loader2 } from 'lucide-react';

interface VoiceMessageRecorderProps {
  onSend: (audioBlob: Blob, duration: number, waveformData: number[]) => void;
  onCancel: () => void;
  isOpen: boolean;
}

const VoiceMessageRecorder: React.FC<VoiceMessageRecorderProps> = ({ onSend, onCancel, isOpen }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [playbackProgress, setPlaybackProgress] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser || !isRecording) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#00f3ff';
    ctx.beginPath();

    const sliceWidth = canvas.width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();

    const avgAmplitude = dataArray.reduce((sum, val) => sum + Math.abs(val - 128), 0) / bufferLength;
    setWaveformData(prev => [...prev.slice(-50), avgAmplitude / 128]);

    animationRef.current = requestAnimationFrame(drawWaveform);
  }, [isRecording]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        }
      });

      streamRef.current = stream;

      audioContextRef.current = new AudioContext();
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      source.connect(analyserRef.current);

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : 'audio/webm';

      mediaRecorderRef.current = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      };

      mediaRecorderRef.current.start(100);
      setIsRecording(true);
      setDuration(0);

      timerRef.current = window.setInterval(() => {
        setDuration(d => d + 0.1);
      }, 100);

      animationRef.current = requestAnimationFrame(drawWaveform);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }, [drawWaveform]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsPaused(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    }
  }, [isRecording]);

  const togglePlayback = useCallback(() => {
    if (!audioRef.current || !audioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, [isPlaying, audioUrl]);

  const handleSend = useCallback(() => {
    if (audioBlob) {
      onSend(audioBlob, duration, waveformData);
      resetRecorder();
    }
  }, [audioBlob, duration, waveformData, onSend]);

  const resetRecorder = useCallback(() => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setWaveformData([]);
    setPlaybackProgress(0);
    setIsPlaying(false);
    chunksRef.current = [];
  }, [audioUrl]);

  const handleCancel = useCallback(() => {
    if (isRecording) {
      stopRecording();
    }
    resetRecorder();
    onCancel();
  }, [isRecording, stopRecording, resetRecorder, onCancel]);

  useEffect(() => {
    if (audioUrl && !audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => {
        setIsPlaying(false);
        setPlaybackProgress(0);
      };
      audioRef.current.ontimeupdate = () => {
        if (audioRef.current) {
          setPlaybackProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
        }
      };
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [audioUrl]);

  useEffect(() => {
    if (!isOpen) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current = null;
      }
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
      setAudioBlob(null);
      setAudioUrl(null);
      setDuration(0);
      setWaveformData([]);
      setIsRecording(false);
      setIsPaused(false);
      setIsPlaying(false);
      chunksRef.current = [];
    }
    
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [isOpen, audioUrl]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/90 backdrop-blur-md"
      role="dialog"
      aria-label="Voice message recorder"
    >
      <div className="w-full max-w-md mx-4 bg-gradient-to-b from-[#0a1a0a] to-[#0d0d0d] border border-[#00f3ff]/40 rounded-xl p-6 space-y-5 shadow-2xl shadow-[#00f3ff]/10">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-[0.3em] text-[#00f3ff] font-bold">
            {isRecording ? 'RECORDING_VOICE' : audioUrl ? 'REVIEW_MESSAGE' : 'VOICE_MESSAGE'}
          </span>
          <button
            onClick={handleCancel}
            className="p-2 text-[#4caf50] hover:text-red-500 transition-colors rounded-full hover:bg-red-500/10"
            aria-label="Cancel recording"
          >
            <Trash2 size={18} />
          </button>
        </div>

        <div className="relative h-28 bg-black/60 border border-[#00f3ff]/30 rounded-lg overflow-hidden">
          {isRecording ? (
            <>
              <canvas
                ref={canvasRef}
                width={400}
                height={112}
                className="w-full h-full"
                aria-label="Audio waveform visualization"
              />
              <div className="absolute bottom-2 left-2 flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                <span className="text-[10px] text-red-400 uppercase font-bold">LIVE</span>
              </div>
            </>
          ) : audioUrl ? (
            <div className="w-full h-full flex flex-col justify-center p-4">
              <div className="flex items-end justify-center gap-[3px] h-16 mb-2">
                {waveformData.length > 0 
                  ? waveformData.slice(0, 40).map((amplitude, i) => {
                      const isPlayed = (i / 40) * 100 <= playbackProgress;
                      return (
                        <div
                          key={i}
                          className={`w-1.5 rounded-full transition-all duration-75 ${
                            isPlayed ? 'bg-[#00f3ff]' : 'bg-[#4caf50]/40'
                          }`}
                          style={{ 
                            height: `${Math.max(8, amplitude * 56)}px`,
                            boxShadow: isPlayed ? '0 0 6px #00f3ff' : 'none'
                          }}
                        />
                      );
                    })
                  : Array.from({ length: 40 }, (_, i) => (
                      <div
                        key={i}
                        className="w-1.5 bg-[#4caf50]/30 rounded-full"
                        style={{ height: `${16 + Math.random() * 40}px` }}
                      />
                    ))
                }
              </div>
              <div className="h-1.5 bg-[#4caf50]/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-[#00f3ff] to-[#4caf50] transition-all duration-100 rounded-full"
                  style={{ width: `${playbackProgress}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-[#4caf50]/60">
              <Mic size={32} className="mb-2" />
              <span className="text-[11px] uppercase tracking-widest">Tap microphone to record</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="font-mono text-lg text-[#00f3ff]" aria-live="polite">
            {formatTime(duration)}
          </span>

          <div className="flex items-center gap-4">
            {!audioUrl ? (
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`p-4 rounded-full transition-all ${
                  isRecording
                    ? 'bg-red-500/20 border-[0.5px] border-red-500 text-red-500'
                    : 'bg-[#00f3ff]/10 border-[0.5px] border-[#00f3ff] text-[#00f3ff]'
                }`}
                aria-label={isRecording ? 'Stop recording' : 'Start recording'}
              >
                {isRecording ? <Square size={24} /> : <Mic size={24} />}
              </button>
            ) : (
              <>
                <button
                  onClick={togglePlayback}
                  className="p-3 bg-[#4caf50]/10 border-[0.5px] border-[#4caf50] text-[#4caf50] rounded-full"
                  aria-label={isPlaying ? 'Pause playback' : 'Play recording'}
                >
                  {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                </button>
                <button
                  onClick={handleSend}
                  className="p-4 bg-[#00f3ff]/10 border-[0.5px] border-[#00f3ff] text-[#00f3ff] rounded-full"
                  aria-label="Send voice message"
                >
                  <Send size={24} />
                </button>
              </>
            )}
          </div>
        </div>

        <p className="text-[8px] text-[#4caf50]/60 text-center uppercase tracking-wider" role="status">
          {isRecording 
            ? 'Recording... tap square to stop'
            : audioUrl 
              ? 'Tap play to review, send when ready'
              : 'Hold or tap microphone to start'
          }
        </p>
      </div>
    </div>
  );
};

export default VoiceMessageRecorder;
