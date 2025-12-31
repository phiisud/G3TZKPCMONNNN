/**
 * X3DH (Extended Triple Diffie-Hellman) Key Agreement Protocol
 * Production implementation following the Signal Protocol specification
 */
import { box, sign } from 'tweetnacl';
import { hkdf, concatUint8Arrays, deriveX3DHSharedSecret } from './kdf';
import { KeyPair, KeyStore } from './key-store';

export interface X3DHBundle {
  identityKey: Uint8Array;
  signedPreKey: Uint8Array;
  signedPreKeySignature: Uint8Array;
  signedPreKeyId?: string;
  oneTimePreKey?: Uint8Array;
  oneTimePreKeyId?: string;
}

export interface X3DHResult {
  sharedSecret: Uint8Array;
  ephemeralKey: Uint8Array;
  usedOneTimePreKey: boolean;
  usedOneTimePreKeyId?: string;
  associatedData: Uint8Array;
}

export interface X3DHSessionInfo {
  initiatorIdentityKey: Uint8Array;
  responderIdentityKey: Uint8Array;
  ephemeralKey: Uint8Array;
  sharedSecret: Uint8Array;
}

const X3DH_INFO = 'G3ZKP-X3DH-v1';

export class X3DHProtocol {
  constructor(private keyStore: KeyStore) {}

  /**
   * Initiate an X3DH handshake with a recipient
   * This is the sender/initiator side of the protocol
   * 
   * @param recipientBundle The recipient's pre-key bundle
   * @returns The shared secret and information needed to complete the handshake
   */
  async initiateHandshake(recipientBundle: X3DHBundle): Promise<X3DHResult> {
    // Verify the signed pre-key signature
    const isValidSignature = this.verifySignedPreKey(
      recipientBundle.signedPreKey,
      recipientBundle.signedPreKeySignature,
      recipientBundle.identityKey
    );
    
    if (!isValidSignature) {
      throw new Error('Invalid signed pre-key signature');
    }

    const identityKeyPair = this.keyStore.getIdentityKeyPair();
    const ephemeralKeyPair = box.keyPair();

    // DH1 = DH(IK_A, SPK_B) - Initiator's identity key with responder's signed pre-key
    const dh1 = box.before(recipientBundle.signedPreKey, identityKeyPair.secretKey);

    // DH2 = DH(EK_A, IK_B) - Initiator's ephemeral key with responder's identity key
    const dh2 = box.before(recipientBundle.identityKey, ephemeralKeyPair.secretKey);

    // DH3 = DH(EK_A, SPK_B) - Initiator's ephemeral key with responder's signed pre-key
    const dh3 = box.before(recipientBundle.signedPreKey, ephemeralKeyPair.secretKey);

    // DH4 = DH(EK_A, OPK_B) - Optional: Initiator's ephemeral with responder's one-time pre-key
    let dh4 = new Uint8Array(0);
    let usedOneTimePreKey = false;
    let usedOneTimePreKeyId: string | undefined;

    if (recipientBundle.oneTimePreKey) {
      dh4 = box.before(recipientBundle.oneTimePreKey, ephemeralKeyPair.secretKey);
      usedOneTimePreKey = true;
      usedOneTimePreKeyId = recipientBundle.oneTimePreKeyId;
    }

    // Combine DH outputs and derive shared secret using HKDF
    const dhOutputs = usedOneTimePreKey 
      ? [dh1, dh2, dh3, dh4]
      : [dh1, dh2, dh3];
    
    const sharedSecret = await deriveX3DHSharedSecret(dhOutputs, X3DH_INFO);

    // Create associated data for AEAD (both identity keys)
    const associatedData = concatUint8Arrays(
      identityKeyPair.publicKey,
      recipientBundle.identityKey
    );

    return {
      sharedSecret,
      ephemeralKey: ephemeralKeyPair.publicKey,
      usedOneTimePreKey,
      usedOneTimePreKeyId,
      associatedData
    };
  }

