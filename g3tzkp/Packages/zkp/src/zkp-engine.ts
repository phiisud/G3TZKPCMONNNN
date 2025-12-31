import * as snarkjs from 'snarkjs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CircuitRegistry, CircuitInfo } from './circuit-registry';

export interface ProofInputs {
  [key: string]: bigint | bigint[] | string | number;
}

export interface ZKProof {
  circuitId: string;
  proof: Uint8Array;
  publicSignals: bigint[];
  metadata: ZKProofMetadata;
}

export interface ZKProofMetadata {
  proofId: string;
  generationTime: number;
  circuitConstraints: number;
  timestamp: Date;
  proverId: string;
}

export interface ProofResult {
  proof: ZKProof;
  generationTime: number;
  cached: boolean;
}

const PROOF_CACHE_TTL = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 500;

export class ZKPEngine {
  private registry: CircuitRegistry;
  private proofCache: Map<string, ZKProof> = new Map();
  private initialized = false;

  constructor(circuitBasePath?: string) {
    this.registry = new CircuitRegistry(circuitBasePath || './zkp-circuits/build');
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    await this.registry.loadCircuits();
    
    const stats = this.registry.getStats();
    if (stats.compiledCircuits === 0) {
      throw new Error(
        'FATAL: No compiled production circuits found! ' +
        'Simulation mode is NOT supported in production deployment. ' +
        'Please compile circuits using: npm run build:circuits'
      );
    }
    
    this.initialized = true;
    console.log(`ZKP Engine initialized with ${stats.compiledCircuits} production circuits`);
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  async generateProof(circuitId: string, inputs: ProofInputs): Promise<ProofResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const circuit = this.registry.getCircuit(circuitId);
    if (!circuit) {
      throw new Error(`Circuit ${circuitId} not found`);
    }

    if (!circuit.wasmPath || !circuit.zkeyPath) {
      throw new Error(
        `Circuit ${circuitId} is not compiled. ` +
        'Only production-compiled circuits are supported. ' +
        'Please compile circuits using: npm run build:circuits'
      );
    }

    const cacheKey = this.getCacheKey(circuitId, inputs);
    const cached = this.proofCache.get(cacheKey);
    if (cached && this.isProofFresh(cached)) {
      return { proof: cached, generationTime: 0, cached: true };
    }

    const startTime = Date.now();
    const proof = await this.generateRealProof(circuit, inputs);
    const generationTime = Date.now() - startTime;

    proof.metadata.generationTime = generationTime;

    this.proofCache.set(cacheKey, proof);
    this.pruneCache();

    return { proof, generationTime, cached: false };
  }

  private async generateRealProof(circuit: CircuitInfo, inputs: ProofInputs): Promise<ZKProof> {
    const snarkInputs: Record<string, string> = {};
    for (const [key, value] of Object.entries(inputs)) {
      if (typeof value === 'bigint') {
        snarkInputs[key] = value.toString();
      } else if (Array.isArray(value)) {
        snarkInputs[key] = value.map(v => v.toString()).join(',');
      } else {
        snarkInputs[key] = String(value);
      }
    }

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      snarkInputs,
      circuit.wasmPath!,
      circuit.zkeyPath!
    );

    const proofId = this.generateProofId();

    return {
      circuitId: circuit.id,
      proof: this.serializeProof(proof),
      publicSignals: publicSignals.map(s => BigInt(s)),
      metadata: {
        proofId,
        generationTime: 0,
        circuitConstraints: circuit.constraints,
        timestamp: new Date(),
        proverId: 'snarkjs-groth16'
      }
    };
  }

  async verifyProof(proof: ZKProof): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    const circuit = this.registry.getCircuit(proof.circuitId);
    if (!circuit) {
      throw new Error(`Circuit ${proof.circuitId} not found`);
    }

    if (!circuit.verificationKey) {
      throw new Error(`No verification key available for circuit ${proof.circuitId}`);
    }

    try {
      const deserializedProof = this.deserializeProof(proof.proof);
      const publicSignals = proof.publicSignals.map((s: bigint) => s.toString());
      
      return await snarkjs.groth16.verify(
        circuit.verificationKey,
        publicSignals,
        deserializedProof
      );
    } catch (error) {
      console.error('Proof verification failed:', error);
      return false;
    }
  }

  async listCircuits(): Promise<CircuitInfo[]> {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.registry.listCircuits();
  }

  getCircuit(circuitId: string): CircuitInfo | undefined {
    return this.registry.getCircuit(circuitId);
  }

  private serializeProof(proof: any): Uint8Array {
    const json = JSON.stringify(proof);
    return new TextEncoder().encode(json);
  }

  private deserializeProof(data: Uint8Array): any {
    const json = new TextDecoder().decode(data);
    return JSON.parse(json);
  }

  private getCacheKey(circuitId: string, inputs: ProofInputs): string {
    const inputStr = JSON.stringify(inputs, (_, v) =>
      typeof v === 'bigint' ? v.toString() : v
    );
    return `${circuitId}:${inputStr}`;
  }

  private isProofFresh(proof: ZKProof): boolean {
    const age = Date.now() - proof.metadata.timestamp.getTime();
    return age < PROOF_CACHE_TTL;
  }

  private generateProofId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 11);
    return `proof_${timestamp}_${random}`;
  }

  private pruneCache(): void {
    if (this.proofCache.size > MAX_CACHE_SIZE) {
      const entries = [...this.proofCache.entries()];
      entries.sort((a, b) => 
        b[1].metadata.timestamp.getTime() - a[1].metadata.timestamp.getTime()
      );
      this.proofCache = new Map(entries.slice(0, MAX_CACHE_SIZE - 100));
    }
  }

  clearCache(): void {
    this.proofCache.clear();
  }

  getStats(): {
    circuitsLoaded: number;
    cacheSize: number;
    deploymentGrade: boolean;
  } {
    const registryStats = this.registry.getStats();
    return {
      circuitsLoaded: registryStats.totalCircuits,
      cacheSize: this.proofCache.size,
      deploymentGrade: registryStats.compiledCircuits > 0 && registryStats.simulatedCircuits === 0
    };
  }
}

export { CircuitInfo, CircuitRegistry };
