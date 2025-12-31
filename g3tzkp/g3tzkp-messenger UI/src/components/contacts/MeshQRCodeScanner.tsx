import React, { useState, useRef, useEffect, useCallback } from 'react';
import { QrCode, Camera, X, Check, Download, AlertCircle } from 'lucide-react';
import QRCode from 'qrcode';
import { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat, NotFoundException } from '@zxing/library';

interface MeshQRCodeScannerProps {
  onAdd: (peerId: string) => void;
  onCancel: () => void;
  localPeerId?: string;
}

export function MeshQRCodeScanner({ onAdd, onCancel, localPeerId = 'demo-peer-id' }: MeshQRCodeScannerProps) {
  const [mode, setMode] = useState<'show' | 'scan'>('show');
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
          dark: '#00f3ff',
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
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
      hints.set(DecodeHintType.TRY_HARDER, true);
      
      codeReaderRef.current = new BrowserMultiFormatReader(hints);
      
      if (!videoRef.current) {
        throw new Error('Video element not found');
      }

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
              setScanError('INVALID_QR_FORMAT');
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
      setScanError('CAMERA_ACCESS_DENIED');
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
    
    setScanning(false);
  }, []);

  const handleDownloadQR = () => {
    const link = document.createElement('a');
    link.download = 'g3zkp-node-qr.png';
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

  return (
    <div className="space-y-6">
      <div className="flex border-[0.5px] border-[#4caf50]/20 bg-black/40">
        <button
          onClick={() => {
            if (scanning) stopCamera();
            setMode('show');
          }}
          className={`flex-1 px-4 py-3 text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
            mode === 'show'
              ? 'bg-[#00f3ff]/10 text-[#00f3ff] border-b-[0.5px] border-[#00f3ff]'
              : 'text-[#4caf50]/40 hover:text-[#4caf50]/60'
          }`}
        >
          <QrCode size={12} />
          MY_CODE
        </button>
        <button
          onClick={() => setMode('scan')}
          className={`flex-1 px-4 py-3 text-[9px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
            mode === 'scan'
              ? 'bg-[#00f3ff]/10 text-[#00f3ff] border-b-[0.5px] border-[#00f3ff]'
              : 'text-[#4caf50]/40 hover:text-[#4caf50]/60'
          }`}
        >
          <Camera size={12} />
          SCAN_CODE
        </button>
      </div>

      {mode === 'show' ? (
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-[12px] font-black text-[#00f3ff] uppercase tracking-widest mb-2">YOUR_NODE_CODE</h3>
            <p className="text-[9px] font-mono text-[#4caf50]/60 uppercase">
              DISPLAY_TO_PEER_FOR_CONNECTION
            </p>
          </div>

          {qrCodeUrl && (
            <div className="border-[0.5px] border-[#00f3ff]/40 p-4 mx-auto w-fit bg-black">
              <img
                src={qrCodeUrl}
                alt="Your QR Code"
                className="w-48 h-48"
              />
            </div>
          )}

          <button
            onClick={handleDownloadQR}
            disabled={!qrCodeUrl}
            className="w-full px-6 py-3 border-[0.5px] border-[#4caf50]/20 bg-black/40 hover:bg-black/60 transition-all text-[10px] font-black text-[#4caf50] uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-30"
          >
            <Download size={14} />
            DOWNLOAD_CODE
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-[12px] font-black text-[#00f3ff] uppercase tracking-widest mb-2">SCAN_NODE_CODE</h3>
            <p className="text-[9px] font-mono text-[#4caf50]/60 uppercase">
              ALIGN_CAMERA_WITH_PEER_QR_CODE
            </p>
          </div>

          {scanError && (
            <div className="border-[0.5px] border-red-500/40 bg-red-500/10 p-3 flex items-center gap-2">
              <AlertCircle size={14} className="text-red-400 flex-shrink-0" />
              <span className="text-[9px] font-mono text-red-400 uppercase">{scanError}</span>
            </div>
          )}

          {!scanning && !scannedData ? (
            <button
              onClick={startCamera}
              className="w-full px-6 py-4 border-[0.5px] border-[#00f3ff]/40 bg-[#00f3ff]/10 hover:bg-[#00f3ff]/20 transition-all text-[10px] font-black text-[#00f3ff] uppercase tracking-widest flex items-center justify-center gap-2"
            >
              <Camera size={16} />
              ACTIVATE_CAMERA
            </button>
          ) : scanning ? (
            <div className="space-y-4">
              <div className="relative border-[0.5px] border-[#00f3ff]/40 overflow-hidden">
                <video
                  ref={videoRef}
                  className="w-full h-64 object-cover"
                  playsInline
                  muted
                />
                
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-2 left-2 w-8 h-8 border-t-[2px] border-l-[2px] border-[#00f3ff]" />
                  <div className="absolute top-2 right-2 w-8 h-8 border-t-[2px] border-r-[2px] border-[#00f3ff]" />
                  <div className="absolute bottom-2 left-2 w-8 h-8 border-b-[2px] border-l-[2px] border-[#00f3ff]" />
                  <div className="absolute bottom-2 right-2 w-8 h-8 border-b-[2px] border-r-[2px] border-[#00f3ff]" />
                  <div className="absolute top-1/2 left-4 right-4 h-[1px] bg-[#00f3ff]/50 animate-pulse" />
                </div>

                <div className="absolute bottom-2 left-2 border-[0.5px] border-[#00f3ff]/40 bg-black/80 px-2 py-1">
                  <span className="text-[7px] font-mono text-[#00f3ff] uppercase">SCANNING...</span>
                </div>
              </div>

              <button
                onClick={stopCamera}
                className="w-full px-6 py-3 border-[0.5px] border-red-500/40 bg-red-500/10 hover:bg-red-500/20 transition-all text-[10px] font-black text-red-400 uppercase tracking-widest flex items-center justify-center gap-2"
              >
                <X size={14} />
                STOP_CAMERA
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border-[0.5px] border-[#4caf50]/40 bg-[#4caf50]/10 p-4 text-center">
                <Check size={32} className="text-[#4caf50] mx-auto mb-2" />
                <p className="text-[10px] font-black text-[#4caf50] uppercase tracking-widest">CODE_DETECTED</p>
                <p className="text-[8px] font-mono text-[#4caf50]/60 mt-2 break-all">
                  {scannedData}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleRetryScan}
                  className="flex-1 px-4 py-3 border-[0.5px] border-[#4caf50]/20 bg-black/40 hover:bg-black/60 transition-all text-[9px] font-black text-[#4caf50]/60 uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <Camera size={12} />
                  RESCAN
                </button>
                <button
                  onClick={handleConfirmScanned}
                  className="flex-1 px-4 py-3 border-[0.5px] border-[#00f3ff]/40 bg-[#00f3ff]/10 hover:bg-[#00f3ff]/20 transition-all text-[9px] font-black text-[#00f3ff] uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  <Check size={12} />
                  CONNECT
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => {
          if (scanning) stopCamera();
          onCancel();
        }}
        className="w-full px-6 py-3 border-[0.5px] border-[#4caf50]/20 bg-black/40 hover:bg-black/60 transition-all text-[10px] font-black text-[#4caf50]/60 uppercase tracking-widest"
      >
        CANCEL
      </button>
    </div>
  );
}

export default MeshQRCodeScanner;
