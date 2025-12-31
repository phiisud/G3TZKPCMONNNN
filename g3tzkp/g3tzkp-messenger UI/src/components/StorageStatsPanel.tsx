import React, { useEffect, useState } from 'react';
import { Database, HardDrive, Lock, Archive, Trash2, RefreshCw, Shield, FileText, Zap } from 'lucide-react';
import { useG3ZKP } from '../contexts/G3ZKPContext';

const StorageStatsPanel: React.FC = () => {
  const { isInitialized, storageStats, refreshStorageStats } = useG3ZKP();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (isInitialized) {
      refreshStorageStats();
      const interval = setInterval(() => refreshStorageStats(), 5000);
      return () => clearInterval(interval);
    }
  }, [isInitialized, refreshStorageStats]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshStorageStats();
    setTimeout(() => setRefreshing(false), 500);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="w-full space-y-6">
      <div className="border-[0.5px] border-[#4caf50]/40 bg-black/40 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="orbitron text-sm font-black tracking-widest text-[#00f3ff] uppercase flex items-center gap-3">
            <Database size={16} className="text-[#4caf50]" />
            STORAGE ENGINE
          </h3>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 border-[0.5px] border-[#4caf50]/30 hover:border-[#00f3ff]/50 transition-all disabled:opacity-50"
          >
            <RefreshCw size={12} className={`text-[#4caf50] ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="border-[0.5px] border-[#4caf50]/20 bg-black/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <FileText size={12} className="text-[#4caf50]/60" />
              <span className="text-[8px] uppercase tracking-widest opacity-50 font-mono">Messages</span>
            </div>
            <p className="text-2xl font-black text-[#4caf50] font-mono">{storageStats?.messageCount || 0}</p>
            <p className="text-[7px] opacity-40 mt-1 font-mono">Stored Total</p>
          </div>

          <div className="border-[0.5px] border-[#4caf50]/20 bg-black/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <HardDrive size={12} className="text-[#00f3ff]/60" />
              <span className="text-[8px] uppercase tracking-widest opacity-50 font-mono">Size</span>
            </div>
            <p className="text-2xl font-black text-[#00f3ff] font-mono">{storageStats ? formatBytes(storageStats.totalSize) : '0 B'}</p>
            <p className="text-[7px] opacity-40 mt-1 font-mono">Database Size</p>
          </div>

          <div className="border-[0.5px] border-[#4caf50]/20 bg-black/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Lock size={12} className="text-[#4caf50]/60" />
              <span className="text-[8px] uppercase tracking-widest opacity-50 font-mono">Sessions</span>
            </div>
            <p className="text-2xl font-black text-[#4caf50] font-mono">{storageStats?.sessionCount || 0}</p>
            <p className="text-[7px] opacity-40 mt-1 font-mono">Active Sessions</p>
          </div>

          <div className="border-[0.5px] border-[#4caf50]/20 bg-black/20 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Shield size={12} className="text-[#00f3ff]/60" />
              <span className="text-[8px] uppercase tracking-widest opacity-50 font-mono">Proofs</span>
            </div>
            <p className="text-2xl font-black text-[#00f3ff] font-mono">{storageStats?.zkProofCount || 0}</p>
            <p className="text-[7px] opacity-40 mt-1 font-mono">ZK Proofs</p>
          </div>
        </div>
      </div>

      <div className="border-[0.5px] border-[#4caf50]/40 bg-black/40 p-6">
        <h4 className="text-[10px] font-black tracking-widest text-[#00f3ff] uppercase mb-4">ENCRYPTION STATUS</h4>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-black/20 border-[0.5px] border-[#4caf50]/20">
            <div className="flex items-center gap-3">
              <Lock size={14} className="text-[#4caf50]" />
              <div>
                <p className="text-[9px] font-black text-[#00f3ff] tracking-wider">ENCRYPTION AT REST</p>
                <p className="text-[7px] opacity-50 font-mono mt-1">XSalsa20-Poly1305</p>
              </div>
            </div>
            <div className="px-3 py-1 bg-[#4caf50]/20 border-[0.5px] border-[#4caf50]/40">
              <span className="text-[7px] font-mono text-[#4caf50] font-black">ACTIVE</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StorageStatsPanel;
