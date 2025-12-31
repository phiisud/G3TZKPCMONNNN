import io, { Socket } from 'socket.io-client';

export interface NearbyPeer {
  peerId: string;
  displayName?: string;
  distance?: number;
  signalStrength: number;
  lastSeen: number;
  publicKey: string;
}

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

class PeerDiscoveryService {
  private socket: Socket | null = null;
  private discoveryActive = false;
  private nearbyPeers = new Map<string, NearbyPeer>();
  private listeners = new Set<(peers: NearbyPeer[]) => void>();
  private connectionStatus: ConnectionStatus = 'disconnected';
  private connectionListeners = new Set<(status: ConnectionStatus) => void>();

  initialize(serverUrl?: string): void {
    if (this.socket) return;

    const wsProtocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
    const defaultUrl = `${wsProtocol === 'wss' ? 'https' : 'http'}://${host}:3001`;
    const url = serverUrl || defaultUrl;

    console.log('[PeerDiscovery] Connecting to:', url);
    this.setConnectionStatus('connecting');

    this.socket = io(url, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    this.socket.on('connect', () => {
      console.log('[PeerDiscovery] Socket connected');
      this.setConnectionStatus('connected');
    });

    this.socket.on('connect_error', (err) => {
      console.log('[PeerDiscovery] Connection error:', err.message);
      this.setConnectionStatus('error');
    });

    this.socket.on('disconnect', () => {
      console.log('[PeerDiscovery] Socket disconnected');
      this.setConnectionStatus('disconnected');
    });

    this.socket.on('peer:discovered', this.handlePeerDiscovered.bind(this));
    this.socket.on('peer:lost', this.handlePeerLost.bind(this));
  }

  private setConnectionStatus(status: ConnectionStatus): void {
    this.connectionStatus = status;
    this.connectionListeners.forEach(cb => cb(status));
  }

  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  onConnectionChange(callback: (status: ConnectionStatus) => void): () => void {
    this.connectionListeners.add(callback);
    callback(this.connectionStatus);
    return () => {
      this.connectionListeners.delete(callback);
    };
  }

  startDiscovery(localPeerId: string, location?: { lat: number; lon: number }): void {
    if (!this.socket) {
      throw new Error('Discovery service not initialized');
    }

    this.discoveryActive = true;

    this.socket.emit('peer:announce', {
      peerId: localPeerId,
      location,
      timestamp: Date.now()
    });

    this.socket.emit('peer:discover', {
      peerId: localPeerId,
      radius: 100,
      location
    });

    const intervalId = setInterval(() => {
      if (!this.discoveryActive) {
        clearInterval(intervalId);
        return;
      }

      this.socket?.emit('peer:discover', {
        peerId: localPeerId,
        radius: 100,
        location
      });

      const now = Date.now();
      for (const [id, peer] of this.nearbyPeers.entries()) {
        if (now - peer.lastSeen > 30000) {
          this.nearbyPeers.delete(id);
          this.notifyListeners();
        }
      }
    }, 5000);
  }

  stopDiscovery(): void {
    this.discoveryActive = false;
    this.nearbyPeers.clear();
    this.notifyListeners();
  }

  getNearbyPeers(): NearbyPeer[] {
    return Array.from(this.nearbyPeers.values())
      .sort((a, b) => (a.distance || 0) - (b.distance || 0));
  }

  subscribe(callback: (peers: NearbyPeer[]) => void): () => void {
    this.listeners.add(callback);
    callback(this.getNearbyPeers());

    return () => {
      this.listeners.delete(callback);
    };
  }

  private handlePeerDiscovered(data: any): void {
    const peer: NearbyPeer = {
      peerId: data.peerId,
      displayName: data.displayName,
      distance: data.distance,
      signalStrength: data.signalStrength || 100,
      lastSeen: Date.now(),
      publicKey: data.publicKey
    };

    this.nearbyPeers.set(peer.peerId, peer);
    this.notifyListeners();
  }

  private handlePeerLost(data: any): void {
    this.nearbyPeers.delete(data.peerId);
    this.notifyListeners();
  }

  private notifyListeners(): void {
    const peers = this.getNearbyPeers();
    this.listeners.forEach(callback => callback(peers));
  }

  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}

export const peerDiscoveryService = new PeerDiscoveryService();
export default peerDiscoveryService;
