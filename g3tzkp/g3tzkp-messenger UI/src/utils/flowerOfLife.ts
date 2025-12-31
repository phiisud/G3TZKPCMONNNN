import { Vector2 } from 'three';
import { FlowerOfLifePattern, FlowerRay, TensorField, GeometricProductResult, TensorPixel } from '../types/tensorTypes';
import { geometricProduct } from './geometricAlgebra';

export function generateFlowerOfLifePattern(
  center: Vector2,
  generations: number,
  pi: number,
  phi: number,
  scale: number = 1.0,
  rotation: number = 0
): FlowerOfLifePattern {
  const rays: FlowerRay[] = [];
  const circles: Array<{ center: Vector2; radius: number; generation: number }> = [];
  
  const baseRadius = 0.2 * scale;
  
  circles.push({ center: center.clone(), radius: baseRadius, generation: 0 });
  
  for (let gen = 1; gen <= generations; gen++) {
    const circleCount = 6 * gen;
    const genRadius = baseRadius * Math.pow(phi, gen - 1);
    const angleStep = (2 * pi) / circleCount;
    
    for (let i = 0; i < circleCount; i++) {
      const angle = i * angleStep + rotation;
      const distance = genRadius * phi;
      
      const circleCenter = new Vector2(
        center.x + Math.cos(angle) * distance,
        center.y + Math.sin(angle) * distance
      );
      
      circles.push({ 
        center: circleCenter, 
        radius: genRadius, 
        generation: gen 
      });
      
      const rayDirection = new Vector2(
        Math.cos(angle),
        Math.sin(angle)
      ).normalize();
      
      rays.push({
        origin: center.clone(),
        direction: rayDirection,
        length: distance * phi,
        generation: gen,
        phiScaled: true,
        active: true
      });
    }
  }
  
  return {
    center,
    generations,
    rays,
    circles,
    totalRays: rays.length,
    phiConstant: phi,
    piConstant: pi
  };
}

export function optimizeRays(
  rays: FlowerRay[],
  tensorField: TensorField,
  threshold: number,
  minDensity: number = 0.1
): FlowerRay[] {
  if (!tensorField || tensorField.pixels.length === 0) {
    return rays;
  }
  
  const optimizedRays: FlowerRay[] = [];
  
  for (const ray of rays) {
    let densitySum = 0;
    let sampleCount = 0;
    
    const steps = 10;
    for (let t = 0; t <= 1; t += 1 / steps) {
      const samplePoint = new Vector2(
        ray.origin.x + ray.direction.x * ray.length * t,
        ray.origin.y + ray.direction.y * ray.length * t
      );
      
      let closestPixel: TensorPixel | null = null;
      let minDist = Infinity;
      
      for (const pixel of tensorField.pixels) {
        const dist = pixel.position.distanceTo(samplePoint);
        if (dist < minDist) {
          minDist = dist;
          closestPixel = pixel;
        }
      }
      
      if (closestPixel && minDist < 0.1) {
        densitySum += closestPixel.magnitude;
        sampleCount++;
      }
    }
    
    const avgDensity = sampleCount > 0 ? densitySum / sampleCount : 0;
    
    if (avgDensity >= minDensity || ray.generation <= 1) {
      optimizedRays.push({ ...ray, active: true });
    } else {
      optimizedRays.push({ ...ray, active: false });
    }
  }
  
  return optimizedRays;
}

export function processWithFlowerOfLifeOptimization(
  pattern: FlowerOfLifePattern,
  field: TensorField,
  maxProducts: number
): {
  products: GeometricProductResult[];
  raysProcessed: number;
  totalOperations: number;
  optimizationRatio: number;
} {
  const products: GeometricProductResult[] = [];
  let raysProcessed = 0;
  let totalOperations = 0;
  
  const activeRays = pattern.rays.filter(ray => ray.active);
  
  for (const ray of activeRays) {
    const pixelsOnRay: TensorPixel[] = [];
    
    for (const pixel of field.pixels) {
      const pointToRayOrigin = new Vector2(
        pixel.position.x - ray.origin.x,
        pixel.position.y - ray.origin.y
      );
      
      const projectionLength = pointToRayOrigin.dot(ray.direction);
      
      if (projectionLength >= 0 && projectionLength <= ray.length) {
        const projection = new Vector2(
          ray.origin.x + ray.direction.x * projectionLength,
          ray.origin.y + ray.direction.y * projectionLength
        );
        
        const distanceToRay = pixel.position.distanceTo(projection);
        
        if (distanceToRay < 0.05) {
          pixelsOnRay.push(pixel);
        }
      }
    }
    
    if (pixelsOnRay.length >= 2) {
      raysProcessed++;
      
      for (let i = 0; i < pixelsOnRay.length - 1; i++) {
        for (let j = i + 1; j < pixelsOnRay.length; j++) {
          const product = geometricProduct(pixelsOnRay[i], pixelsOnRay[j]);
          products.push(product);
          totalOperations++;
          
          if (products.length >= maxProducts) {
            const bruteForceOps = (field.pixels.length * (field.pixels.length - 1)) / 2;
            const optimizationRatio = bruteForceOps / totalOperations;
            
            return {
              products,
              raysProcessed,
              totalOperations,
              optimizationRatio
            };
          }
        }
      }
    }
  }
  
  const bruteForceOps = (field.pixels.length * (field.pixels.length - 1)) / 2;
  const optimizationRatio = totalOperations > 0 ? bruteForceOps / totalOperations : 1;
  
  return {
    products,
    raysProcessed,
    totalOperations,
    optimizationRatio
  };
}

export function rayIntersectsPixel(
  ray: FlowerRay,
  pixelPos: Vector2,
  threshold: number = 0.05
): boolean {
  const pointToOrigin = new Vector2(
    pixelPos.x - ray.origin.x,
    pixelPos.y - ray.origin.y
  );
  
  const projectionLength = pointToOrigin.dot(ray.direction);
  
  if (projectionLength < 0 || projectionLength > ray.length) {
    return false;
  }
  
  const projection = new Vector2(
    ray.origin.x + ray.direction.x * projectionLength,
    ray.origin.y + ray.direction.y * projectionLength
  );
  
  const distance = pixelPos.distanceTo(projection);
  
  return distance < threshold;
}
