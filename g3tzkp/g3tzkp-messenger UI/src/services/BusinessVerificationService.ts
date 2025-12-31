import nacl from 'tweetnacl';
import { encodeBase64, decodeBase64 } from 'tweetnacl-util';
import type {
  G3TZKPBusinessProfile,
  BusinessVerificationRequest,
  BusinessVerificationResult,
  CompanyHouseResponse,
  BusinessValidationResult,
  BusinessNetworkMessage
} from '../types/business';

const BASE32_CHARS = '0123456789bcdefghjkmnpqrstuvwxyz';
const DB_NAME = 'g3tzkp_business_db';
const DB_VERSION = 1;
const BUSINESSES_STORE = 'businesses';
const KEYS_STORE = 'keys';

class IndexedDBStorage {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.db) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(BUSINESSES_STORE)) {
          const businessStore = db.createObjectStore(BUSINESSES_STORE, { keyPath: 'id' });
          businessStore.createIndex('by_crn', 'crn', { unique: true });
          businessStore.createIndex('by_geohash', 'location.geohash', { unique: false });
          businessStore.createIndex('by_category', 'category', { unique: false });
          businessStore.createIndex('by_peerId', 'peerId', { unique: false });
        }

        if (!db.objectStoreNames.contains(KEYS_STORE)) {
          db.createObjectStore(KEYS_STORE, { keyPath: 'id' });
        }
      };
    });

    return this.initPromise;
  }

  async getKeys(): Promise<{ publicKey: string; secretKey: string; peerId: string } | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(KEYS_STORE, 'readonly');
      const store = tx.objectStore(KEYS_STORE);
      const request = store.get('operator_keys');
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async saveKeys(keys: { publicKey: string; secretKey: string; peerId: string }): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(KEYS_STORE, 'readwrite');
      const store = tx.objectStore(KEYS_STORE);
      const request = store.put({ id: 'operator_keys', ...keys });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getAllBusinesses(): Promise<G3TZKPBusinessProfile[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(BUSINESSES_STORE, 'readonly');
      const store = tx.objectStore(BUSINESSES_STORE);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async saveBusiness(profile: G3TZKPBusinessProfile): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(BUSINESSES_STORE, 'readwrite');
      const store = tx.objectStore(BUSINESSES_STORE);
      const request = store.put(profile);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteBusiness(id: string): Promise<void> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(BUSINESSES_STORE, 'readwrite');
      const store = tx.objectStore(BUSINESSES_STORE);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getBusinessByCRN(crn: string): Promise<G3TZKPBusinessProfile | null> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(BUSINESSES_STORE, 'readonly');
      const store = tx.objectStore(BUSINESSES_STORE);
      const index = store.index('by_crn');
      const request = index.get(crn);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getBusinessesByPeerId(peerId: string): Promise<G3TZKPBusinessProfile[]> {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(BUSINESSES_STORE, 'readonly');
      const store = tx.objectStore(BUSINESSES_STORE);
      const index = store.index('by_peerId');
      const request = index.getAll(peerId);
      
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }
}

const storage = new IndexedDBStorage();

function encodeGeohash(lat: number, lon: number, precision: number = 9): string {
  let minLat = -90, maxLat = 90;
  let minLon = -180, maxLon = 180;
  let hash = '';
  let bit = 0;
  let ch = 0;
  let isLon = true;

  while (hash.length < precision) {
    if (isLon) {
      const mid = (minLon + maxLon) / 2;
      if (lon >= mid) {
        ch = ch | (1 << (4 - bit));
        minLon = mid;
      } else {
        maxLon = mid;
      }
    } else {
      const mid = (minLat + maxLat) / 2;
      if (lat >= mid) {
        ch = ch | (1 << (4 - bit));
        minLat = mid;
      } else {
        maxLat = mid;
      }
    }

    isLon = !isLon;
    bit++;

    if (bit === 5) {
      hash += BASE32_CHARS[ch];
      bit = 0;
      ch = 0;
    }
  }

  return hash;
}

