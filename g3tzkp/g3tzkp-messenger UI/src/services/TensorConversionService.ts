export const PHI = 1.618033988749895;
export const PI = 3.141592653589793;

export const calculateOptimalStep = (n: number, s0: number, r: number, phi: number = PHI, pi: number = PI): number => {
  const phiGrowth = Math.pow(phi, n) * s0;
  const piRefinement = (pi * r) / (n + 1);
  return Math.min(phiGrowth, piRefinement);
};

export const phiNormalize = (val: number): number => {
  return (val * PHI) % 1.0;
};

export const calculateRotorHarmonic = (x: number, y: number, z: number): number => {
  const dist = Math.sqrt(x * x + y * y);
  const angle = dist * PHI + z * (PI / PHI);
  const s = Math.sin(x * PHI + angle);
  const c = Math.cos(y * PHI - angle);
  return (s * c) * 0.5 + 0.5;
};

export const calculateRBBRRBRStitch = (r: number, z: number, rotor: number, substrate: number): number => {
  const freq = (3.0 + PHI) * 2.0 * (0.9 + 0.2 * rotor);
  const sliceLayers = Math.floor(Math.abs(z) * 10.0 * PHI);
  const x = r * freq + z * PI + substrate * PHI + sliceLayers * 0.1;
  const x7 = x % 7.0;
  const idx = Math.floor(x7);
  const pattern = [1.0, 0.2, 0.2, 1.0, 1.0, 0.2, 1.0];
  return pattern[idx % 7];
};

export const calculateLumaDepth = (r: number, g: number, b: number, eigenValue: number = 2.618, metricExtension: number = 2.0): number => {
  const luma = r * 0.299 + g * 0.587 + b * 0.114;
  return Math.pow(luma, eigenValue * 0.5) * metricExtension;
};

export interface TensorPixel {
  rgb: { x: number; y: number; z: number };
  coordinate: { x: number; y: number };
  magnitude: number;
  rank: number;
  bivector: {
    e12: number;
    e13: number;
    e23: number;
    magnitude: number;
  };
  trivector: {
    e123: number;
    magnitude: number;
  };
}

export interface TensorField {
  pixels: TensorPixel[];
  bounds: {
    min: { x: number; y: number };
    max: { x: number; y: number };
  };
  resolution: number;
  width: number;
  height: number;
}

export interface FlowerOfLifeRay {
  center: { x: number; y: number };
  radius: number;
  generation: number;
  active: boolean;
}

export interface Tensor3DObject {
  id: string;
  tensorField: TensorField;
  flowerOfLifeRays: FlowerOfLifeRay[];
  dimensions: { width: number; height: number; depth: number };
  vertices: number;
  metadata: {
    phiValue: number;
    piValue: number;
    generations: number;
    sacredGeometryScale: number;
    rayCount: number;
    tensorResolution: number;
    createdAt: number;
  };
  sourceFiles: {
    url: string;
    name: string;
    type: 'image' | 'video';
  }[];
  thumbnailDataUrl: string;
}

class TensorConversionService {
  private static instance: TensorConversionService;
  
  static getInstance(): TensorConversionService {
    if (!this.instance) {
      this.instance = new TensorConversionService();
    }
    return this.instance;
  }

  createTensorPixel(r: number, g: number, b: number, x: number, y: number): TensorPixel {
    const rgb = { x: r, y: g, z: b };
    const magnitude = Math.sqrt(r * r + g * g + b * b);
    
    const bivector = {
      e12: r * g,
      e13: r * b,
      e23: g * b,
      magnitude: Math.sqrt(r * r + g * g + b * b)
    };
    
    const trivector = {
      e123: r * g * b,
      magnitude: Math.abs(r * g * b)
    };
    
    return {
      rgb,
      coordinate: { x, y },
      magnitude,
      rank: magnitude > 0.5 ? 3 : magnitude > 0.2 ? 2 : 1,
      bivector,
      trivector
    };
  }

  generateFlowerOfLifeRays(
    centerX: number,
    centerY: number,
    radius: number,
    generations: number,
    sacredGeometryScale: number
  ): FlowerOfLifeRay[] {
    const rays: FlowerOfLifeRay[] = [];
    
    rays.push({
      center: { x: centerX, y: centerY },
      radius: radius * sacredGeometryScale,
      generation: 0,
      active: true
    });
    
    for (let gen = 1; gen <= generations; gen++) {
      const circleCount = 6 * gen;
      const genRadius = radius * Math.pow(PHI, gen - 1) * sacredGeometryScale;
      
      for (let i = 0; i < circleCount; i++) {
        const angle = (i * (360 / circleCount)) * (PI / 180);
        const distance = genRadius * PHI;
        rays.push({
          center: { 
            x: centerX + Math.cos(angle) * distance,
            y: centerY + Math.sin(angle) * distance
          },
          radius: genRadius,
          generation: gen,
          active: true
        });
      }
    }
    
    return rays;
  }

