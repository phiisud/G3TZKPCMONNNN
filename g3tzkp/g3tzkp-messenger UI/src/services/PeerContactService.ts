import { PeerContact, PeerContactAddRequest, OperatorProfile } from '../types/peer';
import { g3tzkpService } from './G3TZKPService';
import { operatorProfileService } from './OperatorProfileService';
import { messagingService, SystemMessage } from './MessagingService';

export interface ConnectionRequest {
  peerId: string;
  peerName: string;
  timestamp: number;
  status: 'pending' | 'accepted' | 'denied';
}

type ContactChangeHandler = (contacts: PeerContact[]) => void;
type RequestHandler = (requests: ConnectionRequest[]) => void;

class PeerContactService {
  private storageKey = 'g3tzkp-peer-contacts';
  private pendingStorageKey = 'g3tzkp-pending-requests';
  private sentStorageKey = 'g3tzkp-sent-requests';
  private contacts: Map<string, PeerContact> = new Map();
  private pendingRequests: Map<string, ConnectionRequest> = new Map();
  private sentRequests: Map<string, ConnectionRequest> = new Map();
  private peerProfiles: Map<string, OperatorProfile> = new Map();
  private changeHandlers: Set<ContactChangeHandler> = new Set();
  private requestHandlers: Set<RequestHandler> = new Set();
  private localPeerId: string = '';
  private localPeerName: string = 'LOCAL_OPERATOR';

  async initialize(): Promise<void> {
    await this.loadContacts();
    await this.loadPendingRequests();
    
    const identity = localStorage.getItem('g3tzkp_identity_main');
    if (identity) {
      try {
        const parsed = JSON.parse(identity);
        this.localPeerId = parsed.peerId || '';
        this.localPeerName = parsed.displayName || 'LOCAL_OPERATOR';
      } catch (e) {}
    }
    
    g3tzkpService.onPeerConnect((peer) => {
      this.handlePeerConnected(peer.peerId);
    });

    g3tzkpService.onPeerDisconnect((peer) => {
      this.handlePeerDisconnected(peer.peerId);
    });

    g3tzkpService.onMessage((from, content, type) => {
      if (type === 'PRESENCE') {
        const profile = operatorProfileService.handleIncomingProfileMessage(from, content);
        if (profile) {
          this.updatePeerProfile(profile);
        }
      }
    });

    messagingService.onSystemMessage((message: SystemMessage) => {
      console.log('[PeerContactService] Received system message:', message.type);
      if (message.type === 'CONNECTION_REQUEST') {
        this.handleIncomingRequest(message.senderId, { senderName: message.senderName, timestamp: message.timestamp });
      } else if (message.type === 'CONNECTION_ACCEPT') {
        this.handleRequestAccepted(message.senderId, { senderName: message.senderName });
      } else if (message.type === 'CONNECTION_DENY') {
        this.handleRequestDenied(message.senderId, {});
      }
    });
  }

  async sendConnectionRequest(peerId: string, contactName?: string): Promise<void> {
    if (!peerId || peerId.length < 10) {
      throw new Error('Invalid peer ID');
    }

    if (peerId === this.localPeerId) {
      throw new Error("You can't add yourself as a contact");
    }

    if (this.contacts.has(peerId)) {
      throw new Error('Already a contact');
    }

    if (this.sentRequests.has(peerId)) {
      throw new Error('Request already sent');
    }

    const request: ConnectionRequest = {
      peerId,
      peerName: contactName || `Peer-${peerId.substring(3, 11)}`,
      timestamp: Date.now(),
      status: 'pending'
    };

    this.sentRequests.set(peerId, request);
    await this.saveSentRequests();

    try {
      const sent = await messagingService.sendSystemMessage(peerId, 'CONNECTION_REQUEST');
      if (sent) {
        console.log('[PeerContactService] Connection request sent to:', peerId);
      } else {
        throw new Error('Not connected to server');
      }
    } catch (error) {
      console.error('[PeerContactService] Failed to send connection request:', error);
      this.sentRequests.delete(peerId);
      await this.saveSentRequests();
      throw new Error('Failed to send request - please check your connection');
    }
  }

  private async handleIncomingRequest(fromPeerId: string, data: any): Promise<void> {
    console.log('[PeerContactService] Received connection request from:', fromPeerId);
    
    if (this.contacts.has(fromPeerId)) {
      await this.acceptRequest(fromPeerId);
      return;
    }

    if (this.pendingRequests.has(fromPeerId)) {
      return;
    }

    const request: ConnectionRequest = {
      peerId: fromPeerId,
      peerName: data.senderName || `Peer-${fromPeerId.substring(3, 11)}`,
      timestamp: data.timestamp || Date.now(),
      status: 'pending'
    };

    this.pendingRequests.set(fromPeerId, request);
    await this.savePendingRequests();
    this.notifyRequestHandlers();
  }

