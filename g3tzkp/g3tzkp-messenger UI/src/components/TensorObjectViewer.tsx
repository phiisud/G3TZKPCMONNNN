import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { X, Download, RotateCcw, Maximize2, Image, Film, Activity, Layers, Eye, Zap, AlertCircle } from 'lucide-react';
import { TensorData } from '../types';
import { useTensorStore } from '../stores/useTensorStore';
import { PhiPiRaymarchingMaterial, DEFAULT_PHIPI_STATE, PhiPiState, PHI, PI } from '../shaders/PhiPiRaymarchingMaterial';

interface ZoomSyncedOrbitControlsProps {
  zoomLevel: number;
  setZoomLevel: (value: number) => void;
  enablePan?: boolean;
  minDistance?: number;
  maxDistance?: number;
}

const ZoomSyncedOrbitControls: React.FC<ZoomSyncedOrbitControlsProps> = ({
  zoomLevel,
  setZoomLevel,
  enablePan = false,
  minDistance = 3,
  maxDistance = 20
}) => {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();
  const lastZoomRef = useRef(zoomLevel);
  const sliderDrivenRef = useRef(false);
  
  useEffect(() => {
    if (Math.abs(lastZoomRef.current - zoomLevel) > 0.01) {
      sliderDrivenRef.current = true;
      camera.position.setLength(zoomLevel);
      lastZoomRef.current = zoomLevel;
      if (controlsRef.current) {
        controlsRef.current.update();
      }
      setTimeout(() => { sliderDrivenRef.current = false; }, 50);
    }
  }, [zoomLevel, camera]);
  
  useFrame(() => {
    if (controlsRef.current && !sliderDrivenRef.current) {
      const distance = camera.position.length();
      if (Math.abs(distance - lastZoomRef.current) > 0.1) {
        lastZoomRef.current = distance;
        setZoomLevel(Math.round(distance * 10) / 10);
      }
    }
  });
  
  return (
    <OrbitControls
      ref={controlsRef}
      enableZoom={true}
      enablePan={enablePan}
      minDistance={minDistance}
      maxDistance={maxDistance}
      autoRotate={false}
    />
  );
};

interface AcuteRealityManifoldProps {
  textureUrl?: string;
  isVideo?: boolean;
  aspectRatio: number;
}

