import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';

interface VoiceMessagePlayerProps {
  audioUrl: string;
  duration: number;
  waveformData?: number[];
  isMe: boolean;
  onTranscript?: (text: string) => void;
}

const VoiceMessagePlayer: React.FC<VoiceMessagePlayerProps> = ({
  audioUrl,
  duration,
  waveformData = [],
  isMe,
  onTranscript
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlayback = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch((err) => {
          console.error('[VoicePlayer] Playback error:', err);
          setIsPlaying(false);
        });
    }
  }, [isPlaying]);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !audioRef.current) return;
    
    const rect = progressRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newTime = percentage * duration;
    
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
    setProgress(percentage * 100);
  }, [duration]);

  const cyclePlaybackRate = useCallback(() => {
    const rates = [1, 1.5, 2];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  }, [playbackRate]);

  const requestTranscript = useCallback(async () => {
    if (transcript || isTranscribing) return;
    
    setIsTranscribing(true);
    
    try {
      const SpeechRecognitionAPI = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      
      if (SpeechRecognitionAPI) {
        const recognition = new SpeechRecognitionAPI();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        
        recognition.onresult = (event: any) => {
          const text = event.results[0]?.[0]?.transcript || 'Unable to transcribe';
          setTranscript(text);
          onTranscript?.(text);
          setIsTranscribing(false);
        };
        
        recognition.onerror = () => {
          setTranscript('Transcript unavailable');
          setIsTranscribing(false);
        };
        
        recognition.onend = () => {
          if (!transcript) {
            setTranscript('Transcript unavailable');
          }
          setIsTranscribing(false);
        };
        
        recognition.start();
        
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play().catch(() => {});
        }
        
        setTimeout(() => {
          recognition.stop();
        }, Math.min(duration * 1000 + 1000, 10000));
      } else {
        setTranscript('Speech recognition not available in this browser');
        setIsTranscribing(false);
      }
    } catch (error) {
      console.error('Transcription error:', error);
      setTranscript('Transcript unavailable');
      setIsTranscribing(false);
    }
  }, [audioUrl, duration, transcript, isTranscribing, onTranscript]);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    
    // Critical: Load the audio immediately
    audio.load();
    
    audio.onended = () => {
      setIsPlaying(false);
      setProgress(0);
      setCurrentTime(0);
    };
    
    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
      setProgress((audio.currentTime / audio.duration) * 100);
    };
    
    audio.onloadedmetadata = () => {
      audio.playbackRate = playbackRate;
    };
    
    audio.onerror = (e) => {
      console.error('[VoicePlayer] Audio loading error:', e);
      setIsPlaying(false);
    };
    
    return () => {
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [audioUrl, playbackRate]);

  const barCount = 30;
  const bars = waveformData.length > 0 
    ? waveformData.slice(0, barCount).map((v, i) => ({ amplitude: v, index: i }))
    : Array.from({ length: barCount }, (_, i) => ({ amplitude: 0.3 + Math.random() * 0.4, index: i }));

  return (
    <div 
      className={`flex items-center gap-3 p-3 rounded-lg ${
        isMe ? 'bg-[#00f3ff]/5' : 'bg-[#4caf50]/5'
      } border-[0.5px] ${isMe ? 'border-[#00f3ff]/20' : 'border-[#4caf50]/20'}`}
      role="region"
      aria-label={`Voice message, ${formatTime(duration)} duration`}
    >
      <button
        onClick={togglePlayback}
        className={`p-2 rounded-full transition-all ${
          isMe 
            ? 'bg-[#00f3ff]/20 text-[#00f3ff] hover:bg-[#00f3ff]/30'
            : 'bg-[#4caf50]/20 text-[#4caf50] hover:bg-[#4caf50]/30'
        }`}
        aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
      >
        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
      </button>

      <div className="flex-1 space-y-1">
        <div 
          ref={progressRef}
          className="relative h-8 flex items-center gap-[2px] cursor-pointer"
          onClick={handleProgressClick}
          role="slider"
          aria-label="Voice message progress"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          tabIndex={0}
        >
          {bars.map((bar, i) => {
            const isPlayed = (i / bars.length) * 100 <= progress;
            return (
              <div
                key={i}
                className={`flex-1 rounded-full transition-all ${
                  isPlayed
                    ? isMe ? 'bg-[#00f3ff]' : 'bg-[#4caf50]'
                    : isMe ? 'bg-[#00f3ff]/30' : 'bg-[#4caf50]/30'
                }`}
                style={{ 
                  height: `${Math.max(4, bar.amplitude * 24)}px`,
                  opacity: isPlayed ? 1 : 0.5
                }}
              />
            );
          })}
        </div>
        
        <div className="flex items-center justify-between text-[8px] font-mono">
          <span className={isMe ? 'text-[#00f3ff]/60' : 'text-[#4caf50]/60'}>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
          <button
            onClick={cyclePlaybackRate}
            className={`px-1.5 py-0.5 rounded ${
              isMe ? 'bg-[#00f3ff]/10 text-[#00f3ff]' : 'bg-[#4caf50]/10 text-[#4caf50]'
            }`}
            aria-label={`Playback speed ${playbackRate}x`}
          >
            {playbackRate}x
          </button>
        </div>
      </div>

      <button
        onClick={requestTranscript}
        className={`p-1.5 rounded transition-all ${
          isMe ? 'text-[#00f3ff]/60 hover:text-[#00f3ff]' : 'text-[#4caf50]/60 hover:text-[#4caf50]'
        }`}
        aria-label="Request transcript"
        title="Get transcript"
      >
        <Volume2 size={14} />
      </button>

      {(transcript || isTranscribing) && (
        <div 
          className={`absolute left-0 right-0 -bottom-6 text-[7px] px-2 py-1 ${
            isMe ? 'text-[#00f3ff]/70' : 'text-[#4caf50]/70'
          }`}
          role="status"
          aria-live="polite"
        >
          {isTranscribing ? 'Transcribing...' : transcript}
        </div>
      )}
    </div>
  );
};

export default VoiceMessagePlayer;
