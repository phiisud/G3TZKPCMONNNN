import * as fs from 'fs/promises';
import * as path from 'path';

export interface CircuitInfo {
  id: string;
  name: string;
  description?: string;
  wasmPath?: string;
  zkeyPath?: string;
  verificationKey?: any;
  constraints: number;
  publicInputs: string[];
  privateInputs: string[];
}

export class CircuitRegistry {
  private circuits: Map<string, CircuitInfo> = new Map();
  private basePath: string;
  private loaded: boolean = false;

  constructor(basePath: string = './zkp-circuits/build') {
    this.basePath = basePath;
  }

  async loadCircuits(): Promise<void> {
    if (this.loaded) return;

    const realCircuits = await this.loadRealCircuits();
    
    if (realCircuits === 0) {
      console.warn(
        'WARNING: No compiled production circuits found in ' + this.basePath +
        '\nPlease compile circuits using: npm run build:circuits'
      );
    }

    this.loaded = true;
    console.log(`Circuit Registry loaded ${this.circuits.size} production circuits`);
  }

  private async loadRealCircuits(): Promise<number> {
    let count = 0;

    try {
      const registryPath = path.join(this.basePath, 'circuit_registry.json');
      try {
        const registryContent = await fs.readFile(registryPath, 'utf-8');
        const registry = JSON.parse(registryContent);

        if (registry.circuits && Array.isArray(registry.circuits)) {
          for (const circuitDef of registry.circuits) {
            if (!circuitDef.compiled || !circuitDef.id) continue;

            const circuitId = circuitDef.id;
            const wasmPath = path.join(this.basePath, circuitDef.wasm);
            const zkeyPath = path.join(this.basePath, circuitDef.zkey);
            const vkeyPath = path.join(this.basePath, circuitDef.verification_key);

            try {
              await fs.access(wasmPath);
              await fs.access(zkeyPath);

              let verificationKey;
              try {
                const vkeyContent = await fs.readFile(vkeyPath, 'utf-8');
                verificationKey = JSON.parse(vkeyContent);
              } catch {
                throw new Error(`Verification key not found for ${circuitId}`);
              }

              this.circuits.set(circuitId, {
                id: circuitId,
                name: circuitDef.name || this.formatCircuitName(circuitId),
                wasmPath,
                zkeyPath,
                verificationKey,
                constraints: circuitDef.constraints || verificationKey?.nPublic || 1000,
                publicInputs: [],
                privateInputs: []
              });

              count++;
              console.log(`Loaded compiled circuit: ${circuitId}`);
            } catch (error) {
              console.warn(`Skipped incomplete circuit: ${circuitId}`);
            }
          }

          if (count > 0) return count;
        }
      } catch (error) {
      }

      const entries = await fs.readdir(this.basePath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const circuitId = entry.name;
          const circuitPath = path.join(this.basePath, circuitId);
          
          try {
            const wasmPath = path.join(circuitPath, `${circuitId}.wasm`);
            const zkeyPath = path.join(circuitPath, `${circuitId}.zkey`);
            const vkeyPath = path.join(circuitPath, 'verification_key.json');
            
            await fs.access(wasmPath);
            await fs.access(zkeyPath);
            
            let verificationKey;
            try {
              const vkeyContent = await fs.readFile(vkeyPath, 'utf-8');
              verificationKey = JSON.parse(vkeyContent);
            } catch {
              throw new Error(`Verification key not found for ${circuitId}`);
            }

            this.circuits.set(circuitId, {
              id: circuitId,
              name: this.formatCircuitName(circuitId),
              wasmPath,
              zkeyPath,
              verificationKey,
              constraints: verificationKey?.nPublic || 1000,
              publicInputs: [],
              privateInputs: []
            });

            count++;
            console.log(`Loaded compiled circuit: ${circuitId}`);
          } catch (error) {
            console.warn(`Skipped incomplete circuit directory: ${circuitId}`);
          }
        }
      }
    } catch (error) {
      console.warn(`Circuit build directory not found at ${this.basePath}`);
    }

    return count;
  }

  getCircuit(id: string): CircuitInfo | undefined {
    return this.circuits.get(id);
  }

  listCircuits(): CircuitInfo[] {
    return [...this.circuits.values()];
  }

  hasCircuit(id: string): boolean {
    return this.circuits.has(id);
  }

  hasCompiledCircuit(id: string): boolean {
    const circuit = this.circuits.get(id);
    return !!(circuit?.wasmPath && circuit?.zkeyPath);
  }

  getStats(): {
    totalCircuits: number;
    compiledCircuits: number;
    simulatedCircuits: number;
  } {
    let compiled = 0;
    let simulated = 0;

    for (const circuit of this.circuits.values()) {
      if (circuit.wasmPath && circuit.zkeyPath) {
        compiled++;
      } else {
        simulated++;
      }
    }

    return {
      totalCircuits: this.circuits.size,
      compiledCircuits: compiled,
      simulatedCircuits: simulated
    };
  }

  private formatCircuitName(id: string): string {
    return id
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^\s/, '')
      .replace(/\b\w/g, c => c.toUpperCase());
  }
}
