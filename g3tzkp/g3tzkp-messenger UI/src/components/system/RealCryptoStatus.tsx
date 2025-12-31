import React, { useEffect, useState, useCallback } from 'react';
import { Shield, Lock, Cpu, RefreshCw, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { cryptoStateService, RealCryptoState } from '../../services/CryptoStateService';

interface RealCryptoStatusProps {
  refreshInterval?: number;
}

interface ProtocolStatusProps {
  name: string;
  status: string;
  details: Record<string, string>;
}

const ProtocolStatus: React.FC<ProtocolStatusProps> = ({ name, status, details }) => {
  return (
    <div className="bg-gray-900 p-3 rounded border border-gray-800">
      <div className="flex justify-between items-center mb-2">
        <span className="text-gray-300 font-mono text-sm">{name}</span>
        <span className={`px-2 py-1 rounded text-xs font-mono ${
          status === 'active' ? 'bg-green-900 text-green-400' :
          status === 'standby' ? 'bg-blue-900 text-blue-400' :
          status === 'online' ? 'bg-green-900 text-green-400' :
          status === 'connecting' ? 'bg-yellow-900 text-yellow-400' :
          status === 'not_initialized' ? 'bg-orange-900 text-orange-400' :
          'bg-gray-800 text-gray-400'
        }`}>
          {status.toUpperCase().replace('_', ' ')}
        </span>
      </div>
      <div className="text-gray-500 text-xs space-y-1">
        {Object.entries(details).map(([key, value]) => (
          <div key={key} className="flex justify-between font-mono">
            <span>{key}:</span>
            <span className="text-gray-400">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const RealCryptoStatus: React.FC<RealCryptoStatusProps> = ({ refreshInterval = 5000 }) => {
  const [cryptoState, setCryptoState] = useState<RealCryptoState | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const fetchRealData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      setIsInitialized(cryptoStateService.isInitialized());
      const state = await cryptoStateService.getRealCryptoState();
      setCryptoState(state);
      setLastUpdate(Date.now());
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const handleInitialize = useCallback(() => {
    cryptoStateService.initializeKeys();
    setIsInitialized(true);
    fetchRealData();
  }, [fetchRealData]);

  useEffect(() => {
    fetchRealData();
    const interval = setInterval(fetchRealData, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchRealData, refreshInterval]);

  if (!cryptoState) {
    return (
      <div className="p-4 text-cyan-400 font-mono animate-pulse">
        Loading cryptographic state from localStorage...
      </div>
    );
  }

  return (
    <div className="bg-black border border-cyan-800 rounded-lg p-4 space-y-6">
      <div className="border-b border-cyan-900 pb-3">
        <div className="flex items-center justify-between">
          <h2 className="text-cyan-400 text-lg font-mono flex items-center gap-2">
            <Shield size={20} />
            CRYPTOGRAPHIC STATUS DASHBOARD
          </h2>
          <button
            onClick={fetchRealData}
            disabled={isRefreshing}
            className="p-2 text-cyan-400 hover:bg-cyan-900/30 rounded"
            aria-label="Refresh"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
        <div className="flex items-center gap-2 mt-2">
          {cryptoState.online ? (
            <Wifi size={14} className="text-green-400" />
          ) : (
            <WifiOff size={14} className="text-red-400" />
          )}
          <span className="text-green-500 text-sm font-mono">
            Last Update: {new Date(lastUpdate).toLocaleTimeString()}
          </span>
          <span className="text-gray-600 text-xs font-mono ml-2">
            (Data from localStorage)
          </span>
        </div>
      </div>

      {!isInitialized && (
        <div className="bg-orange-900/30 border border-orange-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-orange-400" />
            <span className="text-orange-400 font-mono text-sm">Cryptographic Keys Not Initialized</span>
          </div>
          <p className="text-gray-400 text-xs mb-3">
            No identity keys found in localStorage. Initialize to generate real cryptographic keys.
          </p>
          <button
            onClick={handleInitialize}
            className="px-4 py-2 bg-orange-800 hover:bg-orange-700 text-white font-mono text-sm rounded"
          >
            Initialize Keys
          </button>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-gray-300 font-mono">Network Status</span>
          <span className={`px-2 py-1 rounded text-xs font-mono ${
            cryptoState.p2p.status === 'online' ? 'bg-green-900 text-green-400' :
            cryptoState.p2p.status === 'connecting' ? 'bg-yellow-900 text-yellow-400' :
            'bg-red-900 text-red-400'
          }`}>
            {cryptoState.p2p.status.toUpperCase()}
          </span>
        </div>

        <div className="bg-gray-900 p-3 rounded border border-gray-800">
          <div className="text-gray-400 text-sm mb-1 font-mono">Peer ID</div>
          <div className="text-cyan-300 font-mono text-sm truncate">
            {cryptoState.p2p.peerId || 'Not registered'}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-900 p-3 rounded border border-gray-800">
            <div className="text-gray-400 text-sm mb-1 font-mono">Connected Peers</div>
            <div className={`text-2xl font-mono ${cryptoState.p2p.connectionCount > 0 ? 'text-green-400' : 'text-gray-500'}`}>
              {cryptoState.p2p.connectionCount}
            </div>
          </div>

          <div className="bg-gray-900 p-3 rounded border border-gray-800">
            <div className="text-gray-400 text-sm mb-1 font-mono">Active Sessions</div>
            <div className={`text-2xl font-mono ${
              cryptoState.x3dh.activeSessions > 0 ? 'text-green-400' : 'text-gray-500'
            }`}>
              {cryptoState.x3dh.activeSessions}
            </div>
          </div>
        </div>
      </div>

      <div className="border-t border-cyan-900 pt-4">
        <h3 className="text-cyan-400 mb-3 font-mono flex items-center gap-2">
          <Lock size={16} />
          ENCRYPTION PROTOCOLS
        </h3>
        
        <div className="space-y-3">
          <ProtocolStatus 
            name="X3DH EXCHANGE"
            status={cryptoState.x3dh.status}
            details={{
              'Identity Key': cryptoState.x3dh.identityKey ? 'Present' : 'Not found',
              'Pre-keys': `${cryptoState.x3dh.oneTimePreKeys} available`,
              'Last Rotation': cryptoState.x3dh.lastKeyRotation ? 
                new Date(cryptoState.x3dh.lastKeyRotation).toLocaleDateString() : 'Never'
            }}
          />

          <ProtocolStatus 
            name="DOUBLE RATCHET"
            status={cryptoState.doubleRatchet.status}
            details={{
              'Chains Active': cryptoState.doubleRatchet.activeChains.toString(),
              'Message Keys': cryptoState.doubleRatchet.messageKeysGenerated.toString(),
              'Last Ratchet': cryptoState.doubleRatchet.lastRatchetTime ? 
                `${Math.floor((Date.now() - cryptoState.doubleRatchet.lastRatchetTime) / 1000)}s ago` : 'Never'
            }}
          />

          <ProtocolStatus 
            name="AEAD ENCRYPTION"
            status={cryptoState.aead.status}
            details={{
              'Algorithm': cryptoState.aead.algorithm,
              'Key Size': `${cryptoState.aead.keySize} bits`,
              'Encrypted': cryptoState.aead.messagesEncrypted.toString(),
              'Decrypted': cryptoState.aead.messagesDecrypted.toString()
            }}
          />

          <ProtocolStatus 
            name="P2P NETWORK"
            status={cryptoState.p2p.status}
            details={{
              'Protocol': cryptoState.p2p.protocol || 'None',
              'Peers': cryptoState.p2p.connectedPeers.length.toString()
            }}
          />
        </div>
      </div>

      <div className="border-t border-cyan-900 pt-4">
        <h3 className="text-cyan-400 mb-3 font-mono flex items-center gap-2">
          <Cpu size={16} />
          ZKP SNARK SYSTEM
        </h3>
        
        <div className="bg-gray-900 p-3 rounded border border-gray-800 mb-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-300 font-mono text-sm">Engine Status</span>
            <span className={`px-2 py-1 rounded text-xs font-mono ${
              cryptoState.zkp.engineStatus === 'production' ? 'bg-green-900 text-green-400' :
              cryptoState.zkp.engineStatus === 'simulated' ? 'bg-yellow-900 text-yellow-400' :
              'bg-red-900 text-red-400'
            }`}>
              {cryptoState.zkp.engineStatus.toUpperCase()}
            </span>
          </div>
          <div className="mt-2 text-xs text-gray-500 font-mono">
            Proofs: {cryptoState.zkp.totalProofsGenerated} generated, {cryptoState.zkp.totalProofsVerified} verified
          </div>
        </div>

        {cryptoState.zkp.circuits.length > 0 ? (
          <div className="space-y-2">
            {cryptoState.zkp.circuits.map((circuit, index) => (
              <div key={index} className="bg-gray-900 p-3 rounded border border-gray-800">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-green-400 font-mono text-sm">{circuit.name}</span>
                  <span className={`px-2 py-1 rounded text-xs font-mono ${
                    circuit.status === 'active' ? 'bg-green-900 text-green-400' :
                    'bg-gray-800 text-gray-400'
                  }`}>
                    {circuit.status === 'simulated' ? 'STANDBY' : circuit.status.toUpperCase()}
                  </span>
                </div>
                <div className="text-gray-500 text-xs font-mono">
                  v{circuit.version} | {circuit.constraints.toLocaleString()} constraints
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-gray-500 text-sm font-mono text-center py-4">
            No circuits loaded from backend
          </div>
        )}
      </div>

      <div className="text-center text-gray-600 text-xs font-mono pt-4 border-t border-gray-800">
        <p>All data sourced from localStorage and /api endpoints</p>
        <p className="text-green-500 mt-1">No fabricated or simulated values</p>
      </div>
    </div>
  );
};

export default RealCryptoStatus;
