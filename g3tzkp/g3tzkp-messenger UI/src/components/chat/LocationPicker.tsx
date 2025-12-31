import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import { X, Check, MapPin } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import locationSharingService from '../../services/LocationSharingService';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface LocationPickerProps {
  onSelect: (coordinates: { latitude: number; longitude: number }, address?: string) => void;
  onClose: () => void;
}

function LocationMarker({ position, setPosition }: { 
  position: [number, number]; 
  setPosition: (pos: [number, number]) => void;
}) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });

  return <Marker position={position} />;
}

export function LocationPicker({ onSelect, onClose }: LocationPickerProps) {
  const [position, setPosition] = useState<[number, number]>([51.505, -0.09]);
  const [address, setAddress] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition([pos.coords.latitude, pos.coords.longitude]);
      },
      (error) => {
        console.error('Failed to get location:', error);
      }
    );
  }, []);

  useEffect(() => {
    const fetchAddress = async () => {
      setLoading(true);
      const addr = await locationSharingService.reverseGeocode(position[0], position[1]);
      setAddress(addr);
      setLoading(false);
    };
    fetchAddress();
  }, [position]);

  const handleConfirm = () => {
    onSelect(
      {
        latitude: position[0],
        longitude: position[1]
      },
      address
    );
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-cyan-500/30 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-xl font-bold text-cyan-400">Pick Location</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="relative flex-1" style={{ minHeight: '400px' }}>
          <MapContainer
            center={position}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <LocationMarker position={position} setPosition={setPosition} />
          </MapContainer>
        </div>

        <div className="p-4 border-t border-gray-800 space-y-3">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-1" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">Selected Location</p>
              {loading ? (
                <p className="text-sm text-gray-400">Loading address...</p>
              ) : (
                <p className="text-sm text-gray-400">{address}</p>
              )}
              <p className="text-xs text-gray-600 mt-1">
                {position[0].toFixed(6)}, {position[1].toFixed(6)}
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-800 text-white font-bold rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 px-6 py-3 bg-cyan-500 text-black font-bold rounded-lg hover:bg-cyan-400 transition-colors flex items-center justify-center gap-2"
            >
              <Check className="w-5 h-5" />
              Share Location
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LocationPicker;
