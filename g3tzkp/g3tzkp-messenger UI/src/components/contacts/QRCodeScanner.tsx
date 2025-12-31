import React, { useState, useRef, useEffect, useCallback } from 'react';
import { QrCode, Camera, X, Check, Download, AlertCircle, Edit3, UserPlus } from 'lucide-react';
import QRCode from 'qrcode';
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat, NotFoundException } from '@zxing/library';

interface QRCodeScannerProps {
  onAdd: (peerId: string) => void;
  onCancel: () => void;
  localPeerId?: string;
}

export function QRCodeScanner({ onAdd, onCancel, localPeerId = 'demo-peer-id' }: QRCodeScannerProps) {
  const [mode, setMode] = useState<'show' | 'scan' | 'manual'>('show');
  const [manualPeerId, setManualPeerId] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scannedData, setScannedData] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    if (localPeerId) {
      generateQRCode(localPeerId);
    }
  }, [localPeerId]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const generateQRCode = async (peerId: string) => {
    try {
      const url = await QRCode.toDataURL(`g3zkp://peer/${peerId}`, {
        width: 300,
        margin: 2,
        color: {
          dark: '#00ffff',
          light: '#000000'
        }
      });
      setQrCodeUrl(url);
    } catch (error) {
      console.error('[QRScanner] QR Code generation error:', error);
    }
  };

  const parseQRData = useCallback((data: string): string | null => {
    if (data.startsWith('g3zkp://peer/')) {
      return data.replace('g3zkp://peer/', '');
    }
    if (data.match(/^[a-zA-Z0-9]{32,}$/)) {
      return data;
    }
    try {
      const parsed = JSON.parse(data);
      if (parsed.peerId) return parsed.peerId;
      if (parsed.id) return parsed.id;
    } catch {
    }
    return null;
  }, []);

  const startCamera = async () => {
    setScanning(true);
    setScanError(null);
    
    try {
      // Request camera access first to ensure video element gets stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment', // Use back camera on mobile
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      
      if (!videoRef.current) {
        stream.getTracks().forEach(track => track.stop());
        throw new Error('Video element not found');
      }

      // Attach stream to video element FIRST for live preview
      videoRef.current.srcObject = stream;
      videoRef.current.play();

      // Then initialize QR code reader
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
      hints.set(DecodeHintType.TRY_HARDER, true);
      
      codeReaderRef.current = new BrowserMultiFormatReader(hints);

      const controls = await codeReaderRef.current.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result, error) => {
          if (result) {
            const rawData = result.getText();
            console.log('[QRScanner] QR Code detected:', rawData);
            
            const peerId = parseQRData(rawData);
            if (peerId) {
              setScannedData(peerId);
              stopCamera();
            } else {
              setScanError('Invalid QR code format. Please scan a valid G3ZKP peer QR code.');
            }
          }
          if (error && !(error instanceof NotFoundException)) {
            console.error('[QRScanner] Decode error:', error);
          }
        }
      );
      
      controlsRef.current = controls;
      
    } catch (error) {
      console.error('[QRScanner] Camera access error:', error);
      setScanError('Camera access denied. Please enable camera permissions in your browser settings.');
      setScanning(false);
    }
  };

  const stopCamera = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.stop();
      controlsRef.current = null;
    }
    
    if (codeReaderRef.current) {
      codeReaderRef.current = null;
    }
    
    // Stop video stream tracks
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    setScanning(false);
  }, []);

  const handleDownloadQR = () => {
    const link = document.createElement('a');
    link.download = 'g3zkp-qr-code.png';
    link.href = qrCodeUrl;
    link.click();
  };

  const handleConfirmScanned = () => {
    if (scannedData) {
      onAdd(scannedData);
    }
  };

  const handleRetryScan = () => {
    setScannedData('');
    setScanError(null);
    startCamera();
  };

  const validatePeerId = (id: string): boolean => {
    if (!id || id.length < 10) return false;
    if (id.startsWith('G3-') && id.length >= 10) return true;
    if (/^[a-zA-Z0-9]{20,}$/.test(id)) return true;
    if (/^12D3[a-zA-Z0-9]{30,}$/.test(id)) return true;
    return false;
  };

  const [addSuccess, setAddSuccess] = useState(false);

  const handleManualSubmit = () => {
    const trimmedId = manualPeerId.trim();
    setManualError(null);
    setAddSuccess(false);
    
    if (!trimmedId) {
      setManualError('Please enter a peer ID');
      return;
    }
    
    if (!validatePeerId(trimmedId)) {
      setManualError('Invalid peer ID format. Must be a valid G3-XXXX or libp2p peer ID');
      return;
    }
    
    if (trimmedId === localPeerId) {
      setManualError('Cannot add yourself as a contact');
      return;
    }
    
    console.log('[QRScanner] Manual peer ID added:', trimmedId);
    setAddSuccess(true);
    onAdd(trimmedId);
    setManualPeerId('');
  };

  const handleManualReset = () => {
    setManualPeerId('');
    setManualError(null);
    setAddSuccess(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-1 bg-gray-800 rounded-lg p-1">
        <button
          onClick={() => {
            if (scanning) stopCamera();
            setMode('show');
          }}
          className={`flex-1 px-3 py-2 rounded-md font-medium transition-colors text-sm ${
            mode === 'show'
              ? 'bg-cyan-500 text-black'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          My QR
        </button>
        <button
          onClick={() => setMode('scan')}
          className={`flex-1 px-3 py-2 rounded-md font-medium transition-colors text-sm ${
            mode === 'scan'
              ? 'bg-cyan-500 text-black'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Scan
        </button>
        <button
          onClick={() => {
            if (scanning) stopCamera();
            setMode('manual');
            setManualError(null);
          }}
          className={`flex-1 px-3 py-2 rounded-md font-medium transition-colors text-sm ${
            mode === 'manual'
              ? 'bg-cyan-500 text-black'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Manual
        </button>
      </div>

      {mode === 'show' ? (
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-lg font-bold text-white mb-2">Your QR Code</h3>
            <p className="text-sm text-gray-400">
              Show this to another peer to let them add you
            </p>
          </div>

          {qrCodeUrl && (
            <div className="bg-white p-6 rounded-lg mx-auto w-fit">
              <img
                src={qrCodeUrl}
                alt="Your QR Code"
                className="w-64 h-64"
              />
            </div>
          )}

          <button
            onClick={handleDownloadQR}
            disabled={!qrCodeUrl}
            className="w-full px-6 py-3 bg-gray-800 text-white font-bold rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Download className="w-5 h-5" />
            Download QR Code
          </button>
        </div>
      ) : mode === 'scan' ? (
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-lg font-bold text-white mb-2">Scan QR Code</h3>
            <p className="text-sm text-gray-400">
              Point your camera at another peer's QR code
            </p>
          </div>

          {scanError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2 text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{scanError}</p>
            </div>
          )}

          {!scanning && !scannedData ? (
            <button
              onClick={startCamera}
              className="w-full px-6 py-4 bg-cyan-500 text-black font-bold rounded-lg hover:bg-cyan-400 transition-colors flex items-center justify-center gap-2"
            >
              <Camera className="w-5 h-5" />
              Start Camera
            </button>
          ) : scanning ? (
            <div className="space-y-4">
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  className="w-full h-64 object-cover"
                  playsInline
                  muted
                />
                
                <div className="absolute inset-0 border-4 border-cyan-500 pointer-events-none">
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-cyan-500" />
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-cyan-500" />
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-cyan-500" />
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-cyan-500" />
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-cyan-500 animate-pulse" />
                </div>

                <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded text-xs text-cyan-400 font-mono">
                  SCANNING...
                </div>
              </div>

              <button
                onClick={stopCamera}
                className="w-full px-6 py-3 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
              >
                <X className="w-5 h-5" />
                Stop Camera
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
                <Check className="w-12 h-12 text-green-400 mx-auto mb-2" />
                <p className="text-green-400 font-bold">QR Code Scanned!</p>
                <p className="text-sm text-gray-400 mt-1 font-mono break-all">
                  {scannedData}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleRetryScan}
                  className="flex-1 px-6 py-3 bg-gray-700 text-white font-bold rounded-lg hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Camera className="w-5 h-5" />
                  Scan Again
                </button>
                <button
                  onClick={handleConfirmScanned}
                  className="flex-1 px-6 py-3 bg-cyan-500 text-black font-bold rounded-lg hover:bg-cyan-400 transition-colors flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  Add Contact
                </button>
              </div>
            </div>
          )}
        </div>
      ) : mode === 'manual' ? (
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-lg font-bold text-white mb-2">Enter Peer ID</h3>
            <p className="text-sm text-gray-400">
              Manually enter a peer's ID to add them as a contact
            </p>
          </div>

          {manualError && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-center gap-2 text-red-400">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm">{manualError}</p>
            </div>
          )}

          {addSuccess && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
              <Check className="w-10 h-10 text-green-400 mx-auto mb-2" />
              <p className="text-green-400 font-bold">Contact Added!</p>
              <button
                onClick={handleManualReset}
                className="mt-3 px-4 py-2 bg-green-500/20 text-green-400 rounded-lg hover:bg-green-500/30 transition-colors text-sm"
              >
                Add Another
              </button>
            </div>
          )}

          {!addSuccess && (
            <div className="space-y-3">
              <div className="relative">
                <Edit3 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={manualPeerId}
                  onChange={(e) => {
                    setManualPeerId(e.target.value);
                    setManualError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleManualSubmit();
                  }}
                  placeholder="G3-XXXX... or 12D3KooW..."
                  className="w-full pl-11 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white font-mono text-sm placeholder:text-gray-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
                />
              </div>

              <div className="bg-gray-800/50 rounded-lg p-3 text-xs text-gray-400">
                <p className="font-semibold text-gray-300 mb-1">Accepted formats:</p>
                <ul className="space-y-0.5 ml-2">
                  <li>G3-XXXX... (G3TZKP peer ID)</li>
                  <li>12D3KooW... (libp2p peer ID)</li>
                  <li>20+ character alphanumeric string</li>
                </ul>
              </div>

              <button
                onClick={handleManualSubmit}
                disabled={!manualPeerId.trim()}
                className="w-full px-6 py-3 bg-cyan-500 text-black font-bold rounded-lg hover:bg-cyan-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <UserPlus className="w-5 h-5" />
                Add Contact
              </button>
            </div>
          )}
        </div>
      ) : null}

      <button
        onClick={() => {
          if (scanning) stopCamera();
          onCancel();
        }}
        className="w-full px-6 py-3 bg-gray-800 text-white font-bold rounded-lg hover:bg-gray-700 transition-colors"
      >
        Cancel
      </button>
    </div>
  );
}

export default QRCodeScanner;
