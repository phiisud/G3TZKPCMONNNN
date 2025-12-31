import { Vector2, Vector3 } from 'three';
import { TensorPixel, TensorField, GeometricProductResult } from '../types/tensorTypes';

export function createTensorPixel(
  x: number,
  y: number,
  color: [number, number, number, number],
  rank: number
): TensorPixel {
  const r = color[0] / 255;
  const g = color[1] / 255;
  const b = color[2] / 255;
  const a = color[3] / 255;

  const scalar = (r + g + b) / 3;
  
  const bivector = new Vector3(
    r - scalar,
    g - scalar,
    b - scalar
  );
  
  const trivector = bivector.x * bivector.y * bivector.z;
  
  const magnitude = Math.sqrt(
    scalar * scalar +
    bivector.lengthSq() +
    trivector * trivector
  );

  return {
    position: new Vector2(x, y),
    color,
    scalar,
    bivector,
    trivector,
    magnitude,
    rank
  };
}

export function processImageToTensorField(
  imageData: ImageData,
  resolution: number = 256
): TensorField {
  const { width, height, data } = imageData;
  const pixels: TensorPixel[] = [];
  
  const stepX = Math.max(1, Math.floor(width / resolution));
  const stepY = Math.max(1, Math.floor(height / resolution));
  
  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      const idx = (y * width + x) * 4;
      const color: [number, number, number, number] = [
        data[idx],
        data[idx + 1],
        data[idx + 2],
        data[idx + 3]
      ];
      
      const normalizedX = (x / width) * 2 - 1;
      const normalizedY = (y / height) * 2 - 1;
      
      const pixel = createTensorPixel(normalizedX, normalizedY, color, 3);
      pixels.push(pixel);
    }
  }
  
  const PHI = 1.618033988749895;
  const PI = 3.141592653589793;
  
  return {
    pixels,
    width,
    height,
    resolution,
    phiValue: PHI,
    piValue: PI,
    timestamp: Date.now()
  };
}

export function geometricProduct(p1: TensorPixel, p2: TensorPixel): GeometricProductResult {
  const scalarPart = p1.scalar * p2.scalar - p1.bivector.dot(p2.bivector);
  
  const bivectorPart = new Vector3(
    p1.scalar * p2.bivector.x + p2.scalar * p1.bivector.x,
    p1.scalar * p2.bivector.y + p2.scalar * p1.bivector.y,
    p1.scalar * p2.bivector.z + p2.scalar * p1.bivector.z
  );
  
  const trivectorPart = p1.scalar * p2.trivector + p2.scalar * p1.trivector +
    p1.bivector.x * p2.bivector.y * p2.bivector.z +
    p2.bivector.x * p1.bivector.y * p1.bivector.z;
  
  const grade = Math.abs(scalarPart) > 0.1 ? 0 : 
                bivectorPart.length() > 0.1 ? 2 : 3;
  
  const distance = p1.position.distanceTo(p2.position);
  
  return {
    pixel1: p1,
    pixel2: p2,
    scalarPart,
    bivectorPart,
    trivectorPart,
    grade,
    distance
  };
}

export function batchGeometricProducts(
  pixels: TensorPixel[],
  radiusThreshold: number,
  maxProducts: number = 1000
): GeometricProductResult[] {
  const results: GeometricProductResult[] = [];
  const pixelCount = pixels.length;
  
  if (pixelCount < 2) return results;
  
  const samplingRate = Math.max(1, Math.floor(pixelCount * pixelCount / maxProducts));
  let sampleIndex = 0;
  
  for (let i = 0; i < pixelCount - 1; i++) {
    for (let j = i + 1; j < pixelCount; j++) {
      sampleIndex++;
      if (sampleIndex % samplingRate !== 0) continue;
      
      const p1 = pixels[i];
      const p2 = pixels[j];
      
      const distance = p1.position.distanceTo(p2.position);
      
      if (distance <= radiusThreshold) {
        const product = geometricProduct(p1, p2);
        results.push(product);
        
        if (results.length >= maxProducts) {
          return results;
        }
      }
    }
  }
  
  return results;
}

export function calculateTensorNorm(pixel: TensorPixel): number {
  return Math.sqrt(
    pixel.scalar * pixel.scalar +
    pixel.bivector.lengthSq() +
    pixel.trivector * pixel.trivector
  );
}

export function normalizeTensorPixel(pixel: TensorPixel): TensorPixel {
  const norm = calculateTensorNorm(pixel);
  if (norm === 0) return pixel;
  
  return {
    ...pixel,
    scalar: pixel.scalar / norm,
    bivector: pixel.bivector.clone().multiplyScalar(1 / norm),
    trivector: pixel.trivector / norm,
    magnitude: 1
  };
}
