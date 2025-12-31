import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';
import { PhiTensorRaymarchingMaterial } from '../shaders/PhiTensorRaymarchingShader';

interface VisualizationProps {
  phiValue: number;
  recursionStages: number;
  rayCount: number;
  maxBounces: number;
  sourceImage: File | null;
  isCameraActive: boolean;
}

export const PhiTensorVisualization: React.FC<VisualizationProps> = ({ 
  phiValue,
  recursionStages,
  rayCount,
  maxBounces,
  sourceImage,
  isCameraActive
}) => {
  const { camera } = useThree();
  const materialRef = useRef<PhiTensorRaymarchingMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [aspectRatio, setAspectRatio] = useState(1.0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (sourceImage && !isCameraActive) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const tex = new THREE.Texture(img);
          tex.needsUpdate = true;
          tex.minFilter = THREE.LinearFilter;
          tex.magFilter = THREE.LinearFilter;
          setTexture(tex);
          setAspectRatio(img.width / img.height);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(sourceImage);
    }
  }, [sourceImage, isCameraActive]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let video: HTMLVideoElement | null = null;

    if (isCameraActive) {
      const startCamera = async () => {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 1280, height: 720, facingMode: 'user' } 
          });
          video = document.createElement('video');
          video.srcObject = stream;
          video.muted = true;
          video.play();
          
          const videoTexture = new THREE.VideoTexture(video);
          videoTexture.minFilter = THREE.LinearFilter;
          videoTexture.magFilter = THREE.LinearFilter;
          videoTexture.format = THREE.RGBAFormat;

          setTexture(videoTexture);
          
          video.onloadedmetadata = () => {
            setAspectRatio(video!.videoWidth / video!.videoHeight);
          };
          
          videoRef.current = video;
        } catch (err) {
          console.error("[TensorViz] Camera error:", err);
        }
      };
      startCamera();
    } else {
      if (videoRef.current) {
        const s = videoRef.current.srcObject as MediaStream;
        s?.getTracks().forEach(track => track.stop());
        videoRef.current = null;
      }
      if (!sourceImage) setTexture(null);
    }

    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [isCameraActive, sourceImage]);

  useFrame((state) => {
    if (materialRef.current) {
      const mat = materialRef.current;
      mat.uniforms.uTime.value = state.clock.getElapsedTime();
      mat.uniforms.uCameraPosition.value.copy(camera.position);
      mat.uniforms.uPhi.value = phiValue;
      mat.uniforms.uAspectRatio.value = aspectRatio;
      mat.uniforms.uRecursionStages.value = recursionStages;
      mat.uniforms.uRayCount.value = rayCount;
      mat.uniforms.uMaxBounces.value = maxBounces;
      
      if (texture) {
        mat.uniforms.uImageTexture.value = texture;
        mat.uniforms.uHasTexture.value = true;
      } else {
        mat.uniforms.uHasTexture.value = false;
      }
    }
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.0005;
    }
  });

  const material = React.useMemo(() => new PhiTensorRaymarchingMaterial(), []);

  return (
    <>
      <Stars radius={250} depth={60} count={6000} factor={4} saturation={0} fade speed={0.4} />
      
      <mesh ref={meshRef}>
        <boxGeometry args={[60, 60, 60]} />
        <primitive object={material} ref={materialRef} attach="material" />
      </mesh>

      <OrbitControls 
        autoRotate={false} 
        enablePan={true} 
        maxDistance={150} 
        minDistance={5} 
        makeDefault
      />
    </>
  );
};
