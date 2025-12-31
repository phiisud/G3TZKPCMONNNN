import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Coordinate, Route, OfflineRegion, TrafficSegment } from '../types/navigation';

export type TransportMode = 'car' | 'transit' | 'walk';

interface NavigationStore {
  currentLocation: Coordinate | null;
  destination: Coordinate | null;
  destinationName: string | null;
  waypoints: Coordinate[];
  currentRoute: Route | null;
  alternativeRoutes: Route[];
  isNavigating: boolean;
  transportMode: TransportMode;
  searchActive: boolean;
  menuOpen: boolean;
  currentStepIndex: number;
  distanceToNextStep: number;
  timeToDestination: number;
  heading: number;
  speed: number;
  offlineRegions: OfflineRegion[];
  trafficSegments: TrafficSegment[];
  audioGuidance: boolean;
  nightMode: boolean;
  avoidTolls: boolean;
  avoidHighways: boolean;
  autoReroute: boolean;
  hazardAlerts: boolean;
  privacyLevel: 'low' | 'medium' | 'high' | 'maximum';
  viewMode: '2d' | '3d';
  speedLimit: number | null;
  arrivalTime: Date | null;
  
  setCurrentLocation: (location: Coordinate | null) => void;
  setDestination: (destination: Coordinate | null, name?: string) => void;
  setTransportMode: (mode: TransportMode) => void;
  setSearchActive: (active: boolean) => void;
  setMenuOpen: (open: boolean) => void;
  addWaypoint: (waypoint: Coordinate) => void;
  removeWaypoint: (index: number) => void;
  clearWaypoints: () => void;
  setCurrentRoute: (route: Route | null) => void;
  setAlternativeRoutes: (routes: Route[]) => void;
  startNavigation: () => void;
  stopNavigation: () => void;
  setCurrentStepIndex: (index: number) => void;
  setDistanceToNextStep: (distance: number) => void;
  setTimeToDestination: (time: number) => void;
  setHeading: (heading: number) => void;
  setSpeed: (speed: number) => void;
  setSpeedLimit: (limit: number | null) => void;
  setArrivalTime: (time: Date | null) => void;
  addOfflineRegion: (region: OfflineRegion) => void;
  removeOfflineRegion: (id: string) => void;
  updateOfflineRegion: (id: string, updates: Partial<OfflineRegion>) => void;
  setTrafficSegments: (segments: TrafficSegment[]) => void;
  toggleAudioGuidance: () => void;
  toggleNightMode: () => void;
  toggleAvoidTolls: () => void;
  toggleAvoidHighways: () => void;
  toggleAutoReroute: () => void;
  toggleHazardAlerts: () => void;
  setPrivacyLevel: (level: 'low' | 'medium' | 'high' | 'maximum') => void;
  setViewMode: (mode: '2d' | '3d') => void;
  reset: () => void;
}

const initialState = {
  currentLocation: null,
  destination: null,
  destinationName: null,
  waypoints: [],
  currentRoute: null,
  alternativeRoutes: [],
  isNavigating: false,
  transportMode: 'car' as TransportMode,
  searchActive: false,
  menuOpen: false,
  currentStepIndex: 0,
  distanceToNextStep: 0,
  timeToDestination: 0,
  heading: 0,
  speed: 0,
  offlineRegions: [],
  trafficSegments: [],
  audioGuidance: true,
  nightMode: false,
  avoidTolls: false,
  avoidHighways: false,
  autoReroute: true,
  hazardAlerts: true,
  privacyLevel: 'medium' as const,
  viewMode: '2d' as const,
  speedLimit: null,
  arrivalTime: null,
};

export const useNavigationStore = create<NavigationStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setCurrentLocation: (location) => set({ currentLocation: location }),
      setDestination: (destination, name) => set({ destination, destinationName: name || null }),
      setTransportMode: (mode) => set({ transportMode: mode }),
      setSearchActive: (active) => set({ searchActive: active }),
      setMenuOpen: (open) => set({ menuOpen: open }),
      
      addWaypoint: (waypoint) => set((state) => ({ 
        waypoints: [...state.waypoints, waypoint] 
      })),
      
      removeWaypoint: (index) => set((state) => ({
        waypoints: state.waypoints.filter((_, i) => i !== index)
      })),
      
      clearWaypoints: () => set({ waypoints: [] }),
      
      setCurrentRoute: (route) => set({ currentRoute: route }),
      setAlternativeRoutes: (routes) => set({ alternativeRoutes: routes }),
      
      startNavigation: () => set({ 
        isNavigating: true, 
        currentStepIndex: 0 
      }),
      
      stopNavigation: () => set({ 
        isNavigating: false,
        currentStepIndex: 0,
        distanceToNextStep: 0,
        timeToDestination: 0,
        currentRoute: null,
        destination: null,
        waypoints: [],
        arrivalTime: null
      }),
      
      setCurrentStepIndex: (index) => set({ currentStepIndex: index }),
      setDistanceToNextStep: (distance) => set({ distanceToNextStep: distance }),
      setTimeToDestination: (time) => set({ timeToDestination: time }),
      setHeading: (heading) => set({ heading }),
      setSpeed: (speed) => set({ speed }),
      setSpeedLimit: (limit) => set({ speedLimit: limit }),
      setArrivalTime: (time) => set({ arrivalTime: time }),
      
      addOfflineRegion: (region) => set((state) => ({
        offlineRegions: [...state.offlineRegions, region]
      })),
      
      removeOfflineRegion: (id) => set((state) => ({
        offlineRegions: state.offlineRegions.filter(r => r.id !== id)
      })),
      
      updateOfflineRegion: (id, updates) => set((state) => ({
        offlineRegions: state.offlineRegions.map(r => 
          r.id === id ? { ...r, ...updates } : r
        )
      })),
      
      setTrafficSegments: (segments) => set({ trafficSegments: segments }),
      
      toggleAudioGuidance: () => set((state) => ({ 
        audioGuidance: !state.audioGuidance 
      })),
      
      toggleNightMode: () => set((state) => ({ 
        nightMode: !state.nightMode 
      })),
      
      toggleAvoidTolls: () => set((state) => ({ 
        avoidTolls: !state.avoidTolls 
      })),
      
      toggleAvoidHighways: () => set((state) => ({ 
        avoidHighways: !state.avoidHighways 
      })),
      
      toggleAutoReroute: () => set((state) => ({ 
        autoReroute: !state.autoReroute 
      })),
      
      toggleHazardAlerts: () => set((state) => ({ 
        hazardAlerts: !state.hazardAlerts 
      })),
      
      setPrivacyLevel: (level) => set({ privacyLevel: level }),
      setViewMode: (mode) => set({ viewMode: mode }),
      
      reset: () => set(initialState)
    }),
    {
      name: 'g3zkp-navigation-store',
      partialize: (state) => ({
        audioGuidance: state.audioGuidance,
        nightMode: state.nightMode,
        avoidTolls: state.avoidTolls,
        avoidHighways: state.avoidHighways,
        autoReroute: state.autoReroute,
        hazardAlerts: state.hazardAlerts,
        privacyLevel: state.privacyLevel,
        viewMode: state.viewMode,
        offlineRegions: state.offlineRegions
      })
    }
  )
);

export default useNavigationStore;
