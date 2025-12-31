import React, { useState } from 'react';
import { X, User, Radar, QrCode } from 'lucide-react';
import MeshManualContactAdd from './MeshManualContactAdd';
import MeshNearbyPeerScanner from './MeshNearbyPeerScanner';
import MeshQRCodeScanner from './MeshQRCodeScanner';

interface MeshAddContactDialogProps {
  onAdd: (contact: { peerId: string; method: 'manual' | 'nearby' | 'qr' }) => void;
  onClose: () => void;
}

export function MeshAddContactDialog({ onAdd, onClose }: MeshAddContactDialogProps) {
  const [activeTab, setActiveTab] = useState<'manual' | 'nearby' | 'qr'>('manual');

  const tabs = [
    { id: 'manual' as const, label: 'MANUAL', icon: User },
    { id: 'nearby' as const, label: 'NEARBY', icon: Radar },
    { id: 'qr' as const, label: 'QR_SCAN', icon: QrCode }
  ];

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[400] flex items-center justify-center p-4">
      <div className="w-full max-w-2xl h-[80vh] border-[0.5px] border-[#4caf50]/20 bg-[#0a1a0a]/95 flex flex-col overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.95)]">
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[#00f3ff]/50 to-transparent"></div>
        
        <div className="flex items-center justify-between p-6 border-b-[0.5px] border-[#4caf50]/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border-[0.5px] border-[#00f3ff]/40 flex items-center justify-center bg-[#00f3ff]/10">
              <Radar size={16} className="text-[#00f3ff]" />
            </div>
            <div>
              <h2 className="text-[12px] font-black text-[#00f3ff] uppercase tracking-widest">ADD_NODE</h2>
              <p className="text-[7px] font-mono text-[#4caf50]/60 uppercase mt-0.5">INITIATE_NEW_CONNECTION</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 border-[0.5px] border-[#4caf50]/20 hover:border-red-500/40 hover:bg-red-500/10 transition-all group"
          >
            <X size={14} className="text-[#4caf50]/40 group-hover:text-red-400" />
          </button>
        </div>

        <div className="flex border-b-[0.5px] border-[#4caf50]/20 shrink-0">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-4 py-3 text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                activeTab === tab.id
                  ? 'text-[#00f3ff] bg-[#00f3ff]/10 border-b-[0.5px] border-[#00f3ff]'
                  : 'text-[#4caf50]/40 hover:text-[#4caf50]/60 hover:bg-black/20'
              }`}
            >
              <tab.icon size={12} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'manual' && (
            <MeshManualContactAdd
              onAdd={(peerId) => onAdd({ peerId, method: 'manual' })}
              onCancel={onClose}
            />
          )}
          
          {activeTab === 'nearby' && (
            <MeshNearbyPeerScanner
              onAdd={(peerId) => onAdd({ peerId, method: 'nearby' })}
              onCancel={onClose}
            />
          )}
          
          {activeTab === 'qr' && (
            <MeshQRCodeScanner
              onAdd={(peerId) => onAdd({ peerId, method: 'qr' })}
              onCancel={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default MeshAddContactDialog;
