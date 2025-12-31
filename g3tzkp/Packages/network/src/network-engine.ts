import { createLibp2p, Libp2p } from 'libp2p';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { mplex } from '@libp2p/mplex';
import { tcp } from '@libp2p/tcp';
import { webSockets } from '@libp2p/websockets';
import { webRTC } from '@libp2p/webrtc';
import { bootstrap } from '@libp2p/bootstrap';
import { mdns } from '@libp2p/mdns';
import { kadDHT } from '@libp2p/kad-dht';
import { gossipsub } from '@chainsafe/libp2p-gossipsub';
import { identify } from '@libp2p/identify';
import { ping } from '@libp2p/ping';
import { fetch } from '@libp2p/fetch';
import { circuitRelayTransport, circuitRelayServer } from '@libp2p/circuit-relay-v2';
import { pubsubPeerDiscovery } from '@libp2p/pubsub-peer-discovery';
import { pipe } from 'it-pipe';
import { fromString, toString } from 'uint8arrays';
import { multiaddr } from '@multiformats/multiaddr';
import { peerIdFromString } from '@libp2p/peer-id';
import { EventEmitter } from 'events';
import type { PeerId } from '@libp2p/interface';
import type { Connection, Stream } from '@libp2p/interface';
import type { Message as PubSubMessage } from '@libp2p/interface';

// Compatibility shim: some libp2p packages in the workspace depend on different
// `@libp2p/peer-id` implementations which can result in PeerId values being
// strings in some codepaths. Patch PeerFilter.has to accept string ids and
// convert them to PeerId where possible to avoid runtime `toMultihash` errors.
try {
  // Importing dynamically so bundlers don't fail if package layout differs
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const peerCollections = require('@libp2p/peer-collections');
  if (peerCollections && peerCollections.PeerFilter) {
    const PF = peerCollections.PeerFilter;
    if (!PF.prototype.__g3zkp_has_patched) {
      const originalHas = PF.prototype.has;
      PF.prototype.has = function (peerId: any) {
        try {
          if (!peerId) return false;
          if (typeof peerId === 'string') {
            peerId = peerIdFromString(peerId);
          }
          if (peerId?.toMultihash) return originalHas.call(this, peerId);
          if (peerId?.toString) return originalHas.call(this, peerIdFromString(peerId.toString()));
        } catch (e) {
          // fall through
        }
        return false;
      };
      PF.prototype.__g3zkp_has_patched = true;
    }
  }
} catch (e) {
  // ignore if peer-collections isn't available at runtime
}

const G3ZKP_PROTOCOL = '/g3zkp/messenger/1.0.0';
const G3ZKP_DISCOVERY_TOPIC = 'g3zkp-discovery';
const G3ZKP_MESSAGE_TOPIC = 'g3zkp-messages';

export interface NetworkConfig {
  listenAddresses: string[];
  bootstrapNodes: string[];
  enableRelay: boolean;
  enableNatTraversal: boolean;
  maxConnections: number;
  connectionTimeout: number;
  enableMdns: boolean;
  enableDht: boolean;
  dataPath: string;
}

export interface PeerInfo {
  id: string;
  addresses: string[];
  protocols: string[];
  latency: number;
  lastSeen: Date;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  metadata: Record<string, any>;
}

export interface MessageReceipt {
  messageId: string;
  recipientId: string;
  timestamp: Date;
  status: 'sent' | 'delivered' | 'published' | 'failed';
  method: 'direct' | 'pubsub' | 'relay';
  error?: string;
}

export interface NetworkStats {
  peersConnected: number;
  peersDiscovered: number;
  messagesSent: number;
  messagesReceived: number;
  bytesTransferred: number;
  uptime: number;
  lastActivity: Date;
}

export class G3ZKPNetworkEngine extends EventEmitter {
  private node: Libp2p | null = null;
  private config: NetworkConfig;
  private peers: Map<string, PeerInfo> = new Map();
  private subscriptions: Set<string> = new Set();
  private messageHandlers: Map<string, (data: Uint8Array, peerId: string) => void> = new Map();
  private stats: NetworkStats;
  private startTime: number = 0;
  private initialized: boolean = false;
  private shutdownRequested: boolean = false;

