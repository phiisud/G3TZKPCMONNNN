import React, { useState, useEffect } from 'react';
import { Building2, Check, X, Loader2, MapPin, Clock, Mail, Phone, Globe, ChevronRight, ChevronLeft, AlertCircle, CheckCircle } from 'lucide-react';
import { useBusinessStore } from '../../stores/businessStore';
import { BUSINESS_CATEGORIES } from '../../types/business';

const DAYS = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' }
];

export const BusinessRegistrationForm: React.FC = () => {
  const {
    formData,
    registrationStep,
    isLoading,
    error,
    companyData,
    verificationResult,
    updateFormData,
    updateFormAddress,
    updateFormContact,
    updateFormHours,
    setRegistrationStep,
    verifyCRN,
    submitRegistration,
    setShowRegistrationModal
  } = useBusinessStore();

  const [localCRN, setLocalCRN] = useState(formData.crn);

  const handleCRNVerification = async () => {
    if (!localCRN.trim()) return;
    await verifyCRN(localCRN.trim());
  };

  const handleSubmit = async () => {
    const result = await submitRegistration();
    if (result.success) {
      console.log('[BusinessRegistration] Successfully registered business');
    }
  };

  const canProceedToStep3 = 
    formData.description.trim().length > 0 &&
    formData.category.length > 0 &&
    formData.contact.email.trim().length > 0;

  const canSubmit = 
    canProceedToStep3 &&
    formData.latitude !== 0 &&
    formData.longitude !== 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-[#010401] border border-[#4caf50] rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-[#4caf50]/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="w-6 h-6 text-[#00f3ff]" />
              <h2 className="text-xl font-bold text-[#00f3ff]">Register Business on G3ZKP Network</h2>
            </div>
            <button 
              onClick={() => setShowRegistrationModal(false)}
              className="text-[#4caf50] hover:text-[#00f3ff] transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="flex gap-2 mt-4">
            {[1, 2, 3].map((step) => (
              <div 
                key={step}
                className={`flex-1 h-1 rounded ${
                  step <= registrationStep ? 'bg-[#00f3ff]' : 'bg-[#4caf50]/30'
                }`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs text-[#4caf50]">
            <span>Verify CRN</span>
            <span>Business Details</span>
            <span>Location & Hours</span>
          </div>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <span className="text-red-400 text-sm">{error}</span>
            </div>
          )}

          {verificationResult?.success && (
            <div className="mb-4 p-3 bg-green-500/20 border border-green-500/50 rounded flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span className="text-green-400 text-sm">Business successfully registered on the P2P network!</span>
            </div>
          )}

          {registrationStep === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-[#00f3ff] text-sm mb-2">
                  Companies House Registration Number (CRN)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={localCRN}
                    onChange={(e) => setLocalCRN(e.target.value.toUpperCase())}
                    placeholder="e.g., 12345678 or SC123456"
                    className="flex-1 bg-black/50 border border-[#4caf50]/50 rounded px-4 py-3 text-white placeholder-gray-500 focus:border-[#00f3ff] focus:outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && handleCRNVerification()}
                  />
                  <button
                    onClick={handleCRNVerification}
                    disabled={isLoading || !localCRN.trim()}
                    className="px-6 py-3 bg-[#00f3ff]/20 border border-[#00f3ff] rounded text-[#00f3ff] hover:bg-[#00f3ff]/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        Verify
                      </>
                    )}
                  </button>
                </div>
                <p className="text-gray-500 text-xs mt-2">
                  Enter your UK company registration number to verify your business
                </p>
              </div>

              {companyData && (
                <div className="p-4 bg-[#00f3ff]/10 border border-[#00f3ff]/30 rounded">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-5 h-5 text-[#00f3ff]" />
                    <span className="text-[#00f3ff] font-medium">Company Verified</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Company Name:</span>
                      <span className="text-white">{companyData.company_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Status:</span>
                      <span className={companyData.status === 'active' ? 'text-green-400' : 'text-yellow-400'}>
                        {companyData.status?.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Address:</span>
                      <span className="text-white text-right">
                        {companyData.address?.address_line_1}, {companyData.address?.locality}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {registrationStep === 2 && (
            <div className="space-y-4">
              <div className="p-3 bg-[#00f3ff]/10 border border-[#00f3ff]/30 rounded mb-4">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-[#00f3ff]" />
                  <span className="text-[#00f3ff] font-medium">{formData.name}</span>
                </div>
                <span className="text-gray-400 text-sm">CRN: {formData.crn}</span>
              </div>

              <div>
                <label className="block text-[#00f3ff] text-sm mb-2">Business Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => updateFormData({ description: e.target.value })}
                  placeholder="Describe your business..."
                  rows={3}
                  className="w-full bg-black/50 border border-[#4caf50]/50 rounded px-4 py-3 text-white placeholder-gray-500 focus:border-[#00f3ff] focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block text-[#00f3ff] text-sm mb-2">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => updateFormData({ category: e.target.value })}
                  className="w-full bg-black/50 border border-[#4caf50]/50 rounded px-4 py-3 text-white focus:border-[#00f3ff] focus:outline-none"
                >
                  <option value="">Select a category...</option>
                  {BUSINESS_CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#00f3ff] text-sm mb-2 flex items-center gap-2">
                    <Mail className="w-4 h-4" /> Email
                  </label>
                  <input
                    type="email"
                    value={formData.contact.email}
                    onChange={(e) => updateFormContact({ email: e.target.value })}
                    placeholder="contact@business.com"
                    className="w-full bg-black/50 border border-[#4caf50]/50 rounded px-4 py-3 text-white placeholder-gray-500 focus:border-[#00f3ff] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[#00f3ff] text-sm mb-2 flex items-center gap-2">
                    <Phone className="w-4 h-4" /> Phone (optional)
                  </label>
                  <input
                    type="tel"
                    value={formData.contact.phone}
                    onChange={(e) => updateFormContact({ phone: e.target.value })}
                    placeholder="+44 20 1234 5678"
                    className="w-full bg-black/50 border border-[#4caf50]/50 rounded px-4 py-3 text-white placeholder-gray-500 focus:border-[#00f3ff] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#00f3ff] text-sm mb-2 flex items-center gap-2">
                  <Globe className="w-4 h-4" /> Website (optional)
                </label>
                <input
                  type="url"
                  value={formData.contact.website}
                  onChange={(e) => updateFormContact({ website: e.target.value })}
                  placeholder="https://www.example.com"
                  className="w-full bg-black/50 border border-[#4caf50]/50 rounded px-4 py-3 text-white placeholder-gray-500 focus:border-[#00f3ff] focus:outline-none"
                />
              </div>
            </div>
          )}

          {registrationStep === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-[#00f3ff] text-sm mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4" /> Location Coordinates
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-gray-400 text-xs">Latitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={formData.latitude}
                      onChange={(e) => updateFormData({ latitude: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-black/50 border border-[#4caf50]/50 rounded px-4 py-2 text-white focus:border-[#00f3ff] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-gray-400 text-xs">Longitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={formData.longitude}
                      onChange={(e) => updateFormData({ longitude: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-black/50 border border-[#4caf50]/50 rounded px-4 py-2 text-white focus:border-[#00f3ff] focus:outline-none"
                    />
                  </div>
                </div>
                <p className="text-gray-500 text-xs mt-1">
                  Click on the map or use current location to set coordinates
                </p>
              </div>

              <div>
                <label className="block text-[#00f3ff] text-sm mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4" /> Business Hours
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {DAYS.map(({ key, label }) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-gray-400 text-sm w-24">{label}</span>
                      <input
                        type="time"
                        value={formData.hours[key as keyof typeof formData.hours]?.open || ''}
                        onChange={(e) => updateFormHours(key, { 
                          ...formData.hours[key as keyof typeof formData.hours],
                          open: e.target.value 
                        })}
                        className="bg-black/50 border border-[#4caf50]/50 rounded px-2 py-1 text-white text-sm focus:border-[#00f3ff] focus:outline-none"
                      />
                      <span className="text-gray-500">to</span>
                      <input
                        type="time"
                        value={formData.hours[key as keyof typeof formData.hours]?.close || ''}
                        onChange={(e) => updateFormHours(key, { 
                          ...formData.hours[key as keyof typeof formData.hours],
                          close: e.target.value 
                        })}
                        className="bg-black/50 border border-[#4caf50]/50 rounded px-2 py-1 text-white text-sm focus:border-[#00f3ff] focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-[#4caf50]/30 flex justify-between">
          {registrationStep > 1 ? (
            <button
              onClick={() => setRegistrationStep(registrationStep - 1)}
              className="px-6 py-2 border border-[#4caf50] rounded text-[#4caf50] hover:bg-[#4caf50]/20 transition-colors flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
          ) : (
            <div />
          )}

          {registrationStep < 3 ? (
            <button
              onClick={() => setRegistrationStep(registrationStep + 1)}
              disabled={registrationStep === 1 ? !companyData : !canProceedToStep3}
              className="px-6 py-2 bg-[#00f3ff]/20 border border-[#00f3ff] rounded text-[#00f3ff] hover:bg-[#00f3ff]/30 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isLoading || !canSubmit}
              className="px-6 py-2 bg-[#00f3ff] rounded text-black font-medium hover:bg-[#00f3ff]/80 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Register on P2P Network
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BusinessRegistrationForm;
