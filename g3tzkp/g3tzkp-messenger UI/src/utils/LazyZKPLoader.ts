/**
 * Lazy ZKP Circuit Loader
 * Loads ZKP circuits on-demand instead of all at app startup
 * Reduces initial bundle size and improves startup performance
 */

import { zkpService } from '../services/ZKPService';

export type CircuitName = 
  | 'authentication'
  | 'forward_secrecy'
  | 'key_rotation'
  | 'message_send'
  | 'message_delivery'
  | 'message_security'
  | 'group_message';

interface CircuitLoadState {
  loaded: boolean;
  loading: boolean;
  error: Error | null;
  lastUsed: number;
}

class LazyZKPLoader {
  private static instance: LazyZKPLoader;
  private loadStates = new Map<CircuitName, CircuitLoadState>();
  private preloadQueue: CircuitName[] = [];
  private isPreloading = false;

  static getInstance(): LazyZKPLoader {
    if (!this.instance) {
      this.instance = new LazyZKPLoader();
    }
    return this.instance;
  }

  constructor() {
    // Initialize load states
    const circuits: CircuitName[] = [
      'authentication',
      'forward_secrecy',
      'key_rotation',
      'message_send',
      'message_delivery',
      'message_security',
      'group_message'
    ];

    circuits.forEach(circuit => {
      this.loadStates.set(circuit, {
        loaded: false,
        loading: false,
        error: null,
        lastUsed: 0
      });
    });
  }

  /**
   * Load a circuit on-demand
   * Returns immediately if already loaded/loading
   */
  async loadCircuit(circuitName: CircuitName): Promise<boolean> {
    const state = this.loadStates.get(circuitName);
    if (!state) {
      console.error(`[LazyZKP] Unknown circuit: ${circuitName}`);
      return false;
    }

    // Already loaded
    if (state.loaded) {
      state.lastUsed = Date.now();
      return true;
    }

    // Already loading - wait for it
    if (state.loading) {
      return await this.waitForLoad(circuitName);
    }

    // Start loading
    state.loading = true;
    state.error = null;

    try {
      console.log(`[LazyZKP] Loading circuit: ${circuitName}`);
      const startTime = Date.now();

      // Load circuit through ZKP service
      await zkpService.loadCircuit(circuitName);

      const loadTime = Date.now() - startTime;
      console.log(`[LazyZKP] Circuit ${circuitName} loaded in ${loadTime}ms`);

      state.loaded = true;
      state.loading = false;
      state.lastUsed = Date.now();

      return true;
    } catch (err) {
      console.error(`[LazyZKP] Failed to load circuit ${circuitName}:`, err);
      state.error = err as Error;
      state.loading = false;
      return false;
    }
  }

  /**
   * Wait for a circuit to finish loading
   */
  private async waitForLoad(circuitName: CircuitName, timeout = 30000): Promise<boolean> {
    const startTime = Date.now();
    const state = this.loadStates.get(circuitName);
    if (!state) return false;

    while (state.loading && (Date.now() - startTime) < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return state.loaded;
  }

  /**
   * Preload circuits in background (non-blocking)
   * Loads circuits in priority order during idle time
   */
  async preloadCircuits(circuits: CircuitName[]): Promise<void> {
    this.preloadQueue = [...circuits];
    
    if (this.isPreloading) return;

    this.isPreloading = true;

    // Use requestIdleCallback for non-blocking preload
    const preloadNext = () => {
      if (this.preloadQueue.length === 0) {
        this.isPreloading = false;
        console.log('[LazyZKP] Preload complete');
        return;
      }

      const circuit = this.preloadQueue.shift()!;
      
      this.loadCircuit(circuit).then(() => {
        // Schedule next preload
        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(preloadNext, { timeout: 2000 });
        } else {
          setTimeout(preloadNext, 100);
        }
      });
    };

    // Start preloading
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(preloadNext, { timeout: 2000 });
    } else {
      setTimeout(preloadNext, 100);
    }
  }

  /**
   * Preload critical circuits immediately
   * These are needed for core functionality
   */
  async preloadCritical(): Promise<void> {
    const critical: CircuitName[] = [
      'authentication',
      'message_send',
      'message_security'
    ];

    console.log('[LazyZKP] Preloading critical circuits...');
    await Promise.all(critical.map(c => this.loadCircuit(c)));
    console.log('[LazyZKP] Critical circuits loaded');
  }

  /**
   * Preload all circuits in background
   * Call this after app has loaded and user is idle
   */
  async preloadAll(): Promise<void> {
    const all: CircuitName[] = [
      'authentication',
      'message_send',
      'message_security',
      'forward_secrecy',
      'key_rotation',
      'message_delivery',
      'group_message'
    ];

    await this.preloadCircuits(all);
  }

  /**
   * Check if a circuit is loaded
   */
  isLoaded(circuitName: CircuitName): boolean {
    return this.loadStates.get(circuitName)?.loaded || false;
  }

  /**
   * Get load status for all circuits
   */
  getLoadStatus(): Record<CircuitName, CircuitLoadState> {
    const status: any = {};
    this.loadStates.forEach((state, name) => {
      status[name] = { ...state };
    });
    return status;
  }

  /**
   * Unload unused circuits to free memory
   * Unloads circuits that haven't been used in the specified time
   */
  async unloadUnused(maxAgeMs: number = 10 * 60 * 1000): Promise<void> {
    const now = Date.now();
    const toUnload: CircuitName[] = [];

    this.loadStates.forEach((state, name) => {
      if (state.loaded && (now - state.lastUsed) > maxAgeMs) {
        toUnload.push(name);
      }
    });

    if (toUnload.length > 0) {
      console.log(`[LazyZKP] Unloading ${toUnload.length} unused circuits:`, toUnload);
      
      // Mark as unloaded (actual cleanup would happen in ZKP service)
      toUnload.forEach(name => {
        const state = this.loadStates.get(name);
        if (state) {
          state.loaded = false;
          state.lastUsed = 0;
        }
      });
    }
  }

  /**
   * Get memory usage estimate
   */
  getMemoryEstimate(): { total: number; loaded: number; circuits: { name: string; size: number }[] } {
    const circuits: { name: string; size: number }[] = [];
    let loaded = 0;

    // Approximate sizes (in KB) - actual sizes from compiled artifacts
    const sizes: Record<CircuitName, number> = {
      authentication: 150,
      forward_secrecy: 200,
      key_rotation: 210,
      message_send: 175,
      message_delivery: 160,
      message_security: 215,
      group_message: 230
    };

    this.loadStates.forEach((state, name) => {
      const size = sizes[name] || 100;
      if (state.loaded) {
        loaded += size;
        circuits.push({ name, size });
      }
    });

    const total = Object.values(sizes).reduce((sum, s) => sum + s, 0);

    return { total, loaded, circuits };
  }
}

export const lazyZKPLoader = LazyZKPLoader.getInstance();
export default lazyZKPLoader;

/**
 * React Hook for lazy circuit loading
 */
export function useLazyCircuit(circuitName: CircuitName) {
  const [loaded, setLoaded] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    let mounted = true;

    async function load() {
      if (lazyZKPLoader.isLoaded(circuitName)) {
        setLoaded(true);
        return;
      }

      setLoading(true);
      const success = await lazyZKPLoader.loadCircuit(circuitName);
      
      if (mounted) {
        setLoaded(success);
        setLoading(false);
        if (!success) {
          setError(new Error(`Failed to load circuit: ${circuitName}`));
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [circuitName]);

  return { loaded, loading, error };
}

// Add React import for the hook
import * as React from 'react';
