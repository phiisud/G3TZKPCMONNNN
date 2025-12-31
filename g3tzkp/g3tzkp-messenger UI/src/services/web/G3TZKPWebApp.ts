import { g3tzkpWebService } from './G3TZKPWebService';
import { AppManifest } from '@/types/g3tzkp-web';

export abstract class G3TZKPWebApp {
  protected appId: string = '';
  protected manifest: AppManifest | null = null;
  private stateUpdateCallbacks: Map<string, Set<(value: any) => void>> = new Map();
  private messageCallbacks: Set<(from: string, message: any) => void> = new Set();
  private unsubscribers: Array<() => void> = [];

  async start(): Promise<void> {
    if (typeof window === 'undefined') {
      throw new Error('G3TZKPWebApp can only run in browser environment');
    }

    const api = (window as any).g3tzkpWebAPI;
    if (!api) {
      throw new Error('G3TZKP Web API not available. App must be loaded via g3tzkp:// protocol');
    }

    this.appId = api.appId;

    const unsubscribe = api.onStateUpdate((key: string, value: any) => {
      this.handleStateUpdate(key, value);
    });
    this.unsubscribers.push(unsubscribe);

    await this.onMount();
  }

  stop(): void {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    this.onUnmount();
  }

  protected async getState(key: string): Promise<any> {
    const api = (window as any).g3tzkpWebAPI;
    if (!api) throw new Error('API not available');
    return api.getState(key);
  }

  protected async setState(key: string, value: any): Promise<void> {
    const api = (window as any).g3tzkpWebAPI;
    if (!api) throw new Error('API not available');
    await api.setState(key, value);
    this.handleStateUpdate(key, value);
  }

  protected onStateUpdate(key: string, callback: (value: any) => void): () => void {
    if (!this.stateUpdateCallbacks.has(key)) {
      this.stateUpdateCallbacks.set(key, new Set());
    }
    
    this.stateUpdateCallbacks.get(key)!.add(callback);
    
    return () => {
      this.stateUpdateCallbacks.get(key)?.delete(callback);
    };
  }

  protected async broadcast(message: any): Promise<void> {
    await this.setState('broadcast', {
      message,
      timestamp: Date.now(),
      sender: this.getPeerId()
    });
  }

  protected onMessage(callback: (from: string, message: any) => void): () => void {
    this.messageCallbacks.add(callback);
    return () => this.messageCallbacks.delete(callback);
  }

  protected getAppId(): string {
    return this.appId;
  }

  protected getPeerId(): string {
    return this.appId;
  }

  private handleStateUpdate(key: string, value: any): void {
    const callbacks = this.stateUpdateCallbacks.get(key);
    if (callbacks) {
      callbacks.forEach(callback => callback(value));
    }

    if (key === 'broadcast' && value?.message) {
      this.messageCallbacks.forEach(callback => {
        callback(value.sender, value.message);
      });
    }
  }

  protected abstract onMount(): Promise<void>;
  
  protected onUnmount(): void {
  }
}
