/**
 * Double Ratchet Protocol Implementation
 * Full production implementation per Signal Protocol specification
 * 
 * Key insight: The initiator (Alice) can send immediately using X3DH-derived keys,
 * while the responder (Bob) must wait for Alice's first message to complete setup.
 */
import { box } from 'tweetnacl';
import { 
  hkdf, 
  deriveChainAndMessageKeys, 
  deriveRootAndChainKeys,
  constantTimeEqual 
} from './kdf';

export interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export interface MessageKey {
  key: Uint8Array;
  number: number;
  ratchetPublicKey: Uint8Array;
  header: RatchetHeader;
}

export interface RatchetHeader {
  ratchetPublicKey: Uint8Array;
  previousChainLength: number;
  messageNumber: number;
}

interface SkippedKey {
  key: Uint8Array;
  timestamp: number;
}

const MAX_SKIP = 1000;
const MAX_SKIPPED_KEYS = 2000;
const SKIPPED_KEY_TTL = 24 * 60 * 60 * 1000;

export class DoubleRatchet {
  private rootKey: Uint8Array;
  private sendingChainKey: Uint8Array | null = null;
  private receivingChainKey: Uint8Array | null = null;
  private sendingRatchetKey: KeyPair;
  private receivingRatchetKey: Uint8Array | null = null;
  private sendingMessageNumber = 0;
  private receivingMessageNumber = 0;
  private previousSendingChainLength = 0;
  private skippedMessageKeys: Map<string, SkippedKey> = new Map();
  private initialized = false;
  private operationLock: Promise<void> = Promise.resolve();

  /**
   * Private constructor - use static factory methods
   */
  private constructor() {
    this.rootKey = new Uint8Array(32);
    const keyPair = box.keyPair();
    this.sendingRatchetKey = {
      publicKey: new Uint8Array(keyPair.publicKey),
      secretKey: new Uint8Array(keyPair.secretKey)
    };
  }

  /**
   * Create Double Ratchet as initiator (Alice)
   * 
   * Per Signal Protocol:
   * 1. Alice uses SK (X3DH shared secret) as initial root key
   * 2. Alice performs DH with Bob's signed pre-key (from X3DH)
   * 3. Alice derives her initial sending chain key from this DH
   * 4. Alice can immediately send her first message
   * 
   * @param sharedSecret The shared secret from X3DH (SK)
   * @param recipientSignedPreKey Bob's signed pre-key from X3DH bundle
   */
  static async createAsInitiator(
    sharedSecret: Uint8Array,
    recipientSignedPreKey: Uint8Array
  ): Promise<DoubleRatchet> {
    const ratchet = new DoubleRatchet();
    
    ratchet.rootKey = new Uint8Array(sharedSecret);
    ratchet.receivingRatchetKey = new Uint8Array(recipientSignedPreKey);
    
    const dhResult = box.before(recipientSignedPreKey, ratchet.sendingRatchetKey.secretKey);
    const { newRootKey, chainKey } = await deriveRootAndChainKeys(ratchet.rootKey, dhResult);
    
    ratchet.rootKey = newRootKey;
    ratchet.sendingChainKey = chainKey;
    ratchet.initialized = true;
    
    return ratchet;
  }

  /**
   * Create Double Ratchet as responder (Bob)
   * 
   * Per Signal Protocol:
   * 1. Bob uses SK (X3DH shared secret) as initial root key
   * 2. Bob's signed pre-key is his initial ratchet key
   * 3. Bob waits to receive Alice's first message to derive receiving chain
   * 4. Bob cannot send until he receives Alice's first message
   * 
   * @param sharedSecret The shared secret from X3DH (SK)
   * @param ownSignedPreKey Bob's own signed pre-key (used as initial ratchet key)
   */
  static async createAsResponder(
    sharedSecret: Uint8Array,
    ownSignedPreKey: KeyPair
  ): Promise<DoubleRatchet> {
    const ratchet = new DoubleRatchet();
    
    ratchet.rootKey = new Uint8Array(sharedSecret);
    ratchet.sendingRatchetKey = {
      publicKey: new Uint8Array(ownSignedPreKey.publicKey),
      secretKey: new Uint8Array(ownSignedPreKey.secretKey)
    };
    ratchet.initialized = true;
    
    return ratchet;
  }

