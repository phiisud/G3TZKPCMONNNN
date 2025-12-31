/**
 * Key Store - Secure storage for cryptographic keys
 * Manages identity keys, signed pre-keys, and one-time pre-keys for X3DH
 */
import { box, sign, randomBytes } from 'tweetnacl';
import { createHash } from 'crypto';

export interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export interface IdentityKeys {
  identityKeyPair: KeyPair;
  signingKeyPair: KeyPair;
  keyId: string;
  createdAt: Date;
}

export interface OneTimePreKeyRecord {
  id: string;
  keyPair: KeyPair;
  createdAt: Date;
  used: boolean;
}

export interface SignedPreKeyRecord {
  id: string;
  keyPair: KeyPair;
  signature: Uint8Array;
  createdAt: Date;
  expiresAt: Date;
}

const SIGNED_PREKEY_VALIDITY = 30 * 24 * 60 * 60 * 1000; // 30 days
const MAX_ONE_TIME_PREKEYS = 200;

export class KeyStore {
  private identityKeys: IdentityKeys | null = null;
  private signedPreKey: SignedPreKeyRecord | null = null;
  private oneTimePreKeys: Map<string, OneTimePreKeyRecord> = new Map();
  private lastConsumedOneTimePreKeyId: string | null = null;
  private initialized: boolean = false;

  /**
   * Initialize the key store with fresh keys
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    if (!this.identityKeys) {
      await this.generateIdentityKeys();
    }
    if (!this.signedPreKey || this.isSignedPreKeyExpired()) {
      await this.generateSignedPreKey();
    }
    if (this.oneTimePreKeys.size < 100) {
      await this.generateOneTimePreKeys(100 - this.oneTimePreKeys.size);
    }

    this.initialized = true;
  }

  /**
   * Generate new identity keys (identity key pair + signing key pair)
   */
  async generateIdentityKeys(): Promise<IdentityKeys> {
    const identityKeyPair = box.keyPair();
    const signingKeyPair = sign.keyPair();
    const keyId = this.generateKeyId(identityKeyPair.publicKey);

    this.identityKeys = {
      identityKeyPair: {
        publicKey: new Uint8Array(identityKeyPair.publicKey),
        secretKey: new Uint8Array(identityKeyPair.secretKey)
      },
      signingKeyPair: {
        publicKey: new Uint8Array(signingKeyPair.publicKey),
        secretKey: new Uint8Array(signingKeyPair.secretKey)
      },
      keyId,
      createdAt: new Date()
    };

    return this.identityKeys;
  }

  /**
   * Generate a new signed pre-key
   */
  async generateSignedPreKey(): Promise<SignedPreKeyRecord> {
    if (!this.identityKeys) {
      throw new Error('Identity keys must be generated first');
    }

    const keyPair = box.keyPair();
    const id = this.generateRandomId();
    
    // Sign the pre-key with the signing key
    const signature = sign.detached(
      keyPair.publicKey,
      this.identityKeys.signingKeyPair.secretKey
    );

    const now = new Date();
    this.signedPreKey = {
      id,
      keyPair: {
        publicKey: new Uint8Array(keyPair.publicKey),
        secretKey: new Uint8Array(keyPair.secretKey)
      },
      signature: new Uint8Array(signature),
      createdAt: now,
      expiresAt: new Date(now.getTime() + SIGNED_PREKEY_VALIDITY)
    };

    return this.signedPreKey;
  }

  /**
   * Generate multiple one-time pre-keys
   */
  async generateOneTimePreKeys(count: number): Promise<OneTimePreKeyRecord[]> {
    const newKeys: OneTimePreKeyRecord[] = [];
    
    for (let i = 0; i < count; i++) {
      if (this.oneTimePreKeys.size >= MAX_ONE_TIME_PREKEYS) {
        break;
      }

      const keyPair = box.keyPair();
      const id = this.generateRandomId();
      
      const record: OneTimePreKeyRecord = {
        id,
        keyPair: {
          publicKey: new Uint8Array(keyPair.publicKey),
          secretKey: new Uint8Array(keyPair.secretKey)
        },
        createdAt: new Date(),
        used: false
      };

      this.oneTimePreKeys.set(id, record);
      newKeys.push(record);
    }

    return newKeys;
  }

  /**
   * Get the identity public key
   */
  getIdentityKey(): Uint8Array {
    if (!this.identityKeys) throw new Error('Keys not initialized');
    return this.identityKeys.identityKeyPair.publicKey;
  }

  /**
   * Get the identity key pair
   */
  getIdentityKeyPair(): KeyPair {
    if (!this.identityKeys) throw new Error('Keys not initialized');
    return this.identityKeys.identityKeyPair;
  }

  /**
   * Get the signing key pair (Ed25519)
   */
  getSigningKeyPair(): KeyPair {
    if (!this.identityKeys) throw new Error('Keys not initialized');
    return this.identityKeys.signingKeyPair;
  }

  /**
   * Get the identity key ID
   */
  getKeyId(): string {
    if (!this.identityKeys) throw new Error('Keys not initialized');
    return this.identityKeys.keyId;
  }

