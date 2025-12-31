export interface BusinessAddress {
  line1: string;
  line2?: string;
  city: string;
  postcode: string;
  country: string;
}

export interface BusinessLocation {
  latitude: number;
  longitude: number;
  address: BusinessAddress;
  geohash: string;
}

export interface BusinessContact {
  email: string;
  phone?: string;
  website?: string;
}

export interface BusinessHours {
  open: string;
  close: string;
}

export interface BusinessHoursWeek {
  monday?: BusinessHours;
  tuesday?: BusinessHours;
  wednesday?: BusinessHours;
  thursday?: BusinessHours;
  friday?: BusinessHours;
  saturday?: BusinessHours;
  sunday?: BusinessHours;
}

export interface BusinessPhoto {
  id: string;
  url: string;
  caption?: string;
  order: number;
  uploadedAt: number;
}

export interface BusinessProduct {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  imageUrl?: string;
  inStock: boolean;
  category?: string;
  createdAt: number;
}

export interface G3TZKPBusinessProfile {
  id: string;
  crn: string;
  verification_hash: string;
  verified_at: number;
  verified_by: string;
  name: string;
  description: string;
  category: string;
  location: BusinessLocation;
  contact: BusinessContact;
  hours: BusinessHoursWeek;
  peerId: string;
  createdAt: number;
  updatedAt: number;
  signature: string;
  company_status?: string;
  sic_codes?: string[];
  verificationKey?: string;
  cryptoKeyId?: string;
  photos?: BusinessPhoto[];
  products?: BusinessProduct[];
  featuredProductIds?: string[];
  bio?: string;
  bioWordCount?: number;
  isPublished?: boolean;
  zkpVerified?: boolean;
  acceptsCallsDuringHours?: boolean;
}

export interface BusinessVerificationRequest {
  crn: string;
  proposedProfile: {
    name: string;
    description: string;
    category: string;
    location: BusinessLocation;
    contact: BusinessContact;
    hours: BusinessHoursWeek;
    peerId: string;
  };
  operatorSignature: string;
}

export interface CompanyHouseResponse {
  verified: boolean;
  company_number: string;
  company_name: string;
  address: {
    address_line_1: string;
    address_line_2?: string;
    locality: string;
    postal_code: string;
    country?: string;
  };
  status: string;
  type?: string;
  date_of_creation?: string;
  sic_codes?: string[];
}

export interface BusinessVerificationResult {
  success: boolean;
  profile?: G3TZKPBusinessProfile;
  error?: string;
}

export interface BusinessValidationResult {
  isValid: boolean;
  errors: string[];
}

export interface BusinessNetworkMessage {
  type: 'BUSINESS_VERIFIED' | 'BUSINESS_UPDATE' | 'BUSINESS_QUERY' | 'BUSINESS_RESPONSE';
  version: string;
  timestamp: number;
  payload: G3TZKPBusinessProfile | G3TZKPBusinessProfile[] | BusinessQueryPayload;
  sender: string;
  signature?: string;
}

export interface BusinessQueryPayload {
  queryType: 'AREA' | 'CRN' | 'CATEGORY';
  geohash?: string;
  radius?: number;
  crn?: string;
  category?: string;
}

export const SIC_CODE_CATEGORIES: Record<string, string> = {
  '01': 'agriculture',
  '10': 'food_manufacturing',
  '11': 'beverages',
  '13': 'textiles',
  '14': 'apparel',
  '18': 'printing',
  '20': 'chemicals',
  '21': 'pharmaceuticals',
  '25': 'metal_products',
  '26': 'electronics',
  '27': 'electrical',
  '28': 'machinery',
  '29': 'automotive',
  '30': 'transport_equipment',
  '31': 'furniture',
  '41': 'construction',
  '42': 'civil_engineering',
  '43': 'building_services',
  '45': 'vehicle_trade',
  '46': 'wholesale',
  '47': 'retail',
  '47110': 'groceries',
  '47710': 'clothing',
  '49': 'land_transport',
  '50': 'water_transport',
  '51': 'air_transport',
  '52': 'warehousing',
  '53': 'postal',
  '55': 'accommodation',
  '56': 'food_service',
  '56101': 'restaurant',
  '56102': 'takeaway',
  '56301': 'bar',
  '56302': 'pub',
  '58': 'publishing',
  '59': 'media_production',
  '60': 'broadcasting',
  '61': 'telecommunications',
  '62': 'software',
  '63': 'data_services',
  '64': 'financial_services',
  '65': 'insurance',
  '66': 'financial_auxiliary',
  '68': 'real_estate',
  '69': 'legal_accounting',
  '70': 'consulting',
  '71': 'architecture_engineering',
  '72': 'research',
  '73': 'advertising',
  '74': 'professional_services',
  '75': 'veterinary',
  '77': 'rental',
  '78': 'employment',
  '79': 'travel_agency',
  '80': 'security',
  '81': 'building_maintenance',
  '82': 'office_admin',
  '84': 'public_admin',
  '85': 'education',
  '86': 'healthcare',
  '87': 'residential_care',
  '88': 'social_work',
  '90': 'arts',
  '91': 'cultural',
  '92': 'gambling',
  '93': 'sports_recreation',
  '94': 'membership_orgs',
  '95': 'repair',
  '96': 'personal_services',
  '97': 'household_employers',
  '99': 'international'
};

export const BUSINESS_CATEGORIES = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'pub', label: 'Pub / Bar' },
  { value: 'cafe', label: 'Cafe' },
  { value: 'takeaway', label: 'Takeaway' },
  { value: 'groceries', label: 'Groceries' },
  { value: 'retail', label: 'Retail' },
  { value: 'clothing', label: 'Clothing' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'pharmacy', label: 'Pharmacy' },
  { value: 'beauty', label: 'Beauty / Salon' },
  { value: 'fitness', label: 'Fitness / Gym' },
  { value: 'automotive', label: 'Automotive' },
  { value: 'repair', label: 'Repair Services' },
  { value: 'professional', label: 'Professional Services' },
  { value: 'legal', label: 'Legal' },
  { value: 'financial', label: 'Financial' },
  { value: 'education', label: 'Education' },
  { value: 'accommodation', label: 'Accommodation' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'other', label: 'Other' }
];
