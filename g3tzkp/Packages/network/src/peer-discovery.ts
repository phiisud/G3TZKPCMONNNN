import { EventEmitter } from 'events';
import { fromString, toString } from 'uint8arrays';

const DISCOVERY_INTERVAL = 30000;
const PEER_TIMEOUT = 120000;
const MAX_PEERS_CACHE = 1000;

export interface DiscoveredPeer {
  id: string;
  addresses: string[];
  capabilities: string[];
  version: string;
  discoveredAt: Date;
  lastSeen: Date;
  discoveryMethod: 'mdns' | 'dht' | 'bootstrap' | 'pubsub' | 'manual';
  score: number;
  metadata: Record<string, any>;
}

export interface DiscoveryConfig {
  enableMdns: boolean;
  enableDht: boolean;
  enableBootstrap: boolean;
  enablePubsub: boolean;
  bootstrapPeers: string[];
  discoveryInterval: number;
  peerTimeout: number;
  maxPeers: number;
}

export interface PeerScoreFactors {
  latency: number;
  uptime: number;
  messageSuccess: number;
  relayCapability: number;
}

export class PeerDiscoveryService extends EventEmitter {
  private config: DiscoveryConfig;
  private discoveredPeers: Map<string, DiscoveredPeer> = new Map();
  private peerScores: Map<string, PeerScoreFactors> = new Map();
  private discoveryTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private running: boolean = false;
  private localPeerId: string = '';

  constructor(config: Partial<DiscoveryConfig> = {}) {
    super();
    this.config = {
      enableMdns: config.enableMdns ?? true,
      enableDht: config.enableDht ?? true,
      enableBootstrap: config.enableBootstrap ?? true,
      enablePubsub: config.enablePubsub ?? true,
      bootstrapPeers: config.bootstrapPeers || [],
      discoveryInterval: config.discoveryInterval || DISCOVERY_INTERVAL,
      peerTimeout: config.peerTimeout || PEER_TIMEOUT,
      maxPeers: config.maxPeers || MAX_PEERS_CACHE
    };
  }

  start(localPeerId: string): void {
    if (this.running) return;

    this.localPeerId = localPeerId;
    this.running = true;

    this.discoveryTimer = setInterval(() => {
      this.runDiscoveryCycle();
    }, this.config.discoveryInterval);

    this.cleanupTimer = setInterval(() => {
      this.cleanupStalePeers();
    }, this.config.peerTimeout / 2);

    this.runDiscoveryCycle();
    this.emit('started');
  }

  stop(): void {
    if (!this.running) return;

    this.running = false;

    if (this.discoveryTimer) {
      clearInterval(this.discoveryTimer);
      this.discoveryTimer = null;
    }

    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    this.emit('stopped');
  }

  private runDiscoveryCycle(): void {
    this.emit('discovery:cycle:start');

    if (this.config.enableBootstrap) {
      this.processBootstrapPeers();
    }

    this.emit('discovery:cycle:complete', {
      peersDiscovered: this.discoveredPeers.size
    });
  }

  private processBootstrapPeers(): void {
    for (const peerAddress of this.config.bootstrapPeers) {
      const peerId = this.extractPeerIdFromAddress(peerAddress);
      if (peerId && peerId !== this.localPeerId) {
        this.addOrUpdatePeer({
          id: peerId,
          addresses: [peerAddress],
          capabilities: ['relay', 'dht'],
          version: 'unknown',
          discoveryMethod: 'bootstrap'
        });
      }
    }
  }

