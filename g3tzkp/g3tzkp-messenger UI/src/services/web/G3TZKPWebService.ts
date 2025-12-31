import { AppManifest, AppDeployment, DeployOptions, WebMessage, AppDeploymentMessage, ChunkRequestMessage, ChunkResponseMessage, ManifestRequestMessage, ManifestResponseMessage, StateUpdateMessage } from '@/types/g3tzkp-web';
import { g3tzkpService } from '../G3TZKPService';
import { g3tzkpWebCache } from './G3TZKPWebCache';
import { g3tzkpWebManifest } from './G3TZKPWebManifest';

type MessageHandler = (message: WebMessage) => void;

class G3TZKPWebService {
  private deployedApps: Map<string, AppManifest> = new Map();
  private messageHandlers: Set<MessageHandler> = new Set();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await g3tzkpWebCache.initialize();

    g3tzkpService.onMessage((from, content, type) => {
      if (type === 'TEXT') {
        try {
          const message = JSON.parse(content) as WebMessage;
          if (message.type && message.type.startsWith('APP_')) {
            this.handleMessage(message, from);
          }
        } catch (error) {
          console.error('Failed to parse G3TZKP-WEB message:', error);
        }
      }
    });

    const cachedApps = await g3tzkpWebCache.getAllApps();
    for (const cached of cachedApps) {
      this.deployedApps.set(cached.manifest.appId, cached.manifest);
    }

