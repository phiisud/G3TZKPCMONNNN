import { create } from 'zustand';
import type { G3TZKPBusinessProfile, BusinessVerificationResult } from '../types/business';
import { businessVerificationService } from '../services/BusinessVerificationService';

interface BusinessFormData {
  crn: string;
  name: string;
  description: string;
  category: string;
  latitude: number;
  longitude: number;
  address: {
    line1: string;
    line2: string;
    city: string;
    postcode: string;
    country: string;
  };
  contact: {
    email: string;
    phone: string;
    website: string;
  };
  hours: {
    monday: { open: string; close: string };
    tuesday: { open: string; close: string };
    wednesday: { open: string; close: string };
    thursday: { open: string; close: string };
    friday: { open: string; close: string };
    saturday: { open: string; close: string };
    sunday: { open: string; close: string };
  };
}

interface BusinessStore {
  businesses: G3TZKPBusinessProfile[];
  myBusinesses: G3TZKPBusinessProfile[];
  selectedBusiness: G3TZKPBusinessProfile | null;
  isLoading: boolean;
  error: string | null;
  registrationStep: number;
  formData: BusinessFormData;
  verificationResult: BusinessVerificationResult | null;
  showRegistrationModal: boolean;
  companyData: any | null;
  
  loadBusinesses: () => Promise<void>;
  setSelectedBusiness: (business: G3TZKPBusinessProfile | null) => void;
  setRegistrationStep: (step: number) => void;
  updateFormData: (data: Partial<BusinessFormData>) => void;
  updateFormAddress: (data: Partial<BusinessFormData['address']>) => void;
  updateFormContact: (data: Partial<BusinessFormData['contact']>) => void;
  updateFormHours: (day: string, hours: { open: string; close: string }) => void;
  resetFormData: () => void;
  verifyCRN: (crn: string) => Promise<any>;
  submitRegistration: () => Promise<BusinessVerificationResult>;
  deleteBusiness: (id: string) => Promise<boolean>;
  setShowRegistrationModal: (show: boolean) => void;
  addReceivedBusiness: (business: G3TZKPBusinessProfile) => void;
  searchBusinesses: (query: string) => G3TZKPBusinessProfile[];
  getBusinessesNearby: (lat: number, lon: number, radiusKm: number) => Promise<G3TZKPBusinessProfile[]>;
  setLocation: (lat: number, lon: number) => void;
}

const DEFAULT_HOURS = {
  monday: { open: '09:00', close: '17:00' },
  tuesday: { open: '09:00', close: '17:00' },
  wednesday: { open: '09:00', close: '17:00' },
  thursday: { open: '09:00', close: '17:00' },
  friday: { open: '09:00', close: '17:00' },
  saturday: { open: '10:00', close: '16:00' },
  sunday: { open: '', close: '' }
};

const INITIAL_FORM_DATA: BusinessFormData = {
  crn: '',
  name: '',
  description: '',
  category: '',
  latitude: 51.5074,
  longitude: -0.1278,
  address: {
    line1: '',
    line2: '',
    city: '',
    postcode: '',
    country: 'United Kingdom'
  },
  contact: {
    email: '',
    phone: '',
    website: ''
  },
  hours: DEFAULT_HOURS
};

