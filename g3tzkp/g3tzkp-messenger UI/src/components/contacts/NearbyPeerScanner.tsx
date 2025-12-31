import React, { useState, useEffect } from 'react';
import { Radar, MapPin, Signal, RefreshCw, UserPlus } from 'lucide-react';
import peerDiscoveryService, { NearbyPeer } from '../../services/PeerDiscoveryService';

interface NearbyPeerScannerProps {
  onAdd: (peerId: string) => void;
  onCancel: () => void;
}

export function NearbyPeerScanner({ onAdd, onCancel }: NearbyPeerScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [nearbyPeers, setNearbyPeers] = useState<NearbyPeer[]>([]);
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude
        });
      },
      (err) => {
        setError('Location access denied. Please enable location services.');
      }
    );
  }, []);

  const startScanning = () => {
    if (!location) {
      setError('Location not available');
      return;
    }

    setScanning(true);
    setError('');

    peerDiscoveryService.initialize();
    
    const unsubscribe = peerDiscoveryService.subscribe((peers) => {
      setNearbyPeers(peers);
    });

    peerDiscoveryService.startDiscovery('local-peer-id', location);

    return () => {
      peerDiscoveryService.stopDiscovery();
      unsubscribe();
      setScanning(false);
    };
  };

  const stopScanning = () => {
    peerDiscoveryService.stopDiscovery();
    setScanning(false);
  };

  const formatDistance = (meters?: number): string => {
    if (!meters) return 'Unknown';
    if (meters < 1) return '< 1m';
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const getSignalStrengthColor = (strength: number): string => {
    if (strength >= 80) return 'text-green-400';
    if (strength >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-4 relative">
          <Radar className={`w-8 h-8 text-cyan-400 ${scanning ? 'animate-pulse' : ''}`} />
          {scanning && (
            <div className="absolute inset-0 rounded-full border-2 border-cyan-400 animate-ping" />
          )}
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Nearby Peers</h3>
        <p className="text-sm text-gray-400">
          Discover peers within 100 meters (requires location access)
        </p>
      </div>

      {location && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-green-400 flex-shrink-0" />
          <span className="text-sm text-green-400">
            Location enabled - Ready to scan
          </span>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {!scanning ? (
        <button
          onClick={startScanning}
          disabled={!location}
          className="w-full px-6 py-4 bg-cyan-500 text-black font-bold rounded-lg hover:bg-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Radar className="w-5 h-5" />
          Start Scanning
        </button>
      ) : (
        <button
          onClick={stopScanning}
          className="w-full px-6 py-4 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-5 h-5" />
          Stop Scanning
        </button>
      )}

      {scanning && (
        <div className="border border-gray-800 rounded-lg divide-y divide-gray-800 max-h-[400px] overflow-y-auto">
          {nearbyPeers.length > 0 ? (
            nearbyPeers.map((peer) => (
              <div
                key={peer.peerId}
                className="p-4 hover:bg-gray-800/50 transition-colors flex items-center justify-between"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white truncate mb-1">
                    {peer.displayName || `Peer ${peer.peerId.substring(0, 8)}`}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-400">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {formatDistance(peer.distance)}
                    </span>
                    <span className={`flex items-center gap-1 ${getSignalStrengthColor(peer.signalStrength)}`}>
                      <Signal className="w-3 h-3" />
                      {peer.signalStrength}%
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => onAdd(peer.peerId)}
                  className="ml-4 p-2 bg-cyan-500 text-black rounded-lg hover:bg-cyan-400 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                </button>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-gray-400">
              <Radar className="w-12 h-12 mx-auto mb-3 opacity-50 animate-pulse" />
              <p>Scanning for nearby peers...</p>
              <p className="text-sm mt-1">No peers found yet</p>
            </div>
          )}
        </div>
      )}

      <button
        onClick={onCancel}
        className="w-full px-6 py-3 bg-gray-800 text-white font-bold rounded-lg hover:bg-gray-700 transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}

export default NearbyPeerScanner;