  constructor(config: Partial<NetworkConfig> = {}) {
    super();
    this.config = {
      listenAddresses: config.listenAddresses || [
        '/ip4/0.0.0.0/tcp/0',
        '/ip4/0.0.0.0/tcp/0/ws',
        '/ip6/::/tcp/0',
        '/ip6/::/tcp/0/ws'
      ],
      bootstrapNodes: config.bootstrapNodes || [],
      enableRelay: config.enableRelay ?? true,
      enableNatTraversal: config.enableNatTraversal ?? true,
      maxConnections: config.maxConnections || 100,
      connectionTimeout: config.connectionTimeout || 30000,
      enableMdns: config.enableMdns ?? true,
      enableDht: config.enableDht ?? true,
      dataPath: config.dataPath || './data/network'
    };
    this.stats = {
      peersConnected: 0,
      peersDiscovered: 0,
      messagesSent: 0,
      messagesReceived: 0,
      bytesTransferred: 0,
      uptime: 0,
      lastActivity: new Date()
    };
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    const peerDiscovery: any[] = [];
    const services: Record<string, any> = {};

    if (this.config.enableMdns) {
      peerDiscovery.push(mdns({
        interval: 20000
      }));
    }

    if (this.config.bootstrapNodes.length > 0) {
      peerDiscovery.push(bootstrap({
        list: this.config.bootstrapNodes,
        timeout: 3000
      }));
    }

    services.identify = identify();
    services.ping = ping({
      protocolPrefix: 'g3zkp'
    });

    if (this.config.enableDht) {
      services.dht = kadDHT({
        clientMode: false,
        validators: {},
        selectors: {}
      });
    }

    services.pubsub = gossipsub({
      emitSelf: false,
      fallbackToFloodsub: true,
      msgIdFn: (msg: PubSubMessage) => {
        const data = msg.data;
        const hash = this.hashMessage(data);
        return fromString(hash);
      },
      msgIdToStrFn: (msgId: Uint8Array) => {
        return toString(msgId, 'hex');
      }
    });

    services.fetch = fetch();

    const transports: any[] = [
      tcp(),
      webSockets({
        filter: (addrs) => addrs.filter(a => a.toString().includes('/ws'))
      })
    ];

    if (this.config.enableRelay) {
      transports.push(circuitRelayTransport({
        discoverRelays: 2
      }));
    }

    try {
      transports.push(webRTC());
    } catch (e) {
      // WebRTC not available in this environment
    }

    const connectionEncryption = [noise()];
    const streamMuxers = [yamux(), mplex()];

    this.node = await createLibp2p({
      addresses: {
        listen: this.config.listenAddresses
      },
      transports,
      connectionEncryption,
      streamMuxers,
      peerDiscovery,
      services,
      connectionManager: {
        maxConnections: this.config.maxConnections,
        minConnections: 5,
        autoDialConcurrency: 25,
        maxParallelDials: 100,
        dialTimeout: this.config.connectionTimeout
      }
    });

    this.setupEventHandlers();
    await this.registerProtocol();
    await this.node.start();
    this.startTime = Date.now();
    this.initialized = true;

    await this.subscribeToDiscovery();

    this.emit('ready', {
      peerId: this.node.peerId.toString(),
      addresses: this.node.getMultiaddrs().map(ma => ma.toString())
    });
  }

  private setupEventHandlers(): void {
    if (!this.node) return;

    this.node.addEventListener('peer:discovery', (evt) => {
      const peer = evt.detail;
      this.handlePeerDiscovery(peer.id);
    });

    this.node.addEventListener('peer:connect', (evt) => {
      const peerId = evt.detail;
      this.handlePeerConnect(peerId);
    });

    this.node.addEventListener('peer:disconnect', (evt) => {
      const peerId = evt.detail;
      this.handlePeerDisconnect(peerId);
    });

    this.node.addEventListener('connection:open', (evt) => {
      const connection = evt.detail;
      this.handleConnectionOpen(connection);
    });

    this.node.addEventListener('connection:close', (evt) => {
      const connection = evt.detail;
      this.handleConnectionClose(connection);
    });

    const pubsub = this.node.services.pubsub as any;
    if (pubsub) {
      pubsub.addEventListener('message', (evt: any) => {
        this.handlePubsubMessage(evt.detail);
      });
    }
  }

