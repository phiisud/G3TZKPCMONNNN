import { cryptoService, EncryptedData } from './CryptoService';
import { g3tzkpService } from './G3TZKPService';
import { Message } from '../types';

export interface QueuedMessage {
  peerId: string;
  content: string;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  isEncrypted: boolean;
  encrypted?: EncryptedData;
}

class PriorityQueue {
  private items: QueuedMessage[] = [];
  private processInterval: NodeJS.Timeout | null = null;

  enqueue(message: QueuedMessage): void {
    this.items.push(message);
    this.items.sort((a, b) => b.timestamp - a.timestamp);
  }

  dequeue(): QueuedMessage | undefined {
    return this.items.shift();
  }

  peek(): QueuedMessage | undefined {
    return this.items[0];
  }

  size(): number {
    return this.items.length;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  clear(): void {
    this.items = [];
  }

  getAll(): QueuedMessage[] {
    return [...this.items];
  }
}

class EmergencyMessagingService {
  private isOperational: boolean = false;
  private messageQueue: PriorityQueue = new PriorityQueue();
  private queueProcessor: NodeJS.Timeout | null = null;
  private fallbackTransports: Array<'websocket' | 'webrtc' | 'relay' | 'hybrid'> = ['websocket', 'webrtc', 'relay', 'hybrid'];
  private currentTransport: 'websocket' | 'webrtc' | 'relay' | 'hybrid' | null = null;
  private connectionAttempts: number = 0;
  private maxConnectionAttempts: number = 10;

  async initializeEmergencyMode(): Promise<boolean> {
    console.log('🚨 EMERGENCY MESSAGING MODE ACTIVATED');

    try {
      const cryptoValid = await this.validateCryptoSetup();
      if (!cryptoValid) {
        console.error('❌ CRYPTO FAILURE - Keys not generated');
        await this.regenerateCryptoKeys();
      }

      for (const transport of this.fallbackTransports) {
        try {
          this.currentTransport = transport;
          await this.initializeTransport(transport);
          console.log(`✅ Emergency ${transport.toUpperCase()} initialized`);
          this.isOperational = true;
          break;
        } catch (error) {
          console.warn(`⚠️ ${transport} failed:`, error instanceof Error ? error.message : String(error));
          continue;
        }
      }

      if (this.isOperational) {
        this.startQueueProcessor();
        return true;
      }

      console.warn('⚠️ No transport available, entering offline queue mode');
      this.startQueueProcessor();
      return false;
    } catch (error) {
      console.error('❌ Emergency initialization failed:', error);
      this.startQueueProcessor();
      return false;
    }
  }

  private async validateCryptoSetup(): Promise<boolean> {
    try {
      if (!cryptoService.isInitialized()) {
        await cryptoService.initialize();
      }
      const publicKey = cryptoService.getPublicKey();
      return !!publicKey && publicKey.length > 0;
    } catch (error) {
      console.error('Crypto validation failed:', error);
      return false;
    }
  }

  private async regenerateCryptoKeys(): Promise<void> {
    try {
      await cryptoService.initialize();
      console.log('✅ Crypto keys regenerated');
    } catch (error) {
      console.error('❌ Failed to regenerate crypto keys:', error);
      throw error;
    }
  }

  private async initializeTransport(transport: string): Promise<void> {
    if (transport === 'websocket' || transport === 'hybrid') {
      // G3TZKP handles initialization automatically
    } else if (transport === 'webrtc') {
      if (!window.RTCPeerConnection) {
        throw new Error('WebRTC not available');
      }
    } else if (transport === 'relay') {
      // G3TZKP handles initialization automatically
    }
  }

  private startQueueProcessor(): void {
    if (this.queueProcessor) {
      clearInterval(this.queueProcessor);
    }

    this.queueProcessor = setInterval(async () => {
      await this.processQueue();
    }, 2000);
  }

  private async processQueue(): Promise<void> {
    if (this.messageQueue.isEmpty()) return;

    const batchSize = 5;
    let processed = 0;

    while (!this.messageQueue.isEmpty() && processed < batchSize) {
      const message = this.messageQueue.dequeue();
      if (!message) continue;

      const success = await this.sendQueuedMessage(message);
      
      if (!success && message.retryCount < message.maxRetries) {
        message.retryCount++;
        this.messageQueue.enqueue(message);
      } else if (!success) {
        console.error(`❌ Message exhausted retries:`, message);
      }

      processed++;
    }
  }

