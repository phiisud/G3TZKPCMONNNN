import { g3tzkpService } from './G3TZKPService';
import { zkpService } from './ZKPService';
import * as localforage from 'localforage';

/**
 * Forward Secrecy Service
 * Implements Double Ratchet-like key rotation with ZKP verification
 * Uses forward_secrecy.circom circuit for cryptographic proofs
 */

export interface RatchetState {
  peerId: string;
  rootKey: Uint8Array;
  sendingChainKey: Uint8Array;
  receivingChainKey: Uint8Array;
  sendingChainLength: number;
  receivingChainLength: number;
  previousSendingChainLength: number;
  skippedMessageKeys: Map<number, Uint8Array>;
  lastRotationTime: number;
}

export interface KeyRotationProof {
  proofId: string;
  oldKeyCommitment: string;
  newKeyCommitment: string;
  timestamp: number;
  verified: boolean;
}

class ForwardSecrecyService {
  private static instance: ForwardSecrecyService;
  private ratchetStates = new Map<string, RatchetState>();
  private rotationProofs = new Map<string, KeyRotationProof>();
  private db: LocalForage;
  private readonly ROTATION_INTERVAL = 100; // Rotate every 100 messages
  private readonly MAX_SKIP = 1000; // Maximum number of skipped messages to store

  static getInstance(): ForwardSecrecyService {
    if (!this.instance) {
      this.instance = new ForwardSecrecyService();
    }
    return this.instance;
  }

  constructor() {
    this.db = localforage.createInstance({
      name: 'G3ZKP',
      storeName: 'ForwardSecrecy'
    });
    this.loadRatchetStates();
  }

  private async loadRatchetStates(): Promise<void> {
    try {
      const keys = await this.db.keys();
      for (const key of keys) {
        const state = await this.db.getItem<RatchetState>(key);
        if (state) {
          this.ratchetStates.set(key, state);
        }
      }
      console.log(`[ForwardSecrecy] Loaded ${keys.length} ratchet states`);
    } catch (err) {
      console.error('[ForwardSecrecy] Failed to load ratchet states:', err);
    }
  }

  async initializeRatchet(peerId: string, sharedSecret: Uint8Array): Promise<void> {
    const rootKey = await this.deriveRootKey(sharedSecret);
    const sendingChainKey = await this.deriveChainKey(rootKey, new Uint8Array([0]));
    const receivingChainKey = await this.deriveChainKey(rootKey, new Uint8Array([1]));

    const state: RatchetState = {
      peerId,
      rootKey,
      sendingChainKey,
      receivingChainKey,
      sendingChainLength: 0,
      receivingChainLength: 0,
      previousSendingChainLength: 0,
      skippedMessageKeys: new Map(),
      lastRotationTime: Date.now()
    };

    this.ratchetStates.set(peerId, state);
    await this.saveRatchetState(peerId, state);
    
    console.log(`[ForwardSecrecy] Initialized ratchet for peer: ${peerId}`);
  }

  async rotateKeys(peerId: string): Promise<KeyRotationProof | null> {
    const state = this.ratchetStates.get(peerId);
    if (!state) {
      console.error('[ForwardSecrecy] No ratchet state for peer:', peerId);
      return null;
    }

    try {
      // Generate ZKP proof for key rotation
      const oldKeyCommitment = await this.computeKeyCommitment(state.sendingChainKey);
      
      // Perform DH ratchet step
      const newRootKey = await this.deriveRootKey(state.rootKey);
      const newSendingChainKey = await this.deriveChainKey(newRootKey, new Uint8Array([0]));
      
      const newKeyCommitment = await this.computeKeyCommitment(newSendingChainKey);

      // Generate forward_secrecy ZKP proof
      const proof = await zkpService.generateProof('forward_secrecy', {
        oldKeyCommitment: this.uint8ArrayToFieldElement(state.sendingChainKey),
        newKeyCommitment: this.uint8ArrayToFieldElement(newSendingChainKey),
        rotationNonce: state.sendingChainLength
      });

      // Verify the proof
      const verified = await zkpService.verifyProof(proof.id);

      const rotationProof: KeyRotationProof = {
        proofId: proof.id,
        oldKeyCommitment,
        newKeyCommitment,
        timestamp: Date.now(),
        verified
      };

      if (verified) {
        // Update state with new keys
        state.rootKey = newRootKey;
        state.previousSendingChainLength = state.sendingChainLength;
        state.sendingChainKey = newSendingChainKey;
        state.sendingChainLength = 0;
        state.lastRotationTime = Date.now();

        await this.saveRatchetState(peerId, state);
        this.rotationProofs.set(proof.id, rotationProof);

        console.log(`[ForwardSecrecy] Keys rotated for peer ${peerId}, proof: ${proof.id}`);
      } else {
        console.error('[ForwardSecrecy] Key rotation proof verification failed');
      }

      return rotationProof;
    } catch (err) {
      console.error('[ForwardSecrecy] Key rotation failed:', err);
      return null;
    }
  }