  private async registerProtocol(): Promise<void> {
    if (!this.node) return;

    await this.node.handle(G3ZKP_PROTOCOL, async ({ stream, connection }) => {
      const peerId = connection.remotePeer.toString();
      
      try {
        await pipe(
          stream.source,
          async function* (source) {
            for await (const chunk of source) {
              yield chunk;
            }
          },
          async (source) => {
            const chunks: Uint8Array[] = [];
            for await (const chunk of source) {
              chunks.push(chunk.subarray());
            }
            const data = this.concatUint8Arrays(chunks);
            this.handleIncomingMessage(data, peerId);
            this.stats.messagesReceived++;
            this.stats.bytesTransferred += data.length;
            this.stats.lastActivity = new Date();
          }
        );
      } catch (error) {
        this.emit('error', { peerId, error });
      } finally {
        await stream.close();
      }
    });
  }

  private async subscribeToDiscovery(): Promise<void> {
    await this.subscribe(G3ZKP_DISCOVERY_TOPIC);
    await this.subscribe(G3ZKP_MESSAGE_TOPIC);

    setInterval(async () => {
      if (this.initialized && !this.shutdownRequested) {
        await this.announcePresence();
      }
    }, 30000);

    await this.announcePresence();
  }

  private async announcePresence(): Promise<void> {
    if (!this.node) return;

    const announcement = {
      type: 'presence',
      peerId: this.node.peerId.toString(),
      addresses: this.node.getMultiaddrs().map(ma => ma.toString()),
      timestamp: Date.now(),
      capabilities: ['messaging', 'zkp', 'relay'],
      version: '1.0.0'
    };

    const data = fromString(JSON.stringify(announcement));
    await this.publishMessage(G3ZKP_DISCOVERY_TOPIC, data);
  }

  private handlePeerDiscovery(peerId: PeerId): void {
    const peerIdStr = peerId.toString();
    
    if (!this.peers.has(peerIdStr)) {
      this.peers.set(peerIdStr, {
        id: peerIdStr,
        addresses: [],
        protocols: [],
        latency: -1,
        lastSeen: new Date(),
        connectionStatus: 'disconnected',
        metadata: {}
      });
      this.stats.peersDiscovered++;
    }

    this.emit('peer:discovered', { peerId: peerIdStr });
    this.attemptConnection(peerIdStr);
  }

  private async handlePeerConnect(peerId: PeerId): Promise<void> {
    const peerIdStr = peerId.toString();
    
    const peerInfo = this.peers.get(peerIdStr) || {
      id: peerIdStr,
      addresses: [],
      protocols: [],
      latency: -1,
      lastSeen: new Date(),
      connectionStatus: 'connected' as const,
      metadata: {}
    };

    peerInfo.connectionStatus = 'connected';
    peerInfo.lastSeen = new Date();

    if (this.node) {
      try {
        const latency = await this.measureLatency(peerIdStr);
        peerInfo.latency = latency;
      } catch {
        peerInfo.latency = -1;
      }

      try {
        const connections = this.node.getConnections(peerId);
        if (connections.length > 0) {
          peerInfo.addresses = connections[0].remoteAddr ? [connections[0].remoteAddr.toString()] : [];
        }
      } catch {
        // Ignore address lookup errors
      }
    }

    this.peers.set(peerIdStr, peerInfo);
    this.stats.peersConnected++;

    this.emit('peer:connected', { peerId: peerIdStr, peerInfo });
  }

  private handlePeerDisconnect(peerId: PeerId): void {
    const peerIdStr = peerId.toString();
    
    const peerInfo = this.peers.get(peerIdStr);
    if (peerInfo) {
      peerInfo.connectionStatus = 'disconnected';
      peerInfo.lastSeen = new Date();
      this.peers.set(peerIdStr, peerInfo);
    }

    this.stats.peersConnected = Math.max(0, this.stats.peersConnected - 1);
    this.emit('peer:disconnected', { peerId: peerIdStr });
  }

  private handleConnectionOpen(connection: Connection): void {
    const peerId = connection.remotePeer.toString();
    this.emit('connection:open', {
      peerId,
      remoteAddr: connection.remoteAddr.toString(),
      direction: connection.direction
    });
  }

  private handleConnectionClose(connection: Connection): void {
    const peerId = connection.remotePeer.toString();
    this.emit('connection:close', {
      peerId,
      remoteAddr: connection.remoteAddr.toString()
    });
  }

  private handlePubsubMessage(message: any): void {
    const topic = message.topic;
    const data = message.data;
    const from = message.from?.toString() || 'unknown';

    if (topic === G3ZKP_DISCOVERY_TOPIC) {
      this.handleDiscoveryMessage(data, from);
    } else if (topic === G3ZKP_MESSAGE_TOPIC) {
      this.handleBroadcastMessage(data, from);
    } else {
      const handler = this.messageHandlers.get(topic);
      if (handler) {
        handler(data, from);
      }
    }

    this.emit('pubsub:message', { topic, data, from });
  }