  private async sendQueuedMessage(message: QueuedMessage): Promise<boolean> {
    try {
      if (!this.isOperational) {
        return false;
      }

      const encrypted = message.encrypted || 
        (message.isEncrypted ? cryptoService.encrypt(message.peerId, message.content) : undefined);

      if (this.currentTransport === 'websocket' || this.currentTransport === 'hybrid') {
        try {
          const payload = {
            id: this.generateId(16),
            senderId: this.getLocalPeerId(),
            senderName: 'LOCAL_OPERATOR',
            recipientId: message.peerId,
            content: encrypted ? undefined : message.content,
            encrypted,
            timestamp: message.timestamp,
            type: 'text' as const,
            isEncrypted: message.isEncrypted
          };

          await g3tzkpService.onMessage((message) => {
            g3tzkpService.sendMessage(message.peerId, JSON.stringify(payload));
          });
          console.log('✅ EMERGENCY MESSAGE SENT:', { peerId: message.peerId });
          return true;
        } catch (error) {
          console.warn('WebSocket send failed:', error);
          if (this.currentTransport === 'hybrid') {
            throw error;
          }
        }
      }

      if (this.currentTransport === 'webrtc') {
        return await this.tryDirectWebRTC(message.peerId, message.content);
      }

      return false;
    } catch (error) {
      console.error('❌ Failed to send queued message:', error);
      return false;
    }
  }

  private async tryDirectWebRTC(peerId: string, content: string): Promise<boolean> {
    if (!window.RTCPeerConnection) {
      return false;
    }

    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      });

      const dataChannel = pc.createDataChannel('g3zkp-emergency', { ordered: true });

      return new Promise((resolve) => {
        dataChannel.onopen = () => {
          dataChannel.send(JSON.stringify({ type: 'message', content, peerId }));
          resolve(true);
          setTimeout(() => pc.close(), 1000);
        };

        dataChannel.onerror = () => resolve(false);
        setTimeout(() => resolve(false), 10000);
      });
    } catch (error) {
      console.error('WebRTC send failed:', error);
      return false;
    }
  }

  async sendMessageNow(peerId: string, content: string): Promise<boolean> {
    if (!peerId || !content) {
      throw new Error('Invalid message parameters');
    }

    if (!this.isOperational) {
      this.enqueueMessage(peerId, content);
      return false;
    }

    try {
      const encrypted = cryptoService.encrypt(peerId, content);
      const payload = {
        id: this.generateId(16),
        senderId: this.getLocalPeerId(),
        senderName: 'LOCAL_OPERATOR',
        recipientId: peerId,
        content: undefined,
        encrypted,
        timestamp: Date.now(),
        type: 'text' as const,
        isEncrypted: true
      };

      await g3tzkpService.sendMessage(peerId, JSON.stringify(payload));
      console.log('✅ EMERGENCY MESSAGE SENT:', { peerId, length: content.length });
      return true;
    } catch (error) {
      console.error('❌ Emergency send failed:', error);
      this.enqueueMessage(peerId, content);
      return false;
    }
  }

  private enqueueMessage(peerId: string, content: string): void {
    this.messageQueue.enqueue({
      peerId,
      content,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: 5,
      isEncrypted: true
    });
  }

  async shutdown(): Promise<void> {
    if (this.queueProcessor) {
      clearInterval(this.queueProcessor);
    }
    console.log(`📦 Queue shutdown - ${this.messageQueue.size()} messages queued`);
  }

  getQueueSize(): number {
    return this.messageQueue.size();
  }

  getQueuedMessages(): QueuedMessage[] {
    return this.messageQueue.getAll();
  }

  isReady(): boolean {
    return this.isOperational;
  }

  getCurrentTransport(): string {
    return this.currentTransport || 'offline';
  }

  private generateId(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  private getLocalPeerId(): string {
    return '12D3KooW' + this.generateId(32);
  }
}

export const emergencyMessagingService = new EmergencyMessagingService();
