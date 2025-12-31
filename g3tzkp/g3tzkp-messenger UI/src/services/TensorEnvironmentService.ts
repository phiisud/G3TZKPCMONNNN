import { ManifoldType } from '../types/phiPiTypes';

export type EnvironmentType = 
  | 'CITY_DIGITAL'
  | 'CITY_CRYSTAL'
  | 'CITY_NEURAL'
  | 'VOID_SPACE'
  | 'OCEAN_DEPTHS'
  | 'AURORA_BOREALIS'
  | 'QUANTUM_FOAM';

export interface TensorEnvironment {
  id: EnvironmentType;
  name: string;
  description: string;
  primaryManifold: ManifoldType;
  skyColor: [number, number, number];
  fogColor: [number, number, number];
  lightIntensity: number;
  ambientIntensity: number;
  gridScale: number;
  particleCount: number;
  audioReactivity: number;
  recommendedRecordingDuration: number;
}

class TensorEnvironmentService {
  private static instance: TensorEnvironmentService;
  
  static getInstance(): TensorEnvironmentService {
    if (!this.instance) {
      this.instance = new TensorEnvironmentService();
    }
    return this.instance;
  }

  private environments: Map<EnvironmentType, TensorEnvironment>;

  constructor() {
    this.environments = new Map([
      [
        'CITY_DIGITAL',
        {
          id: 'CITY_DIGITAL',
          name: 'Digital City',
          description: 'Geometric neon metropolis with Clifford Torus architecture',
          primaryManifold: 'CLIFFORD_TORUS',
          skyColor: [0.02, 0.05, 0.15],
          fogColor: [0.0, 0.3, 1.0],
          lightIntensity: 1.5,
          ambientIntensity: 0.6,
          gridScale: 0.5,
          particleCount: 8000,
          audioReactivity: 2.5,
          recommendedRecordingDuration: 30
        }
      ],
      [
        'CITY_CRYSTAL',
        {
          id: 'CITY_CRYSTAL',
          name: 'Crystal Lattice',
          description: 'Prismatic structure using Klein Slice manifold geometry',
          primaryManifold: 'KLEIN_SLICE',
          skyColor: [0.1, 0.2, 0.25],
          fogColor: [0.5, 0.8, 1.0],
          lightIntensity: 2.0,
          ambientIntensity: 0.8,
          gridScale: 1.0,
          particleCount: 10000,
          audioReactivity: 3.0,
          recommendedRecordingDuration: 45
        }
      ],
      [
        'CITY_NEURAL',
        {
          id: 'CITY_NEURAL',
          name: 'Neural Network',
          description: 'Fractal consciousness mapped via Neural Fractal manifold',
          primaryManifold: 'NEURAL_FRACTAL',
          skyColor: [0.15, 0.02, 0.2],
          fogColor: [0.8, 0.2, 1.0],
          lightIntensity: 1.3,
          ambientIntensity: 0.5,
          gridScale: 0.3,
          particleCount: 12000,
          audioReactivity: 4.0,
          recommendedRecordingDuration: 60
        }
      ],
      [
        'VOID_SPACE',
        {
          id: 'VOID_SPACE',
          name: 'Singularity Void',
          description: 'Gravitational collapse environment - Singularity manifold',
          primaryManifold: 'SINGULARITY',
          skyColor: [0.01, 0.01, 0.02],
          fogColor: [0.1, 0.0, 0.3],
          lightIntensity: 0.8,
          ambientIntensity: 0.3,
          gridScale: 2.0,
          particleCount: 5000,
          audioReactivity: 2.0,
          recommendedRecordingDuration: 120
        }
      ],
      [
        'OCEAN_DEPTHS',
        {
          id: 'OCEAN_DEPTHS',
          name: 'Abyssal Torus',
          description: 'Deep ocean currents rendered via Basic Torus topology',
          primaryManifold: 'TORUS',
          skyColor: [0.0, 0.1, 0.2],
          fogColor: [0.0, 0.3, 0.5],
          lightIntensity: 0.6,
          ambientIntensity: 0.4,
          gridScale: 1.5,
          particleCount: 6000,
          audioReactivity: 1.8,
          recommendedRecordingDuration: 90
        }
      ],
      [
        'AURORA_BOREALIS',
        {
          id: 'AURORA_BOREALIS',
          name: 'Aurora Field',
          description: 'Polar lights over Flower of Life sacred geometry',
          primaryManifold: 'FLOWER_OF_LIFE_19',
          skyColor: [0.0, 0.3, 0.2],
          fogColor: [0.2, 0.8, 0.6],
          lightIntensity: 1.8,
          ambientIntensity: 0.7,
          gridScale: 0.8,
          particleCount: 9000,
          audioReactivity: 3.5,
          recommendedRecordingDuration: 45
        }
      ],
      [
        'QUANTUM_FOAM',
        {
          id: 'QUANTUM_FOAM',
          name: 'Quantum Foam',
          description: 'Planck-scale fluctuations via Calabi-Yau compactification',
          primaryManifold: 'CALABI_YAU',
          skyColor: [0.2, 0.1, 0.25],
          fogColor: [0.4, 0.2, 0.8],
          lightIntensity: 1.6,
          ambientIntensity: 0.6,
          gridScale: 0.2,
          particleCount: 15000,
          audioReactivity: 3.8,
          recommendedRecordingDuration: 75
        }
      ]
    ]);
  }

