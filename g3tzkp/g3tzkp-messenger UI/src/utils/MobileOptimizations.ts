/**
 * Mobile Optimizations Utility
 * Performance and UX improvements for mobile devices
 */

export class MobileOptimizations {
  private static instance: MobileOptimizations;
  private isMobile: boolean;
  private isLowEndDevice: boolean;
  private devicePixelRatio: number;

  static getInstance(): MobileOptimizations {
    if (!this.instance) {
      this.instance = new MobileOptimizations();
    }
    return this.instance;
  }

  constructor() {
    this.isMobile = this.detectMobile();
    this.isLowEndDevice = this.detectLowEndDevice();
    this.devicePixelRatio = window.devicePixelRatio || 1;
    
    console.log('[MobileOpt] Device:', {
      isMobile: this.isMobile,
      isLowEnd: this.isLowEndDevice,
      dpr: this.devicePixelRatio
    });
  }

  private detectMobile(): boolean {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           window.innerWidth < 768;
  }

  private detectLowEndDevice(): boolean {
    // Check for low-end indicators
    const memoryGb = (navigator as any).deviceMemory || 4;
    const cores = navigator.hardwareConcurrency || 4;
    
    return memoryGb < 4 || cores < 4 || this.devicePixelRatio === 1;
  }

  /**
   * Get optimal device pixel ratio for rendering
   * Caps DPR on mobile to save performance
   */
  getOptimalDPR(): number {
    if (this.isLowEndDevice) return 1;
    if (this.isMobile) return Math.min(this.devicePixelRatio, 1.5);
    return Math.min(this.devicePixelRatio, 2);
  }

  /**
   * Get optimal canvas resolution
   */
  getOptimalResolution(width: number, height: number): { width: number; height: number } {
    const dpr = this.getOptimalDPR();
    return {
      width: Math.round(width * dpr),
      height: Math.round(height * dpr)
    };
  }

  /**
   * Get optimal shader quality settings
   */
  getShaderQuality(): {
    maxSteps: number;
    precision: 'lowp' | 'mediump' | 'highp';
    antialias: boolean;
  } {
    if (this.isLowEndDevice) {
      return {
        maxSteps: 32,
        precision: 'mediump',
        antialias: false
      };
    }

    if (this.isMobile) {
      return {
        maxSteps: 48,
        precision: 'mediump',
        antialias: true
      };
    }

    return {
      maxSteps: 64,
      precision: 'highp',
      antialias: true
    };
  }

  /**
   * Get optimal Three.js renderer settings
   */
  getRendererSettings(): any {
    return {
      antialias: !this.isLowEndDevice,
      alpha: true,
      powerPreference: this.isMobile ? 'low-power' : 'high-performance',
      stencil: false,
      depth: true,
      logarithmicDepthBuffer: false,
      precision: this.isLowEndDevice ? 'mediump' : 'highp'
    };
  }

  /**
   * Optimize touch event handling
   */
  optimizeTouchEvents(element: HTMLElement): () => void {
    // Prevent double-tap zoom
    element.style.touchAction = 'pan-x pan-y';
    
    // Faster tap response
    let lastTap = 0;
    const handleTouchEnd = (e: TouchEvent) => {
      const now = Date.now();
      const timeSince = now - lastTap;
      
      if (timeSince < 300 && timeSince > 0) {
        e.preventDefault();
      }
      
      lastTap = now;
    };

    element.addEventListener('touchend', handleTouchEnd, { passive: false });

    return () => {
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }

  /**
   * Debounce function for performance
   */
  debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout;
    
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }

  /**
   * Throttle function for performance
   */
  throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  }

  /**
   * Request animation frame with fallback
   */
  requestAnimFrame(callback: FrameRequestCallback): number {
    return window.requestAnimationFrame(callback);
  }

  /**
   * Cancel animation frame
   */
  cancelAnimFrame(id: number): void {
    window.cancelAnimationFrame(id);
  }

  /**
   * Check if reduced motion is preferred
   */
  prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  /**
   * Get optimal video recording settings
   */
  getRecordingSettings(): {
    videoBitsPerSecond: number;
    audioBitsPerSecond: number;
    mimeType: string;
  } {
    if (this.isLowEndDevice) {
      return {
        videoBitsPerSecond: 1500000, // 1.5 Mbps
        audioBitsPerSecond: 64000, // 64 kbps
        mimeType: 'video/webm;codecs=vp8'
      };
    }

    if (this.isMobile) {
      return {
        videoBitsPerSecond: 2000000, // 2 Mbps
        audioBitsPerSecond: 128000, // 128 kbps
        mimeType: 'video/webm;codecs=vp9'
      };
    }

    return {
      videoBitsPerSecond: 2500000, // 2.5 Mbps
      audioBitsPerSecond: 192000, // 192 kbps
      mimeType: 'video/webm;codecs=vp9'
    };
  }

  /**
   * Optimize image loading
   */
  getImageLoadSettings(): {
    maxWidth: number;
    maxHeight: number;
    quality: number;
  } {
    if (this.isLowEndDevice) {
      return {
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 0.7
      };
    }

    if (this.isMobile) {
      return {
        maxWidth: 1920,
        maxHeight: 1920,
        quality: 0.85
      };
    }

    return {
      maxWidth: 3840,
      maxHeight: 3840,
      quality: 0.92
    };
  }

  /**
   * Enable performance monitoring
   */
  enablePerformanceMonitoring(): () => void {
    let frameCount = 0;
    let lastTime = performance.now();
    let fps = 60;

    const measureFPS = () => {
      frameCount++;
      const now = performance.now();
      
      if (now >= lastTime + 1000) {
        fps = Math.round((frameCount * 1000) / (now - lastTime));
        console.log(`[MobileOpt] FPS: ${fps}`);
        
        frameCount = 0;
        lastTime = now;
        
        // Warn if FPS drops too low
        if (fps < 30 && !this.isLowEndDevice) {
          console.warn('[MobileOpt] Low FPS detected, consider reducing quality');
        }
      }
      
      requestAnimationFrame(measureFPS);
    };

    measureFPS();

    return () => {
      // Cleanup would cancel the RAF loop
    };
  }

  /**
   * Get device capabilities
   */
  getDeviceCapabilities(): {
    webgl2: boolean;
    webrtc: boolean;
    indexeddb: boolean;
    serviceWorker: boolean;
    webassembly: boolean;
  } {
    const canvas = document.createElement('canvas');
    const gl2 = canvas.getContext('webgl2');

    return {
      webgl2: !!gl2,
      webrtc: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      indexeddb: !!window.indexedDB,
      serviceWorker: 'serviceWorker' in navigator,
      webassembly: typeof WebAssembly !== 'undefined'
    };
  }

  /**
   * Optimize for battery saver mode
   */
  isBatterySaverMode(): boolean {
    // Check battery status if available
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        return battery.charging === false && battery.level < 0.2;
      });
    }
    return false;
  }

  getIsMobile(): boolean {
    return this.isMobile;
  }

  getIsLowEndDevice(): boolean {
    return this.isLowEndDevice;
  }
}

export const mobileOpt = MobileOptimizations.getInstance();
export default mobileOpt;
