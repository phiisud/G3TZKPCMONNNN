import { Vector2, Vector3 } from 'three';

export interface TensorPixel {
  position: Vector2;
  color: [number, number, number, number];
  scalar: number;
  bivector: Vector3;
  trivector: number;
  magnitude: number;
  rank: number;
}

export interface TensorField {
  pixels: TensorPixel[];
  width: number;
  height: number;
  resolution: number;
  phiValue: number;
  piValue: number;
  timestamp: number;
}

export interface FlowerRay {
  origin: Vector2;
  direction: Vector2;
  length: number;
  generation: number;
  phiScaled: boolean;
  active: boolean;
}

export interface FlowerOfLifePattern {
  center: Vector2;
  generations: number;
  rays: FlowerRay[];
  circles: Array<{ center: Vector2; radius: number; generation: number }>;
  totalRays: number;
  phiConstant: number;
  piConstant: number;
}

export interface GeometricProductResult {
  pixel1: TensorPixel;
  pixel2: TensorPixel;
  scalarPart: number;
  bivectorPart: Vector3;
  trivectorPart: number;
  grade: number;
  distance: number;
}

export interface TensorPerformanceMetrics {
  fps: number;
  frameTime: number;
  stepCount: number;
  tensorOperations: number;
  geometricProducts: number;
  activeRays: number;
  tensorFieldSize: number;
  optimizationRatio: number;
}

export interface TensorStore {
  phi: number;
  pi: number;
  phiStepMultiplier: number;
  piPrecisionThreshold: number;
  maxSteps: number;
  maxDistance: number;
  depthScale: number;
  metricExtension: number;
  eigenValue: number;
  zkpProofConsistency: number;
  
  // Texture modulation
  saturation: number;
  brightness: number;
  exposure: number;
  contrast: number;
  shadows: number;
  highlights: number;
  vibrance: number;
  hue: number;
  bwFilter: number;
  
  // Zoom control
  zoomLevel: number;
  
  stitchDensity: number;
  volumetricDepth: number;
  manifoldContinuity: number;
  resolution: { x: number; y: number };
  time: number;
  cameraPosition: [number, number, number];
  mouse: [number, number];
  showPhiSteps: boolean;
  showDistanceField: boolean;
  showNormals: boolean;
  showTensorField: boolean;
  showFlowerOfLife: boolean;
  performance: {
    fps: number;
    frameTime: number;
    stepCount: number;
  };
  activeAssetType: 'image' | 'video' | null;
  assetUrl: string | null;
  assetTexture: any;
  tensorRank: number;
  flowerOfLifeGenerations: number;
  geometricProductThreshold: number;
  tensorFieldResolution: number;
  piRayDensity: number;
  coordinateInvariance: boolean;
  bivectorScale: number;
  trivectorScale: number;
  tensorMagnitude: number;
  flowerOfLifeActive: boolean;
  flowerOfLifeRotation: number;
  sacredGeometryScale: number;
  computationalOptimization: boolean;
  tensorFieldCulling: boolean;
  geometricProductBatching: boolean;
  tensorField: TensorField | null;
  tensorFieldVersion: number;
  flowerOfLifePattern: FlowerOfLifePattern | null;
  tensorPerformance: TensorPerformanceMetrics;
  setPhi: (phi: number) => void;
  setPi: (pi: number) => void;
  setPhiStepMultiplier: (value: number) => void;
  setPiPrecisionThreshold: (value: number) => void;
  setMaxSteps: (value: number) => void;
  setDepthScale: (value: number) => void;
  setMetricExtension: (value: number) => void;
  setEigenValue: (value: number) => void;
  setZkpProofConsistency: (value: number) => void;
  
  // Texture modulation setters
  setSaturation: (value: number) => void;
  setBrightness: (value: number) => void;
  setExposure: (value: number) => void;
  setContrast: (value: number) => void;
  setShadows: (value: number) => void;
  setHighlights: (value: number) => void;
  setVibrance: (value: number) => void;
  setHue: (value: number) => void;
  setBwFilter: (value: number) => void;
  
  // Zoom control
  setZoomLevel: (value: number) => void;
  
  setStitchDensity: (value: number) => void;
  setVolumetricDepth: (value: number) => void;
  setManifoldContinuity: (value: number) => void;
  updateTime: (dt: number) => void;
  setMouse: (x: number, y: number) => void;
  toggleDebug: (key: string) => void;
  setCameraPosition: (position: [number, number, number]) => void;
  updatePerformance: (performance: any) => void;
  setAsset: (type: 'image' | 'video' | null, url?: string | null) => void;
  setAssetTexture: (texture: any) => void;
  setTensorRank: (rank: number) => void;
  setFlowerOfLifeGenerations: (generations: number) => void;
  setGeometricProductThreshold: (threshold: number) => void;
  setTensorFieldResolution: (resolution: number) => void;
  setPiRayDensity: (density: number) => void;
  setCoordinateInvariance: (value: boolean) => void;
  setBivectorScale: (scale: number) => void;
  setTrivectorScale: (scale: number) => void;
  setTensorMagnitude: (magnitude: number) => void;
  setFlowerOfLifeActive: (active: boolean) => void;
  setFlowerOfLifeRotation: (rotation: number) => void;
  setSacredGeometryScale: (scale: number) => void;
  setComputationalOptimization: (value: boolean) => void;
  setTensorFieldCulling: (value: boolean) => void;
  setGeometricProductBatching: (value: boolean) => void;
  processTensorField: (imageData: ImageData, width: number, height: number) => void;
  calculateGeometricProducts: () => GeometricProductResult[];
  updateFlowerOfLifeRays: () => void;
  updateTensorPerformance: (metrics: Partial<TensorPerformanceMetrics>) => void;
  setTensorField: (field: TensorField | null) => void;
  setFlowerOfLifePattern: (pattern: FlowerOfLifePattern | null) => void;
}
