/**
 * DEPRECATED - BrowserP2PNode COMPLETELY REMOVED
 * All P2P functionality now uses G3TZKPService
 */

export class BrowserP2PNode {
  async initialize() { return ''; }
  async sendMessage(peerId: string, message: string) { }
  onMessage(handler: (peerId: string, message: string) => void) { }
  async stop() { }
  getPeerId() { return ''; }
  isConnected() { return false; }
}
