import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { usePhiPiStore } from '../../stores/usePhiPiStore';
import { PhiPiRaymarchingMaterial } from '../../materials/PhiPiRaymarchingMaterial';
import { BijectiveTensorObject, ManifoldType } from '../../types/phiPiTypes';
import { tensorEnvironmentService, EnvironmentType } from '../../services/TensorEnvironmentService';
import { tensorRecordingService } from '../../services/TensorRecordingService';
import { 
  Maximize2, Minimize2, Camera, Video, 
  Volume2, VolumeX, Layers, X, Download, Circle, Send
} from 'lucide-react';

interface ManifoldMeshProps {
  manifoldType: ManifoldType;
  assetTexture: THREE.Texture | null;
  bijectiveStrength: number;
  environment?: EnvironmentType;
}

const ManifoldMesh: React.FC<ManifoldMeshProps> = ({ manifoldType, assetTexture, bijectiveStrength, environment }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<PhiPiRaymarchingMaterial | null>(null);
  const timeRef = useRef(0);
  const { camera } = useThree();
  
  const bioColor = usePhiPiStore(s => s.bioColor);
  const audioMetrics = usePhiPiStore(s => s.audioMetrics);
  const depthScale = usePhiPiStore(s => s.depthScale);
  const uplinkExtrusion = usePhiPiStore(s => s.uplinkExtrusion);
  const audioReactivity = usePhiPiStore(s => s.audioReactivity);
  const excisionLevel = usePhiPiStore(s => s.excisionLevel);

  const envData = useMemo(() => {
    if (!environment) return null;
    return tensorEnvironmentService.getEnvironment(environment);
  }, [environment]);

  useEffect(() => {
    materialRef.current = new PhiPiRaymarchingMaterial();
    if (meshRef.current) {
      meshRef.current.material = materialRef.current;
    }
  }, []);

  useEffect(() => {
    if (materialRef.current && assetTexture) {
      materialRef.current.bindTexture(assetTexture);
    }
  }, [assetTexture]);

  useFrame((_, delta) => {
    timeRef.current += delta;
    
    if (meshRef.current && materialRef.current) {
      materialRef.current.uniforms.uCameraWorldPosition.value.copy(camera.position);
      materialRef.current.updateUniforms(
        {
          bioColor,
          manifoldType,
          audioMetrics,
          depthScale,
          uplinkExtrusion,
          bijectiveStrength,
          audioReactivity,
          excisionLevel,
          envSkyColor: envData?.skyColor,
          envFogColor: envData?.fogColor,
          envLightIntensity: envData?.lightIntensity,
          envAmbientIntensity: envData?.ambientIntensity,
          envGridScale: envData?.gridScale,
          envAudioReactivity: envData?.audioReactivity
        },
        timeRef.current,
        meshRef.current,
        assetTexture
      );
    }
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[2, 2, 2]} />
    </mesh>
  );
};

interface BijectiveTensorRendererProps {
  tensorObject?: BijectiveTensorObject;
  assetUrl?: string;
  assetType?: 'image' | 'video' | 'camera';
  manifoldType?: ManifoldType;
  environment?: EnvironmentType;
  recipientPeerId?: string;
  onClose?: () => void;
  onRecordingComplete?: (recordingId: string) => void;
  className?: string;
  compact?: boolean;
}

