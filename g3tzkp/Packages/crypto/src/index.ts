// Cryptographic engine exports
export { KeyStore } from './key-store';
export { X3DHProtocol } from './x3dh';
export { DoubleRatchet } from './double-ratchet';
export { encrypt, decrypt, encryptWithAD } from './aead';
export { hkdf } from './kdf';

// Local type definitions
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