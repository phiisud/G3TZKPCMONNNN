/**
 * DEPRECATED - MobileMessagingService COMPLETELY REMOVED  
 * Use G3TZKPService for mobile messaging
 */

import { cryptoService } from './CryptoService';
import { webRTCDirectService } from './WebRTCDirectService';

class MobileMessagingService {
  constructor() { }
  
  async initialize() { }
  async sendMessage() { }
  async stop() { }
  onMessage(handler: any) { }
  onPeerDiscovered(handler: any) { }
  getPeers() { return []; }
  isInitialized() { return false; }
}

const mobileMessagingServiceInstance = new MobileMessagingService();

export { mobileMessagingServiceInstance as mobileMessagingService };
export default mobileMessagingServiceInstance;
