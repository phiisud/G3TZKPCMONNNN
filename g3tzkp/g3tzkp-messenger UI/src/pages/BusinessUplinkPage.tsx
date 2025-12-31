import React, { useState, useEffect } from 'react';
import { Briefcase, Shield, CheckCircle, MapPin, Clock, Search, Building2, CreditCard, Network, AlertCircle, ChevronRight, X } from 'lucide-react';
import { useBusinessStore } from '../stores/businessStore';
import { G3TZKPBusinessProfile, BUSINESS_CATEGORIES } from '../types/business';

const NETWORK_FEE_GBP = 10;

const BusinessUplinkPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'register' | 'directory' | 'my-business'>('register');
  const [selectedBusiness, setSelectedBusiness] = useState<G3TZKPBusinessProfile | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  
  const { 
    formData,
    updateFormData,
    updateFormContact,
    updateFormAddress,
    isLoading: isVerifying,
    companyData,
    registrationStep,
    setRegistrationStep,
    resetFormData,
    verifyCRN,
    submitRegistration,
    businesses,
    myBusinesses,
    loadBusinesses,
    deleteBusiness
  } = useBusinessStore();

  const registrationForm = {
    crn: formData.crn,
    businessName: formData.name,
    description: formData.description,
    category: formData.category,
    address: formData.address.line1,
    postcode: formData.address.postcode,
    phone: formData.contact.phone,
    email: formData.contact.email,
    website: formData.contact.website,
    latitude: formData.latitude,
    longitude: formData.longitude,
    openingHours: formData.hours
  };

  const setRegistrationField = (field: string, value: any) => {
    switch (field) {
      case 'crn':
        updateFormData({ crn: value });
        break;
      case 'businessName':
        updateFormData({ name: value });
        break;
      case 'description':
        updateFormData({ description: value });
        break;
      case 'category':
        updateFormData({ category: value });
        break;
      case 'address':
        updateFormAddress({ line1: value });
        break;
      case 'postcode':
        updateFormAddress({ postcode: value });
        break;
      case 'phone':
        updateFormContact({ phone: value });
        break;
      case 'email':
        updateFormContact({ email: value });
        break;
      case 'website':
        updateFormContact({ website: value });
        break;
      case 'latitude':
        updateFormData({ latitude: value });
        break;
      case 'longitude':
        updateFormData({ longitude: value });
        break;
      default:
        break;
    }
  };

  useEffect(() => {
    loadBusinesses();
  }, [loadBusinesses]);

  const handleVerifyCRN = async () => {
    if (!registrationForm.crn || registrationForm.crn.length < 6) return;
    
    const result = await verifyCRN(registrationForm.crn);
    if (!result) {
      alert('Company verification failed. Please check your CRN.');
    }
  };

  const handleRegisterBusiness = async () => {
    if (!companyData) return;
    
    const result = await submitRegistration();
    if (result.success) {
      setActiveTab('my-business');
      alert('Business registered successfully on the G3ZKP network!');
    } else {
      alert(result.error || 'Failed to register business');
    }
  };

  const filteredBusinesses = businesses.filter(b => {
    const matchesSearch = !searchQuery || 
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || b.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--color-background,#000000)]">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 md:py-6 pb-24 lg:pb-6">
        <header className="mb-4 md:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl text-[var(--color-primary,#00f3ff)] font-mono mb-1 flex items-center gap-2">
                <Briefcase size={20} className="sm:w-6 sm:h-6" />
                <span className="tracking-wider">BUSINESS_UPLINK</span>
              </h1>
              <p className="text-[var(--color-textSecondary,#4caf50)]/70 text-xs sm:text-sm font-mono">
                Verified P2P business network with Companies House validation
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-2 py-1 bg-[var(--color-success,#4caf50)]/10 border border-[var(--color-success,#4caf50)]/30 rounded text-[var(--color-success,#4caf50)] text-[10px] sm:text-xs font-mono flex items-center gap-1">
                <Network size={12} />
                <span className="hidden sm:inline">P2P_NETWORK</span>
                <span className="sm:hidden">P2P</span>
              </div>
            </div>
          </div>
        </header>

        <div className="bg-[var(--color-primary,#00f3ff)]/5 backdrop-blur-xl border border-[var(--color-primary,#00f3ff)]/30 rounded-xl p-3 sm:p-4 mb-4 md:mb-6 shadow-[0_4px_20px_rgba(0,243,255,0.1)]">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--color-primary,#00f3ff)]/10 border border-[var(--color-primary,#00f3ff)]/30 flex items-center justify-center">
                <CreditCard size={18} className="text-[var(--color-primary,#00f3ff)]" />
              </div>
              <div>
                <span className="text-[var(--color-primary,#00f3ff)] font-mono text-sm font-bold">NETWORK_FEE: £{NETWORK_FEE_GBP}</span>
                <p className="text-[var(--color-textSecondary,#4caf50)]/60 text-xs font-mono">One-time fee to join the verified business network</p>
              </div>
            </div>
            <div className="text-[var(--color-textSecondary,#4caf50)]/60 text-xs font-mono flex items-center gap-1.5 bg-black/30 px-3 py-1.5 rounded-lg border border-white/10">
              <Shield size={12} className="text-[var(--color-success,#4caf50)]" />
              Cryptographically signed verification
            </div>
          </div>
        </div>

        <div className="flex gap-2 mb-4 md:mb-6 overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0">
          {[
            { id: 'register' as const, label: 'REGISTER', icon: Building2 },
            { id: 'directory' as const, label: 'DIRECTORY', icon: Search, count: businesses.length },
            { id: 'my-business' as const, label: 'MY BUSINESS', icon: Briefcase, count: myBusinesses.length }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 border font-mono text-xs sm:text-sm whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-[var(--color-primary,#00f3ff)]/10 border-[var(--color-primary,#00f3ff)] text-[var(--color-primary,#00f3ff)]'
                  : 'border-[var(--color-border,#4caf50)]/30 text-[var(--color-textSecondary,#4caf50)]/60 hover:border-[var(--color-border,#4caf50)]/60'
              }`}
            >
              <tab.icon size={14} />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-[var(--color-primary,#00f3ff)] text-[var(--color-background,#000000)] text-[10px] font-bold rounded">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab === 'register' && (
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                {[1, 2, 3].map(step => (
                  <React.Fragment key={step}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-mono text-sm ${
                      registrationStep >= step
                        ? 'bg-[var(--color-primary,#00f3ff)] text-[var(--color-background,#000000)]'
                        : 'bg-[var(--color-surface,#010401)] border border-[var(--color-border,#4caf50)]/30 text-[var(--color-textSecondary,#4caf50)]/50'
                    }`}>
                      {registrationStep > step ? <CheckCircle size={16} /> : step}
                    </div>
                    {step < 3 && (
                      <div className={`w-8 sm:w-12 h-0.5 ${
                        registrationStep > step
                          ? 'bg-[var(--color-primary,#00f3ff)]'
                          : 'bg-[var(--color-border,#4caf50)]/30'
                      }`} />
                    )}
                  </React.Fragment>
                ))}
              </div>
              {registrationStep > 1 && (
                <button
                  onClick={resetFormData}
                  className="text-[var(--color-textSecondary,#4caf50)]/50 hover:text-[var(--color-error,#ff0055)] text-xs font-mono"
                >
                  Reset
                </button>
              )}
            </div>

            {registrationStep === 1 && (
              <div className="bg-[var(--color-surface,#010401)] border border-[var(--color-border,#4caf50)]/30 rounded-lg p-4 sm:p-6">
                <h3 className="text-[var(--color-primary,#00f3ff)] font-mono text-lg mb-4 flex items-center gap-2">
                  <Shield size={18} />
                  STEP 1: VERIFY_COMPANY
                </h3>
                <p className="text-[var(--color-textSecondary,#4caf50)]/70 text-sm font-mono mb-6">
                  Enter your UK Companies House Registration Number (CRN) to verify your business.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="text-[var(--color-textSecondary,#4caf50)]/70 text-xs font-mono mb-1 block">
                      COMPANY_REGISTRATION_NUMBER (CRN)
                    </label>
                    <input
                      type="text"
                      value={registrationForm.crn}
                      onChange={(e) => setRegistrationField('crn', e.target.value.toUpperCase())}
                      placeholder="e.g., 12345678 or SC123456"
                      className="w-full bg-[var(--color-background,#000000)] border border-[var(--color-border,#4caf50)]/30 text-[var(--color-text,#00f3ff)] px-4 py-3 text-sm font-mono rounded placeholder:text-[var(--color-textSecondary,#4caf50)]/30"
                      maxLength={10}
                    />
                    <p className="text-[var(--color-textSecondary,#4caf50)]/50 text-xs font-mono mt-1">
                      UK format: 8 digits or 2 letters + 6 digits
                    </p>
                  </div>
                  <button
                    onClick={handleVerifyCRN}
                    disabled={isVerifying || !registrationForm.crn || registrationForm.crn.length < 6}
                    className="w-full py-3 bg-[var(--color-primary,#00f3ff)]/10 border border-[var(--color-primary,#00f3ff)] text-[var(--color-primary,#00f3ff)] font-mono text-sm hover:bg-[var(--color-primary,#00f3ff)]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isVerifying ? (
                      <>
                        <div className="w-4 h-4 border-2 border-[var(--color-primary,#00f3ff)] border-t-transparent rounded-full animate-spin" />
                        VERIFYING...
                      </>
                    ) : (
                      <>
                        <CheckCircle size={16} />
                        VERIFY_WITH_COMPANIES_HOUSE
                      </>
                    )}
                  </button>
                </div>

                <div className="mt-6 p-3 bg-[var(--color-background,#000000)]/50 rounded border border-[var(--color-border,#4caf50)]/20">
                  <p className="text-[var(--color-textSecondary,#4caf50)]/50 text-xs font-mono flex items-start gap-2">
                    <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                    Test CRNs for development: 00000001, 12345678
                  </p>
                </div>
              </div>
            )}

            {registrationStep === 2 && companyData && (
              <div className="bg-[var(--color-surface,#010401)] border border-[var(--color-border,#4caf50)]/30 rounded-lg p-4 sm:p-6">
                <h3 className="text-[var(--color-primary,#00f3ff)] font-mono text-lg mb-4 flex items-center gap-2">
                  <Building2 size={18} />
                  STEP 2: BUSINESS_DETAILS
                </h3>

                <div className="mb-6 p-3 bg-[var(--color-success,#4caf50)]/10 border border-[var(--color-success,#4caf50)]/30 rounded">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle size={16} className="text-[var(--color-success,#4caf50)]" />
                    <span className="text-[var(--color-success,#4caf50)] font-mono text-sm font-bold">COMPANY_VERIFIED</span>
                  </div>
                  <p className="text-[var(--color-text,#00f3ff)] font-mono text-sm">{companyData.company_name}</p>
                  <p className="text-[var(--color-textSecondary,#4caf50)]/70 text-xs font-mono">CRN: {registrationForm.crn}</p>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[var(--color-textSecondary,#4caf50)]/70 text-xs font-mono mb-1 block">CATEGORY</label>
                      <select
                        value={registrationForm.category}
                        onChange={(e) => setRegistrationField('category', e.target.value)}
                        className="w-full bg-[var(--color-background,#000000)] border border-[var(--color-border,#4caf50)]/30 text-[var(--color-text,#00f3ff)] px-3 py-2.5 text-sm font-mono rounded"
                      >
                        <option value="">Select category...</option>
                        {BUSINESS_CATEGORIES.map(cat => (
                          <option key={cat.value} value={cat.value}>{cat.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[var(--color-textSecondary,#4caf50)]/70 text-xs font-mono mb-1 block">PHONE</label>
                      <input
                        type="tel"
                        value={registrationForm.phone}
                        onChange={(e) => setRegistrationField('phone', e.target.value)}
                        placeholder="+44 1234 567890"
                        className="w-full bg-[var(--color-background,#000000)] border border-[var(--color-border,#4caf50)]/30 text-[var(--color-text,#00f3ff)] px-3 py-2.5 text-sm font-mono rounded placeholder:text-[var(--color-textSecondary,#4caf50)]/30"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[var(--color-textSecondary,#4caf50)]/70 text-xs font-mono mb-1 block">EMAIL</label>
                    <input
                      type="email"
                      value={registrationForm.email}
                      onChange={(e) => setRegistrationField('email', e.target.value)}
                      placeholder="contact@business.com"
                      className="w-full bg-[var(--color-background,#000000)] border border-[var(--color-border,#4caf50)]/30 text-[var(--color-text,#00f3ff)] px-3 py-2.5 text-sm font-mono rounded placeholder:text-[var(--color-textSecondary,#4caf50)]/30"
                    />
                  </div>

                  <div>
                    <label className="text-[var(--color-textSecondary,#4caf50)]/70 text-xs font-mono mb-1 block">WEBSITE</label>
                    <input
                      type="url"
                      value={registrationForm.website}
                      onChange={(e) => setRegistrationField('website', e.target.value)}
                      placeholder="https://www.business.com"
                      className="w-full bg-[var(--color-background,#000000)] border border-[var(--color-border,#4caf50)]/30 text-[var(--color-text,#00f3ff)] px-3 py-2.5 text-sm font-mono rounded placeholder:text-[var(--color-textSecondary,#4caf50)]/30"
                    />
                  </div>

                  <div>
                    <label className="text-[var(--color-textSecondary,#4caf50)]/70 text-xs font-mono mb-1 block">DESCRIPTION</label>
                    <textarea
                      value={registrationForm.description}
                      onChange={(e) => setRegistrationField('description', e.target.value)}
                      placeholder="Describe your business services..."
                      rows={3}
                      className="w-full bg-[var(--color-background,#000000)] border border-[var(--color-border,#4caf50)]/30 text-[var(--color-text,#00f3ff)] px-3 py-2.5 text-sm font-mono rounded placeholder:text-[var(--color-textSecondary,#4caf50)]/30 resize-none"
                    />
                  </div>

                  <button
                    onClick={() => setRegistrationStep(3)}
                    disabled={!registrationForm.category}
                    className="w-full py-3 bg-[var(--color-primary,#00f3ff)]/10 border border-[var(--color-primary,#00f3ff)] text-[var(--color-primary,#00f3ff)] font-mono text-sm hover:bg-[var(--color-primary,#00f3ff)]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <ChevronRight size={16} />
                    CONTINUE_TO_PAYMENT
                  </button>
                </div>
              </div>
            )}

            {registrationStep === 3 && (
              <div className="bg-[var(--color-surface,#010401)] border border-[var(--color-border,#4caf50)]/30 rounded-lg p-4 sm:p-6">
                <h3 className="text-[var(--color-primary,#00f3ff)] font-mono text-lg mb-4 flex items-center gap-2">
                  <CreditCard size={18} />
                  STEP 3: NETWORK_FEE
                </h3>

                <div className="mb-6 p-4 bg-[var(--color-warning,#ffaa00)]/10 border border-[var(--color-warning,#ffaa00)]/30 rounded">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[var(--color-warning,#ffaa00)] font-mono text-lg font-bold">£{NETWORK_FEE_GBP}.00</span>
                    <span className="text-[var(--color-textSecondary,#4caf50)]/50 text-xs font-mono">ONE-TIME FEE</span>
                  </div>
                  <ul className="space-y-2 text-[var(--color-textSecondary,#4caf50)]/70 text-xs font-mono">
                    <li className="flex items-center gap-2">
                      <CheckCircle size={12} className="text-[var(--color-success,#4caf50)]" />
                      Cryptographic verification and signing
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle size={12} className="text-[var(--color-success,#4caf50)]" />
                      P2P network broadcast to all nodes
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle size={12} className="text-[var(--color-success,#4caf50)]" />
                      Secure IndexedDB storage
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle size={12} className="text-[var(--color-success,#4caf50)]" />
                      Verified business badge
                    </li>
                  </ul>
                </div>

                <div className="mb-6 p-3 bg-[var(--color-background,#000000)]/50 rounded border border-[var(--color-border,#4caf50)]/20">
                  <h4 className="text-[var(--color-text,#00f3ff)] font-mono text-sm mb-2">Registration Summary</h4>
                  <div className="space-y-1 text-[var(--color-textSecondary,#4caf50)]/70 text-xs font-mono">
                    <p>Business: {registrationForm.businessName}</p>
                    <p>CRN: {registrationForm.crn}</p>
                    <p>Category: {BUSINESS_CATEGORIES.find(c => c.id === registrationForm.category)?.name || registrationForm.category}</p>
                  </div>
                </div>

                <button
                  onClick={handleRegisterBusiness}
                  disabled={isVerifying}
                  className="w-full py-3 bg-[var(--color-success,#4caf50)]/10 border border-[var(--color-success,#4caf50)] text-[var(--color-success,#4caf50)] font-mono text-sm hover:bg-[var(--color-success,#4caf50)]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isVerifying ? (
                    <>
                      <div className="w-4 h-4 border-2 border-[var(--color-success,#4caf50)] border-t-transparent rounded-full animate-spin" />
                      REGISTERING...
                    </>
                  ) : (
                    <>
                      <Network size={16} />
                      COMPLETE_REGISTRATION (£{NETWORK_FEE_GBP})
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'directory' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-textSecondary,#4caf50)]/50" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search businesses..."
                  className="w-full bg-[var(--color-background,#000000)] border border-[var(--color-border,#4caf50)]/30 text-[var(--color-text,#00f3ff)] pl-10 pr-4 py-2.5 text-sm font-mono rounded placeholder:text-[var(--color-textSecondary,#4caf50)]/30"
                />
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-[var(--color-background,#000000)] border border-[var(--color-border,#4caf50)]/30 text-[var(--color-text,#00f3ff)] px-3 py-2.5 text-sm font-mono rounded"
              >
                <option value="">All categories</option>
                {BUSINESS_CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            {filteredBusinesses.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredBusinesses.map(business => (
                  <div 
                    key={business.id}
                    onClick={() => setSelectedBusiness(business)}
                    className="bg-[var(--color-surface,#010401)] border border-[var(--color-border,#4caf50)]/30 rounded-lg p-4 cursor-pointer hover:border-[var(--color-primary,#00f3ff)]/50 transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="text-[var(--color-primary,#00f3ff)] font-mono font-bold text-sm">{business.name}</h4>
                        <p className="text-[var(--color-textSecondary,#4caf50)]/70 text-xs font-mono">{business.category}</p>
                      </div>
                      {business.verification_hash && (
                        <CheckCircle size={16} className="text-[var(--color-success,#4caf50)]" />
                      )}
                    </div>
                    {business.description && (
                      <p className="text-[var(--color-textSecondary,#4caf50)]/50 text-xs font-mono line-clamp-2 mb-3">
                        {business.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-[var(--color-textSecondary,#4caf50)]/50 text-xs font-mono">
                      <MapPin size={12} />
                      <span className="truncate">{business.location.address.line1}, {business.location.address.postcode}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Building2 size={48} className="mx-auto text-[var(--color-textSecondary,#4caf50)]/30 mb-4" />
                <p className="text-[var(--color-textSecondary,#4caf50)]/50 font-mono">No businesses found</p>
                <p className="text-[var(--color-textSecondary,#4caf50)]/30 font-mono text-sm mt-2">Be the first to register!</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'my-business' && (
          <div className="space-y-4">
            {myBusinesses.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myBusinesses.map(business => (
                  <div 
                    key={business.id}
                    className="bg-[var(--color-surface,#010401)] border border-[var(--color-primary,#00f3ff)]/30 rounded-lg p-4 sm:p-6"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-[var(--color-primary,#00f3ff)] font-mono font-bold">{business.name}</h4>
                          {business.verification_hash && (
                            <span className="px-2 py-0.5 bg-[var(--color-success,#4caf50)]/10 border border-[var(--color-success,#4caf50)]/30 text-[var(--color-success,#4caf50)] text-[10px] font-mono">VERIFIED</span>
                          )}
                        </div>
                        <p className="text-[var(--color-textSecondary,#4caf50)]/70 text-xs font-mono">CRN: {business.crn}</p>
                      </div>
                    </div>
                    <div className="space-y-2 text-xs font-mono">
                      <div className="flex items-center gap-2 text-[var(--color-textSecondary,#4caf50)]/70">
                        <MapPin size={12} />
                        <span>{business.location.address.line1}, {business.location.address.postcode}</span>
                      </div>
                      {business.contact?.phone && (
                        <div className="flex items-center gap-2 text-[var(--color-textSecondary,#4caf50)]/70">
                          <span>Phone: {business.contact.phone}</span>
                        </div>
                      )}
                      {business.contact?.email && (
                        <div className="flex items-center gap-2 text-[var(--color-textSecondary,#4caf50)]/70">
                          <span>Email: {business.contact.email}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-[var(--color-textSecondary,#4caf50)]/50">
                        <Clock size={12} />
                        <span>Registered: {new Date(business.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Briefcase size={48} className="mx-auto text-[var(--color-textSecondary,#4caf50)]/30 mb-4" />
                <p className="text-[var(--color-textSecondary,#4caf50)]/50 font-mono">No registered businesses</p>
                <button
                  onClick={() => setActiveTab('register')}
                  className="mt-4 px-6 py-2 bg-[var(--color-primary,#00f3ff)]/10 border border-[var(--color-primary,#00f3ff)] text-[var(--color-primary,#00f3ff)] font-mono text-sm hover:bg-[var(--color-primary,#00f3ff)]/20 transition-all"
                >
                  Register Your Business
                </button>
              </div>
            )}
          </div>
        )}

        {selectedBusiness && (
          <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
            <div className="bg-[var(--color-surface,#010401)] border border-[var(--color-border,#4caf50)]/30 rounded-lg w-full max-w-lg max-h-[90vh] overflow-y-auto">
              <div className="p-4 border-b border-[var(--color-border,#4caf50)]/30 flex items-center justify-between">
                <h3 className="text-[var(--color-primary,#00f3ff)] font-mono font-bold">{selectedBusiness.name}</h3>
                <button onClick={() => setSelectedBusiness(null)} className="text-[var(--color-textSecondary,#4caf50)]/50 hover:text-[var(--color-text,#00f3ff)]">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                  {selectedBusiness.verification_hash && (
                    <span className="px-2 py-1 bg-[var(--color-success,#4caf50)]/10 border border-[var(--color-success,#4caf50)]/30 text-[var(--color-success,#4caf50)] text-xs font-mono flex items-center gap-1">
                      <CheckCircle size={12} />
                      VERIFIED
                    </span>
                  )}
                  <span className="px-2 py-1 bg-[var(--color-primary,#00f3ff)]/10 border border-[var(--color-primary,#00f3ff)]/30 text-[var(--color-primary,#00f3ff)] text-xs font-mono">
                    {selectedBusiness.category}
                  </span>
                </div>
                {selectedBusiness.description && (
                  <p className="text-[var(--color-textSecondary,#4caf50)]/70 text-sm font-mono">{selectedBusiness.description}</p>
                )}
                <div className="space-y-2 text-sm font-mono">
                  <div className="flex items-start gap-2 text-[var(--color-textSecondary,#4caf50)]/70">
                    <MapPin size={14} className="flex-shrink-0 mt-0.5" />
                    <span>{selectedBusiness.location.address.line1}, {selectedBusiness.location.address.postcode}</span>
                  </div>
                  {selectedBusiness.contact?.phone && (
                    <p className="text-[var(--color-textSecondary,#4caf50)]/70">Phone: {selectedBusiness.contact.phone}</p>
                  )}
                  {selectedBusiness.contact?.email && (
                    <p className="text-[var(--color-textSecondary,#4caf50)]/70">Email: {selectedBusiness.contact.email}</p>
                  )}
                  {selectedBusiness.contact?.website && (
                    <a 
                      href={selectedBusiness.contact.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-[var(--color-primary,#00f3ff)] hover:underline block"
                    >
                      {selectedBusiness.contact.website}
                    </a>
                  )}
                </div>
                <div className="pt-4 border-t border-[var(--color-border,#4caf50)]/30 text-[var(--color-textSecondary,#4caf50)]/50 text-xs font-mono">
                  <p>CRN: {selectedBusiness.crn}</p>
                  <p>Verification Hash: {selectedBusiness.verification_hash?.slice(0, 16)}...</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BusinessUplinkPage;