  private handleDiscoveryMessage(data: Uint8Array, from: string): void {
    try {
      const message = JSON.parse(toString(data));
      
      if (message.type === 'presence' && message.peerId !== this.node?.peerId.toString()) {
        const peerInfo = this.peers.get(message.peerId) || {
          id: message.peerId,
          addresses: message.addresses || [],
          protocols: [],
          latency: -1,
          lastSeen: new Date(),
          connectionStatus: 'disconnected' as const,
          metadata: {
            capabilities: message.capabilities,
            version: message.version
          }
        };

        peerInfo.addresses = message.addresses || [];
        peerInfo.lastSeen = new Date();
        peerInfo.metadata = {
          capabilities: message.capabilities,
          version: message.version
        };

        this.peers.set(message.peerId, peerInfo);
        this.attemptConnection(message.peerId);
      }
    } catch {
      // Invalid discovery message
    }
  }

  private handleBroadcastMessage(data: Uint8Array, from: string): void {
    this.stats.messagesReceived++;
    this.stats.bytesTransferred += data.length;
    this.stats.lastActivity = new Date();

    this.emit('message:broadcast', { data, from });
  }

  private handleIncomingMessage(data: Uint8Array, peerId: string): void {
    this.emit('message:received', { data, peerId });
  }

  private async attemptConnection(peerIdStr: string): Promise<void> {
    if (!this.node || this.shutdownRequested) return;

    const peerInfo = this.peers.get(peerIdStr);
    if (!peerInfo || peerInfo.connectionStatus === 'connected') return;

    peerInfo.connectionStatus = 'connecting';
    this.peers.set(peerIdStr, peerInfo);

    try {
      const peerId = peerIdFromString(peerIdStr);
      
      if (peerInfo.addresses.length > 0) {
        for (const addr of peerInfo.addresses) {
          try {
            const ma = multiaddr(addr);
            await this.node.dial(ma, { signal: AbortSignal.timeout(this.config.connectionTimeout) });
            return;
          } catch {
            continue;
          }
        }
      }

      await this.node.dial(peerId, { signal: AbortSignal.timeout(this.config.connectionTimeout) });
    } catch {
      peerInfo.connectionStatus = 'disconnected';
      this.peers.set(peerIdStr, peerInfo);
    }
  }

  private async measureLatency(peerIdStr: string): Promise<number> {
    if (!this.node) return -1;

    try {
      const peerId = peerIdFromString(peerIdStr);
      const pingService = this.node.services.ping as any;
      if (pingService) {
        const latency = await pingService.ping(peerId);
        return latency;
      }
    } catch {
      // Ping failed
    }
    return -1;
  }

  async sendMessage(peerId: string, data: Uint8Array): Promise<MessageReceipt> {
    if (!this.node || !this.initialized) {
      return {
        messageId: this.generateMessageId(),
        recipientId: peerId,
        timestamp: new Date(),
        status: 'failed',
        method: 'direct',
        error: 'Network not initialized'
      };
    }

    const messageId = this.generateMessageId();

    try {
      const targetPeerId = peerIdFromString(peerId);
      const stream = await this.node.dialProtocol(targetPeerId, G3ZKP_PROTOCOL, {
        signal: AbortSignal.timeout(this.config.connectionTimeout)
      });

      await pipe(
        [data],
        stream.sink
      );

      await stream.close();

      this.stats.messagesSent++;
      this.stats.bytesTransferred += data.length;
      this.stats.lastActivity = new Date();

      return {
        messageId,
        recipientId: peerId,
        timestamp: new Date(),
        status: 'sent',
        method: 'direct'
      };
    } catch (error) {
      return await this.sendViaRelay(peerId, data, messageId);
    }
  }

