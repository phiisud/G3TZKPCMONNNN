import React, { useState } from 'react';
import { User, Check, AlertCircle } from 'lucide-react';

interface ManualContactAddProps {
  onAdd: (peerId: string) => void;
  onCancel: () => void;
}

export function ManualContactAdd({ onAdd, onCancel }: ManualContactAddProps) {
  const [peerId, setPeerId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');

  const validatePeerId = (id: string): boolean => {
    if (!id || id.length < 20) {
      setError('Peer ID is too short');
      return false;
    }

    if (!/^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/.test(id)) {
      setError('Invalid Peer ID format (must be base58)');
      return false;
    }

    setError('');
    return true;
  };

  const handleAdd = () => {
    if (validatePeerId(peerId)) {
      onAdd(peerId);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setPeerId(text.trim());
      validatePeerId(text.trim());
    } catch (err) {
      setError('Failed to read from clipboard');
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <User className="w-8 h-8 text-cyan-400" />
        </div>
        <h3 className="text-lg font-bold text-white mb-2">Add by Peer ID</h3>
        <p className="text-sm text-gray-400">
          Enter the peer's unique identifier to establish a connection
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Peer ID *
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={peerId}
            onChange={(e) => {
              setPeerId(e.target.value);
              setError('');
            }}
            placeholder="12D3KooW..."
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 font-mono text-sm"
          />
          <button
            onClick={handlePaste}
            className="px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-700 transition-colors"
          >
            Paste
          </button>
        </div>
        {error && (
          <div className="mt-2 flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Display Name (optional)
        </label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="John Doe"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
        />
      </div>

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 px-6 py-3 bg-gray-800 text-white font-bold rounded-lg hover:bg-gray-700 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleAdd}
          disabled={!peerId || !!error}
          className="flex-1 px-6 py-3 bg-cyan-500 text-black font-bold rounded-lg hover:bg-cyan-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Check className="w-5 h-5" />
          Add Contact
        </button>
      </div>
    </div>
  );
}

export default ManualContactAdd;
