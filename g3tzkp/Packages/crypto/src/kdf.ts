/**
 * HKDF (HMAC-based Key Derivation Function) - RFC 5869
 * Production implementation using HMAC-SHA256
 */
import { createHmac } from 'crypto';

/**
 * HKDF Extract-and-Expand Key Derivation Function
 * @param ikm Input keying material
 * @param length Desired output length in bytes
 * @param info Context and application-specific information
 * @param hash Hash algorithm (default SHA-256)
 * @param salt Optional salt (defaults to zero-filled buffer of hash length per RFC 5869)
 */
export async function hkdf(
  ikm: Uint8Array,
  length: number,
  info: Uint8Array,
  hash: string = 'SHA-256',
  salt?: Uint8Array
): Promise<Uint8Array> {
  const hashAlgo = hash === 'SHA-256' ? 'sha256' : 'sha512';
  const hashLen = hash === 'SHA-256' ? 32 : 64;
  
  // RFC 5869: If salt is not provided, defaults to a string of HashLen zeros
  const effectiveSalt = salt && salt.length > 0 ? salt : new Uint8Array(hashLen);
  
  // HKDF-Extract: PRK = HMAC-Hash(salt, IKM)
  const prk = hkdfExtract(ikm, effectiveSalt, hashAlgo);
  
  // HKDF-Expand: OKM = T(1) | T(2) | ... | T(N)
  const okm = hkdfExpand(prk, info, length, hashAlgo, hashLen);
  
  return okm;
}

/**
 * HKDF with custom salt
 * @param ikm Input keying material
 * @param salt Salt value
 * @param length Desired output length in bytes
 * @param info Context and application-specific information
 * @param hash Hash algorithm
 */
export async function hkdfWithSalt(
  ikm: Uint8Array,
  salt: Uint8Array,
  length: number,
  info: Uint8Array,
  hash: string = 'SHA-256'
): Promise<Uint8Array> {
  const hashAlgo = hash === 'SHA-256' ? 'sha256' : 'sha512';
  const hashLen = hash === 'SHA-256' ? 32 : 64;
  
  // HKDF-Extract
  const prk = hkdfExtract(ikm, salt, hashAlgo);
  
  // HKDF-Expand
  const okm = hkdfExpand(prk, info, length, hashAlgo, hashLen);
  
  return okm;
}

/**
 * HKDF-Extract: Extract a pseudorandom key from input keying material
 * PRK = HMAC-Hash(salt, IKM)
 */
function hkdfExtract(
  ikm: Uint8Array,
  salt: Uint8Array,
  hashAlgo: string
): Uint8Array {
  const hmac = createHmac(hashAlgo, Buffer.from(salt));
  hmac.update(Buffer.from(ikm));
  return new Uint8Array(hmac.digest());
}

/**
 * HKDF-Expand: Expand a pseudorandom key to desired length
 * T(0) = empty string
 * T(i) = HMAC-Hash(PRK, T(i-1) | info | i) for i = 1, 2, ...
 * OKM = first L octets of T(1) | T(2) | ... | T(N)
 */
function hkdfExpand(
  prk: Uint8Array,
  info: Uint8Array,
  length: number,
  hashAlgo: string,
  hashLen: number
): Uint8Array {
  const n = Math.ceil(length / hashLen);
  
  if (n > 255) {
    throw new Error('HKDF: Cannot derive more than 255 * HashLen bytes');
  }
  
  const okm = new Uint8Array(n * hashLen);
  let prev = new Uint8Array(0);
  
  for (let i = 0; i < n; i++) {
    const hmac = createHmac(hashAlgo, Buffer.from(prk));
    
    // T(i) = HMAC-Hash(PRK, T(i-1) | info | i+1)
    if (prev.length > 0) {
      hmac.update(Buffer.from(prev));
    }
    hmac.update(Buffer.from(info));
    hmac.update(Buffer.from([i + 1]));
    
    prev = new Uint8Array(hmac.digest());
    okm.set(prev, i * hashLen);
  }
  
  return okm.slice(0, length);
}

/**
 * Key Derivation for Double Ratchet symmetric keys
 * Derives a new chain key and message key from the current chain key
 */
export async function deriveChainAndMessageKeys(
  chainKey: Uint8Array
): Promise<{ newChainKey: Uint8Array; messageKey: Uint8Array }> {
  // Chain key constant for deriving new chain key
  const chainKeyConstant = new Uint8Array([0x02]);
  // Message key constant for deriving message key
  const messageKeyConstant = new Uint8Array([0x01]);
  
  // New chain key = HMAC(chain_key, 0x02)
  const newChainKey = new Uint8Array(
    createHmac('sha256', Buffer.from(chainKey))
      .update(Buffer.from(chainKeyConstant))
      .digest()
  );
  
  // Message key = HMAC(chain_key, 0x01)
  const messageKey = new Uint8Array(
    createHmac('sha256', Buffer.from(chainKey))
      .update(Buffer.from(messageKeyConstant))
      .digest()
  );
  
  return { newChainKey, messageKey };
}

/**
 * Key Derivation for Double Ratchet root key update
 * Derives new root key and chain key from shared secret
 * 
 * Per Signal Protocol: Uses root key as salt for domain separation
 * This ensures each ratchet step produces cryptographically independent keys
 */
export async function deriveRootAndChainKeys(
  rootKey: Uint8Array,
  dhOutput: Uint8Array
): Promise<{ newRootKey: Uint8Array; chainKey: Uint8Array }> {
  const info = new TextEncoder().encode('g3zkp-ratchet');
  
  // Per Signal Protocol: use root key as SALT and DH output as IKM
  // This provides domain separation between ratchet steps
  const derived = await hkdf(dhOutput, 64, info, 'SHA-256', rootKey);
  
  return {
    newRootKey: derived.slice(0, 32),
    chainKey: derived.slice(32, 64)
  };
}

/**
 * Derive shared secret for X3DH protocol
 * 
 * Per Signal X3DH specification:
 * - Salt: 32 bytes of 0xFF (per Signal X3DH spec for key separation)
 * - IKM: Concatenated DH outputs (DH1 || DH2 || DH3 [|| DH4])
 * - Info: Application-specific context string
 */
export async function deriveX3DHSharedSecret(
  dhOutputs: Uint8Array[],
  info: string = 'G3ZKP-X3DH-v1'
): Promise<Uint8Array> {
  // Concatenate all DH outputs
  const totalLength = dhOutputs.reduce((sum, arr) => sum + arr.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const dh of dhOutputs) {
    combined.set(dh, offset);
    offset += dh.length;
  }
  
  // Per Signal X3DH: use 32 bytes of 0xFF as salt for domain separation
  // This distinguishes X3DH key derivation from other HKDF uses
  const x3dhSalt = new Uint8Array(32).fill(0xFF);
  
  // Derive 32-byte shared secret with proper salt
  return await hkdf(
    combined,
    32,
    new TextEncoder().encode(info),
    'SHA-256',
    x3dhSalt
  );
}

/**
 * Utility function to concatenate multiple Uint8Arrays
 */
export function concatUint8Arrays(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/**
 * Constant-time comparison of two byte arrays
 */
export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}
