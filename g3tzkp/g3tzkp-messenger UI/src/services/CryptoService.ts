import nacl from 'tweetnacl';
import naclUtil from 'tweetnacl-util';

export interface KeyPair {
  publicKey: Uint8Array;
  secretKey: Uint8Array;
}

export interface EncryptedData {
  ciphertext: string;
  nonce: string;
  ephemeralPublicKey: string;
  messageNumber: number;
  previousChainLength: number;
  ratchetPublicKey: string;
}

export interface KeyBundle {
  identityKey: string;
  signedPreKey: string;
  signedPreKeyId: number;
  signature: string;
  oneTimePreKeys: { id: number; key: string }[];
  timestamp: number;
}

export interface DoubleRatchetSession {
  rootKey: Uint8Array;
  sendingChainKey: Uint8Array;
  receivingChainKey: Uint8Array | null;
  sendingRatchetKey: KeyPair;
  receivingRatchetKey: Uint8Array | null;
  sendMessageNumber: number;
  receiveMessageNumber: number;
  previousChainLength: number;
  peerId: string;
  createdAt: number;
  lastUsed: number;
}

export interface SessionInfo {
  sessionId: string;
  peerId: string;
  rootKey: string;
  chainKey: string;
  messageCount: number;
  createdAt: number;
  lastUsed: number;
  isActive: boolean;
}

function hmacSha512(key: Uint8Array, data: Uint8Array): Uint8Array {
  const blockSize = 128;
  let keyPadded = key;
  
  if (key.length > blockSize) {
    keyPadded = nacl.hash(key);
  }
  if (keyPadded.length < blockSize) {
    const padded = new Uint8Array(blockSize);
    padded.set(keyPadded);
    keyPadded = padded;
  }
  
  const ipad = new Uint8Array(blockSize);
  const opad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    ipad[i] = keyPadded[i] ^ 0x36;
    opad[i] = keyPadded[i] ^ 0x5c;
  }
  
  const innerData = new Uint8Array(ipad.length + data.length);
  innerData.set(ipad);
  innerData.set(data, ipad.length);
  const innerHash = nacl.hash(innerData);
  
  const outerData = new Uint8Array(opad.length + innerHash.length);
  outerData.set(opad);
  outerData.set(innerHash, opad.length);
  
  return nacl.hash(outerData);
}

function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Uint8Array {
  const saltKey = salt.length > 0 ? salt : new Uint8Array(64);
  return hmacSha512(saltKey, ikm).slice(0, 32);
}

function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Uint8Array {
  const result = new Uint8Array(length);
  let t = new Uint8Array(0);
  let offset = 0;
  let counter = 1;
  
  while (offset < length) {
    const data = new Uint8Array(t.length + info.length + 1);
    data.set(t);
    data.set(info, t.length);
    data[t.length + info.length] = counter;
    
    const block = hmacSha512(prk, data).slice(0, 32);
    const toCopy = Math.min(32, length - offset);
    result.set(block.slice(0, toCopy), offset);
    t = block;
    offset += toCopy;
    counter++;
  }
  
  return result;
}

function deriveRootAndChainKeys(rootKey: Uint8Array, dhOutput: Uint8Array): { newRootKey: Uint8Array; chainKey: Uint8Array } {
  const prk = hkdfExtract(rootKey, dhOutput);
  const okm = hkdfExpand(prk, naclUtil.decodeUTF8('G3ZKP_RATCHET'), 64);
  return {
    newRootKey: okm.slice(0, 32),
    chainKey: okm.slice(32, 64)
  };
}

function deriveMessageKey(chainKey: Uint8Array): { messageKey: Uint8Array; newChainKey: Uint8Array } {
  const messageKeyInfo = naclUtil.decodeUTF8('G3ZKP_MSG');
  const chainKeyInfo = naclUtil.decodeUTF8('G3ZKP_CHAIN');
  
  const messageKey = nacl.hash(new Uint8Array([...chainKey, ...messageKeyInfo])).slice(0, 32);
  const newChainKey = nacl.hash(new Uint8Array([...chainKey, ...chainKeyInfo])).slice(0, 32);
  
  return { messageKey, newChainKey };
}

