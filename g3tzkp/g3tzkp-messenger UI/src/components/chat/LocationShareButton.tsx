import React, { useState } from 'react';
import { MapPin, Navigation, Radio } from 'lucide-react';
import LocationPicker from './LocationPicker';
import LiveLocationShare from './LiveLocationShare';

interface LocationShareButtonProps {
  onShareLocation: (location: {
    type: 'static' | 'live';
    coordinates: { latitude: number; longitude: number };
    address?: string;
    duration?: number;
  }) => void;
}

export function LocationShareButton({ onShareLocation }: LocationShareButtonProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [showLiveShare, setShowLiveShare] = useState(false);

  const handleCurrentLocation = async () => {
    setShowMenu(false);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true
        });
      });

      onShareLocation({
        type: 'static',
        coordinates: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }
      });
    } catch (error) {
      console.error('Failed to get current location:', error);
      alert('Failed to get your current location');
    }
  };

  const handlePickLocation = () => {
    setShowMenu(false);
    setShowPicker(true);
  };

  const handleLiveLocation = () => {
    setShowMenu(false);
    setShowLiveShare(true);
  };

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          title="Share Location"
        >
          <MapPin className="w-5 h-5 text-gray-400" />
        </button>

        {showMenu && (
          <div className="absolute bottom-full left-0 mb-2 bg-gray-900 border border-cyan-500/30 rounded-lg shadow-xl overflow-hidden min-w-[200px]">
            <button
              onClick={handleCurrentLocation}
              className="w-full px-4 py-3 hover:bg-cyan-500/10 transition-colors flex items-center gap-3 text-left"
            >
              <Navigation className="w-5 h-5 text-cyan-400" />
              <div>
                <div className="font-medium text-white">Current Location</div>
                <div className="text-xs text-gray-400">Share where you are now</div>
              </div>
            </button>

            <button
              onClick={handlePickLocation}
              className="w-full px-4 py-3 hover:bg-cyan-500/10 transition-colors flex items-center gap-3 text-left border-t border-gray-800"
            >
              <MapPin className="w-5 h-5 text-cyan-400" />
              <div>
                <div className="font-medium text-white">Pick Location</div>
                <div className="text-xs text-gray-400">Choose from map</div>
              </div>
            </button>

            <button
              onClick={handleLiveLocation}
              className="w-full px-4 py-3 hover:bg-cyan-500/10 transition-colors flex items-center gap-3 text-left border-t border-gray-800"
            >
              <Radio className="w-5 h-5 text-cyan-400" />
              <div>
                <div className="font-medium text-white">Live Location</div>
                <div className="text-xs text-gray-400">Share real-time location</div>
              </div>
            </button>
          </div>
        )}
      </div>

      {showPicker && (
        <LocationPicker
          onSelect={(coords, address) => {
            onShareLocation({
              type: 'static',
              coordinates: coords,
              address
            });
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}

      {showLiveShare && (
        <LiveLocationShare
          onStart={(duration) => {
            navigator.geolocation.getCurrentPosition((position) => {
              onShareLocation({
                type: 'live',
                coordinates: {
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude
                },
                duration
              });
              setShowLiveShare(false);
            });
          }}
          onClose={() => setShowLiveShare(false)}
        />
      )}
    </>
  );
}

export default LocationShareButton;