export const BijectiveTensorRenderer: React.FC<BijectiveTensorRendererProps> = ({
  tensorObject,
  assetUrl,
  assetType = 'image',
  manifoldType: propManifoldType,
  environment: propEnvironment,
  recipientPeerId,
  onClose,
  onRecordingComplete,
  className = '',
  compact = false
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [assetTexture, setAssetTexture] = useState<THREE.Texture | null>(null);
  const [bijectiveStrength, setBijectiveStrength] = useState(0.1);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [sendingProgress, setSendingProgress] = useState(0);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [selectedEnvironment, setSelectedEnvironment] = useState<EnvironmentType>(propEnvironment || 'CITY_DIGITAL');
  const recordingStartTimeRef = useRef<number>(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number>();
  
  const storeManifoldType = usePhiPiStore(s => s.manifoldType);
  const setManifoldType = usePhiPiStore(s => s.setManifoldType);
  const isAudioActive = usePhiPiStore(s => s.isAudioActive);
  const setAudioSource = usePhiPiStore(s => s.setAudioSource);

  const activeManifoldType = propManifoldType || tensorObject?.manifoldConfig?.type || storeManifoldType;

  const updateVideoTexture = useCallback(() => {
    if (assetTexture && assetTexture instanceof THREE.VideoTexture) {
      assetTexture.needsUpdate = true;
    }
    animationFrameRef.current = requestAnimationFrame(updateVideoTexture);
  }, [assetTexture]);

  const startCameraFeed = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true
      });
      setCameraStream(stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().then(() => {
            const tex = new THREE.VideoTexture(videoRef.current!);
            tex.minFilter = THREE.LinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.colorSpace = THREE.SRGBColorSpace;
            setAssetTexture(tex);
          });
        };
      }
      
      setAudioSource('microphone', 'Camera Microphone');
    } catch (err) {
      console.error('[TensorUplink] Camera access denied:', err);
    }
  }, [setAudioSource]);

  const stopCameraFeed = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    if (assetTexture) {
      assetTexture.dispose();
      setAssetTexture(null);
    }
  }, [cameraStream, assetTexture]);

  const startRecording = useCallback(async () => {
    const canvas = containerRef.current?.querySelector('canvas');
    if (!canvas) return;
    
    canvasRef.current = canvas;
    try {
      const canvasStream = canvas.captureStream(30);
      
      let combinedStream = canvasStream;
      if (cameraStream) {
        const audioTracks = cameraStream.getAudioTracks();
        if (audioTracks.length > 0) {
          audioTracks.forEach(track => combinedStream.addTrack(track));
        }
      }
      
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') 
        ? 'video/webm;codecs=vp8,opus' 
        : 'video/webm';
      
      const recorder = new MediaRecorder(combinedStream, { 
        mimeType,
        videoBitsPerSecond: 1000000
      });
      recordedChunksRef.current = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };
      
      recorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const timestamp = Date.now();
        const filename = `tensor-manifold-${timestamp}.webm`;
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        
        console.log(`[TensorRecording] Saved locally: ${filename} (${(blob.size / 1024 / 1024).toFixed(2)}MB)`);
      };
      
      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch (err) {
      console.error('[TensorRecording] Start error:', err);
    }
  }, [cameraStream]);

  const stopRecording = useCallback(async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    const duration = Date.now() - recordingStartTimeRef.current;
    setRecordingDuration(duration / 1000);
    setIsRecording(false);
  }, []);

  useEffect(() => {
    if (!isRecording) return;
    
    recordingStartTimeRef.current = Date.now();
    const interval = setInterval(() => {
      const elapsed = (Date.now() - recordingStartTimeRef.current) / 1000;
      setRecordingDuration(elapsed);
    }, 100);
    
    return () => clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    if (assetType === 'camera') {
      startCameraFeed();
      return () => {
        stopCameraFeed();
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }
    
    if (!assetUrl) {
      setAssetTexture(null);
      return;
    }

    let isMounted = true;

    if (assetType === 'image') {
      const loader = new THREE.TextureLoader();
      loader.load(
        assetUrl, 
        (tex) => {
          if (!isMounted) { tex.dispose(); return; }
          tex.minFilter = THREE.LinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.wrapS = THREE.ClampToEdgeWrapping;
          tex.wrapT = THREE.ClampToEdgeWrapping;
          tex.colorSpace = THREE.SRGBColorSpace;
          setAssetTexture(tex);
        },
        undefined,
        (err) => console.error('[BijectiveRenderer] Image load error:', err)
      );
    } else if (assetType === 'video' && videoRef.current) {
      const video = videoRef.current;
      video.src = assetUrl;
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = 'anonymous';
      
      video.onloadeddata = () => {
        if (!isMounted) return;
        video.play().then(() => {
          if (!isMounted) return;
          const tex = new THREE.VideoTexture(video);
          tex.minFilter = THREE.LinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.wrapS = THREE.ClampToEdgeWrapping;
          tex.wrapT = THREE.ClampToEdgeWrapping;
          tex.colorSpace = THREE.SRGBColorSpace;
          setAssetTexture(tex);
        }).catch(err => console.error('[BijectiveRenderer] Video play error:', err));
      };
      video.load();
    }

    return () => {
      isMounted = false;
      if (assetTexture) {
        assetTexture.dispose();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [assetUrl, assetType]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
      }
      if (assetTexture) {
        assetTexture.dispose();
      }
    };
  }, []);

  useEffect(() => {
    if ((assetType === 'video' || assetType === 'camera') && assetTexture) {
      animationFrameRef.current = requestAnimationFrame(updateVideoTexture);
    }
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [assetType, assetTexture, updateVideoTexture]);

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    
    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  const manifoldOptions: { type: ManifoldType; label: string }[] = [
    { type: 'FLOWER_OF_LIFE_19', label: 'Flower of Life' },
    { type: 'CLIFFORD_TORUS', label: 'Clifford Torus' },
    { type: 'MOBIUS_FOLD', label: 'Mobius Fold' },
    { type: 'SINGULARITY', label: 'Singularity' },
    { type: 'HYPERDRIVE_UPLINK', label: 'Hyperdrive' },
    { type: 'KLEIN_SLICE', label: 'Klein Slice' },
    { type: 'CALABI_YAU', label: 'Calabi-Yau' },
    { type: 'NEURAL_FRACTAL', label: 'Neural Fractal' },
    { type: 'PHI_GEODESIC', label: 'Phi Geodesic' },
    { type: 'TORUS', label: 'Torus' }
  ];

  const containerClasses = isFullscreen
    ? `fixed inset-0 w-screen h-screen z-50 bg-black overflow-hidden ${className}`
    : compact
    ? `relative w-full aspect-square rounded-lg overflow-hidden bg-black ${className}`
    : `relative w-full h-full min-h-[280px] sm:min-h-[350px] md:min-h-[450px] rounded-xl overflow-hidden bg-black safe-area-inset ${className}`;

  return (
    <div ref={containerRef} className={containerClasses}>
      <video 
        ref={videoRef} 
        className="hidden" 
        muted 
        playsInline 
        crossOrigin="anonymous"
        loop 
      />
      
      <Canvas
        camera={{ position: [0, 0, 2.5], fov: 50 }}
        gl={{ 
          antialias: true, 
          alpha: true,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: true
        }}
        dpr={[1, 2]}
        className="touch-none"
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <ManifoldMesh 
          manifoldType={activeManifoldType} 
          assetTexture={assetTexture}
          bijectiveStrength={bijectiveStrength}
        />
        <OrbitControls 
          enableZoom={true}
          enablePan={false}
          minDistance={1}
          maxDistance={6}
          dampingFactor={0.05}
          rotateSpeed={0.5}
        />
      </Canvas>

      {assetTexture && (
        <div className="absolute top-2 left-2 sm:top-3 sm:left-3 z-10">
          <div className="bg-[#4caf50]/20 backdrop-blur-sm rounded px-2 py-1 border border-[#4caf50]/40 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#4caf50] animate-pulse" />
            <span className="text-[8px] sm:text-[10px] text-[#4caf50] font-mono uppercase tracking-wider">
              BIJECTIVE TENSOR UPLINK
            </span>
          </div>
        </div>
      )}

      {showControls && !compact && (
        <div className="absolute top-2 right-2 sm:top-3 sm:right-3 flex flex-col gap-1.5 sm:gap-2 z-10 pt-safe pr-safe">
          {onClose && (
            <button
              onClick={onClose}
              className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-lg bg-black/70 backdrop-blur-md border border-red-500/40 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all active:scale-95 touch-manipulation"
            >
              <X size={20} />
            </button>
          )}
          <button
            onClick={toggleFullscreen}
            className="min-w-[44px] min-h-[44px] w-11 h-11 rounded-lg bg-black/70 backdrop-blur-md border border-[#00f3ff]/40 flex items-center justify-center text-[#00f3ff] hover:bg-[#00f3ff]/20 transition-all active:scale-95 touch-manipulation"
          >
            {isFullscreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
          </button>
          <button
            onClick={() => assetType === 'camera' ? stopCameraFeed() : startCameraFeed()}
            className={`min-w-[44px] min-h-[44px] w-11 h-11 rounded-lg backdrop-blur-md border flex items-center justify-center transition-all active:scale-95 touch-manipulation ${
              cameraStream 
                ? 'bg-[#ff6b6b]/20 border-[#ff6b6b]/50 text-[#ff6b6b]' 
                : 'bg-black/70 border-[#00f3ff]/40 text-[#00f3ff]'
            }`}
            title={cameraStream ? 'Stop Camera' : 'Start Camera Feed'}
          >
            <Camera size={20} />
          </button>
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`min-w-[44px] min-h-[44px] w-11 h-11 rounded-lg backdrop-blur-md border flex items-center justify-center transition-all active:scale-95 touch-manipulation ${
              isRecording 
                ? 'bg-red-500/30 border-red-500/50 text-red-400 animate-pulse' 
                : 'bg-black/70 border-[#00f3ff]/40 text-[#00f3ff]'
            }`}
            title={isRecording ? 'Stop Recording' : 'Record Manifold'}
          >
            {isRecording ? <Circle size={20} fill="currentColor" /> : <Video size={20} />}
          </button>
          <button
            onClick={() => setAudioSource(isAudioActive ? 'none' : 'microphone')}
            className={`min-w-[44px] min-h-[44px] w-11 h-11 rounded-lg backdrop-blur-md border flex items-center justify-center transition-all active:scale-95 touch-manipulation ${
              isAudioActive 
                ? 'bg-[#4caf50]/20 border-[#4caf50]/50 text-[#4caf50]' 
                : 'bg-black/70 border-[#4caf50]/40 text-[#4caf50]/60'
            }`}
          >
            {isAudioActive ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>
        </div>
      )}

      {showControls && !compact && (
        <div className="absolute bottom-2 left-2 right-2 sm:bottom-3 sm:left-3 sm:right-3 z-10 space-y-2 pb-safe">
          <div className="bg-black/80 backdrop-blur-md rounded-lg border border-[#00f3ff]/20 p-2.5 sm:p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Layers size={14} className="text-[#00f3ff] flex-shrink-0" />
                <span className="text-[10px] sm:text-xs text-[#00f3ff] font-mono uppercase tracking-wider whitespace-nowrap">
                  Bijective Strength
                </span>
              </div>
              <span className="text-[11px] text-[#4caf50] font-mono font-bold">{(bijectiveStrength * 100).toFixed(0)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="0.15"
              step="0.01"
              value={bijectiveStrength}
              onChange={(e) => setBijectiveStrength(parseFloat(e.target.value))}
              className="w-full h-3 sm:h-2 bg-black/50 rounded-lg appearance-none cursor-pointer accent-[#00f3ff] touch-pan-y"
              style={{ touchAction: 'pan-y' }}
            />
          </div>
          
          <div className="bg-black/80 backdrop-blur-md rounded-lg border border-[#00f3ff]/20 p-2.5 sm:p-3">
            <div className="flex items-center gap-2 mb-2">
              <Layers size={14} className="text-[#00f3ff] flex-shrink-0" />
              <span className="text-[10px] sm:text-xs text-[#00f3ff] font-mono uppercase tracking-wider">
                Manifold Type
              </span>
            </div>
            <div className="grid grid-cols-5 gap-1 sm:grid-cols-10 sm:gap-1.5">
              {manifoldOptions.map(({ type, label }) => (
                <button
                  key={type}
                  onClick={() => setManifoldType(type)}
                  className={`min-h-[44px] sm:min-h-[32px] px-1 py-2 sm:px-2 sm:py-1.5 rounded text-[9px] sm:text-[10px] font-mono uppercase truncate transition-all active:scale-95 touch-manipulation ${
                    activeManifoldType === type
                      ? 'bg-[#00f3ff]/30 text-[#00f3ff] border border-[#00f3ff]/50'
                      : 'bg-black/50 text-[#4caf50]/60 border border-[#4caf50]/20 hover:border-[#00f3ff]/30'
                  }`}
                  title={label}
                >
                  {label.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tensorObject && (
        <div className="absolute top-12 left-2 sm:top-14 sm:left-3 z-10">
          <div className="bg-black/70 backdrop-blur-sm rounded-lg border border-[#4caf50]/30 px-2 py-1 sm:px-3 sm:py-2">
            <div className="text-[8px] sm:text-[10px] text-[#4caf50] font-mono uppercase tracking-wider">
              {tensorObject.sourceFile.name}
            </div>
            <div className="text-[7px] sm:text-[9px] text-[#4caf50]/60 font-mono">
              {tensorObject.tensorData.dimensions.width}x{tensorObject.tensorData.dimensions.height} | 
              Rank {tensorObject.tensorData.tensorRank}
            </div>
          </div>
        </div>
      )}

      {isRecording && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20">
          <div className="bg-red-500/20 backdrop-blur-sm rounded-full px-4 py-2 border border-red-500/50 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs text-red-400 font-mono uppercase">Recording Manifold</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default BijectiveTensorRenderer;