  /**
   * Respond to an X3DH handshake from a sender
   * This is the receiver/responder side of the protocol
   * 
   * @param senderIdentityKey The sender's identity public key
   * @param senderEphemeralKey The sender's ephemeral public key
   * @param usedOneTimePreKey Whether a one-time pre-key was used
   * @param oneTimePreKeyId The ID of the one-time pre-key used (if any)
   * @returns The shared secret
   */
  async respondToHandshake(
    senderIdentityKey: Uint8Array,
    senderEphemeralKey: Uint8Array,
    usedOneTimePreKey: boolean,
    oneTimePreKeyId?: string
  ): Promise<X3DHResult> {
    const identityKeyPair = this.keyStore.getIdentityKeyPair();
    const signedPreKey = this.keyStore.getSignedPreKey();

    // DH1 = DH(SPK_B, IK_A) - Responder's signed pre-key with initiator's identity key
    const dh1 = box.before(senderIdentityKey, signedPreKey.secretKey);

    // DH2 = DH(IK_B, EK_A) - Responder's identity key with initiator's ephemeral key
    const dh2 = box.before(senderEphemeralKey, identityKeyPair.secretKey);

    // DH3 = DH(SPK_B, EK_A) - Responder's signed pre-key with initiator's ephemeral key
    const dh3 = box.before(senderEphemeralKey, signedPreKey.secretKey);

    // DH4 = DH(OPK_B, EK_A) - Optional: Responder's one-time pre-key with initiator's ephemeral
    let dh4 = new Uint8Array(0);

    if (usedOneTimePreKey && oneTimePreKeyId) {
      const oneTimePreKey = this.keyStore.getOneTimePreKey(oneTimePreKeyId);
      if (!oneTimePreKey) {
        throw new Error('One-time pre-key not found or already consumed');
      }
      dh4 = box.before(senderEphemeralKey, oneTimePreKey.secretKey);
      
      // Delete the one-time pre-key after use (forward secrecy)
      this.keyStore.deleteOneTimePreKey(oneTimePreKeyId);
    }

    // Combine DH outputs and derive shared secret using HKDF
    const dhOutputs = usedOneTimePreKey
      ? [dh1, dh2, dh3, dh4]
      : [dh1, dh2, dh3];
    
    const sharedSecret = await deriveX3DHSharedSecret(dhOutputs, X3DH_INFO);

    // Create associated data (initiator's identity key first, then responder's)
    const associatedData = concatUint8Arrays(
      senderIdentityKey,
      identityKeyPair.publicKey
    );

    return {
      sharedSecret,
      ephemeralKey: senderEphemeralKey,
      usedOneTimePreKey,
      usedOneTimePreKeyId: oneTimePreKeyId,
      associatedData
    };
  }

  /**
   * Create a pre-key bundle for publishing
   * This bundle can be shared with potential contacts
   */
  async createPreKeyBundle(): Promise<X3DHBundle> {
    const identityKey = this.keyStore.getIdentityKey();
    const signedPreKey = this.keyStore.getSignedPreKey();
    const signingKey = this.keyStore.getSigningKeyPair();
    
    // Sign the pre-key with the identity signing key
    const signature = sign.detached(signedPreKey.publicKey, signingKey.secretKey);
    
    // Get an available one-time pre-key
    const oneTimePreKey = this.keyStore.consumeOneTimePreKey();
    
    return {
      identityKey,
      signedPreKey: signedPreKey.publicKey,
      signedPreKeySignature: signature,
      signedPreKeyId: this.keyStore.getSignedPreKeyId(),
      oneTimePreKey: oneTimePreKey?.publicKey,
      oneTimePreKeyId: oneTimePreKey ? this.keyStore.getLastConsumedOneTimePreKeyId() || undefined : undefined
    };
  }

  /**
   * Verify a signed pre-key signature
   */
  private verifySignedPreKey(
    preKey: Uint8Array,
    signature: Uint8Array,
    identityKey: Uint8Array
  ): boolean {
    try {
      return sign.detached.verify(preKey, signature, identityKey);
    } catch {
      return false;
    }
  }

  /**
   * Get key store reference
   */
  getKeyStore(): KeyStore {
    return this.keyStore;
  }
}

export { KeyPair };
