/**
 * G3ZKP Production Zero-Knowledge Proof Service
 * Uses locally compiled Groth16 circuits with snarkjs for real ZKP
 * Browser-compatible implementation - snarkjs handles WASM/ZKey fetching
 */

// @ts-ignore - snarkjs types
import * as snarkjs from 'snarkjs';

export interface ZKProof {
  id: string;
  circuitName: string;
  publicInputs: string[];
  proof: {
    pi_a: string[];
    pi_b: string[][];
    pi_c: string[];
  };
  verified: boolean;
  timestamp: number;
  generationTime: number;
  mode: 'production';
}

export interface CircuitInfo {
  name: string;
  version: string;
  constraints: number;
  inputs: string[];
  outputs: string[];
  status: 'ready' | 'loading' | 'error';
}

interface CircuitArtifacts {
  wasmUrl: string;
  zkeyUrl: string;
  vkey: any | null;
  loaded: boolean;
}

interface CircuitConfig {
  version: string;
  constraints: number;
  publicInputs: string[];
  privateInputs: string[];
  outputs: string[];
  circuitFile: string;
}

const CIRCUIT_REGISTRY: Record<string, CircuitConfig> = {
  'authentication': {
    version: '1.0.0',
    constraints: 497,
    publicInputs: ['identityCommitment', 'nullifierHash', 'externalNullifier'],
    privateInputs: ['identitySecret', 'identityNullifier'],
    outputs: ['valid'],
    circuitFile: 'authentication'
  },
  'forward_secrecy': {
    version: '1.0.0',
    constraints: 996,
    publicInputs: ['oldKeyCommitment', 'newKeyCommitment', 'deletionProof'],
    privateInputs: ['oldKeySecret', 'newKeySecret', 'rotationNonce'],
    outputs: ['valid', 'rotationCommitment'],
    circuitFile: 'forward_secrecy'
  },
  'group_message': {
    version: '1.0.0',
    constraints: 1126,
    publicInputs: ['groupId', 'groupMembershipRoot', 'messageHash', 'timestamp'],
    privateInputs: ['memberSecret', 'groupSecret', 'encryptionKey', 'nonce'],
    outputs: ['valid', 'groupMessageCommitment'],
    circuitFile: 'group_message'
  },
  'key_rotation': {
    version: '1.0.0',
    constraints: 1057,
    publicInputs: ['currentKeyCommitment', 'nextKeyCommitment', 'rotationIndex'],
    privateInputs: ['currentKey', 'nextKey', 'rotationSecret', 'rotationCounter'],
    outputs: ['valid', 'rotationEvent'],
    circuitFile: 'key_rotation'
  },
  'message_delivery': {
    version: '1.0.0',
    constraints: 336,
    publicInputs: ['messageHash', 'recipientPublicKey', 'deliveryTimestamp'],
    privateInputs: ['decryptionProof', 'ackNonce'],
    outputs: ['valid', 'deliveryReceipt'],
    circuitFile: 'message_delivery'
  },
  'message_security': {
    version: '1.0.0',
    constraints: 1058,
    publicInputs: ['messageRoot', 'timestamp', 'senderCommitment', 'receiverCommitment'],
    privateInputs: ['messageHash', 'encryptionKeyHash', 'senderSecret', 'receiverSecret', 'nonce'],
    outputs: ['valid', 'encryptedMessageHash'],
    circuitFile: 'message_security'
  },
  'message_send': {
    version: '1.0.0',
    constraints: 589,
    publicInputs: ['messageHash', 'senderPublicKey', 'recipientPublicKey', 'timestamp'],
    privateInputs: ['plaintextHash', 'encryptionKey', 'nonce'],
    outputs: ['valid', 'encryptionProof'],
    circuitFile: 'message_send'
  }
};

class ZKPService {
  private proofCache: Map<string, ZKProof> = new Map();
  private proofCounter: number = 0;
  private initialized: boolean = false;
  private circuitArtifacts: Map<string, CircuitArtifacts> = new Map();
  private circuitStatus: Map<string, 'ready' | 'loading' | 'error'> = new Map();

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    console.log('[ZKPService] Initializing with compiled Groth16 circuits...');
    
    const basePath = '/circuits';
    
    for (const [name, config] of Object.entries(CIRCUIT_REGISTRY)) {
      this.circuitArtifacts.set(name, {
        wasmUrl: `${basePath}/${config.circuitFile}_js/${config.circuitFile}.wasm`,
        zkeyUrl: `${basePath}/${config.circuitFile}.zkey`,
        vkey: null,
        loaded: false
      });
      this.circuitStatus.set(name, 'loading');
    }
    