const AcuteRealityManifold: React.FC<AcuteRealityManifoldProps> = ({ 
  textureUrl,
  isVideo,
  aspectRatio
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<PhiPiRaymarchingMaterial | null>(null);
  const [texture, setTexture] = useState<THREE.Texture | THREE.VideoTexture | null>(null);
  const { camera } = useThree();
  
  const phi = useTensorStore(state => state.phi);
  const pi = useTensorStore(state => state.pi);
  const phiStepMultiplier = useTensorStore(state => state.phiStepMultiplier);
  const piPrecisionThreshold = useTensorStore(state => state.piPrecisionThreshold);
  const maxSteps = useTensorStore(state => state.maxSteps);
  const depthScale = useTensorStore(state => state.depthScale);
  const metricExtension = useTensorStore(state => state.metricExtension);
  const eigenValue = useTensorStore(state => state.eigenValue);
  const zkpProofConsistency = useTensorStore(state => state.zkpProofConsistency);
  const showPhiSteps = useTensorStore(state => state.showPhiSteps);
  const showNormals = useTensorStore(state => state.showNormals);
  
  // Texture modulation values
  const saturation = useTensorStore(state => state.saturation);
  const brightness = useTensorStore(state => state.brightness);
  const exposure = useTensorStore(state => state.exposure);
  const contrast = useTensorStore(state => state.contrast);
  const shadows = useTensorStore(state => state.shadows);
  const highlights = useTensorStore(state => state.highlights);
  const vibrance = useTensorStore(state => state.vibrance);
  const hue = useTensorStore(state => state.hue);
  const bwFilter = useTensorStore(state => state.bwFilter);

  const material = useMemo(() => {
    const mat = new PhiPiRaymarchingMaterial();
    materialRef.current = mat;
    return mat;
  }, []);

  const geometry = useMemo(() => {
    // Use a more complex geometry for better 3D visualization
    const geo = new THREE.SphereGeometry(4, 32, 32);
    // Add some noise to make it more interesting
    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      const noise = (Math.sin(x * 10) + Math.cos(y * 10) + Math.sin(z * 10)) * 0.1;
      positions.setXYZ(i, x + noise, y + noise, z + noise);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  useEffect(() => {
    if (!textureUrl) return;
    
    let mounted = true;
    let videoElement: HTMLVideoElement | null = null;
    let currentTexture: THREE.Texture | THREE.VideoTexture | null = null;
    
    const cleanup = () => {
      if (videoElement) {
        videoElement.pause();
        videoElement.src = '';
        videoElement = null;
      }
      if (currentTexture) {
        currentTexture.dispose();
        currentTexture = null;
      }
    };

    const applyAspectScale = (img: HTMLImageElement | HTMLVideoElement) => {
      if (!meshRef.current) return;
      const w = (img as any).videoWidth || (img as any).naturalWidth || img.width || 1;
      const h = (img as any).videoHeight || (img as any).naturalHeight || img.height || 1;
      const aspect = w / h;
      meshRef.current.scale.set(10 * aspect, 10, 1);
    };
    
    if (isVideo) {
      videoElement = document.createElement('video');
      videoElement.src = textureUrl;
      videoElement.crossOrigin = 'anonymous';
      videoElement.loop = true;
      videoElement.muted = true;
      videoElement.playsInline = true;
      
      videoElement.onloadedmetadata = () => {
        if (!mounted || !videoElement) return;
        videoElement.play().catch(() => {});
        const tex = new THREE.VideoTexture(videoElement);
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        currentTexture = tex;
        setTexture(tex);
        applyAspectScale(videoElement);
      };
    } else {
      const loader = new THREE.TextureLoader();
      loader.load(textureUrl, (tex) => {
        if (!mounted) return;
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        currentTexture = tex;
        setTexture(tex);
        if (tex.image) {
          applyAspectScale(tex.image);
        }
      });
    }
    
    return () => {
      mounted = false;
      cleanup();
    };
  }, [textureUrl, isVideo]);

  useEffect(() => {
    return () => {
      if (materialRef.current) {
        materialRef.current.disposeResources();
      }
      geometry.dispose();
      if (texture) {
        texture.dispose();
      }
    };
  }, [geometry, texture]);

  useFrame((state) => {
    if (!meshRef.current || !materialRef.current) return;

    meshRef.current.rotation.y = state.clock.elapsedTime * 0.1;

    const phiPiState: PhiPiState = {
      phi,
      pi,
      phiStepMultiplier,
      piPrecisionThreshold,
      maxSteps,
      depthScale,
      metricExtension,
      eigenValue,
      zkpProofConsistency,
      bladeDepthDebug: 0,
      showPhiSteps,
      showNormals,
      showBlade: false,
      showStepDepth: false,
      saturation,
      brightness,
      exposure,
      contrast,
      shadows,
      highlights,
      vibrance,
      hue,
      bwFilter
    };

    materialRef.current.updateUniforms(
      phiPiState,
      state.clock.elapsedTime,
      camera.position,
      meshRef.current,
      texture
    );
  });

  return (
    <mesh ref={meshRef} geometry={geometry} material={material} />
  );
};

const FlowerOfLifeFrame: React.FC<{ size: number }> = ({ size }) => {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.z = state.clock.elapsedTime * 0.1;
    }
  });

  const circles = useMemo(() => {
    const result: JSX.Element[] = [];
    const radius = size * 0.15;
    
    result.push(
      <mesh key="center" position={[0, 0, -0.5]}>
        <ringGeometry args={[radius - 0.01, radius, 64]} />
        <meshBasicMaterial color="#00f3ff" transparent opacity={0.15} />
      </mesh>
    );
    
    for (let i = 0; i < 6; i++) {
      const angle = (i * 60) * (Math.PI / 180);
      const x = radius * Math.cos(angle);
      const y = radius * Math.sin(angle);
      result.push(
        <mesh key={`ring1-${i}`} position={[x, y, -0.5]}>
          <ringGeometry args={[radius - 0.01, radius, 64]} />
          <meshBasicMaterial color="#4caf50" transparent opacity={0.1} />
        </mesh>
      );
    }
    
    for (let i = 0; i < 12; i++) {
      const angle = (i * 30 + 15) * (Math.PI / 180);
      const distance = radius * PHI;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      result.push(
        <mesh key={`ring2-${i}`} position={[x, y, -0.5]}>
          <ringGeometry args={[radius * 0.8 - 0.01, radius * 0.8, 48]} />
          <meshBasicMaterial color="#00f3ff" transparent opacity={0.06} />
        </mesh>
      );
    }
    
    if (result.length !== 19) {
      console.warn(`[FlowerOfLife] Expected 19 circles, got ${result.length}`);
    }
    
    return result;
  }, [size]);

  return <group ref={groupRef}>{circles}</group>;
};