export class CryptoService {
  private identityKeyPair: KeyPair | null = null;
  private signedPreKeyPair: KeyPair | null = null;
  private signedPreKeyId: number = 0;
  private signingKeyPair: nacl.SignKeyPair | null = null;
  private oneTimePreKeys: { id: number; keyPair: KeyPair }[] = [];
  private sessions: Map<string, DoubleRatchetSession> = new Map();
  private peerBundles: Map<string, KeyBundle> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    this.identityKeyPair = nacl.box.keyPair();
    this.signedPreKeyPair = nacl.box.keyPair();
    this.signedPreKeyId = Date.now();
    this.signingKeyPair = nacl.sign.keyPair();
    this.oneTimePreKeys = Array.from({ length: 10 }, (_, i) => ({
      id: Date.now() + i,
      keyPair: nacl.box.keyPair()
    }));
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getPublicKey(): string {
    if (!this.identityKeyPair) throw new Error('CryptoService not initialized');
    return naclUtil.encodeBase64(this.identityKeyPair.publicKey);
  }

  getKeyBundle(): KeyBundle {
    if (!this.identityKeyPair || !this.signedPreKeyPair || !this.signingKeyPair) {
      throw new Error('CryptoService not initialized');
    }
    
    const signedPreKeyPublic = naclUtil.encodeBase64(this.signedPreKeyPair.publicKey);
    const messageToSign = naclUtil.decodeUTF8(signedPreKeyPublic);
    const signature = nacl.sign.detached(messageToSign, this.signingKeyPair.secretKey);

    return {
      identityKey: naclUtil.encodeBase64(this.identityKeyPair.publicKey),
      signedPreKey: signedPreKeyPublic,
      signedPreKeyId: this.signedPreKeyId,
      signature: naclUtil.encodeBase64(signature),
      oneTimePreKeys: this.oneTimePreKeys.map(otpk => ({
        id: otpk.id,
        key: naclUtil.encodeBase64(otpk.keyPair.publicKey)
      })),
      timestamp: Date.now()
    };
  }

  establishSession(peerId: string, peerBundle: KeyBundle): SessionInfo {
    if (!this.identityKeyPair || !this.signedPreKeyPair) {
      throw new Error('CryptoService not initialized');
    }

    this.peerBundles.set(peerId, peerBundle);
    
    const peerIdentityKey = naclUtil.decodeBase64(peerBundle.identityKey);
    const peerSignedPreKey = naclUtil.decodeBase64(peerBundle.signedPreKey);
    
    const ephemeralKeyPair = nacl.box.keyPair();
    
    const dh1 = nacl.box.before(peerSignedPreKey, this.identityKeyPair.secretKey);
    const dh2 = nacl.box.before(peerIdentityKey, ephemeralKeyPair.secretKey);
    const dh3 = nacl.box.before(peerSignedPreKey, ephemeralKeyPair.secretKey);
    
    let dh4: Uint8Array | null = null;
    if (peerBundle.oneTimePreKeys.length > 0) {
      const otpk = naclUtil.decodeBase64(peerBundle.oneTimePreKeys[0].key);
      dh4 = nacl.box.before(otpk, ephemeralKeyPair.secretKey);
    }
    
    const dhCombined = dh4 
      ? new Uint8Array([...dh1, ...dh2, ...dh3, ...dh4])
      : new Uint8Array([...dh1, ...dh2, ...dh3]);
    
    const salt = new Uint8Array(32).fill(0xFF);
    const sharedSecret = hkdfExtract(salt, dhCombined);
    
    const { newRootKey, chainKey } = deriveRootAndChainKeys(sharedSecret, nacl.box.before(peerSignedPreKey, ephemeralKeyPair.secretKey));
    
    const { newRootKey: recvRootKey, chainKey: receivingChain } = deriveRootAndChainKeys(
      newRootKey, 
      nacl.box.before(peerIdentityKey, ephemeralKeyPair.secretKey)
    );
    
    const session: DoubleRatchetSession = {
      rootKey: recvRootKey,
      sendingChainKey: chainKey,
      receivingChainKey: receivingChain,
      sendingRatchetKey: ephemeralKeyPair,
      receivingRatchetKey: peerSignedPreKey,
      sendMessageNumber: 0,
      receiveMessageNumber: 0,
      previousChainLength: 0,
      peerId,
      createdAt: Date.now(),
      lastUsed: Date.now()
    };
    
    this.sessions.set(peerId, session);
    
    return this.getSessionInfo(peerId)!;
  }

