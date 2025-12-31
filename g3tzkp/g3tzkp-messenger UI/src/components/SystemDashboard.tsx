import React, { useState } from 'react';
import { Activity, Database, Network, Shield, ChevronRight } from 'lucide-react';
import NetworkStatus from './NetworkStatus';
import StorageStatsPanel from './StorageStatsPanel';
import { useG3ZKP } from '../contexts/G3ZKPContext';

const SystemDashboard: React.FC = () => {
  const { isInitialized, localPeerId, networkStats, storageStats, messages, statusMessage } = useG3ZKP();
  const [activeTab, setActiveTab] = useState<'overview' | 'network' | 'storage'>('overview');

  const tabs = [
    { id: 'overview' as const, label: 'OVERVIEW', icon: Activity },
    { id: 'network' as const, label: 'NETWORK', icon: Network },
    { id: 'storage' as const, label: 'STORAGE', icon: Database },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="border-b-[0.5px] border-[#4caf50]/30 bg-black/40 p-6">
        <h2 className="orbitron text-lg font-black tracking-widest text-[#00f3ff] mb-2">SYSTEM DASHBOARD</h2>
        <p className="text-[8px] font-mono opacity-50 uppercase tracking-wider">Real-time Backend Integration Status</p>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 border-r-[0.5px] border-[#4caf50]/30 bg-black/20 overflow-y-auto p-4 space-y-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-[9px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab.id
                  ? 'bg-[#00f3ff]/20 border-[0.5px] border-[#00f3ff]/40 text-[#00f3ff]'
                  : 'border-[0.5px] border-[#4caf50]/20 text-[#4caf50]/60 hover:text-[#4caf50]'
              }`}
            >
              <tab.icon size={14} />
              <span className="flex-1 text-left">{tab.label}</span>
              <ChevronRight size={10} className="opacity-50" />
            </button>
          ))}

          <div className="p-4 border-t-[0.5px] border-[#4caf50]/30 mt-4">
            <h4 className="text-[8px] font-black tracking-widest text-[#00f3ff] uppercase mb-3">SYSTEM STATUS</h4>
            <div className="space-y-2 text-[7px] font-mono">
              <div className="flex justify-between items-center">
                <span className="opacity-50">Bridge</span>
                <span className={`font-black ${isInitialized ? 'text-[#4caf50]' : 'text-[#f44336]'}`}>
                  {isInitialized ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="opacity-50">Messages</span>
                <span className="text-[#00f3ff] font-black">{messages.length}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === 'overview' && (
            <div className="space-y-6 max-w-6xl">
              <div className="border-[0.5px] border-[#4caf50]/40 bg-black/40 p-6">
                <h3 className="orbitron text-sm font-black tracking-widest text-[#00f3ff] mb-4 uppercase">BACKEND INTEGRATION</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border-[0.5px] border-[#4caf50]/20 bg-black/20 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[9px] font-black text-[#00f3ff]">NETWORK ENGINE</span>
                      <div className={`w-2 h-2 rounded-full ${isInitialized ? 'bg-[#4caf50]' : 'bg-[#f44336]'}`} />
                    </div>
                    <p className="text-[7px] font-mono opacity-70 mb-2">libp2p P2P Network</p>
                    <div className="text-[7px] font-mono space-y-1">
                      <div className="flex justify-between">
                        <span className="opacity-50">Status:</span>
                        <span className="text-[#4caf50]">{isInitialized ? 'Active' : 'Init'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="opacity-50">Messages:</span>
                        <span className="text-[#00f3ff]">{networkStats?.messagesSent || 0}</span>
                      </div>
                    </div>
                  </div>

                  <div className="border-[0.5px] border-[#4caf50]/20 bg-black/20 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[9px] font-black text-[#00f3ff]">STORAGE ENGINE</span>
                      <div className={`w-2 h-2 rounded-full ${isInitialized ? 'bg-[#4caf50]' : 'bg-[#f44336]'}`} />
                    </div>
                    <p className="text-[7px] font-mono opacity-70 mb-2">LevelDB Encryption</p>
                    <div className="text-[7px] font-mono space-y-1">
                      <div className="flex justify-between">
                        <span className="opacity-50">Messages:</span>
                        <span className="text-[#4caf50]">{storageStats?.messageCount || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-[0.5px] border-[#4caf50]/40 bg-black/40 p-6">
                <h3 className="orbitron text-sm font-black tracking-widest text-[#00f3ff] uppercase mb-4">STATUS</h3>
                <div className="space-y-2 text-[8px] font-mono">
                  <div className="flex items-start gap-2 p-3 bg-black/20 border-[0.5px] border-[#4caf50]/10">
                    <span className="text-[#4caf50]">&gt;&gt;</span>
                    <span className="text-[#4caf50]">{statusMessage}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'network' && <NetworkStatus />}
          {activeTab === 'storage' && <StorageStatsPanel />}
        </div>
      </div>
    </div>
  );
};

export default SystemDashboard;
