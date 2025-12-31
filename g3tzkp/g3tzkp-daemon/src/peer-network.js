import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const CACHE_DIR = path.join(process.env.HOME || process.env.USERPROFILE || '/tmp', '.g3tzkp', 'cache');
const PEERS_FILE = path.join(process.env.HOME || process.env.USERPROFILE || '/tmp', '.g3tzkp', 'peers.json');

export class PeerNetwork {
  constructor(bootstrapUrl, localPort = 47777) {
    this.bootstrapUrl = bootstrapUrl;
    this.localPort = localPort;
    this.peerId = this.generatePeerId();
    this.knownPeers = new Map();
    this.announcedApps = new Set();
    this.heartbeatInterval = null;
    
    this.loadPeers();
  }

  generatePeerId() {
    const existingId = this.loadPeerId();
    if (existingId) return existingId;
    
    const newId = 'peer-' + crypto.randomBytes(8).toString('hex');
    this.savePeerId(newId);
    return newId;
  }

  loadPeerId() {
    const idFile = path.join(path.dirname(PEERS_FILE), 'peer-id');
    try {
      if (fs.existsSync(idFile)) {
        return fs.readFileSync(idFile, 'utf8').trim();
      }
    } catch (e) {}
    return null;
  }

  savePeerId(id) {
    const idFile = path.join(path.dirname(PEERS_FILE), 'peer-id');
    try {
      fs.mkdirSync(path.dirname(idFile), { recursive: true });
      fs.writeFileSync(idFile, id);
    } catch (e) {}
  }

  loadPeers() {
    try {
      if (fs.existsSync(PEERS_FILE)) {
        const data = JSON.parse(fs.readFileSync(PEERS_FILE, 'utf8'));
        for (const [id, peer] of Object.entries(data.peers || {})) {
          this.knownPeers.set(id, peer);
        }
        console.log(`[P2P] Loaded ${this.knownPeers.size} known peers`);
      }
    } catch (e) {
      console.log('[P2P] No existing peers file');
    }
  }

  savePeers() {
    try {
      const data = {
        peers: Object.fromEntries(this.knownPeers),
        lastUpdated: Date.now()
      };
      fs.writeFileSync(PEERS_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
      console.log('[P2P] Failed to save peers:', e.message);
    }
  }

  async start() {
    console.log(`[P2P] Starting peer network with ID: ${this.peerId}`);
    
    await this.announceToBootstrap();
    await this.discoverPeers();
    
    this.heartbeatInterval = setInterval(async () => {
      await this.announceToBootstrap();
      await this.discoverPeers();
      this.pruneDeadPeers();
    }, 30000);
  }

  stop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }

  async announceToBootstrap() {
    try {
      const cachedApps = this.getCachedApps();
      
      const response = await fetch(`${this.bootstrapUrl}/api/peers/announce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          peerId: this.peerId,
          port: this.localPort,
          apps: cachedApps,
          timestamp: Date.now()
        })
      });
      
      if (response.ok) {
        console.log(`[P2P] Announced to bootstrap: ${cachedApps.length} apps`);
      }
    } catch (e) {
      console.log('[P2P] Bootstrap announce failed:', e.message);
    }
  }

  async discoverPeers() {
    try {
      const response = await fetch(`${this.bootstrapUrl}/api/peers/list`);
      if (!response.ok) return;
      
      const data = await response.json();
      const newPeers = data.peers || [];
      
      for (const peer of newPeers) {
        if (peer.peerId !== this.peerId) {
          this.knownPeers.set(peer.peerId, {
            ...peer,
            lastSeen: Date.now()
          });
        }
      }
      
      this.savePeers();
      console.log(`[P2P] Discovered ${newPeers.length} peers`);
    } catch (e) {
      console.log('[P2P] Peer discovery failed:', e.message);
    }
  }

  pruneDeadPeers() {
    const now = Date.now();
    const timeout = 120000;
    
    for (const [id, peer] of this.knownPeers) {
      if (now - peer.lastSeen > timeout) {
        this.knownPeers.delete(id);
        console.log(`[P2P] Removed stale peer: ${id}`);
      }
    }
    
    this.savePeers();
  }

  getCachedApps() {
    try {
      if (!fs.existsSync(CACHE_DIR)) return [];
      
      const files = fs.readdirSync(CACHE_DIR);
      return files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
    } catch (e) {
      return [];
    }
  }

  getPeersWithApp(appName) {
    const peers = [];
    const normalizedName = appName.toUpperCase();
    
    for (const [id, peer] of this.knownPeers) {
      if (peer.apps && peer.apps.includes(normalizedName)) {
        peers.push(peer);
      }
    }
    
    return peers;
  }

  async fetchFromPeers(appName) {
    const peers = this.getPeersWithApp(appName);
    console.log(`[P2P] Found ${peers.length} peers with ${appName}`);
    
    for (const peer of peers) {
      try {
        const peerUrl = `http://${peer.ip}:${peer.port}`;
        console.log(`[P2P] Trying peer: ${peerUrl}`);
        
        const response = await fetch(`${peerUrl}/api/share/${appName}`, {
          timeout: 10000
        });
        
        if (response.ok) {
          const appData = await response.json();
          console.log(`[P2P] Got ${appName} from peer ${peer.peerId}`);
          return appData;
        }
      } catch (e) {
        console.log(`[P2P] Peer ${peer.peerId} failed: ${e.message}`);
      }
    }
    
    return null;
  }

  getStatus() {
    return {
      peerId: this.peerId,
      knownPeers: this.knownPeers.size,
      cachedApps: this.getCachedApps(),
      peers: Array.from(this.knownPeers.values()).map(p => ({
        id: p.peerId,
        apps: p.apps?.length || 0,
        lastSeen: p.lastSeen
      }))
    };
  }
}
