import React, { useState, useEffect } from 'react';
import { Phone, PhoneOff, Clock } from 'lucide-react';
import { G3TZKPBusinessProfile } from '@/types/business';
import { businessCallingService } from '@/services/BusinessCallingService';
import { BusinessCallAvailability } from '@/types/peer';

interface BusinessCallButtonProps {
  business: G3TZKPBusinessProfile;
  onCallInitiated?: (businessId: string) => void;
  variant?: 'default' | 'icon-only';
}

export const BusinessCallButton: React.FC<BusinessCallButtonProps> = ({
  business,
  onCallInitiated,
  variant = 'default'
}) => {
  const [availability, setAvailability] = useState<BusinessCallAvailability>({ isOpen: false });
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const checkAvailability = () => {
      const status = businessCallingService.checkBusinessAvailability(business);
      setAvailability(status);
    };

    checkAvailability();
    const interval = setInterval(checkAvailability, 60000);
    return () => clearInterval(interval);
  }, [business]);

  const handleCall = () => {
    if (!availability.isOpen) return;
    onCallInitiated?.(business.id);
  };

  const formatNextOpenTime = () => {
    if (!availability.nextOpenTime) return 'Closed';
    const date = new Date(availability.nextOpenTime);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return `Opens ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    }
    
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = date.toDateString() === tomorrow.toDateString();
    
    if (isTomorrow) {
      return `Opens tomorrow ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
    }
    
    return `Opens ${date.toLocaleDateString('en-US', { weekday: 'short' })} ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  };

  if (variant === 'icon-only') {
    return (
      <button
        onClick={handleCall}
        disabled={!availability.isOpen}
        className={`p-3 rounded-full transition-all ${
          availability.isOpen
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : 'bg-gray-300 text-gray-500 cursor-not-allowed'
        }`}
        title={availability.isOpen ? 'Call Business' : formatNextOpenTime()}
      >
        {availability.isOpen ? <Phone size={20} /> : <PhoneOff size={20} />}
      </button>
    );
  }

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        onClick={handleCall}
        disabled={!availability.isOpen}
        className={`px-6 py-3 rounded-lg font-medium transition-all flex items-center gap-2 ${
          availability.isOpen
            ? 'bg-green-600 hover:bg-green-700 text-white'
            : 'bg-gray-300 text-gray-600 cursor-not-allowed'
        }`}
      >
        {availability.isOpen ? (
          <>
            <Phone size={20} />
            Call Now
          </>
        ) : (
          <>
            <Clock size={20} />
            Closed
          </>
        )}
      </button>

      {isHovered && !availability.isOpen && availability.nextOpenTime && (
        <div className="absolute top-full mt-2 right-0 bg-gray-900 text-white text-xs rounded-lg p-3 whitespace-nowrap z-10 shadow-lg">
          <div className="flex items-center gap-2">
            <Clock size={14} />
            {formatNextOpenTime()}
          </div>
          <div className="absolute top-0 right-4 -mt-1 w-2 h-2 bg-gray-900 transform rotate-45" />
        </div>
      )}
    </div>
  );
};