interface TensorObjectViewerProps {
  tensorData: TensorData;
  onClose: () => void;
}

const TensorObjectViewer: React.FC<TensorObjectViewerProps> = ({
  tensorData,
  onClose
}) => {
  const [tapCount, setTapCount] = useState(0);
  const tapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [debugMode, setDebugMode] = useState<'normal' | 'normals' | 'steps' | 'depth'>('normal');
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const toggleDebug = useTensorStore(state => state.toggleDebug);
  const setZkpProofConsistency = useTensorStore(state => state.setZkpProofConsistency);
  const zkpProofConsistency = useTensorStore(state => state.zkpProofConsistency);
  const setDepthScale = useTensorStore(state => state.setDepthScale);
  const depthScale = useTensorStore(state => state.depthScale);
  const setMetricExtension = useTensorStore(state => state.setMetricExtension);
  const metricExtension = useTensorStore(state => state.metricExtension);
  const showPhiSteps = useTensorStore(state => state.showPhiSteps);
  const showNormals = useTensorStore(state => state.showNormals);
  
  // Zoom control
  const zoomLevel = useTensorStore(state => state.zoomLevel);
  const setZoomLevel = useTensorStore(state => state.setZoomLevel);
  
  // Texture modulation controls
  const saturation = useTensorStore(state => state.saturation);
  const setSaturation = useTensorStore(state => state.setSaturation);
  const brightness = useTensorStore(state => state.brightness);
  const setBrightness = useTensorStore(state => state.setBrightness);
  const exposure = useTensorStore(state => state.exposure);
  const setExposure = useTensorStore(state => state.setExposure);
  const contrast = useTensorStore(state => state.contrast);
  const setContrast = useTensorStore(state => state.setContrast);
  const shadows = useTensorStore(state => state.shadows);
  const setShadows = useTensorStore(state => state.setShadows);
  const highlights = useTensorStore(state => state.highlights);
  const setHighlights = useTensorStore(state => state.setHighlights);
  const vibrance = useTensorStore(state => state.vibrance);
  const setVibrance = useTensorStore(state => state.setVibrance);
  const hue = useTensorStore(state => state.hue);
  const setHue = useTensorStore(state => state.setHue);
  const bwFilter = useTensorStore(state => state.bwFilter);
  const setBwFilter = useTensorStore(state => state.setBwFilter);

  const handleTap = useCallback(() => {
    setTapCount(prev => prev + 1);
    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    tapTimeoutRef.current = setTimeout(() => setTapCount(0), 500);
  }, []);

  useEffect(() => {
    if (tapCount >= 3) {
      onClose();
      setTapCount(0);
    }
  }, [tapCount, onClose]);

  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    };
  }, []);

  const handleDownloadTensor = useCallback(() => {
    const jsonData = JSON.stringify(tensorData, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tensor_object_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [tensorData]);

  const handleDownloadOriginal = useCallback((file: { url: string; fileName: string }) => {
    const a = document.createElement('a');
    a.href = file.url;
    a.download = file.fileName;
    a.target = '_blank';
    a.click();
  }, []);

  const handleDebugChange = (mode: typeof debugMode) => {
    setDebugMode(mode);
    toggleDebug('showNormals');
    toggleDebug('showPhiSteps');
  };

  const primarySource = tensorData.originalFiles?.[0];
  const isVideo = primarySource?.mimeType?.startsWith('video/');
  const aspectRatio = tensorData.dimensions.width / tensorData.dimensions.height || 1;

  const tensorField = useTensorStore(state => state.tensorField);
  const flowerOfLifePattern = useTensorStore(state => state.flowerOfLifePattern);
  const tensorPerformance = useTensorStore(state => state.tensorPerformance);
  const phi = useTensorStore(state => state.phi);
  const pi = useTensorStore(state => state.pi);
  const eigenValue = useTensorStore(state => state.eigenValue);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[400] flex items-center justify-center backdrop-blur-xl bg-black/80 touch-manipulation"
      onClick={handleTap}
      style={{ backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 z-10 p-2 bg-black/60 border border-[#00f3ff]/30 rounded-full text-[#00f3ff] hover:bg-[#00f3ff]/20 transition-all"
      >
        <X size={20} />
      </button>

      <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
        <div className="px-3 py-1.5 bg-black/80 border border-purple-500/40 rounded backdrop-blur-sm">
          <div className="text-[8px] text-purple-400/80 uppercase tracking-wider flex items-center gap-1">
            <Zap size={10} /> ACUTE REALITY V7
          </div>
          <div className="text-[10px] text-purple-300 font-mono">PHI-PI SUBSTRATE ENGINE</div>
        </div>
        
        <div className="px-3 py-1.5 bg-black/80 border border-[#00f3ff]/30 rounded backdrop-blur-sm">
          <div className="text-[8px] text-[#00f3ff]/60 uppercase tracking-wider">RAYMARCHING</div>
          <div className="text-[10px] text-[#00f3ff] font-mono">{tensorData.vertices} vertices</div>
        </div>

        <div className="px-3 py-1.5 bg-black/80 border border-[#4caf50]/30 rounded backdrop-blur-sm">
          <div className="text-[8px] text-[#4caf50]/60 uppercase tracking-wider">RBBRRBR STITCHING</div>
          <div className="text-[10px] text-[#4caf50] font-mono">
            ZKP Consistency: {(zkpProofConsistency * 100).toFixed(0)}%
          </div>
        </div>

        {tensorPerformance.tensorOperations > 0 && (
          <div className="px-3 py-1.5 bg-black/80 border border-[#4caf50]/30 rounded backdrop-blur-sm">
            <div className="text-[8px] text-[#4caf50]/60 uppercase tracking-wider flex items-center gap-1">
              <Activity size={10} /> PERFORMANCE
            </div>
            <div className="text-[9px] text-[#4caf50] font-mono space-y-0.5">
              <div>Products: {tensorPerformance.geometricProducts}</div>
              <div>Optimization: {tensorPerformance.optimizationRatio.toFixed(1)}x</div>
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 text-center max-w-[90vw] sm:max-w-none">
        <div className="text-[8px] sm:text-[9px] text-[#00f3ff]/40 uppercase tracking-wider mb-2">
          Triple-tap to close | Drag to rotate | Pinch to zoom
        </div>
        <div className="flex gap-1 sm:gap-2 justify-center flex-wrap px-2">
          <button
            onClick={(e) => { e.stopPropagation(); handleDownloadTensor(); }}
            className="px-3 sm:px-4 py-2 bg-[#00f3ff]/10 border border-[#00f3ff]/40 text-[#00f3ff] text-[8px] sm:text-[9px] font-bold uppercase tracking-wider rounded hover:bg-[#00f3ff]/20 transition-all flex items-center gap-1 sm:gap-2 touch-manipulation"
          >
            <Download size={12} /> Tensor
          </button>
          {tensorData.originalFiles?.map((file, idx) => (
            <button
              key={idx}
              onClick={(e) => { e.stopPropagation(); handleDownloadOriginal(file); }}
              className="px-3 sm:px-4 py-2 bg-[#4caf50]/10 border border-[#4caf50]/40 text-[#4caf50] text-[8px] sm:text-[9px] font-bold uppercase tracking-wider rounded hover:bg-[#4caf50]/20 transition-all flex items-center gap-1 sm:gap-2 touch-manipulation"
            >
              {file.mimeType?.startsWith('video/') ? <Film size={12} /> : <Image size={12} />}
              <span className="hidden sm:inline">{file.fileName.slice(0, 15)}...</span>
              <span className="sm:hidden">{file.fileName.slice(0, 8)}...</span>
            </button>
          ))}
        </div>
      </div>

      <div 
        className="w-full h-full max-w-4xl max-h-[80vh] aspect-square"
        onClick={(e) => e.stopPropagation()}
      >
        {renderError ? (
          <div className="w-full h-full flex items-center justify-center bg-black/80 rounded-lg">
            <div className="text-center p-8">
              <AlertCircle size={48} className="mx-auto mb-4 text-red-500" />
              <p className="text-red-400 text-lg font-bold mb-2">Rendering Error</p>
              <p className="text-gray-400 text-sm">{renderError}</p>
              <button
                onClick={() => { setRenderError(null); setIsLoading(true); }}
                className="mt-4 px-4 py-2 bg-[#00f3ff]/20 border border-[#00f3ff] text-[#00f3ff] rounded-lg hover:bg-[#00f3ff]/30 transition-all"
              >
                Retry
              </button>
            </div>
          </div>
        ) : (
          <>
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-10">
                <div className="text-center">
                  <div className="w-12 h-12 border-4 border-[#00f3ff]/30 border-t-[#00f3ff] rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-[#00f3ff] text-sm uppercase tracking-wider">Loading 3D Manifold...</p>
                </div>
              </div>
            )}
            <Canvas 
              shadows
              onCreated={() => setIsLoading(false)}
              gl={{ 
                antialias: true,
                alpha: true,
                powerPreference: 'high-performance'
              }}
              dpr={Math.min(window.devicePixelRatio, 2)}
            >
              <PerspectiveCamera makeDefault position={[0, 0, zoomLevel]} fov={50} />
              <ambientLight intensity={0.2} />
              <pointLight position={[8, 8, 12]} intensity={0.8} castShadow color="#ffffff" />
              <pointLight position={[-8, -8, 12]} intensity={0.4} color="#00f3ff" />
              
              <AcuteRealityManifold 
                textureUrl={primarySource?.url}
                isVideo={isVideo}
                aspectRatio={aspectRatio}
              />
              
              <FlowerOfLifeFrame size={3} />
              
              <ZoomSyncedOrbitControls 
                zoomLevel={zoomLevel}
                setZoomLevel={setZoomLevel}
                enablePan={false}
                minDistance={3}
                maxDistance={20}
              />
            </Canvas>
          </>
        )}
      </div>

      <div className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-2 max-h-[80vh] overflow-y-auto">
        <div className="px-3 py-2 bg-black/80 border border-purple-500/20 rounded backdrop-blur-sm text-[8px] text-purple-400/80 space-y-2">
          <div className="text-purple-300 font-bold uppercase tracking-wider flex items-center gap-1">
            <Layers size={10} /> SUBSTRATE CONTROLS
          </div>
          
          <div className="space-y-1">
            <label className="block text-[7px] text-purple-400/60">ZKP Consistency</label>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.01"
              value={zkpProofConsistency}
              onChange={(e) => setZkpProofConsistency(parseFloat(e.target.value))}
              onClick={(e) => e.stopPropagation()}
              className="w-full h-1 bg-purple-900/50 rounded appearance-none cursor-pointer"
            />
          </div>
          
          <div className="space-y-1">
            <label className="block text-[7px] text-purple-400/60">Depth Scale</label>
            <input 
              type="range" 
              min="0.1" 
              max="3" 
              step="0.1"
              value={depthScale}
              onChange={(e) => setDepthScale(parseFloat(e.target.value))}
              onClick={(e) => e.stopPropagation()}
              className="w-full h-1 bg-purple-900/50 rounded appearance-none cursor-pointer"
            />
          </div>
          
          <div className="space-y-1">
            <label className="block text-[7px] text-purple-400/60">Metric Extension</label>
            <input 
              type="range" 
              min="0.5" 
              max="4" 
              step="0.1"
              value={metricExtension}
              onChange={(e) => setMetricExtension(parseFloat(e.target.value))}
              onClick={(e) => e.stopPropagation()}
              className="w-full h-1 bg-purple-900/50 rounded appearance-none cursor-pointer"
            />
          </div>
        </div>

        <div className="px-3 py-2 bg-black/80 border border-[#00f3ff]/20 rounded backdrop-blur-sm text-[8px] text-[#00f3ff]/60 space-y-1">
          <div className="text-[#00f3ff] font-bold uppercase tracking-wider">PHI-PI CONSTANTS</div>
          <div className="font-mono">φ: {phi.toFixed(9)}</div>
          <div className="font-mono">π: {pi.toFixed(9)}</div>
          <div className="font-mono">λ (Eigen): {eigenValue.toFixed(3)}</div>
          <div className="font-mono">Depth: {depthScale.toFixed(1)}</div>
          <div className="font-mono">Extension: {metricExtension.toFixed(1)}</div>
        </div>

        <div className="px-3 py-2 bg-black/80 border border-[#4caf50]/20 rounded backdrop-blur-sm text-[8px] text-[#4caf50]/60 space-y-1">
          <div className="text-[#4caf50] font-bold uppercase tracking-wider">MANIFOLD STATUS</div>
          <div className="font-mono">Aspect: {aspectRatio.toFixed(2)}</div>
          <div className="font-mono">Vertices: {tensorData.vertices}</div>
          <div className="font-mono flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            SEWN TO SUBSTRATE
          </div>
        </div>

        <div className="px-3 py-2 bg-black/80 border border-orange-500/20 rounded backdrop-blur-sm text-[8px] space-y-2">
          <div className="text-orange-400 font-bold uppercase tracking-wider flex items-center gap-1">
            <Eye size={10} /> DEBUG MODES
          </div>
          <div className="flex flex-wrap gap-1">
            <button
              onClick={(e) => { e.stopPropagation(); toggleDebug('showNormals'); }}
              className={`px-2 py-1 text-[7px] rounded border transition-all ${
                showNormals 
                  ? 'bg-orange-500/30 border-orange-400 text-orange-300' 
                  : 'bg-black/40 border-orange-500/30 text-orange-500/60'
              }`}
            >
              NORMALS
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); toggleDebug('showPhiSteps'); }}
              className={`px-2 py-1 text-[7px] rounded border transition-all ${
                showPhiSteps 
                  ? 'bg-orange-500/30 border-orange-400 text-orange-300' 
                  : 'bg-black/40 border-orange-500/30 text-orange-500/60'
              }`}
            >
              PHI STEPS
            </button>
          </div>
        </div>
      </div>

      {/* Left side - Texture modulation and zoom controls */}
      <div className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-10 flex flex-col gap-2 mt-16 sm:mt-32 max-h-[70vh] overflow-y-auto">
        <div className="px-3 py-2 bg-black/80 border border-cyan-500/20 rounded backdrop-blur-sm text-[8px] space-y-2 w-36">
          <div className="text-cyan-300 font-bold uppercase tracking-wider flex items-center gap-1">
            <Maximize2 size={10} /> ZOOM
          </div>
          <div className="space-y-1">
            <input 
              type="range" 
              min="3" 
              max="20" 
              step="0.5"
              value={zoomLevel}
              onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
              onClick={(e) => e.stopPropagation()}
              className="w-full h-1 bg-cyan-900/50 rounded appearance-none cursor-pointer"
            />
            <div className="text-[7px] text-cyan-400/60 text-right">{zoomLevel.toFixed(1)}x</div>
          </div>
        </div>

        <div className="px-3 py-2 bg-black/80 border border-pink-500/20 rounded backdrop-blur-sm text-[8px] space-y-2 w-36 max-h-[45vh] overflow-y-auto">
          <div className="text-pink-300 font-bold uppercase tracking-wider flex items-center gap-1">
            <Image size={10} /> TEXTURE
          </div>
          
          <div className="space-y-1">
            <label className="block text-[7px] text-pink-400/60">Saturation</label>
            <input 
              type="range" min="0" max="2" step="0.05" value={saturation}
              onChange={(e) => setSaturation(parseFloat(e.target.value))}
              onClick={(e) => e.stopPropagation()}
              className="w-full h-1 bg-pink-900/50 rounded appearance-none cursor-pointer"
            />
          </div>
          
          <div className="space-y-1">
            <label className="block text-[7px] text-pink-400/60">Brightness</label>
            <input 
              type="range" min="-0.5" max="0.5" step="0.02" value={brightness}
              onChange={(e) => setBrightness(parseFloat(e.target.value))}
              onClick={(e) => e.stopPropagation()}
              className="w-full h-1 bg-pink-900/50 rounded appearance-none cursor-pointer"
            />
          </div>
          
          <div className="space-y-1">
            <label className="block text-[7px] text-pink-400/60">Exposure</label>
            <input 
              type="range" min="-2" max="2" step="0.1" value={exposure}
              onChange={(e) => setExposure(parseFloat(e.target.value))}
              onClick={(e) => e.stopPropagation()}
              className="w-full h-1 bg-pink-900/50 rounded appearance-none cursor-pointer"
            />
          </div>
          
          <div className="space-y-1">
            <label className="block text-[7px] text-pink-400/60">Contrast</label>
            <input 
              type="range" min="0.5" max="2" step="0.05" value={contrast}
              onChange={(e) => setContrast(parseFloat(e.target.value))}
              onClick={(e) => e.stopPropagation()}
              className="w-full h-1 bg-pink-900/50 rounded appearance-none cursor-pointer"
            />
          </div>
          
          <div className="space-y-1">
            <label className="block text-[7px] text-pink-400/60">Shadows</label>
            <input 
              type="range" min="-1" max="1" step="0.05" value={shadows}
              onChange={(e) => setShadows(parseFloat(e.target.value))}
              onClick={(e) => e.stopPropagation()}
              className="w-full h-1 bg-pink-900/50 rounded appearance-none cursor-pointer"
            />
          </div>
          
          <div className="space-y-1">
            <label className="block text-[7px] text-pink-400/60">Highlights</label>
            <input 
              type="range" min="-1" max="1" step="0.05" value={highlights}
              onChange={(e) => setHighlights(parseFloat(e.target.value))}
              onClick={(e) => e.stopPropagation()}
              className="w-full h-1 bg-pink-900/50 rounded appearance-none cursor-pointer"
            />
          </div>
          
          <div className="space-y-1">
            <label className="block text-[7px] text-pink-400/60">Vibrance</label>
            <input 
              type="range" min="-1" max="1" step="0.05" value={vibrance}
              onChange={(e) => setVibrance(parseFloat(e.target.value))}
              onClick={(e) => e.stopPropagation()}
              className="w-full h-1 bg-pink-900/50 rounded appearance-none cursor-pointer"
            />
          </div>
          
          <div className="space-y-1">
            <label className="block text-[7px] text-pink-400/60">Hue Shift</label>
            <input 
              type="range" min="-0.5" max="0.5" step="0.02" value={hue}
              onChange={(e) => setHue(parseFloat(e.target.value))}
              onClick={(e) => e.stopPropagation()}
              className="w-full h-1 bg-pink-900/50 rounded appearance-none cursor-pointer"
            />
          </div>
          
          <div className="space-y-1">
            <label className="block text-[7px] text-pink-400/60">B&W Filter</label>
            <input 
              type="range" min="0" max="1" step="0.05" value={bwFilter}
              onChange={(e) => setBwFilter(parseFloat(e.target.value))}
              onClick={(e) => e.stopPropagation()}
              className="w-full h-1 bg-pink-900/50 rounded appearance-none cursor-pointer"
            />
          </div>
          
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSaturation(1.0);
              setBrightness(0.0);
              setExposure(0.0);
              setContrast(1.0);
              setShadows(0.0);
              setHighlights(0.0);
              setVibrance(0.0);
              setHue(0.0);
              setBwFilter(0.0);
            }}
            className="w-full mt-1 px-2 py-1 text-[7px] bg-pink-500/20 border border-pink-500/40 text-pink-300 rounded hover:bg-pink-500/30 transition-all flex items-center justify-center gap-1"
          >
            <RotateCcw size={8} /> RESET
          </button>
        </div>
      </div>
    </div>
  );
};

