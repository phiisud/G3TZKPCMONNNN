/**
 * DEPRECATED - LibP2P Service COMPLETELY REMOVED
 * All P2P functionality now uses G3TZKPService
 * This stub prevents import errors
 */

import { EventEmitter } from 'events';

export type GeoReportTopicHandler = (data: any, from: string) => void;

export interface LibP2PMessage {
  id: string;
  from: string;
  to: string | 'broadcast';
  data: Uint8Array;
  timestamp: Date;
  type: 'direct' | 'broadcast' | 'discovery';
  topic?: string;
}

export interface LibP2PPeerInfo {
  id: string;
  addresses: string[];
  protocols: string[];
  latency: number;
  lastSeen: Date;
  connectionStatus: 'connected' | 'disconnected' | 'connecting';
  metadata: Record<string, any>;
}

class LibP2PService extends EventEmitter {
  constructor() {
    super();
  }

  async initialize() { return ''; }
  async start() { return true; }
  async stop() { }
  async sendMessage() { }
  async subscribeToTopic() { }
  async subscribeToGeoTopic() { }
  onMessage(handler: any) { }
  onPeerConnected(handler: any) { }
  onPeerDisconnected(handler: any) { }
  getPeers() { return []; }
  getLocalPeerId() { return ''; }
  isInitialized() { return false; }
  getConnectionStatus() { return 'disconnected'; }
}

const libP2PServiceInstance = new LibP2PService();

export { libP2PServiceInstance as libP2PService };
export default libP2PServiceInstance;
