const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ALPHABET_SIZE = 32;
const MAX_NAME_LENGTH = 9;

export class NameRegistry {
  constructor() {
    this.nameToHash = new Map();
    this.hashToName = new Map();
    this.claims = new Map();
  }

  normalizeName(name) {
    return name.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  sanitizeName(name) {
    let result = this.normalizeName(name);
    result = result.replace(/0/g, '').replace(/1/g, '').replace(/8/g, 'B').replace(/9/g, 'G');
    return result.slice(0, MAX_NAME_LENGTH);
  }

  isValidName(name) {
    const normalized = this.normalizeName(name);
    if (normalized.length < 1 || normalized.length > MAX_NAME_LENGTH) {
      return false;
    }
    for (const char of normalized) {
      if (!ALPHABET.includes(char) && !'0189'.includes(char)) {
        return false;
      }
    }
    return true;
  }

  nameToHashCode(name) {
    const normalized = this.sanitizeName(name);
    if (!this.isValidName(normalized)) {
      throw new Error(`Invalid name: must be 1-${MAX_NAME_LENGTH} alphanumeric characters`);
    }

    const padded = normalized.padEnd(MAX_NAME_LENGTH, 'A');
    
    let value = BigInt(normalized.length);
    
    for (let i = 0; i < MAX_NAME_LENGTH; i++) {
      const charIndex = ALPHABET.indexOf(padded[i]);
      value = value * BigInt(ALPHABET_SIZE) + BigInt(charIndex);
    }

    const chars = [];
    let remaining = value;
    
    for (let i = 0; i < 10; i++) {
      const idx = Number(remaining % BigInt(ALPHABET_SIZE));
      chars.unshift(ALPHABET[idx]);
      remaining = remaining / BigInt(ALPHABET_SIZE);
    }
    
    return 'G3-' + chars.join('');
  }

  hashToNameCode(hash) {
    if (!hash.startsWith('G3-') || hash.length !== 13) {
      return null;
    }

    const encoded = hash.slice(3);
    
    let value = 0n;
    for (let i = 0; i < encoded.length; i++) {
      const charIndex = ALPHABET.indexOf(encoded[i]);
      if (charIndex === -1) return null;
      value = value * BigInt(ALPHABET_SIZE) + BigInt(charIndex);
    }

    const chars = [];
    for (let i = 0; i < MAX_NAME_LENGTH; i++) {
      const charIndex = Number(value % BigInt(ALPHABET_SIZE));
      chars.unshift(ALPHABET[charIndex]);
      value = value / BigInt(ALPHABET_SIZE);
    }

    const length = Number(value);
    if (length < 1 || length > MAX_NAME_LENGTH) return null;

    return chars.slice(0, length).join('');
  }

  registerName(name, peerId) {
    const normalized = this.sanitizeName(name);
    const hash = this.nameToHashCode(normalized);
    
    const claim = {
      name: normalized,
      peerId,
      hash,
      timestamp: Date.now()
    };

    this.claims.set(normalized, claim);
    this.nameToHash.set(normalized, hash);
    this.hashToName.set(hash, normalized);

    return claim;
  }

  lookupName(name) {
    const normalized = this.sanitizeName(name);
    return this.nameToHash.get(normalized) || null;
  }

  lookupHash(hash) {
    return this.hashToName.get(hash) || null;
  }

  formatUrl(name) {
    const normalized = this.sanitizeName(name);
    return `g3tzkp://${normalized}`;
  }
}

export const nameRegistry = new NameRegistry();
