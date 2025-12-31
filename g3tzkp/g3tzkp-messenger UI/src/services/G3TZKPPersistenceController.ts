import { Message } from '../types';
import { g3tzkpStorage } from './G3TZKPStorage';

export type PersistenceOperation = 
  | { type: 'SAVE_MESSAGE'; peerId: string; message: Message }
  | { type: 'UPDATE_MESSAGE'; messageId: string; updates: Partial<Message> }
  | { type: 'DELETE_MESSAGE'; messageId: string }
  | { type: 'SAVE_PEER'; peer: { peerId: string; displayName?: string; publicKey?: JsonWebKey; lastSeen: number; addedAt: number } };

interface QueuedJob {
  id: string;
  operation: PersistenceOperation;
  retryCount: number;
  maxRetries: number;
  createdAt: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: Error;
}

type EventType = 'job:completed' | 'job:failed' | 'job:retry' | 'queue:empty' | 'sync:complete';
type EventHandler = (data: any) => void;

const MAX_RETRIES = 3;
const RETRY_DELAYS = [100, 500, 2000];

class G3TZKPPersistenceController {
  private queue: QueuedJob[] = [];
  private processing = false;
  private initialized = false;
  private eventHandlers: Map<EventType, EventHandler[]> = new Map();
  private messageCache: Map<string, Message[]> = new Map();

  async initialize(): Promise<Map<string, Message[]>> {
    if (this.initialized) {
      return this.messageCache;
    }

    console.log('[PersistenceController] Initializing...');
    
    try {
      await g3tzkpStorage.initialize();
      this.messageCache = await g3tzkpStorage.getAllMessages();
      this.initialized = true;
      console.log('[PersistenceController] Loaded', this.messageCache.size, 'conversations');
      return this.messageCache;
    } catch (err) {
      console.error('[PersistenceController] Initialization failed:', err);
      this.initialized = true;
      return new Map();
    }
  }

  getMessages(peerId: string): Message[] {
    return this.messageCache.get(peerId) || [];
  }

  getAllMessages(): Map<string, Message[]> {
    return new Map(this.messageCache);
  }

  on(event: EventType, handler: EventHandler): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
    
