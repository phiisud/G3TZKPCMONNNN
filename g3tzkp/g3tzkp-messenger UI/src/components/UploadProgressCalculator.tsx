import React, { useEffect, useState } from 'react';
import { Upload, Zap, Clock, Wifi, X } from 'lucide-react';

interface UploadProgressCalculatorProps {
  file: File;
  onCancel?: () => void;
  isUploading: boolean;
  uploadProgress: number;
}

export const UploadProgressCalculator: React.FC<UploadProgressCalculatorProps> = ({
  file,
  onCancel,
  isUploading,
  uploadProgress
}) => {
  const [bandwidth, setBandwidth] = useState<number | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<number>(0);
  const [connectionType, setConnectionType] = useState<string>('unknown');

  useEffect(() => {
    const measureBandwidth = async () => {
      if ('connection' in navigator) {
        const conn = (navigator as any).connection;
        if (conn) {
          const effectiveBandwidth = conn.downlink;
          setBandwidth(effectiveBandwidth);
          setConnectionType(conn.effectiveType || 'unknown');
        }
      }

      if (!bandwidth) {
        const testSize = 50000;
        const testStart = performance.now();
        try {
          await fetch('/favicon.ico', { cache: 'no-store' });
          const testEnd = performance.now();
          const duration = (testEnd - testStart) / 1000;
          const measuredBandwidth = (testSize * 8) / duration / 1000000;
          setBandwidth(measuredBandwidth);
        } catch {
          setBandwidth(1);
        }
      }
    };

    measureBandwidth();
  }, []);

  useEffect(() => {
    if (bandwidth && file) {
      const fileSizeMB = file.size / (1024 * 1024);
      const uploadSpeedMbps = bandwidth * 0.7;
      const uploadTimeSeconds = (fileSizeMB * 8) / uploadSpeedMbps;
      const encryptionOverhead = uploadTimeSeconds * 0.15;
      const p2pHandshake = 2;
      
      setEstimatedTime(uploadTimeSeconds + encryptionOverhead + p2pHandshake);
    }
  }, [bandwidth, file]);

  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${Math.ceil(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const getBandwidthColor = () => {
    if (!bandwidth) return 'text-gray-400';
    if (bandwidth > 10) return 'text-green-400';
    if (bandwidth > 5) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="bg-gray-900/95 border border-cyan-800 rounded-lg p-4 space-y-3 font-mono">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Upload size={16} className="text-cyan-400" />
          <span className="text-sm text-white truncate max-w-[200px]">
            {file.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">{formatSize(file.size)}</span>
          {onCancel && (
            <button onClick={onCancel} className="p-1 hover:bg-gray-800 rounded">
              <X size={14} className="text-gray-500" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Wifi size={14} className={getBandwidthColor()} />
          <div>
            <div className="text-gray-500 uppercase tracking-wider">BANDWIDTH</div>
            <div className={getBandwidthColor()}>
              {bandwidth ? `${bandwidth.toFixed(1)} Mbps` : 'Measuring...'}
            </div>
            <div className="text-[10px] text-gray-600">{connectionType}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Clock size={14} className="text-cyan-400" />
          <div>
            <div className="text-gray-500 uppercase tracking-wider">ESTIMATED</div>
            <div className="text-cyan-400">
              {estimatedTime > 0 ? formatTime(estimatedTime) : 'Calculating...'}
            </div>
            <div className="text-[10px] text-gray-600">P2P + Encrypt</div>
          </div>
        </div>
      </div>

      {isUploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-gray-400 uppercase tracking-wider">
              Uploading + Encrypting...
            </span>
            <span className="text-cyan-400">{uploadProgress}%</span>
          </div>
          <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-cyan-500 to-green-500 transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <div className="flex items-center gap-2 text-[10px] text-gray-500">
            <Zap size={10} className="text-yellow-400" />
            <span>Zero-knowledge proof encryption active</span>
          </div>
        </div>
      )}

      {!isUploading && (
        <div className="text-[10px] text-gray-500 flex items-center gap-2 pt-2 border-t border-gray-800">
          <Zap size={10} className="text-green-400" />
          <span>Ready for encrypted P2P transfer</span>
        </div>
      )}
    </div>
  );
};

export default UploadProgressCalculator;
