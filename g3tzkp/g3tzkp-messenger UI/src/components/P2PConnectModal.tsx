import React, { useState, useEffect, useRef } from 'react';
import { X, Copy, Check, QrCode, UserPlus, Keyboard, Send, Clock } from 'lucide-react';
import { peerContactService } from '../services/PeerContactService';
import QRCode from 'qrcode';

interface P2PConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  localPeerId: string;
  localPeerName: string;
}

type Mode = 'manual' | 'share';

export const P2PConnectModal: React.FC<P2PConnectModalProps> = ({
  isOpen,
  onClose,
  localPeerId,
  localPeerName
}) => {
  const [mode, setMode] = useState<Mode>('manual');
  const [peerIdInput, setPeerIdInput] = useState('');
  const [contactName, setContactName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setMode('manual');
      setPeerIdInput('');
      setContactName('');
      setError('');
      setSuccess(false);
      setCopied(false);
      generateMyQRCode();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const generateMyQRCode = async () => {
    if (localPeerId) {
      try {
        const url = await QRCode.toDataURL(localPeerId, {
          width: 200,
          margin: 2,
          color: { dark: '#00f3ff', light: '#000000' }
        });
        setQrCodeUrl(url);
      } catch (e) {
        console.error('QR generation failed:', e);
      }
    }
  };

  const handleSendRequest = async () => {
    const trimmedId = peerIdInput.trim();
    
    if (!trimmedId) {
      setError('Please enter a Peer ID');
      return;
    }

    if (trimmedId.length < 10) {
      setError('Invalid Peer ID - too short');
      return;
    }

    if (trimmedId === localPeerId) {
      setError("You can't add yourself");
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const name = contactName.trim() || undefined;
      await peerContactService.sendConnectionRequest(trimmedId, name);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (e: any) {
      setError(e.message || 'Failed to send request');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleSendRequest();
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(localPeerId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 border border-cyan-500/50 rounded-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-lg font-bold text-cyan-400 flex items-center gap-2">
            <UserPlus size={20} />
            Add Contact
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1">
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setMode('manual')}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 text-sm font-medium transition ${
              mode === 'manual' 
                ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-400/5' 
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <Keyboard size={16} />
            Enter ID
          </button>
          <button
            onClick={() => setMode('share')}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 text-sm font-medium transition ${
              mode === 'share' 
                ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-400/5' 
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <QrCode size={16} />
            My ID
          </button>
        </div>

        <div className="p-5">
          {success ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-900/50 border-2 border-green-500 flex items-center justify-center">
                <Clock size={32} className="text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-green-400 mb-2">Request Sent!</h3>
              <p className="text-gray-400 text-sm">Waiting for them to accept your request...</p>
            </div>
          ) : mode === 'manual' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Peer ID</label>
                <input
                  ref={inputRef}
                  type="text"
                  value={peerIdInput}
                  onChange={(e) => setPeerIdInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Paste Peer ID here..."
                  className="w-full p-3 bg-black border border-gray-600 rounded-lg text-sm font-mono text-cyan-300 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none placeholder:text-gray-600"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Nickname (optional)</label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Give them a nickname..."
                  className="w-full p-3 bg-black border border-gray-600 rounded-lg text-sm text-gray-200 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 outline-none placeholder:text-gray-600"
                  disabled={isLoading}
                />
              </div>

              {error && (
                <p className="text-red-400 text-sm text-center bg-red-900/20 p-2 rounded">{error}</p>
              )}

              <button
                onClick={handleSendRequest}
                disabled={isLoading || !peerIdInput.trim()}
                className="w-full p-3 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-white font-bold transition flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={18} />
                    Send Request
                  </>
                )}
              </button>

              <p className="text-gray-500 text-xs text-center">
                They'll receive a notification to accept or deny your request
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-400 text-sm text-center">
                Share your Peer ID so others can send you a request
              </p>

              {qrCodeUrl && (
                <div className="flex justify-center">
                  <img src={qrCodeUrl} alt="My QR Code" className="rounded-lg" />
                </div>
              )}

              <div className="relative">
                <input
                  type="text"
                  value={localPeerId}
                  readOnly
                  className="w-full p-3 pr-12 bg-black border border-gray-600 rounded-lg text-xs font-mono text-cyan-300"
                />
                <button
                  onClick={copyToClipboard}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-cyan-900 rounded hover:bg-cyan-800 transition"
                >
                  {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} className="text-cyan-400" />}
                </button>
              </div>

              {copied && (
                <p className="text-green-400 text-sm text-center">Copied to clipboard!</p>
              )}

              <div className="p-3 bg-gray-800/50 rounded-lg">
                <p className="text-gray-400 text-xs text-center">
                  Your name: <span className="text-cyan-400">{localPeerName}</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default P2PConnectModal;
