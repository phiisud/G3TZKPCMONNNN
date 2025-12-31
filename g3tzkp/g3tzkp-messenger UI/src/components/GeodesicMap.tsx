import React, { useEffect, useState, useMemo } from 'react';
import { Shield, Lock, Key, Zap, RefreshCw, CheckCircle2, AlertTriangle, Binary, Hash, Activity, Network, Database } from 'lucide-react';
import { useG3ZKP } from '../contexts/G3ZKPContext';

interface CryptoDisplayData {
  protocol: string;
  status: 'active' | 'standby' | 'error';
  description: string;
  details: Record<string, string | number>;
}

const GeodesicMap: React.FC = () => {
  const {
    isInitialized,
    localPeerId,
    identityPublicKey,
    connectedPeers,
    networkStats,
    storageStats,
    activeSessions,
    pendingProofs,
    circuits,
    connectionQuality,
    getKeyBundle
  } = useG3ZKP();

  const [selectedProtocol, setSelectedProtocol] = useState<string | null>(null);
  const [stars, setStars] = useState<{ id: string, x: number, y: number, size: number, opacity: number }[]>([]);

  useEffect(() => {
    const pts = [];
    const count = 80;
    for (let i = 0; i < count; i++) {
      pts.push({
        id: `S_${i}`,
        x: (Math.random() - 0.5) * 1000,
        y: (Math.random() - 0.5) * 1000,
        size: Math.random() * 1.2 + 0.3,
        opacity: Math.random() * 0.4 + 0.1
      });
    }
    setStars(pts);
  }, []);

  const cryptoProtocols: CryptoDisplayData[] = useMemo(() => {
    let keyBundle = null;
    try {
      keyBundle = isInitialized ? getKeyBundle() : null;
    } catch {}

    return [
      {
        protocol: 'ZKP_SNARK',
        status: circuits.filter(c => c.status === 'ready').length > 0 ? 'active' : 'standby',
        description: 'Zero-Knowledge Proof System',
        details: {
          'Circuits Loaded': circuits.length,
          'Ready': circuits.filter(c => c.status === 'ready').length,
          'Proofs Generated': pendingProofs.length,
          'Verified': pendingProofs.filter(p => p.verified).length,
          'Primary Circuit': 'MessageSendProof',
          'Constraint System': 'Groth16 + KZG'
        }
      },
      {
        protocol: 'X3DH_EXCHANGE',
        status: activeSessions.length > 0 ? 'active' : 'standby',
        description: 'Extended Triple Diffie-Hellman Key Agreement',
        details: {
          'Active Sessions': activeSessions.length,
          'Identity Key': identityPublicKey?.substring(0, 16) + '...' || 'N/A',
          'Signed PreKey': keyBundle?.signedPreKey?.substring(0, 12) + '...' || 'N/A',
          'One-Time PreKeys': keyBundle?.oneTimePreKeys?.length || 0,
          'Protocol Version': 'X3DH v1.0',
          'Curve': 'Curve25519'
        }
      },
      {
        protocol: 'DOUBLE_RATCHET',
        status: activeSessions.some(s => s.messageCount > 0) ? 'active' : 'standby',
        description: 'Forward Secrecy Message Encryption',
        details: {
          'Ratchet Steps': activeSessions.reduce((acc, s) => acc + s.messageCount, 0),
          'Chain Keys': activeSessions.length,
          'Messages Encrypted': storageStats?.messageCount || 0,
          'Last Rotation': activeSessions[0]?.lastUsed ? new Date(activeSessions[0].lastUsed).toLocaleTimeString() : 'N/A',
          'KDF': 'HKDF-SHA256',
          'Cipher': 'AES-256-GCM'
        }
      },
      {
        protocol: 'AEAD_ENCRYPTION',
        status: 'active',
        description: 'Authenticated Encryption with Associated Data',
        details: {
          'Algorithm': 'XSalsa20-Poly1305',
          'Key Size': '256-bit',
          'Nonce Size': '192-bit',
          'Tag Size': '128-bit',
          'Messages Protected': storageStats?.messageCount || 0,
          'Storage Encrypted': `${((storageStats?.totalSize || 0) / 1024).toFixed(2)} KB`
        }
      },
      {
        protocol: 'P2P_NETWORK',
        status: connectedPeers.length > 0 ? 'active' : 'standby',
        description: 'Decentralized Peer-to-Peer Mesh Network',
        details: {
          'Connected Peers': connectedPeers.length,
          'Online': connectedPeers.filter(p => p.status === 'online').length,
          'Messages Sent': networkStats?.messagesSent || 0,
          'Messages Received': networkStats?.messagesReceived || 0,
          'Routes Cached': networkStats?.routesCached || 0,
          'Transport': 'libp2p + WebRTC'
        }
      }
    ];
  }, [isInitialized, circuits, pendingProofs, activeSessions, storageStats, networkStats, connectedPeers, identityPublicKey, getKeyBundle]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-[#4caf50] border-[#4caf50]';
      case 'standby': return 'text-yellow-500 border-yellow-500';
      case 'error': return 'text-red-500 border-red-500';
      default: return 'text-[#4caf50]/50 border-[#4caf50]/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle2 size={12} />;
      case 'standby': return <Activity size={12} />;
      case 'error': return <AlertTriangle size={12} />;
      default: return null;
    }
  };

  const getProtocolIcon = (protocol: string) => {
    switch (protocol) {
      case 'ZKP_SNARK': return <Shield size={16} />;
      case 'X3DH_EXCHANGE': return <Key size={16} />;
      case 'DOUBLE_RATCHET': return <RefreshCw size={16} />;
      case 'AEAD_ENCRYPTION': return <Lock size={16} />;
      case 'P2P_NETWORK': return <Network size={16} />;
      default: return <Binary size={16} />;
    }
  };

  return (
    <div className="w-full h-full flex flex-col lg:flex-row overflow-hidden">
      <div className="hidden lg:block w-1/3 h-full relative">
        <svg viewBox="-500 -500 1000 1000" className="w-full h-full absolute inset-0">
          {[0, 1, 2].map(i => (
            <g key={i} className="animate-[spin_60s_linear_infinite]" style={{ animationDirection: i % 2 === 0 ? 'normal' : 'reverse', animationDuration: `${40 + i * 20}s` }}>
              <ellipse 
                cx="0" cy="0" rx={320 + i * 60} ry={140 + i * 25} 
                fill="none" 
                stroke="#00f3ff" 
                strokeWidth="0.5" 
                opacity={0.15 - i * 0.04} 
                strokeDasharray="5, 20"
              />
              <ellipse 
                cx="0" cy="0" rx={320 + i * 60} ry={140 + i * 25} 
                fill="none" 
                stroke="#4caf50" 
                strokeWidth="0.5" 
                opacity={0.08} 
              />
            </g>
          ))}

          {stars.map((star) => (
            <circle 
              key={star.id} 
              cx={star.x} 
              cy={star.y} 
              r={star.size} 
              fill={Math.random() > 0.5 ? "#00f3ff" : "#4caf50"} 
              opacity={star.opacity} 
              className="animate-pulse"
              style={{ animationDelay: `${Math.random() * 5}s` }}
            />
          ))}

          <g opacity="0.3">
              <circle cx="0" cy="0" r="100" fill="none" stroke="#00f3ff" strokeWidth="0.3" />
              {[0, 60, 120, 180, 240, 300].map(angle => (
                  <circle 
                      key={angle} 
                      cx={100 * Math.cos(angle * Math.PI / 180)} 
                      cy={100 * Math.sin(angle * Math.PI / 180)} 
                      r="100" 
                      fill="none" 
                      stroke="#4caf50" 
                      strokeWidth="0.3" 
                  />
              ))}
          </g>

          {connectedPeers.slice(0, 12).map((peer, i) => {
            const angle = (i / 12) * Math.PI * 2;
            const radius = 200 + (i % 3) * 50;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            return (
              <g key={peer.peerId}>
                <circle 
                  cx={x} 
                  cy={y} 
                  r={8} 
                  fill={peer.status === 'online' ? '#4caf50' : '#4caf50'} 
                  opacity={peer.status === 'online' ? 0.8 : 0.3}
                  className={peer.status === 'online' ? 'animate-pulse' : ''}
                />
                <line 
                  x1="0" y1="0" 
                  x2={x} y2={y} 
                  stroke="#00f3ff" 
                  strokeWidth="0.3" 
                  opacity="0.2" 
                  strokeDasharray="4,4"
                />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-8 space-y-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="orbitron text-lg font-black text-[#00f3ff] tracking-widest uppercase">CRYPTOGRAPHIC STATUS DASHBOARD</h2>
            <p className="text-[8px] text-[#4caf50]/60 uppercase tracking-widest mt-1">Real-time encryption protocol monitoring</p>
          </div>
          <div className={`flex items-center gap-2 px-3 py-2 border-[0.5px] ${getStatusColor(connectionQuality === 'excellent' || connectionQuality === 'good' ? 'active' : 'standby')}`}>
            <div className={`w-2 h-2 rounded-full ${connectionQuality === 'excellent' || connectionQuality === 'good' ? 'bg-[#4caf50] animate-pulse' : 'bg-yellow-500'}`} />
            <span className="text-[8px] font-black uppercase tracking-widest">{connectionQuality}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="p-4 border-[0.5px] border-[#00f3ff]/20 bg-black/40">
            <div className="text-[8px] text-[#4caf50]/60 uppercase tracking-widest mb-1">Peer ID</div>
            <div className="text-[10px] text-[#00f3ff] font-mono truncate">{localPeerId?.substring(0, 16)}...</div>
          </div>
          <div className="p-4 border-[0.5px] border-[#00f3ff]/20 bg-black/40">
            <div className="text-[8px] text-[#4caf50]/60 uppercase tracking-widest mb-1">Connected Peers</div>
            <div className="text-[18px] text-[#00f3ff] font-black">{connectedPeers.length}</div>
          </div>
          <div className="p-4 border-[0.5px] border-[#00f3ff]/20 bg-black/40">
            <div className="text-[8px] text-[#4caf50]/60 uppercase tracking-widest mb-1">Active Sessions</div>
            <div className="text-[18px] text-[#00f3ff] font-black">{activeSessions.length}</div>
          </div>
          <div className="p-4 border-[0.5px] border-[#00f3ff]/20 bg-black/40">
            <div className="text-[8px] text-[#4caf50]/60 uppercase tracking-widest mb-1">ZKP Proofs</div>
            <div className="text-[18px] text-[#00f3ff] font-black">{pendingProofs.filter(p => p.verified).length}/{pendingProofs.length}</div>
          </div>
        </div>

        <div className="space-y-3">
          {cryptoProtocols.map((proto) => (
            <div 
              key={proto.protocol}
              className={`border-[0.5px] transition-all cursor-pointer ${
                selectedProtocol === proto.protocol 
                  ? 'border-[#00f3ff]/60 bg-[#00f3ff]/5' 
                  : 'border-[#4caf50]/20 bg-black/20 hover:border-[#4caf50]/40'
              }`}
              onClick={() => setSelectedProtocol(selectedProtocol === proto.protocol ? null : proto.protocol)}
            >
              <div className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 border-[0.5px] ${getStatusColor(proto.status)} bg-black`}>
                    {getProtocolIcon(proto.protocol)}
                  </div>
                  <div>
                    <h3 className="text-[11px] font-black text-[#00f3ff] uppercase tracking-wider">{proto.protocol.replace(/_/g, ' ')}</h3>
                    <p className="text-[8px] text-[#4caf50]/60 uppercase tracking-wider">{proto.description}</p>
                  </div>
                </div>
                <div className={`flex items-center gap-2 px-3 py-1.5 border-[0.5px] ${getStatusColor(proto.status)}`}>
                  {getStatusIcon(proto.status)}
                  <span className="text-[8px] font-black uppercase">{proto.status}</span>
                </div>
              </div>

              {selectedProtocol === proto.protocol && (
                <div className="border-t-[0.5px] border-[#4caf50]/10 p-4 bg-black/40 animate-in slide-in-from-top-2 duration-200">
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(proto.details).map(([key, value]) => (
                      <div key={key} className="p-3 border-[0.5px] border-[#4caf50]/10 bg-black/20">
                        <div className="text-[7px] text-[#4caf50]/50 uppercase tracking-widest mb-1">{key}</div>
                        <div className="text-[10px] text-[#00f3ff] font-mono truncate">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {activeSessions.length > 0 && (
          <div className="mt-6">
            <h3 className="text-[10px] font-black text-[#4caf50] uppercase tracking-widest mb-3">Active Crypto Sessions</h3>
            <div className="space-y-2">
              {activeSessions.map((session) => (
                <div key={session.sessionId} className="p-3 border-[0.5px] border-[#4caf50]/20 bg-black/20 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#4caf50] animate-pulse" />
                    <span className="text-[9px] font-mono text-[#00f3ff]">{session.peerId.substring(0, 20)}...</span>
                  </div>
                  <div className="flex items-center gap-4 text-[8px] text-[#4caf50]/60">
                    <span>Messages: {session.messageCount}</span>
                    <span>Created: {new Date(session.createdAt).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {circuits.length > 0 && (
          <div className="mt-6">
            <h3 className="text-[10px] font-black text-[#4caf50] uppercase tracking-widest mb-3">ZKP Circuit Registry</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {circuits.map((circuit) => (
                <div key={circuit.name} className="p-3 border-[0.5px] border-[#4caf50]/20 bg-black/20 flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-black text-[#00f3ff] uppercase">{circuit.name}</span>
                    <p className="text-[7px] text-[#4caf50]/60">v{circuit.version} | {circuit.constraints} constraints</p>
                  </div>
                  <div className={`px-2 py-1 border-[0.5px] text-[7px] font-black uppercase ${
                    circuit.status === 'ready' ? 'border-[#4caf50] text-[#4caf50]' : 'border-yellow-500 text-yellow-500'
                  }`}>
                    {circuit.status}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GeodesicMap;
