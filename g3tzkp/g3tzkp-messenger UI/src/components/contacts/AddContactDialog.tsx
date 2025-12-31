import React, { useState } from 'react';
import { X, User, Radar, QrCode } from 'lucide-react';
import ManualContactAdd from './ManualContactAdd';
import NearbyPeerScanner from './NearbyPeerScanner';
import QRCodeScanner from './QRCodeScanner';

interface AddContactDialogProps {
  onAdd: (contact: { peerId: string; method: 'manual' | 'nearby' | 'qr' }) => void;
  onClose: () => void;
}

export function AddContactDialog({ onAdd, onClose }: AddContactDialogProps) {
  const [activeTab, setActiveTab] = useState<'manual' | 'nearby' | 'qr'>('manual');

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-cyan-500/30 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-xl font-bold text-cyan-400">Add Contact</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex border-b border-gray-800">
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 px-4 py-3 font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'manual'
                ? 'text-cyan-400 border-b-2 border-cyan-500'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <User className="w-4 h-4" />
            Manual
          </button>
          
          <button
            onClick={() => setActiveTab('nearby')}
            className={`flex-1 px-4 py-3 font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'nearby'
                ? 'text-cyan-400 border-b-2 border-cyan-500'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <Radar className="w-4 h-4" />
            Nearby
          </button>
          
          <button
            onClick={() => setActiveTab('qr')}
            className={`flex-1 px-4 py-3 font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'qr'
                ? 'text-cyan-400 border-b-2 border-cyan-500'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <QrCode className="w-4 h-4" />
            QR Code
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'manual' && (
            <ManualContactAdd
              onAdd={(peerId) => onAdd({ peerId, method: 'manual' })}
              onCancel={onClose}
            />
          )}
          
          {activeTab === 'nearby' && (
            <NearbyPeerScanner
              onAdd={(peerId) => onAdd({ peerId, method: 'nearby' })}
              onCancel={onClose}
            />
          )}
          
          {activeTab === 'qr' && (
            <QRCodeScanner
              onAdd={(peerId) => onAdd({ peerId, method: 'qr' })}
              onCancel={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default AddContactDialog;
