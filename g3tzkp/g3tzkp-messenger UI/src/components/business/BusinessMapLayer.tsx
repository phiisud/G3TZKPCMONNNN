import React, { useEffect, useState, useCallback } from 'react';
import { Building2, Clock, MapPin, Mail, Phone, Globe, ExternalLink, Trash2, CheckCircle } from 'lucide-react';
import { useBusinessStore } from '../../stores/businessStore';
import type { G3TZKPBusinessProfile } from '../../types/business';
import { businessVerificationService } from '../../services/BusinessVerificationService';

interface BusinessMarkerProps {
  business: G3TZKPBusinessProfile;
  onSelect: (business: G3TZKPBusinessProfile) => void;
  isSelected: boolean;
}

const BusinessMarker: React.FC<BusinessMarkerProps> = ({ business, onSelect, isSelected }) => {
  return (
    <div 
      className={`absolute transform -translate-x-1/2 -translate-y-full cursor-pointer transition-transform hover:scale-110 ${
        isSelected ? 'z-50' : 'z-40'
      }`}
      onClick={() => onSelect(business)}
      style={{
        left: `${((business.location.longitude + 180) / 360) * 100}%`,
        top: `${((90 - business.location.latitude) / 180) * 100}%`
      }}
    >
      <div className={`relative ${isSelected ? 'scale-125' : ''}`}>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
          isSelected ? 'bg-[#00f3ff]' : 'bg-[#4caf50]'
        }`}>
          <Building2 className="w-4 h-4 text-black" />
        </div>
        <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 rotate-45 bg-inherit" />
      </div>
    </div>
  );
};

interface BusinessCardProps {
  business: G3TZKPBusinessProfile;
  onClose: () => void;
  canDelete: boolean;
  onDelete: () => void;
}

const BusinessCard: React.FC<BusinessCardProps> = ({ business, onClose, canDelete, onDelete }) => {
  const formatHours = (hours: any): string => {
    if (!hours?.open || !hours?.close) return 'Closed';
    return `${hours.open} - ${hours.close}`;
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long' }).toLowerCase();

  return (
    <div className="absolute top-4 right-4 w-80 bg-[#010401] border border-[#4caf50] rounded-lg shadow-xl z-50 max-h-[80vh] overflow-y-auto">
      <div className="p-4 border-b border-[#4caf50]/30">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-[#00f3ff] font-bold text-lg">{business.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs px-2 py-0.5 bg-[#4caf50]/20 text-[#4caf50] rounded">
                {business.category}
              </span>
              <span className="text-xs text-gray-500">CRN: {business.crn}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white">
            <span className="text-xl">&times;</span>
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {business.description && (
          <p className="text-gray-300 text-sm">{business.description}</p>
        )}

        <div className="flex items-start gap-2 text-sm">
          <MapPin className="w-4 h-4 text-[#00f3ff] mt-0.5 flex-shrink-0" />
          <div className="text-gray-300">
            <div>{business.location.address.line1}</div>
            {business.location.address.line2 && <div>{business.location.address.line2}</div>}
            <div>{business.location.address.city}, {business.location.address.postcode}</div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-[#00f3ff]" />
          <span className="text-gray-400">Today:</span>
          <span className="text-white">
            {formatHours(business.hours[today as keyof typeof business.hours])}
          </span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="w-4 h-4 text-[#4caf50]" />
            <a href={`mailto:${business.contact.email}`} className="text-[#00f3ff] hover:underline">
              {business.contact.email}
            </a>
          </div>
          
          {business.contact.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-[#4caf50]" />
              <a href={`tel:${business.contact.phone}`} className="text-[#00f3ff] hover:underline">
                {business.contact.phone}
              </a>
            </div>
          )}
          
          {business.contact.website && (
            <div className="flex items-center gap-2 text-sm">
              <Globe className="w-4 h-4 text-[#4caf50]" />
              <a 
                href={business.contact.website} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-[#00f3ff] hover:underline flex items-center gap-1"
              >
                Visit Website
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-[#4caf50]/30">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <CheckCircle className="w-3 h-3 text-[#4caf50]" />
            <span>Verified on {formatDate(business.verified_at)}</span>
          </div>
        </div>

        {canDelete && (
          <button
            onClick={onDelete}
            className="w-full mt-2 px-4 py-2 bg-red-500/20 border border-red-500/50 rounded text-red-400 hover:bg-red-500/30 transition-colors flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Remove Business
          </button>
        )}
      </div>
    </div>
  );
};

interface BusinessListProps {
  businesses: G3TZKPBusinessProfile[];
  onSelect: (business: G3TZKPBusinessProfile) => void;
  selectedId?: string;
}

export const BusinessList: React.FC<BusinessListProps> = ({ businesses, onSelect, selectedId }) => {
  if (businesses.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No verified businesses in this area</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-60 overflow-y-auto">
      {businesses.map((business) => (
        <div
          key={business.id}
          onClick={() => onSelect(business)}
          className={`p-3 rounded cursor-pointer transition-colors ${
            selectedId === business.id 
              ? 'bg-[#00f3ff]/20 border border-[#00f3ff]' 
              : 'bg-[#4caf50]/10 border border-[#4caf50]/30 hover:border-[#4caf50]'
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-white font-medium text-sm">{business.name}</h4>
              <p className="text-gray-400 text-xs mt-0.5">
                {business.location.address.city} | {business.category}
              </p>
            </div>
            <CheckCircle className="w-4 h-4 text-[#4caf50]" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const BusinessMapLayer: React.FC = () => {
  const { 
    businesses, 
    selectedBusiness, 
    setSelectedBusiness, 
    loadBusinesses,
    deleteBusiness 
  } = useBusinessStore();

  const [myPeerId, setMyPeerId] = useState<string>('');

  useEffect(() => {
    loadBusinesses();
    
    businessVerificationService.ensureInitialized().then(() => {
      setMyPeerId(businessVerificationService.getPeerId());
    });

    const unsubscribe = businessVerificationService.subscribeToBusinessUpdates((business) => {
      console.log('[BusinessMapLayer] Received new business from network:', business.name);
    });

    return () => unsubscribe();
  }, [loadBusinesses]);

  const handleSelectBusiness = useCallback((business: G3TZKPBusinessProfile) => {
    setSelectedBusiness(business);
  }, [setSelectedBusiness]);

  const handleClose = useCallback(() => {
    setSelectedBusiness(null);
  }, [setSelectedBusiness]);

  const handleDelete = useCallback(async () => {
    if (selectedBusiness) {
      await deleteBusiness(selectedBusiness.id);
    }
  }, [selectedBusiness, deleteBusiness]);

  const canDeleteSelected = selectedBusiness?.peerId === myPeerId;

  return (
    <>
      {businesses.map((business) => (
        <BusinessMarker
          key={business.id}
          business={business}
          onSelect={handleSelectBusiness}
          isSelected={selectedBusiness?.id === business.id}
        />
      ))}

      {selectedBusiness && (
        <BusinessCard
          business={selectedBusiness}
          onClose={handleClose}
          canDelete={canDeleteSelected}
          onDelete={handleDelete}
        />
      )}
    </>
  );
};

export default BusinessMapLayer;