export const useBusinessStore = create<BusinessStore>()((set, get) => ({
  businesses: [],
  myBusinesses: [],
  selectedBusiness: null,
  isLoading: false,
  error: null,
  registrationStep: 1,
  formData: { ...INITIAL_FORM_DATA },
  verificationResult: null,
  showRegistrationModal: false,
  companyData: null,

  loadBusinesses: async () => {
    try {
      await businessVerificationService.ensureInitialized();
      const all = await businessVerificationService.getLocalBusinesses();
      const mine = await businessVerificationService.getMyBusinesses();
      console.log('[BusinessStore] Loaded', all.length, 'businesses from IndexedDB');
      set({ businesses: all, myBusinesses: mine });
    } catch (error) {
      console.error('[BusinessStore] Failed to load businesses:', error);
    }
  },

  setSelectedBusiness: (business) => {
    set({ selectedBusiness: business });
  },

  setRegistrationStep: (step) => {
    set({ registrationStep: step });
  },

  updateFormData: (data) => {
    set(state => ({
      formData: { ...state.formData, ...data }
    }));
  },

  updateFormAddress: (data) => {
    set(state => ({
      formData: {
        ...state.formData,
        address: { ...state.formData.address, ...data }
      }
    }));
  },

  updateFormContact: (data) => {
    set(state => ({
      formData: {
        ...state.formData,
        contact: { ...state.formData.contact, ...data }
      }
    }));
  },

  updateFormHours: (day, hours) => {
    set(state => ({
      formData: {
        ...state.formData,
        hours: { ...state.formData.hours, [day]: hours }
      }
    }));
  },

  resetFormData: () => {
    set({
      formData: { ...INITIAL_FORM_DATA },
      registrationStep: 1,
      verificationResult: null,
      error: null,
      companyData: null
    });
  },

  verifyCRN: async (crn: string) => {
    set({ isLoading: true, error: null });
    
    try {
      await businessVerificationService.ensureInitialized();
      const result = await businessVerificationService.fetchCompanyData(crn);
      
      if (result && result.verified) {
        set(state => ({
          formData: {
            ...state.formData,
            crn: result.company_number,
            name: result.company_name,
            address: {
              ...state.formData.address,
              line1: result.address.address_line_1 || '',
              line2: result.address.address_line_2 || '',
              city: result.address.locality || '',
              postcode: result.address.postal_code || ''
            }
          },
          isLoading: false,
          registrationStep: 2,
          companyData: result
        }));
        return result;
      } else {
        set({ 
          error: 'Company not found in Companies House registry',
          isLoading: false 
        });
        return null;
      }
    } catch (error) {
      set({ 
        error: 'Failed to verify company. Please try again.',
        isLoading: false 
      });
      return null;
    }
  },

  submitRegistration: async () => {
    const { formData } = get();
    set({ isLoading: true, error: null });

    try {
      await businessVerificationService.ensureInitialized();
      
      const result = await businessVerificationService.verifyAndCreateBusiness({
        crn: formData.crn,
        proposedProfile: {
          name: formData.name,
          description: formData.description,
          category: formData.category,
          location: {
            latitude: formData.latitude,
            longitude: formData.longitude,
            address: formData.address,
            geohash: ''
          },
          contact: formData.contact,
          hours: formData.hours,
          peerId: businessVerificationService.getPeerId()
        },
        operatorSignature: ''
      });

      if (result.success && result.profile) {
        set(state => ({
          businesses: [...state.businesses, result.profile!],
          myBusinesses: [...state.myBusinesses, result.profile!],
          verificationResult: result,
          isLoading: false,
          showRegistrationModal: false
        }));
        get().resetFormData();
      } else {
        set({
          error: result.error || 'Registration failed',
          verificationResult: result,
          isLoading: false
        });
      }

      return result;
    } catch (error) {
      const errorResult: BusinessVerificationResult = {
        success: false,
        error: 'An unexpected error occurred'
      };
      set({
        error: errorResult.error,
        verificationResult: errorResult,
        isLoading: false
      });
      return errorResult;
    }
  },

  deleteBusiness: async (id: string) => {
    const success = await businessVerificationService.deleteBusinessProfile(id);
    
    if (success) {
      set(state => ({
        businesses: state.businesses.filter(b => b.id !== id),
        myBusinesses: state.myBusinesses.filter(b => b.id !== id),
        selectedBusiness: state.selectedBusiness?.id === id ? null : state.selectedBusiness
      }));
    }
    
    return success;
  },

  setShowRegistrationModal: (show) => {
    set({ showRegistrationModal: show });
    if (!show) {
      get().resetFormData();
    }
  },

  addReceivedBusiness: (business) => {
    set(state => {
      const exists = state.businesses.some(b => b.id === business.id);
      if (exists) return state;
      
      return {
        businesses: [...state.businesses, business]
      };
    });
  },

  searchBusinesses: (query: string) => {
    const { businesses } = get();
    const lowerQuery = query.toLowerCase();
    
    return businesses.filter(b => 
      b.name.toLowerCase().includes(lowerQuery) ||
      b.description.toLowerCase().includes(lowerQuery) ||
      b.category.toLowerCase().includes(lowerQuery) ||
      b.location.address.city.toLowerCase().includes(lowerQuery)
    );
  },

  getBusinessesNearby: async (lat: number, lon: number, radiusKm: number) => {
    return await businessVerificationService.getBusinessesInArea(lat, lon, radiusKm);
  },

  setLocation: (lat: number, lon: number) => {
    set(state => ({
      formData: { ...state.formData, latitude: lat, longitude: lon }
    }));
  }
}));
