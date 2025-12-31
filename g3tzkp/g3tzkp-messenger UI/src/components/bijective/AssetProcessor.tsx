import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { usePhiPiStore } from '../../stores/usePhiPiStore';

interface SlotProcessorProps {
  slotId: number;
}

const SlotProcessor: React.FC<SlotProcessorProps> = ({ slotId }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const slotActive = usePhiPiStore(s => s.uplinks[slotId]?.active);
  const slotType = usePhiPiStore(s => s.uplinks[slotId]?.type);
  const slotUrl = usePhiPiStore(s => s.uplinks[slotId]?.url);
  const setUplinkTexture = usePhiPiStore(s => s.setUplinkTexture);
  
  const textureLoader = useRef(new THREE.TextureLoader());
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    const cleanup = () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = "";
        videoRef.current.srcObject = null;
      }
      setUplinkTexture(slotId, null);
    };

    const processCamera = async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 640, max: 1280 }, 
            height: { ideal: 480, max: 720 } 
          } 
        });
        setStream(s);
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play();
            const tex = new THREE.VideoTexture(videoRef.current!);
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            setUplinkTexture(slotId, tex);
          };
        }
      } catch (err) { 
        console.error(`[AssetProcessor] Slot ${slotId} Camera failed:`, err); 
      }
    };

    const processImage = () => {
      if (!slotUrl) return;
      textureLoader.current.load(slotUrl, (tex) => {
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        setUplinkTexture(slotId, tex);
      });
    };

    const processVideo = () => {
      if (!slotUrl || !videoRef.current) return;
      videoRef.current.src = slotUrl;
      videoRef.current.loop = true;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play();
        const tex = new THREE.VideoTexture(videoRef.current!);
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        setUplinkTexture(slotId, tex);
      };
    };

    if (slotActive) {
      if (slotType === 'camera') processCamera();
      else if (slotType === 'image') processImage();
      else if (slotType === 'video') processVideo();
    } else {
      cleanup();
    }

    return cleanup;
  }, [slotActive, slotType, slotUrl, slotId, setUplinkTexture, stream]);

  return (
    <div className="hidden">
      <video 
        ref={videoRef} 
        autoPlay 
        muted 
        playsInline 
        crossOrigin="anonymous"
        className="hidden" 
      />
      <canvas ref={canvasRef} width="16" height="16" className="hidden" />
    </div>
  );
};

export const AssetProcessor: React.FC = () => {
  return (
    <>
      {Array.from({ length: 9 }).map((_, i) => (
        <SlotProcessor key={i} slotId={i} />
      ))}
    </>
  );
};

export default AssetProcessor;
