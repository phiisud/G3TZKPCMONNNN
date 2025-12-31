import { create } from 'zustand';
import * as Cesium from 'cesium';
import { Route, Coordinate } from '../types/navigation';

interface GlobeState {
  viewer: Cesium.Viewer | null;
  currentPosition: Coordinate | null;
  routes3D: Route[];
  privacyLevel: 'low' | 'medium' | 'high' | 'maximum';
  viewMode: '2d' | '3d';
  
  setViewer: (viewer: Cesium.Viewer | null) => void;
  setCurrentPosition: (position: Coordinate | null) => void;
  add3DRoute: (route: Route) => void;
  clear3DRoutes: () => void;
  updatePrivacyLayer: (level: 'low' | 'medium' | 'high' | 'maximum') => void;
  setViewMode: (mode: '2d' | '3d') => void;
}

export const useGlobeStore = create<GlobeState>((set, get) => ({
  viewer: null,
  currentPosition: null,
  routes3D: [],
  privacyLevel: 'medium',
  viewMode: '2d',
  
  setViewer: (viewer) => set({ viewer }),
  
  setCurrentPosition: (position) => set({ currentPosition: position }),
  
  add3DRoute: (route) => set((state) => ({ 
    routes3D: [...state.routes3D, route] 
  })),
  
  clear3DRoutes: () => {
    const { viewer } = get();
    if (viewer && !viewer.isDestroyed()) {
      viewer.entities.removeAll();
    }
    set({ routes3D: [] });
  },
  
  updatePrivacyLayer: (level) => set({ privacyLevel: level }),
  
  setViewMode: (mode) => set({ viewMode: mode })
}));

export default useGlobeStore;