  addOrUpdatePeer(peerData: {
    id: string;
    addresses: string[];
    capabilities?: string[];
    version?: string;
    discoveryMethod: 'mdns' | 'dht' | 'bootstrap' | 'pubsub' | 'manual';
    metadata?: Record<string, any>;
  }): void {
    if (peerData.id === this.localPeerId) return;

    const existing = this.discoveredPeers.get(peerData.id);
    const now = new Date();

    if (existing) {
      const updatedAddresses = this.mergeAddresses(existing.addresses, peerData.addresses);
      const updatedCapabilities = this.mergeCapabilities(
        existing.capabilities,
        peerData.capabilities || []
      );

      existing.addresses = updatedAddresses;
      existing.capabilities = updatedCapabilities;
      existing.lastSeen = now;
      existing.version = peerData.version || existing.version;
      existing.metadata = { ...existing.metadata, ...peerData.metadata };

      this.discoveredPeers.set(peerData.id, existing);
      this.emit('peer:updated', existing);
    } else {
      if (this.discoveredPeers.size >= this.config.maxPeers) {
        this.evictLowestScorePeer();
      }

      const newPeer: DiscoveredPeer = {
        id: peerData.id,
        addresses: peerData.addresses,
        capabilities: peerData.capabilities || [],
        version: peerData.version || 'unknown',
        discoveredAt: now,
        lastSeen: now,
        discoveryMethod: peerData.discoveryMethod,
        score: this.calculateInitialScore(peerData.discoveryMethod),
        metadata: peerData.metadata || {}
      };

      this.discoveredPeers.set(peerData.id, newPeer);
      this.initializePeerScore(peerData.id);
      this.emit('peer:discovered', newPeer);
    }
  }

  removePeer(peerId: string): void {
    const peer = this.discoveredPeers.get(peerId);
    if (peer) {
      this.discoveredPeers.delete(peerId);
      this.peerScores.delete(peerId);
      this.emit('peer:removed', peer);
    }
  }

  updatePeerScore(peerId: string, factors: Partial<PeerScoreFactors>): void {
    const existingFactors = this.peerScores.get(peerId) || {
      latency: 0.5,
      uptime: 0.5,
      messageSuccess: 0.5,
      relayCapability: 0.5
    };

    const updatedFactors: PeerScoreFactors = {
      latency: factors.latency ?? existingFactors.latency,
      uptime: factors.uptime ?? existingFactors.uptime,
      messageSuccess: factors.messageSuccess ?? existingFactors.messageSuccess,
      relayCapability: factors.relayCapability ?? existingFactors.relayCapability
    };

    this.peerScores.set(peerId, updatedFactors);

    const peer = this.discoveredPeers.get(peerId);
    if (peer) {
      peer.score = this.calculateScore(updatedFactors);
      this.discoveredPeers.set(peerId, peer);
    }
  }

  recordLatency(peerId: string, latencyMs: number): void {
    const normalizedLatency = Math.max(0, 1 - (latencyMs / 5000));
    this.updatePeerScore(peerId, { latency: normalizedLatency });
  }

  recordMessageSuccess(peerId: string, success: boolean): void {
    const existingFactors = this.peerScores.get(peerId);
    if (existingFactors) {
      const currentSuccess = existingFactors.messageSuccess;
      const newSuccess = success
        ? Math.min(1, currentSuccess + 0.05)
        : Math.max(0, currentSuccess - 0.1);
      this.updatePeerScore(peerId, { messageSuccess: newSuccess });
    }
  }

  recordUptime(peerId: string, connected: boolean): void {
    const existingFactors = this.peerScores.get(peerId);
    if (existingFactors) {
      const currentUptime = existingFactors.uptime;
      const newUptime = connected
        ? Math.min(1, currentUptime + 0.01)
        : Math.max(0, currentUptime - 0.05);
      this.updatePeerScore(peerId, { uptime: newUptime });
    }
  }

  getPeer(peerId: string): DiscoveredPeer | undefined {
    return this.discoveredPeers.get(peerId);
  }

  getAllPeers(): DiscoveredPeer[] {
    return Array.from(this.discoveredPeers.values());
  }

  getPeersByCapability(capability: string): DiscoveredPeer[] {
    return this.getAllPeers().filter(peer => 
      peer.capabilities.includes(capability)
    );
  }

  getPeersByScore(minScore: number = 0): DiscoveredPeer[] {
    return this.getAllPeers()
      .filter(peer => peer.score >= minScore)
      .sort((a, b) => b.score - a.score);
  }

  getTopPeers(count: number = 10): DiscoveredPeer[] {
    return this.getPeersByScore().slice(0, count);
  }

  getRelayPeers(): DiscoveredPeer[] {
    return this.getPeersByCapability('relay');
  }

