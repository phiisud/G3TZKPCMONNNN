import { create } from 'zustand';
import * as THREE from 'three';
import { 
  PhiPiState, 
  UplinkSlot, 
  G3Object, 
  ManifoldType, 
  AssetType,
  AudioMetrics,
  BijectiveTensorObject,
  PHI,
  PI
} from '../types/phiPiTypes';

const createG3Object = (id: string, name: string, type: 'MANIFOLD' | 'EMPTY' | 'MESH'): G3Object => ({
  id,
  name,
  type,
  data: '',
  location: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  matrix_world: new THREE.Matrix4().toArray() as number[],
  parent: null,
  children: [],
  hide_viewport: false,
  hide_render: false,
  hide_select: false,
  manifoldSettings: {
    type: 'FLOWER_OF_LIFE_19',
    uplinkSlot: 0,
    excisionLevel: 0.1,
    uplinkExtrusion: 5.0,
    phantomMode: 'NONE',
    audioReactivity: 2.0,
    customParams: Array(40).fill(0.5)
  }
});

const initialUplinks: UplinkSlot[] = Array.from({ length: 9 }).map((_, i) => ({
  id: i,
  type: null,
  url: null,
  texture: null,
  active: false
}));

interface PhiPiStore extends PhiPiState {
  updateTime: (dt: number) => void;
  setManifoldType: (type: ManifoldType) => void;
  setBioColor: (color: [number, number, number]) => void;
  setDepthScale: (value: number) => void;
  setMetricExtension: (value: number) => void;
  setEigenValue: (value: number) => void;
  setUplinkExtrusion: (value: number) => void;
  setExcisionLevel: (value: number) => void;
  setAudioReactivity: (value: number) => void;
  setUplinkSource: (slot: number, type: AssetType, url?: string | null, file?: File) => void;
  setUplinkTexture: (slot: number, texture: THREE.Texture | null) => void;
  clearUplink: (slot: number) => void;
  updateAudioMetrics: (metrics: Partial<AudioMetrics>) => void;
  setAudioActive: (active: boolean) => void;
  setAudioSource: (source: 'none' | 'microphone' | 'system' | 'file', label?: string | null) => void;
  updatePerformance: (metrics: Partial<PhiPiState['performance']>) => void;
  addBijectiveObject: (obj: BijectiveTensorObject) => void;
  removeBijectiveObject: (id: string) => void;
  addObject: (type: 'MANIFOLD' | 'EMPTY' | 'MESH', name?: string, manifoldType?: ManifoldType) => void;
  updateObject: (id: string, updates: Partial<G3Object>) => void;
  deleteObject: (id: string) => void;
  selectObject: (id: string, extend?: boolean) => void;
}

