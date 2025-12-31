import React, { useState, useEffect, useRef } from 'react';
import { Menu, Search, X, MapPin, Navigation, Car, Bus, Footprints, ChevronDown } from 'lucide-react';
import { TransportMode } from '../../stores/useNavigationStore';
import searchService, { SearchResult } from '../../services/SearchService';

interface TopLeftControlClusterProps {
  isNavigating: boolean;
  destinationName?: string | null;
  activeTransportMode: TransportMode;
  currentLocation?: { lat: number; lon: number };
  onMenuClick: () => void;
  onSearchSelect: (result: SearchResult) => void;
  onTransportModeChange: (mode: TransportMode) => void;
  onEndNavigation?: () => void;
}

export function TopLeftControlCluster({
  isNavigating,
  destinationName,
  activeTransportMode,
  currentLocation,
  onMenuClick,
  onSearchSelect,
  onTransportModeChange,
  onEndNavigation
}: TopLeftControlClusterProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (query.trim().length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);

    searchTimeoutRef.current = setTimeout(async () => {
      const searchResults = await searchService.search(query, currentLocation, 8);
      setResults(searchResults);
      setIsSearching(false);
      setShowResults(true);
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, currentLocation]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowResults(false);
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectResult = (result: SearchResult) => {
    onSearchSelect(result);
    setQuery('');
    setResults([]);
    setShowResults(false);
    setIsFocused(false);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  const transportModes: { mode: TransportMode; icon: React.ReactNode; label: string }[] = [
    { mode: 'car', icon: <Car className="w-5 h-5" />, label: 'Drive' },
    { mode: 'transit', icon: <Bus className="w-5 h-5" />, label: 'Transit' },
    { mode: 'walk', icon: <Footprints className="w-5 h-5" />, label: 'Walk' },
  ];

  return (
    <div 
      ref={containerRef}
      className={`fixed top-20 left-4 right-4 md:right-auto z-[1000] transition-all duration-300 ease-in-out ${
        isNavigating ? 'md:max-w-[400px]' : 'md:max-w-[600px] md:min-w-[400px]'
      }`}
    >
      <div className="flex items-center gap-2 md:gap-3 bg-slate-900/95 backdrop-blur-xl border border-slate-400/20 rounded-2xl p-2 md:p-3 shadow-2xl">
        <button
          onClick={onMenuClick}
          className="flex-shrink-0 w-12 h-12 md:w-11 md:h-11 flex items-center justify-center rounded-xl hover:bg-slate-800 transition-colors active:scale-95"
          aria-label="Menu"
        >
          <Menu className="w-6 h-6 text-slate-200" />
        </button>

        {isNavigating ? (
          <button
            onClick={onEndNavigation}
            className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl bg-teal-500/20 border border-teal-500/30 transition-all hover:bg-teal-500/30 min-w-0 min-h-[48px]"
          >
            <Navigation className="w-5 h-5 text-teal-300 flex-shrink-0" />
            <span className="text-slate-200 font-medium truncate text-base">
              To: {destinationName || 'Destination'}
            </span>
            <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0 ml-auto" />
          </button>
        ) : (
          <div className="flex-1 relative min-w-0">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => {
                setIsFocused(true);
                if (query.length >= 2) setShowResults(true);
              }}
              placeholder="Where to?"
              className="w-full bg-slate-800/60 border border-slate-600/30 rounded-xl pl-12 pr-12 py-3.5 text-slate-200 placeholder-slate-400 focus:outline-none focus:border-teal-500/50 text-base font-medium transition-colors min-h-[48px]"
            />
            {query && (
              <button
                onClick={clearSearch}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 p-2 hover:bg-slate-700 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            )}
            {isSearching && (
              <div className="absolute right-12 top-1/2 transform -translate-y-1/2">
                <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}

        <div className="flex-shrink-0 flex items-center gap-1 bg-slate-800/60 rounded-xl p-1">
          {isNavigating ? (
            <div className="w-11 h-11 flex items-center justify-center rounded-lg bg-teal-500/30 text-teal-300">
              {transportModes.find(t => t.mode === activeTransportMode)?.icon}
            </div>
          ) : (
            transportModes.map(({ mode, icon }) => (
              <button
                key={mode}
                onClick={() => onTransportModeChange(mode)}
                className={`w-11 h-11 flex items-center justify-center rounded-lg transition-all active:scale-95 ${
                  activeTransportMode === mode
                    ? 'bg-teal-500/30 text-teal-300'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                }`}
                aria-label={mode}
              >
                {icon}
              </button>
            ))
          )}
        </div>
      </div>

      {showResults && results.length > 0 && !isNavigating && (
        <div className="mt-2 bg-slate-900/95 backdrop-blur-md border border-slate-400/20 rounded-xl shadow-2xl max-h-[350px] overflow-y-auto">
          {results.map((result) => (
            <button
              key={result.id}
              onClick={() => handleSelectResult(result)}
              className="w-full px-4 py-3 hover:bg-teal-500/10 transition-colors flex items-start gap-3 border-b border-slate-800 last:border-b-0"
            >
              <div className="flex-shrink-0 w-9 h-9 bg-teal-500/20 rounded-lg flex items-center justify-center mt-0.5">
                <MapPin className="w-4 h-4 text-teal-400" />
              </div>
              
              <div className="flex-1 min-w-0 text-left">
                <h4 className="font-medium text-slate-200 truncate text-sm">{result.name}</h4>
                <p className="text-xs text-slate-400 truncate">{result.address}</p>
                
                {result.distance !== undefined && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="flex items-center gap-1 text-xs text-teal-400">
                      <Navigation className="w-3 h-3" />
                      {searchService.formatDistance(result.distance)}
                    </span>
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {showResults && results.length === 0 && query.length >= 2 && !isSearching && !isNavigating && (
        <div className="mt-2 bg-slate-900/95 backdrop-blur-md border border-slate-400/20 rounded-xl shadow-2xl p-6 text-center">
          <MapPin className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">No locations found</p>
          <p className="text-xs text-slate-600 mt-1">Try a different search term</p>
        </div>
      )}
    </div>
  );
}

export default TopLeftControlCluster;