  /**
   * Legacy constructor for backward compatibility
   */
  static createFromSharedSecret(sharedSecret: Uint8Array): DoubleRatchet {
    const ratchet = new DoubleRatchet();
    ratchet.rootKey = new Uint8Array(sharedSecret);
    ratchet.initialized = true;
    return ratchet;
  }

  /**
   * Initialize receiving chain with peer's ratchet key
   * Call this when receiving the first message from a peer
   */
  async initializeReceiving(peerRatchetKey: Uint8Array): Promise<void> {
    this.receivingRatchetKey = new Uint8Array(peerRatchetKey);
    
    const dhResult = box.before(peerRatchetKey, this.sendingRatchetKey.secretKey);
    const { newRootKey, chainKey } = await deriveRootAndChainKeys(this.rootKey, dhResult);
    
    this.rootKey = newRootKey;
    this.receivingChainKey = chainKey;
  }

  /**
   * Serialize access to ratchet operations
   */
  private async withLock<T>(operation: () => Promise<T>): Promise<T> {
    const currentLock = this.operationLock;
    let resolve: () => void;
    this.operationLock = new Promise<void>(r => { resolve = r; });
    
    await currentLock;
    try {
      return await operation();
    } finally {
      resolve!();
    }
  }

  /**
   * Get encryption key for sending a message
   * Returns both the key and the header to include with the encrypted message
   */
  async ratchetSend(): Promise<MessageKey> {
    return this.withLock(async () => {
      if (!this.initialized) {
        throw new Error('Double Ratchet not initialized');
      }

      if (!this.sendingChainKey) {
        if (!this.receivingRatchetKey) {
          throw new Error('Cannot send: no sending chain and no peer ratchet key. Initialize the session first.');
        }
        await this.performSendingDHRatchet();
      }

      // Capture current state for header BEFORE incrementing
      const header: RatchetHeader = {
        ratchetPublicKey: new Uint8Array(this.sendingRatchetKey.publicKey),
        previousChainLength: this.previousSendingChainLength,
        messageNumber: this.sendingMessageNumber
      };

      // Now increment for next message
      this.sendingMessageNumber++;
      
      const { newChainKey, messageKey } = await deriveChainAndMessageKeys(this.sendingChainKey!);
      this.sendingChainKey = newChainKey;
      
      return {
        key: messageKey,
        number: header.messageNumber,
        ratchetPublicKey: header.ratchetPublicKey,
        header: header
      };
    });
  }

  /**
   * Get decryption key for receiving a message
   */
  async ratchetReceive(header: RatchetHeader): Promise<MessageKey> {
    return this.withLock(async () => {
      if (!this.initialized) {
        throw new Error('Double Ratchet not initialized');
      }

      const skippedKey = this.tryGetSkippedMessageKey(
        header.ratchetPublicKey,
        header.messageNumber
      );
      if (skippedKey) {
        return {
          key: skippedKey,
          number: header.messageNumber,
          ratchetPublicKey: header.ratchetPublicKey,
          header: header
        };
      }

      const needsDHRatchet = !this.receivingRatchetKey || 
          !constantTimeEqual(this.receivingRatchetKey, header.ratchetPublicKey);

      if (needsDHRatchet) {
        if (this.receivingChainKey) {
          await this.skipMessageKeysInternal(header.previousChainLength);
        }
        await this.performReceivingDHRatchet(header.ratchetPublicKey);
      }

      await this.skipMessageKeysInternal(header.messageNumber);

      if (!this.receivingChainKey) {
        throw new Error('No receiving chain key available');
      }
      
      const { newChainKey, messageKey } = await deriveChainAndMessageKeys(this.receivingChainKey);
      this.receivingChainKey = newChainKey;
      this.receivingMessageNumber++;

      return {
        key: messageKey,
        number: header.messageNumber,
        ratchetPublicKey: header.ratchetPublicKey,
        header: header
      };
    });
  }

  private async performSendingDHRatchet(): Promise<void> {
    if (!this.receivingRatchetKey) {
      throw new Error('Cannot perform DH ratchet without peer key');
    }

    const newKeyPair = box.keyPair();
    this.sendingRatchetKey = {
      publicKey: new Uint8Array(newKeyPair.publicKey),
      secretKey: new Uint8Array(newKeyPair.secretKey)
    };

    const dhResult = box.before(this.receivingRatchetKey, this.sendingRatchetKey.secretKey);
    const { newRootKey, chainKey } = await deriveRootAndChainKeys(this.rootKey, dhResult);
    
    this.rootKey = newRootKey;
    this.sendingChainKey = chainKey;
    this.previousSendingChainLength = this.sendingMessageNumber;
    this.sendingMessageNumber = 0;
  }

