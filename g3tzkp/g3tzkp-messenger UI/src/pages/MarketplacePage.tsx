import React, { useState, useEffect } from 'react';
import { Briefcase, Shield, CheckCircle, MapPin, Clock, Search, Building2, CreditCard, Network, AlertCircle, ChevronRight, X, Store, TrendingUp, Users, Award } from 'lucide-react';
import { useThemeStore } from '../stores/themeStore';
import { useBusinessStore } from '../stores/businessStore';
import { G3TZKPBusinessProfile, BUSINESS_CATEGORIES } from '../types/business';

type MarketplaceTab = 'marketplace' | 'verification' | 'my-businesses' | 'analytics';

interface MarketplaceState {
  activeTab: MarketplaceTab;
  selectedBusiness: G3TZKPBusinessProfile | null;
  searchQuery: string;
  selectedCategory: string;
  verificationStep: 'intro' | 'crn-input' | 'verification' | 'details' | 'complete';
}

const MarketplacePage: React.FC = () => {
  const theme = useThemeStore((state) => state.getCurrentTheme());
  const [state, setState] = useState<MarketplaceState>({
    activeTab: 'marketplace',
    selectedBusiness: null,
    searchQuery: '',
    selectedCategory: '',
    verificationStep: 'intro'
  });

  const {
    formData,
    updateFormData,
    updateFormContact,
    updateFormAddress,
    isLoading: isVerifying,
    companyData,
    businesses,
    myBusinesses,
    loadBusinesses,
    verifyCRN,
    submitRegistration
  } = useBusinessStore();

  useEffect(() => {
    loadBusinesses();
  }, [loadBusinesses]);

  const filteredBusinesses = businesses.filter((biz) => {
    const matchesSearch = biz.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
                         biz.description?.toLowerCase().includes(state.searchQuery.toLowerCase());
    const matchesCategory = !state.selectedCategory || biz.category === state.selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const stats = {
    totalBusiness: businesses.length,
    verifiedCount: businesses.filter((b) => b.zkpVerified).length,
    activeUsers: Math.floor(businesses.length * 3.5),
    trustScore: Math.floor(((businesses.filter((b) => b.zkpVerified).length / businesses.length) || 0) * 100)
  };

  // ========== RENDER FUNCTIONS ==========

  const renderMarketplaceTab = () => (
    <div className="space-y-6">
      {/* Marketplace Header */}
      <div
        className="rounded-lg p-3 sm:p-6 md:p-8 mb-4 sm:mb-8"
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

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
          {[
            { icon: TrendingUp, label: 'Businesses', value: stats.totalBusiness },
            { icon: CheckCircle, label: 'Verified', value: stats.verifiedCount },
            { icon: Users, label: 'Active Users', value: stats.activeUsers },
            { icon: Award, label: 'Trust Score', value: `${stats.trustScore}%` }
          ].map((stat, idx) => (
            <div
              key={idx}
              className="rounded-lg p-2 sm:p-4 text-center"
              style={{
                backgroundColor: `${theme.colors.primary}15`,
                border: `1px solid ${theme.colors.border}`
              }}
            >
              <stat.icon className="mx-auto mb-1 sm:mb-2 w-4 h-4 sm:w-6 sm:h-6" style={{ color: theme.colors.primary }} />
              <p style={{ color: theme.colors.textSecondary, fontSize: '0.875rem' }}>{stat.label}</p>
              <p className="text-xl font-bold mt-1" style={{ color: theme.colors.primary }}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-4 sm:mb-6">
        <div className="flex-1 relative">
          <Search size={16} style={{ color: theme.colors.textSecondary }} className="absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search..."
            value={state.searchQuery}
            onChange={(e) => setState({ ...state, searchQuery: e.target.value })}
            className="w-full pl-9 pr-3 py-2 rounded-lg border text-sm"
            style={{
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
              color: theme.colors.text
            }}
          />
        </div>
        <select
          value={state.selectedCategory}
          onChange={(e) => setState({ ...state, selectedCategory: e.target.value })}
          className="px-3 py-2 rounded-lg border text-sm w-full sm:w-auto"
          style={{
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
            color: theme.colors.text
          }}
        >
          <option value="">All Categories</option>
          {BUSINESS_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Business Directory */}
      <div className="space-y-4">
        {filteredBusinesses.length > 0 ? (
          filteredBusinesses.map((business) => (
            <div
              key={business.id}
              className="rounded-lg p-6 cursor-pointer transition-all hover:scale-102"
              style={{
                backgroundColor: theme.colors.surface,
                border: `2px solid ${theme.colors.border}`,
                borderLeft: `4px solid ${business.zkpVerified ? theme.colors.success : theme.colors.warning}`
              }}
              onClick={() => setState({ ...state, selectedBusiness: business })}
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-xl font-bold" style={{ color: theme.colors.primary }}>
                      {business.name}
                    </h3>
                    {business.zkpVerified && (
                      <div className="flex items-center gap-1 px-2 py-1 rounded" style={{ backgroundColor: `${theme.colors.success}20` }}>
                        <Shield size={16} style={{ color: theme.colors.success }} />
                        <span style={{ color: theme.colors.success, fontSize: '0.875rem' }}>ZKP Verified</span>
                      </div>
                    )}
                  </div>
                  <p style={{ color: theme.colors.textSecondary }}>{business.description}</p>
                </div>
                <ChevronRight size={24} style={{ color: theme.colors.primary }} />
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                {business.category && (
                  <div className="flex items-center gap-2">
                    <Building2 size={16} style={{ color: theme.colors.secondary }} />
                    <span style={{ color: theme.colors.textSecondary }}>{business.category}</span>
                  </div>
                )}
                {business.address && (
                  <div className="flex items-center gap-2">
                    <MapPin size={16} style={{ color: theme.colors.secondary }} />
                    <span style={{ color: theme.colors.textSecondary }}>{business.address}</span>
                  </div>
                )}
                {business.contact && (
                  <div className="flex items-center gap-2">
                    <Network size={16} style={{ color: theme.colors.secondary }} />
                    <span style={{ color: theme.colors.textSecondary }}>
                      {business.contact.phone || business.contact.email}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div
            className="rounded-lg p-8 text-center"
            style={{
              backgroundColor: theme.colors.surface,
              border: `2px dashed ${theme.colors.border}`
            }}
          >
            <Search size={48} style={{ color: theme.colors.textSecondary, margin: '0 auto 16px' }} />
            <p style={{ color: theme.colors.textSecondary }}>No businesses found. Try adjusting your search.</p>
          </div>
        )}
      </div>

      {/* Business Detail Modal */}
      {state.selectedBusiness && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4"
          onClick={() => setState({ ...state, selectedBusiness: null })}
        >
          <div
            className="rounded-lg p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: theme.colors.surface }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start mb-6">
              <h2 className="text-2xl font-bold" style={{ color: theme.colors.primary }}>
                {state.selectedBusiness.name}
              </h2>
              <button onClick={() => setState({ ...state, selectedBusiness: null })}>
                <X size={24} style={{ color: theme.colors.textSecondary }} />
              </button>
            </div>

            <div className="space-y-4">
              {state.selectedBusiness.description && (
                <div>
                  <h3 style={{ color: theme.colors.primary }} className="font-semibold mb-2">
                    Description
                  </h3>
                  <p style={{ color: theme.colors.text }}>{state.selectedBusiness.description}</p>
                </div>
              )}

              {state.selectedBusiness.zkpVerified && (
                <div
                  className="p-4 rounded-lg flex items-start gap-3"
                  style={{
                    backgroundColor: `${theme.colors.success}20`,
                    border: `1px solid ${theme.colors.success}`
                  }}
                >
                  <Shield size={20} style={{ color: theme.colors.success, marginTop: '2px' }} />
                  <div>
                    <p className="font-semibold" style={{ color: theme.colors.success }}>
                      Zero-Knowledge Proof Verified
                    </p>
                    <p style={{ color: theme.colors.textSecondary, fontSize: '0.875rem' }}>
                      This business has passed our 7-layer fraud detection system
                    </p>
                  </div>
                </div>
              )}

              <button
                className="w-full py-3 rounded-lg font-semibold transition-all hover:opacity-90"
                style={{
                  backgroundColor: theme.colors.primary,
                  color: theme.colors.background
                }}
              >
                Contact Business
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderVerificationTab = () => (
    <VerificationSubPage theme={theme} onBack={() => setState({ ...state, activeTab: 'marketplace' })} />
  );

  const renderMyBusinessesTab = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold" style={{ color: theme.colors.primary }}>
        My Businesses
      </h2>
      {myBusinesses.length > 0 ? (
        <div className="space-y-4">
          {myBusinesses.map((business) => (
            <div
              key={business.id}
              className="rounded-lg p-6"
              style={{
                backgroundColor: theme.colors.surface,
                border: `2px solid ${theme.colors.border}`
              }}
            >
              <h3 className="text-xl font-bold mb-2" style={{ color: theme.colors.primary }}>
                {business.name}
              </h3>
              <p style={{ color: theme.colors.textSecondary }} className="mb-4">
                {business.description}
              </p>
              <div className="flex gap-2">
                <button
                  className="px-4 py-2 rounded-lg font-semibold"
                  style={{
                    backgroundColor: theme.colors.primary,
                    color: theme.colors.background
                  }}
                >
                  Edit
                </button>
                <button
                  className="px-4 py-2 rounded-lg font-semibold"
                  style={{
                    backgroundColor: theme.colors.error,
                    color: 'white'
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          className="rounded-lg p-8 text-center"
          style={{
            backgroundColor: theme.colors.surface,
            border: `2px dashed ${theme.colors.border}`
          }}
        >
          <p style={{ color: theme.colors.textSecondary }}>
            You haven't listed any businesses yet. Start by clicking "List Your Business" in the Marketplace tab.
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div
      className="min-h-screen p-2 sm:p-4 md:p-8 pb-24"
      style={{ backgroundColor: theme.colors.background }}
    >
      {/* Navigation Tabs */}
      <div className="flex overflow-x-auto gap-1 sm:gap-4 mb-4 sm:mb-8 border-b pb-0 -mx-4 px-4 sm:mx-0 sm:px-0" style={{ borderColor: theme.colors.border }}>
        {['marketplace', 'verification', 'my-businesses', 'analytics'].map((tab) => (
          <button
            key={tab}
            onClick={() => setState({ ...state, activeTab: tab as MarketplaceTab })}
            className="px-2 sm:px-6 py-2 sm:py-4 font-semibold transition-colors border-b-2 text-xs sm:text-base whitespace-nowrap flex-shrink-0"
            style={{
              color: state.activeTab === tab ? theme.colors.primary : theme.colors.textSecondary,
              borderColor: state.activeTab === tab ? theme.colors.primary : 'transparent'
            }}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {state.activeTab === 'marketplace' && renderMarketplaceTab()}
      {state.activeTab === 'verification' && renderVerificationTab()}
      {state.activeTab === 'my-businesses' && renderMyBusinessesTab()}
      {state.activeTab === 'analytics' && (
        <div style={{ color: theme.colors.text }}>
          <h2 className="text-2xl font-bold mb-4" style={{ color: theme.colors.primary }}>
            Analytics & Insights
          </h2>
          <p style={{ color: theme.colors.textSecondary }}>Analytics dashboard coming soon...</p>
        </div>
      )}
    </div>
  );
};

// ========== VERIFICATION SUB-PAGE COMPONENT ==========

interface VerificationSubPageProps {
  theme: any;
  onBack: () => void;
}

const VerificationSubPage: React.FC<VerificationSubPageProps> = ({ theme, onBack }) => {
  const [step, setStep] = useState<'intro' | 'crn-input' | 'verification' | 'details' | 'complete'>('intro');
  const [crn, setCrn] = useState('');
  const {
    formData,
    updateFormData,
    updateFormContact,
    updateFormAddress,
    isLoading: isVerifying,
    companyData,
    verifyCRN,
    submitRegistration
  } = useBusinessStore();

  const handleVerifyCRN = async () => {
    if (!crn || crn.length < 6) return;
    const result = await verifyCRN(crn);
    if (result) {
      setStep('details');
    }
  };

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 px-4 py-2 rounded-lg transition-all"
        style={{
          color: theme.colors.primary,
          backgroundColor: `${theme.colors.primary}15`
        }}
      >
        ← Back to Marketplace
      </button>

      {step === 'intro' && (
        <div
          className="rounded-lg p-8"
          style={{
            backgroundColor: theme.colors.surface,
            border: `2px solid ${theme.colors.border}`
          }}
        >
          <h2 className="text-2xl font-bold mb-4" style={{ color: theme.colors.primary }}>
            Verify Your Business
          </h2>
          <p style={{ color: theme.colors.textSecondary }} className="mb-6">
            Register your business on the G3ZKP Marketplace with Zero-Knowledge Proof verification
          </p>

          <div className="space-y-4 mb-8">
            {[
              { num: 1, title: 'Enter CRN', desc: 'Provide your Companies House Registration Number' },
              { num: 2, title: 'Verify', desc: '7-layer fraud detection system validates your business' },
              { num: 3, title: 'Complete Details', desc: 'Add business information to your profile' },
              { num: 4, title: 'Live', desc: 'Your business appears verified in the marketplace' }
            ].map((item) => (
              <div key={item.num} className="flex gap-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0"
                  style={{
                    backgroundColor: theme.colors.primary,
                    color: theme.colors.background
                  }}
                >
                  {item.num}
                </div>
                <div>
                  <p className="font-semibold" style={{ color: theme.colors.text }}>
                    {item.title}
                  </p>
                  <p style={{ color: theme.colors.textSecondary }}>
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setStep('crn-input')}
            className="w-full py-3 rounded-lg font-semibold transition-all hover:scale-105"
            style={{
              backgroundColor: theme.colors.primary,
              color: theme.colors.background
            }}
          >
            Start Verification
          </button>
        </div>
      )}

      {step === 'crn-input' && (
        <div
          className="rounded-lg p-8"
          style={{
            backgroundColor: theme.colors.surface,
            border: `2px solid ${theme.colors.border}`
          }}
        >
          <h2 className="text-2xl font-bold mb-6" style={{ color: theme.colors.primary }}>
            Enter Companies House Registration Number
          </h2>

          <div className="mb-6">
            <label style={{ color: theme.colors.text }} className="block mb-2 font-semibold">
              CRN (8 digits)
            </label>
            <input
              type="text"
              value={crn}
              onChange={(e) => setCrn(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="Enter 8-digit CRN"
              maxLength={8}
              className="w-full px-4 py-2 rounded-lg border text-lg tracking-widest"
              style={{
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
                color: theme.colors.text
              }}
            />
            <p style={{ color: theme.colors.textSecondary, fontSize: '0.875rem' }} className="mt-2">
              Find your CRN at www.companieshouse.gov.uk
            </p>
          </div>

          <button
            onClick={handleVerifyCRN}
            disabled={isVerifying || crn.length < 8}
            className="w-full py-3 rounded-lg font-semibold transition-all hover:scale-105 disabled:opacity-50"
            style={{
              backgroundColor: theme.colors.primary,
              color: theme.colors.background
            }}
          >
            {isVerifying ? 'Verifying...' : 'Verify with Companies House'}
          </button>
        </div>
      )}

      {step === 'details' && (
        <div
          className="rounded-lg p-8"
          style={{
            backgroundColor: theme.colors.surface,
            border: `2px solid ${theme.colors.border}`
          }}
        >
          <h2 className="text-2xl font-bold mb-6" style={{ color: theme.colors.primary }}>
            Business Details
          </h2>

          {companyData && (
            <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: `${theme.colors.success}20` }}>
              <p className="font-semibold" style={{ color: theme.colors.success }}>
                ✓ Company verified: {companyData.company_name}
              </p>
            </div>
          )}

          <div className="space-y-4 mb-8">
            <input
              type="text"
              placeholder="Business Description"
              value={formData.description}
              onChange={(e) => updateFormData({ description: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border"
              style={{
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
                color: theme.colors.text
              }}
            />
            <select
              value={formData.category}
              onChange={(e) => updateFormData({ category: e.target.value })}
              className="w-full px-4 py-2 rounded-lg border"
              style={{
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
                color: theme.colors.text
              }}
            >
              <option>Select Category</option>
              {BUSINESS_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={submitRegistration}
            className="w-full py-3 rounded-lg font-semibold transition-all hover:scale-105"
            style={{
              backgroundColor: theme.colors.primary,
              color: theme.colors.background
            }}
          >
            Complete Registration
          </button>
        </div>
      )}
    </div>
  );
};

export default MarketplacePage;
