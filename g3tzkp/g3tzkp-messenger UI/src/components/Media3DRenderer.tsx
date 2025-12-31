import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useTexture, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

interface TensorData {
  objectUrl: string;
  dimensions: { width: number; height: number; depth: number };
  vertices: number;
}

interface Media3DPlaneProps {
  textureUrl: string;
  dimensions: { width: number; height: number; depth: number };
  isVideo?: boolean;
}

const Media3DPlane: React.FC<Media3DPlaneProps> = ({ textureUrl, dimensions, isVideo }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [videoTexture, setVideoTexture] = useState<THREE.VideoTexture | null>(null);
  const [imageTexture, setImageTexture] = useState<THREE.Texture | null>(null);

  useEffect(() => {
    if (isVideo) {
      const video = document.createElement('video');
      video.src = textureUrl;
      video.crossOrigin = 'anonymous';
      video.loop = true;
      video.muted = true;
      video.playsInline = true;
      video.play().catch(() => {});
      
      const texture = new THREE.VideoTexture(video);
      texture.minFilter = THREE.LinearFilter;
      texture.magFilter = THREE.LinearFilter;
      setVideoTexture(texture);

      return () => {
        video.pause();
        video.src = '';
        texture.dispose();
      };
    } else {
      const loader = new THREE.TextureLoader();
      loader.load(textureUrl, (texture) => {
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        setImageTexture(texture);
      });
    }
  }, [textureUrl, isVideo]);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5) * 0.1;
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.05;
    }
  });

  const texture = isVideo ? videoTexture : imageTexture;
  if (!texture) return null;

  return (
    <mesh ref={meshRef} castShadow receiveShadow>
      <boxGeometry args={[dimensions.width, dimensions.height, dimensions.depth]} />
      <meshStandardMaterial 
        map={texture} 
        side={THREE.DoubleSide}
        metalness={0.1}
        roughness={0.3}
      />
      <mesh position={[0, 0, -dimensions.depth / 2 - 0.01]}>
        <planeGeometry args={[dimensions.width, dimensions.height]} />
        <meshStandardMaterial 
          color="#00f3ff" 
          emissive="#00f3ff"
          emissiveIntensity={0.2}
          transparent
          opacity={0.3}
          side={THREE.BackSide}
        />
      </mesh>
    </mesh>
  );
};

interface FlowerOfLifeFrameProps {
  size: number;
}

const FlowerOfLifeFrame: React.FC<FlowerOfLifeFrameProps> = ({ size }) => {
  const groupRef = useRef<THREE.Group>(null);
  const PHI = 1.618033988749895;
  
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.z = state.clock.elapsedTime * 0.1;
    }
  });

  const circles = useMemo(() => {
    const result: JSX.Element[] = [];
    const radius = size * 0.2;
    const angles = [0, 60, 120, 180, 240, 300];
    
    result.push(
      <mesh key="center" position={[0, 0, -0.1]}>
        <ringGeometry args={[radius - 0.01, radius, 64]} />
        <meshBasicMaterial color="#00f3ff" transparent opacity={0.3} />
      </mesh>
    );
    
    angles.forEach((angle, i) => {
      const x = radius * Math.cos((angle * Math.PI) / 180);
      const y = radius * Math.sin((angle * Math.PI) / 180);
      result.push(
        <mesh key={`outer-${i}`} position={[x, y, -0.1]}>
          <ringGeometry args={[radius - 0.01, radius, 64]} />
          <meshBasicMaterial color="#4caf50" transparent opacity={0.2} />
        </mesh>
      );
    });
    
    return result;
  }, [size]);

  return (
    <group ref={groupRef}>
      {circles}
    </group>
  );
};

interface Media3DRendererProps {
  tensorData: TensorData;
  isVideo?: boolean;
  size?: 'small' | 'medium' | 'large';
  showFrame?: boolean;
  interactive?: boolean;
}

const Media3DRenderer: React.FC<Media3DRendererProps> = ({ 
  tensorData, 
  isVideo = false,
  size = 'medium',
  showFrame = true,
  interactive = true
}) => {
  const sizeMap = {
    small: { width: 120, height: 90 },
    medium: { width: 200, height: 150 },
    large: { width: 320, height: 240 }
  };
  
  const dimensions = sizeMap[size];

  return (
    <div 
      className="relative rounded-lg overflow-hidden border border-[#00f3ff]/30 bg-black/50"
      style={{ width: dimensions.width, height: dimensions.height }}
    >
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[0, 0, 2.5]} fov={50} />
        <ambientLight intensity={0.4} />
        <pointLight position={[5, 5, 5]} intensity={0.8} castShadow />
        <pointLight position={[-5, -5, 5]} intensity={0.3} color="#00f3ff" />
        <spotLight 
          position={[0, 5, 5]} 
          angle={0.3} 
          penumbra={0.5} 
          intensity={0.5}
          castShadow
        />
        
        {showFrame && <FlowerOfLifeFrame size={2} />}
        
        <Media3DPlane 
          textureUrl={tensorData.objectUrl}
          dimensions={tensorData.dimensions}
          isVideo={isVideo}
        />
        
        {interactive && (
          <OrbitControls 
            enableZoom={false} 
            enablePan={false}
            minPolarAngle={Math.PI / 3}
            maxPolarAngle={Math.PI * 2 / 3}
          />
        )}
      </Canvas>
      
      <div className="absolute top-1 right-1 flex items-center gap-1 px-2 py-0.5 bg-black/60 rounded text-[8px] font-mono text-[#00f3ff]/80">
        <span className="w-1.5 h-1.5 bg-[#00f3ff] rounded-full animate-pulse" />
        3D_TENSOR
      </div>
      
      <div className="absolute bottom-1 left-1 text-[7px] font-mono text-[#4caf50]/60">
        {tensorData.dimensions.width.toFixed(2)} × {tensorData.dimensions.height.toFixed(2)}
      </div>
    </div>
  );
};

export default Media3DRenderer;

export const MediaPreview: React.FC<{
  url: string;
  type: 'image' | 'video';
  fileName?: string;
  className?: string;
}> = ({ url, type, fileName, className = '' }) => {
  if (type === 'video') {
    return (
      <div className={`relative ${className}`}>
        <video 
          src={url} 
          controls 
          className="max-w-full max-h-48 rounded border border-[#00f3ff]/20"
          preload="metadata"
        />
        {fileName && (
          <div className="absolute bottom-1 left-1 px-2 py-0.5 bg-black/80 text-[8px] text-[#00f3ff]/80 font-mono rounded">
            {fileName}
          </div>
        )}
      </div>
    );
  }
  
  return (
    <div className={`relative ${className}`}>
      <img 
        src={url} 
        alt={fileName || 'Image'} 
        className="max-w-full max-h-48 rounded border border-[#00f3ff]/20 object-contain"
      />
      {fileName && (
        <div className="absolute bottom-1 left-1 px-2 py-0.5 bg-black/80 text-[8px] text-[#00f3ff]/80 font-mono rounded">
          {fileName}
        </div>
      )}
    </div>
  );
};