  getPeersForRouting(targetPeerId: string): DiscoveredPeer[] {
    const directPeer = this.discoveredPeers.get(targetPeerId);
    if (directPeer && directPeer.score > 0.5) {
      return [directPeer];
    }

    return this.getRelayPeers()
      .filter(peer => peer.score > 0.3)
      .slice(0, 5);
  }

  getPeerAddresses(peerId: string): string[] {
    const peer = this.discoveredPeers.get(peerId);
    return peer?.addresses || [];
  }

  getPeerCount(): number {
    return this.discoveredPeers.size;
  }

  getActivePeerCount(): number {
    const now = Date.now();
    const activeThreshold = this.config.peerTimeout;

    return Array.from(this.discoveredPeers.values()).filter(
      peer => now - peer.lastSeen.getTime() < activeThreshold
    ).length;
  }

  private cleanupStalePeers(): void {
    const now = Date.now();
    const staleThreshold = this.config.peerTimeout;
    const peersToRemove: string[] = [];

    for (const [peerId, peer] of this.discoveredPeers.entries()) {
      if (now - peer.lastSeen.getTime() > staleThreshold) {
        peersToRemove.push(peerId);
      }
    }

    for (const peerId of peersToRemove) {
      this.removePeer(peerId);
    }

    if (peersToRemove.length > 0) {
      this.emit('peers:cleaned', { count: peersToRemove.length });
    }
  }

  private evictLowestScorePeer(): void {
    let lowestScore = Infinity;
    let lowestPeerId: string | null = null;

    for (const [peerId, peer] of this.discoveredPeers.entries()) {
      if (peer.discoveryMethod !== 'bootstrap' && peer.score < lowestScore) {
        lowestScore = peer.score;
        lowestPeerId = peerId;
      }
    }

    if (lowestPeerId) {
      this.removePeer(lowestPeerId);
    }
  }

  private calculateInitialScore(discoveryMethod: string): number {
    switch (discoveryMethod) {
      case 'bootstrap':
        return 0.8;
      case 'dht':
        return 0.6;
      case 'mdns':
        return 0.7;
      case 'pubsub':
        return 0.5;
      case 'manual':
        return 0.9;
      default:
        return 0.5;
    }
  }

  private calculateScore(factors: PeerScoreFactors): number {
    const weights = {
      latency: 0.3,
      uptime: 0.25,
      messageSuccess: 0.35,
      relayCapability: 0.1
    };

    return (
      factors.latency * weights.latency +
      factors.uptime * weights.uptime +
      factors.messageSuccess * weights.messageSuccess +
      factors.relayCapability * weights.relayCapability
    );
  }

  private initializePeerScore(peerId: string): void {
    this.peerScores.set(peerId, {
      latency: 0.5,
      uptime: 0.5,
      messageSuccess: 0.5,
      relayCapability: 0.5
    });
  }

  private mergeAddresses(existing: string[], incoming: string[]): string[] {
    const addressSet = new Set([...existing, ...incoming]);
    return Array.from(addressSet).slice(0, 10);
  }

  private mergeCapabilities(existing: string[], incoming: string[]): string[] {
    const capabilitySet = new Set([...existing, ...incoming]);
    return Array.from(capabilitySet);
  }

  private extractPeerIdFromAddress(address: string): string | null {
    const peerIdMatch = address.match(/\/p2p\/([a-zA-Z0-9]+)$/);
    return peerIdMatch ? peerIdMatch[1] : null;
  }

  exportPeerList(): string {
    const peers = this.getAllPeers().map(peer => ({
      id: peer.id,
      addresses: peer.addresses,
      capabilities: peer.capabilities,
      score: peer.score
    }));
    return JSON.stringify(peers, null, 2);
  }

  importPeerList(json: string): number {
    try {
      const peers = JSON.parse(json);
      let imported = 0;

      for (const peer of peers) {
        if (peer.id && peer.addresses && Array.isArray(peer.addresses)) {
          this.addOrUpdatePeer({
            id: peer.id,
            addresses: peer.addresses,
            capabilities: peer.capabilities || [],
            discoveryMethod: 'manual'
          });
          imported++;
        }
      }

      return imported;
    } catch {
      return 0;
    }
  }
}
