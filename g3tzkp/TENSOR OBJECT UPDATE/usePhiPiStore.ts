
import { create } from 'zustand';
import * as THREE from 'three';
import { PhiPiStore, AssetType, ManifoldType } from '../types/phiPiTypes';
import { G3Object } from '../types/blenderTypes';
import { DependencyGraph } from '../systems/DependencyGraph';

const createG3Object = (id: string, name: string, type: any): G3Object => ({
  id,
  name,
  type,
  data: '',
  location: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  matrix_world: new THREE.Matrix4().toArray(),
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

const isDeepEqual = (a: any, b: any): boolean => {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!isDeepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
      if (!isDeepEqual(a[key], b[key])) return false;
    }
    return true;
  }
  return false;
};

export const usePhiPiStore = create<any>((set, get) => ({
  phi: 1.618033988749895, pi: 3.141592653589793, 
  time: 0,
  resolution: { x: window.innerWidth, y: window.innerHeight },
  performance: { fps: 0, frameTime: 0, stepCount: 0 },
  audioMetrics: { bass: 0, mid: 0, treble: 0, fizz: 0, sub: 0, presence: 0, rms: 0, pitch: 0, centroid: 0, flux: 0, rolloff: 0, onset: false },
  ppParams: { lightingIntensity: 1.2, vignetteRadius: 1.2, vignetteFade: 0.7, bloomThreshold: 0.6, chromaticAberration: 0.2, contrast: 1.1, saturation: 1.2, colorShift: 0, halation: 0.4, filmGrain: 0.2, blackPoint: 0.01, highlightRolloff: 0.8, gModShockwave: 1, gModChaos: 1 },
  
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
  collections: {
    'coll_main': { id: 'coll_main', name: 'Scene Collection', objects: ['obj_root'], children: [], hide_viewport: false }
  },
  active_object_id: 'obj_root',
  selected_object_ids: ['obj_root'],

  uplinks: Array.from({ length: 9 }).map((_, i) => ({ id: i, type: null, url: null, texture: null, active: false })),

  project: {
    clips: {},
    tracks: [
      { id: 'v1', type: 'video', isMuted: false, isLocked: false, height: 60, volume: 100, clips: [] },
      { id: 'a1', type: 'audio', isMuted: false, isLocked: false, height: 40, volume: 100, clips: [] }
    ],
    selectedClipIds: [],
    currentTime: 0,
    isPlaying: false,
    duration: 300,
    fps: 30,
    playbackSpeed: 1.0
  },

  ui: { activeMode: 'EDIT', activeTool: 'select', isTimelineExpanded: true, isAssetsPanelOpen: true },
  activeTab: 'UPLINK',

  setActiveTab: (tab: string) => {
    if (get().activeTab === tab) return;
    set({ activeTab: tab });
  },

  updateTime: (dt: number) => {
    set((s: any) => ({ time: s.time + dt }));
  },
  
  addObject: (type: string, name?: string, manifoldType: ManifoldType = 'FLOWER_OF_LIFE_19') => {
    const s = get();
    const id = `obj_${Math.random().toString(36).substr(2, 9)}`;
    const newObj = createG3Object(id, name || `New ${type}`, type as any);
    if (type === 'MANIFOLD' && newObj.manifoldSettings) {
      newObj.manifoldSettings.type = manifoldType;
      newObj.name = `${manifoldType.replace(/_/g, ' ')} Source`;
    }
    
    const newObjects = { ...s.objects, [id]: newObj };
    const newCollections = { 
      ...s.collections,
      'coll_main': {
        ...s.collections['coll_main'],
        objects: [...s.collections['coll_main'].objects, id]
      }
    };
    
    const evaluated = DependencyGraph.evaluate(newObjects, s.objects);
    set({ 
      objects: evaluated, 
      collections: newCollections, 
      active_object_id: id, 
      selected_object_ids: [id] 
    });
  },

  updateObject: (id: string, updates: Partial<G3Object>) => {
    const s = get();
    if (!s.objects[id]) return;
    
    const currentObj = s.objects[id];
    const keys = Object.keys(updates) as (keyof G3Object)[];
    
    let hasActualChanges = false;
    for (const key of keys) {
      if (!isDeepEqual((currentObj as any)[key], (updates as any)[key])) {
        hasActualChanges = true;
        break;
      }
    }

    if (!hasActualChanges) return;

    const needsEvaluation = keys.some(k => ['location', 'rotation', 'scale', 'parent'].includes(k));
    const updatedObjects = { ...s.objects, [id]: { ...currentObj, ...updates } };
    
    if (needsEvaluation) {
      const evaluated = DependencyGraph.evaluate(updatedObjects, s.objects);
      if (s.objects === evaluated) return;
      set({ objects: evaluated });
    } else {
      set({ objects: updatedObjects });
    }
  },

  deleteObject: (id: string) => {
    const s = get();
    if (!s.objects[id]) return;
    const { [id]: _, ...objects } = s.objects;
    const collections = { ...s.collections };
    Object.keys(collections).forEach(k => {
      collections[k] = {
        ...collections[k],
        objects: collections[k].objects.filter((oid: string) => oid !== id)
      };
    });
    set({ 
      objects, 
      collections, 
      active_object_id: s.active_object_id === id ? null : s.active_object_id,
      selected_object_ids: s.selected_object_ids.filter((sid: string) => sid !== id)
    });
  },

  selectObject: (id: string, extend = false) => {
    const s = get();
    if (s.active_object_id === id && !extend) return;
    set({
      active_object_id: id,
      selected_object_ids: extend ? [...s.selected_object_ids, id] : [id]
    });
  },

  setUplinkSource: (slot: number, type: AssetType, url = null) => {
    const s = get();
    const uplinks = [...s.uplinks];
    if (uplinks[slot].type === type && uplinks[slot].url === url) return;
    uplinks[slot] = { ...uplinks[slot], type, url, active: !!type };
    set({ uplinks });
  },

  setUplinkTexture: (slot: number, texture: any) => {
    const s = get();
    if (s.uplinks[slot].texture === texture) return; 
    const uplinks = [...s.uplinks];
    uplinks[slot] = { ...uplinks[slot], texture };
    set({ uplinks });
  },

  setCurrentTime: (time: number | ((prev: number) => number)) => {
    const s = get();
    const nextTime = typeof time === 'function' ? time(s.project.currentTime) : time;
    if (Math.abs(s.project.currentTime - nextTime) < 0.0001) return; 
    set({ 
      project: { 
        ...s.project, 
        currentTime: Math.max(0, nextTime) 
      } 
    });
  },
  
  togglePlayback: () => {
    const s = get();
    set({ project: { ...s.project, isPlaying: !s.project.isPlaying } });
  },

  setActiveMode: (mode: any) => {
    const s = get();
    if (s.ui.activeMode === mode) return;
    set({ ui: { ...s.ui, activeMode: mode } });
  },

  togglePanel: (p: any) => {
    const s = get();
    const key = p === 'assets' ? 'isAssetsPanelOpen' : 'isTimelineExpanded';
    set({ ui: { ...s.ui, [key]: !s.ui[key] } });
  },
  
  updatePerformance: (m: any) => {
    const s = get();
    let changed = false;
    for (const k in m) {
      if (s.performance[k] !== m[k]) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    set({ performance: { ...s.performance, ...m } });
  },
  
  updateAudioMetrics: (m: any) => {
    const s = get();
    let changed = false;
    for (const k in m) {
      const newVal = m[k];
      const oldVal = (s.audioMetrics as any)[k];
      if (typeof newVal === 'number' && typeof oldVal === 'number') {
        if (Math.abs(newVal - oldVal) > 0.005) {
          changed = true;
          break;
        }
      } else if (newVal !== oldVal) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    set({ audioMetrics: { ...s.audioMetrics, ...m } });
  },
  
  setAudioActive: (a: boolean) => {
    const s = get();
    if (s.isAudioActive === a) return;
    set({ isAudioActive: a });
  },

  setAudioSource: (type: any, label: string | null = null) => {
    const s = get();
    if (s.activeAudioSource === type && s.audioSourceLabel === label) return;
    set({ activeAudioSource: type, audioSourceLabel: label });
  },

  updatePostProcessing: (key: string, val: number) => {
    const s = get();
    if (s.ppParams[key] === val) return;
    set({ ppParams: { ...s.ppParams, [key]: val } });
  },

  setAsset: (type: AssetType, url: string | null) => {
    const s = get();
    const activeSlot = 0; 
    const uplinks = [...s.uplinks];
    if (uplinks[activeSlot].type === type && uplinks[activeSlot].url === url) return;
    uplinks[activeSlot] = { ...uplinks[activeSlot], type, url, active: !!type };
    set({ uplinks });
  }
}));
