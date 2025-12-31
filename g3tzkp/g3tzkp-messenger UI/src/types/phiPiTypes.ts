import * as THREE from 'three';

export const PHI = 1.618033988749895;
export const PI = 3.141592653589793;

export type AssetType = 'image' | 'video' | 'camera' | 'audio' | null;

export type ManifoldType = 
  | 'FLOWER_OF_LIFE_19'
  | 'CLIFFORD_TORUS'
  | 'MOBIUS_FOLD'
  | 'SINGULARITY'
  | 'HYPERDRIVE_UPLINK'
  | 'KLEIN_SLICE'
  | 'CALABI_YAU'
  | 'NEURAL_FRACTAL'
  | 'PHI_GEODESIC'
  | 'TORUS';

export interface UplinkSlot {
  id: number;
  type: AssetType;
  url: string | null;
  texture: THREE.Texture | null;
  active: boolean;
  file?: File;
}

export interface AudioMetrics {
  bass: number;
  mid: number;
  treble: number;
  fizz: number;
  sub: number;
  presence: number;
  rms: number;
  pitch: number;
  centroid: number;
  flux: number;
  rolloff: number;
  onset: boolean;
}

export interface ManifoldSettings {
  type: ManifoldType;
  uplinkSlot: number;
  excisionLevel: number;
  uplinkExtrusion: number;
  phantomMode: 'NONE' | 'GHOST' | 'ECHO';
  audioReactivity: number;
  customParams: number[];
}

export interface G3Object {
  id: string;
  name: string;
  type: 'MANIFOLD' | 'EMPTY' | 'MESH';
  data: string;
  location: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  matrix_world: number[];
  parent: string | null;
  children: string[];
  hide_viewport: boolean;
  hide_render: boolean;
  hide_select: boolean;
  manifoldSettings?: ManifoldSettings;
}

export interface BijectiveTensorObject {
  id: string;
  sourceFile: {
    name: string;
    type: string;
    size: number;
    hash: string;
  };
  tensorData: {
    dimensions: { width: number; height: number; depth: number };
    pixelCount: number;
    tensorRank: number;
    phiValue: number;
    piValue: number;
  };
  manifoldConfig: {
    type: ManifoldType;
    depthScale: number;
    metricExtension: number;
    eigenValue: number;
    uplinkExtrusion: number;
  };
  flowerOfLife: {
    generations: number;
    rayCount: number;
    sacredGeometryScale: number;
  };
  proof?: {
    commitment: string;
    nullifier: string;
    verified: boolean;
  };
  thumbnailUrl?: string;
  createdAt: number;
}

export interface PostProcessingParams {
  lightingIntensity: number;
  vignetteRadius: number;
  vignetteFade: number;
  bloomThreshold: number;
  chromaticAberration: number;
  contrast: number;
  saturation: number;
  colorShift: number;
  halation: number;
  filmGrain: number;
  blackPoint: number;
  highlightRolloff: number;
}

export interface PhiPiPerformance {
  fps: number;
  frameTime: number;
  stepCount: number;
  tensorOperations: number;
}

export interface PhiPiState {
  phi: number;
  pi: number;
  time: number;
  resolution: { x: number; y: number };
  performance: PhiPiPerformance;
  audioMetrics: AudioMetrics;
  ppParams: PostProcessingParams;
  bioColor: [number, number, number];
  proximity: number;
  metricExtension: number;
  depthScale: number;
  audioReactivity: number;
  lidarMode: number;
  reconSensitivity: number;
  scanSpeed: number;
  projectionFov: number;
  showScanlines: boolean;
  focalAlignment: number;
  eigenValue: number;
  uplinkExtrusion: number;
  excisionLevel: number;
  customParams: number[];
  objects: Record<string, G3Object>;
  active_object_id: string | null;
  selected_object_ids: string[];
  uplinks: UplinkSlot[];
  manifoldType: ManifoldType;
  isAudioActive: boolean;
  activeAudioSource: 'none' | 'microphone' | 'system' | 'file';
  audioSourceLabel: string | null;
  bijectiveObjects: BijectiveTensorObject[];
}
