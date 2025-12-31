const G3TZKP_KEY_PREFIX = 'g3tzkp_identity_';

export interface G3TZKPIdentity {
  peerId: string;
  publicKey: JsonWebKey;
  privateKey: JsonWebKey;
  created: number;
}

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  ephemeralPublicKey: JsonWebKey;
}

export interface SignedMessage {
  data: string;
  signature: string;
}

class G3TZKPCryptoService {
  private identity: G3TZKPIdentity | null = null;
  private keyPair: CryptoKeyPair | null = null;
  private signingKeyPair: CryptoKeyPair | null = null;

  async initialize(): Promise<string> {
    const stored = localStorage.getItem(G3TZKP_KEY_PREFIX + 'main');
    
    if (stored) {
      try {
        this.identity = JSON.parse(stored);
        await this.importKeys();
        console.log('[G3TZKPCrypto] Loaded existing identity:', this.identity!.peerId);
        return this.identity!.peerId;
      } catch (e) {
        console.warn('[G3TZKPCrypto] Failed to load identity, generating new one');
      }
    }

    return this.generateIdentity();
  }

  private async generateIdentity(): Promise<string> {
    this.keyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDH',
        namedCurve: 'P-384'
      },
      true,
      ['deriveBits']
    );

    this.signingKeyPair = await crypto.subtle.generateKey(
      {
        name: 'ECDSA',
        namedCurve: 'P-384'
      },
      true,
      ['sign', 'verify']
    );

    const publicKeyExport = await crypto.subtle.exportKey('jwk', this.keyPair.publicKey);
    const privateKeyExport = await crypto.subtle.exportKey('jwk', this.keyPair.privateKey);

    const publicKeyBytes = new TextEncoder().encode(JSON.stringify(publicKeyExport));
    const hashBuffer = await crypto.subtle.digest('SHA-256', publicKeyBytes);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const peerId = 'G3-' + this.toBase58(hashArray).substring(0, 40);

    this.identity = {
      peerId,
      publicKey: publicKeyExport,
      privateKey: privateKeyExport,
      created: Date.now()
    };

    localStorage.setItem(G3TZKP_KEY_PREFIX + 'main', JSON.stringify(this.identity));
    console.log('[G3TZKPCrypto] Generated new identity:', peerId);

    return peerId;
  }

  private async importKeys(): Promise<void> {
    if (!this.identity) throw new Error('No identity to import');

    this.keyPair = {
      publicKey: await crypto.subtle.importKey(
        'jwk',
        this.identity.publicKey,
        { name: 'ECDH', namedCurve: 'P-384' },
        true,
        []
      ),
      privateKey: await crypto.subtle.importKey(
        'jwk',
        this.identity.privateKey,
        { name: 'ECDH', namedCurve: 'P-384' },
        true,
        ['deriveBits']
      )
    };
  }

  getPeerId(): string {
    return this.identity?.peerId || '';
  }

  getPublicKey(): JsonWebKey | null {
    return this.identity?.publicKey || null;
  }

  async encryptForPeer(peerPublicKey: JsonWebKey, plaintext: string): Promise<EncryptedPayload> {
    const ephemeralKeyPair = await crypto.subtle.generateKey(
      { name: 'ECDH', namedCurve: 'P-384' },
      true,
      ['deriveBits']
    );

    const peerKey = await crypto.subtle.importKey(
      'jwk',
      peerPublicKey,
      { name: 'ECDH', namedCurve: 'P-384' },
      false,
      []
    );

    const sharedBits = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: peerKey },
      ephemeralKeyPair.privateKey,
      256
    );

    const aesKey = await crypto.subtle.importKey(
      'raw',
      sharedBits,
      { name: 'AES-GCM' },
      false,
      ['encrypt']
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintextBytes = new TextEncoder().encode(plaintext);

    const ciphertextBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      plaintextBytes
    );

    const ephemeralPublicKey = await crypto.subtle.exportKey('jwk', ephemeralKeyPair.publicKey);

    return {
      ciphertext: this.arrayBufferToBase64(ciphertextBuffer),
      iv: this.arrayBufferToBase64(iv),
      ephemeralPublicKey
    };
  }

  async decryptFromPeer(payload: EncryptedPayload): Promise<string> {
    if (!this.keyPair) throw new Error('No keypair available');

    const ephemeralKey = await crypto.subtle.importKey(
      'jwk',
      payload.ephemeralPublicKey,
      { name: 'ECDH', namedCurve: 'P-384' },
      false,
      []
    );

    const sharedBits = await crypto.subtle.deriveBits(
      { name: 'ECDH', public: ephemeralKey },
      this.keyPair.privateKey,
      256
    );

    const aesKey = await crypto.subtle.importKey(
      'raw',
      sharedBits,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );

    const iv = this.base64ToArrayBuffer(payload.iv);
    const ciphertext = this.base64ToArrayBuffer(payload.ciphertext);

    const plaintextBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(iv) },
      aesKey,
      ciphertext
    );

    return new TextDecoder().decode(plaintextBuffer);
  }

  async sign(data: string): Promise<string> {
    if (!this.signingKeyPair) {
      this.signingKeyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-384' },
        true,
        ['sign', 'verify']
      );
    }

    const dataBytes = new TextEncoder().encode(data);
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-384' },
      this.signingKeyPair.privateKey,
      dataBytes
    );

    return this.arrayBufferToBase64(signature);
  }

  private toBase58(bytes: number[]): string {
    const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let result = '';
    let num = BigInt('0x' + bytes.map(b => b.toString(16).padStart(2, '0')).join(''));
    
    while (num > 0) {
      result = ALPHABET[Number(num % 58n)] + result;
      num = num / 58n;
    }

    for (const byte of bytes) {
      if (byte === 0) result = '1' + result;
      else break;
    }

    return result;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

export const g3tzkpCrypto = new G3TZKPCryptoService();
