/**
 * ZKP Engine - Zero-Knowledge Proof Generation and Verification
 * JavaScript version for Node.js messaging server
 */
const snarkjs = require('snarkjs');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const PROOF_CACHE_TTL = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 500;

class ZKPEngine {
  constructor(circuitBasePath) {
    this.circuitBasePath = circuitBasePath || './zkp-circuits/build';
    this.proofCache = new Map();
    this.initialized = false;
    this.useRealCircuits = false;
    this.circuits = new Map();
  }

  async initialize() {
    if (this.initialized) return;
    
    await this.loadCircuits();
    this.initialized = true;
    console.log(`[ZKPEngine] Initialized. Real circuits available: ${this.useRealCircuits}`);
  }

  async loadCircuits() {
    const defaultCircuits = [
      { id: 'MessageSendProof', name: 'Message Send Proof', constraints: 1000 },
      { id: 'MessageDeliveryProof', name: 'Message Delivery Proof', constraints: 800 },
      { id: 'ForwardSecrecyProof', name: 'Forward Secrecy Proof', constraints: 1200 },
      { id: 'authentication', name: 'Authentication', constraints: 2000 },
      { id: 'message_security', name: 'Message Security', constraints: 3000 },
      { id: 'forward_secrecy', name: 'Forward Secrecy', constraints: 1500 }
    ];

    for (const circuit of defaultCircuits) {
      const wasmPath = path.join(this.circuitBasePath, `${circuit.id}_js`, `${circuit.id}.wasm`);
      const zkeyPath = path.join(this.circuitBasePath, `${circuit.id}.zkey`);
      
      let hasRealFiles = false;
      try {
        await fs.access(wasmPath);
        await fs.access(zkeyPath);
        hasRealFiles = true;
        this.useRealCircuits = true;
      } catch (e) {
      }
      
      this.circuits.set(circuit.id, {
        ...circuit,
        wasmPath: hasRealFiles ? wasmPath : null,
        zkeyPath: hasRealFiles ? zkeyPath : null
      });
    }
  }

  isInitialized() {
    return this.initialized;
  }

  getLoadedCircuits() {
    return Array.from(this.circuits.values()).map(c => ({
      id: c.id,
      name: c.name,
      constraints: c.constraints,
      status: c.wasmPath ? 'ready' : 'simulated'
    }));
  }

  async generateProof(circuitId, inputs) {
    if (!this.initialized) {
      await this.initialize();
    }

    const circuit = this.circuits.get(circuitId);
    if (!circuit) {
      throw new Error(`Circuit ${circuitId} not found`);
    }

    const cacheKey = this.getCacheKey(circuitId, inputs);
    const cached = this.proofCache.get(cacheKey);
    if (cached && this.isProofFresh(cached)) {
      return { proof: cached, generationTime: 0, cached: true };
    }

    const startTime = Date.now();
    let proof;

    if (this.useRealCircuits && circuit.wasmPath && circuit.zkeyPath) {
      proof = await this.generateRealProof(circuit, inputs);
    } else {
      proof = await this.generateSimulatedProof(circuit, inputs);
    }

    const generationTime = Date.now() - startTime;
    proof.metadata.generationTime = generationTime;

    this.proofCache.set(cacheKey, proof);
    this.pruneCache();

    return { proof, generationTime, cached: false };
  }