  /**
   * Perform full DH ratchet step when receiving a new ratchet key
   * Per Signal Protocol, this involves TWO DH operations:
   * 1. DH(our_current_priv, their_new_pub) -> receiving chain
   * 2. Generate new key pair
   * 3. DH(our_new_priv, their_new_pub) -> sending chain
   */
  private async performReceivingDHRatchet(theirRatchetKey: Uint8Array): Promise<void> {
    this.previousSendingChainLength = this.sendingMessageNumber;
    this.sendingMessageNumber = 0;
    this.receivingMessageNumber = 0;

    this.receivingRatchetKey = new Uint8Array(theirRatchetKey);

    // Step 1: Derive receiving chain using current sending key
    const dhResult1 = box.before(theirRatchetKey, this.sendingRatchetKey.secretKey);
    const { newRootKey: rootKey1, chainKey: recvChainKey } = 
      await deriveRootAndChainKeys(this.rootKey, dhResult1);
    
    this.rootKey = rootKey1;
    this.receivingChainKey = recvChainKey;

    // Step 2: Generate new ratchet key pair
    const newKeyPair = box.keyPair();
    this.sendingRatchetKey = {
      publicKey: new Uint8Array(newKeyPair.publicKey),
      secretKey: new Uint8Array(newKeyPair.secretKey)
    };

    // Step 3: Derive sending chain using new key
    const dhResult2 = box.before(theirRatchetKey, this.sendingRatchetKey.secretKey);
    const { newRootKey: rootKey2, chainKey: sendChainKey } = 
      await deriveRootAndChainKeys(this.rootKey, dhResult2);
    
    this.rootKey = rootKey2;
    this.sendingChainKey = sendChainKey;
  }

  private async skipMessageKeysInternal(untilNumber: number): Promise<void> {
    if (!this.receivingChainKey) return;
    
    const toSkip = untilNumber - this.receivingMessageNumber;
    if (toSkip < 0) return;
    if (toSkip > MAX_SKIP) {
      throw new Error(`Cannot skip more than ${MAX_SKIP} messages`);
    }

    while (this.receivingMessageNumber < untilNumber) {
      const { newChainKey, messageKey } = 
        await deriveChainAndMessageKeys(this.receivingChainKey);
      
      this.storeSkippedMessageKey(
        this.receivingRatchetKey!,
        this.receivingMessageNumber,
        messageKey
      );
      
      this.receivingChainKey = newChainKey;
      this.receivingMessageNumber++;
    }
  }

  private storeSkippedMessageKey(
    ratchetKey: Uint8Array,
    messageNumber: number,
    key: Uint8Array
  ): void {
    const id = this.createSkippedKeyId(ratchetKey, messageNumber);
    this.skippedMessageKeys.set(id, {
      key: new Uint8Array(key),
      timestamp: Date.now()
    });
    this.pruneSkippedKeys();
  }

  private tryGetSkippedMessageKey(
    ratchetKey: Uint8Array,
    messageNumber: number
  ): Uint8Array | undefined {
    const id = this.createSkippedKeyId(ratchetKey, messageNumber);
    const skipped = this.skippedMessageKeys.get(id);
    
    if (skipped) {
      this.skippedMessageKeys.delete(id);
      return skipped.key;
    }
    return undefined;
  }

  private createSkippedKeyId(ratchetKey: Uint8Array, messageNumber: number): string {
    const keyHex = Buffer.from(ratchetKey).toString('hex').substring(0, 32);
    return `${keyHex}:${messageNumber}`;
  }

