import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Radar, MapPin, Signal, RefreshCw, UserPlus, AlertCircle, Wifi, WifiOff, Navigation, XCircle } from 'lucide-react';
import peerDiscoveryService, { NearbyPeer } from '../../services/PeerDiscoveryService';
import { messagingService } from '../../services/MessagingService';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface MeshNearbyPeerScannerProps {
  onAdd: (peerId: string) => void;
  onCancel: () => void;
}

const PEER_ID_STORAGE_KEY = 'g3zkp_local_peer_id';

function generateUniquePeerId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  const browserFingerprint = navigator.userAgent.split('').reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);
    return a & a;
  }, 0).toString(36).substring(0, 4);
  return `12D3KooW${timestamp}${randomPart}${browserFingerprint}`.substring(0, 52);
}

function getOrCreatePeerId(): string {
  try {
    const stored = localStorage.getItem(PEER_ID_STORAGE_KEY);
    if (stored && stored.length > 20) {
      return stored;
    }
    const newId = generateUniquePeerId();
    localStorage.setItem(PEER_ID_STORAGE_KEY, newId);
    console.log('[MeshScanner] Generated new peer ID:', newId);
    return newId;
  } catch (e) {
    return generateUniquePeerId();
  }
}

type LocationStatus = 'requesting' | 'acquired' | 'denied' | 'timeout' | 'unavailable' | 'fallback';