  private async handleRequestAccepted(fromPeerId: string, data: any): Promise<void> {
    console.log('[PeerContactService] Connection request accepted by:', fromPeerId);
    
    const sentRequest = this.sentRequests.get(fromPeerId);
    if (sentRequest) {
      await this.finalizeContact(fromPeerId, sentRequest.peerName);
      this.sentRequests.delete(fromPeerId);
      await this.saveSentRequests();
    }
  }

  private async handleRequestDenied(fromPeerId: string, data: any): Promise<void> {
    console.log('[PeerContactService] Connection request denied by:', fromPeerId);
    
    this.sentRequests.delete(fromPeerId);
    await this.saveSentRequests();
  }

  async acceptRequest(peerId: string): Promise<void> {
    const request = this.pendingRequests.get(peerId);
    if (!request) {
      throw new Error('No pending request from this peer');
    }

    await this.finalizeContact(peerId, request.peerName);

    try {
      await messagingService.sendSystemMessage(peerId, 'CONNECTION_ACCEPT');
    } catch (error) {
      console.error('[PeerContactService] Failed to send accept message:', error);
    }

    this.pendingRequests.delete(peerId);
    await this.savePendingRequests();
    this.notifyRequestHandlers();
  }

  async denyRequest(peerId: string): Promise<void> {
    const request = this.pendingRequests.get(peerId);
    if (!request) {
      throw new Error('No pending request from this peer');
    }

    try {
      await messagingService.sendSystemMessage(peerId, 'CONNECTION_DENY');
    } catch (error) {
      console.error('[PeerContactService] Failed to send deny message:', error);
    }

    this.pendingRequests.delete(peerId);
    await this.savePendingRequests();
    this.notifyRequestHandlers();
  }

  private async finalizeContact(peerId: string, contactName: string): Promise<void> {
    if (this.contacts.has(peerId)) {
      return;
    }

    const contact: PeerContact = {
      peerId,
      contactName: contactName.trim(),
      addedAt: Date.now(),
      isFavorite: false,
      unreadCount: 0,
      connectionStatus: 'disconnected'
    };

    this.contacts.set(peerId, contact);
    await this.saveContacts();
    this.notifyHandlers();

    await operatorProfileService.requestProfileFromPeer(peerId);
    console.log('[PeerContactService] Contact finalized:', peerId);
  }

  async addContact(request: PeerContactAddRequest): Promise<PeerContact> {
    await this.sendConnectionRequest(request.peerId, request.contactName);
    
    return {
      peerId: request.peerId,
      contactName: request.contactName || `Peer-${request.peerId.substring(3, 11)}`,
      addedAt: Date.now(),
      isFavorite: false,
      unreadCount: 0,
      connectionStatus: 'pending' as any
    };
  }

  async removeContact(peerId: string): Promise<boolean> {
    const deleted = this.contacts.delete(peerId);
    if (deleted) {
      this.peerProfiles.delete(peerId);
      await this.saveContacts();
      this.notifyHandlers();
      g3tzkpService.disconnect(peerId);
    }
    return deleted;
  }

  async updateContactName(peerId: string, contactName: string): Promise<void> {
    const contact = this.contacts.get(peerId);
    if (!contact) {
      throw new Error('Contact not found');
    }

    if (contactName.trim().length === 0) {
      throw new Error('Contact name cannot be empty');
    }

    contact.contactName = contactName.trim();
    await this.saveContacts();
    this.notifyHandlers();
  }

  async toggleFavorite(peerId: string): Promise<void> {
    const contact = this.contacts.get(peerId);
    if (!contact) {
      throw new Error('Contact not found');
    }

    contact.isFavorite = !contact.isFavorite;
    await this.saveContacts();
    this.notifyHandlers();
  }

  async markAsRead(peerId: string): Promise<void> {
    const contact = this.contacts.get(peerId);
    if (!contact) return;

    contact.unreadCount = 0;
    await this.saveContacts();
    this.notifyHandlers();
  }

  incrementUnreadCount(peerId: string): void {
    const contact = this.contacts.get(peerId);
    if (!contact) return;

    contact.unreadCount++;
    contact.lastMessageAt = Date.now();
    this.saveContacts();
    this.notifyHandlers();
  }

  getContact(peerId: string): PeerContact | undefined {
    return this.contacts.get(peerId);
  }