    const loadPromises = Object.entries(CIRCUIT_REGISTRY).map(async ([name, config]) => {
      const vkeyPath = `${basePath}/${config.circuitFile}_verification_key.json`;
      const artifacts = this.circuitArtifacts.get(name)!;
      
      try {
        const vkeyResponse = await fetch(vkeyPath);
        if (!vkeyResponse.ok) {
          throw new Error(`Failed to load verification key for ${name}`);
        }
        
        artifacts.vkey = await vkeyResponse.json();
        artifacts.loaded = true;
        
        this.circuitStatus.set(name, 'ready');
        console.log(`[ZKPService] Circuit ${name} ready`);
      } catch (err) {
        console.error(`[ZKPService] Failed to load circuit ${name}:`, err);
        this.circuitStatus.set(name, 'error');
      }
    });
    
    await Promise.all(loadPromises);
    
    const readyCount = Array.from(this.circuitStatus.values()).filter(s => s === 'ready').length;
    console.log(`[ZKPService] Initialized: ${readyCount}/${Object.keys(CIRCUIT_REGISTRY).length} circuits ready`);
    
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getMode(): 'production' {
    return 'production';
  }

  getCircuits(): CircuitInfo[] {
    return Object.entries(CIRCUIT_REGISTRY).map(([name, config]) => ({
      name,
      version: config.version,
      constraints: config.constraints,
      inputs: [...config.publicInputs, ...config.privateInputs],
      outputs: config.outputs,
      status: this.circuitStatus.get(name) || 'loading'
    }));
  }

  getCircuitInfo(circuitName: string): CircuitInfo | null {
    const config = CIRCUIT_REGISTRY[circuitName];
    if (!config) return null;
    
    return {
      name: circuitName,
      version: config.version,
      constraints: config.constraints,
      inputs: [...config.publicInputs, ...config.privateInputs],
      outputs: config.outputs,
      status: this.circuitStatus.get(circuitName) || 'loading'
    };
  }

