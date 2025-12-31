import { secretbox, randomBytes } from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';

const NONCE_LENGTH = secretbox.nonceLength;
const KEY_LENGTH = secretbox.keyLength;

export class StorageEncryption {
  private key: Uint8Array;

  constructor(key: Uint8Array) {
    if (key.length !== KEY_LENGTH) {
      throw new Error(`Encryption key must be ${KEY_LENGTH} bytes`);
    }
    this.key = key;
  }

  static generateKey(): Uint8Array {
    return randomBytes(KEY_LENGTH);
  }

  static keyFromPassword(password: string, salt?: Uint8Array): Uint8Array {
    const actualSalt = salt || randomBytes(16);
    const passwordBytes = new TextEncoder().encode(password);
    
    const combined = new Uint8Array(passwordBytes.length + actualSalt.length);
    combined.set(passwordBytes);
    combined.set(actualSalt, passwordBytes.length);
    
    let hash = this.sha256Simple(combined);
    
    for (let i = 0; i < 10000; i++) {
      const toHash = new Uint8Array(hash.length + actualSalt.length);
      toHash.set(hash);
      toHash.set(actualSalt, hash.length);
      hash = this.sha256Simple(toHash);
    }
    
    return hash;
  }

  private static sha256Simple(data: Uint8Array): Uint8Array {
    let h0 = 0x6a09e667;
    let h1 = 0xbb67ae85;
    let h2 = 0x3c6ef372;
    let h3 = 0xa54ff53a;
    let h4 = 0x510e527f;
    let h5 = 0x9b05688c;
    let h6 = 0x1f83d9ab;
    let h7 = 0x5be0cd19;

    const k = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    const padded = this.padMessage(data);
    const blocks = padded.length / 64;

    for (let b = 0; b < blocks; b++) {
      const w = new Uint32Array(64);
      
      for (let i = 0; i < 16; i++) {
        const offset = b * 64 + i * 4;
        w[i] = (padded[offset] << 24) | (padded[offset + 1] << 16) | (padded[offset + 2] << 8) | padded[offset + 3];
      }
      
      for (let i = 16; i < 64; i++) {
        const s0 = this.rightRotate(w[i - 15], 7) ^ this.rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
        const s1 = this.rightRotate(w[i - 2], 17) ^ this.rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }

      let a = h0, bb = h1, c = h2, d = h3, e = h4, f = h5, g = h6, hh = h7;

      for (let i = 0; i < 64; i++) {
        const S1 = this.rightRotate(e, 6) ^ this.rightRotate(e, 11) ^ this.rightRotate(e, 25);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (hh + S1 + ch + k[i] + w[i]) >>> 0;
        const S0 = this.rightRotate(a, 2) ^ this.rightRotate(a, 13) ^ this.rightRotate(a, 22);
        const maj = (a & bb) ^ (a & c) ^ (bb & c);
        const temp2 = (S0 + maj) >>> 0;

        hh = g;
        g = f;
        f = e;
        e = (d + temp1) >>> 0;
        d = c;
        c = bb;
        bb = a;
        a = (temp1 + temp2) >>> 0;
      }

      h0 = (h0 + a) >>> 0;
      h1 = (h1 + bb) >>> 0;
      h2 = (h2 + c) >>> 0;
      h3 = (h3 + d) >>> 0;
      h4 = (h4 + e) >>> 0;
      h5 = (h5 + f) >>> 0;
      h6 = (h6 + g) >>> 0;
      h7 = (h7 + hh) >>> 0;
    }

    const result = new Uint8Array(32);
    const view = new DataView(result.buffer);
    view.setUint32(0, h0, false);
    view.setUint32(4, h1, false);
    view.setUint32(8, h2, false);
    view.setUint32(12, h3, false);
    view.setUint32(16, h4, false);
    view.setUint32(20, h5, false);
    view.setUint32(24, h6, false);
    view.setUint32(28, h7, false);
    return result;
  }

  private static padMessage(data: Uint8Array): Uint8Array {
    const bitLength = data.length * 8;
    const paddingLength = ((56 - (data.length + 1) % 64) + 64) % 64;
    const padded = new Uint8Array(data.length + 1 + paddingLength + 8);
    
    padded.set(data);
    padded[data.length] = 0x80;
    
    const view = new DataView(padded.buffer);
    view.setUint32(padded.length - 4, bitLength >>> 0, false);
    
    return padded;
  }

  private static rightRotate(value: number, bits: number): number {
    return ((value >>> bits) | (value << (32 - bits))) >>> 0;
  }

  encrypt(plaintext: string): string {
    const nonce = randomBytes(NONCE_LENGTH);
    const plaintextBytes = new TextEncoder().encode(plaintext);
    const ciphertext = secretbox(plaintextBytes, nonce, this.key);

    const combined = new Uint8Array(NONCE_LENGTH + ciphertext.length);
    combined.set(nonce);
    combined.set(ciphertext, NONCE_LENGTH);

    return encodeBase64(combined);
  }

  decrypt(encryptedData: string): string {
    const combined = decodeBase64(encryptedData);
    
    if (combined.length < NONCE_LENGTH + secretbox.overheadLength) {
      throw new Error('Invalid encrypted data: too short');
    }

    const nonce = combined.slice(0, NONCE_LENGTH);
    const ciphertext = combined.slice(NONCE_LENGTH);
    const plaintext = secretbox.open(ciphertext, nonce, this.key);

    if (!plaintext) {
      throw new Error('Decryption failed: invalid key or corrupted data');
    }

    return new TextDecoder().decode(plaintext);
  }

