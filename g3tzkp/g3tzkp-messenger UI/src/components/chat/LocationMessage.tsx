import React from 'react';
import { MapPin, Navigation, Radio, ExternalLink } from 'lucide-react';
import locationSharingService from '../../services/LocationSharingService';

interface LocationMessageProps {
  location: {
    type: 'static' | 'live';
    coordinates: { latitude: number; longitude: number };
    address?: string;
    timestamp: number;
    expiresAt?: number;
  };
  currentLocation?: { latitude: number; longitude: number };
  onOpenMap: () => void;
}

export function LocationMessage({ location, currentLocation, onOpenMap }: LocationMessageProps) {
  const { coordinates, address, type } = location;
  
  const distance = currentLocation
    ? locationSharingService.calculateDistance(currentLocation, coordinates)
    : undefined;

  const eta = distance ? locationSharingService.calculateETA(distance) : undefined;

  const staticMapUrl = locationSharingService.getStaticMapUrl(
    coordinates.latitude,
    coordinates.longitude,
    15,
    300,
    200
  );

  const isLive = type === 'live';
  const isExpired = location.expiresAt && location.expiresAt < Date.now();

  return (
    <div className="max-w-sm bg-gray-800 rounded-lg overflow-hidden border border-cyan-500/30">
      <div 
        className="relative cursor-pointer group"
        onClick={onOpenMap}
      >
        <img
          src={staticMapUrl}
          alt="Location preview"
          className="w-full h-48 object-cover"
        />
        
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="bg-black/80 px-4 py-2 rounded-lg flex items-center gap-2">
            <ExternalLink className="w-5 h-5 text-cyan-400" />
            <span className="text-white font-medium">Open in Map</span>
          </div>
        </div>

        {isLive && !isExpired && (
          <div className="absolute top-3 left-3 bg-red-500 text-white px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 animate-pulse">
            <Radio className="w-3 h-3" />
            LIVE
          </div>
        )}
      </div>

      <div className="p-3 space-y-2">
        <div className="flex items-start gap-2">
          <MapPin className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            {address ? (
              <p className="text-sm text-white font-medium">{address}</p>
            ) : (
              <p className="text-sm text-gray-400 font-mono">
                {coordinates.latitude.toFixed(6)}, {coordinates.longitude.toFixed(6)}
              </p>
            )}
          </div>
        </div>

        {distance !== undefined && eta !== undefined && (
          <div className="flex items-center gap-4 text-xs text-gray-400 pt-2 border-t border-gray-700">
            <span className="flex items-center gap-1">
              <Navigation className="w-3 h-3" />
              {locationSharingService.formatDistance(distance)}
            </span>
            <span className="flex items-center gap-1">
              <span>≈</span>
              {locationSharingService.formatETA(eta)}
            </span>
          </div>
        )}

        {isExpired && (
          <div className="text-xs text-red-400 pt-2 border-t border-gray-700">
            Live location sharing has ended
          </div>
        )}
      </div>
    </div>
  );
}

export default LocationMessage;
