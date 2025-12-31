import React, { useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';
import NavigatorMap from './navigation/NavigatorMap';
import WazeLikeSearch from './navigation/WazeLikeSearch';
import FlowerOfLifeMarker from './navigation/FlowerOfLifeMarker';
import { searchService } from '../services/SearchService';
import { SearchResult } from '../services/SearchService';
import { Coordinate } from '../types/navigation';

interface IntegratedNavigationProps {
  currentLocation: Coordinate | null;
  onLocationSelected?: (result: SearchResult) => void;
}

export function IntegratedNavigation({ currentLocation, onLocationSelected }: IntegratedNavigationProps) {
  const [selectedDestination, setSelectedDestination] = useState<[number, number] | null>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);

  const handleLocationSelect = (result: SearchResult) => {
    const destCoords: [number, number] = [result.lat, result.lon];
    setSelectedDestination(destCoords);
    onLocationSelected?.(result);
  };

  return (
    <div className="relative h-full w-full">
      {/* Waze-like Search at top */}
      <div className="absolute top-4 left-4 right-4 md:right-auto md:w-96 z-[1000] safe-top">
        <WazeLikeSearch
          userLocation={currentLocation || undefined}
          onLocationSelected={handleLocationSelect}
        />
      </div>

      {/* Main Map */}
      <div className="h-full w-full">
        <NavigatorMap
          currentLocation={currentLocation || undefined}
          destination={selectedDestination}
          onMapClick={(coord) => {
            setSelectedDestination([coord.lat, coord.lng]);
          }}
          onLocationFound={(coord) => {
            console.log('Location found:', coord);
          }}
          className="h-full w-full"
          onMapReady={setMapInstance}
        />
      </div>

      {/* Flower of Life Marker for destination */}
      {selectedDestination && mapInstance && (
        <FlowerOfLifeMarker
          position={selectedDestination}
          map={mapInstance}
          color="#00ffff"
          size={40}
        />
      )}

      {/* Current location info - mobile optimized */}
      {currentLocation && (
        <div className="absolute bottom-20 md:bottom-4 left-4 right-4 md:right-auto md:w-80 bg-black/95 border border-cyan-500/30 rounded-lg p-4 z-[999] safe-bottom">
          <div className="flex items-center gap-3 mb-2">
            <MapPin size={16} className="text-cyan-400" />
            <h3 className="text-cyan-400 font-mono text-sm">Current Location</h3>
          </div>
          <div className="space-y-1 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-gray-400">Latitude</span>
              <span className="text-green-400">{currentLocation.lat.toFixed(6)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Longitude</span>
              <span className="text-green-400">{currentLocation.lng.toFixed(6)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Destination info - mobile optimized */}
      {selectedDestination && (
        <div className="absolute bottom-20 md:bottom-4 right-4 md:w-80 bg-black/95 border border-green-500/30 rounded-lg p-4 z-[999] mobile-full-width safe-bottom">
          <div className="flex items-center gap-3 mb-2">
            <Navigation size={16} className="text-green-400" />
            <h3 className="text-green-400 font-mono text-sm">Destination</h3>
          </div>
          <div className="space-y-1 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-gray-400">Latitude</span>
              <span className="text-green-400">{selectedDestination[0].toFixed(6)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Longitude</span>
              <span className="text-green-400">{selectedDestination[1].toFixed(6)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default IntegratedNavigation;
