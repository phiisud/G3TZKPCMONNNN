import { G3TZKPBusinessProfile } from '../types/business';
import { businessProfileService } from './BusinessProfileService';

export interface BusinessUpdateMessage {
  type: 'BUSINESS_PROFILE_UPDATE' | 'BUSINESS_PROFILE_CREATE' | 'BUSINESS_PROFILE_DELETE' | 'BUSINESS_SYNC_REQUEST';
  timestamp: number;
  senderId: string;
  senderName: string;
  profile?: G3TZKPBusinessProfile;
  profileId?: string;
  signature?: string;
  version: string;
}

export interface P2PUpdateHandler {
  onProfileUpdated: (profile: G3TZKPBusinessProfile) => void;
  onProfileCreated: (profile: G3TZKPBusinessProfile) => void;
  onProfileDeleted: (profileId: string) => void;
}

class BusinessP2PUpdateService {
  private topic = '/g3tzkp/business-updates/1.0.0';
  private localPeerId: string = '';
  private updateHandlers: P2PUpdateHandler[] = [];
  private pendingUpdates: Map<string, BusinessUpdateMessage> = new Map();
  private syncInProgress: boolean = false;

  constructor() {
    this.localPeerId = `peer-${Math.random().toString(36).substr(2, 9)}`;
  }

  registerUpdateHandler(handler: P2PUpdateHandler): void {
    this.updateHandlers.push(handler);
  }

  async publishProfileUpdate(profile: G3TZKPBusinessProfile): Promise<void> {
    const message: BusinessUpdateMessage = {
      type: 'BUSINESS_PROFILE_UPDATE',
      timestamp: Date.now(),
      senderId: this.localPeerId,
      senderName: 'G3TZKP-LOCAL',
      profile,
      signature: await this.signMessage(profile),
      version: '1.0.0'
    };

    await this.broadcastMessage(message);
    this.pendingUpdates.set(profile.id, message);
  }

  async publishProfileCreation(profile: G3TZKPBusinessProfile): Promise<void> {
    const message: BusinessUpdateMessage = {
      type: 'BUSINESS_PROFILE_CREATE',
      timestamp: Date.now(),
      senderId: this.localPeerId,
      senderName: 'G3TZKP-LOCAL',
      profile,
      signature: await this.signMessage(profile),
      version: '1.0.0'
    };

    await this.broadcastMessage(message);
    this.pendingUpdates.set(profile.id, message);
  }

  async publishProfileDeletion(profileId: string): Promise<void> {
    const message: BusinessUpdateMessage = {
      type: 'BUSINESS_PROFILE_DELETE',
      timestamp: Date.now(),
      senderId: this.localPeerId,
      senderName: 'G3TZKP-LOCAL',
      profileId,
      signature: this.signDeletion(profileId),
      version: '1.0.0'
    };

    await this.broadcastMessage(message);
  }

  async requestSync(): Promise<void> {
    if (this.syncInProgress) return;

    this.syncInProgress = true;
    const message: BusinessUpdateMessage = {
      type: 'BUSINESS_SYNC_REQUEST',
      timestamp: Date.now(),
      senderId: this.localPeerId,
      senderName: 'G3TZKP-LOCAL',
      version: '1.0.0'
    };

    await this.broadcastMessage(message);
    
    setTimeout(() => {
      this.syncInProgress = false;
    }, 5000);
  }

  async handleIncomingMessage(message: BusinessUpdateMessage): Promise<void> {
    if (!this.validateMessage(message)) {
      console.warn('❌ Invalid business update message, ignoring');
      return;
    }

    if (message.senderId === this.localPeerId) {
      return;
    }

    try {
      switch (message.type) {
        case 'BUSINESS_PROFILE_UPDATE':
          await this.handleProfileUpdate(message);
          break;
        case 'BUSINESS_PROFILE_CREATE':
          await this.handleProfileCreation(message);
          break;
        case 'BUSINESS_PROFILE_DELETE':
          await this.handleProfileDeletion(message);
          break;
        case 'BUSINESS_SYNC_REQUEST':
          await this.handleSyncRequest(message);
          break;
      }
    } catch (error) {
      console.error('Failed to handle business update message:', error);
    }
  }

  private async handleProfileUpdate(message: BusinessUpdateMessage): Promise<void> {
    if (!message.profile) return;

    const existing = await businessProfileService.getBusinessProfileById(message.profile.id);
    if (!existing) {
      await this.handleProfileCreation(message);
      return;
    }

    if (message.timestamp > existing.updatedAt) {
      const updated = {
        ...existing,
        ...message.profile,
        updatedAt: message.timestamp
      };

      try {
        await businessProfileService.updateBusinessProfile({
          id: updated.id,
          bio: updated.bio,
          description: updated.description,
          category: updated.category,
          contact: updated.contact,
          hours: updated.hours
        });

        this.updateHandlers.forEach(h => h.onProfileUpdated(updated));
      } catch (error) {
        console.error('Failed to update business profile from P2P:', error);
      }
    }
  }

