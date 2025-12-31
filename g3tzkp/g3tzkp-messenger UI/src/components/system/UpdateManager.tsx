import React, { useState, useEffect } from 'react';
import { Download, CheckCircle, X, AlertCircle, RefreshCw } from 'lucide-react';

interface UpdateInfo {
  version: string;
  releaseNotes?: string;
  releaseDate?: string;
  size?: number;
}

interface DownloadProgress {
  percent: number;
  transferred: number;
  total: number;
  bytesPerSecond: number;
}

export function UpdateManager() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);

  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.onUpdateAvailable((info) => {
      setUpdateInfo(info);
      setUpdateAvailable(true);
      setShowUpdateDialog(true);
      setChecking(false);
    });

    window.electronAPI.onUpdateStatus((status) => {
      if (status.status === 'checking') {
        setChecking(true);
      } else if (status.status === 'up-to-date') {
        setChecking(false);
      }
    });

    window.electronAPI.onDownloadProgress((progress) => {
      setDownloadProgress(progress);
    });

    window.electronAPI.onUpdateDownloaded((info) => {
      setDownloading(false);
      setUpdateDownloaded(true);
      setDownloadProgress(null);
    });

    window.electronAPI.onUpdateError((err) => {
      setError(err.message);
      setChecking(false);
      setDownloading(false);
    });
  }, []);

  const handleCheckForUpdates = async () => {
    if (!window.electronAPI) return;
    setChecking(true);
    setError(null);
    await window.electronAPI.checkForUpdates();
  };

  const handleDownloadUpdate = async () => {
    if (!window.electronAPI) return;
    setDownloading(true);
    setError(null);
    const result = await window.electronAPI.downloadUpdate();
    if (result.error) {
      setError(result.error);
      setDownloading(false);
    }
  };

  const handleInstallUpdate = async () => {
    if (!window.electronAPI) return;
    await window.electronAPI.installUpdate();
  };

  const handleSkipUpdate = async () => {
    if (!window.electronAPI) return;
    await window.electronAPI.skipUpdate();
    setShowUpdateDialog(false);
    setUpdateAvailable(false);
    setUpdateInfo(null);
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatSpeed = (bytesPerSecond: number): string => {
    return formatBytes(bytesPerSecond) + '/s';
  };

  if (!window.electronAPI) {
    return null; // Not running in Electron
  }

  return (
    <>
      {/* Check for Updates Button */}
      <button
        onClick={handleCheckForUpdates}
        disabled={checking}
        className="flex items-center gap-2 px-4 py-2 bg-cyan-900/20 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-900/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
        <span className="text-xs font-mono uppercase tracking-wider">
          {checking ? 'Checking...' : 'Check for Updates'}
        </span>
      </button>

      {/* Update Available Dialog */}
      {showUpdateDialog && updateAvailable && updateInfo && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
          <div className="bg-black border border-cyan-500/30 max-w-md w-full rounded-lg overflow-hidden">
            {/* Header */}
            <div className="bg-cyan-900/20 border-b border-cyan-500/30 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Download size={20} className="text-cyan-400" />
                <h2 className="text-cyan-400 font-mono text-sm uppercase tracking-wider">
                  Update Available
                </h2>
              </div>
              <button
                onClick={handleSkipUpdate}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400 uppercase tracking-wider">Version</span>
                  <span className="text-green-400 font-mono text-sm font-bold">{updateInfo.version}</span>
                </div>
                {updateInfo.releaseDate && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400 uppercase tracking-wider">Released</span>
                    <span className="text-gray-300 text-xs font-mono">
                      {new Date(updateInfo.releaseDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {updateInfo.size && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400 uppercase tracking-wider">Size</span>
                    <span className="text-gray-300 text-xs font-mono">{formatBytes(updateInfo.size)}</span>
                  </div>
                )}
              </div>

              {updateInfo.releaseNotes && (
                <div className="bg-gray-900/50 border border-gray-700 rounded p-3 max-h-48 overflow-y-auto">
                  <h3 className="text-xs text-gray-400 uppercase tracking-wider mb-2">Release Notes</h3>
                  <div className="text-xs text-gray-300 font-mono whitespace-pre-wrap">
                    {updateInfo.releaseNotes}
                  </div>
                </div>
              )}

              {/* Download Progress */}
              {downloading && downloadProgress && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-gray-400">Downloading...</span>
                    <span className="text-cyan-400">{downloadProgress.percent.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-500 to-green-500 transition-all duration-300"
                      style={{ width: `${downloadProgress.percent}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs font-mono text-gray-500">
                    <span>{formatBytes(downloadProgress.transferred)} / {formatBytes(downloadProgress.total)}</span>
                    <span>{formatSpeed(downloadProgress.bytesPerSecond)}</span>
                  </div>
                </div>
              )}

              {/* Update Downloaded */}
              {updateDownloaded && (
                <div className="bg-green-900/20 border border-green-500/30 rounded p-3 flex items-center gap-3">
                  <CheckCircle size={20} className="text-green-400" />
                  <span className="text-green-400 text-xs font-mono">Update downloaded and ready to install</span>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="bg-red-900/20 border border-red-500/30 rounded p-3 flex items-center gap-3">
                  <AlertCircle size={20} className="text-red-400" />
                  <span className="text-red-400 text-xs font-mono">{error}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="border-t border-cyan-500/30 p-4 flex gap-3">
              <button
                onClick={handleSkipUpdate}
                className="flex-1 px-4 py-2 border border-gray-600 text-gray-400 hover:bg-gray-800 transition-all text-xs font-mono uppercase tracking-wider"
              >
                Skip
              </button>
              {!updateDownloaded && !downloading && (
                <button
                  onClick={handleDownloadUpdate}
                  className="flex-1 px-4 py-2 bg-cyan-600 text-white hover:bg-cyan-500 transition-all text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <Download size={14} />
                  Download
                </button>
              )}
              {updateDownloaded && (
                <button
                  onClick={handleInstallUpdate}
                  className="flex-1 px-4 py-2 bg-green-600 text-white hover:bg-green-500 transition-all text-xs font-mono uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  <CheckCircle size={14} />
                  Install & Restart
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default UpdateManager;