    this.initialized = true;
  }

  async deploy(files: Map<string, string>, options: DeployOptions): Promise<AppDeployment> {
    await this.initialize();

    const peerId = g3tzkpService.getPeerId();
    if (!peerId) {
      throw new Error('G3TZKP service not initialized');
    }

    const appId = peerId;
    const manifest = await g3tzkpWebManifest.createManifest(appId, files, options, peerId);

    await g3tzkpWebCache.cacheApp(manifest);
    this.deployedApps.set(appId, manifest);

    const deploymentMessage: AppDeploymentMessage = {
      type: 'APP_DEPLOYMENT',
      appId,
      version: manifest.version,
      manifest,
      signature: manifest.signature,
      timestamp: Date.now(),
      senderId: peerId
    };

    await this.broadcastMessage(deploymentMessage);

    const stats = g3tzkpWebManifest.getManifestStats(manifest);
    const connectedPeers = g3tzkpService.getConnectedPeers();
    const totalChunks = manifest.files.reduce((sum, f) => sum + (f.chunks?.length || 1), 0);

    return {
      appId,
      url: `g3tzkp://${appId}`,
      manifest,
      deployedAt: manifest.deployedAt,
      peerCount: connectedPeers.length,
      totalSize: stats.totalSize,
      fileCount: manifest.files.length,
      chunkCount: totalChunks
    };
  }

  async requestManifest(appId: string): Promise<AppManifest | null> {
    await this.initialize();

    const cached = await g3tzkpWebCache.getCachedApp(appId);
    if (cached) {
      return cached.manifest;
    }

    return new Promise((resolve) => {
      const peerId = g3tzkpService.getPeerId();
      if (!peerId) {
        resolve(null);
        return;
      }

      const requestMessage: ManifestRequestMessage = {
        type: 'APP_MANIFEST_REQUEST',
        appId,
        requesterId: peerId,
        timestamp: Date.now(),
        senderId: peerId
      };

      const timeout = setTimeout(() => {
        handler();
        resolve(null);
      }, 5000);

      const handler = this.onMessage((message) => {
        if (message.type === 'APP_MANIFEST_RESPONSE' && message.appId === appId) {
          clearTimeout(timeout);
          this.messageHandlers.delete(handler);
          const responseMsg = message as ManifestResponseMessage;
          resolve(responseMsg.manifest);
        }
      });

      this.broadcastMessage(requestMessage);
    });
  }

  async requestChunk(appId: string, chunkHash: string): Promise<ArrayBuffer | null> {
    await this.initialize();

    const cached = await g3tzkpWebCache.getCachedChunk(chunkHash);
    if (cached) {
      return cached;
    }

    return new Promise((resolve) => {
      const peerId = g3tzkpService.getPeerId();
      if (!peerId) {
        resolve(null);
        return;
      }

      const requestMessage: ChunkRequestMessage = {
        type: 'APP_CHUNK_REQUEST',
        appId,
        chunkHash,
        requesterId: peerId,
        timestamp: Date.now(),
        senderId: peerId
      };

      const timeout = setTimeout(() => {
        handler();
        resolve(null);
      }, 5000);

      const handler = this.onMessage((message) => {
        if (message.type === 'APP_CHUNK_RESPONSE' && (message as ChunkResponseMessage).chunkHash === chunkHash) {
          clearTimeout(timeout);
          this.messageHandlers.delete(handler);
          const responseMsg = message as ChunkResponseMessage;
          resolve(responseMsg.chunkData);
        }
      });

      this.broadcastMessage(requestMessage);
    });
  }

  async updateState(appId: string, stateKey: string, stateData: any): Promise<void> {
    await this.initialize();

    await g3tzkpWebCache.setState(appId, stateKey, stateData);

    const peerId = g3tzkpService.getPeerId();
    if (!peerId) return;

    const stateMessage: StateUpdateMessage = {
      type: 'APP_STATE_UPDATE',
      appId,
      stateKey,
      stateData,
      timestamp: Date.now(),
      senderId: peerId
    };

    await this.broadcastMessage(stateMessage);
  }

  async getState(appId: string, stateKey: string): Promise<any> {
    await this.initialize();
    return g3tzkpWebCache.getState(appId, stateKey);
  }

  getDeployedApp(appId: string): AppManifest | undefined {
    return this.deployedApps.get(appId);
  }

  getAllDeployedApps(): AppManifest[] {
    return Array.from(this.deployedApps.values());
  }

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  private async handleMessage(message: WebMessage, from: string): Promise<void> {
    this.messageHandlers.forEach(handler => handler(message));

    switch (message.type) {
      case 'APP_DEPLOYMENT':
        await this.handleDeployment(message as AppDeploymentMessage);
        break;

      case 'APP_MANIFEST_REQUEST':
        await this.handleManifestRequest(message as ManifestRequestMessage, from);
        break;

      case 'APP_CHUNK_REQUEST':
        await this.handleChunkRequest(message as ChunkRequestMessage, from);
        break;

      case 'APP_STATE_UPDATE':
        await this.handleStateUpdate(message as StateUpdateMessage);
        break;
    }
  }

  private async handleDeployment(message: AppDeploymentMessage): Promise<void> {
    const { manifest } = message;

    const isValid = await g3tzkpWebManifest.verifyManifest(manifest);
    if (!isValid) {
      console.warn('Invalid manifest signature, ignoring deployment');
      return;
    }

    await g3tzkpWebCache.cacheApp(manifest);
    this.deployedApps.set(manifest.appId, manifest);

    console.log(`📱 New app deployed: ${manifest.name} (${manifest.appId})`);
  }

  private async handleManifestRequest(message: ManifestRequestMessage, from: string): Promise<void> {
    const manifest = this.deployedApps.get(message.appId);
    if (!manifest) return;

    const peerId = g3tzkpService.getPeerId();
    if (!peerId) return;

    const response: ManifestResponseMessage = {
      type: 'APP_MANIFEST_RESPONSE',
      appId: message.appId,
      manifest,
      timestamp: Date.now(),
      senderId: peerId
    };

    await g3tzkpService.sendMessage(from, JSON.stringify(response), 'TEXT');
  }

  private async handleChunkRequest(message: ChunkRequestMessage, from: string): Promise<void> {
    const chunk = await g3tzkpWebCache.getCachedChunk(message.chunkHash);
    if (!chunk) return;

    const peerId = g3tzkpService.getPeerId();
    if (!peerId) return;

    const response: ChunkResponseMessage = {
      type: 'APP_CHUNK_RESPONSE',
      appId: message.appId,
      chunkHash: message.chunkHash,
      chunkData: chunk,
      chunkIndex: 0,
      timestamp: Date.now(),
      senderId: peerId
    };

    await g3tzkpService.sendMessage(from, JSON.stringify(response), 'TEXT');
  }

  private async handleStateUpdate(message: StateUpdateMessage): Promise<void> {
    await g3tzkpWebCache.setState(message.appId, message.stateKey, message.stateData);
  }

  private async broadcastMessage(message: WebMessage): Promise<void> {
    const peers = g3tzkpService.getConnectedPeers();
    const messageJson = JSON.stringify(message);

    for (const peer of peers) {
      try {
        await g3tzkpService.sendMessage(peer.peerId, messageJson, 'TEXT');
      } catch (error) {
        console.error(`Failed to send to peer ${peer.peerId}:`, error);
      }
    }
  }
}

export const g3tzkpWebService = new G3TZKPWebService();
