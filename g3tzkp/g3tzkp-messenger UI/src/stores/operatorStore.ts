import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { OperatorProfile, OperatorStatus, OperatorSettings, DEFAULT_OPERATOR_SETTINGS } from '../types';

const STORAGE_KEY = 'g3zkp-operator-profile';
const BROADCAST_CHANNEL_NAME = 'g3zkp-operator-sync';

interface OperatorStore {
  profile: OperatorProfile | null;
  isInitialized: boolean;
  
  initializeProfile: (peerId: string, publicKey: string) => void;
  updateProfile: (updates: Partial<OperatorProfile>) => void;
  updateSettings: (updates: Partial<OperatorSettings>) => void;
  setStatus: (status: OperatorStatus) => void;
  setAvatar: (avatarUrl: string | null) => void;
  setDisplayName: (name: string) => void;
  
  getDisplayName: () => string;
  getPeerId: () => string;
  getAvatarUrl: () => string | null;
  getProfile: () => OperatorProfile | null;
  
  broadcastProfileUpdate: () => void;
}

const generateDefaultProfile = (peerId: string, publicKey: string): OperatorProfile => ({
  id: `operator_${Date.now()}`,
  peerId,
  displayName: 'LOCAL_OPERATOR',
  publicKey,
  status: OperatorStatus.ONLINE,
  statusMessage: '',
  createdAt: Date.now(),
  lastSeenAt: Date.now(),
  isVerified: false,
  bio: '',
  settings: { ...DEFAULT_OPERATOR_SETTINGS }
});

let broadcastChannel: BroadcastChannel | null = null;

const initBroadcastChannel = (updateFromBroadcast: (profile: OperatorProfile) => void) => {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
  
  try {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    broadcastChannel.onmessage = (event) => {
      if (event.data?.type === 'PROFILE_UPDATE' && event.data?.profile) {
        console.log('[OperatorStore] Received profile update from another tab');
        updateFromBroadcast(event.data.profile);
      }
    };
  } catch (error) {
    console.warn('[OperatorStore] BroadcastChannel not available:', error);
  }
};

export const useOperatorStore = create<OperatorStore>()(
  persist(
    (set, get) => {
      if (typeof window !== 'undefined') {
        initBroadcastChannel((profile) => {
          set({ profile, isInitialized: true });
        });
      }

      return {
        profile: null,
        isInitialized: false,

        initializeProfile: (peerId: string, publicKey: string) => {
          const existing = get().profile;
          if (existing && existing.peerId === peerId) {
            set({ isInitialized: true });
            return;
          }
          
          const newProfile = generateDefaultProfile(peerId, publicKey);
          set({ profile: newProfile, isInitialized: true });
          console.log('[OperatorStore] Initialized new profile:', newProfile.displayName);
        },

        updateProfile: (updates: Partial<OperatorProfile>) => {
          const current = get().profile;
          if (!current) return;
          
          const updatedProfile = {
            ...current,
            ...updates,
            lastSeenAt: Date.now()
          };
          
          set({ profile: updatedProfile });
          get().broadcastProfileUpdate();
          
          console.log('[OperatorStore] Profile updated:', Object.keys(updates));
        },

        updateSettings: (updates: Partial<OperatorSettings>) => {
          const current = get().profile;
          if (!current) return;
          
          const updatedProfile = {
            ...current,
            settings: {
              ...current.settings,
              ...updates
            },
            lastSeenAt: Date.now()
          };
          
          set({ profile: updatedProfile });
          get().broadcastProfileUpdate();
        },

        setStatus: (status: OperatorStatus) => {
          get().updateProfile({ status });
        },

        setAvatar: (avatarUrl: string | null) => {
          get().updateProfile({ avatarUrl: avatarUrl || undefined, avatar: avatarUrl || undefined });
        },

        setDisplayName: (name: string) => {
          get().updateProfile({ displayName: name });
        },

        getDisplayName: () => {
          return get().profile?.displayName || 'Unknown Operator';
        },

        getPeerId: () => {
          return get().profile?.peerId || '';
        },

        getAvatarUrl: () => {
          const profile = get().profile;
          return profile?.avatarUrl || profile?.avatar || null;
        },

        getProfile: () => {
          return get().profile;
        },

        broadcastProfileUpdate: () => {
          const profile = get().profile;
          if (!profile || !broadcastChannel) return;
          
          try {
            broadcastChannel.postMessage({
              type: 'PROFILE_UPDATE',
              profile,
              timestamp: Date.now()
            });
          } catch (error) {
            console.warn('[OperatorStore] Failed to broadcast update:', error);
          }
        }
      };
    },
    {
      name: STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ profile: state.profile }),
      onRehydrate: () => (state) => {
        if (state) {
          state.isInitialized = true;
          console.log('[OperatorStore] Rehydrated profile:', state.profile?.displayName);
        }
      }
    }
  )
);

export const updateGroupMemberProfiles = async (
  operatorProfile: OperatorProfile,
  getGroups: () => Promise<any[]>,
  updateGroupMember: (groupId: string, peerId: string, updates: any) => Promise<void>
) => {
  try {
    const groups = await getGroups();
    const updatePromises = groups.map(async (group) => {
      const isMember = group.members?.some((m: any) => m.peerId === operatorProfile.peerId);
      if (isMember) {
        await updateGroupMember(group.id, operatorProfile.peerId, {
          displayName: operatorProfile.displayName,
          avatar: operatorProfile.avatarUrl || operatorProfile.avatar
        });
      }
    });
    
    await Promise.all(updatePromises);
    console.log('[OperatorStore] Updated member profiles in', groups.length, 'groups');
  } catch (error) {
    console.error('[OperatorStore] Failed to update group member profiles:', error);
  }
};

export default useOperatorStore;