export default TensorObjectViewer;

export const TensorObjectPreview: React.FC<{
  tensorData: TensorData;
  onClick: () => void;
  size?: 'small' | 'medium' | 'large';
}> = ({ tensorData, onClick, size = 'medium' }) => {
  const sizeMap = {
    small: { width: 120, height: 90 },
    medium: { width: 180, height: 135 },
    large: { width: 280, height: 210 }
  };
  const dims = sizeMap[size];
  const primarySource = tensorData.originalFiles?.[0];
  const isVideo = primarySource?.mimeType?.startsWith('video/');
  const aspectRatio = tensorData.dimensions.width / tensorData.dimensions.height || 1;

  return (
    <div 
      onClick={onClick}
      className="relative rounded-lg overflow-hidden border border-purple-500/40 bg-black/50 cursor-pointer hover:border-purple-400/80 transition-all group"
      style={{ width: dims.width, height: dims.height }}
    >
      <Canvas>
        <PerspectiveCamera makeDefault position={[0, 0, 4]} fov={50} />
        <ambientLight intensity={0.3} />
        <pointLight position={[3, 3, 3]} intensity={0.6} />
        
        <AcuteRealityManifold 
          textureUrl={primarySource?.url}
          isVideo={isVideo}
          aspectRatio={aspectRatio}
        />
      </Canvas>
      
      <div className="absolute top-1 right-1 flex items-center gap-1 px-2 py-0.5 bg-purple-900/80 rounded text-[7px] font-mono text-purple-300">
        <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-pulse" />
        ACUTE_REALITY
      </div>
      
      <div className="absolute bottom-1 left-1 text-[6px] font-mono text-[#4caf50]/60">
        {tensorData.dimensions.width.toFixed(1)} × {tensorData.dimensions.height.toFixed(1)}
      </div>
      
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all">
        <Maximize2 size={24} className="text-purple-400" />
      </div>
    </div>
  );
};
