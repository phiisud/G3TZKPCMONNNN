import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  X, QrCode, Camera, Copy, Check, 
  Scan, Users, Loader2, AlertCircle, Link2, Unlink, Keyboard, UserPlus
} from 'lucide-react';
import QRCode from 'qrcode';
import { BrowserQRCodeReader } from '@zxing/browser';
import { g3tzkpService } from '../../services/G3TZKPService';
import { SignalingData, SignalingOffer, SignalingAnswer } from '../../services/G3TZKPSignaling';
import { nameRegistryService } from '../../services/NameRegistryService';

interface G3TZKPConnectPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onConnected?: (peerId: string) => void;
}

type Step = 'choose' | 'initiator_offer' | 'initiator_scan_answer' | 'responder_scan_offer' | 'responder_answer' | 'connected' | 'manual_entry';

export default function G3TZKPConnectPopup({
  isOpen,
  onClose,
  onConnected
}: G3TZKPConnectPopupProps) {
  const [step, setStep] = useState<Step>('choose');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isScanning, setIsScanning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [connectedPeerId, setConnectedPeerId] = useState<string | null>(null);
  const [offerData, setOfferData] = useState<SignalingOffer | null>(null);
  const [answerData, setAnswerData] = useState<SignalingAnswer | null>(null);
  const [rawSignalingData, setRawSignalingData] = useState<string>('');
  const [manualPeerId, setManualPeerId] = useState<string>('');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number>();

  const myPeerId = g3tzkpService.getPeerId();

  useEffect(() => {
    if (!isOpen) {
      resetState();
    }
    return () => stopScanning();
  }, [isOpen]);

  const resetState = () => {
    setStep('choose');
    setQrDataUrl('');
    setIsScanning(false);
    setIsLoading(false);
    setError(null);
    setConnectedPeerId(null);
    setOfferData(null);
    setAnswerData(null);
    setRawSignalingData('');
    setManualPeerId('');
    stopScanning();
  };

  const startAsInitiator = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const offer = await g3tzkpService.createConnectionOffer();
      setOfferData(offer);
      
      const encoded = g3tzkpService.encodeSignalingData(offer);
      setRawSignalingData(encoded);
      
      const qrUrl = await QRCode.toDataURL(encoded, {
        width: 280,
        margin: 1,
        errorCorrectionLevel: 'L',
        color: { dark: '#00f3ff', light: '#000000' }
      });
      setQrDataUrl(qrUrl);
      setStep('initiator_offer');
    } catch (e: any) {
      setError(e.message || 'Failed to create offer');
    } finally {
      setIsLoading(false);
    }
  };

  const startAsResponder = () => {
    setStep('responder_scan_offer');
  };

  const startScanning = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = async () => {
          try {
            await videoRef.current?.play();
            setIsScanning(true);
            requestAnimationFrame(scanLoop);
          } catch (e) {
            setError('Could not start camera');
          }
        };
        videoRef.current.load();
      }
    } catch (e: any) {
      if (e.name === 'NotAllowedError') {
        setError('Camera access denied');
      } else {
        setError('Camera error: ' + e.message);
      }
    }
  };

  const stopScanning = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    setIsScanning(false);
  }, []);

  const scanLoop = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !streamRef.current) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (video.readyState < video.HAVE_CURRENT_DATA) {
      animationRef.current = requestAnimationFrame(scanLoop);
      return;
    }
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    
    try {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert'
      });
      
      if (code?.data) {
        handleScannedData(code.data);
        return;
      }
    } catch (e) {
      console.error('[G3TZKPConnect] Scan error:', e);
    }
    
    animationRef.current = requestAnimationFrame(scanLoop);
  }, [step]);

  const handleScannedData = async (data: string) => {
    stopScanning();
    setIsLoading(true);
    setError(null);
    
    try {
      const signalingData = g3tzkpService.decodeSignalingData(data);
      
      if (step === 'responder_scan_offer' && signalingData.type === 'offer') {
        const answer = await g3tzkpService.processConnectionOffer(signalingData as SignalingOffer);
        setAnswerData(answer);
        
        const encoded = g3tzkpService.encodeSignalingData(answer);
        setRawSignalingData(encoded);
        
        const qrUrl = await QRCode.toDataURL(encoded, {
          width: 280,
          margin: 1,
          errorCorrectionLevel: 'L',
          color: { dark: '#4caf50', light: '#000000' }
        });
        setQrDataUrl(qrUrl);
        setStep('responder_answer');
        
        setTimeout(() => {
          if (g3tzkpService.isConnected(signalingData.peerId)) {
            setConnectedPeerId(signalingData.peerId);
            setStep('connected');
            onConnected?.(signalingData.peerId);
          }
        }, 2000);
        
      } else if (step === 'initiator_scan_answer' && signalingData.type === 'answer') {
        await g3tzkpService.completeConnection(signalingData as SignalingAnswer);
        
        setTimeout(() => {
          if (g3tzkpService.isConnected(signalingData.peerId)) {
            setConnectedPeerId(signalingData.peerId);
            setStep('connected');
            onConnected?.(signalingData.peerId);
          } else {
            setError('Connection failed. Please try again.');
          }
        }, 2000);
      } else {
        setError('Invalid QR code for this step');
      }
    } catch (e: any) {
      setError('Invalid QR code: ' + (e.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasteData = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        handleScannedData(text);
      }
    } catch (e) {
      setError('Failed to read clipboard');
    }
  };

  const copyData = async () => {
    try {
      await navigator.clipboard.writeText(rawSignalingData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      setError('Failed to copy');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-[#010401] border border-[#4caf50]/30 rounded-2xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#4caf50]/20">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-[#00f3ff]" />
            <h2 className="text-sm font-bold text-[#00f3ff] uppercase tracking-wider">G3TZKP Connect</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-black/50 border border-red-500/30 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-all"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-4 min-h-[400px]">
          {step === 'choose' && (
            <div className="flex flex-col items-center">
              <Users className="w-16 h-16 text-[#00f3ff]/50 mb-4" />
              <h3 className="text-lg font-bold text-[#00f3ff] mb-2">Connect to Peer</h3>
              <p className="text-xs text-[#4caf50]/80 text-center mb-6">
                No servers required. Direct peer-to-peer connection via WebRTC.
              </p>

              <div className="w-full space-y-3">
                <button
                  onClick={startAsInitiator}
                  disabled={isLoading}
                  className="w-full py-4 rounded-xl bg-[#00f3ff]/10 border border-[#00f3ff]/40 text-[#00f3ff] font-bold uppercase tracking-wide flex items-center justify-center gap-3 hover:bg-[#00f3ff]/20 transition-all disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="animate-spin" size={20} /> : <QrCode size={20} />}
                  Show My QR Code
                </button>
                
                <button
                  onClick={startAsResponder}
                  className="w-full py-4 rounded-xl bg-[#4caf50]/10 border border-[#4caf50]/40 text-[#4caf50] font-bold uppercase tracking-wide flex items-center justify-center gap-3 hover:bg-[#4caf50]/20 transition-all"
                >
                  <Scan size={20} />
                  Scan Peer's QR Code
                </button>

                <button
                  onClick={() => setStep('manual_entry')}
                  className="w-full py-4 rounded-xl bg-purple-500/10 border border-purple-500/40 text-purple-400 font-bold uppercase tracking-wide flex items-center justify-center gap-3 hover:bg-purple-500/20 transition-all"
                >
                  <Keyboard size={20} />
                  Enter Peer ID Manually
                </button>
              </div>

              <div className="mt-6 w-full p-3 bg-black/30 rounded-lg border border-[#4caf50]/20">
                <p className="text-[10px] text-[#4caf50]/60 text-center mb-1">Your Peer ID:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-[#00f3ff] font-mono text-[10px] break-all">{myPeerId}</code>
                  <button
                    onClick={async () => {
                      if (myPeerId) {
                        await navigator.clipboard.writeText(myPeerId);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }
                    }}
                    className="p-1.5 rounded bg-[#00f3ff]/10 hover:bg-[#00f3ff]/20 transition-colors"
                    title="Copy Peer ID"
                  >
                    {copied ? <Check size={12} className="text-[#4caf50]" /> : <Copy size={12} className="text-[#00f3ff]" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'initiator_offer' && (
            <div className="flex flex-col items-center">
              <p className="text-xs text-[#4caf50]/80 text-center mb-3">
                Step 1: Let the other person scan this QR code
              </p>
              
              {qrDataUrl && (
                <div className="relative p-2 bg-black rounded-xl border border-[#00f3ff]/30">
                  <img src={qrDataUrl} alt="Connection Offer" className="w-56 h-56" />
                </div>
              )}
              
              <div className="mt-4 flex gap-2 w-full">
                <button
                  onClick={copyData}
                  className="flex-1 py-2 rounded-lg bg-black/50 border border-[#4caf50]/30 text-[#4caf50] text-xs font-bold uppercase flex items-center justify-center gap-2"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy Data'}
                </button>
              </div>

              <button
                onClick={() => { stopScanning(); setStep('initiator_scan_answer'); }}
                className="mt-4 w-full py-3 rounded-lg bg-[#00f3ff]/20 border border-[#00f3ff]/40 text-[#00f3ff] text-sm font-bold uppercase flex items-center justify-center gap-2"
              >
                <Scan size={16} />
                Step 2: Scan Their Response
              </button>

              <p className="mt-3 text-[10px] text-[#4caf50]/60 text-center">
                After they scan, they'll show you a response QR code
              </p>
            </div>
          )}

          {step === 'initiator_scan_answer' && (
            <div className="flex flex-col items-center">
              <p className="text-xs text-[#4caf50]/80 text-center mb-3">
                Step 2: Scan the response QR code from your peer
              </p>
              
              <div className="relative w-56 h-56 bg-black rounded-xl border border-[#4caf50]/30 overflow-hidden">
                {isScanning ? (
                  <>
                    <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                    <div className="absolute inset-0 pointer-events-none border-2 border-[#00f3ff] animate-pulse" />
                  </>
                ) : isLoading ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-[#00f3ff] animate-spin" />
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center">
                    <Camera className="w-10 h-10 text-[#4caf50]/40 mb-2" />
                    <p className="text-xs text-[#4caf50]/60">Camera inactive</p>
                  </div>
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" />

              {error && (
                <div className="mt-3 flex items-center gap-2 text-xs text-red-400">
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              <div className="mt-4 flex gap-2 w-full">
                <button
                  onClick={isScanning ? stopScanning : startScanning}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase flex items-center justify-center gap-2 ${
                    isScanning
                      ? 'bg-red-500/20 border border-red-500/40 text-red-400'
                      : 'bg-[#00f3ff]/10 border border-[#00f3ff]/40 text-[#00f3ff]'
                  }`}
                >
                  <Camera size={14} />
                  {isScanning ? 'Stop' : 'Start Camera'}
                </button>
                <button
                  onClick={handlePasteData}
                  className="flex-1 py-2.5 rounded-lg bg-black/50 border border-[#4caf50]/30 text-[#4caf50] text-xs font-bold uppercase flex items-center justify-center gap-2"
                >
                  <Copy size={14} />
                  Paste Data
                </button>
              </div>

              <button
                onClick={() => setStep('initiator_offer')}
                className="mt-3 text-xs text-[#4caf50]/60 hover:text-[#4caf50] transition-colors"
              >
                Back to my QR code
              </button>
            </div>
          )}

          {step === 'responder_scan_offer' && (
            <div className="flex flex-col items-center">
              <p className="text-xs text-[#4caf50]/80 text-center mb-3">
                Scan the peer's connection offer QR code
              </p>
              
              <div className="relative w-56 h-56 bg-black rounded-xl border border-[#4caf50]/30 overflow-hidden">
                {isScanning ? (
                  <>
                    <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                    <div className="absolute inset-0 pointer-events-none border-2 border-[#4caf50] animate-pulse" />
                  </>
                ) : isLoading ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-[#4caf50] animate-spin" />
                  </div>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center">
                    <Camera className="w-10 h-10 text-[#4caf50]/40 mb-2" />
                    <p className="text-xs text-[#4caf50]/60">Camera inactive</p>
                  </div>
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" />

              {error && (
                <div className="mt-3 flex items-center gap-2 text-xs text-red-400">
                  <AlertCircle size={14} /> {error}
                </div>
              )}

              <div className="mt-4 flex gap-2 w-full">
                <button
                  onClick={isScanning ? stopScanning : startScanning}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase flex items-center justify-center gap-2 ${
                    isScanning
                      ? 'bg-red-500/20 border border-red-500/40 text-red-400'
                      : 'bg-[#4caf50]/10 border border-[#4caf50]/40 text-[#4caf50]'
                  }`}
                >
                  <Camera size={14} />
                  {isScanning ? 'Stop' : 'Start Camera'}
                </button>
                <button
                  onClick={handlePasteData}
                  className="flex-1 py-2.5 rounded-lg bg-black/50 border border-[#4caf50]/30 text-[#4caf50] text-xs font-bold uppercase flex items-center justify-center gap-2"
                >
                  <Copy size={14} />
                  Paste Data
                </button>
              </div>

              <button
                onClick={() => setStep('choose')}
                className="mt-3 text-xs text-[#4caf50]/60 hover:text-[#4caf50] transition-colors"
              >
                Back to options
              </button>
            </div>
          )}

          {step === 'responder_answer' && (
            <div className="flex flex-col items-center">
              <p className="text-xs text-[#4caf50]/80 text-center mb-3">
                Show this response QR code to complete the connection
              </p>
              
              {qrDataUrl && (
                <div className="relative p-2 bg-black rounded-xl border border-[#4caf50]/30">
                  <img src={qrDataUrl} alt="Connection Answer" className="w-56 h-56" />
                </div>
              )}
              
              <div className="mt-4 flex gap-2 w-full">
                <button
                  onClick={copyData}
                  className="flex-1 py-2 rounded-lg bg-black/50 border border-[#4caf50]/30 text-[#4caf50] text-xs font-bold uppercase flex items-center justify-center gap-2"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy Data'}
                </button>
              </div>

              <div className="mt-4 flex items-center gap-2 text-xs text-[#00f3ff]">
                <Loader2 className="animate-spin" size={14} />
                Waiting for connection...
              </div>
            </div>
          )}

          {step === 'manual_entry' && (
            <div className="flex flex-col items-center">
              <UserPlus className="w-16 h-16 text-purple-400/50 mb-4" />
              <h3 className="text-lg font-bold text-purple-400 mb-2">Add Peer Manually</h3>
              <p className="text-xs text-[#4caf50]/80 text-center mb-4">
                Paste another user's Peer ID to connect directly
              </p>

              <div className="w-full space-y-4">
                <div>
                  <label className="block text-xs text-[#4caf50]/60 mb-2 uppercase tracking-wider">
                    Peer ID or G3TZKP Name
                  </label>
                  <textarea
                    value={manualPeerId}
                    onChange={(e) => setManualPeerId(e.target.value)}
                    placeholder="G3-xxxxx... or name (e.g., MESSENGER)"
                    className="w-full h-24 px-3 py-2 bg-black/50 border border-purple-500/30 rounded-lg text-[#00f3ff] font-mono text-xs placeholder:text-white/30 focus:border-purple-500/60 focus:outline-none resize-none"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        const text = await navigator.clipboard.readText();
                        if (text) setManualPeerId(text.trim());
                      } catch (e) {
                        setError('Failed to read clipboard');
                      }
                    }}
                    className="flex-1 py-2.5 rounded-lg bg-black/50 border border-[#4caf50]/30 text-[#4caf50] text-xs font-bold uppercase flex items-center justify-center gap-2 hover:bg-[#4caf50]/10 transition-colors"
                  >
                    <Copy size={14} />
                    Paste
                  </button>
                  <button
                    onClick={async () => {
                      if (!manualPeerId.trim()) {
                        setError('Please enter a Peer ID');
                        return;
                      }
                      
                      setIsLoading(true);
                      setError(null);
                      
                      try {
                        let targetPeerId = manualPeerId.trim();
                        
                        const parsed = nameRegistryService.parseUrl(`g3tzkp://${targetPeerId}`);
                        if (parsed?.peerId) {
                          targetPeerId = parsed.peerId;
                        }
                        
                        console.log('[G3TZKPConnect] Connecting to peer:', targetPeerId);
                        
                        const offer = await g3tzkpService.createConnectionOffer();
                        setOfferData(offer);
                        
                        const encoded = g3tzkpService.encodeSignalingData(offer);
                        setRawSignalingData(encoded);
                        
                        const qrUrl = await QRCode.toDataURL(encoded, {
                          width: 280,
                          margin: 1,
                          errorCorrectionLevel: 'L',
                          color: { dark: '#00f3ff', light: '#000000' }
                        });
                        setQrDataUrl(qrUrl);
                        
                        setConnectedPeerId(targetPeerId);
                        setStep('initiator_offer');
                      } catch (e: any) {
                        setError(e.message || 'Failed to connect');
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    disabled={isLoading || !manualPeerId.trim()}
                    className="flex-1 py-2.5 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-400 text-xs font-bold uppercase flex items-center justify-center gap-2 hover:bg-purple-500/30 transition-colors disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
                    Connect
                  </button>
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-xs text-red-400 p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                    <AlertCircle size={14} /> {error}
                  </div>
                )}
              </div>

              <button
                onClick={() => setStep('choose')}
                className="mt-4 text-xs text-[#4caf50]/60 hover:text-[#4caf50] transition-colors"
              >
                Back to options
              </button>
            </div>
          )}

          {step === 'connected' && (
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 rounded-full bg-[#4caf50]/20 border-2 border-[#4caf50] flex items-center justify-center mb-4">
                <Check className="w-10 h-10 text-[#4caf50]" />
              </div>
              
              <h3 className="text-lg font-bold text-[#4caf50] mb-2">Connected!</h3>
              <p className="text-xs text-[#4caf50]/80 text-center mb-4">
                Direct P2P connection established
              </p>
              
              <div className="w-full p-3 bg-black/50 rounded-lg border border-[#4caf50]/30">
                <p className="text-[10px] text-[#4caf50]/60 uppercase tracking-wider mb-1">Connected Peer</p>
                <code className="text-xs text-[#00f3ff] font-mono break-all">
                  {connectedPeerId}
                </code>
              </div>

              <button
                onClick={onClose}
                className="mt-6 w-full py-3 rounded-lg bg-[#4caf50]/20 border border-[#4caf50]/40 text-[#4caf50] font-bold uppercase tracking-wide"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
