import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, MapPin, Navigation, Car, Bike, Footprints, X, Loader2, Plus, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { Coordinate, Route, SearchResult } from '../../types/navigation';
import navigationService from '../../services/NavigationService';

interface RoutePlannerProps {
  onRouteCalculated: (route: Route) => void;
  currentLocation?: Coordinate;
}

type Profile = 'car' | 'bike' | 'foot';

interface SelectedLocation {
  name: string;
  coordinate: Coordinate;
  displayName?: string;
}

const SEARCH_RADIUS_OPTIONS = [10, 20, 30, 50, 100] as const;

const RoutePlanner: React.FC<RoutePlannerProps> = ({ onRouteCalculated, currentLocation }) => {
  const [startQuery, setStartQuery] = useState('');
  const [endQuery, setEndQuery] = useState('');
  const [viaQuery, setViaQuery] = useState('');
  const [startResults, setStartResults] = useState<SearchResult[]>([]);
  const [endResults, setEndResults] = useState<SearchResult[]>([]);
  const [viaResults, setViaResults] = useState<SearchResult[]>([]);
  const [selectedStart, setSelectedStart] = useState<SelectedLocation | null>(currentLocation ? { name: 'Current Location', coordinate: currentLocation } : null);
  const [selectedEnd, setSelectedEnd] = useState<SelectedLocation | null>(null);
  const [intermediateStops, setIntermediateStops] = useState<SelectedLocation[]>([]);
  const [profile, setProfile] = useState<Profile>('car');
  const [isSearchingStart, setIsSearchingStart] = useState(false);
  const [isSearchingEnd, setIsSearchingEnd] = useState(false);
  const [isSearchingVia, setIsSearchingVia] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showStartResults, setShowStartResults] = useState(false);
  const [showEndResults, setShowEndResults] = useState(false);
  const [showViaResults, setShowViaResults] = useState(false);
  const [searchRadius, setSearchRadius] = useState<number>(30);
  const [showOptions, setShowOptions] = useState(false);
  const [routeOptions, setRouteOptions] = useState({
    avoidMotorways: false,
    avoidTolls: false,
    avoidFerries: false,
    distanceUnits: 'auto' as 'auto' | 'miles' | 'km'
  });

  const startDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const endDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const viaDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const isSelectingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (startDebounceRef.current) clearTimeout(startDebounceRef.current);
      if (endDebounceRef.current) clearTimeout(endDebounceRef.current);
      if (viaDebounceRef.current) clearTimeout(viaDebounceRef.current);
    };
  }, []);

  const handleSearch = useCallback(async (query: string, type: 'start' | 'end' | 'via') => {
    const debounceRef = type === 'start' ? startDebounceRef : type === 'end' ? endDebounceRef : viaDebounceRef;
    const setSearching = type === 'start' ? setIsSearchingStart : type === 'end' ? setIsSearchingEnd : setIsSearchingVia;
    const setResults = type === 'start' ? setStartResults : type === 'end' ? setEndResults : setViaResults;
    const setShow = type === 'start' ? setShowStartResults : type === 'end' ? setShowEndResults : setShowViaResults;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim() || query.length < 2) {
      setResults([]);
      setShow(false);
      return;
    }

    setSearching(true);
    setShow(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const results = await navigationService.search(query, {
          nearLocation: currentLocation,
          radiusMiles: searchRadius
        });
        
        setResults(results);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setSearching(false);
      }
    }, 200);
  }, [currentLocation, searchRadius]);

  const handleSelectLocation = useCallback((result: SearchResult, type: 'start' | 'end' | 'via') => {
    isSelectingRef.current = true;
    const location: SelectedLocation = {
      name: result.name,
      coordinate: result.coordinate,
      displayName: result.name.split(',')[0]
    };
    
    if (type === 'start') {
      setSelectedStart(location);
      setStartQuery(location.displayName || location.name);
      setShowStartResults(false);
      setStartResults([]);
    } else if (type === 'end') {
      setSelectedEnd(location);
      setEndQuery(location.displayName || location.name);
      setShowEndResults(false);
      setEndResults([]);
    } else {
      setIntermediateStops(prev => [...prev, location]);
      setViaQuery('');
      setShowViaResults(false);
      setViaResults([]);
    }
    
    setTimeout(() => { isSelectingRef.current = false; }, 100);
  }, []);

  const handleRemoveViaStop = (index: number) => {
    setIntermediateStops(prev => prev.filter((_, i) => i !== index));
  };

  const handleUseCurrentLocation = useCallback(async () => {
    try {
      const coord = await navigationService.getCurrentPosition();
      setSelectedStart({ name: 'Current Location', coordinate: coord, displayName: 'Current Location' });
      setStartQuery('Current Location');
    } catch (error) {
      console.error('Failed to get current location:', error);
    }
  }, []);

  const handleCalculateRoute = useCallback(async () => {
    if (!selectedStart || !selectedEnd) return;

    setIsCalculating(true);
    try {
      const allCoordinates: Coordinate[] = [
        selectedStart.coordinate,
        ...intermediateStops.map(s => s.coordinate),
        selectedEnd.coordinate
      ];
      
      const routes = await navigationService.calculateRoute(
        allCoordinates,
        profile,
        3
      );
      if (routes.length > 0) {
        onRouteCalculated(routes[0]);
      }
    } finally {
      setIsCalculating(false);
    }
  }, [selectedStart, selectedEnd, intermediateStops, profile, onRouteCalculated]);

  const handleBlur = (type: 'start' | 'end' | 'via') => {
    setTimeout(() => {
      if (isSelectingRef.current) return;
      if (type === 'start') setShowStartResults(false);
      else if (type === 'end') setShowEndResults(false);
      else setShowViaResults(false);
    }, 300);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-cyan-400 font-mono text-sm flex items-center gap-2">
        <Navigation size={16} />
        ROUTE_PLANNER
      </h3>

      <div className="space-y-2">
        <div className="relative">
          <div className={`flex items-center gap-2 bg-gray-900 border rounded px-2 py-1.5 ${selectedStart ? 'border-green-600' : 'border-gray-700'}`}>
            <MapPin size={14} className="text-green-400" />
            <input
              type="text"
              value={startQuery}
              onChange={(e) => {
                setStartQuery(e.target.value);
                setSelectedStart(null);
                handleSearch(e.target.value, 'start');
              }}
              onFocus={() => startResults.length > 0 && setShowStartResults(true)}
              onBlur={() => handleBlur('start')}
              placeholder="From..."
              className="flex-1 bg-transparent text-white outline-none font-mono text-xs"
            />
            {isSearchingStart && <Loader2 size={12} className="animate-spin text-cyan-400" />}
            <button
              onClick={handleUseCurrentLocation}
              className="text-cyan-400 hover:text-cyan-300 text-[10px] font-mono"
              title="Use current location"
            >
              GPS
            </button>
            {startQuery && (
              <button onClick={() => { setStartQuery(''); setSelectedStart(null); }}>
                <X size={12} className="text-gray-500 hover:text-white" />
              </button>
            )}
            {selectedStart && <span className="text-green-400 text-[10px]">✓</span>}
          </div>

          {showStartResults && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded max-h-40 overflow-y-auto z-50 shadow-lg">
              {isSearchingStart ? (
                <div className="px-3 py-2 text-xs text-gray-400 flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin" /> Searching...
                </div>
              ) : startResults.length > 0 ? (
                startResults.map((result) => (
                  <button
                    key={result.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelectLocation(result, 'start')}
                    className="w-full text-left px-3 py-2 hover:bg-gray-800 text-xs text-gray-300 font-mono border-b border-gray-800 last:border-0"
                  >
                    <div className="truncate">{result.name.split(',')[0]}</div>
                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span className="truncate max-w-[70%]">{result.name.split(',').slice(1, 3).join(',')}</span>
                      {result.distance && <span>{result.distance.toFixed(1)} km</span>}
                    </div>
                  </button>
                ))
              ) : startQuery.length >= 2 ? (
                <div className="px-3 py-2 text-xs text-gray-500">No locations found</div>
              ) : null}
            </div>
          )}
        </div>

        {intermediateStops.length > 0 && (
          <div className="space-y-1 pl-3 border-l-2 border-cyan-800">
            {intermediateStops.map((stop, idx) => (
              <div key={`via-${idx}`} className="flex items-center gap-2 text-xs bg-gray-800/50 rounded px-2 py-1">
                <span className="text-cyan-400 text-[10px]">Via:</span>
                <span className="text-white flex-1 truncate">{stop.displayName || stop.name}</span>
                <button onClick={() => handleRemoveViaStop(idx)} className="text-red-400 hover:text-red-300">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="relative">
          <div className="flex items-center gap-2 bg-gray-800/50 border border-dashed border-gray-600 rounded px-2 py-1">
            <Plus size={14} className="text-cyan-400" />
            <input
              type="text"
              value={viaQuery}
              onChange={(e) => {
                setViaQuery(e.target.value);
                handleSearch(e.target.value, 'via');
              }}
              onFocus={() => viaResults.length > 0 && setShowViaResults(true)}
              onBlur={() => handleBlur('via')}
              placeholder="Add stop (via)"
              className="flex-1 bg-transparent text-white text-xs font-mono outline-none"
            />
            {isSearchingVia && <Loader2 size={12} className="animate-spin text-cyan-400" />}
          </div>
          {showViaResults && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded max-h-40 overflow-y-auto z-50 shadow-lg">
              {isSearchingVia ? (
                <div className="px-3 py-2 text-xs text-gray-400 flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin" /> Searching...
                </div>
              ) : viaResults.length > 0 ? (
                viaResults.map((result) => (
                  <button
                    key={result.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelectLocation(result, 'via')}
                    className="w-full text-left px-3 py-2 hover:bg-gray-800 text-xs text-gray-300 font-mono border-b border-gray-800 last:border-0"
                  >
                    <div className="truncate">{result.name.split(',')[0]}</div>
                    <div className="text-[10px] text-gray-500 truncate">{result.name.split(',').slice(1, 3).join(',')}</div>
                  </button>
                ))
              ) : viaQuery.length >= 2 ? (
                <div className="px-3 py-2 text-xs text-gray-500">No locations found</div>
              ) : null}
            </div>
          )}
        </div>

        <div className="relative">
          <div className={`flex items-center gap-2 bg-gray-900 border rounded px-2 py-1.5 ${selectedEnd ? 'border-red-600' : 'border-gray-700'}`}>
            <MapPin size={14} className="text-red-400" />
            <input
              type="text"
              value={endQuery}
              onChange={(e) => {
                setEndQuery(e.target.value);
                setSelectedEnd(null);
                handleSearch(e.target.value, 'end');
              }}
              onFocus={() => endResults.length > 0 && setShowEndResults(true)}
              onBlur={() => handleBlur('end')}
              placeholder="To..."
              className="flex-1 bg-transparent text-white outline-none font-mono text-xs"
              onKeyDown={(e) => e.key === 'Enter' && handleCalculateRoute()}
            />
            {isSearchingEnd && <Loader2 size={12} className="animate-spin text-cyan-400" />}
            {endQuery && (
              <button onClick={() => { setEndQuery(''); setSelectedEnd(null); }}>
                <X size={12} className="text-gray-500 hover:text-white" />
              </button>
            )}
            {selectedEnd && <span className="text-red-400 text-[10px]">✓</span>}
          </div>

          {showEndResults && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded max-h-40 overflow-y-auto z-50 shadow-lg">
              {isSearchingEnd ? (
                <div className="px-3 py-2 text-xs text-gray-400 flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin" /> Searching...
                </div>
              ) : endResults.length > 0 ? (
                endResults.map((result) => (
                  <button
                    key={result.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelectLocation(result, 'end')}
                    className="w-full text-left px-3 py-2 hover:bg-gray-800 text-xs text-gray-300 font-mono border-b border-gray-800 last:border-0"
                  >
                    <div className="truncate">{result.name.split(',')[0]}</div>
                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span className="truncate max-w-[70%]">{result.name.split(',').slice(1, 3).join(',')}</span>
                      {result.distance && <span>{result.distance.toFixed(1)} km</span>}
                    </div>
                  </button>
                ))
              ) : endQuery.length >= 2 ? (
                <div className="px-3 py-2 text-xs text-gray-500">No locations found</div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => setShowOptions(!showOptions)}
        className="w-full flex items-center justify-between px-2 py-1 text-xs text-gray-400 hover:text-cyan-400 font-mono"
      >
        <span>Route Options</span>
        {showOptions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {showOptions && (
        <div className="space-y-2 p-2 bg-gray-900/50 rounded border border-gray-700">
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-1 text-[10px] text-gray-400">
              <input
                type="checkbox"
                checked={routeOptions.avoidMotorways}
                onChange={(e) => setRouteOptions(prev => ({ ...prev, avoidMotorways: e.target.checked }))}
                className="w-3 h-3"
              />
              Avoid motorways
            </label>
            <label className="flex items-center gap-1 text-[10px] text-gray-400">
              <input
                type="checkbox"
                checked={routeOptions.avoidTolls}
                onChange={(e) => setRouteOptions(prev => ({ ...prev, avoidTolls: e.target.checked }))}
                className="w-3 h-3"
              />
              Avoid tolls
            </label>
            <label className="flex items-center gap-1 text-[10px] text-gray-400">
              <input
                type="checkbox"
                checked={routeOptions.avoidFerries}
                onChange={(e) => setRouteOptions(prev => ({ ...prev, avoidFerries: e.target.checked }))}
                className="w-3 h-3"
              />
              Avoid ferries
            </label>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-gray-400">Units:</span>
            {(['auto', 'km', 'miles'] as const).map(unit => (
              <button
                key={unit}
                onClick={() => setRouteOptions(prev => ({ ...prev, distanceUnits: unit }))}
                className={`px-2 py-0.5 rounded ${
                  routeOptions.distanceUnits === unit
                    ? 'bg-cyan-900 text-cyan-400'
                    : 'bg-gray-800 text-gray-500'
                }`}
              >
                {unit}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-center gap-1 text-[10px] font-mono">
            <span className="text-cyan-400">π</span>
            <span className="text-gray-500">SEARCH_RADIUS</span>
          </div>
          <div className="flex gap-1 justify-center">
            {SEARCH_RADIUS_OPTIONS.map((r) => (
              <button
                key={r}
                onClick={() => setSearchRadius(r)}
                className={`px-1.5 py-0.5 rounded text-[10px] ${
                  searchRadius === r
                    ? 'bg-cyan-900 text-cyan-400 border border-cyan-700'
                    : 'bg-gray-800 text-gray-500 border border-gray-700'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-1">
        <button
          onClick={() => setProfile('car')}
          className={`flex-1 py-1.5 rounded font-mono text-xs flex items-center justify-center gap-1 ${
            profile === 'car' 
              ? 'bg-cyan-900 text-cyan-400 border border-cyan-700' 
              : 'bg-gray-800 text-gray-400 border border-gray-700'
          }`}
        >
          <Car size={14} /> CAR
        </button>
        <button
          onClick={() => setProfile('bike')}
          className={`flex-1 py-1.5 rounded font-mono text-xs flex items-center justify-center gap-1 ${
            profile === 'bike' 
              ? 'bg-cyan-900 text-cyan-400 border border-cyan-700' 
              : 'bg-gray-800 text-gray-400 border border-gray-700'
          }`}
        >
          <Bike size={14} /> BIKE
        </button>
        <button
          onClick={() => setProfile('foot')}
          className={`flex-1 py-1.5 rounded font-mono text-xs flex items-center justify-center gap-1 ${
            profile === 'foot' 
              ? 'bg-cyan-900 text-cyan-400 border border-cyan-700' 
              : 'bg-gray-800 text-gray-400 border border-gray-700'
          }`}
        >
          <Footprints size={14} /> WALK
        </button>
      </div>

      <button
        onClick={handleCalculateRoute}
        disabled={!selectedStart || !selectedEnd || isCalculating}
        className="w-full py-2 bg-green-800 hover:bg-green-700 disabled:bg-gray-800 disabled:text-gray-500 text-white font-mono rounded flex items-center justify-center gap-2 text-xs"
      >
        {isCalculating ? (
          <>
            <Loader2 size={14} className="animate-spin" /> CALCULATING...
          </>
        ) : (
          <>
            <Search size={14} /> CALCULATE_ROUTE
          </>
        )}
      </button>
    </div>
  );
};

export default RoutePlanner;