  private pruneSkippedKeys(): void {
    const now = Date.now();
    
    for (const [id, skipped] of this.skippedMessageKeys) {
      if (now - skipped.timestamp > SKIPPED_KEY_TTL) {
        this.skippedMessageKeys.delete(id);
      }
    }

    if (this.skippedMessageKeys.size > MAX_SKIPPED_KEYS) {
      const entries = [...this.skippedMessageKeys.entries()];
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, this.skippedMessageKeys.size - MAX_SKIPPED_KEYS);
      for (const [id] of toRemove) {
        this.skippedMessageKeys.delete(id);
      }
    }
  }

  /**
   * Get current header info for next message
   * NOTE: For actual sending, use the header info returned by ratchetSend()
   * This method returns what the NEXT message header would be
   */
  getHeader(): RatchetHeader {
    return {
      ratchetPublicKey: this.sendingRatchetKey.publicKey,
      previousChainLength: this.previousSendingChainLength,
      messageNumber: this.sendingMessageNumber  // This is the NEXT message number
    };
  }

  /**
   * Build header for a specific message (used internally)
   */
  private buildHeaderForMessage(messageNumber: number): RatchetHeader {
    return {
      ratchetPublicKey: this.sendingRatchetKey.publicKey,
      previousChainLength: this.previousSendingChainLength,
      messageNumber: messageNumber
    };
  }

  getPublicKey(): Uint8Array {
    return this.sendingRatchetKey.publicKey;
  }

  getStats(): {
    messagesSent: number;
    messagesReceived: number;
    skippedKeysStored: number;
    hasReceivingChain: boolean;
    hasSendingChain: boolean;
  } {
    return {
      messagesSent: this.sendingMessageNumber,
      messagesReceived: this.receivingMessageNumber,
      skippedKeysStored: this.skippedMessageKeys.size,
      hasReceivingChain: this.receivingChainKey !== null,
      hasSendingChain: this.sendingChainKey !== null
    };
  }

  exportState(): {
    rootKey: Uint8Array;
    sendingChainKey: Uint8Array | null;
    receivingChainKey: Uint8Array | null;
    sendingRatchetKey: KeyPair;
    receivingRatchetKey: Uint8Array | null;
    sendingMessageNumber: number;
    receivingMessageNumber: number;
    previousSendingChainLength: number;
    skippedMessageKeys: Array<[string, SkippedKey]>;
  } {
    return {
      rootKey: new Uint8Array(this.rootKey),
      sendingChainKey: this.sendingChainKey ? new Uint8Array(this.sendingChainKey) : null,
      receivingChainKey: this.receivingChainKey ? new Uint8Array(this.receivingChainKey) : null,
      sendingRatchetKey: {
        publicKey: new Uint8Array(this.sendingRatchetKey.publicKey),
        secretKey: new Uint8Array(this.sendingRatchetKey.secretKey)
      },
      receivingRatchetKey: this.receivingRatchetKey ? new Uint8Array(this.receivingRatchetKey) : null,
      sendingMessageNumber: this.sendingMessageNumber,
      receivingMessageNumber: this.receivingMessageNumber,
      previousSendingChainLength: this.previousSendingChainLength,
      skippedMessageKeys: [...this.skippedMessageKeys.entries()].map(([id, sk]) => [
        id,
        { key: new Uint8Array(sk.key), timestamp: sk.timestamp }
      ])
    };
  }

  static importState(state: ReturnType<DoubleRatchet['exportState']>): DoubleRatchet {
    const ratchet = Object.create(DoubleRatchet.prototype) as DoubleRatchet;
    ratchet.rootKey = new Uint8Array(state.rootKey);
    ratchet.sendingChainKey = state.sendingChainKey ? new Uint8Array(state.sendingChainKey) : null;
    ratchet.receivingChainKey = state.receivingChainKey ? new Uint8Array(state.receivingChainKey) : null;
    ratchet.sendingRatchetKey = {
      publicKey: new Uint8Array(state.sendingRatchetKey.publicKey),
      secretKey: new Uint8Array(state.sendingRatchetKey.secretKey)
    };
    ratchet.receivingRatchetKey = state.receivingRatchetKey 
      ? new Uint8Array(state.receivingRatchetKey) 
      : null;
    ratchet.sendingMessageNumber = state.sendingMessageNumber;
    ratchet.receivingMessageNumber = state.receivingMessageNumber;
    ratchet.previousSendingChainLength = state.previousSendingChainLength;
    ratchet.skippedMessageKeys = new Map(
      state.skippedMessageKeys.map(([id, sk]) => [id, {
        key: new Uint8Array(sk.key),
        timestamp: sk.timestamp
      }])
    );
    ratchet.operationLock = Promise.resolve();
    ratchet.initialized = true;
    return ratchet;
  }
}