  async processImageToTensorField(imageSource: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement): Promise<TensorField> {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    let width: number, height: number;
    if (imageSource instanceof HTMLVideoElement) {
      width = imageSource.videoWidth || 256;
      height = imageSource.videoHeight || 256;
    } else if (imageSource instanceof HTMLImageElement) {
      width = imageSource.naturalWidth || imageSource.width || 256;
      height = imageSource.naturalHeight || imageSource.height || 256;
    } else {
      width = imageSource.width || 256;
      height = imageSource.height || 256;
    }
    
    const resolution = 64;
    canvas.width = Math.min(width, resolution);
    canvas.height = Math.min(height, resolution);
    
    ctx.drawImage(imageSource, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    
    const pixels: TensorPixel[] = [];
    const stepX = Math.max(1, Math.floor(canvas.width / Math.sqrt(resolution)));
    const stepY = Math.max(1, Math.floor(canvas.height / Math.sqrt(resolution)));
    
    for (let y = 0; y < canvas.height; y += stepY) {
      for (let x = 0; x < canvas.width; x += stepX) {
        const i = (y * canvas.width + x) * 4;
        const r = imageData.data[i] / 255;
        const g = imageData.data[i + 1] / 255;
        const b = imageData.data[i + 2] / 255;
        
        const normalizedX = (x / canvas.width) * 2 - 1;
        const normalizedY = (y / canvas.height) * 2 - 1;
        
        pixels.push(this.createTensorPixel(r, g, b, normalizedX, normalizedY));
      }
    }
    
    return {
      pixels,
      bounds: {
        min: { x: -1, y: -1 },
        max: { x: 1, y: 1 }
      },
      resolution,
      width: canvas.width,
      height: canvas.height
    };
  }

  async convertToTensor3DObject(
    sources: { element: HTMLImageElement | HTMLVideoElement; url: string; name: string; type: 'image' | 'video' }[],
    options: {
      generations?: number;
      sacredGeometryScale?: number;
      tensorResolution?: number;
    } = {}
  ): Promise<Tensor3DObject> {
    const { 
      generations = 3, 
      sacredGeometryScale = 1.0,
      tensorResolution = 64
    } = options;
    
    let combinedTensorField: TensorField | null = null;
    const thumbnailCanvas = document.createElement('canvas');
    thumbnailCanvas.width = 128;
    thumbnailCanvas.height = 128;
    const thumbCtx = thumbnailCanvas.getContext('2d')!;
    
    const sourceCount = sources.length;
    const gridSize = Math.ceil(Math.sqrt(sourceCount));
    const cellWidth = thumbnailCanvas.width / gridSize;
    const cellHeight = thumbnailCanvas.height / gridSize;
    
    for (let idx = 0; idx < sources.length; idx++) {
      const source = sources[idx];
      const tensorField = await this.processImageToTensorField(source.element);
      
      if (!combinedTensorField) {
        combinedTensorField = tensorField;
      } else {
        combinedTensorField.pixels.push(...tensorField.pixels.map(p => ({
          ...p,
          coordinate: {
            x: p.coordinate.x + (idx % 2) * 0.5,
            y: p.coordinate.y + Math.floor(idx / 2) * 0.5
          }
        })));
      }
      
      const row = Math.floor(idx / gridSize);
      const col = idx % gridSize;
      thumbCtx.drawImage(source.element, col * cellWidth, row * cellHeight, cellWidth, cellHeight);
    }
    
    if (!combinedTensorField) {
      throw new Error('No valid sources to process');
    }
    
    const flowerOfLifeRays = this.generateFlowerOfLifeRays(
      0, 0, 
      0.3, 
      generations,
      sacredGeometryScale
    );
    
    const aspectRatio = combinedTensorField.width / combinedTensorField.height;
    const dimensions = {
      width: aspectRatio > 1 ? 2 : 2 * aspectRatio,
      height: aspectRatio > 1 ? 2 / aspectRatio : 2,
      depth: 0.5 * PHI
    };
    
    const vertices = combinedTensorField.pixels.length * 8;
    
    return {
      id: `tensor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      tensorField: combinedTensorField,
      flowerOfLifeRays,
      dimensions,
      vertices,
      metadata: {
        phiValue: PHI,
        piValue: PI,
        generations,
        sacredGeometryScale,
        rayCount: flowerOfLifeRays.length,
        tensorResolution,
        createdAt: Date.now()
      },
      sourceFiles: sources.map(s => ({
        url: s.url,
        name: s.name,
        type: s.type
      })),
      thumbnailDataUrl: thumbnailCanvas.toDataURL('image/png')
    };
  }

  exportToJSON(tensorObject: Tensor3DObject): string {
    return JSON.stringify(tensorObject, null, 2);
  }

  async importFromJSON(json: string): Promise<Tensor3DObject> {
    return JSON.parse(json);
  }
}

export const tensorConversionService = TensorConversionService.getInstance();
export default tensorConversionService;
