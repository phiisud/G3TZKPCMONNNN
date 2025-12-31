import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, QrCode, Search, Camera, Copy, Check, 
  UserPlus, Scan, Share2, Users, Loader2, AlertCircle
} from 'lucide-react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';

interface PeerDiscoveryPopupProps {
  isOpen: boolean;
  onClose: () => void;
  myPeerId: string;
  onAddPeer: (peerId: string, displayName?: string) => void;
  onScanComplete?: (peerId: string) => void;
}

type TabType = 'qr' | 'scan' | 'search' | 'share';

export default function PeerDiscoveryPopup({
  isOpen,
  onClose,
  myPeerId,
  onAddPeer,
  onScanComplete
}: PeerDiscoveryPopupProps) {
  const [activeTab, setActiveTab] = useState<TabType>('qr');
  const [searchQuery, setSearchQuery] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>();

  useEffect(() => {
    if (isOpen && myPeerId) {
      generateQRCode();
    }
    return () => {
      stopScanning();
    };
  }, [isOpen, myPeerId]);

  const generateQRCode = async () => {
    if (!myPeerId) return;
    try {
      const qrData = JSON.stringify({
        type: 'g3zkp-peer',
        peerId: myPeerId,
        timestamp: Date.now()
      });
      const dataUrl = await QRCode.toDataURL(qrData, {
        width: 280,
        margin: 2,
        color: {
          dark: '#00f3ff',
          light: '#000000'
        }
      });
      setQrDataUrl(dataUrl);
    } catch (err) {
      console.error('[PeerDiscovery] QR generation error:', err);
    }
  };

  const startScanning = useCallback(async () => {
    try {
      setScanError(null);
      setScanResult(null);
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;
        video.onloadedmetadata = async () => {
          try {
            const playPromise = video.play();
            if (playPromise) {
              await playPromise;
            }
            setIsScanning(true);
            scanQRCodeLoop();
          } catch (playErr) {
            console.error('[PeerDiscovery] Video play error:', playErr);
            setScanError('Could not start video. Please try again.');
          }
        };
      }
    } catch (err: any) {
      setIsScanning(false);
      if (err.name === 'NotAllowedError') {
        setScanError('Camera access denied. Please allow camera permissions in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setScanError('No camera found. Please connect a camera and try again.');
      } else {
        setScanError('Camera error: ' + (err.message || 'Unknown error'));
      }
      console.error('[PeerDiscovery] Camera error:', err);
    }
  }, [scanQRCodeLoop]);

  const stopScanning = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setIsScanning(false);
  }, []);

  const scanQRCodeLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (video.readyState < video.HAVE_CURRENT_DATA || !video.videoWidth) {
      animationRef.current = requestAnimationFrame(scanQRCodeLoop);
      return;
    }
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      });
      
      if (code) {
        try {
          const data = JSON.parse(code.data);
          if (data.type === 'g3zkp-peer' && data.peerId) {
            setScanResult(data.peerId);
            stopScanning();
            onScanComplete?.(data.peerId);
            return;
          }
        } catch {
          if (code.data.startsWith('12D3KooW') || code.data.startsWith('Qm')) {
            setScanResult(code.data);
            stopScanning();
            onScanComplete?.(code.data);
            return;
          }
        }
      }
    } catch (err) {
      console.error('[PeerDiscovery] Scan frame error:', err);
    }
    
    animationRef.current = requestAnimationFrame(scanQRCodeLoop);
  }, [stopScanning, onScanComplete]);

  const copyPeerId = async () => {
    try {
      await navigator.clipboard.writeText(myPeerId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('[PeerDiscovery] Copy failed:', err);
    }
  };

  const handleAddPeer = async () => {
    const peerId = scanResult || searchQuery.trim();
    if (!peerId) return;
    
    setIsAdding(true);
    try {
      await onAddPeer(peerId, displayName.trim() || undefined);
      setSearchQuery('');
      setDisplayName('');
      setScanResult(null);
      onClose();
    } catch (err) {
      console.error('[PeerDiscovery] Add peer error:', err);
    } finally {
      setIsAdding(false);
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'G3ZKP Peer ID',
          text: `Connect with me on G3ZKP Messenger!\nPeer ID: ${myPeerId}`,
          url: window.location.origin
        });
      } else {
        await copyPeerId();
      }
    } catch (err) {
      console.error('[PeerDiscovery] Share failed:', err);
    }
  };

  if (!isOpen) return null;

  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: 'qr', label: 'My QR', icon: <QrCode size={16} /> },
    { id: 'scan', label: 'Scan', icon: <Scan size={16} /> },
    { id: 'search', label: 'Add', icon: <UserPlus size={16} /> },
    { id: 'share', label: 'Share', icon: <Share2 size={16} /> }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-[#010401] border border-[#4caf50]/30 rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#4caf50]/20">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-[#00f3ff]" />
            <h2 className="text-sm font-bold text-[#00f3ff] uppercase tracking-wider">Peer Discovery</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-black/50 border border-red-500/30 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all active:scale-95"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex border-b border-[#4caf50]/20">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id !== 'scan') stopScanning();
              }}
              className={`flex-1 py-3 flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wide transition-all ${
                activeTab === tab.id
                  ? 'text-[#00f3ff] bg-[#00f3ff]/10 border-b-2 border-[#00f3ff]'
                  : 'text-[#4caf50]/60 hover:text-[#4caf50]'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="p-4 min-h-[360px]">
          {activeTab === 'qr' && (
            <div className="flex flex-col items-center">
              <p className="text-xs text-[#4caf50]/80 text-center mb-4">
                Let others scan this code to connect with you
              </p>
              {qrDataUrl ? (
                <div className="relative p-3 bg-black rounded-xl border border-[#00f3ff]/30">
                  <img src={qrDataUrl} alt="My QR Code" className="w-64 h-64" />
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-[#00f3ff] rounded-tl" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-[#00f3ff] rounded-tr" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-[#00f3ff] rounded-bl" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-[#00f3ff] rounded-br" />
                  </div>
                </div>
              ) : (
                <div className="w-64 h-64 flex items-center justify-center bg-black/50 rounded-xl border border-[#4caf50]/20">
                  <Loader2 className="w-8 h-8 text-[#00f3ff] animate-spin" />
                </div>
              )}
              <div className="mt-4 w-full">
                <p className="text-[10px] text-[#4caf50]/60 text-center mb-2 uppercase tracking-wider">My Peer ID</p>
                <div className="flex items-center gap-2 p-2 bg-black/50 rounded-lg border border-[#4caf50]/20">
                  <code className="flex-1 text-[10px] text-[#00f3ff] font-mono truncate">
                    {myPeerId || 'Loading...'}
                  </code>
                  <button
                    onClick={copyPeerId}
                    className="p-1.5 rounded bg-[#00f3ff]/10 text-[#00f3ff] hover:bg-[#00f3ff]/20 transition-all"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'scan' && (
            <div className="flex flex-col items-center">
              <p className="text-xs text-[#4caf50]/80 text-center mb-4">
                Scan a peer's QR code to connect
              </p>
              
              <div className="relative w-64 h-64 bg-black rounded-xl border border-[#4caf50]/30 overflow-hidden">
                {isScanning ? (
                  <>
                    <video 
                      ref={videoRef} 
                      className="w-full h-full object-cover"
                      playsInline 
                      muted 
                    />
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute top-4 left-4 w-12 h-12 border-t-2 border-l-2 border-[#00f3ff]" />
                      <div className="absolute top-4 right-4 w-12 h-12 border-t-2 border-r-2 border-[#00f3ff]" />
                      <div className="absolute bottom-4 left-4 w-12 h-12 border-b-2 border-l-2 border-[#00f3ff]" />
                      <div className="absolute bottom-4 right-4 w-12 h-12 border-b-2 border-r-2 border-[#00f3ff]" />
                      <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-[#00f3ff]/50 animate-pulse" />
                    </div>
                  </>
                ) : scanResult ? (
                  <div className="w-full h-full flex flex-col items-center justify-center p-4">
                    <Check className="w-12 h-12 text-[#4caf50] mb-2" />
                    <p className="text-xs text-[#4caf50] text-center mb-2">Peer Found!</p>
                    <code className="text-[9px] text-[#00f3ff] font-mono break-all text-center">
                      {scanResult}
                    </code>
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center">
                    <Camera className="w-12 h-12 text-[#4caf50]/40 mb-3" />
                    <p className="text-xs text-[#4caf50]/60 text-center">Camera inactive</p>
                  </div>
                )}
              </div>
              
              <canvas ref={canvasRef} className="hidden" />
              
              {scanError && (
                <div className="mt-3 flex items-center gap-2 text-xs text-red-400">
                  <AlertCircle size={14} />
                  <span>{scanError}</span>
                </div>
              )}
              
              <div className="mt-4 flex gap-2 w-full">
                {!scanResult ? (
                  <button
                    onClick={isScanning ? stopScanning : startScanning}
                    className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-all ${
                      isScanning
                        ? 'bg-red-500/20 border border-red-500/40 text-red-400'
                        : 'bg-[#00f3ff]/10 border border-[#00f3ff]/40 text-[#00f3ff]'
                    }`}
                  >
                    {isScanning ? (
                      <>Stop Scanning</>
                    ) : (
                      <><Camera size={14} /> Start Scanner</>
                    )}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setScanResult(null)}
                      className="flex-1 py-2.5 rounded-lg bg-black/50 border border-[#4caf50]/30 text-[#4caf50] text-xs font-bold uppercase"
                    >
                      Scan Again
                    </button>
                    <button
                      onClick={handleAddPeer}
                      disabled={isAdding}
                      className="flex-1 py-2.5 rounded-lg bg-[#00f3ff]/20 border border-[#00f3ff]/40 text-[#00f3ff] text-xs font-bold uppercase flex items-center justify-center gap-2"
                    >
                      {isAdding ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                      Add Peer
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === 'search' && (
            <div className="flex flex-col">
              <p className="text-xs text-[#4caf50]/80 text-center mb-4">
                Enter a Peer ID to connect directly
              </p>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] text-[#4caf50]/60 uppercase tracking-wider mb-1.5">
                    Peer ID
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#4caf50]/40" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="12D3KooW... or Qm..."
                      className="w-full pl-10 pr-4 py-3 bg-black/50 border border-[#4caf50]/30 rounded-lg text-sm text-[#00f3ff] placeholder-[#4caf50]/40 focus:outline-none focus:border-[#00f3ff]/50"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-[10px] text-[#4caf50]/60 uppercase tracking-wider mb-1.5">
                    Display Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Give this peer a name"
                    className="w-full px-4 py-3 bg-black/50 border border-[#4caf50]/30 rounded-lg text-sm text-[#00f3ff] placeholder-[#4caf50]/40 focus:outline-none focus:border-[#00f3ff]/50"
                  />
                </div>
              </div>
              
              <button
                onClick={handleAddPeer}
                disabled={!searchQuery.trim() || isAdding}
                className="mt-6 w-full py-3 rounded-lg bg-[#00f3ff]/20 border border-[#00f3ff]/40 text-[#00f3ff] text-sm font-bold uppercase tracking-wide flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#00f3ff]/30 transition-all"
              >
                {isAdding ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <UserPlus size={16} />
                )}
                Add Peer
              </button>
              
              <div className="mt-4 p-3 bg-[#4caf50]/5 rounded-lg border border-[#4caf50]/20">
                <p className="text-[10px] text-[#4caf50]/60 leading-relaxed">
                  Peer IDs typically start with <code className="text-[#00f3ff]">12D3KooW</code> or <code className="text-[#00f3ff]">Qm</code>. 
                  Ask your contact to share their Peer ID from the "My QR" or "Share" tab.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'share' && (
            <div className="flex flex-col items-center">
              <p className="text-xs text-[#4caf50]/80 text-center mb-4">
                Share your Peer ID with others to let them connect
              </p>
              
              <div className="w-full p-4 bg-black/50 rounded-xl border border-[#4caf50]/30 mb-4">
                <p className="text-[10px] text-[#4caf50]/60 uppercase tracking-wider mb-2">My Peer ID</p>
                <code className="block text-xs text-[#00f3ff] font-mono break-all leading-relaxed">
                  {myPeerId || 'Loading...'}
                </code>
              </div>
              
              <div className="grid grid-cols-2 gap-3 w-full">
                <button
                  onClick={copyPeerId}
                  className="py-3 rounded-lg bg-[#00f3ff]/10 border border-[#00f3ff]/40 text-[#00f3ff] text-xs font-bold uppercase flex items-center justify-center gap-2 hover:bg-[#00f3ff]/20 transition-all active:scale-95"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={handleShare}
                  className="py-3 rounded-lg bg-[#4caf50]/10 border border-[#4caf50]/40 text-[#4caf50] text-xs font-bold uppercase flex items-center justify-center gap-2 hover:bg-[#4caf50]/20 transition-all active:scale-95"
                >
                  <Share2 size={14} />
                  Share
                </button>
              </div>
              
              <div className="mt-6 w-full p-3 bg-[#00f3ff]/5 rounded-lg border border-[#00f3ff]/20">
                <h4 className="text-xs font-bold text-[#00f3ff] mb-2">How it works</h4>
                <ul className="text-[10px] text-[#4caf50]/80 space-y-1.5">
                  <li>1. Share your Peer ID with your contact</li>
                  <li>2. They enter it in the "Add" tab</li>
                  <li>3. Once both sides add each other, you're connected!</li>
                  <li>4. All messages are end-to-end encrypted</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
