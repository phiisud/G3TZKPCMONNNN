
import React, { useEffect, useRef } from 'react';
import { usePhiPiStore } from '../stores/usePhiPiStore';
import { AudioMetrics } from '../types/phiPiTypes';

export const AudioAnalyzer: React.FC = () => {
  // Use granular selectors to minimize re-renders
  const activeAudioSource = usePhiPiStore(s => s.activeAudioSource);
  const updateAudioMetrics = usePhiPiStore(s => s.updateAudioMetrics);
  const setAudioActive = usePhiPiStore(s => s.setAudioActive);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyzerRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Fix: Expected 1 arguments, but got 0. Providing an initial value to satisfy strict useRef types.
  const rafId = useRef<number | undefined>(undefined);
  
  const prevMagnitudeRef = useRef<Float32Array | null>(null);
  const fluxHistoryRef = useRef<number[]>([]);

  useEffect(() => {
    const cleanup = () => {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
        rafId.current = undefined;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (audioContextRef.current) {
        if (audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
        }
        audioContextRef.current = null;
      }
      analyzerRef.current = null;
    };

    const initAudio = async () => {
      cleanup();
      if (activeAudioSource === 'none') {
        setAudioActive(false);
        return;
      }

      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        const audioContext = new AudioContextClass();
        if (audioContext.state === 'suspended') await audioContext.resume();
        audioContextRef.current = audioContext;

        let stream: MediaStream | null = null;
        if (activeAudioSource === 'microphone') {
          stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } 
          });
        } else if (activeAudioSource === 'system') {
          stream = await navigator.mediaDevices.getDisplayMedia({ 
            audio: true, video: { width: 1, height: 1 } 
          });
        }
        
        if (!stream && activeAudioSource !== 'file') {
          setAudioActive(false);
          return;
        }
        streamRef.current = stream;

        const analyzer = audioContext.createAnalyser();
        analyzer.fftSize = 2048;
        analyzer.smoothingTimeConstant = 0.8;
        analyzerRef.current = analyzer;

        if (stream) {
          audioContext.createMediaStreamSource(stream).connect(analyzer);
        }

        const bufferLength = analyzer.frequencyBinCount;
        const freqData = new Float32Array(bufferLength);
        prevMagnitudeRef.current = new Float32Array(bufferLength);

        const analyze = () => {
          if (!analyzerRef.current) return;
          analyzerRef.current.getFloatFrequencyData(freqData);

          const magnitudes = freqData.map(db => Math.max(0, (db + 100) / 100));
          const sampleRate = audioContext.sampleRate;
          const binWidth = sampleRate / analyzer.fftSize;

          const subEnd = Math.floor(60 / binWidth);
          const bassEnd = Math.floor(250 / binWidth);
          const midEnd = Math.floor(4000 / binWidth);
          const presenceStart = Math.floor(2000 / binWidth);
          const presenceEnd = Math.floor(5000 / binWidth);
          const trebleEnd = Math.floor(12000 / binWidth);

          let metrics: AudioMetrics = {
            sub: 0, bass: 0, mid: 0, presence: 0, treble: 0, fizz: 0,
            rms: 0, pitch: 0, centroid: 0, flux: 0, rolloff: 0, onset: false
          };

          let weightedSum = 0;
          let totalMag = 0;
          let flux = 0;

          magnitudes.forEach((mag, i) => {
            if (i === 0) return;
            totalMag += mag;
            weightedSum += i * binWidth * mag;

            if (i < subEnd) metrics.sub += mag;
            if (i < bassEnd) metrics.bass += mag;
            else if (i < midEnd) metrics.mid += mag;
            else if (i < trebleEnd) metrics.treble += mag;
            else metrics.fizz += mag;

            if (i >= presenceStart && i < presenceEnd) metrics.presence += mag;

            if (prevMagnitudeRef.current) {
              const diff = mag - prevMagnitudeRef.current[i];
              if (diff > 0) flux += diff * diff;
            }
          });

          metrics.sub /= Math.max(1, subEnd);
          metrics.bass /= Math.max(1, bassEnd - subEnd);
          metrics.mid /= Math.max(1, midEnd - bassEnd);
          metrics.presence /= Math.max(1, presenceEnd - presenceStart);
          metrics.treble /= Math.max(1, trebleEnd - midEnd);
          metrics.fizz /= Math.max(1, bufferLength - trebleEnd);

          metrics.centroid = totalMag > 0 ? (weightedSum / totalMag) / (sampleRate / 2) : 0;
          metrics.flux = Math.sqrt(flux) * 2.0;
          metrics.rms = Math.sqrt(totalMag / bufferLength);

          let energySum = 0;
          let targetEnergy = totalMag * 0.85;
          for (let i = 0; i < magnitudes.length; i++) {
            energySum += magnitudes[i];
            if (energySum >= targetEnergy) {
              metrics.rolloff = (i * binWidth) / (sampleRate / 2);
              break;
            }
          }

          fluxHistoryRef.current.push(metrics.flux);
          if (fluxHistoryRef.current.length > 32) fluxHistoryRef.current.shift();
          const avgFlux = fluxHistoryRef.current.reduce((a, b) => a + b, 0) / fluxHistoryRef.current.length;
          metrics.onset = metrics.flux > avgFlux * 1.5 + 0.05;

          let maxMag = 0;
          let maxBin = 0;
          for (let i = 1; i < bassEnd * 4; i++) {
            if (magnitudes[i] > maxMag) {
              maxMag = magnitudes[i];
              maxBin = i;
            }
          }
          metrics.pitch = (maxBin * binWidth) / 2000;

          // Push metrics to store - has internal guard
          updateAudioMetrics(metrics);
          
          if (prevMagnitudeRef.current) {
            prevMagnitudeRef.current.set(magnitudes);
          }
          rafId.current = requestAnimationFrame(analyze);
        };

        setAudioActive(true);
        rafId.current = requestAnimationFrame(analyze);
      } catch (err) {
        console.error("Audio init error", err);
        setAudioActive(false);
      }
    };

    initAudio();
    return cleanup;
  }, [activeAudioSource, updateAudioMetrics, setAudioActive]);

  return null;
};