  getEnvironment(id: EnvironmentType): TensorEnvironment | undefined {
    return this.environments.get(id);
  }

  getAllEnvironments(): TensorEnvironment[] {
    return Array.from(this.environments.values());
  }

  getEnvironmentsByManifold(manifold: ManifoldType): TensorEnvironment[] {
    return Array.from(this.environments.values()).filter(
      env => env.primaryManifold === manifold
    );
  }

  computeGeodeticPath(
    startEnv: EnvironmentType,
    endEnv: EnvironmentType,
    steps: number = 10
  ): TensorEnvironment[] {
    const start = this.environments.get(startEnv);
    const end = this.environments.get(endEnv);
    
    if (!start || !end) return [];

    const path: TensorEnvironment[] = [];
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      
      const interpolatedEnv: TensorEnvironment = {
        ...start,
        skyColor: this.lerpColor(start.skyColor, end.skyColor, t),
        fogColor: this.lerpColor(start.fogColor, end.fogColor, t),
        lightIntensity: this.lerp(start.lightIntensity, end.lightIntensity, t),
        ambientIntensity: this.lerp(start.ambientIntensity, end.ambientIntensity, t),
        gridScale: this.lerp(start.gridScale, end.gridScale, t),
        audioReactivity: this.lerp(start.audioReactivity, end.audioReactivity, t),
      };
      
      path.push(interpolatedEnv);
    }
    
    return path;
  }

  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  private lerpColor(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
    return [
      this.lerp(a[0], b[0], t),
      this.lerp(a[1], b[1], t),
      this.lerp(a[2], b[2], t)
    ];
  }

  generateCityGridGeometry(
    gridScale: number,
    width: number,
    height: number
  ): Float32Array {
    const positions = [];
    const step = gridScale;
    
    const gridX = Math.ceil(width / step);
    const gridY = Math.ceil(height / step);
    
    for (let x = 0; x < gridX; x++) {
      for (let y = 0; y < gridY; y++) {
        const posX = x * step - width / 2;
        const posY = y * step - height / 2;
        
        const distFromCenter = Math.sqrt(posX * posX + posY * posY);
        const heightMod = Math.sin(posX * 0.5) * Math.cos(posY * 0.5) * 2;
        
        positions.push(posX, posY + heightMod * Math.max(0, 1 - distFromCenter / 50), 0);
      }
    }
    
    return new Float32Array(positions);
  }

  computeAudioReactivityScale(
    baseBass: number,
    baseReactivity: number,
    maxMultiplier: number = 2.0
  ): number {
    return baseReactivity * (1 + Math.min(baseBass, 1.0) * (maxMultiplier - 1.0));
  }
}

export const tensorEnvironmentService = TensorEnvironmentService.getInstance();
export default tensorEnvironmentService;
