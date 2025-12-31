import React, { useState, useEffect } from 'react';
import {
  Briefcase, Shield, CheckCircle, MapPin, Clock, Search, Building2, CreditCard,
  Network, AlertCircle, ChevronRight, X, Store, TrendingUp, Users, Award, Map
} from 'lucide-react';
import { useThemeStore } from '../stores/themeStore';
import { useBusinessStore } from '../stores/businessStore';
import { G3TZKPBusinessProfile, BUSINESS_CATEGORIES } from '../types/business';
import BusinessProfileModal from '../components/BusinessProfileModal';
import G3ZKPBusinessMapComponent from '../components/G3ZKPBusinessMapComponent';
import { businessProfileService } from '../services/BusinessProfileService';
import { businessKeyService } from '../services/BusinessKeyService';
import { cryptoLicenseKeyService } from '../services/CryptoLicenseKeyService';

type MarketplaceTab = 'marketplace' | 'verification' | 'my-businesses' | 'maps' | 'analytics';

interface MarketplaceState {
  activeTab: MarketplaceTab;
  selectedBusiness: G3TZKPBusinessProfile | null;
  searchQuery: string;
  selectedCategory: string;
  verificationStep: 'intro' | 'key-entry' | 'key-validation' | 'profile-setup' | 'complete';
  showProfileModal: boolean;
  businessVerificationKey: string;
  keyValidationStatus: 'pending' | 'valid' | 'invalid' | 'expired';
}

