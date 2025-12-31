import React, { useState, useEffect, useCallback } from 'react';
import { Download, Trash2, Map, HardDrive, Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { OfflineRegion } from '../../types/navigation';
import navigationService from '../../services/NavigationService';

interface OfflineMapManagerProps {
  className?: string;
}

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const OfflineMapManager: React.FC<OfflineMapManagerProps> = ({ className = '' }) => {
  const [regions, setRegions] = useState<OfflineRegion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [showAddRegion, setShowAddRegion] = useState(false);
  const [newRegionName, setNewRegionName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const loadRegions = useCallback(async () => {
    setIsLoading(true);
    try {
      const storedRegions = await navigationService.getOfflineRegions();
      setRegions(storedRegions);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRegions();
  }, [loadRegions]);

  const handleDownloadCurrentView = useCallback(async () => {
    if (!newRegionName.trim()) {
      setError('Please enter a region name');
      return;
    }

    setDownloadingId('new');
    setError(null);

    try {
      const position = await navigationService.getCurrentPosition();
      const bbox: [number, number, number, number] = [
        position[0] - 0.1,
        position[1] - 0.1,
        position[0] + 0.1,
        position[1] + 0.1
      ];

      const result = await navigationService.downloadRegion(bbox, newRegionName);

      const newRegion: OfflineRegion = {
        id: result.jobId,
        name: newRegionName,
        bbox,
        zoomRange: [0, 14],
        size: result.estimatedSize,
        downloaded: Date.now(),
        status: 'queued',
        progress: 0
      };

      setRegions(prev => [...prev, newRegion]);
      localStorage.setItem('g3zkp_offline_regions', JSON.stringify([...regions, newRegion]));

      const pollStatus = async () => {
        try {
          const status = await navigationService.getDownloadStatus(result.jobId);
          setRegions(prev => prev.map(r => 
            r.id === result.jobId 
              ? { ...r, status: status.status, progress: status.progress }
              : r
          ));

          if (status.status === 'downloading' || status.status === 'queued') {
            setTimeout(pollStatus, 1000);
          } else {
            const updatedRegions = regions.map(r => 
              r.id === result.jobId 
                ? { ...r, status: status.status, progress: status.progress }
                : r
            );
            localStorage.setItem('g3zkp_offline_regions', JSON.stringify(updatedRegions));
          }
        } catch (e) {
          console.error('Failed to poll download status:', e);
        }
      };
      pollStatus();

      setNewRegionName('');
      setShowAddRegion(false);
    } catch (error) {
      console.error('Failed to initiate download:', error);
      setError('Failed to start download. Check location permissions.');
    } finally {
      setDownloadingId(null);
    }
  }, [newRegionName, regions]);

  const handleDeleteRegion = useCallback(async (regionId: string) => {
    await navigationService.deleteOfflineRegion(regionId);
    setRegions(prev => {
      const updated = prev.filter(r => r.id !== regionId);
      localStorage.setItem('g3zkp_offline_regions', JSON.stringify(updated));
      return updated;
    });
  }, []);

  const totalSize = regions.reduce((sum, r) => sum + r.size, 0);

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-cyan-400 font-mono flex items-center gap-2">
          <HardDrive size={18} />
          OFFLINE_MAPS
        </h3>
        <button
          onClick={() => setShowAddRegion(!showAddRegion)}
          className="text-sm text-cyan-400 hover:text-cyan-300 font-mono"
        >
          + ADD_REGION
        </button>
      </div>

      <div className="bg-yellow-900/20 border border-yellow-800/50 rounded p-3">
        <div className="flex items-start gap-2">
          <AlertTriangle size={14} className="text-yellow-500 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-yellow-500/80 font-mono">
            <p className="font-bold mb-1">Note: Tile Caching</p>
            <p>This manager tracks download jobs. Actual tile data requires a tile cache server. 
            Currently, regions are marked for download but tiles load on-demand from OSM CDN.</p>
          </div>
        </div>
      </div>

      {showAddRegion && (
        <div className="bg-gray-900 border border-gray-700 rounded p-3 space-y-3">
          <input
            type="text"
            value={newRegionName}
            onChange={(e) => setNewRegionName(e.target.value)}
            placeholder="Region name..."
            className="w-full bg-black border border-gray-700 rounded px-3 py-2 text-white font-mono text-sm"
          />
          {error && (
            <div className="text-red-400 text-xs font-mono">{error}</div>
          )}
          <button
            onClick={handleDownloadCurrentView}
            disabled={!newRegionName.trim() || downloadingId === 'new'}
            className="w-full py-2 bg-green-800 hover:bg-green-700 disabled:bg-gray-800 text-white font-mono text-sm rounded flex items-center justify-center gap-2"
          >
            {downloadingId === 'new' ? (
              <>
                <Loader2 size={14} className="animate-spin" /> INITIALIZING...
              </>
            ) : (
              <>
                <Download size={14} /> MARK_REGION_FOR_CACHE
              </>
            )}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={24} className="animate-spin text-cyan-400" />
        </div>
      ) : regions.length === 0 ? (
        <div className="text-center py-8 text-gray-500 font-mono text-sm">
          <Map size={48} className="mx-auto mb-4 opacity-50" />
          No offline regions saved
        </div>
      ) : (
        <div className="space-y-2">
          {regions.map((region) => (
            <div
              key={region.id}
              className="bg-gray-900 border border-gray-700 rounded p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {region.status === 'complete' ? (
                    <CheckCircle size={16} className="text-green-400" />
                  ) : region.status === 'failed' ? (
                    <XCircle size={16} className="text-red-400" />
                  ) : region.status === 'downloading' ? (
                    <Loader2 size={16} className="text-cyan-400 animate-spin" />
                  ) : (
                    <Map size={16} className="text-gray-500" />
                  )}
                  <span className="text-white font-mono text-sm">{region.name}</span>
                </div>
                <button
                  onClick={() => handleDeleteRegion(region.id)}
                  className="text-gray-500 hover:text-red-400 p-1"
                  aria-label="Delete region"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {(region.status === 'downloading' || region.status === 'queued') && (
                <div className="mb-2">
                  <div className="h-1 bg-gray-800 rounded overflow-hidden">
                    <div 
                      className="h-full bg-cyan-400 transition-all duration-300"
                      style={{ width: `${region.progress}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 mt-1 font-mono">
                    {region.status === 'queued' ? 'Queued...' : `${region.progress}% complete`}
                  </div>
                </div>
              )}

              <div className="flex justify-between text-xs text-gray-500 font-mono">
                <span>Est. {formatBytes(region.size)}</span>
                <span>
                  {new Date(region.downloaded).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-gray-800 pt-3">
        <div className="flex justify-between text-sm font-mono">
          <span className="text-gray-400">Tracked Regions</span>
          <span className="text-cyan-400">{regions.length} ({formatBytes(totalSize)})</span>
        </div>
      </div>
    </div>
  );
};

export default OfflineMapManager;
