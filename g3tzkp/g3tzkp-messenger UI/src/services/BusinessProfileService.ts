import { G3TZKPBusinessProfile, BusinessPhoto, BusinessProduct } from '../types/business';

const StorageService = {
  getItem: (key: string): Promise<string | null> => Promise.resolve(localStorage.getItem(key)),
  setItem: (key: string, value: string): Promise<void> => {
    localStorage.setItem(key, value);
    return Promise.resolve();
  }
};

export interface CreateBusinessProfileInput {
  crn: string;
  name: string;
  description: string;
  category: string;
  latitude: number;
  longitude: number;
  address: any;
  contact: any;
  hours: any;
  verificationKey: string;
  cryptoKeyId: string;
  bio?: string;
  ownerId: string;
}

export interface UpdateBusinessProfileInput {
  id: string;
  bio?: string;
  description?: string;
  category?: string;
  contact?: any;
  hours?: any;
}

class BusinessProfileService {
  private storageKey = 'g3tzkp-business-profiles';

  async createBusinessProfile(input: CreateBusinessProfileInput): Promise<G3TZKPBusinessProfile> {
    const now = Date.now();
    const profile: G3TZKPBusinessProfile = {
      id: this.generateId(),
      crn: input.crn,
      verification_hash: this.hashCRN(input.crn),
      verified_at: now,
      verified_by: input.ownerId,
      name: input.name,
      description: input.description,
      category: input.category,
      location: {
        latitude: input.latitude,
        longitude: input.longitude,
        address: input.address,
        geohash: this.generateGeohash(input.latitude, input.longitude)
      },
      contact: input.contact,
      hours: input.hours,
      peerId: `business-${input.crn}`,
      createdAt: now,
      updatedAt: now,
      signature: '',
      verificationKey: input.verificationKey,
      cryptoKeyId: input.cryptoKeyId,
      photos: [],
      products: [],
      featuredProductIds: [],
      bio: input.bio || '',
      bioWordCount: this.countWords(input.bio || ''),
      isPublished: false,
      zkpVerified: false
    };

    await this.saveProfile(profile);
    return profile;
  }

  async updateBusinessProfile(input: UpdateBusinessProfileInput): Promise<G3TZKPBusinessProfile> {
    const profile = await this.getBusinessProfileById(input.id);
    if (!profile) throw new Error('Business profile not found');

    const updated: G3TZKPBusinessProfile = {
      ...profile,
      bio: input.bio !== undefined ? input.bio : profile.bio,
      bioWordCount: input.bio !== undefined ? this.countWords(input.bio) : profile.bioWordCount,
      description: input.description || profile.description,
      category: input.category || profile.category,
      contact: input.contact ? { ...profile.contact, ...input.contact } : profile.contact,
      hours: input.hours ? { ...profile.hours, ...input.hours } : profile.hours,
      updatedAt: Date.now()
    };

    if (updated.bioWordCount && updated.bioWordCount > 200) {
      throw new Error('Bio exceeds 200 words limit');
    }

    await this.saveProfile(updated);
    return updated;
  }

  async getBusinessProfileById(id: string): Promise<G3TZKPBusinessProfile | null> {
    const profiles = await this.getAllProfiles();
    return profiles.find(p => p.id === id) || null;
  }

  async getBusinessProfileByCRN(crn: string): Promise<G3TZKPBusinessProfile | null> {
    const profiles = await this.getAllProfiles();
    return profiles.find(p => p.crn === crn) || null;
  }

  async deleteBusinessProfile(id: string): Promise<boolean> {
    try {
      const profiles = await this.getAllProfiles();
      const filtered = profiles.filter(p => p.id !== id);
      await StorageService.setItem(this.storageKey, JSON.stringify(filtered));
      return true;
    } catch (error) {
      console.error('Failed to delete business profile:', error);
      return false;
    }
  }

  async addPhotoToProfile(profileId: string, photo: Omit<BusinessPhoto, 'id'>): Promise<BusinessPhoto> {
    const profile = await this.getBusinessProfileById(profileId);
    if (!profile) throw new Error('Business profile not found');

    if (!profile.photos) profile.photos = [];
    if (profile.photos.length >= 9) {
      throw new Error('Maximum 9 photos allowed');
    }

    const newPhoto: BusinessPhoto = {
      ...photo,
      id: this.generateId(),
      order: profile.photos.length
    };

    profile.photos.push(newPhoto);
    profile.updatedAt = Date.now();
    await this.saveProfile(profile);

    return newPhoto;
  }

  async removePhotoFromProfile(profileId: string, photoId: string): Promise<boolean> {
    const profile = await this.getBusinessProfileById(profileId);
    if (!profile) throw new Error('Business profile not found');

    if (!profile.photos) return false;

    const filtered = profile.photos.filter(p => p.id !== photoId);
    profile.photos = filtered.map((p, idx) => ({ ...p, order: idx }));
    profile.updatedAt = Date.now();

    await this.saveProfile(profile);
    return true;
  }

  async reorderPhotos(profileId: string, photoIds: string[]): Promise<void> {
    const profile = await this.getBusinessProfileById(profileId);
    if (!profile || !profile.photos) throw new Error('Business profile or photos not found');

    const photoMap = new Map(profile.photos.map(p => [p.id, p]));
    const reordered = photoIds
      .map((id, idx) => {
        const photo = photoMap.get(id);
        if (!photo) throw new Error(`Photo ${id} not found`);
        return { ...photo, order: idx };
      });

    profile.photos = reordered;
    profile.updatedAt = Date.now();
    await this.saveProfile(profile);
  }