export const usePhiPiStore = create<PhiPiStore>((set, get) => ({
  phi: PHI,
  pi: PI,
  time: 0,
  resolution: { x: typeof window !== 'undefined' ? window.innerWidth : 1920, y: typeof window !== 'undefined' ? window.innerHeight : 1080 },
  performance: { fps: 0, frameTime: 0, stepCount: 0, tensorOperations: 0 },
  audioMetrics: { 
    bass: 0, mid: 0, treble: 0, fizz: 0, sub: 0, presence: 0, 
    rms: 0, pitch: 0, centroid: 0, flux: 0, rolloff: 0, onset: false 
  },
  ppParams: {
    lightingIntensity: 1.2,
    vignetteRadius: 1.2,
    vignetteFade: 0.7,
    bloomThreshold: 0.6,
    chromaticAberration: 0.2,
    contrast: 1.1,
    saturation: 1.2,
    colorShift: 0,
    halation: 0.4,
    filmGrain: 0.2,
    blackPoint: 0.01,
    highlightRolloff: 0.8
  },
  bioColor: [0.0, 0.45, 1.0],
  proximity: 0.0,
  metricExtension: 12.0,
  depthScale: 1.2,
  audioReactivity: 2.0,
  lidarMode: 0,
  reconSensitivity: 0.5,
  scanSpeed: 1.0,
  projectionFov: 1.5,
  showScanlines: true,
  focalAlignment: 0,
  eigenValue: 2.618,
  uplinkExtrusion: 5.0,
  excisionLevel: 0.1,
  customParams: Array(40).fill(0.5),
  objects: {
    'obj_root': createG3Object('obj_root', 'Master Manifold', 'MANIFOLD')
  },
  active_object_id: 'obj_root',
  selected_object_ids: ['obj_root'],
  uplinks: initialUplinks,
  manifoldType: 'FLOWER_OF_LIFE_19',
  isAudioActive: false,
  activeAudioSource: 'none',
  audioSourceLabel: null,
  bijectiveObjects: [],

  updateTime: (dt: number) => {
    set((s) => ({ time: s.time + dt }));
  },

  setManifoldType: (type: ManifoldType) => {
    set({ manifoldType: type });
  },

  setBioColor: (color: [number, number, number]) => {
    set({ bioColor: color });
  },

  setDepthScale: (value: number) => {
    set({ depthScale: value });
  },

  setMetricExtension: (value: number) => {
    set({ metricExtension: value });
  },

  setEigenValue: (value: number) => {
    set({ eigenValue: value });
  },

  setUplinkExtrusion: (value: number) => {
    set({ uplinkExtrusion: value });
  },

  setExcisionLevel: (value: number) => {
    set({ excisionLevel: value });
  },

  setAudioReactivity: (value: number) => {
    set({ audioReactivity: value });
  },

  setUplinkSource: (slot: number, type: AssetType, url: string | null = null, file?: File) => {
    const s = get();
    const uplinks = [...s.uplinks];
    uplinks[slot] = { 
      ...uplinks[slot], 
      type, 
      url, 
      active: !!type,
      file 
    };
    set({ uplinks });
  },

  setUplinkTexture: (slot: number, texture: THREE.Texture | null) => {
    const s = get();
    const uplinks = [...s.uplinks];
    uplinks[slot] = { ...uplinks[slot], texture };
    set({ uplinks });
  },

  clearUplink: (slot: number) => {
    const s = get();
    const uplinks = [...s.uplinks];
    uplinks[slot] = { 
      id: slot, 
      type: null, 
      url: null, 
      texture: null, 
      active: false 
    };
    set({ uplinks });
  },

  updateAudioMetrics: (metrics: Partial<AudioMetrics>) => {
    set((s) => ({ audioMetrics: { ...s.audioMetrics, ...metrics } }));
  },

  setAudioActive: (active: boolean) => {
    set({ isAudioActive: active });
  },

  setAudioSource: (source: 'none' | 'microphone' | 'system' | 'file', label: string | null = null) => {
    set({ activeAudioSource: source, audioSourceLabel: label });
  },

  updatePerformance: (metrics: Partial<PhiPiState['performance']>) => {
    set((s) => ({ performance: { ...s.performance, ...metrics } }));
  },

  addBijectiveObject: (obj: BijectiveTensorObject) => {
    set((s) => ({ bijectiveObjects: [...s.bijectiveObjects, obj] }));
  },

  removeBijectiveObject: (id: string) => {
    set((s) => ({ bijectiveObjects: s.bijectiveObjects.filter(o => o.id !== id) }));
  },

  addObject: (type: 'MANIFOLD' | 'EMPTY' | 'MESH', name?: string, manifoldType: ManifoldType = 'FLOWER_OF_LIFE_19') => {
    const s = get();
    const id = `obj_${Math.random().toString(36).substr(2, 9)}`;
    const newObj = createG3Object(id, name || `New ${type}`, type);
    if (type === 'MANIFOLD' && newObj.manifoldSettings) {
      newObj.manifoldSettings.type = manifoldType;
      newObj.name = `${manifoldType.replace(/_/g, ' ')} Source`;
    }
    set({ 
      objects: { ...s.objects, [id]: newObj },
      active_object_id: id,
      selected_object_ids: [id]
    });
  },

  updateObject: (id: string, updates: Partial<G3Object>) => {
    const s = get();
    if (!s.objects[id]) return;
    set({
      objects: { ...s.objects, [id]: { ...s.objects[id], ...updates } }
    });
  },

  deleteObject: (id: string) => {
    const s = get();
    if (!s.objects[id] || id === 'obj_root') return;
    const { [id]: _, ...objects } = s.objects;
    set({
      objects,
      active_object_id: s.active_object_id === id ? 'obj_root' : s.active_object_id,
      selected_object_ids: s.selected_object_ids.filter(sid => sid !== id)
    });
  },

  selectObject: (id: string, extend = false) => {
    const s = get();
    set({
      active_object_id: id,
      selected_object_ids: extend ? [...s.selected_object_ids, id] : [id]
    });
  }
}));