export function MeshNearbyPeerScanner({ onAdd, onCancel }: MeshNearbyPeerScannerProps) {
  const [scanning, setScanning] = useState(false);
  const [nearbyPeers, setNearbyPeers] = useState<NearbyPeer[]>([]);
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>('requesting');
  const [scanStatus, setScanStatus] = useState<string>('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const connectionUnsubscribeRef = useRef<(() => void) | null>(null);
  const nearbyPeersRef = useRef<NearbyPeer[]>([]);
  const localPeerIdRef = useRef<string>(getOrCreatePeerId());

  const requestLocation = useCallback(() => {
    setLocationStatus('requesting');
    
    if (!navigator.geolocation) {
      console.log('[MeshScanner] Geolocation not supported, using fallback');
      useFallbackLocation();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude
        };
        console.log('[MeshScanner] Location acquired:', loc);
        setLocation(loc);
        setLocationStatus('acquired');
      },
      (err) => {
        console.log('[MeshScanner] Geolocation error:', err.code, err.message);
        if (err.code === 1) {
          setLocationStatus('denied');
        } else if (err.code === 3) {
          setLocationStatus('timeout');
        } else {
          setLocationStatus('unavailable');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  const useFallbackLocation = useCallback(() => {
    const fallback = { lat: 51.5074, lon: -0.1278 };
    console.log('[MeshScanner] Using fallback location (London):', fallback);
    setLocation(fallback);
    setLocationStatus('fallback');
  }, []);

  useEffect(() => {
    requestLocation();

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
      if (connectionUnsubscribeRef.current) {
        connectionUnsubscribeRef.current();
        connectionUnsubscribeRef.current = null;
      }
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
      peerDiscoveryService.stopDiscovery();
    };
  }, [requestLocation]);

  const startScanning = useCallback(() => {
    if (!location) {
      console.log('[MeshScanner] Cannot scan - no location');
      return;
    }

    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    if (connectionUnsubscribeRef.current) {
      connectionUnsubscribeRef.current();
      connectionUnsubscribeRef.current = null;
    }

    setScanning(true);
    setScanStatus('INITIALIZING_P2P_DISCOVERY...');
    setNearbyPeers([]);
    nearbyPeersRef.current = [];

    const localPeerId = messagingService.getLocalPeerId() || localPeerIdRef.current;
    console.log('[MeshScanner] Starting scan with peerId:', localPeerId, 'at location:', location);
    
    peerDiscoveryService.initialize();
    
    connectionUnsubscribeRef.current = peerDiscoveryService.onConnectionChange((status) => {
      console.log('[MeshScanner] Connection status:', status);
      setConnectionStatus(status);
      if (status === 'connected') {
        setScanStatus('SCANNING_MESH_NETWORK...');
      } else if (status === 'error') {
        setScanStatus('CONNECTION_ERROR_-_RETRYING...');
      } else if (status === 'disconnected') {
        setScanStatus('DISCONNECTED_FROM_NETWORK');
      }
    });
    
    unsubscribeRef.current = peerDiscoveryService.subscribe((peers) => {
      console.log('[MeshScanner] Received peers:', peers.length, peers);
      setNearbyPeers(peers);
      nearbyPeersRef.current = peers;
      if (peers.length > 0) {
        setScanStatus(`FOUND_${peers.length}_NODE${peers.length > 1 ? 'S' : ''}`);
      }
    });

    try {
      peerDiscoveryService.startDiscovery(localPeerId, location);
      console.log('[MeshScanner] Discovery started successfully');
    } catch (err) {
      console.error('[MeshScanner] Discovery error:', err);
      setScanStatus('DISCOVERY_SERVICE_ERROR');
      setScanning(false);
      setConnectionStatus('disconnected');
      return;
    }

    scanTimeoutRef.current = setTimeout(() => {
      const currentPeers = nearbyPeersRef.current;
      if (currentPeers.length === 0) {
        setScanStatus('SCAN_COMPLETE_-_NO_NEARBY_NODES');
      }
    }, 15000);
  }, [location]);

  const stopScanning = useCallback(() => {
    console.log('[MeshScanner] Stopping scan');
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    if (connectionUnsubscribeRef.current) {
      connectionUnsubscribeRef.current();
      connectionUnsubscribeRef.current = null;
    }
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
    peerDiscoveryService.stopDiscovery();
    setScanning(false);
    setConnectionStatus('disconnected');
    setScanStatus('');
    nearbyPeersRef.current = [];
  }, []);

  const formatDistance = (meters?: number): string => {
    if (!meters) return 'UNKNOWN';
    if (meters < 1) return '< 1M';
    if (meters < 1000) return `${Math.round(meters)}M`;
    return `${(meters / 1000).toFixed(1)}KM`;
  };

  const getSignalStrengthColor = (strength: number): string => {
    if (strength >= 80) return 'text-[#4caf50]';
    if (strength >= 50) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getLocationStatusMessage = (): { message: string; color: string } => {
    switch (locationStatus) {
      case 'requesting':
        return { message: 'REQUESTING_LOCATION_ACCESS...', color: 'text-yellow-400' };
      case 'acquired':
        return { message: 'LOCATION_ACQUIRED_-_READY_TO_SCAN', color: 'text-[#4caf50]' };
      case 'denied':
        return { message: 'LOCATION_DENIED_-_TAP_TO_USE_FALLBACK', color: 'text-red-400' };
      case 'timeout':
        return { message: 'LOCATION_TIMEOUT_-_TAP_TO_RETRY', color: 'text-yellow-400' };
      case 'unavailable':
        return { message: 'LOCATION_UNAVAILABLE_-_TAP_TO_USE_FALLBACK', color: 'text-red-400' };
      case 'fallback':
        return { message: 'USING_APPROXIMATE_LOCATION', color: 'text-yellow-400' };
      default:
        return { message: 'UNKNOWN_STATUS', color: 'text-gray-400' };
    }
  };

  const handleLocationStatusClick = () => {
    if (locationStatus === 'denied' || locationStatus === 'unavailable') {
      useFallbackLocation();
    } else if (locationStatus === 'timeout') {
      requestLocation();
    }
  };

  const canScan = location !== null;
  const locationStatusInfo = getLocationStatusMessage();

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="w-16 h-16 border-[0.5px] border-[#00f3ff]/40 bg-[#00f3ff]/10 flex items-center justify-center mx-auto mb-4 relative">
          <Radar size={32} className={`text-[#00f3ff] ${scanning ? 'animate-pulse' : ''}`} />
          {scanning && (
            <>
              <div className="absolute inset-0 border-[0.5px] border-[#00f3ff] animate-ping opacity-75" />
              <div className="absolute inset-[-8px] border-[0.5px] border-[#00f3ff]/50 animate-ping opacity-50" style={{ animationDelay: '0.5s' }} />
            </>
          )}
        </div>
        <h3 className="text-[12px] font-black text-[#00f3ff] uppercase tracking-widest mb-2">PROXIMITY_SCANNER</h3>
        <p className="text-[9px] font-mono text-[#4caf50]/60 uppercase">
          DISCOVER_NODES_IN_MESH_NETWORK
        </p>
      </div>

      <div className="border-[0.5px] border-[#4caf50]/20 p-2">
        <div className="flex items-center justify-between text-[8px] font-mono uppercase">
          <span className="text-[#4caf50]/60">LOCAL_PEER_ID:</span>
          <span className="text-[#00f3ff] truncate ml-2 max-w-[180px]">{localPeerIdRef.current.substring(0, 20)}...</span>
        </div>
      </div>

      <button
        onClick={handleLocationStatusClick}
        className={`w-full border-[0.5px] p-3 flex items-center gap-2 transition-all ${
          locationStatus === 'acquired' || locationStatus === 'fallback'
            ? 'border-[#4caf50]/40 bg-[#4caf50]/10'
            : locationStatus === 'requesting'
            ? 'border-yellow-400/40 bg-yellow-400/10 animate-pulse'
            : 'border-red-500/40 bg-red-500/10 cursor-pointer hover:bg-red-500/20'
        }`}
      >
        {locationStatus === 'requesting' ? (
          <Navigation size={14} className="text-yellow-400 animate-spin flex-shrink-0" />
        ) : locationStatus === 'acquired' || locationStatus === 'fallback' ? (
          <MapPin size={14} className="text-[#4caf50] flex-shrink-0" />
        ) : (
          <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
        )}
        <span className={`text-[9px] font-mono uppercase ${locationStatusInfo.color}`}>
          {locationStatusInfo.message}
        </span>
      </button>

      {scanning && (
        <div className={`border-[0.5px] p-3 flex items-center gap-2 ${
          connectionStatus === 'error' ? 'border-red-500/20 bg-red-500/5' : 'border-[#00f3ff]/20'
        }`}>
          {connectionStatus === 'connected' ? (
            <Wifi size={14} className="text-[#4caf50] flex-shrink-0" />
          ) : connectionStatus === 'connecting' ? (
            <Wifi size={14} className="text-yellow-400 animate-pulse flex-shrink-0" />
          ) : connectionStatus === 'error' ? (
            <XCircle size={14} className="text-red-400 flex-shrink-0" />
          ) : (
            <WifiOff size={14} className="text-red-400 flex-shrink-0" />
          )}
          <span className={`text-[9px] font-mono uppercase flex-1 ${
            connectionStatus === 'error' ? 'text-red-400' : 'text-[#00f3ff]'
          }`}>
            {scanStatus || 'CONNECTING...'}
          </span>
          {connectionStatus !== 'error' && (
            <RefreshCw size={12} className="text-[#00f3ff] animate-spin" />
          )}
        </div>
      )}

      {!scanning ? (
        <button
          onClick={startScanning}
          disabled={!canScan}
          className={`w-full px-6 py-4 border-[0.5px] transition-all text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 ${
            canScan
              ? 'border-[#00f3ff]/40 bg-[#00f3ff]/10 hover:bg-[#00f3ff]/20 text-[#00f3ff] active:bg-[#00f3ff]/30'
              : 'border-gray-500/20 bg-gray-500/5 text-gray-500 cursor-not-allowed'
          }`}
        >
          <Radar size={16} />
          {canScan ? 'INITIATE_SCAN' : 'WAITING_FOR_LOCATION...'}
        </button>
      ) : (
        <button
          onClick={stopScanning}
          className="w-full px-6 py-4 border-[0.5px] border-red-500/40 bg-red-500/10 hover:bg-red-500/20 active:bg-red-500/30 transition-all text-[10px] font-black text-red-400 uppercase tracking-widest flex items-center justify-center gap-2"
        >
          <RefreshCw size={16} className="animate-spin" />
          TERMINATE_SCAN
        </button>
      )}

      {scanning && (
        <div className="border-[0.5px] border-[#4caf50]/20 max-h-[250px] overflow-y-auto">
          {nearbyPeers.length > 0 ? (
            nearbyPeers.map((peer) => (
              <div
                key={peer.peerId}
                className="p-4 border-b-[0.5px] border-[#4caf50]/10 hover:bg-black/40 active:bg-black/60 transition-all flex items-center justify-between"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-[#4caf50] animate-pulse" />
                    <span className="text-[10px] font-black text-[#00f3ff] uppercase tracking-wider truncate">
                      {peer.displayName || `NODE_${peer.peerId.substring(0, 8)}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 ml-4">
                    <span className="text-[8px] font-mono text-[#4caf50]/60 flex items-center gap-1">
                      <MapPin size={10} />
                      {formatDistance(peer.distance)}
                    </span>
                    <span className={`text-[8px] font-mono flex items-center gap-1 ${getSignalStrengthColor(peer.signalStrength)}`}>
                      <Signal size={10} />
                      {peer.signalStrength}%
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    console.log('[MeshScanner] Adding peer:', peer.peerId);
                    onAdd(peer.peerId);
                  }}
                  className="ml-4 p-3 border-[0.5px] border-[#00f3ff]/40 bg-[#00f3ff]/10 hover:bg-[#00f3ff]/20 active:bg-[#00f3ff]/30 transition-all"
                >
                  <UserPlus size={16} className="text-[#00f3ff]" />
                </button>
              </div>
            ))
          ) : (
            <div className="p-8 text-center">
              <div className="relative w-16 h-16 mx-auto mb-3">
                <Radar size={32} className="text-[#4caf50]/30 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                <div className="absolute inset-0 border-[0.5px] border-[#4caf50]/20 rounded-full animate-ping" />
                <div className="absolute inset-2 border-[0.5px] border-[#4caf50]/30 rounded-full animate-ping" style={{ animationDelay: '0.5s' }} />
              </div>
              <p className="text-[10px] font-black text-[#4caf50]/40 uppercase tracking-widest">SCANNING_MESH...</p>
              <p className="text-[8px] font-mono text-[#4caf50]/30 uppercase mt-1">
                {connectionStatus === 'connected' ? 'WAITING_FOR_NEARBY_NODES' : 'CONNECTING_TO_NETWORK'}
              </p>
            </div>
          )}
        </div>
      )}

      <button
        onClick={onCancel}
        className="w-full px-6 py-3 border-[0.5px] border-[#4caf50]/20 bg-black/40 hover:bg-black/60 active:bg-black/80 transition-all text-[10px] font-black text-[#4caf50]/60 uppercase tracking-widest"
      >
        CLOSE
      </button>
    </div>
  );
}

export default MeshNearbyPeerScanner;