  encryptBytes(plaintext: Uint8Array): Uint8Array {
    const nonce = randomBytes(NONCE_LENGTH);
    const ciphertext = secretbox(plaintext, nonce, this.key);

    const combined = new Uint8Array(NONCE_LENGTH + ciphertext.length);
    combined.set(nonce);
    combined.set(ciphertext, NONCE_LENGTH);

    return combined;
  }

  decryptBytes(encryptedData: Uint8Array): Uint8Array {
    if (encryptedData.length < NONCE_LENGTH + secretbox.overheadLength) {
      throw new Error('Invalid encrypted data: too short');
    }

    const nonce = encryptedData.slice(0, NONCE_LENGTH);
    const ciphertext = encryptedData.slice(NONCE_LENGTH);
    const plaintext = secretbox.open(ciphertext, nonce, this.key);

    if (!plaintext) {
      throw new Error('Decryption failed: invalid key or corrupted data');
    }

    return plaintext;
  }

  rotateKey(newKey: Uint8Array): void {
    if (newKey.length !== KEY_LENGTH) {
      throw new Error(`New encryption key must be ${KEY_LENGTH} bytes`);
    }
    this.key = newKey;
  }

  exportKey(): Uint8Array {
    return new Uint8Array(this.key);
  }

  static getKeyLength(): number {
    return KEY_LENGTH;
  }

  static getNonceLength(): number {
    return NONCE_LENGTH;
  }
}

export class EncryptedBackup {
  private encryption: StorageEncryption;

  constructor(key: Uint8Array) {
    this.encryption = new StorageEncryption(key);
  }

  createBackup(data: Record<string, any>): string {
    const jsonData = JSON.stringify(data);
    const compressedData = this.compress(jsonData);
    const encryptedData = this.encryption.encrypt(compressedData);
    
    const backup = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      checksum: this.calculateChecksum(jsonData),
      data: encryptedData
    };

    return JSON.stringify(backup);
  }

  restoreBackup(backupString: string): Record<string, any> {
    const backup = JSON.parse(backupString);

    if (!backup.version || !backup.data) {
      throw new Error('Invalid backup format');
    }

    const decryptedData = this.encryption.decrypt(backup.data);
    const decompressedData = this.decompress(decryptedData);
    const data = JSON.parse(decompressedData);

    if (backup.checksum && this.calculateChecksum(decompressedData) !== backup.checksum) {
      throw new Error('Backup checksum mismatch - data may be corrupted');
    }

    return data;
  }

  private compress(data: string): string {
    return data;
  }

  private decompress(data: string): string {
    return data;
  }

  private calculateChecksum(data: string): string {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}

export class SecureKeyStore {
  private keys: Map<string, { key: Uint8Array; createdAt: Date; expiresAt?: Date }> = new Map();
  private masterKey: Uint8Array;

  constructor(masterKey: Uint8Array) {
    this.masterKey = masterKey;
  }

  storeKey(keyId: string, key: Uint8Array, expiresInMs?: number): void {
    const encryption = new StorageEncryption(this.masterKey);
    const encryptedKey = encryption.encryptBytes(key);

    this.keys.set(keyId, {
      key: encryptedKey,
      createdAt: new Date(),
      expiresAt: expiresInMs ? new Date(Date.now() + expiresInMs) : undefined
    });
  }

  retrieveKey(keyId: string): Uint8Array | null {
    const entry = this.keys.get(keyId);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt && entry.expiresAt < new Date()) {
      this.keys.delete(keyId);
      return null;
    }

    const encryption = new StorageEncryption(this.masterKey);
    return encryption.decryptBytes(entry.key);
  }

  deleteKey(keyId: string): boolean {
    return this.keys.delete(keyId);
  }

  listKeys(): string[] {
    return Array.from(this.keys.keys());
  }

  cleanupExpiredKeys(): number {
    const now = new Date();
    let deleted = 0;

    for (const [keyId, entry] of this.keys.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.keys.delete(keyId);
        deleted++;
      }
    }

    return deleted;
  }

  rotateKey(keyId: string): Uint8Array | null {
    const existingKey = this.retrieveKey(keyId);
    if (!existingKey) {
      return null;
    }

    const newKey = StorageEncryption.generateKey();
    const entry = this.keys.get(keyId);
    if (entry) {
      this.storeKey(keyId, newKey, entry.expiresAt ? entry.expiresAt.getTime() - Date.now() : undefined);
    }

    return newKey;
  }

  exportEncrypted(): string {
    const data: Record<string, any> = {};
    
    for (const [keyId, entry] of this.keys.entries()) {
      data[keyId] = {
        key: encodeBase64(entry.key),
        createdAt: entry.createdAt.toISOString(),
        expiresAt: entry.expiresAt?.toISOString()
      };
    }

    return JSON.stringify(data);
  }

  importEncrypted(jsonData: string): number {
    const data = JSON.parse(jsonData);
    let imported = 0;

    for (const [keyId, entry] of Object.entries(data)) {
      const entryData = entry as any;
      this.keys.set(keyId, {
        key: decodeBase64(entryData.key),
        createdAt: new Date(entryData.createdAt),
        expiresAt: entryData.expiresAt ? new Date(entryData.expiresAt) : undefined
      });
      imported++;
    }

    return imported;
  }
}