  getSessionInfo(peerId: string): SessionInfo | undefined {
    const session = this.sessions.get(peerId);
    if (!session) return undefined;
    
    return {
      sessionId: `session_${peerId}_${session.createdAt}`,
      peerId: session.peerId,
      rootKey: naclUtil.encodeBase64(session.rootKey),
      chainKey: naclUtil.encodeBase64(session.sendingChainKey),
      messageCount: session.sendMessageNumber,
      createdAt: session.createdAt,
      lastUsed: session.lastUsed,
      isActive: true
    };
  }

  encrypt(peerId: string, plaintext: string): EncryptedData {
    if (!this.identityKeyPair) throw new Error('CryptoService not initialized');
    
    const session = this.sessions.get(peerId);
    
    if (session) {
      return this.doubleRatchetEncrypt(session, plaintext);
    }
    
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const messageUint8 = naclUtil.decodeUTF8(plaintext);
    const peerBundle = this.peerBundles.get(peerId);
    
    if (peerBundle) {
      const peerKey = naclUtil.decodeBase64(peerBundle.identityKey);
      const ciphertext = nacl.box(messageUint8, nonce, peerKey, this.identityKeyPair.secretKey);
      
      return {
        ciphertext: naclUtil.encodeBase64(ciphertext),
        nonce: naclUtil.encodeBase64(nonce),
        ephemeralPublicKey: naclUtil.encodeBase64(this.identityKeyPair.publicKey),
        messageNumber: 0,
        previousChainLength: 0,
        ratchetPublicKey: naclUtil.encodeBase64(this.identityKeyPair.publicKey)
      };
    }
    
    const ciphertext = nacl.secretbox(messageUint8, nonce, nacl.hash(this.identityKeyPair.secretKey).slice(0, 32));
    
    return {
      ciphertext: naclUtil.encodeBase64(ciphertext),
      nonce: naclUtil.encodeBase64(nonce),
      ephemeralPublicKey: naclUtil.encodeBase64(this.identityKeyPair.publicKey),
      messageNumber: 0,
      previousChainLength: 0,
      ratchetPublicKey: naclUtil.encodeBase64(this.identityKeyPair.publicKey)
    };
  }

  private doubleRatchetEncrypt(session: DoubleRatchetSession, plaintext: string): EncryptedData {
    const messageNumber = session.sendMessageNumber;
    session.sendMessageNumber++;
    
    const { messageKey, newChainKey } = deriveMessageKey(session.sendingChainKey);
    session.sendingChainKey = newChainKey;
    session.lastUsed = Date.now();
    
    const nonce = nacl.randomBytes(nacl.box.nonceLength);
    const messageUint8 = naclUtil.decodeUTF8(plaintext);
    const ciphertext = nacl.secretbox(messageUint8, nonce, messageKey);
    
    return {
      ciphertext: naclUtil.encodeBase64(ciphertext),
      nonce: naclUtil.encodeBase64(nonce),
      ephemeralPublicKey: naclUtil.encodeBase64(session.sendingRatchetKey.publicKey),
      messageNumber,
      previousChainLength: session.previousChainLength,
      ratchetPublicKey: naclUtil.encodeBase64(session.sendingRatchetKey.publicKey)
    };
  }