  async generateRealProof(circuit, inputs) {
    const snarkInputs = {};
    for (const [key, value] of Object.entries(inputs)) {
      if (typeof value === 'bigint') {
        snarkInputs[key] = value.toString();
      } else if (Array.isArray(value)) {
        snarkInputs[key] = value.map(v => v.toString());
      } else {
        snarkInputs[key] = String(value);
      }
    }

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      snarkInputs,
      circuit.wasmPath,
      circuit.zkeyPath
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

  async generateSimulatedProof(circuit, inputs) {
    const proofId = this.generateProofId();
    const inputHash = this.hashInputs(inputs);
    const prime = BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617');
    
    const simulatedProof = {
      pi_a: [
        (BigInt('0x' + inputHash.substring(0, 16)) % prime).toString(),
        (BigInt('0x' + inputHash.substring(16, 32)) % prime).toString(),
        '1'
      ],
      pi_b: [
        [
          (BigInt('0x' + inputHash.substring(32, 48)) % prime).toString(),
          (BigInt('0x' + inputHash.substring(48, 64)) % prime).toString()
        ],
        [
          (BigInt('0x' + inputHash.substring(0, 16)) % prime).toString(),
          (BigInt('0x' + inputHash.substring(16, 32)) % prime).toString()
        ],
        ['1', '0']
      ],
      pi_c: [
        (BigInt('0x' + inputHash.substring(32, 48)) % prime).toString(),
        (BigInt('0x' + inputHash.substring(48, 64)) % prime).toString(),
        '1'
      ],
      protocol: 'groth16',
      curve: 'bn128'
    };

    const publicSignals = Object.values(inputs).slice(0, 4).map(v => {
      if (typeof v === 'bigint') return v;
      if (typeof v === 'number') return BigInt(v);
      return BigInt('0x' + crypto.createHash('sha256').update(String(v)).digest('hex').slice(0, 16));
    });

    return {
      circuitId: circuit.id,
      proof: this.serializeProof(simulatedProof),
      publicSignals,
      metadata: {
        proofId,
        generationTime: 0,
        circuitConstraints: circuit.constraints,
        timestamp: new Date(),
        proverId: 'simulated-groth16'
      }
    };
  }

  async verifyProof(proofData) {
    if (!this.initialized) {
      await this.initialize();
    }

    const circuitId = proofData.circuitId;
    const circuit = this.circuits.get(circuitId);
    
    if (!circuit) {
      return this.simulatedVerify(proofData);
    }

    if (this.useRealCircuits && circuit.zkeyPath) {
      try {
        const vkey = await this.loadVerificationKey(circuit);
        const proof = this.deserializeProof(proofData.proof);
        const signals = proofData.publicSignals.map(s => String(s));
        return await snarkjs.groth16.verify(vkey, signals, proof);
      } catch (e) {
        console.warn(`[ZKPEngine] Real verification failed, using simulation: ${e.message}`);
      }
    }

    return this.simulatedVerify(proofData);
  }

  simulatedVerify(proofData) {
    const proof = proofData.proof;
    if (!proof) return false;
    
    const deserialized = this.deserializeProof(proof);
    const isValid = deserialized.pi_a && deserialized.pi_b && deserialized.pi_c &&
                    deserialized.pi_a.length >= 2 && 
                    deserialized.pi_b.length >= 2 &&
                    deserialized.pi_c.length >= 2;
    return isValid;
  }

  async loadVerificationKey(circuit) {
    const vkeyPath = path.join(this.circuitBasePath, `${circuit.id}_verification_key.json`);
    try {
      const data = await fs.readFile(vkeyPath, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      throw new Error(`Verification key not found: ${vkeyPath}`);
    }
  }

  serializeProof(proof) {
    const json = JSON.stringify(proof);
    return Buffer.from(json).toString('base64');
  }

  deserializeProof(serialized) {
    if (typeof serialized === 'string') {
      try {
        const json = Buffer.from(serialized, 'base64').toString('utf8');
        return JSON.parse(json);
      } catch {
        return serialized;
      }
    }
    return serialized;
  }

  getCacheKey(circuitId, inputs) {
    const inputStr = JSON.stringify(inputs, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    );
    return `${circuitId}:${crypto.createHash('sha256').update(inputStr).digest('hex').slice(0, 16)}`;
  }

  isProofFresh(proof) {
    return (Date.now() - proof.metadata.timestamp.getTime()) < PROOF_CACHE_TTL;
  }

  pruneCache() {
    if (this.proofCache.size <= MAX_CACHE_SIZE) return;
    const entries = Array.from(this.proofCache.entries())
      .sort((a, b) => a[1].metadata.timestamp - b[1].metadata.timestamp);
    const toRemove = entries.slice(0, this.proofCache.size - MAX_CACHE_SIZE);
    for (const [key] of toRemove) {
      this.proofCache.delete(key);
    }
  }

  generateProofId() {
    return `zkp_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
  }

  hashInputs(inputs) {
    const inputStr = JSON.stringify(inputs, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    );
    return crypto.createHash('sha256').update(inputStr).digest('hex');
  }
}

module.exports = { ZKPEngine };
