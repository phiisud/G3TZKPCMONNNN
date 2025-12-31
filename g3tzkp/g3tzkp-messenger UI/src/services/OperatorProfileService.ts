import { OperatorProfile } from '../types/peer';
import { g3tzkpService } from './G3TZKPService';
import { g3tzkpCrypto } from './G3TZKPCrypto';

class OperatorProfileService {
  private storageKey = 'g3tzkp-operator-profile';
  private localProfile: OperatorProfile | null = null;

  async initialize(): Promise<OperatorProfile> {
    const peerId = await g3tzkpService.initialize();
    const publicKey = g3tzkpCrypto.getPublicKey();
    
    if (!publicKey) {
      throw new Error('Failed to get public key');
    }

    const stored = localStorage.getItem(this.storageKey);
    if (stored) {
      this.localProfile = JSON.parse(stored);
      this.localProfile!.peerId = peerId;
      this.localProfile!.publicKey = publicKey;
      this.localProfile!.isOnline = true;
      this.localProfile!.lastSeen = Date.now();
      await this.saveProfile(this.localProfile!);
      return this.localProfile!;
    }

    this.localProfile = {
      peerId,
      displayName: `Operator-${peerId.substring(3, 11)}`,
      publicKey,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isOnline: true,
      lastSeen: Date.now()
    };

    await this.saveProfile(this.localProfile);
    return this.localProfile;
  }

  async updateDisplayName(displayName: string): Promise<void> {
    if (!this.localProfile) {
      throw new Error('Profile not initialized');
    }

    if (displayName.length < 2 || displayName.length > 50) {
      throw new Error('Display name must be between 2 and 50 characters');
    }

    this.localProfile.displayName = displayName;
    this.localProfile.updatedAt = Date.now();
    await this.saveProfile(this.localProfile);
    await this.broadcastProfileUpdate();
  }

  async updateBio(bio: string): Promise<void> {
    if (!this.localProfile) {
      throw new Error('Profile not initialized');
    }

    if (bio.length > 500) {
      throw new Error('Bio must be 500 characters or less');
    }

    this.localProfile.bio = bio;
    this.localProfile.updatedAt = Date.now();
    await this.saveProfile(this.localProfile);
    await this.broadcastProfileUpdate();
  }

  async updateAvatar(avatarDataUrl: string): Promise<void> {
    if (!this.localProfile) {
      throw new Error('Profile not initialized');
    }

    this.localProfile.avatar = avatarDataUrl;
    this.localProfile.updatedAt = Date.now();
    await this.saveProfile(this.localProfile);
    await this.broadcastProfileUpdate();
  }

  getLocalProfile(): OperatorProfile | null {
    return this.localProfile;
  }

  async setOnlineStatus(isOnline: boolean): Promise<void> {
    if (!this.localProfile) return;

    this.localProfile.isOnline = isOnline;
    this.localProfile.lastSeen = Date.now();
    await this.saveProfile(this.localProfile);
    
    if (isOnline) {
      await this.broadcastProfileUpdate();
    }
  }

  private async saveProfile(profile: OperatorProfile): Promise<void> {
    localStorage.setItem(this.storageKey, JSON.stringify(profile));
  }

  private async broadcastProfileUpdate(): Promise<void> {
    if (!this.localProfile) return;

    const message = {
      type: 'PROFILE_UPDATE',
      profile: this.localProfile,
      timestamp: Date.now()
    };

    const peers = g3tzkpService.getConnectedPeers();
    for (const peer of peers) {
      try {
        await g3tzkpService.sendMessage(peer.peerId, JSON.stringify(message), 'PRESENCE');
      } catch (error) {
        console.error('Failed to broadcast profile update to peer:', peer.peerId, error);
      }
    }
  }

  async requestProfileFromPeer(peerId: string): Promise<void> {
    const message = {
      type: 'PROFILE_REQUEST',
      requesterId: this.localProfile?.peerId,
      timestamp: Date.now()
    };

    try {
      await g3tzkpService.sendMessage(peerId, JSON.stringify(message), 'PRESENCE');
    } catch (error) {
      console.error('Failed to request profile from peer:', peerId, error);
    }
  }

  handleIncomingProfileMessage(from: string, content: string): OperatorProfile | null {
    try {
      const message = JSON.parse(content);
      
      if (message.type === 'PROFILE_UPDATE' && message.profile) {
        return message.profile as OperatorProfile;
      }
      
      if (message.type === 'PROFILE_REQUEST') {
        this.broadcastProfileUpdate();
      }
      
      return null;
    } catch (error) {
      console.error('Failed to handle profile message:', error);
      return null;
    }
  }
}

export const operatorProfileService = new OperatorProfileService();
