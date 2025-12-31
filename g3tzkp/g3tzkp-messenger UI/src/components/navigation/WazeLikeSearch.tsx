import React, { useState, useEffect, useRef } from 'react';
import { Search, X, MapPin, Navigation, Clock } from 'lucide-react';
import searchService, { SearchResult } from '../../services/SearchService';

interface WazeLikeSearchProps {
  onSelectLocation: (result: SearchResult) => void;
  currentLocation?: { lat: number; lon: number };
  className?: string;
}

export function WazeLikeSearch({ onSelectLocation, currentLocation, className = '' }: WazeLikeSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const inputRef = useRef<HTMLInputElement>(null);

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
      const searchResults = await searchService.search(query, currentLocation, 10);
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

  const handleSelectResult = (result: SearchResult) => {
    onSelectLocation(result);
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setShowResults(true)}
          placeholder="Search locations..."
          className="w-full bg-gray-900 border-2 border-cyan-500/30 rounded-xl pl-12 pr-12 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 text-lg font-medium"
        />
        {query && (
          <button
            onClick={clearSearch}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-800 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        )}
        {isSearching && (
          <div className="absolute right-14 top-1/2 transform -translate-y-1/2">
            <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {showResults && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border-2 border-cyan-500/30 rounded-xl shadow-2xl max-h-[400px] overflow-y-auto z-50">
          {results.map((result) => (
            <button
              key={result.id}
              onClick={() => handleSelectResult(result)}
              className="w-full px-4 py-3 hover:bg-cyan-500/10 transition-colors flex items-start gap-3 border-b border-gray-800 last:border-b-0"
            >
              <div className="flex-shrink-0 w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center mt-0.5">
                <MapPin className="w-5 h-5 text-cyan-400" />
              </div>
              
              <div className="flex-1 min-w-0 text-left">
                <h4 className="font-semibold text-white truncate">{result.name}</h4>
                <p className="text-sm text-gray-400 truncate">{result.address}</p>
                
                {result.distance !== undefined && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="flex items-center gap-1 text-xs text-cyan-400">
                      <Navigation className="w-3 h-3" />
                      {searchService.formatDistance(result.distance)}
                    </span>
                    {result.distance < 80467 && (
                      <span className="text-xs text-gray-500">Nearby</span>
                    )}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {showResults && results.length === 0 && query.length >= 2 && !isSearching && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border-2 border-cyan-500/30 rounded-xl shadow-2xl p-8 text-center z-50">
          <MapPin className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">No locations found</p>
          <p className="text-sm text-gray-600 mt-1">Try a different search term</p>
        </div>
      )}
    </div>
  );
}

export default WazeLikeSearch;