  async addProductToProfile(profileId: string, product: Omit<BusinessProduct, 'id' | 'createdAt'>): Promise<BusinessProduct> {
    const profile = await this.getBusinessProfileById(profileId);
    if (!profile) throw new Error('Business profile not found');

    if (!profile.products) profile.products = [];

    const newProduct: BusinessProduct = {
      ...product,
      id: this.generateId(),
      createdAt: Date.now()
    };

    profile.products.push(newProduct);
    profile.updatedAt = Date.now();
    await this.saveProfile(profile);

    return newProduct;
  }

  async updateProduct(profileId: string, productId: string, updates: Partial<BusinessProduct>): Promise<BusinessProduct> {
    const profile = await this.getBusinessProfileById(profileId);
    if (!profile || !profile.products) throw new Error('Business profile or products not found');

    const product = profile.products.find(p => p.id === productId);
    if (!product) throw new Error('Product not found');

    const updated = { ...product, ...updates, id: productId, createdAt: product.createdAt };
    const index = profile.products.findIndex(p => p.id === productId);
    profile.products[index] = updated;
    profile.updatedAt = Date.now();

    await this.saveProfile(profile);
    return updated;
  }

  async removeProductFromProfile(profileId: string, productId: string): Promise<boolean> {
    const profile = await this.getBusinessProfileById(profileId);
    if (!profile) throw new Error('Business profile not found');

    if (!profile.products) return false;

    const filtered = profile.products.filter(p => p.id !== productId);
    profile.products = filtered;

    if (profile.featuredProductIds) {
      profile.featuredProductIds = profile.featuredProductIds.filter(id => id !== productId);
    }

    profile.updatedAt = Date.now();
    await this.saveProfile(profile);
    return true;
  }

  async setFeaturedProducts(profileId: string, productIds: string[]): Promise<void> {
    const profile = await this.getBusinessProfileById(profileId);
    if (!profile) throw new Error('Business profile not found');

    if (productIds.length > 3) {
      throw new Error('Maximum 3 featured products allowed');
    }

    if (!profile.products) throw new Error('No products found');

    const validIds = productIds.filter(id => profile.products?.some(p => p.id === id));
    if (validIds.length !== productIds.length) {
      throw new Error('One or more product IDs not found');
    }

    profile.featuredProductIds = productIds;
    profile.updatedAt = Date.now();
    await this.saveProfile(profile);
  }

  async publishProfile(profileId: string): Promise<void> {
    const profile = await this.getBusinessProfileById(profileId);
    if (!profile) throw new Error('Business profile not found');

    if (!profile.verificationKey) {
      throw new Error('Profile must have valid verification key to publish');
    }

    if (!profile.photos || profile.photos.length === 0) {
      throw new Error('Profile must have at least one photo');
    }

    if (!profile.bio || profile.bio.trim().length === 0) {
      throw new Error('Profile must have a bio');
    }

    profile.isPublished = true;
    profile.updatedAt = Date.now();
    await this.saveProfile(profile);
  }

  async unpublishProfile(profileId: string): Promise<void> {
    const profile = await this.getBusinessProfileById(profileId);
    if (!profile) throw new Error('Business profile not found');

    profile.isPublished = false;
    profile.updatedAt = Date.now();
    await this.saveProfile(profile);
  }

  async getAllProfiles(): Promise<G3TZKPBusinessProfile[]> {
    try {
      const data = await StorageService.getItem(this.storageKey);
      if (!data) return [];
      return JSON.parse(data) as G3TZKPBusinessProfile[];
    } catch (error) {
      console.error('Failed to get profiles:', error);
      return [];
    }
  }

  async getProfilesByOwner(ownerId: string): Promise<G3TZKPBusinessProfile[]> {
    const profiles = await this.getAllProfiles();
    return profiles.filter(p => p.verified_by === ownerId);
  }

  async getPublishedProfiles(): Promise<G3TZKPBusinessProfile[]> {
    const profiles = await this.getAllProfiles();
    return profiles.filter(p => p.isPublished);
  }

  async searchProfiles(query: string): Promise<G3TZKPBusinessProfile[]> {
    const profiles = await this.getAllProfiles();
    const lowerQuery = query.toLowerCase();
    return profiles.filter(p =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.description.toLowerCase().includes(lowerQuery) ||
      p.category.toLowerCase().includes(lowerQuery)
    );
  }

  async getProfilesNearby(lat: number, lon: number, radiusKm: number): Promise<G3TZKPBusinessProfile[]> {
    const profiles = await this.getAllProfiles();
    return profiles.filter(p => {
      const distance = this.calculateDistance(lat, lon, p.location.latitude, p.location.longitude);
      return distance <= radiusKm;
    });
  }

  private saveProfile(profile: G3TZKPBusinessProfile): Promise<void> {
    return this.getAllProfiles().then(profiles => {
      const index = profiles.findIndex(p => p.id === profile.id);
      if (index >= 0) {
        profiles[index] = profile;
      } else {
        profiles.push(profile);
      }
      return StorageService.setItem(this.storageKey, JSON.stringify(profiles));
    });
  }

  private generateId(): string {
    return `business-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private hashCRN(crn: string): string {
    let hash = 0;
    for (let i = 0; i < crn.length; i++) {
      const char = crn.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  private generateGeohash(lat: number, lon: number): string {
    return `${lat.toFixed(4)},${lon.toFixed(4)}`;
  }

  private countWords(text: string): number {
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  }

  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

export const businessProfileService = new BusinessProfileService();
