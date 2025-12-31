import React, { useEffect, useState } from 'react';
import { Network, Activity, Signal, Users, Zap, Globe, CheckCircle } from 'lucide-react';
import { useG3ZKP } from '../contexts/G3ZKPContext';

const NetworkStatus: React.FC = () => {
  const { isInitialized, connectedPeers, networkStats, refreshNetworkStats } = useG3ZKP();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (isInitialized) {
      const interval = setInterval(() => refreshNetworkStats(), 3000);
      return () => clearInterval(interval);
    }
  }, [isInitialized, refreshNetworkStats]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshNetworkStats();
    setTimeout(() => setRefreshing(false), 500);
  };

  return (
    <div className="w-full space-y-6">
      <div className="border-[0.5px] border-[#4caf50]/40 bg-black/40 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="orbitron text-sm font-black tracking-widest text-[#00f3ff] uppercase flex items-center gap-3">
            <Network size={16} className="text-[#4caf50]" />
            NETWORK STATUS
          </h3>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 border-[0.5px] border-[#4caf50]/30 hover:border-[#00f3ff]/50 transition-all disabled:opacity-50"
          >
            <Activity size={12} className={`text-[#4caf50] ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border-[0.5px] border-[#4caf50]/20 bg-black/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users size={12} className="text-[#4caf50]/60" />
              <span className="text-[8px] uppercase tracking-widest opacity-50 font-mono">Connected</span>
            </div>
            <p className="text-2xl font-black text-[#4caf50] font-mono">{connectedPeers.length}</p>
            <p className="text-[7px] opacity-40 mt-1 font-mono">Active Peers</p>
          </div>

          <div className="border-[0.5px] border-[#4caf50]/20 bg-black/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={12} className="text-[#00f3ff]/60" />
              <span className="text-[8px] uppercase tracking-widest opacity-50 font-mono">Messages</span>
            </div>
            <p className="text-2xl font-black text-[#00f3ff] font-mono">{networkStats?.messagesSent || 0}</p>
            <p className="text-[7px] opacity-40 mt-1 font-mono">Transmitted</p>
          </div>

          <div className="border-[0.5px] border-[#4caf50]/20 bg-black/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Signal size={12} className="text-[#4caf50]/60" />
              <span className="text-[8px] uppercase tracking-widest opacity-50 font-mono">Routes</span>
            </div>
            <p className="text-2xl font-black text-[#4caf50] font-mono">{networkStats?.routesCached || 0}</p>
            <p className="text-[7px] opacity-40 mt-1 font-mono">Cached Routes</p>
          </div>

          <div className="border-[0.5px] border-[#4caf50]/20 bg-black/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Globe size={12} className="text-[#00f3ff]/60" />
              <span className="text-[8px] uppercase tracking-widest opacity-50 font-mono">Discovery</span>
            </div>
            <p className="text-2xl font-black text-[#00f3ff] font-mono">{networkStats?.peersDiscovered || 0}</p>
            <p className="text-[7px] opacity-40 mt-1 font-mono">Discovered</p>
          </div>
        </div>
      </div>

      <div className="border-[0.5px] border-[#4caf50]/40 bg-black/40 p-6">
        <h4 className="text-[10px] font-black tracking-widest text-[#00f3ff] uppercase mb-4">NETWORK DETAILS</h4>
        <div className="space-y-3 text-[8px] font-mono">
          <div className="flex justify-between items-center p-3 bg-black/20 border-[0.5px] border-[#4caf50]/10">
            <span className="opacity-50">Transport Protocol</span>
            <span className="text-[#4caf50] font-black">libp2p</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-black/20 border-[0.5px] border-[#4caf50]/10">
            <span className="opacity-50">Discovery Methods</span>
            <span className="text-[#4caf50] font-black">mDNS, DHT, Bootstrap</span>
          </div>
          <div className="flex justify-between items-center p-3 bg-black/20 border-[0.5px] border-[#4caf50]/10">
            <span className="opacity-50">Security</span>
            <span className="text-[#4caf50] font-black">Noise Protocol</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetworkStatus;
