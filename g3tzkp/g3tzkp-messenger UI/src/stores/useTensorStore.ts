/**
 * G3°PhiPiSud Tensor Store
 * Complete Zustand state management for the Tensor Coordinate and Flower of Life system
 */

import { create } from 'zustand';
import { Vector2 } from 'three';
import {
  TensorStore,
  TensorField,
  FlowerOfLifePattern,
  TensorPerformanceMetrics,
  GeometricProductResult
} from '../types/tensorTypes';
import { 
  processImageToTensorField, 
  batchGeometricProducts
} from '../utils/geometricAlgebra';
import { 
  generateFlowerOfLifePattern, 
  optimizeRays,
  processWithFlowerOfLifeOptimization
} from '../utils/flowerOfLife';

const PHI = 1.618033988749895;
const PI = 3.141592653589793;

const defaultTensorPerformance: TensorPerformanceMetrics = {
  fps: 0,
  frameTime: 0,
  stepCount: 0,
  tensorOperations: 0,
  geometricProducts: 0,
  activeRays: 0,
  tensorFieldSize: 0,
  optimizationRatio: 1
};

export const useTensorStore = create<TensorStore>((set, get) => ({
  phi: PHI,
  pi: PI,
  phiStepMultiplier: 0.5,
  piPrecisionThreshold: 0.0008,
  maxSteps: 300,
  maxDistance: 100.0,
  depthScale: 1.5,
  metricExtension: 2.0,
  eigenValue: 2.618,
  zkpProofConsistency: 1.0,
  
  // Texture modulation controls
  saturation: 1.0,
  brightness: 0.0,
  exposure: 0.0,
  contrast: 1.0,
  shadows: 0.0,
  highlights: 0.0,
  vibrance: 0.0,
  hue: 0.0,
  bwFilter: 0.0,
  
  // Zoom control
  zoomLevel: 5.0,
  stitchDensity: 1.0,
  volumetricDepth: 1.0,
  manifoldContinuity: 0.7,
  resolution: { x: window.innerWidth, y: window.innerHeight },
  time: 0,
  cameraPosition: [0, 0, 8],
  mouse: [0, 0],
  showPhiSteps: false,
  showDistanceField: false,
  showNormals: false,
  showTensorField: false,
  showFlowerOfLife: false,
  performance: {
    fps: 0,
    frameTime: 0,
    stepCount: 0
  },
  activeAssetType: null,
  assetUrl: null,
  assetTexture: null,
  tensorRank: 3,
  flowerOfLifeGenerations: 3,
  geometricProductThreshold: 100.0,
  tensorFieldResolution: 256,
  piRayDensity: 1.0,
  coordinateInvariance: true,
  bivectorScale: 1.0,
  trivectorScale: 1.0,
  tensorMagnitude: 1.0,
  flowerOfLifeActive: true,
  flowerOfLifeRotation: 0.0,
  sacredGeometryScale: 1.0,
  computationalOptimization: true,
  tensorFieldCulling: true,
  geometricProductBatching: true,
  tensorField: null,
  tensorFieldVersion: 0,
  flowerOfLifePattern: null,
  tensorPerformance: defaultTensorPerformance,

  setPhi: (phi) => set({ phi }),
  setPi: (pi) => set({ pi }),
  setPhiStepMultiplier: (phiStepMultiplier) => set({ phiStepMultiplier }),
  setPiPrecisionThreshold: (piPrecisionThreshold) => set({ piPrecisionThreshold }),
  setMaxSteps: (maxSteps) => set({ maxSteps }),
  setDepthScale: (depthScale) => set({ depthScale }),
  setMetricExtension: (metricExtension) => set({ metricExtension }),
  setEigenValue: (eigenValue) => set({ eigenValue }),
  setZkpProofConsistency: (zkpProofConsistency) => set({ zkpProofConsistency }),
  
  // Texture modulation setters
  setSaturation: (saturation) => set({ saturation }),
  setBrightness: (brightness) => set({ brightness }),
  setExposure: (exposure) => set({ exposure }),
  setContrast: (contrast) => set({ contrast }),
  setShadows: (shadows) => set({ shadows }),
  setHighlights: (highlights) => set({ highlights }),
  setVibrance: (vibrance) => set({ vibrance }),
  setHue: (hue) => set({ hue }),
  setBwFilter: (bwFilter) => set({ bwFilter }),
  
  // Zoom control
  setZoomLevel: (zoomLevel) => set({ zoomLevel }),
  setStitchDensity: (stitchDensity) => set({ stitchDensity }),
  setVolumetricDepth: (volumetricDepth) => set({ volumetricDepth }),
  setManifoldContinuity: (manifoldContinuity) => set({ manifoldContinuity }),
  
  updateTime: (dt) => set((state) => ({ time: state.time + dt })),
  setMouse: (x, y) => set({ mouse: [x, y] }),
  toggleDebug: (key) => set((state) => ({ [key]: !state[key] } as any)),
  setCameraPosition: (cameraPosition) => set({ cameraPosition }),
  updatePerformance: (performance) => set({ performance }),
  
  setAsset: (type, url = null) => set((state) => {
    if (state.assetUrl && state.assetUrl.startsWith('blob:')) {
      URL.revokeObjectURL(state.assetUrl);
    }
    return { activeAssetType: type, assetUrl: url };
  }),
  
  setAssetTexture: (assetTexture) => set({ assetTexture }),

  setTensorRank: (tensorRank) => set({ tensorRank }),
  setFlowerOfLifeGenerations: (flowerOfLifeGenerations) => {
    set({ flowerOfLifeGenerations });
    get().updateFlowerOfLifeRays();
  },
  setGeometricProductThreshold: (geometricProductThreshold) => set({ geometricProductThreshold }),
  setTensorFieldResolution: (tensorFieldResolution) => set({ tensorFieldResolution }),
  setPiRayDensity: (piRayDensity) => set({ piRayDensity }),
  setCoordinateInvariance: (coordinateInvariance) => set({ coordinateInvariance }),
  setBivectorScale: (bivectorScale) => set({ bivectorScale }),
  setTrivectorScale: (trivectorScale) => set({ trivectorScale }),
  setTensorMagnitude: (tensorMagnitude) => set({ tensorMagnitude }),
  setFlowerOfLifeActive: (flowerOfLifeActive) => set({ flowerOfLifeActive }),
  setFlowerOfLifeRotation: (flowerOfLifeRotation) => {
    set({ flowerOfLifeRotation });
    get().updateFlowerOfLifeRays();
  },
  setSacredGeometryScale: (sacredGeometryScale) => {
    set({ sacredGeometryScale });
    get().updateFlowerOfLifeRays();
  },
  setComputationalOptimization: (computationalOptimization) => set({ computationalOptimization }),
  setTensorFieldCulling: (tensorFieldCulling) => set({ tensorFieldCulling }),
  setGeometricProductBatching: (geometricProductBatching) => set({ geometricProductBatching }),

  processTensorField: (imageData: ImageData, width: number, height: number) => {
    const startTime = performance.now();
    const state = get();
    
    try {
      const tensorField = processImageToTensorField(imageData, state.tensorFieldResolution);
      
      set((s) => ({ tensorField, tensorFieldVersion: s.tensorFieldVersion + 1 }));
      
      if (state.flowerOfLifeActive) {
        const center = new Vector2(0, 0);
        let pattern = generateFlowerOfLifePattern(
          center,
          state.flowerOfLifeGenerations,
          state.pi,
          state.phi,
          state.sacredGeometryScale,
          state.flowerOfLifeRotation
        );
        
        if (state.tensorFieldCulling) {
          const optimizedRays = optimizeRays(
            pattern.rays,
            tensorField,
            state.geometricProductThreshold,
            0.1
          );
          pattern = { ...pattern, rays: optimizedRays };
        }
        
        set({ flowerOfLifePattern: pattern });
      }
      
      const processingTime = performance.now() - startTime;
      set((s) => ({
        tensorPerformance: {
          ...s.tensorPerformance,
          tensorFieldSize: tensorField.pixels.length,
          frameTime: processingTime
        }
      }));
      
    } catch (error) {
      console.error('[TensorStore] Error processing tensor field:', error);
    }
  },

  calculateGeometricProducts: (): GeometricProductResult[] => {
    const startTime = performance.now();
    const state = get();
    const { tensorField, flowerOfLifePattern, flowerOfLifeActive, computationalOptimization } = state;
    
    if (!tensorField || tensorField.pixels.length === 0) {
      return [];
    }
    
    let results: GeometricProductResult[] = [];
    let totalOperations = 0;
    let optimizationRatio = 1;
    
    try {
      if (flowerOfLifeActive && flowerOfLifePattern && computationalOptimization) {
        const processed = processWithFlowerOfLifeOptimization(
          flowerOfLifePattern,
          tensorField,
          Math.floor(state.geometricProductThreshold)
        );
        
        results = processed.products;
        totalOperations = processed.totalOperations;
        optimizationRatio = processed.optimizationRatio;
        
        set((s) => ({
          tensorPerformance: {
            ...s.tensorPerformance,
            activeRays: processed.raysProcessed,
            optimizationRatio
          }
        }));
        
      } else {
        const radiusThreshold = state.piRayDensity * 0.5;
        results = batchGeometricProducts(
          tensorField.pixels,
          radiusThreshold,
          Math.floor(state.geometricProductThreshold * 10)
        );
        totalOperations = results.length;
      }
      
      const processingTime = performance.now() - startTime;
      set((s) => ({
        tensorPerformance: {
          ...s.tensorPerformance,
          geometricProducts: totalOperations,
          tensorOperations: totalOperations,
          frameTime: processingTime,
          optimizationRatio
        }
      }));
      
    } catch (error) {
      console.error('[TensorStore] Error calculating geometric products:', error);
    }
    
    return results;
  },

  updateFlowerOfLifeRays: () => {
    const state = get();
    
    if (!state.flowerOfLifeActive) {
      set({ flowerOfLifePattern: null });
      return;
    }
    
    try {
      const center = new Vector2(0, 0);
      let pattern = generateFlowerOfLifePattern(
        center,
        state.flowerOfLifeGenerations,
        state.pi,
        state.phi,
        state.sacredGeometryScale,
        state.flowerOfLifeRotation
      );
      
      if (state.tensorField && state.tensorFieldCulling) {
        const optimizedRays = optimizeRays(
          pattern.rays,
          state.tensorField,
          state.geometricProductThreshold,
          0.1
        );
        pattern = { ...pattern, rays: optimizedRays };
      }
      
      set({ 
        flowerOfLifePattern: pattern,
        tensorPerformance: {
          ...state.tensorPerformance,
          activeRays: pattern.rays.length
        }
      });
      
    } catch (error) {
      console.error('[TensorStore] Error updating Flower of Life rays:', error);
    }
  },

  updateTensorPerformance: (metrics: Partial<TensorPerformanceMetrics>) => {
    set((state) => ({
      tensorPerformance: {
        ...state.tensorPerformance,
        ...metrics
      }
    }));
  },

  setTensorField: (field: TensorField | null) => set({ tensorField: field }),

  setFlowerOfLifePattern: (pattern: FlowerOfLifePattern | null) => set({ flowerOfLifePattern: pattern })
}));

export default useTensorStore;
