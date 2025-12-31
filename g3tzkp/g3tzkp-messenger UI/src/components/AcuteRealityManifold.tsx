import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { PhiPiRaymarchingMaterial, DEFAULT_PHIPI_STATE, PhiPiState } from '../shaders/PhiPiRaymarchingMaterial';
import { useTensorStore } from '../stores/useTensorStore';

interface AcuteRealityManifoldProps {
  texture: THREE.Texture | THREE.VideoTexture | null;
  aspectRatio?: number;
}

const AcuteRealityManifold: React.FC<AcuteRealityManifoldProps> = ({ 
  texture,
  aspectRatio = 1
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<PhiPiRaymarchingMaterial | null>(null);
  const { camera, gl } = useThree();
  
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
  
  const material = useMemo(() => {
    const mat = new PhiPiRaymarchingMaterial();
    materialRef.current = mat;
    return mat;
  }, []);

  const geometry = useMemo(() => {
    const scale = 10;
    return new THREE.BoxGeometry(scale * aspectRatio, scale, 1);
  }, [aspectRatio]);

  useEffect(() => {
    if (materialRef.current && texture) {
      materialRef.current.uniforms.uVideoTexture.value = texture;
      materialRef.current.uniforms.uHasVideo.value = true;
      
      if ((texture as any).image) {
        const img = (texture as any).image;
        const w = img.videoWidth || img.width || 1;
        const h = img.videoHeight || img.height || 1;
        materialRef.current.uniforms.uAssetAspect.value = w / h;
      }
    }
  }, [texture]);

  useEffect(() => {
    return () => {
      if (materialRef.current) {
        materialRef.current.disposeResources();
      }
      geometry.dispose();
    };
  }, [geometry]);

  useFrame((state) => {
    if (!meshRef.current || !materialRef.current) return;
    
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
      showStepDepth: false
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
    <mesh ref={meshRef} geometry={geometry} material={material}>
    </mesh>
  );
};

export default AcuteRealityManifold;