  private async sendViaRelay(peerId: string, data: Uint8Array, messageId: string): Promise<MessageReceipt> {
    if (!this.config.enableRelay) {
      return {
        messageId,
        recipientId: peerId,
        timestamp: new Date(),
        status: 'failed',
        method: 'relay',
        error: 'Relay disabled and direct connection failed'
      };
    }

    try {
      const wrappedMessage = {
        type: 'relay',
        targetPeer: peerId,
        data: toString(data, 'base64'),
        messageId,
        timestamp: Date.now()
      };

      await this.publishMessage(G3ZKP_MESSAGE_TOPIC, fromString(JSON.stringify(wrappedMessage)));

      this.stats.messagesSent++;
      this.stats.bytesTransferred += data.length;
      this.stats.lastActivity = new Date();

      return {
        messageId,
        recipientId: peerId,
        timestamp: new Date(),
        status: 'published',
        method: 'relay'
      };
    } catch (error) {
      return {
        messageId,
        recipientId: peerId,
        timestamp: new Date(),
        status: 'failed',
        method: 'relay',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async publishMessage(topic: string, data: Uint8Array): Promise<MessageReceipt> {
    if (!this.node || !this.initialized) {
      return {
        messageId: this.generateMessageId(),
        recipientId: 'broadcast',
        timestamp: new Date(),
        status: 'failed',
        method: 'pubsub',
        error: 'Network not initialized'
      };
    }

    const messageId = this.generateMessageId();

    try {
      const pubsub = this.node.services.pubsub as any;
      await pubsub.publish(topic, data);

      this.stats.messagesSent++;
      this.stats.bytesTransferred += data.length;
      this.stats.lastActivity = new Date();

      return {
        messageId,
        recipientId: 'broadcast',
        timestamp: new Date(),
        status: 'published',
        method: 'pubsub'
      };
    } catch (error) {
      return {
        messageId,
        recipientId: 'broadcast',
        timestamp: new Date(),
        status: 'failed',
        method: 'pubsub',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async subscribe(topic: string): Promise<void> {
    if (!this.node || this.subscriptions.has(topic)) return;

    const pubsub = this.node.services.pubsub as any;
    await pubsub.subscribe(topic);
    this.subscriptions.add(topic);

    this.emit('topic:subscribed', { topic });
  }

  async unsubscribe(topic: string): Promise<void> {
    if (!this.node || !this.subscriptions.has(topic)) return;

    const pubsub = this.node.services.pubsub as any;
    await pubsub.unsubscribe(topic);
    this.subscriptions.delete(topic);

    this.emit('topic:unsubscribed', { topic });
  }

  onMessage(topic: string, handler: (data: Uint8Array, peerId: string) => void): void {
    this.messageHandlers.set(topic, handler);
  }

  offMessage(topic: string): void {
    this.messageHandlers.delete(topic);
  }

  isConnected(): boolean {
    return this.initialized && this.node !== null && !this.shutdownRequested;
  }

  getConnectedPeers(): string[] {
    return Array.from(this.peers.entries())
      .filter(([_, info]) => info.connectionStatus === 'connected')
      .map(([id]) => id);
  }

  getAllPeers(): PeerInfo[] {
    return Array.from(this.peers.values());
  }

  getPeerInfo(peerId: string): PeerInfo | undefined {
    return this.peers.get(peerId);
  }

  getPeerId(): string | null {
    return this.node?.peerId.toString() || null;
  }

  getMultiaddrs(): string[] {
    return this.node?.getMultiaddrs().map(ma => ma.toString()) || [];
  }

  getStats(): NetworkStats {
    return {
      ...this.stats,
      uptime: this.startTime > 0 ? Date.now() - this.startTime : 0
    };
  }

  getSubscriptions(): string[] {
    return Array.from(this.subscriptions);
  }

  async connectToPeer(address: string): Promise<boolean> {
    if (!this.node) return false;

    try {
      const ma = multiaddr(address);
      await this.node.dial(ma, { signal: AbortSignal.timeout(this.config.connectionTimeout) });
      return true;
    } catch {
      return false;
    }
  }

  async disconnectFromPeer(peerId: string): Promise<void> {
    if (!this.node) return;

    try {
      const peer = peerIdFromString(peerId);
      await this.node.hangUp(peer);
    } catch {
      // Ignore disconnect errors
    }
  }

  async shutdown(): Promise<void> {
    this.shutdownRequested = true;

    for (const topic of this.subscriptions) {
      await this.unsubscribe(topic);
    }

    if (this.node) {
      await this.node.stop();
      this.node = null;
    }

    this.peers.clear();
    this.messageHandlers.clear();
    this.initialized = false;

    this.emit('shutdown');
  }

  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  private hashMessage(data: Uint8Array): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data[i];
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }

  private concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
      result.set(arr, offset);
      offset += arr.length;
    }
    return result;
  }
}