function generateUUID(): string {
  const bytes = nacl.randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function generateVerificationHash(crn: string, companyName: string, postcode: string): string {
  const data = `${crn}:${companyName.toLowerCase().trim()}:${postcode.replace(/\s+/g, '').toUpperCase()}`;
  const encoder = new TextEncoder();
  const hash = nacl.hash(encoder.encode(data));
  return encodeBase64(hash).substring(0, 64);
}

export class BusinessVerificationService {
  private localKeyPair: nacl.BoxKeyPair | null = null;
  private peerId: string = '';
  private readonly VERIFICATION_TOPIC = 'g3tzkp-business-verification-v1';
  private businessUpdateCallbacks: ((business: G3TZKPBusinessProfile) => void)[] = [];
  private initialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.initializeKeys();
  }

  private async initializeKeys(): Promise<void> {
    if (this.initialized) return;
    
    try {
      const storedKeys = await storage.getKeys();
      if (storedKeys) {
        this.localKeyPair = {
          publicKey: decodeBase64(storedKeys.publicKey),
          secretKey: decodeBase64(storedKeys.secretKey)
        };
        this.peerId = storedKeys.peerId;
      } else {
        await this.generateNewKeys();
      }
      this.initialized = true;
    } catch (error) {
      console.error('[BusinessVerification] Key initialization error:', error);
      await this.generateNewKeys();
      this.initialized = true;
    }
  }

  private async generateNewKeys(): Promise<void> {
    this.localKeyPair = nacl.box.keyPair();
    this.peerId = `12D3KooW${encodeBase64(this.localKeyPair.publicKey).substring(0, 44).replace(/[+/=]/g, '')}`;
    
    await storage.saveKeys({
      publicKey: encodeBase64(this.localKeyPair.publicKey),
      secretKey: encodeBase64(this.localKeyPair.secretKey),
      peerId: this.peerId
    });
  }

  async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  getPeerId(): string {
    return this.peerId;
  }

  validateCRN(crn: string): boolean {
    const normalizedCRN = crn.toUpperCase().replace(/\s+/g, '');
    const crnPatterns = [
      /^[0-9]{8}$/,
      /^[A-Z]{2}[0-9]{6}$/,
      /^[0-9]{6}$/,
      /^[A-Z][0-9]{7}$/,
      /^[0-9]{7}[A-Z]$/
    ];
    return crnPatterns.some(pattern => pattern.test(normalizedCRN));
  }

  validatePostcode(postcode: string): boolean {
    const ukPostcodeRegex = /^([A-Z]{1,2}[0-9][0-9A-Z]?\s?[0-9][A-Z]{2})$/i;
    return ukPostcodeRegex.test(postcode.trim());
  }

  validateCoordinates(lat: number, lon: number): boolean {
    return lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  }

  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  validateBusinessHours(hours: any): boolean {
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

    for (const day of days) {
      if (hours[day]) {
        if (!timeRegex.test(hours[day].open) || !timeRegex.test(hours[day].close)) {
          return false;
        }
      }
    }
    return true;
  }

  validateBusinessProfile(profile: any): BusinessValidationResult {
    const errors: string[] = [];

    if (!this.validateCRN(profile.crn)) {
      errors.push('Invalid Companies House Registration Number format');
    }

    if (!profile.name || profile.name.trim().length < 2) {
      errors.push('Business name is required');
    }

    if (!profile.location?.address?.postcode) {
      errors.push('Postcode is required');
    } else if (!this.validatePostcode(profile.location.address.postcode)) {
      errors.push('Invalid UK postcode format');
    }

    if (!this.validateCoordinates(profile.location?.latitude, profile.location?.longitude)) {
      errors.push('Invalid geographic coordinates');
    }

    if (!profile.contact?.email) {
      errors.push('Contact email is required');
    } else if (!this.validateEmail(profile.contact.email)) {
      errors.push('Invalid email format');
    }

    if (profile.hours && !this.validateBusinessHours(profile.hours)) {
      errors.push('Invalid business hours format (use HH:MM)');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  async fetchCompanyData(crn: string): Promise<CompanyHouseResponse | null> {
    try {
      const normalizedCRN = crn.toUpperCase().replace(/\s+/g, '').padStart(8, '0');
      
      const response = await fetch('/api/verify-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ crn: normalizedCRN })
      });

      if (!response.ok) {
        console.error('[BusinessVerification] Company lookup failed:', response.status);
        return null;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('[BusinessVerification] Failed to fetch company data:', error);
      return null;
    }
  }

  private verifyDataMatch(companyData: CompanyHouseResponse, proposedProfile: any): boolean {
    const nameNormalized = (name: string) => name.toLowerCase().replace(/\s+/g, ' ').trim();
    const postcodeNormalized = (pc: string) => pc.replace(/\s+/g, '').toUpperCase();

    const nameMatch = nameNormalized(companyData.company_name) === nameNormalized(proposedProfile.name);
    const postcodeMatch = postcodeNormalized(companyData.address.postal_code) === 
                         postcodeNormalized(proposedProfile.location.address.postcode);

    return nameMatch && postcodeMatch;
  }

  private mapSICCode(sicCode?: string): string {
    if (!sicCode) return 'other';
    
    const sicCategories: Record<string, string> = {
      '56101': 'restaurant',
      '56102': 'takeaway',
      '56301': 'bar',
      '56302': 'pub',
      '47110': 'groceries',
      '47710': 'clothing',
      '86': 'healthcare',
      '47730': 'pharmacy',
      '96020': 'beauty',
      '93130': 'fitness',
      '45': 'automotive',
      '95': 'repair',
      '69': 'legal',
      '64': 'financial',
      '85': 'education',
      '55': 'accommodation',
      '93': 'entertainment'
    };

    if (sicCategories[sicCode]) {
      return sicCategories[sicCode];
    }

    const prefix2 = sicCode.substring(0, 2);
    if (sicCategories[prefix2]) {
      return sicCategories[prefix2];
    }

    return 'other';
  }

  async signBusinessProfile(profile: Omit<G3TZKPBusinessProfile, 'signature'>): Promise<string> {
    if (!this.localKeyPair) {
      throw new Error('Keys not initialized');
    }

    const canonicalData = JSON.stringify({
      id: profile.id,
      crn: profile.crn,
      name: profile.name,
      verification_hash: profile.verification_hash,
      location: profile.location,
      verified_at: profile.verified_at,
      peerId: profile.peerId
    });

    const message = new TextEncoder().encode(canonicalData);
    const signature = nacl.sign.detached(message, this.localKeyPair.secretKey);
    
    return encodeBase64(signature);
  }

  async verifyBusinessSignature(profile: G3TZKPBusinessProfile): Promise<boolean> {
    try {
      const { signature, ...profileWithoutSig } = profile;
      
      const canonicalData = JSON.stringify({
        id: profileWithoutSig.id,
        crn: profileWithoutSig.crn,
        name: profileWithoutSig.name,
        verification_hash: profileWithoutSig.verification_hash,
        location: profileWithoutSig.location,
        verified_at: profileWithoutSig.verified_at,
        peerId: profileWithoutSig.peerId
      });

      const message = new TextEncoder().encode(canonicalData);
      const signatureBytes = decodeBase64(signature);
      
      const peerIdKey = profile.peerId.replace('12D3KooW', '');
      const publicKey = decodeBase64(peerIdKey + '====');
      
      return nacl.sign.detached.verify(message, signatureBytes, publicKey);
    } catch {
      return false;
    }
  }

  async verifyAndCreateBusiness(
    request: BusinessVerificationRequest
  ): Promise<BusinessVerificationResult> {
    
    if (!this.validateCRN(request.crn)) {
      return { success: false, error: 'Invalid CRN format' };
    }

    const validation = this.validateBusinessProfile({
      ...request.proposedProfile,
      crn: request.crn
    });

    if (!validation.isValid) {
      return { success: false, error: validation.errors.join('; ') };
    }

    const companyData = await this.fetchCompanyData(request.crn);
    if (!companyData) {
      return { success: false, error: 'Company not found in Companies House registry' };
    }

    if (companyData.status !== 'active') {
      return { success: false, error: `Company status is "${companyData.status}" - only active companies can be registered` };
    }

    const isMatching = this.verifyDataMatch(companyData, request.proposedProfile);
    if (!isMatching) {
      return { 
        success: false, 
        error: 'Business name or postcode does not match Companies House records' 
      };
    }

    const now = Date.now();
    const profileId = generateUUID();
    
    const verifiedProfile: G3TZKPBusinessProfile = {
      id: profileId,
      crn: companyData.company_number,
      verification_hash: generateVerificationHash(
        companyData.company_number,
        companyData.company_name,
        companyData.address.postal_code
      ),
      verified_at: now,
      verified_by: this.peerId,
      name: companyData.company_name,
      description: request.proposedProfile.description,
      category: request.proposedProfile.category || this.mapSICCode(companyData.sic_codes?.[0]),
      location: {
        latitude: request.proposedProfile.location.latitude,
        longitude: request.proposedProfile.location.longitude,
        address: {
          line1: companyData.address.address_line_1,
          line2: companyData.address.address_line_2,
          city: companyData.address.locality,
          postcode: companyData.address.postal_code,
          country: companyData.address.country || 'United Kingdom'
        },
        geohash: encodeGeohash(
          request.proposedProfile.location.latitude,
          request.proposedProfile.location.longitude
        )
      },
      contact: request.proposedProfile.contact,
      hours: request.proposedProfile.hours,
      peerId: this.peerId,
      createdAt: now,
      updatedAt: now,
      signature: '',
      company_status: companyData.status,
      sic_codes: companyData.sic_codes
    };

    const signature = await this.signBusinessProfile(verifiedProfile);
    verifiedProfile.signature = signature;

    await this.storeBusinessProfile(verifiedProfile);

    await this.broadcastToNetwork(verifiedProfile);

    console.log('[BusinessVerification] Successfully verified and created business:', verifiedProfile.name);

    return { success: true, profile: verifiedProfile };
  }

  private async broadcastToNetwork(profile: G3TZKPBusinessProfile): Promise<void> {
    const message: BusinessNetworkMessage = {
      type: 'BUSINESS_VERIFIED',
      version: '1.0',
      timestamp: Date.now(),
      payload: profile,
      sender: this.peerId,
      signature: profile.signature
    };

    try {
      await fetch('/api/p2p/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: this.VERIFICATION_TOPIC,
          message: JSON.stringify(message)
        })
      });
      console.log('[BusinessVerification] Broadcast to network:', profile.id);
    } catch (error) {
      console.warn('[BusinessVerification] Network broadcast failed, profile saved locally:', error);
    }
  }

  async storeBusinessProfile(profile: G3TZKPBusinessProfile): Promise<void> {
    await storage.saveBusiness(profile);
    console.log('[BusinessVerification] Stored business profile:', profile.name);
  }

  async getLocalBusinesses(): Promise<G3TZKPBusinessProfile[]> {
    try {
      return await storage.getAllBusinesses();
    } catch (error) {
      console.error('[BusinessVerification] Failed to get businesses:', error);
      return [];
    }
  }

  async getBusinessById(id: string): Promise<G3TZKPBusinessProfile | null> {
    const businesses = await this.getLocalBusinesses();
    return businesses.find(b => b.id === id) || null;
  }

  async getBusinessByCRN(crn: string): Promise<G3TZKPBusinessProfile | null> {
    const normalizedCRN = crn.toUpperCase().replace(/\s+/g, '').padStart(8, '0');
    return await storage.getBusinessByCRN(normalizedCRN);
  }

  async getBusinessesByCategory(category: string): Promise<G3TZKPBusinessProfile[]> {
    const businesses = await this.getLocalBusinesses();
    return businesses.filter(b => b.category === category);
  }

  async getBusinessesInArea(centerLat: number, centerLon: number, radiusKm: number): Promise<G3TZKPBusinessProfile[]> {
    const businesses = await this.getLocalBusinesses();
    
    return businesses.filter(b => {
      const dLat = (b.location.latitude - centerLat) * Math.PI / 180;
      const dLon = (b.location.longitude - centerLon) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(centerLat * Math.PI / 180) * Math.cos(b.location.latitude * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = 6371 * c;
      
      return distance <= radiusKm;
    });
  }

  async getMyBusinesses(): Promise<G3TZKPBusinessProfile[]> {
    await this.ensureInitialized();
    return await storage.getBusinessesByPeerId(this.peerId);
  }

  async deleteBusinessProfile(id: string): Promise<boolean> {
    await this.ensureInitialized();
    
    const business = await this.getBusinessById(id);
    if (!business) return false;
    
    if (business.peerId !== this.peerId) {
      console.error('[BusinessVerification] Cannot delete business owned by another peer');
      return false;
    }

    await storage.deleteBusiness(id);
    console.log('[BusinessVerification] Deleted business:', id);
    return true;
  }

  subscribeToBusinessUpdates(callback: (business: G3TZKPBusinessProfile) => void): () => void {
    this.businessUpdateCallbacks.push(callback);
    
    return () => {
      const index = this.businessUpdateCallbacks.indexOf(callback);
      if (index >= 0) {
        this.businessUpdateCallbacks.splice(index, 1);
      }
    };
  }

  handleNetworkMessage(messageData: string): void {
    try {
      const message: BusinessNetworkMessage = JSON.parse(messageData);
      
      if (message.type === 'BUSINESS_VERIFIED' && message.payload) {
        const profile = message.payload as G3TZKPBusinessProfile;
        
        this.storeBusinessProfile(profile);
        
        this.businessUpdateCallbacks.forEach(cb => cb(profile));
      }
    } catch (error) {
      console.error('[BusinessVerification] Failed to handle network message:', error);
    }
  }
}

export const businessVerificationService = new BusinessVerificationService();