  private async handleProfileCreation(message: BusinessUpdateMessage): Promise<void> {
    if (!message.profile) return;

    const existing = await businessProfileService.getBusinessProfileById(message.profile.id);
    if (existing) {
      await this.handleProfileUpdate(message);
      return;
    }

    try {
      const created = await businessProfileService.createBusinessProfile({
        crn: message.profile.crn,
        name: message.profile.name,
        description: message.profile.description,
        category: message.profile.category,
        latitude: message.profile.location.latitude,
        longitude: message.profile.location.longitude,
        address: message.profile.location.address,
        contact: message.profile.contact,
        hours: message.profile.hours,
        verificationKey: message.profile.verificationKey || '',
        cryptoKeyId: message.profile.cryptoKeyId || '',
        bio: message.profile.bio || '',
        ownerId: message.profile.verified_by
      });

      if (message.profile.photos) {
        created.photos = message.profile.photos;
      }
      if (message.profile.products) {
        created.products = message.profile.products;
      }
      if (message.profile.featuredProductIds) {
        created.featuredProductIds = message.profile.featuredProductIds;
      }

      this.updateHandlers.forEach(h => h.onProfileCreated(created));
    } catch (error) {
      console.error('Failed to create business profile from P2P:', error);
    }
  }

  private async handleProfileDeletion(message: BusinessUpdateMessage): Promise<void> {
    if (!message.profileId) return;

    const deleted = await businessProfileService.deleteBusinessProfile(message.profileId);
    if (deleted) {
      this.updateHandlers.forEach(h => h.onProfileDeleted(message.profileId!));
    }
  }

  private async handleSyncRequest(message: BusinessUpdateMessage): Promise<void> {
    if (message.senderId === this.localPeerId) return;

    const profiles = await businessProfileService.getAllProfiles();
    for (const profile of profiles) {
      const syncMessage: BusinessUpdateMessage = {
        type: 'BUSINESS_PROFILE_UPDATE',
        timestamp: Date.now(),
        senderId: this.localPeerId,
        senderName: 'G3TZKP-LOCAL',
        profile,
        signature: await this.signMessage(profile),
        version: '1.0.0'
      };

      await this.broadcastMessage(syncMessage);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private validateMessage(message: BusinessUpdateMessage): boolean {
    if (!message.timestamp || !message.senderId || !message.version) {
      return false;
    }

    const maxAge = 24 * 60 * 60 * 1000;
    if (Date.now() - message.timestamp > maxAge) {
      return false;
    }

    return true;
  }

  private async signMessage(profile: G3TZKPBusinessProfile): Promise<string> {
    const data = JSON.stringify({
      id: profile.id,
      crn: profile.crn,
      updatedAt: profile.updatedAt,
      bio: profile.bio,
      photos: profile.photos?.length || 0,
      products: profile.products?.length || 0
    });

    const encoder = new TextEncoder();
    const hash = await this.hashData(encoder.encode(data));
    return hash;
  }

  private signDeletion(profileId: string): string {
    const data = JSON.stringify({ id: profileId, deletedAt: Date.now() });
    const encoder = new TextEncoder();
    return btoa(data);
  }

  private async hashData(data: Uint8Array): Promise<string> {
    try {
      const buffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
      const digest = await crypto.subtle.digest('SHA-256', buffer);
      return Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      return btoa(String.fromCharCode.apply(null, Array.from(data)));
    }
  }

  private async broadcastMessage(message: BusinessUpdateMessage): Promise<void> {
    console.log(`📡 Broadcasting business update via G3TZKP: ${message.type}`);

    try {
      const { g3tzkpService } = await import('./G3TZKPService');
      const connectedPeers = g3tzkpService.getConnectedPeers();
      
      const messageJson = JSON.stringify(message);
      
      if (connectedPeers.length === 0) {
        console.warn('⚠️ No connected peers for business broadcast, message stored locally');
        return;
      }

      let successCount = 0;
      for (const peer of connectedPeers) {
        try {
          const sent = await g3tzkpService.sendMessage(peer.peerId, messageJson, 'TEXT');
          if (sent) successCount++;
        } catch (error) {
          console.error(`Failed to broadcast to peer ${peer.peerId}:`, error);
        }
      }

      console.log(`✅ Business update broadcast to ${successCount}/${connectedPeers.length} peers`);
    } catch (error) {
      console.error('Failed to broadcast via G3TZKP:', error);
    }
  }

  getPendingUpdates(): BusinessUpdateMessage[] {
    return Array.from(this.pendingUpdates.values());
  }

  clearPendingUpdate(profileId: string): void {
    this.pendingUpdates.delete(profileId);
  }

  getTopic(): string {
    return this.topic;
  }

  getLocalPeerId(): string {
    return this.localPeerId;
  }
}

const encoder = new TextEncoder();
export const businessP2PUpdateService = new BusinessP2PUpdateService();
