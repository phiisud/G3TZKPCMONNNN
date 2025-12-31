import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Globe, ArrowLeft, ArrowRight, RefreshCw, Star, StarOff, 
  Home, ExternalLink, Loader2, AlertTriangle, X, Plus,
  Bookmark, Clock, Share2, Server, Package
} from 'lucide-react';
import { g3tzkpWebRouter } from '../../services/web/G3TZKPWebRouter';
import { g3tzkpWebCache } from '../../services/web/G3TZKPWebCache';
import { AppManifest, AppLoadState } from '../../types/g3tzkp-web';

interface GatewayApp {
  name: string;
  appId: string;
  version: string;
  fileCount: number;
  size: number;
  deployedAt: number;
}

const GATEWAY_URL = 'http://localhost:8080';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

interface G3TZKPWebBrowserProps {
  initialUrl?: string;
  onNavigate?: (url: string) => void;
  onClose?: () => void;
}

interface HistoryEntry {
  url: string;
  title: string;
  timestamp: number;
}

interface BookmarkEntry {
  url: string;
  title: string;
  favicon?: string;
  addedAt: number;
}

export const G3TZKPWebBrowser: React.FC<G3TZKPWebBrowserProps> = ({
  initialUrl = '',
  onNavigate,
  onClose
}) => {
  const [currentUrl, setCurrentUrl] = useState(initialUrl);
  const [inputUrl, setInputUrl] = useState(initialUrl);
  const [loadState, setLoadState] = useState<AppLoadState>(AppLoadState.READY);
  const [loadProgress, setLoadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [currentManifest, setCurrentManifest] = useState<AppManifest | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([]);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [recentApps, setRecentApps] = useState<AppManifest[]>([]);
  const [gatewayApps, setGatewayApps] = useState<GatewayApp[]>([]);
  const [gatewayOnline, setGatewayOnline] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const fetchGatewayApps = useCallback(async () => {
    try {
      const healthResponse = await fetch(`${GATEWAY_URL}/api/health`);
      if (healthResponse.ok) {
        setGatewayOnline(true);
        const appsResponse = await fetch(`${GATEWAY_URL}/api/apps`);
        if (appsResponse.ok) {
          const data = await appsResponse.json();
          setGatewayApps(data.apps || []);
        }
      } else {
        setGatewayOnline(false);
      }
    } catch {
      setGatewayOnline(false);
    }
  }, []);

  useEffect(() => {
    const savedBookmarks = localStorage.getItem('g3tzkp-web-bookmarks');
    if (savedBookmarks) {
      try {
        setBookmarks(JSON.parse(savedBookmarks));
      } catch (e) {
        console.error('[G3TZKPWebBrowser] Failed to load bookmarks:', e);
      }
    }

    const loadRecentApps = async () => {
      try {
        const cached = await g3tzkpWebCache.getAllCachedApps();
        setRecentApps(cached.slice(0, 6));
      } catch (e) {
        console.error('[G3TZKPWebBrowser] Failed to load recent apps:', e);
      }
    };
    loadRecentApps();
    fetchGatewayApps();
  }, [fetchGatewayApps]);

  useEffect(() => {
    localStorage.setItem('g3tzkp-web-bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  const loadUrl = useCallback(async (url: string, updateHistoryIndex?: number) => {
    if (!url) return;
    
    const normalizedUrl = url.startsWith('g3tzkp://') ? url : `g3tzkp://${url}`;
    
    setCurrentUrl(normalizedUrl);
    setInputUrl(normalizedUrl);
    setError(null);
    setLoadState(AppLoadState.CHECKING_CACHE);
    setLoadProgress(0);

    onNavigate?.(normalizedUrl);

    const route = g3tzkpWebRouter.parseUrl(normalizedUrl);
    if (!route) {
      setError('Invalid G3TZKP URL');
      setLoadState(AppLoadState.ERROR);
      return;
    }

    const unsubscribe = g3tzkpWebRouter.onLoadProgress(route.appId, (progressInfo) => {
      setLoadProgress(progressInfo.progress);
      setLoadState(progressInfo.state);
    });

    try {
      if (containerRef.current) {
        await g3tzkpWebRouter.loadApp(normalizedUrl, containerRef.current);
        
        const cached = await g3tzkpWebCache.getCachedApp(route.appId);
        if (cached) {
          setCurrentManifest(cached.manifest);
          if (updateHistoryIndex !== undefined) {
            setHistory(prev => {
              const updated = [...prev];
              if (updated[updateHistoryIndex]) {
                updated[updateHistoryIndex].title = cached.manifest.name;
              }
              return updated;
            });
          }
        }
        setLoadState(AppLoadState.READY);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load app');
      setLoadState(AppLoadState.ERROR);
    } finally {
      unsubscribe();
    }
  }, [onNavigate]);

  const navigateToUrl = useCallback(async (url: string) => {
    if (!url) return;
    
    const normalizedUrl = url.startsWith('g3tzkp://') ? url : `g3tzkp://${url}`;

    const newEntry: HistoryEntry = {
      url: normalizedUrl,
      title: normalizedUrl,
      timestamp: Date.now()
    };
    
    const newIndex = historyIndex + 1;
    setHistory(prev => [...prev.slice(0, historyIndex + 1), newEntry]);
    setHistoryIndex(newIndex);

    await loadUrl(normalizedUrl, newIndex);
  }, [historyIndex, loadUrl]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    navigateToUrl(inputUrl);
  };

  const goBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const prevEntry = history[newIndex];
      if (prevEntry) {
        loadUrl(prevEntry.url);
      }
    }
  };

  const goForward = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const nextEntry = history[newIndex];
      if (nextEntry) {
        loadUrl(nextEntry.url);
      }
    }
  };

  const refresh = () => {
    if (currentUrl) {
      loadUrl(currentUrl);
    }
  };

  const goHome = () => {
    setCurrentUrl('');
    setInputUrl('');
    setCurrentManifest(null);
    setLoadState(AppLoadState.READY);
    setError(null);
  };

  const toggleBookmark = () => {
    if (!currentUrl) return;
    
    const existingIndex = bookmarks.findIndex(b => b.url === currentUrl);
    if (existingIndex >= 0) {
      setBookmarks(prev => prev.filter((_, i) => i !== existingIndex));
    } else {
      setBookmarks(prev => [...prev, {
        url: currentUrl,
        title: currentManifest?.name || currentUrl,
        addedAt: Date.now()
      }]);
    }
  };

  const isBookmarked = bookmarks.some(b => b.url === currentUrl);

  const getLoadStateText = () => {
    switch (loadState) {
      case AppLoadState.CHECKING_CACHE:
        return 'Checking cache...';
      case AppLoadState.DISCOVERING_PEERS:
        return 'Finding peers...';
      case AppLoadState.DOWNLOADING:
        return `Downloading... ${Math.round(loadProgress)}%`;
      case AppLoadState.VERIFYING:
        return 'Verifying integrity...';
      case AppLoadState.ERROR:
        return 'Load failed';
      default:
        return 'Ready';
    }
  };

  return (
    <div className="flex flex-col h-full bg-black text-[#00f3ff]">
      <div className="flex items-center gap-2 p-3 bg-black/80 border-b border-[#00f3ff]/20">
        <div className="flex items-center gap-1">
          <button
            onClick={goBack}
            disabled={historyIndex <= 0}
            className="p-2 rounded-lg hover:bg-[#00f3ff]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Go back"
          >
            <ArrowLeft size={18} />
          </button>
          <button
            onClick={goForward}
            disabled={historyIndex >= history.length - 1}
            className="p-2 rounded-lg hover:bg-[#00f3ff]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Go forward"
          >
            <ArrowRight size={18} />
          </button>
          <button
            onClick={refresh}
            disabled={!currentUrl || loadState !== AppLoadState.READY}
            className="p-2 rounded-lg hover:bg-[#00f3ff]/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Refresh"
          >
            {loadState !== AppLoadState.READY && loadState !== AppLoadState.ERROR ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <RefreshCw size={18} />
            )}
          </button>
          <button
            onClick={goHome}
            className="p-2 rounded-lg hover:bg-[#00f3ff]/10 transition-colors"
            title="Home"
          >
            <Home size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex items-center">
          <div className="flex-1 flex items-center gap-2 px-4 py-2 bg-[#00f3ff]/5 border border-[#00f3ff]/30 rounded-full">
            <Globe size={16} className="text-[#00f3ff]/60" />
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="Enter g3tzkp:// URL or app ID"
              className="flex-1 bg-transparent text-white text-sm outline-none placeholder:text-white/40"
            />
            {inputUrl && (
              <button
                type="button"
                onClick={() => setInputUrl('')}
                className="p-1 hover:bg-[#00f3ff]/10 rounded"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </form>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleBookmark}
            disabled={!currentUrl}
            className="p-2 rounded-lg hover:bg-[#00f3ff]/10 disabled:opacity-30 transition-colors"
            title={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
          >
            {isBookmarked ? (
              <Star size={18} className="fill-yellow-400 text-yellow-400" />
            ) : (
              <StarOff size={18} />
            )}
          </button>
          <button
            onClick={() => setShowBookmarks(!showBookmarks)}
            className={`p-2 rounded-lg hover:bg-[#00f3ff]/10 transition-colors ${showBookmarks ? 'bg-[#00f3ff]/20' : ''}`}
            title="Bookmarks"
          >
            <Bookmark size={18} />
          </button>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`p-2 rounded-lg hover:bg-[#00f3ff]/10 transition-colors ${showHistory ? 'bg-[#00f3ff]/20' : ''}`}
            title="History"
          >
            <Clock size={18} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors"
              title="Close"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {loadState !== AppLoadState.READY && loadState !== AppLoadState.ERROR && (
        <div className="px-4 py-2 bg-[#00f3ff]/5 border-b border-[#00f3ff]/10">
          <div className="flex items-center justify-between text-xs text-[#00f3ff]/60 mb-1">
            <span>{getLoadStateText()}</span>
            <span>{Math.round(loadProgress)}%</span>
          </div>
          <div className="h-1 bg-[#00f3ff]/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-[#00f3ff] transition-all duration-300"
              style={{ width: `${loadProgress}%` }}
            />
          </div>
        </div>
      )}

      {(showBookmarks || showHistory) && (
        <div className="absolute top-16 right-4 z-50 w-80 max-h-96 overflow-y-auto bg-black/95 border border-[#00f3ff]/30 rounded-lg shadow-xl">
          {showBookmarks && (
            <div className="p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Bookmark size={16} />
                Bookmarks
              </h3>
              {bookmarks.length === 0 ? (
                <p className="text-sm text-white/40">No bookmarks yet</p>
              ) : (
                <div className="space-y-2">
                  {bookmarks.map((bookmark, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        navigateToUrl(bookmark.url);
                        setShowBookmarks(false);
                      }}
                      className="w-full text-left p-2 rounded-lg hover:bg-[#00f3ff]/10 transition-colors"
                    >
                      <div className="text-sm font-medium truncate">{bookmark.title}</div>
                      <div className="text-xs text-white/40 truncate">{bookmark.url}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {showHistory && (
            <div className="p-4">
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Clock size={16} />
                History
              </h3>
              {history.length === 0 ? (
                <p className="text-sm text-white/40">No history yet</p>
              ) : (
                <div className="space-y-2">
                  {[...history].reverse().slice(0, 10).map((entry, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        navigateToUrl(entry.url);
                        setShowHistory(false);
                      }}
                      className="w-full text-left p-2 rounded-lg hover:bg-[#00f3ff]/10 transition-colors"
                    >
                      <div className="text-sm font-medium truncate">{entry.title}</div>
                      <div className="text-xs text-white/40 truncate">{entry.url}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 relative overflow-hidden">
        {error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
            <AlertTriangle size={64} className="text-red-400 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Failed to Load App</h2>
            <p className="text-white/60 mb-6 max-w-md">{error}</p>
            <button
              onClick={refresh}
              className="px-6 py-2 bg-[#00f3ff]/20 hover:bg-[#00f3ff]/30 border border-[#00f3ff]/50 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : !currentUrl ? (
          <div className="absolute inset-0 flex flex-col items-center justify-start p-8 overflow-y-auto">
            <Globe size={80} className="text-[#00f3ff]/30 mb-6 mt-8" />
            <h2 className="text-2xl font-semibold mb-2">G3TZKP Web Browser</h2>
            <p className="text-white/60 mb-8 text-center max-w-md">
              Browse decentralized apps hosted on the G3TZKP peer-to-peer network. 
              No servers, no hosting fees, just pure P2P.
            </p>
            
            {gatewayApps.length > 0 && (
              <div className="w-full max-w-2xl mb-8">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-[#4caf50] flex items-center gap-2">
                    <Server size={16} />
                    Local Gateway Apps
                    {gatewayOnline && <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
                  </h3>
                  <button
                    onClick={fetchGatewayApps}
                    className="text-xs text-[#00f3ff]/60 hover:text-[#00f3ff] flex items-center gap-1"
                  >
                    <RefreshCw size={12} />
                    Refresh
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {gatewayApps.map((app, i) => (
                    <div
                      key={i}
                      className="p-4 bg-[#4caf50]/5 hover:bg-[#4caf50]/10 border border-[#4caf50]/30 rounded-lg transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-bold text-[#4caf50] truncate flex items-center gap-2">
                          <Package size={16} />
                          {app.name}
                        </div>
                        <span className="text-xs text-white/40">v{app.version}</span>
                      </div>
                      <div className="text-xs text-white/40 mb-3 flex items-center gap-4">
                        <span>{app.fileCount} files</span>
                        <span>{formatBytes(app.size)}</span>
                        <span>{new Date(app.deployedAt).toLocaleDateString()}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => navigateToUrl(`g3tzkp://${app.name}`)}
                          className="flex-1 px-3 py-2 bg-[#00f3ff]/20 hover:bg-[#00f3ff]/30 border border-[#00f3ff]/40 rounded text-xs font-semibold transition-colors"
                        >
                          Open P2P
                        </button>
                        <button
                          onClick={() => window.open(`${GATEWAY_URL}/${app.name}`, '_blank')}
                          className="flex-1 px-3 py-2 bg-[#4caf50]/20 hover:bg-[#4caf50]/30 border border-[#4caf50]/40 rounded text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                        >
                          <ExternalLink size={12} />
                          Open Gateway
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!gatewayOnline && (
              <div className="w-full max-w-lg mb-8 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-400 mb-2">
                  <Server size={16} />
                  <span className="font-semibold">Gateway Offline</span>
                </div>
                <p className="text-sm text-white/60">
                  The local G3TZKP Gateway is not running. Start it with:
                </p>
                <code className="block mt-2 p-2 bg-black/50 rounded text-xs text-[#00f3ff]">
                  cd g3tzkp-cli && node src/index.js gateway start
                </code>
              </div>
            )}
            
            {recentApps.length > 0 && (
              <div className="w-full max-w-lg">
                <h3 className="text-sm font-semibold text-[#00f3ff]/60 mb-3">Cached P2P Apps</h3>
                <div className="grid grid-cols-2 gap-3">
                  {recentApps.map((app, i) => (
                    <button
                      key={i}
                      onClick={() => navigateToUrl(`g3tzkp://${app.appId}`)}
                      className="p-4 bg-[#00f3ff]/5 hover:bg-[#00f3ff]/10 border border-[#00f3ff]/20 rounded-lg text-left transition-colors"
                    >
                      <div className="font-medium truncate">{app.name}</div>
                      <div className="text-xs text-white/40 truncate">v{app.version}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div ref={containerRef} className="w-full h-full" />
        )}
      </div>

      {currentManifest && (
        <div className="flex items-center justify-between px-4 py-2 bg-black/80 border-t border-[#00f3ff]/10 text-xs text-white/40">
          <div className="flex items-center gap-4">
            <span>{currentManifest.name} v{currentManifest.version}</span>
            <span>By {currentManifest.author}</span>
          </div>
          <div className="flex items-center gap-2">
            <span>{currentManifest.files.length} files</span>
            <span className="text-[#4caf50]">Verified</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default G3TZKPWebBrowser;