  decrypt(peerId: string, encrypted: EncryptedData): string {
    if (!this.identityKeyPair) throw new Error('CryptoService not initialized');
    
    const session = this.sessions.get(peerId);
    const ciphertext = naclUtil.decodeBase64(encrypted.ciphertext);
    const nonce = naclUtil.decodeBase64(encrypted.nonce);
    
    if (session && session.receivingChainKey) {
      const ratchetKey = naclUtil.decodeBase64(encrypted.ratchetPublicKey);
      
      if (!this.keysEqual(ratchetKey, session.receivingRatchetKey!)) {
        this.performDHRatchet(session, ratchetKey);
      }
      
      const { messageKey, newChainKey } = deriveMessageKey(session.receivingChainKey);
      session.receivingChainKey = newChainKey;
      session.receiveMessageNumber++;
      session.lastUsed = Date.now();
      
      const decrypted = nacl.secretbox.open(ciphertext, nonce, messageKey);
      if (decrypted) {
        return naclUtil.encodeUTF8(decrypted);
      }
    }
    
    const senderKey = naclUtil.decodeBase64(encrypted.ephemeralPublicKey);
    let decrypted = nacl.box.open(ciphertext, nonce, senderKey, this.identityKeyPair.secretKey);
    
    if (!decrypted) {
      decrypted = nacl.secretbox.open(ciphertext, nonce, nacl.hash(this.identityKeyPair.secretKey).slice(0, 32));
    }
    
    if (!decrypted) throw new Error('Decryption failed');
    return naclUtil.encodeUTF8(decrypted);
  }

  private performDHRatchet(session: DoubleRatchetSession, newRatchetKey: Uint8Array): void {
    session.previousChainLength = session.sendMessageNumber;
    session.sendMessageNumber = 0;
    session.receiveMessageNumber = 0;
    session.receivingRatchetKey = newRatchetKey;
    
    const dhOutput = nacl.box.before(newRatchetKey, session.sendingRatchetKey.secretKey);
    const { newRootKey, chainKey } = deriveRootAndChainKeys(session.rootKey, dhOutput);
    session.rootKey = newRootKey;
    session.receivingChainKey = chainKey;
    
    session.sendingRatchetKey = nacl.box.keyPair();
    
    const dhOutput2 = nacl.box.before(newRatchetKey, session.sendingRatchetKey.secretKey);
    const derived = deriveRootAndChainKeys(session.rootKey, dhOutput2);
    session.rootKey = derived.newRootKey;
    session.sendingChainKey = derived.chainKey;
  }

  private keysEqual(a: Uint8Array, b: Uint8Array | null): boolean {
    if (!b || a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i];
    }
    return result === 0;
  }

  generateMessageHash(content: string): string {
    const messageBytes = naclUtil.decodeUTF8(content);
    const hash = nacl.hash(messageBytes);
    return naclUtil.encodeBase64(hash).substring(0, 32);
  }

  rotateSessionKey(peerId: string): void {
    const session = this.sessions.get(peerId);
    if (!session) return;
    
    const newRatchetKey = nacl.box.keyPair();
    session.previousChainLength = session.sendMessageNumber;
    session.sendMessageNumber = 0;
    
    if (session.receivingRatchetKey) {
      const dhOutput = nacl.box.before(session.receivingRatchetKey, newRatchetKey.secretKey);
      const { newRootKey, chainKey } = deriveRootAndChainKeys(session.rootKey, dhOutput);
      session.rootKey = newRootKey;
      session.sendingChainKey = chainKey;
    }
    
    session.sendingRatchetKey = newRatchetKey;
    session.lastUsed = Date.now();
  }

  hasSession(peerId: string): boolean {
    return this.sessions.has(peerId);
  }

  getAllSessions(): SessionInfo[] {
    return Array.from(this.sessions.keys())
      .map(peerId => this.getSessionInfo(peerId))
      .filter((s): s is SessionInfo => s !== undefined);
  }

  terminateSession(peerId: string): void {
    const session = this.sessions.get(peerId);
    if (session) {
      session.rootKey.fill(0);
      session.sendingChainKey.fill(0);
      if (session.receivingChainKey) session.receivingChainKey.fill(0);
      session.sendingRatchetKey.secretKey.fill(0);
    }
    this.sessions.delete(peerId);
    this.peerBundles.delete(peerId);
  }
}

export const cryptoService = new CryptoService();
