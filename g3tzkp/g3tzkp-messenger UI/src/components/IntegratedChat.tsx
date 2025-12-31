import React, { useState } from 'react';
import { MapPin, Clock } from 'lucide-react';
import LocationShareButton from './chat/LocationShareButton';
import LocationPicker from './chat/LocationPicker';
import LiveLocationShare from './chat/LiveLocationShare';
import LocationMessage from './chat/LocationMessage';
import { locationSharingService } from '../services/LocationSharingService';
import { SharedLocation } from '../types/location';

interface IntegratedChatProps {
  onSendLocation?: (location: SharedLocation) => void;
}

export function IntegratedChat({ onSendLocation }: IntegratedChatProps) {
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showLiveShare, setShowLiveShare] = useState(false);
  const [sharedLocation, setSharedLocation] = useState<SharedLocation | null>(null);

  const handleShareCurrent = async () => {
    try {
      const coords = await locationSharingService.getCurrentLocation();
      const location: SharedLocation = {
        id: `loc_${Date.now()}`,
        coordinates: coords,
        timestamp: Date.now(),
        senderId: 'current_user',
        address: await locationSharingService.reverseGeocode(coords.lat, coords.lng),
        isLive: false
      };
      setSharedLocation(location);
      onSendLocation?.(location);
    } catch (error) {
      console.error('Failed to get location:', error);
    }
  };

  const handlePickLocation = () => {
    setShowLocationPicker(true);
  };

  const handleShareLive = () => {
    setShowLiveShare(true);
  };

  const handleLocationPicked = async (coords: { lat: number; lng: number }) => {
    const location: SharedLocation = {
      id: `loc_${Date.now()}`,
      coordinates: coords,
      timestamp: Date.now(),
      senderId: 'current_user',
      address: await locationSharingService.reverseGeocode(coords.lat, coords.lng),
      isLive: false
    };
    setSharedLocation(location);
    onSendLocation?.(location);
    setShowLocationPicker(false);
  };

  const handleLiveShareStart = async (durationMinutes: number) => {
    try {
      const coords = await locationSharingService.getCurrentLocation();
      const shareId = await locationSharingService.startLiveLocationSharing(
        'recipient_peer_id',
        durationMinutes
      );
      
      const location: SharedLocation = {
        id: shareId,
        coordinates: coords,
        timestamp: Date.now(),
        senderId: 'current_user',
        address: await locationSharingService.reverseGeocode(coords.lat, coords.lng),
        isLive: true,
        liveUntil: Date.now() + durationMinutes * 60 * 1000
      };
      
      setSharedLocation(location);
      onSendLocation?.(location);
      setShowLiveShare(false);
    } catch (error) {
      console.error('Failed to start live sharing:', error);
    }
  };

  return (
    <div className="flex flex-col h-full container-responsive">
      {/* Location Share Button - mobile optimized */}
      <div className="border-t border-[#4caf50]/20 p-3 md:p-4 bg-black/40 safe-bottom">
        <LocationShareButton
          onShareCurrent={handleShareCurrent}
          onPickLocation={handlePickLocation}
          onShareLive={handleShareLive}
        />
      </div>

      {/* Example Location Message Display */}
      {sharedLocation && (
        <div className="p-4 border-t border-[#00ffff]/20">
          <div className="text-xs text-cyan-400 mb-2 flex items-center gap-2">
            <MapPin size={12} />
            <span>Shared Location</span>
            {sharedLocation.isLive && (
              <span className="flex items-center gap-1 text-green-400">
                <Clock size={10} />
                <span>LIVE</span>
              </span>
            )}
          </div>
          <LocationMessage
            location={sharedLocation}
            onOpenMap={(loc) => {
              console.log('Open map for location:', loc);
              // Navigate to map with this location
            }}
          />
        </div>
      )}

      {/* Location Picker Modal */}
      {showLocationPicker && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 safe-top safe-bottom">
          <div className="w-full h-full max-w-4xl max-h-[90vh] bg-black border border-cyan-500/30 rounded-lg overflow-hidden">
            <LocationPicker
              onLocationSelected={handleLocationPicked}
              onCancel={() => setShowLocationPicker(false)}
            />
          </div>
        </div>
      )}

      {/* Live Location Share Modal */}
      {showLiveShare && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4 safe-top safe-bottom">
          <div className="w-full max-w-md bg-black border border-green-500/30 rounded-lg">
            <LiveLocationShare
              onStartSharing={handleLiveShareStart}
              onCancel={() => setShowLiveShare(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default IntegratedChat;
