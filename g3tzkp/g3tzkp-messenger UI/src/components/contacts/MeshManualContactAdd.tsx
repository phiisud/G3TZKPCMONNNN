import React, { useState } from 'react';
import { User, Check, AlertCircle, Clipboard } from 'lucide-react';

interface MeshManualContactAddProps {
  onAdd: (peerId: string) => void;
  onCancel: () => void;
}

export function MeshManualContactAdd({ onAdd, onCancel }: MeshManualContactAddProps) {
  const [peerId, setPeerId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');

  const validatePeerId = (id: string): boolean => {
    if (!id || id.length < 20) {
      setError('NODE_ID_TOO_SHORT');
      return false;
    }

    if (!/^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/.test(id)) {
      setError('INVALID_NODE_ID_FORMAT_(BASE58_REQUIRED)');
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
      setError('CLIPBOARD_ACCESS_DENIED');
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 border-[0.5px] border-[#00f3ff]/40 bg-[#00f3ff]/10 flex items-center justify-center mx-auto mb-4">
          <User size={32} className="text-[#00f3ff]" />
        </div>
        <h3 className="text-[12px] font-black text-[#00f3ff] uppercase tracking-widest mb-2">MANUAL_NODE_ENTRY</h3>
        <p className="text-[9px] font-mono text-[#4caf50]/60 uppercase">
          INPUT_NODE_IDENTIFIER_TO_ESTABLISH_CONNECTION
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-[9px] font-black text-[#00f3ff] uppercase tracking-widest mb-2">
            NODE_ID <span className="text-red-400">*</span>
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
              className="flex-1 bg-black/40 border-[0.5px] border-[#4caf50]/20 px-4 py-3 text-[10px] outline-none focus:border-[#00f3ff]/40 text-[#00f3ff] font-mono placeholder:text-[#4caf50]/30"
            />
            <button
              onClick={handlePaste}
              className="px-4 py-3 border-[0.5px] border-[#4caf50]/20 bg-black/40 hover:bg-black/60 transition-all text-[9px] font-black text-[#4caf50] uppercase tracking-widest flex items-center gap-2"
            >
              <Clipboard size={12} />
              PASTE
            </button>
          </div>
          {error && (
            <div className="mt-2 flex items-center gap-2 text-[8px] font-mono text-red-400 uppercase">
              <AlertCircle size={12} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <div>
          <label className="block text-[9px] font-black text-[#00f3ff] uppercase tracking-widest mb-2">
            DISPLAY_NAME <span className="text-[#4caf50]/40">(OPTIONAL)</span>
          </label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="AGENT_ALPHA"
            className="w-full bg-black/40 border-[0.5px] border-[#4caf50]/20 px-4 py-3 text-[10px] outline-none focus:border-[#00f3ff]/40 text-[#00f3ff] font-mono uppercase placeholder:text-[#4caf50]/30"
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={onCancel}
          className="flex-1 px-6 py-4 border-[0.5px] border-[#4caf50]/20 bg-black/40 hover:bg-black/60 transition-all text-[10px] font-black text-[#4caf50]/60 uppercase tracking-widest"
        >
          CANCEL
        </button>
        <button
          onClick={handleAdd}
          disabled={!peerId || !!error}
          className="flex-1 px-6 py-4 border-[0.5px] border-[#00f3ff]/40 bg-[#00f3ff]/10 hover:bg-[#00f3ff]/20 transition-all text-[10px] font-black text-[#00f3ff] uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Check size={14} />
          CONNECT_NODE
        </button>
      </div>
    </div>
  );
}

export default MeshManualContactAdd;
