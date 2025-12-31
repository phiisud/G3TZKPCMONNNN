import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SharedLocation, LiveLocationUpdate } from '../types/location';

interface LocationState {
  sharedLocations: Map<string, SharedLocation>;
  liveLocationUpdates: Map<string, LiveLocationUpdate[]>;
  activeLiveShares: Set<string>;
  
  addSharedLocation: (location: SharedLocation) => void;
  getSharedLocation: (id: string) => SharedLocation | undefined;
  addLiveLocationUpdate: (update: LiveLocationUpdate) => void;
  getLiveLocationUpdates: (locationId: string) => LiveLocationUpdate[];
  startLiveShare: (locationId: string) => void;
  stopLiveShare: (locationId: string) => void;
  isLiveShareActive: (locationId: string) => boolean;
  cleanupExpiredLocations: () => void;
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set, get) => ({
      sharedLocations: new Map(),
      liveLocationUpdates: new Map(),
      activeLiveShares: new Set(),

      addSharedLocation: (location: SharedLocation) => {
        set((state) => {
          const newLocations = new Map(state.sharedLocations);
          newLocations.set(location.id, location);
          return { sharedLocations: newLocations };
        });
      },

      getSharedLocation: (id: string) => {
        return get().sharedLocations.get(id);
      },

      addLiveLocationUpdate: (update: LiveLocationUpdate) => {
        set((state) => {
          const newUpdates = new Map(state.liveLocationUpdates);
          const existing = newUpdates.get(update.locationId) || [];
          const updated = [...existing, update].slice(-50);
          newUpdates.set(update.locationId, updated);
          return { liveLocationUpdates: newUpdates };
        });
      },

      getLiveLocationUpdates: (locationId: string) => {
        return get().liveLocationUpdates.get(locationId) || [];
      },

      startLiveShare: (locationId: string) => {
        set((state) => {
          const newShares = new Set(state.activeLiveShares);
          newShares.add(locationId);
          return { activeLiveShares: newShares };
        });
      },

      stopLiveShare: (locationId: string) => {
        set((state) => {
          const newShares = new Set(state.activeLiveShares);
          newShares.delete(locationId);
          return { activeLiveShares: newShares };
        });
      },

      isLiveShareActive: (locationId: string) => {
        return get().activeLiveShares.has(locationId);
      },

      cleanupExpiredLocations: () => {
        const now = Date.now();
        set((state) => {
          const newLocations = new Map(state.sharedLocations);
          for (const [id, location] of newLocations.entries()) {
            if (location.expiresAt && location.expiresAt < now) {
              newLocations.delete(id);
            }
          }
          return { sharedLocations: newLocations };
        });
      }
    }),
    {
      name: 'g3zkp-location-storage',
      partialize: (state) => ({
        sharedLocations: Array.from(state.sharedLocations.entries()),
        liveLocationUpdates: Array.from(state.liveLocationUpdates.entries())
      }),
      merge: (persistedState: any, currentState) => ({
        ...currentState,
        sharedLocations: new Map(persistedState.sharedLocations || []),
        liveLocationUpdates: new Map(persistedState.liveLocationUpdates || [])
      })
    }
  )
);