  getAllContacts(): PeerContact[] {
    return Array.from(this.contacts.values()).sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) {
        return a.isFavorite ? -1 : 1;
      }
      return (b.lastMessageAt || b.addedAt) - (a.lastMessageAt || a.addedAt);
    });
  }

  getFavoriteContacts(): PeerContact[] {
    return Array.from(this.contacts.values())
      .filter(c => c.isFavorite)
      .sort((a, b) => (b.lastMessageAt || b.addedAt) - (a.lastMessageAt || a.addedAt));
  }

  getConnectedContacts(): PeerContact[] {
    return Array.from(this.contacts.values())
      .filter(c => c.connectionStatus === 'connected');
  }

  getPeerProfile(peerId: string): OperatorProfile | undefined {
    return this.peerProfiles.get(peerId);
  }

  getContactDisplayName(peerId: string): string {
    const contact = this.contacts.get(peerId);
    if (contact) {
      return contact.contactName;
    }

    const profile = this.peerProfiles.get(peerId);
    if (profile) {
      return profile.displayName;
    }

    return `Peer-${peerId.substring(3, 11)}`;
  }

  getPendingRequests(): ConnectionRequest[] {
    return Array.from(this.pendingRequests.values());
  }

  getSentRequests(): ConnectionRequest[] {
    return Array.from(this.sentRequests.values());
  }

  hasPendingRequest(peerId: string): boolean {
    return this.pendingRequests.has(peerId);
  }

  hasSentRequest(peerId: string): boolean {
    return this.sentRequests.has(peerId);
  }

  subscribe(handler: ContactChangeHandler): () => void {
    this.changeHandlers.add(handler);
    return () => this.changeHandlers.delete(handler);
  }

  subscribeToRequests(handler: RequestHandler): () => void {
    this.requestHandlers.add(handler);
    return () => this.requestHandlers.delete(handler);
  }

  private notifyHandlers(): void {
    const contacts = this.getAllContacts();
    this.changeHandlers.forEach(handler => handler(contacts));
  }

  private notifyRequestHandlers(): void {
    const requests = this.getPendingRequests();
    this.requestHandlers.forEach(handler => handler(requests));
  }

  private updatePeerProfile(profile: OperatorProfile): void {
    this.peerProfiles.set(profile.peerId, profile);
    
    const contact = this.contacts.get(profile.peerId);
    if (contact && (!contact.contactName || contact.contactName.startsWith('Peer-'))) {
      contact.contactName = profile.displayName;
      this.saveContacts();
      this.notifyHandlers();
    }
  }

  private handlePeerConnected(peerId: string): void {
    const contact = this.contacts.get(peerId);
    if (contact) {
      contact.connectionStatus = 'connected';
      contact.lastSeenAt = Date.now();
      this.notifyHandlers();
    }
  }

  private handlePeerDisconnected(peerId: string): void {
    const contact = this.contacts.get(peerId);
    if (contact) {
      contact.connectionStatus = 'disconnected';
      contact.lastSeenAt = Date.now();
      this.notifyHandlers();
    }
  }

  private async loadContacts(): Promise<void> {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const contacts = JSON.parse(stored);
        this.contacts = new Map(contacts.map((c: PeerContact) => [c.peerId, c]));
      }
    } catch (error) {
      console.error('Failed to load contacts:', error);
    }
  }

  private async saveContacts(): Promise<void> {
    try {
      const contacts = Array.from(this.contacts.values());
      localStorage.setItem(this.storageKey, JSON.stringify(contacts));
    } catch (error) {
      console.error('Failed to save contacts:', error);
    }
  }

  private async loadPendingRequests(): Promise<void> {
    try {
      const pendingStored = localStorage.getItem(this.pendingStorageKey);
      if (pendingStored) {
        const requests = JSON.parse(pendingStored);
        this.pendingRequests = new Map(requests.map((r: ConnectionRequest) => [r.peerId, r]));
      }
      
      const sentStored = localStorage.getItem(this.sentStorageKey);
      if (sentStored) {
        const requests = JSON.parse(sentStored);
        this.sentRequests = new Map(requests.map((r: ConnectionRequest) => [r.peerId, r]));
      }
    } catch (error) {
      console.error('Failed to load pending requests:', error);
    }
  }

  private async savePendingRequests(): Promise<void> {
    try {
      const requests = Array.from(this.pendingRequests.values());
      localStorage.setItem(this.pendingStorageKey, JSON.stringify(requests));
    } catch (error) {
      console.error('Failed to save pending requests:', error);
    }
  }

  private async saveSentRequests(): Promise<void> {
    try {
      const requests = Array.from(this.sentRequests.values());
      localStorage.setItem(this.sentStorageKey, JSON.stringify(requests));
    } catch (error) {
      console.error('Failed to save sent requests:', error);
    }
  }
}

export const peerContactService = new PeerContactService();
