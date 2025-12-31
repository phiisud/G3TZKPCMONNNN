const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ALPHABET_SIZE = 32;
const MAX_NAME_LENGTH = 9;

interface NameClaim {
  name: string;
  peerId: string;
  hash: string;
  timestamp: number;
  signature?: string;
}

class NameRegistryService {
  private nameToHash: Map<string, string> = new Map();
  private hashToName: Map<string, string> = new Map();
  private claims: Map<string, NameClaim> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const stored = localStorage.getItem('g3tzkp-name-registry');
    if (stored) {
      try {
        const data = JSON.parse(stored);
        for (const claim of data.claims || []) {
          this.registerClaim(claim);
        }
      } catch (e) {
        console.error('[NameRegistry] Failed to load stored claims:', e);
      }
    }

    this.initialized = true;
    console.log('[NameRegistry] Initialized with', this.claims.size, 'registered names');
  }

  private persist(): void {
    const data = {
      claims: Array.from(this.claims.values())
    };
    localStorage.setItem('g3tzkp-name-registry', JSON.stringify(data));
  }

  nameToHashCode(name: string): string {
    const normalized = this.normalizeName(name);
    if (!this.isValidName(normalized)) {
      throw new Error(`Invalid name: must be 1-${MAX_NAME_LENGTH} alphanumeric characters`);
    }

    const padded = normalized.padEnd(MAX_NAME_LENGTH, 'A');
    
    let value = BigInt(normalized.length);
    
    for (let i = 0; i < MAX_NAME_LENGTH; i++) {
      const charIndex = ALPHABET.indexOf(padded[i]);
      value = value * BigInt(ALPHABET_SIZE) + BigInt(charIndex);
    }

    const chars: string[] = [];
    let remaining = value;
    
    for (let i = 0; i < 10; i++) {
      const idx = Number(remaining % BigInt(ALPHABET_SIZE));
      chars.unshift(ALPHABET[idx]);
      remaining = remaining / BigInt(ALPHABET_SIZE);
    }
    
    return 'G3-' + chars.join('');
  }

  hashToNameCode(hash: string): string | null {
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

    const chars: string[] = [];
    for (let i = 0; i < MAX_NAME_LENGTH; i++) {
      const charIndex = Number(value % BigInt(ALPHABET_SIZE));
      chars.unshift(ALPHABET[charIndex]);
      value = value / BigInt(ALPHABET_SIZE);
    }

    const length = Number(value);
    if (length < 1 || length > MAX_NAME_LENGTH) return null;

    return chars.slice(0, length).join('');
  }

  normalizeName(name: string): string {
    return name.toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  isValidName(name: string): boolean {
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

  sanitizeName(name: string): string {
    let result = this.normalizeName(name);
    result = result.replace(/0/g, '').replace(/1/g, '').replace(/8/g, 'B').replace(/9/g, 'G');
    return result.slice(0, MAX_NAME_LENGTH);
  }

  getAllClaims(): NameClaim[] {
    this.ensureInitialized();
    return Array.from(this.claims.values());
  }

  async registerName(name: string, peerId: string): Promise<NameClaim> {
    await this.initialize();

    const normalized = this.sanitizeName(name);
    if (!this.isValidName(normalized)) {
      throw new Error('Invalid name format');
    }

    const existingClaim = this.claims.get(normalized);
    if (existingClaim && existingClaim.peerId !== peerId) {
      throw new Error('Name already registered by another peer');
    }

    const hash = this.nameToHashCode(normalized);

    const claim: NameClaim = {
      name: normalized,
      peerId,
      hash,
      timestamp: Date.now()
    };

    this.registerClaim(claim);
    this.persist();

    console.log(`[NameRegistry] Registered: ${normalized} -> ${hash}`);
    return claim;
  }

  private registerClaim(claim: NameClaim): void {
    this.claims.set(claim.name, claim);
    this.nameToHash.set(claim.name, claim.hash);
    this.hashToName.set(claim.hash, claim.name);
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      const stored = localStorage.getItem('g3tzkp-name-registry');
      if (stored) {
        try {
          const data = JSON.parse(stored);
          for (const claim of data.claims || []) {
            this.registerClaim(claim);
          }
        } catch (e) {
          console.error('[NameRegistry] Failed to load stored claims:', e);
        }
      }
      this.initialized = true;
      console.log('[NameRegistry] Auto-initialized with', this.claims.size, 'registered names');
    }
  }

  lookupName(name: string): string | null {
    this.ensureInitialized();
    const normalized = this.sanitizeName(name);
    return this.nameToHash.get(normalized) || null;
  }

  lookupHash(hash: string): string | null {
    this.ensureInitialized();
    return this.hashToName.get(hash) || null;
  }

  resolvePeerId(nameOrHash: string): string | null {
    this.ensureInitialized();
    let claim: NameClaim | undefined;
    
    if (nameOrHash.startsWith('G3-')) {
      const name = this.lookupHash(nameOrHash);
      if (name) {
        claim = this.claims.get(name);
      }
    } else {
      const normalized = this.sanitizeName(nameOrHash);
      claim = this.claims.get(normalized);
    }

    return claim?.peerId || null;
  }

  formatUrl(nameOrPeerId: string): string {
    this.ensureInitialized();
    const name = this.lookupHash(nameOrPeerId);
    if (name) {
      return `g3tzkp://${name}`;
    }
    
    if (nameOrPeerId.length <= MAX_NAME_LENGTH && this.isValidName(nameOrPeerId)) {
      return `g3tzkp://${nameOrPeerId.toUpperCase()}`;
    }

    return `g3tzkp://${nameOrPeerId.slice(0, 12)}...`;
  }

  parseUrl(url: string): { name?: string; hash?: string; peerId?: string } | null {
    this.ensureInitialized();
    if (!url.startsWith('g3tzkp://')) {
      return null;
    }

    const path = url.slice('g3tzkp://'.length).split('/')[0];
    
    if (path.startsWith('G3-')) {
      const name = this.lookupHash(path);
      const peerId = this.resolvePeerId(path);
      return { hash: path, name: name || undefined, peerId: peerId || undefined };
    }

    const normalized = this.sanitizeName(path);
    if (this.isValidName(normalized)) {
      const hash = this.lookupName(normalized);
      const peerId = this.resolvePeerId(normalized);
      return { name: normalized, hash: hash || undefined, peerId: peerId || undefined };
    }

    return { peerId: path };
  }

  isNameAvailable(name: string): boolean {
    this.ensureInitialized();
    const normalized = this.sanitizeName(name);
    return !this.claims.has(normalized);
  }

  getDisplayName(peerId: string): string | null {
    this.ensureInitialized();
    for (const claim of this.claims.values()) {
      if (claim.peerId === peerId) {
        return claim.name;
      }
    }
    return null;
  }
}

export const nameRegistryService = new NameRegistryService();