    return () => {
      const handlers = this.eventHandlers.get(event) || [];
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    };
  }

  private emit(event: EventType, data?: any): void {
    const handlers = this.eventHandlers.get(event) || [];
    for (const handler of handlers) {
      try {
        handler(data);
      } catch (e) {
        console.error('[PersistenceController] Event handler error:', e);
      }
    }
  }

  saveMessage(peerId: string, message: Message): string {
    const existingMessages = this.messageCache.get(peerId) || [];
    this.messageCache.set(peerId, [...existingMessages, message]);

    const jobId = this.enqueue({
      type: 'SAVE_MESSAGE',
      peerId,
      message
    });

    return jobId;
  }

  updateMessage(messageId: string, updates: Partial<Message>): string {
    for (const [peerId, messages] of this.messageCache.entries()) {
      const index = messages.findIndex(m => m.id === messageId);
      if (index !== -1) {
        const updatedMessages = [...messages];
        updatedMessages[index] = { ...updatedMessages[index], ...updates };
        this.messageCache.set(peerId, updatedMessages);
        break;
      }
    }

    const jobId = this.enqueue({
      type: 'UPDATE_MESSAGE',
      messageId,
      updates
    });

    return jobId;
  }

  deleteMessage(messageId: string): string {
    for (const [peerId, messages] of this.messageCache.entries()) {
      const index = messages.findIndex(m => m.id === messageId);
      if (index !== -1) {
        const updatedMessages = [...messages];
        updatedMessages[index] = { 
          ...updatedMessages[index], 
          deleted: true, 
          content: '[Message deleted]' 
        };
        this.messageCache.set(peerId, updatedMessages);
        break;
      }
    }

    const jobId = this.enqueue({
      type: 'DELETE_MESSAGE',
      messageId
    });

    return jobId;
  }

  private enqueue(operation: PersistenceOperation): string {
    const job: QueuedJob = {
      id: crypto.randomUUID(),
      operation,
      retryCount: 0,
      maxRetries: MAX_RETRIES,
      createdAt: Date.now(),
      status: 'pending'
    };

    this.queue.push(job);
    this.processQueue();

    return job.id;
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const job = this.queue.find(j => j.status === 'pending');
      if (!job) break;

      job.status = 'processing';

      try {
        await this.executeJob(job);
        job.status = 'completed';
        this.emit('job:completed', { jobId: job.id, operation: job.operation });
        
        this.queue = this.queue.filter(j => j.id !== job.id);
      } catch (err) {
        job.error = err as Error;
        job.retryCount++;

        if (job.retryCount < job.maxRetries) {
          job.status = 'pending';
          const delay = RETRY_DELAYS[job.retryCount - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
          console.warn(`[PersistenceController] Job ${job.id} failed, retry ${job.retryCount}/${job.maxRetries} in ${delay}ms`);
          this.emit('job:retry', { jobId: job.id, retryCount: job.retryCount, error: err });
          
          await this.delay(delay);
        } else {
          job.status = 'failed';
          console.error(`[PersistenceController] Job ${job.id} failed after ${job.maxRetries} retries:`, err);
          this.emit('job:failed', { jobId: job.id, operation: job.operation, error: err });
          
          this.rollbackOperation(job.operation);
          
          this.queue = this.queue.filter(j => j.id !== job.id);
        }
      }
    }

    this.processing = false;
    
    if (this.queue.length === 0) {
      this.emit('queue:empty', {});
    }
  }

  private async executeJob(job: QueuedJob): Promise<void> {
    const op = job.operation;

    switch (op.type) {
      case 'SAVE_MESSAGE':
        await g3tzkpStorage.saveMessage(op.peerId, op.message);
        break;

      case 'UPDATE_MESSAGE':
        await g3tzkpStorage.updateMessage(op.messageId, op.updates);
        break;

      case 'DELETE_MESSAGE':
        await g3tzkpStorage.updateMessage(op.messageId, { 
          deleted: true, 
          content: '[Message deleted]' 
        });
        break;

      case 'SAVE_PEER':
        await g3tzkpStorage.savePeer(op.peer);
        break;

      default:
        throw new Error(`Unknown operation type`);
    }
  }

  private rollbackOperation(operation: PersistenceOperation): void {
    console.warn('[PersistenceController] Rolling back operation:', operation.type);
    
    switch (operation.type) {
      case 'SAVE_MESSAGE':
        const peerId = operation.peerId;
        const messages = this.messageCache.get(peerId) || [];
        const filtered = messages.filter(m => m.id !== operation.message.id);
        if (filtered.length > 0) {
          this.messageCache.set(peerId, filtered);
        } else {
          this.messageCache.delete(peerId);
        }
        break;

      case 'UPDATE_MESSAGE':
      case 'DELETE_MESSAGE':
        console.warn('[PersistenceController] Cannot rollback update/delete - reload required');
        break;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getQueueStatus(): { pending: number; processing: number; failed: number } {
    return {
      pending: this.queue.filter(j => j.status === 'pending').length,
      processing: this.queue.filter(j => j.status === 'processing').length,
      failed: this.queue.filter(j => j.status === 'failed').length
    };
  }

  async flush(): Promise<void> {
    while (this.queue.some(j => j.status === 'pending' || j.status === 'processing')) {
      await this.delay(50);
    }
  }

  async forceSync(): Promise<void> {
    await this.flush();
    this.messageCache = await g3tzkpStorage.getAllMessages();
    this.emit('sync:complete', { messageCount: this.messageCache.size });
  }
}

export const g3tzkpPersistence = new G3TZKPPersistenceController();
