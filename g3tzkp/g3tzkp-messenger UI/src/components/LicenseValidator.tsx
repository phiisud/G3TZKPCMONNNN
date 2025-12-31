import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle, XCircle, AlertTriangle, Zap } from 'lucide-react';
import { zkpService } from '../services/ZKPService';

interface LicenseValidationResult {
  isValid: boolean;
  licenseType: 'trial' | 'professional' | 'business' | 'enterprise';
  expiresAt: number;
  features: string[];
  restrictions: string[];
  zkpProof: any;
  error?: string;
}

interface LicenseValidatorProps {
  onValidationComplete: (result: LicenseValidationResult) => void;
  showUI?: boolean;
}

const LicenseValidator: React.FC<LicenseValidatorProps> = ({
  onValidationComplete,
  showUI = true
}) => {
  const [validationResult, setValidationResult] = useState<LicenseValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(true);
  const [validationStep, setValidationStep] = useState('Initializing ZKP engine...');

  useEffect(() => {
    validateLicense();
  }, []);

  const validateLicense = async () => {
    try {
      setValidationStep('Loading ZKP circuits...');
      await zkpService.initialize();

      setValidationStep('Generating license proof...');

      // Generate license validation proof
      const licenseData = {
        licenseeId: localStorage.getItem('g3zkp_licensee_id') || 'anonymous',
        timestamp: Date.now(),
        systemFingerprint: await generateSystemFingerprint(),
        licenseKey: localStorage.getItem('g3zkp_license_key') || 'trial'
      };

      // Create ZKP proof for license validation
      const proof = await zkpService.generateProof('MessageSendProof', {
        messageHash: await hashLicenseData(licenseData),
        senderPublicKey: 'license_validator_key',
        recipientPublicKey: 'g3zkp_system_key',
        timestamp: licenseData.timestamp,
        minTimestamp: 0,
        maxTimestamp: Date.now() + (365 * 24 * 60 * 60 * 1000) // 1 year
      });

      setValidationStep('Verifying license proof...');

      // Verify the proof
      const isValid = await zkpService.verifyProof(proof.id);

      setValidationStep('Checking license terms...');

      // Determine license type and features
      const licenseType = determineLicenseType(licenseData.licenseKey);
      const features = getLicenseFeatures(licenseType);
      const restrictions = getLicenseRestrictions(licenseType);

      // Calculate expiration
      const expiresAt = calculateExpiration(licenseType, licenseData.timestamp);

      const result: LicenseValidationResult = {
        isValid,
        licenseType,
        expiresAt,
        features,
        restrictions,
        zkpProof: proof
      };

      setValidationResult(result);
      setIsValidating(false);
      onValidationComplete(result);

      // Store validation result
      localStorage.setItem('g3zkp_license_validated', JSON.stringify({
        ...result,
        validatedAt: Date.now()
      }));

    } catch (error) {
      console.error('License validation failed:', error);

      const errorResult: LicenseValidationResult = {
        isValid: false,
        licenseType: 'trial',
        expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 hours trial
        features: ['basic_messaging', 'trial_navigation'],
        restrictions: ['watermarked_ui', 'limited_features', 'expires_soon'],
        zkpProof: null,
        error: error.message
      };

      setValidationResult(errorResult);
      setIsValidating(false);
      onValidationComplete(errorResult);
    }
  };

  const generateSystemFingerprint = async (): Promise<string> => {
    const fingerprint = {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      timestamp: Date.now()
    };

    const fingerprintString = JSON.stringify(fingerprint);
    const encoder = new TextEncoder();
    const data = encoder.encode(fingerprintString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const hashLicenseData = async (data: any): Promise<string> => {
    const dataString = JSON.stringify(data);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(dataString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const determineLicenseType = (licenseKey: string): 'trial' | 'professional' | 'business' | 'enterprise' => {
    if (licenseKey.startsWith('trial_')) return 'trial';
    if (licenseKey.startsWith('pro_')) return 'professional';
    if (licenseKey.startsWith('biz_')) return 'business';
    if (licenseKey.startsWith('ent_')) return 'enterprise';
    return 'trial'; // Default to trial
  };

  const getLicenseFeatures = (licenseType: string): string[] => {
    const baseFeatures = [
      'end_to_end_encryption',
      'zkp_proofs',
      'basic_messaging',
      'peer_discovery'
    ];

    switch (licenseType) {
      case 'trial':
        return [...baseFeatures, 'trial_navigation', 'limited_groups'];
      case 'professional':
        return [...baseFeatures, 'full_navigation', 'unlimited_groups', 'business_verification', 'voice_calls'];
      case 'business':
        return [...baseFeatures, 'full_navigation', 'unlimited_groups', 'business_verification', 'voice_calls', 'video_calls', 'multi_device_sync'];
      case 'enterprise':
        return [...baseFeatures, 'full_navigation', 'unlimited_groups', 'business_verification', 'voice_calls', 'video_calls', 'multi_device_sync', 'api_access', 'custom_integrations'];
      default:
        return baseFeatures;
    }
  };

  const getLicenseRestrictions = (licenseType: string): string[] => {
    switch (licenseType) {
      case 'trial':
        return ['watermarked_ui', 'max_10_groups', 'max_100_messages_per_day', 'expires_30_days'];
      case 'professional':
        return ['max_50_groups', 'no_api_access'];
      case 'business':
        return ['max_500_groups', 'no_custom_integrations'];
      case 'enterprise':
        return []; // No restrictions
      default:
        return ['trial_restrictions'];
    }
  };

  const calculateExpiration = (licenseType: string, startTime: number): number => {
    const now = Date.now();

    switch (licenseType) {
      case 'trial':
        return now + (30 * 24 * 60 * 60 * 1000); // 30 days
      case 'professional':
        return now + (365 * 24 * 60 * 60 * 1000); // 1 year
      case 'business':
        return now + (365 * 24 * 60 * 60 * 1000); // 1 year
      case 'enterprise':
        return now + (2 * 365 * 24 * 60 * 60 * 1000); // 2 years
      default:
        return now + (7 * 24 * 60 * 60 * 1000); // 7 days
    }
  };

  if (!showUI) {
    return null; // Silent validation
  }

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#010401] border border-[#00f3ff]/20 rounded-lg p-8 max-w-md w-full shadow-[0_0_40px_rgba(0,243,255,0.1)]">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-8 h-8 text-[#00f3ff]" />
          <h2 className="text-xl font-bold text-[#00f3ff] uppercase tracking-wider">
            License Validation
          </h2>
        </div>

        {isValidating ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#00f3ff] border-t-transparent"></div>
              <span className="text-[#00f3ff]/80">{validationStep}</span>
            </div>
            <div className="w-full bg-[#010401] border border-[#4caf50]/30 rounded-full h-2">
              <div className="bg-[#00f3ff] h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
          </div>
        ) : validationResult ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              {validationResult.isValid ? (
                <CheckCircle className="w-6 h-6 text-[#4caf50]" />
              ) : (
                <XCircle className="w-6 h-6 text-red-500" />
              )}
              <span className={`font-bold uppercase tracking-wider ${
                validationResult.isValid ? 'text-[#4caf50]' : 'text-red-500'
              }`}>
                {validationResult.isValid ? 'License Valid' : 'License Invalid'}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#00f3ff]/60">Type:</span>
                <span className="text-[#00f3ff] uppercase">{validationResult.licenseType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#00f3ff]/60">Expires:</span>
                <span className="text-[#00f3ff]">
                  {new Date(validationResult.expiresAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            {validationResult.features.length > 0 && (
              <div>
                <h3 className="text-[#4caf50] font-bold mb-2 uppercase tracking-wider text-sm">
                  Features Enabled
                </h3>
                <div className="space-y-1">
                  {validationResult.features.slice(0, 3).map((feature, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs">
                      <Zap className="w-3 h-3 text-[#4caf50]" />
                      <span className="text-[#00f3ff]/80 capitalize">
                        {feature.replace(/_/g, ' ')}
                      </span>
                    </div>
                  ))}
                  {validationResult.features.length > 3 && (
                    <span className="text-[#4caf50]/60 text-xs">
                      +{validationResult.features.length - 3} more features
                    </span>
                  )}
                </div>
              </div>
            )}

            {validationResult.error && (
              <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <span className="text-red-400 text-sm">{validationResult.error}</span>
              </div>
            )}

            <div className="flex justify-center pt-4">
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-[#00f3ff]/10 border border-[#00f3ff]/30 text-[#00f3ff] rounded hover:bg-[#00f3ff]/20 transition-colors uppercase tracking-wider text-sm font-bold"
              >
                Continue
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default LicenseValidator;