  async generateProof(
    circuitName: string,
    inputs: Record<string, string | number | bigint>
  ): Promise<ZKProof> {
    const startTime = performance.now();
    
    if (!this.initialized) {
      await this.initialize();
    }

    const artifacts = this.circuitArtifacts.get(circuitName);
    const config = CIRCUIT_REGISTRY[circuitName];
    
    if (!artifacts || !config) {
      throw new Error(`[ZKPService] Circuit ${circuitName} not found`);
    }

    if (!artifacts.loaded) {
      throw new Error(`[ZKPService] Circuit ${circuitName} not loaded - status: ${this.circuitStatus.get(circuitName)}`);
    }

    const circuitInputs: Record<string, string> = {};
    for (const [key, value] of Object.entries(inputs)) {
      circuitInputs[key] = typeof value === 'bigint' ? value.toString() : String(value);
    }

    console.log(`[ZKPService] Generating Groth16 proof for ${circuitName}...`);
    
    try {
      const { proof, publicSignals } = await snarkjs.groth16.fullProve(
        circuitInputs,
        artifacts.wasmUrl,
        artifacts.zkeyUrl
      );

      const generationTime = performance.now() - startTime;
      const proofId = `zkp_${circuitName}_${++this.proofCounter}_${Date.now()}`;

      const zkProof: ZKProof = {
        id: proofId,
        circuitName,
        publicInputs: publicSignals,
        proof: {
          pi_a: proof.pi_a,
          pi_b: proof.pi_b,
          pi_c: proof.pi_c
        },
        verified: false,
        timestamp: Date.now(),
        generationTime,
        mode: 'production'
      };

      this.proofCache.set(proofId, zkProof);
      console.log(`[ZKPService] Proof generated in ${generationTime.toFixed(0)}ms`);
      
      return zkProof;
    } catch (err) {
      console.error(`[ZKPService] Proof generation failed for ${circuitName}:`, err);
      throw new Error(`[ZKPService] Proof generation failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async verifyProof(proofId: string): Promise<boolean> {
    const proof = this.proofCache.get(proofId);
    if (!proof) {
      throw new Error(`[ZKPService] Proof ${proofId} not found`);
    }

    const artifacts = this.circuitArtifacts.get(proof.circuitName);
    if (!artifacts || !artifacts.vkey) {
      throw new Error(`[ZKPService] Verification key not loaded for ${proof.circuitName}`);
    }

    console.log(`[ZKPService] Verifying Groth16 proof ${proofId}...`);

    try {
      const isValid = await snarkjs.groth16.verify(
        artifacts.vkey,
        proof.publicInputs,
        proof.proof
      );

      proof.verified = isValid;
      this.proofCache.set(proofId, proof);
      
      console.log(`[ZKPService] Proof verification: ${isValid ? 'VALID' : 'INVALID'}`);
      return isValid;
    } catch (err) {
      console.error(`[ZKPService] Proof verification failed:`, err);
      throw new Error(`[ZKPService] Verification failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async verifyProofDirect(
    circuitName: string,
    proof: { pi_a: string[]; pi_b: string[][]; pi_c: string[] },
    publicSignals: string[]
  ): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    const artifacts = this.circuitArtifacts.get(circuitName);
    if (!artifacts || !artifacts.vkey) {
      throw new Error(`[ZKPService] Verification key not loaded for ${circuitName}`);
    }

    try {
      return await snarkjs.groth16.verify(artifacts.vkey, publicSignals, proof);
    } catch (err) {
      console.error(`[ZKPService] Direct verification failed:`, err);
      return false;
    }
  }

  async generateMessageSendProof(params: {
    messageHash: string;
    senderPublicKey: string;
    recipientPublicKey: string;
    timestamp: number;
    plaintextHash: string;
    encryptionKey: string;
    nonce: string;
  }): Promise<ZKProof> {
    return this.generateProof('message_send', {
      messageHash: params.messageHash,
      senderPublicKey: params.senderPublicKey,
      recipientPublicKey: params.recipientPublicKey,
      timestamp: params.timestamp,
      plaintextHash: params.plaintextHash,
      encryptionKey: params.encryptionKey,
      nonce: params.nonce
    });
  }

  async generateMessageDeliveryProof(params: {
    messageHash: string;
    recipientPublicKey: string;
    deliveryTimestamp: number;
    decryptionProof: string;
    ackNonce: string;
  }): Promise<ZKProof> {
    return this.generateProof('message_delivery', params);
  }

  async generateForwardSecrecyProof(params: {
    oldKeyCommitment: string;
    newKeyCommitment: string;
    deletionProof: string;
    oldKeySecret: string;
    newKeySecret: string;
    rotationNonce: string;
  }): Promise<ZKProof> {
    return this.generateProof('forward_secrecy', params);
  }

  async generateAuthenticationProof(params: {
    identityCommitment: string;
    nullifierHash: string;
    externalNullifier: string;
    identitySecret: string;
    identityNullifier: string;
  }): Promise<ZKProof> {
    return this.generateProof('authentication', params);
  }

  async generateGroupMessageProof(params: {
    groupId: string;
    groupMembershipRoot: string;
    messageHash: string;
    timestamp: number;
    memberSecret: string;
    groupSecret: string;
    encryptionKey: string;
    nonce: string;
  }): Promise<ZKProof> {
    return this.generateProof('group_message', params);
  }

  async generateKeyRotationProof(params: {
    currentKeyCommitment: string;
    nextKeyCommitment: string;
    rotationIndex: number;
    currentKey: string;
    nextKey: string;
    rotationSecret: string;
    rotationCounter: number;
  }): Promise<ZKProof> {
    return this.generateProof('key_rotation', params);
  }

  async generateMessageSecurityProof(params: {
    messageRoot: string;
    timestamp: number;
    senderCommitment: string;
    receiverCommitment: string;
    messageHash: string;
    encryptionKeyHash: string;
    senderSecret: string;
    receiverSecret: string;
    nonce: string;
  }): Promise<ZKProof> {
    return this.generateProof('message_security', params);
  }

  getProof(proofId: string): ZKProof | undefined {
    return this.proofCache.get(proofId);
  }

  getAllProofs(): ZKProof[] {
    return Array.from(this.proofCache.values());
  }

  getVerifiedProofsCount(): number {
    return Array.from(this.proofCache.values()).filter(p => p.verified).length;
  }

  getProofsCount(): number {
    return this.proofCache.size;
  }

  getReadyCircuitsCount(): number {
    return Array.from(this.circuitStatus.values()).filter(s => s === 'ready').length;
  }

  getTotalCircuitsCount(): number {
    return Object.keys(CIRCUIT_REGISTRY).length;
  }
}

export const zkpService = new ZKPService();