  async deriveMessageKey(peerId: string, isSending: boolean): Promise<Uint8Array | null> {
    const state = this.ratchetStates.get(peerId);
    if (!state) return null;

    const chainKey = isSending ? state.sendingChainKey : state.receivingChainKey;
    const messageKey = await this.deriveChainKey(chainKey, new Uint8Array([2]));

    // Advance the chain
    if (isSending) {
      state.sendingChainKey = await this.deriveChainKey(chainKey, new Uint8Array([3]));
      state.sendingChainLength++;
      
      // Auto-rotate if threshold reached
      if (state.sendingChainLength >= this.ROTATION_INTERVAL) {
        await this.rotateKeys(peerId);
      }
    } else {
      state.receivingChainKey = await this.deriveChainKey(chainKey, new Uint8Array([3]));
      state.receivingChainLength++;
    }

    await this.saveRatchetState(peerId, state);
    return messageKey;
  }

  async trySkippedMessageKeys(peerId: string, messageIndex: number, ciphertext: Uint8Array): Promise<Uint8Array | null> {
    const state = this.ratchetStates.get(peerId);
    if (!state) return null;

    const skippedKey = state.skippedMessageKeys.get(messageIndex);
    if (skippedKey) {
      state.skippedMessageKeys.delete(messageIndex);
      await this.saveRatchetState(peerId, state);
      
      // Decrypt with skipped key
      return await this.decryptWithKey(ciphertext, skippedKey);
    }

    return null;
  }

  async skipMessageKeys(peerId: string, untilIndex: number): Promise<void> {
    const state = this.ratchetStates.get(peerId);
    if (!state) return;

    if (untilIndex - state.receivingChainLength > this.MAX_SKIP) {
      throw new Error('Too many skipped messages');
    }

    while (state.receivingChainLength < untilIndex) {
      const messageKey = await this.deriveChainKey(state.receivingChainKey, new Uint8Array([2]));
      state.skippedMessageKeys.set(state.receivingChainLength, messageKey);
      state.receivingChainKey = await this.deriveChainKey(state.receivingChainKey, new Uint8Array([3]));
      state.receivingChainLength++;
    }

    await this.saveRatchetState(peerId, state);
  }

  private async deriveRootKey(input: Uint8Array): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey(
      'raw',
      input,
      { name: 'HKDF' },
      false,
      ['deriveBits']
    );

    const derived = await crypto.subtle.deriveBits(
      {
        name: 'HKDF',
        hash: 'SHA-256',
        salt: new Uint8Array(32),
        info: new TextEncoder().encode('G3ZKP-RootKey')
      },
      key,
      256
    );

    return new Uint8Array(derived);
  }

  private async deriveChainKey(input: Uint8Array, info: Uint8Array): Promise<Uint8Array> {
    const key = await crypto.subtle.importKey(
      'raw',
      input,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const derived = await crypto.subtle.sign('HMAC', key, info);
    return new Uint8Array(derived);
  }

  private async computeKeyCommitment(key: Uint8Array): Promise<string> {
    const hash = await crypto.subtle.digest('SHA-256', key);
    return Array.from(new Uint8Array(hash))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private uint8ArrayToFieldElement(arr: Uint8Array): string {
    // Convert Uint8Array to field element for ZKP circuit
    // Use first 31 bytes to stay within BN128 field size
    const truncated = arr.slice(0, 31);
    let result = BigInt(0);
    for (let i = 0; i < truncated.length; i++) {
      result = (result << BigInt(8)) + BigInt(truncated[i]);
    }
    return result.toString();
  }

  private async decryptWithKey(ciphertext: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
    // Import key for AES-GCM
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      key,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    // Assume first 12 bytes are IV
    const iv = ciphertext.slice(0, 12);
    const data = ciphertext.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      data
    );

    return new Uint8Array(decrypted);
  }

  private async saveRatchetState(peerId: string, state: RatchetState): Promise<void> {
    try {
      await this.db.setItem(peerId, state);
    } catch (err) {
      console.error('[ForwardSecrecy] Failed to save ratchet state:', err);
    }
  }

  getRatchetState(peerId: string): RatchetState | undefined {
    return this.ratchetStates.get(peerId);
  }

  getRotationProof(proofId: string): KeyRotationProof | undefined {
    return this.rotationProofs.get(proofId);
  }

  async clearRatchetState(peerId: string): Promise<void> {
    this.ratchetStates.delete(peerId);
    await this.db.removeItem(peerId);
  }
}

export const forwardSecrecyService = ForwardSecrecyService.getInstance();
export default forwardSecrecyService;
