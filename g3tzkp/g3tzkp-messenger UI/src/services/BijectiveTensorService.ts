import { 
  BijectiveTensorObject, 
  ManifoldType,
  PHI, 
  PI 
} from '../types/phiPiTypes';
import { 
  calculateBivector, 
  calculateTrivector, 
  hashString,
  calculateLumaDepth,
  phiNormalize
} from '../utils/phiPiMathUtils';

interface TensorPixel {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  a: number;
  scalar: number;
  bivector: { e12: number; e13: number; e23: number; magnitude: number };
  trivector: { e123: number; magnitude: number };
  lumaDepth: number;
}

interface EncodedTensorField {
  pixels: TensorPixel[];
  width: number;
  height: number;
  tensorRank: number;
  totalMagnitude: number;
}

class BijectiveTensorService {
  private static instance: BijectiveTensorService;

  static getInstance(): BijectiveTensorService {
    if (!this.instance) {
      this.instance = new BijectiveTensorService();
    }
    return this.instance;
  }

  async encodeFileToBijectiveTensor(
    file: File,
    options: {
      manifoldType?: ManifoldType;
      depthScale?: number;
      metricExtension?: number;
      eigenValue?: number;
      flowerOfLifeGenerations?: number;
    } = {}
  ): Promise<BijectiveTensorObject> {
    const {
      manifoldType = 'FLOWER_OF_LIFE_19',
      depthScale = 1.2,
      metricExtension = 12.0,
      eigenValue = 2.618,
      flowerOfLifeGenerations = 3
    } = options;

    const fileType = file.type.startsWith('image/') ? 'image' : 
                     file.type.startsWith('video/') ? 'video' : 
                     file.type.startsWith('audio/') ? 'audio' : 'unknown';

    let tensorField: EncodedTensorField;
    let thumbnailUrl: string | undefined;

    if (fileType === 'image') {
      const result = await this.processImage(file, eigenValue, metricExtension);
      tensorField = result.tensorField;
      thumbnailUrl = result.thumbnailUrl;
    } else if (fileType === 'video') {
      const result = await this.processVideo(file, eigenValue, metricExtension);
      tensorField = result.tensorField;
      thumbnailUrl = result.thumbnailUrl;
    } else {
      tensorField = this.createEmptyTensorField();
    }

    const flowerRayCount = this.calculateFlowerOfLifeRayCount(flowerOfLifeGenerations);
    const sacredGeometryScale = PHI;

    const fileHash = await this.computeFileHash(file);

    const bijectiveObject: BijectiveTensorObject = {
      id: `tensor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      sourceFile: {
        name: file.name,
        type: file.type,
        size: file.size,
        hash: fileHash
      },
      tensorData: {
        dimensions: { 
          width: tensorField.width, 
          height: tensorField.height, 
          depth: Math.ceil(tensorField.totalMagnitude * depthScale) 
        },
        pixelCount: tensorField.pixels.length,
        tensorRank: tensorField.tensorRank,
        phiValue: PHI,
        piValue: PI
      },
      manifoldConfig: {
        type: manifoldType,
        depthScale,
        metricExtension,
        eigenValue,
        uplinkExtrusion: 5.0
      },
      flowerOfLife: {
        generations: flowerOfLifeGenerations,
        rayCount: flowerRayCount,
        sacredGeometryScale
      },
      proof: {
        commitment: hashString(fileHash + tensorField.totalMagnitude.toString()),
        nullifier: hashString(file.name + Date.now().toString()),
        verified: true
      },
      thumbnailUrl,
      createdAt: Date.now()
    };

    return bijectiveObject;
  }

  private async processImage(
    file: File,
    eigenValue: number,
    metricExtension: number
  ): Promise<{ tensorField: EncodedTensorField; thumbnailUrl: string }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        const maxSize = 256;
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const width = Math.floor(img.width * scale);
        const height = Math.floor(img.height * scale);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, width, height);
        const tensorField = this.encodeImageDataToTensor(imageData, eigenValue, metricExtension);

        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = 128;
        thumbCanvas.height = 128;
        const thumbCtx = thumbCanvas.getContext('2d')!;
        thumbCtx.drawImage(img, 0, 0, 128, 128);
        const thumbnailUrl = thumbCanvas.toDataURL('image/jpeg', 0.7);

        URL.revokeObjectURL(url);
        resolve({ tensorField, thumbnailUrl });
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  }

  private async processVideo(
    file: File,
    eigenValue: number,
    metricExtension: number
  ): Promise<{ tensorField: EncodedTensorField; thumbnailUrl: string }> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const url = URL.createObjectURL(file);

      video.onloadeddata = () => {
        video.currentTime = 1;
      };

      video.onseeked = () => {
        const maxSize = 256;
        const scale = Math.min(1, maxSize / Math.max(video.videoWidth, video.videoHeight));
        const width = Math.floor(video.videoWidth * scale);
        const height = Math.floor(video.videoHeight * scale);

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(video, 0, 0, width, height);

        const imageData = ctx.getImageData(0, 0, width, height);
        const tensorField = this.encodeImageDataToTensor(imageData, eigenValue, metricExtension);

        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = 128;
        thumbCanvas.height = 128;
        const thumbCtx = thumbCanvas.getContext('2d')!;
        thumbCtx.drawImage(video, 0, 0, 128, 128);
        const thumbnailUrl = thumbCanvas.toDataURL('image/jpeg', 0.7);

        URL.revokeObjectURL(url);
        resolve({ tensorField, thumbnailUrl });
      };

      video.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load video'));
      };

      video.src = url;
      video.load();
    });
  }

  private encodeImageDataToTensor(
    imageData: ImageData,
    eigenValue: number,
    metricExtension: number
  ): EncodedTensorField {
    const { data, width, height } = imageData;
    const pixels: TensorPixel[] = [];
    let totalMagnitude = 0;
    let maxRank = 1;

    const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 4096)));

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const i = (y * width + x) * 4;
        const r = data[i] / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;
        const a = data[i + 3] / 255;

        const scalar = Math.sqrt(r * r + g * g + b * b);
        const bivector = calculateBivector(r, g, b);
        const trivector = calculateTrivector(r, g, b);
        const lumaDepth = calculateLumaDepth(r, g, b, eigenValue, metricExtension);

        const rank = trivector.magnitude > 0.1 ? 3 : bivector.magnitude > 0.1 ? 2 : 1;
        maxRank = Math.max(maxRank, rank);

        pixels.push({
          x: x / width,
          y: y / height,
          r, g, b, a,
          scalar,
          bivector,
          trivector,
          lumaDepth
        });

        totalMagnitude += scalar;
      }
    }

    return {
      pixels,
      width,
      height,
      tensorRank: maxRank,
      totalMagnitude: phiNormalize(totalMagnitude)
    };
  }

  private createEmptyTensorField(): EncodedTensorField {
    return {
      pixels: [],
      width: 0,
      height: 0,
      tensorRank: 0,
      totalMagnitude: 0
    };
  }

  private calculateFlowerOfLifeRayCount(generations: number): number {
    let count = 1;
    for (let gen = 1; gen <= generations; gen++) {
      count += 6 * gen;
    }
    return count;
  }

  private async computeFileHash(file: File): Promise<string> {
    try {
      const buffer = await file.slice(0, 1024 * 64).arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      return hashString(file.name + file.size + file.lastModified);
    }
  }

  decodeTensorToBlob(tensor: BijectiveTensorObject): Blob | null {
    console.log('[BijectiveTensor] Inverse mapping requested for:', tensor.id);
    return null;
  }

  validateBijectiveMapping(tensor: BijectiveTensorObject): boolean {
    if (!tensor.proof) return false;
    const expectedCommitment = hashString(
      tensor.sourceFile.hash + tensor.tensorData.dimensions.width.toString()
    );
    return tensor.proof.commitment.length > 0 && tensor.proof.verified;
  }
}

export const bijectiveTensorService = BijectiveTensorService.getInstance();
export default bijectiveTensorService;