  /**
   * Get the signed pre-key
   */
  getSignedPreKey(): KeyPair {
    if (!this.signedPreKey) throw new Error('Signed pre-key not generated');
    return this.signedPreKey.keyPair;
  }

  /**
   * Get the signed pre-key ID
   */
  getSignedPreKeyId(): string {
    if (!this.signedPreKey) throw new Error('Signed pre-key not generated');
    return this.signedPreKey.id;
  }

  /**
   * Get the signed pre-key signature
   */
  getSignedPreKeySignature(): Uint8Array {
    if (!this.signedPreKey) throw new Error('Signed pre-key not generated');
    return this.signedPreKey.signature;
  }

  /**
   * Consume and return the next available one-time pre-key
   */
  consumeOneTimePreKey(): KeyPair | undefined {
    for (const [id, record] of this.oneTimePreKeys) {
      if (!record.used) {
        record.used = true;
        this.lastConsumedOneTimePreKeyId = id;
        return record.keyPair;
      }
    }
    return undefined;
  }

  /**
   * Get the ID of the last consumed one-time pre-key
   */
  getLastConsumedOneTimePreKeyId(): string | null {
    return this.lastConsumedOneTimePreKeyId;
  }

  /**
   * Get a specific one-time pre-key by ID
   */
  getOneTimePreKey(id: string): KeyPair | undefined {
    const record = this.oneTimePreKeys.get(id);
    return record?.keyPair;
  }

  /**
   * Delete a one-time pre-key (after it's been used)
   */
  deleteOneTimePreKey(id: string): boolean {
    return this.oneTimePreKeys.delete(id);
  }

  /**
   * Get count of available (unused) one-time pre-keys
   */
  getAvailableOneTimePreKeyCount(): number {
    let count = 0;
    for (const record of this.oneTimePreKeys.values()) {
      if (!record.used) count++;
    }
    return count;
  }

  /**
   * Check if the signed pre-key is expired
   */
  isSignedPreKeyExpired(): boolean {
    if (!this.signedPreKey) return true;
    return new Date() > this.signedPreKey.expiresAt;
  }

  /**
   * Check if identity keys exist
   */
  hasIdentityKey(): boolean {
    return this.identityKeys !== null;
  }

  /**
   * Export public key bundle for sharing with peers
   */
  exportPublicBundle(): {
    identityKey: Uint8Array;
    signingKey: Uint8Array;
    signedPreKey: Uint8Array;
    signedPreKeySignature: Uint8Array;
    signedPreKeyId: string;
    oneTimePreKeys: Array<{ id: string; publicKey: Uint8Array }>;
  } {
    if (!this.identityKeys || !this.signedPreKey) {
      throw new Error('Keys not initialized');
    }

    const oneTimePreKeys: Array<{ id: string; publicKey: Uint8Array }> = [];
    for (const [id, record] of this.oneTimePreKeys) {
      if (!record.used) {
        oneTimePreKeys.push({ id, publicKey: record.keyPair.publicKey });
      }
    }

    return {
      identityKey: this.identityKeys.identityKeyPair.publicKey,
      signingKey: this.identityKeys.signingKeyPair.publicKey,
      signedPreKey: this.signedPreKey.keyPair.publicKey,
      signedPreKeySignature: this.signedPreKey.signature,
      signedPreKeyId: this.signedPreKey.id,
      oneTimePreKeys
    };
  }

  /**
   * Export state for persistence (SENSITIVE - contains secret keys)
   */
  exportState(): {
    identityKeys: IdentityKeys | null;
    signedPreKey: SignedPreKeyRecord | null;
    oneTimePreKeys: Array<[string, OneTimePreKeyRecord]>;
  } {
    return {
      identityKeys: this.identityKeys,
      signedPreKey: this.signedPreKey,
      oneTimePreKeys: [...this.oneTimePreKeys.entries()]
    };
  }

  /**
   * Import state from persistence
   */
  importState(state: ReturnType<KeyStore['exportState']>): void {
    this.identityKeys = state.identityKeys;
    this.signedPreKey = state.signedPreKey;
    this.oneTimePreKeys = new Map(state.oneTimePreKeys);
    this.initialized = true;
  }

  /**
   * Generate a key ID from a public key
   */
  private generateKeyId(publicKey: Uint8Array): string {
    const hash = createHash('sha256').update(Buffer.from(publicKey)).digest();
    return hash.toString('hex').substring(0, 16);
  }

  /**
   * Generate a random ID
   */
  private generateRandomId(): string {
    const bytes = randomBytes(8);
    return Buffer.from(bytes).toString('hex');
  }

  /**
   * Clear all keys (for logout/reset)
   */
  clear(): void {
    // Securely wipe secret keys
    if (this.identityKeys) {
      this.identityKeys.identityKeyPair.secretKey.fill(0);
      this.identityKeys.signingKeyPair.secretKey.fill(0);
    }
    if (this.signedPreKey) {
      this.signedPreKey.keyPair.secretKey.fill(0);
    }
    for (const record of this.oneTimePreKeys.values()) {
      record.keyPair.secretKey.fill(0);
    }

    this.identityKeys = null;
    this.signedPreKey = null;
    this.oneTimePreKeys.clear();
    this.lastConsumedOneTimePreKeyId = null;
    this.initialized = false;
  }
}
