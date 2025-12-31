import React, { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PhiTensorVisualization } from './components/PhiTensorVisualization';
import { TerminalManifold } from './components/TerminalManifold';

const App: React.FC = () => {
  const [phiValue, setPhiValue] = useState(1.017);
  const [recursionStages, setRecursionStages] = useState(1);
  const [rayCount] = useState(64.0);
  const [maxBounces] = useState(20.0);
  const [sourceImage, setSourceImage] = useState<File | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);

  return (
    <div className="relative w-full h-screen bg-[#050308]">
      <Canvas
        camera={{ position: [0, 5, 45], fov: 40 }}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={['#050308']} />
        <ambientLight intensity={0.4} />
        <pointLight position={[15, 15, 15]} intensity={1.5} />
        
        <Suspense fallback={null}>
          <PhiTensorVisualization 
            phiValue={phiValue} 
            recursionStages={recursionStages}
            rayCount={rayCount}
            maxBounces={maxBounces}
            sourceImage={sourceImage}
            isCameraActive={isCameraActive}
          />
        </Suspense>
      </Canvas>

      <div className="absolute top-4 left-4 text-white pointer-events-none z-10">
        <h1 className="text-2xl font-black tracking-tighter uppercase opacity-90 flex items-center gap-2">
          <span className="text-cyan-400">G3TZKP</span>
          <span className="text-xs bg-cyan-600 text-white px-2 py-0.5 rounded-full font-bold">CLI</span>
        </h1>
        <p className="text-xs font-mono opacity-50 tracking-widest text-cyan-300">
          Bijective Tensor Manifold Interface
        </p>
      </div>

      <div className="absolute top-4 right-4 flex items-center gap-3 z-10">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-black/50 border border-cyan-500/30 rounded-full text-xs">
          <div className={`w-2 h-2 rounded-full ${isCameraActive ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
          <span className="text-cyan-400">{isCameraActive ? 'LIVE UPLINK' : 'OFFLINE'}</span>
        </div>
        {sourceImage && !isCameraActive && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-black/50 border border-cyan-500/30 rounded-full text-xs">
            <div className="w-2 h-2 rounded-full bg-blue-400" />
            <span className="text-cyan-400 truncate max-w-[120px]">{sourceImage.name}</span>
          </div>
        )}
      </div>

      <TerminalManifold
        onImageUpload={setSourceImage}
        isCameraActive={isCameraActive}
        setIsCameraActive={setIsCameraActive}
        phiValue={phiValue}
        setPhiValue={setPhiValue}
        recursionStages={recursionStages}
        setRecursionStages={setRecursionStages}
      />
    </div>
  );
};

export default App;