const MarketplacePageExtended: React.FC = () => {
  const theme = useThemeStore((state) => state.getCurrentTheme());
  const { businesses, myBusinesses, loadBusinesses } = useBusinessStore();

  const [state, setState] = useState<MarketplaceState>({
    activeTab: 'marketplace',
    selectedBusiness: null,
    searchQuery: '',
    selectedCategory: '',
    verificationStep: 'intro',
    showProfileModal: false,
    businessVerificationKey: '',
    keyValidationStatus: 'pending'
  });

  useEffect(() => {
    loadBusinesses();
  }, [loadBusinesses]);

  const filteredBusinesses = businesses.filter((biz) => {
    const matchesSearch =
      biz.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
      biz.description?.toLowerCase().includes(state.searchQuery.toLowerCase());
    const matchesCategory = !state.selectedCategory || biz.category === state.selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const stats = {
    totalBusiness: businesses.length,
    verifiedCount: businesses.filter((b) => b.zkpVerified).length,
    activeUsers: Math.floor(businesses.length * 3.5),
    trustScore: Math.floor(
      ((businesses.filter((b) => b.zkpVerified).length / businesses.length) || 0) * 100
    )
  };

  const validateBusinessKey = () => {
    if (!state.businessVerificationKey) {
      setState({ ...state, keyValidationStatus: 'invalid' });
      return;
    }

    try {
      const key = businessKeyService.deserializeBusinessKey(state.businessVerificationKey);
      if (!key) {
        setState({ ...state, keyValidationStatus: 'invalid' });
        return;
      }

      const validation = businessKeyService.validateBusinessKey(key);
      if (!validation.valid) {
        setState({
          ...state,
          keyValidationStatus: validation.reason?.includes('expired') ? 'expired' : 'invalid'
        });
        return;
      }

      setState({
        ...state,
        keyValidationStatus: 'valid',
        verificationStep: 'profile-setup'
      });
    } catch (error) {
      setState({ ...state, keyValidationStatus: 'invalid' });
    }
  };

  const handleSaveProfile = async (profile: G3TZKPBusinessProfile) => {
    await businessProfileService.updateBusinessProfile({
      id: profile.id,
      bio: profile.bio,
      description: profile.description,
      category: profile.category,
      contact: profile.contact,
      hours: profile.hours
    });
    setState({ ...state, showProfileModal: false });
  };

  // ========== RENDER FUNCTIONS ==========

  const renderMarketplaceTab = () => (
    <div className="space-y-6">
      <div
        className="rounded-lg p-8 mb-8"
        style={{
          backgroundColor: theme.colors.surface,
          border: `2px solid ${theme.colors.border}`
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-3xl font-bold mb-2" style={{ color: theme.colors.primary }}>
              <Store className="inline mr-3" size={32} />
              G3ZKP Marketplace
            </h2>
            <p style={{ color: theme.colors.textSecondary }}>
              Discover verified businesses powered by Zero-Knowledge Proof technology
            </p>
          </div>
          <button
            onClick={() => setState({ ...state, activeTab: 'verification' })}
            className="px-6 py-3 rounded-lg font-semibold flex items-center gap-2 transition-all hover:scale-105"
            style={{
              backgroundColor: theme.colors.primary,
              color: theme.colors.background
            }}
          >
            <Building2 size={20} />
            List Your Business
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {[
            { icon: TrendingUp, label: 'Businesses', value: stats.totalBusiness },
            { icon: CheckCircle, label: 'Verified', value: stats.verifiedCount },
            { icon: Users, label: 'Active Users', value: stats.activeUsers },
            { icon: Award, label: 'Trust Score', value: `${stats.trustScore}%` }
          ].map((stat, idx) => (
            <div
              key={idx}
              className="rounded-lg p-4"
              style={{
                backgroundColor: theme.colors.background,
                border: `1px solid ${theme.colors.border}`
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p style={{ color: theme.colors.textSecondary }} className="text-sm">
                    {stat.label}
                  </p>
                  <p className="text-2xl font-bold mt-1" style={{ color: theme.colors.primary }}>
                    {stat.value}
                  </p>
                </div>
                <stat.icon size={32} style={{ color: theme.colors.primary, opacity: 0.5 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        className="rounded-lg p-6"
        style={{
          backgroundColor: theme.colors.surface,
          border: `2px solid ${theme.colors.border}`
        }}
      >
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search size={20} className="absolute left-3 top-3" style={{ color: theme.colors.textSecondary }} />
            <input
              type="text"
              placeholder="Search businesses..."
              value={state.searchQuery}
              onChange={(e) => setState({ ...state, searchQuery: e.target.value })}
              className="w-full pl-10 pr-4 py-2 rounded-lg bg-black border-2"
              style={{
                borderColor: theme.colors.border,
                color: theme.colors.text
              }}
            />
          </div>
          <select
            value={state.selectedCategory}
            onChange={(e) => setState({ ...state, selectedCategory: e.target.value })}
            className="px-4 py-2 rounded-lg bg-black border-2"
            style={{
              borderColor: theme.colors.border,
              color: theme.colors.text
            }}
          >
            <option value="">All Categories</option>
            {BUSINESS_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredBusinesses.map((business) => (
            <div
              key={business.id}
              className="rounded-lg p-4 border-2 hover:scale-105 transition cursor-pointer"
              style={{
                backgroundColor: theme.colors.background,
                borderColor: business.zkpVerified ? theme.colors.secondary : theme.colors.border
              }}
              onClick={() => setState({ ...state, selectedBusiness: business })}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="text-lg font-bold" style={{ color: theme.colors.primary }}>
                  {business.name}
                </h3>
                {business.zkpVerified && <CheckCircle size={20} style={{ color: theme.colors.secondary }} />}
              </div>
              <p style={{ color: theme.colors.textSecondary }} className="text-sm mb-2">
                {business.description?.substring(0, 100)}...
              </p>
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: theme.colors.textSecondary }}>
                  📍 {business.location.address.city}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setState({ ...state, selectedBusiness: business, showProfileModal: true });
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs transition"
                  style={{
                    backgroundColor: theme.colors.primary,
                    color: theme.colors.background
                  }}
                >
                  View <ChevronRight size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderVerificationTab = () => (
    <div className="space-y-6 max-w-2xl mx-auto">
      {state.verificationStep === 'intro' && (
        <div
          className="rounded-lg p-8"
          style={{
            backgroundColor: theme.colors.surface,
            border: `2px solid ${theme.colors.primary}`
          }}
        >
          <h2 className="text-2xl font-bold mb-4" style={{ color: theme.colors.primary }}>
            <Shield className="inline mr-2" size={28} />
            Business Verification
          </h2>
          <p style={{ color: theme.colors.textSecondary }} className="mb-6">
            Register your business with zero-knowledge proof verification. Cost: £10 for lifetime access.
          </p>
          <button
            onClick={() => setState({ ...state, verificationStep: 'key-entry' })}
            className="w-full py-3 rounded-lg font-semibold transition-all hover:scale-105"
            style={{
              backgroundColor: theme.colors.primary,
              color: theme.colors.background
            }}
          >
            Continue with Verification Key
          </button>
        </div>
      )}

      {state.verificationStep === 'key-entry' && (
        <div
          className="rounded-lg p-8 space-y-4"
          style={{
            backgroundColor: theme.colors.surface,
            border: `2px solid ${theme.colors.primary}`
          }}
        >
          <h2 className="text-2xl font-bold" style={{ color: theme.colors.primary }}>
            Enter Business Verification Key
          </h2>
          <p style={{ color: theme.colors.textSecondary }}>
            Paste the cryptographic key you received after paying £10 on g3tzkp.com
          </p>
          <textarea
            value={state.businessVerificationKey}
            onChange={(e) => setState({ ...state, businessVerificationKey: e.target.value })}
            placeholder="Paste your business verification key here..."
            className="w-full h-32 p-4 rounded-lg bg-black border-2"
            style={{
              borderColor:
                state.keyValidationStatus === 'invalid' ? theme.colors.error : theme.colors.border,
              color: theme.colors.text
            }}
          />
          {state.keyValidationStatus === 'invalid' && (
            <p style={{ color: theme.colors.error }}>❌ Invalid or expired key</p>
          )}
          {state.keyValidationStatus === 'expired' && (
            <p style={{ color: theme.colors.error }}>⏰ Key has expired. Please renew on g3tzkp.com</p>
          )}
          <button
            onClick={validateBusinessKey}
            className="w-full py-3 rounded-lg font-semibold transition-all hover:scale-105"
            style={{
              backgroundColor: theme.colors.primary,
              color: theme.colors.background
            }}
          >
            Validate Key
          </button>
        </div>
      )}

      {state.verificationStep === 'profile-setup' && (
        <div
          className="rounded-lg p-8"
          style={{
            backgroundColor: theme.colors.surface,
            border: `2px solid ${theme.colors.secondary}`
          }}
        >
          <CheckCircle size={48} style={{ color: theme.colors.secondary }} className="mb-4" />
          <h2 className="text-2xl font-bold mb-4" style={{ color: theme.colors.secondary }}>
            Key Validated ✓
          </h2>
          <p style={{ color: theme.colors.textSecondary }} className="mb-6">
            Your business verification key has been validated. You can now set up your business profile.
          </p>
          <button
            onClick={() => setState({ ...state, activeTab: 'my-businesses' })}
            className="w-full py-3 rounded-lg font-semibold transition-all hover:scale-105"
            style={{
              backgroundColor: theme.colors.primary,
              color: theme.colors.background
            }}
          >
            Go to My Businesses
          </button>
        </div>
      )}
    </div>
  );

  const renderMyBusinessesTab = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold" style={{ color: theme.colors.primary }}>
        My Businesses
      </h2>

      {myBusinesses.length === 0 ? (
        <div
          className="rounded-lg p-8 text-center"
          style={{
            backgroundColor: theme.colors.surface,
            border: `2px solid ${theme.colors.border}`
          }}
        >
          <Store size={48} style={{ color: theme.colors.textSecondary, margin: '0 auto 16px' }} />
          <p style={{ color: theme.colors.textSecondary }}>No businesses yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {myBusinesses.map((business) => (
            <div
              key={business.id}
              className="rounded-lg p-6 border-2"
              style={{
                backgroundColor: theme.colors.surface,
                borderColor: business.isPublished ? theme.colors.secondary : theme.colors.border
              }}
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="text-xl font-bold" style={{ color: theme.colors.primary }}>
                  {business.name}
                </h3>
                <span
                  className="px-3 py-1 rounded text-xs font-semibold"
                  style={{
                    backgroundColor: business.isPublished ? theme.colors.secondary : theme.colors.border,
                    color: business.isPublished ? theme.colors.background : theme.colors.text
                  }}
                >
                  {business.isPublished ? '🔴 Published' : '⚪ Draft'}
                </span>
              </div>

              <p style={{ color: theme.colors.textSecondary }} className="text-sm mb-3">
                {business.description?.substring(0, 80)}...
              </p>

              <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                <div style={{ color: theme.colors.textSecondary }}>
                  📸 {business.photos?.length || 0}/9 photos
                </div>
                <div style={{ color: theme.colors.textSecondary }}>
                  📦 {business.products?.length || 0} products
                </div>
              </div>

              <button
                onClick={() => setState({ ...state, selectedBusiness: business, showProfileModal: true })}
                className="w-full py-2 rounded font-semibold transition"
                style={{
                  backgroundColor: theme.colors.primary,
                  color: theme.colors.background
                }}
              >
                Edit Profile
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderMapsTab = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: theme.colors.primary }}>
        <Map size={28} />
        G3ZKP Business Maps
      </h2>
      <G3ZKPBusinessMapComponent
        maxHeight="700px"
        onBusinessSelected={(business) => {
          setState({ ...state, selectedBusiness: business, showProfileModal: true });
        }}
      />
    </div>
  );

  const renderAnalyticsTab = () => (
    <div
      className="rounded-lg p-8 text-center"
      style={{
        backgroundColor: theme.colors.surface,
        border: `2px solid ${theme.colors.border}`
      }}
    >
      <TrendingUp size={48} style={{ color: theme.colors.textSecondary, margin: '0 auto 16px' }} />
      <p style={{ color: theme.colors.textSecondary }}>Analytics coming soon</p>
    </div>
  );

  return (
    <div className="w-full h-full overflow-auto p-6">
      <div className="flex gap-4 mb-6 border-b-2" style={{ borderColor: theme.colors.border }}>
        {(['marketplace', 'verification', 'my-businesses', 'maps', 'analytics'] as MarketplaceTab[]).map(
          (tab) => (
            <button
              key={tab}
              onClick={() => setState({ ...state, activeTab: tab })}
              className="px-4 py-3 font-semibold capitalize transition"
              style={{
                color:
                  state.activeTab === tab ? theme.colors.primary : theme.colors.textSecondary,
                borderBottom:
                  state.activeTab === tab ? `3px solid ${theme.colors.primary}` : 'none'
              }}
            >
              {tab === 'my-businesses' ? 'My Businesses' : tab}
            </button>
          )
        )}
      </div>

      {state.activeTab === 'marketplace' && renderMarketplaceTab()}
      {state.activeTab === 'verification' && renderVerificationTab()}
      {state.activeTab === 'my-businesses' && renderMyBusinessesTab()}
      {state.activeTab === 'maps' && renderMapsTab()}
      {state.activeTab === 'analytics' && renderAnalyticsTab()}

      {state.showProfileModal && state.selectedBusiness && (
        <BusinessProfileModal
          profile={state.selectedBusiness}
          onClose={() => setState({ ...state, showProfileModal: false })}
          onSave={handleSaveProfile}
        />
      )}
    </div>
  );
};

export default MarketplacePageExtended;
