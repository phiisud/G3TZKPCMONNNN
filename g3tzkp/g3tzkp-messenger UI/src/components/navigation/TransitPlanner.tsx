import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  Train, Bus, Footprints, Bike, Search, Clock, MapPin,
  AlertTriangle, ChevronRight, Loader2, RefreshCw, ArrowRight,
  Plus, X, Settings, Car
} from 'lucide-react';
import { Coordinate } from '../../types/navigation';

interface TransitLeg {
  mode: string;
  lineName?: string;
  lineColor?: string;
  departureTime: string;
  arrivalTime: string;
  duration: number;
  departureStop: { name: string; coordinate: Coordinate };
  arrivalStop: { name: string; coordinate: Coordinate };
  instruction: string;
  realtime?: { status?: string; delay?: number; platform?: string };
}

interface TransitJourney {
  id: string;
  startTime: string;
  arrivalTime: string;
  duration: number;
  legs: TransitLeg[];
  fare?: { total: number; currency: string };
  disruptions?: { severity: string; description: string }[];
}

interface LineStatus {
  lineId: string;
  lineName: string;
  mode: string;
  status: string;
  reason?: string;
}

interface StopSuggestion {
  id: string;
  name: string;
  naptanId?: string;
  coordinate?: Coordinate;
}

interface SelectedStop {
  id: string;
  name: string;
  naptanId?: string;
  coordinate?: Coordinate;
}

interface RouteOptions {
  avoidMotorways: boolean;
  avoidTolls: boolean;
  avoidFerries: boolean;
  distanceUnits: 'auto' | 'miles' | 'km';
}

interface TransitPlannerProps {
  currentLocation?: Coordinate;
  onJourneySelected?: (journey: TransitJourney) => void;
}

const MODE_ICONS: Record<string, React.ReactNode> = {
  'tube': <Train size={16} className="text-blue-400" />,
  'bus': <Bus size={16} className="text-red-400" />,
  'national-rail': <Train size={16} className="text-indigo-400" />,
  'train': <Train size={16} className="text-indigo-400" />,
  'tram': <Train size={16} className="text-green-400" />,
  'dlr': <Train size={16} className="text-teal-400" />,
  'overground': <Train size={16} className="text-orange-400" />,
  'elizabeth-line': <Train size={16} className="text-purple-400" />,
  'walking': <Footprints size={16} className="text-gray-400" />,
  'cycling': <Bike size={16} className="text-green-400" />,
  'driving': <Car size={16} className="text-yellow-400" />
};

const TransitPlanner: React.FC<TransitPlannerProps> = ({ currentLocation, onJourneySelected }) => {
  const [fromQuery, setFromQuery] = useState('');
  const [toQuery, setToQuery] = useState('');
  const [selectedFromStop, setSelectedFromStop] = useState<SelectedStop | null>(null);
  const [selectedToStop, setSelectedToStop] = useState<SelectedStop | null>(null);
  const [fromSuggestions, setFromSuggestions] = useState<StopSuggestion[]>([]);
  const [toSuggestions, setToSuggestions] = useState<StopSuggestion[]>([]);
  const [showFromDropdown, setShowFromDropdown] = useState(false);
  const [showToDropdown, setShowToDropdown] = useState(false);
  const [isSearchingFrom, setIsSearchingFrom] = useState(false);
  const [isSearchingTo, setIsSearchingTo] = useState(false);
  const [selectedModes, setSelectedModes] = useState<string[]>(['tube', 'bus', 'national-rail', 'walking']);
  const [journeys, setJourneys] = useState<TransitJourney[]>([]);
  const [lineStatus, setLineStatus] = useState<LineStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedJourney, setSelectedJourney] = useState<TransitJourney | null>(null);
  const [showStatus, setShowStatus] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  
  const [intermediateStops, setIntermediateStops] = useState<SelectedStop[]>([]);
  const [viaQuery, setViaQuery] = useState('');
  const [viaSuggestions, setViaSuggestions] = useState<StopSuggestion[]>([]);
  const [showViaDropdown, setShowViaDropdown] = useState(false);
  const [isSearchingVia, setIsSearchingVia] = useState(false);
  const [activeViaIndex, setActiveViaIndex] = useState<number | null>(null);
  
  const [routeOptions, setRouteOptions] = useState<RouteOptions>({
    avoidMotorways: false,
    avoidTolls: false,
    avoidFerries: false,
    distanceUnits: 'auto'
  });
  
  const [departureTime, setDepartureTime] = useState('');
  const [isArriveBy, setIsArriveBy] = useState(false);

  const fromDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const toDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const viaDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const isSelectingRef = useRef(false);

  useEffect(() => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    setDepartureTime(`${hours}:${minutes}`);
  }, []);

  useEffect(() => {
    return () => {
      if (fromDebounceRef.current) clearTimeout(fromDebounceRef.current);
      if (toDebounceRef.current) clearTimeout(toDebounceRef.current);
      if (viaDebounceRef.current) clearTimeout(viaDebounceRef.current);
    };
  }, []);

  useEffect(() => {
    fetchLineStatus();
  }, []);

  const searchStops = useCallback(async (query: string, type: 'from' | 'to' | 'via') => {
    const debounceRef = type === 'from' ? fromDebounceRef : type === 'to' ? toDebounceRef : viaDebounceRef;
    const setSearching = type === 'from' ? setIsSearchingFrom : type === 'to' ? setIsSearchingTo : setIsSearchingVia;
    const setSuggestions = type === 'from' ? setFromSuggestions : type === 'to' ? setToSuggestions : setViaSuggestions;
    const setShowDropdown = type === 'from' ? setShowFromDropdown : type === 'to' ? setShowToDropdown : setShowViaDropdown;

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim() || query.length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    setSearching(true);
    setShowDropdown(true);

    debounceRef.current = setTimeout(async () => {
      try {
        const response = await fetch(`/api/transit/search?query=${encodeURIComponent(query)}&maxResults=8`);
        if (response.ok) {
          const data = await response.json();
          const stops: StopSuggestion[] = (data || []).map((s: any) => ({
            id: s.id || s.naptanId || `stop_${Math.random().toString(36).slice(2)}`,
            name: s.name || s.commonName || 'Unknown Stop',
            naptanId: s.naptanId || s.id,
            coordinate: s.coordinate || (s.lat && s.lon ? [s.lon, s.lat] : undefined)
          }));
          setSuggestions(stops);
          setShowDropdown(stops.length > 0);
        } else {
          console.error('[TransitPlanner] Search failed:', response.status);
          setSuggestions([]);
        }
      } catch (err) {
        console.error('[TransitPlanner] Stop search error:', err);
        setSuggestions([]);
      } finally {
        setSearching(false);
      }
    }, 200);
  }, []);

  const handleFromChange = (value: string) => {
    setFromQuery(value);
    setSelectedFromStop(null);
    searchStops(value, 'from');
  };

  const handleToChange = (value: string) => {
    setToQuery(value);
    setSelectedToStop(null);
    searchStops(value, 'to');
  };

  const handleViaChange = (value: string) => {
    setViaQuery(value);
    searchStops(value, 'via');
  };

  const selectFromStop = (stop: StopSuggestion) => {
    isSelectingRef.current = true;
    console.log('[TransitPlanner] Selected FROM stop:', stop.id, stop.naptanId, stop.name);
    setFromQuery(stop.name);
    setSelectedFromStop({
      id: stop.id,
      name: stop.name,
      naptanId: stop.naptanId,
      coordinate: stop.coordinate
    });
    setShowFromDropdown(false);
    setFromSuggestions([]);
    setTimeout(() => { isSelectingRef.current = false; }, 100);
  };

  const selectToStop = (stop: StopSuggestion) => {
    isSelectingRef.current = true;
    console.log('[TransitPlanner] Selected TO stop:', stop.id, stop.naptanId, stop.name);
    setToQuery(stop.name);
    setSelectedToStop({
      id: stop.id,
      name: stop.name,
      naptanId: stop.naptanId,
      coordinate: stop.coordinate
    });
    setShowToDropdown(false);
    setToSuggestions([]);
    setTimeout(() => { isSelectingRef.current = false; }, 100);
  };

  const selectViaStop = (stop: StopSuggestion) => {
    isSelectingRef.current = true;
    console.log('[TransitPlanner] Selected VIA stop:', stop.id, stop.naptanId, stop.name);
    const newStop: SelectedStop = {
      id: stop.id,
      name: stop.name,
      naptanId: stop.naptanId,
      coordinate: stop.coordinate
    };
    setIntermediateStops(prev => [...prev, newStop]);
    setViaQuery('');
    setShowViaDropdown(false);
    setViaSuggestions([]);
    setTimeout(() => { isSelectingRef.current = false; }, 100);
  };

  const removeViaStop = (index: number) => {
    setIntermediateStops(prev => prev.filter((_, i) => i !== index));
  };

  const fetchLineStatus = async () => {
    try {
      const response = await fetch(`/api/transit/line-status`);
      if (response.ok) {
        const data = await response.json();
        setLineStatus(data || []);
      }
    } catch (err) {
      console.error('Failed to fetch line status:', err);
    }
  };

  const searchJourneys = useCallback(async () => {
    if (!fromQuery.trim() || !toQuery.trim()) {
      setError('Please enter both start and destination');
      return;
    }

    setIsLoading(true);
    setError(null);
    setShowFromDropdown(false);
    setShowToDropdown(false);
    setShowViaDropdown(false);

    try {
      const fromValue = selectedFromStop?.naptanId || selectedFromStop?.id || 
                        (selectedFromStop?.coordinate ? `${selectedFromStop.coordinate[1]},${selectedFromStop.coordinate[0]}` : fromQuery);
      const toValue = selectedToStop?.naptanId || selectedToStop?.id ||
                      (selectedToStop?.coordinate ? `${selectedToStop.coordinate[1]},${selectedToStop.coordinate[0]}` : toQuery);

      const params = new URLSearchParams({
        from: fromValue,
        to: toValue,
        mode: selectedModes.join(',')
      });

      if (intermediateStops.length > 0) {
        const viaIds = intermediateStops.map(s => s.naptanId || s.id || 
          (s.coordinate ? `${s.coordinate[1]},${s.coordinate[0]}` : s.name)).join('|');
        params.append('via', viaIds);
      }

      if (departureTime) {
        const tflTime = departureTime.replace(':', '');
        params.append('time', tflTime);
        params.append('timeIs', isArriveBy ? 'Arriving' : 'Departing');
      }

      if (routeOptions.avoidMotorways) params.append('avoidMotorways', 'true');
      if (routeOptions.avoidTolls) params.append('avoidTolls', 'true');
      if (routeOptions.avoidFerries) params.append('avoidFerries', 'true');
      if (routeOptions.distanceUnits !== 'auto') params.append('units', routeOptions.distanceUnits);

      const response = await fetch(`/api/transit/journey?${params}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[TransitPlanner] Journey API error:', response.status, errorText);
        throw new Error('Failed to find journeys');
      }

      const data = await response.json();
      
      const parsedJourneys: TransitJourney[] = (data.journeys || []).map((j: any, idx: number) => ({
        id: `journey_${idx}`,
        startTime: j.startDateTime,
        arrivalTime: j.arrivalDateTime,
        duration: j.duration,
        legs: (j.legs || []).map((leg: any) => ({
          mode: normalizeMode(leg.mode?.id || 'walking'),
          lineName: leg.routeOptions?.[0]?.name || leg.instruction?.summary,
          lineColor: getLineColor(leg.mode?.id, leg.routeOptions?.[0]?.name),
          departureTime: leg.departureTime,
          arrivalTime: leg.arrivalTime,
          duration: leg.duration,
          departureStop: {
            name: leg.departurePoint?.commonName || 'Unknown',
            coordinate: [leg.departurePoint?.lon || 0, leg.departurePoint?.lat || 0]
          },
          arrivalStop: {
            name: leg.arrivalPoint?.commonName || 'Unknown',
            coordinate: [leg.arrivalPoint?.lon || 0, leg.arrivalPoint?.lat || 0]
          },
          instruction: leg.instruction?.detailed || leg.instruction?.summary || 'Continue',
          realtime: {
            platform: leg.departurePoint?.platformName,
            status: 'on-time'
          }
        })),
        fare: j.fare ? { total: j.fare.totalCost / 100, currency: 'GBP' } : undefined,
        disruptions: (j.disruptions || []).map((d: any) => ({
          severity: 'moderate',
          description: d.description
        }))
      }));

      setJourneys(parsedJourneys);
      
      if (parsedJourneys.length === 0) {
        setError('No journeys found for this route');
      }
    } catch (err) {
      console.error('[TransitPlanner] Search error:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsLoading(false);
    }
  }, [fromQuery, toQuery, selectedFromStop, selectedToStop, selectedModes, intermediateStops, departureTime, isArriveBy, routeOptions]);

  const normalizeMode = (mode: string): string => {
    const modeMap: Record<string, string> = {
      'walking': 'walking', 'cycle': 'cycling', 'tube': 'tube',
      'bus': 'bus', 'dlr': 'dlr', 'overground': 'overground',
      'tram': 'tram', 'elizabeth-line': 'elizabeth-line',
      'national-rail': 'train', 'rail': 'train'
    };
    return modeMap[mode?.toLowerCase()] || 'walking';
  };

  const getLineColor = (mode: string, lineName?: string): string => {
    const tubeColors: Record<string, string> = {
      'bakerloo': '#B36305', 'central': '#E32017', 'circle': '#FFD300',
      'district': '#00782A', 'hammersmith': '#F3A9BB', 'jubilee': '#A0A5A9',
      'metropolitan': '#9B0056', 'northern': '#000000', 'piccadilly': '#003688',
      'victoria': '#0098D4', 'waterloo': '#95CDBA'
    };
    if (mode === 'tube' && lineName) {
      const key = lineName.toLowerCase().split(' ')[0];
      return tubeColors[key] || '#0019A8';
    }
    const modeColors: Record<string, string> = {
      'tube': '#0019A8', 'bus': '#DC241F', 'dlr': '#00AFAD',
      'overground': '#EE7C0E', 'tram': '#84B817', 'elizabeth-line': '#6950A1',
      'train': '#1C3F94', 'walking': '#666666'
    };
    return modeColors[mode] || '#666666';
  };

  const formatTime = (isoString: string): string => {
    try {
      return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return isoString;
    }
  };

  const toggleMode = (mode: string) => {
    setSelectedModes(prev => 
      prev.includes(mode) ? prev.filter(m => m !== mode) : [...prev, mode]
    );
  };

  const handleSelectJourney = (journey: TransitJourney) => {
    setSelectedJourney(journey);
    onJourneySelected?.(journey);
  };

  const setLeaveNow = () => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    setDepartureTime(`${hours}:${minutes}`);
    setIsArriveBy(false);
  };

  const modes = [
    { id: 'tube', label: 'Tube', icon: <Train size={14} /> },
    { id: 'bus', label: 'Bus', icon: <Bus size={14} /> },
    { id: 'train', label: 'Rail', icon: <Train size={14} /> },
    { id: 'walking', label: 'Walk', icon: <Footprints size={14} /> }
  ];

  const getStatusColor = (status: string): string => {
    if (status === 'Good Service') return 'text-green-400';
    if (status.includes('Minor')) return 'text-yellow-400';
    if (status.includes('Severe') || status.includes('Suspended')) return 'text-red-400';
    return 'text-orange-400';
  };

  const problemLines = lineStatus.filter(l => l.status !== 'Good Service');

  return (
    <div className="space-y-3">
      <h3 className="text-cyan-400 font-mono text-sm flex items-center gap-2">
        <Train size={16} /> PUBLIC TRANSPORT
      </h3>

      {problemLines.length > 0 && (
        <button
          onClick={() => setShowStatus(!showStatus)}
          className="w-full flex items-center gap-2 p-2 bg-yellow-900/30 border border-yellow-700/50 rounded text-xs"
        >
          <AlertTriangle size={14} className="text-yellow-400" />
          <span className="text-yellow-400">{problemLines.length} lines with issues</span>
          <ChevronRight size={14} className={`text-yellow-400 ml-auto transition-transform ${showStatus ? 'rotate-90' : ''}`} />
        </button>
      )}

      {showStatus && (
        <div className="max-h-32 overflow-y-auto space-y-1 bg-gray-900/50 rounded p-2">
          {problemLines.map(line => (
            <div key={line.lineId} className="text-xs flex items-center gap-2">
              <span className="text-gray-400">{line.lineName}:</span>
              <span className={getStatusColor(line.status)}>{line.status}</span>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <div className="relative">
          <div className={`flex items-center gap-2 bg-gray-900 border rounded px-2 py-1.5 ${selectedFromStop ? 'border-green-600' : 'border-gray-700'}`}>
            <MapPin size={14} className="text-green-400" />
            <input
              type="text"
              value={fromQuery}
              onChange={(e) => handleFromChange(e.target.value)}
              onFocus={() => fromSuggestions.length > 0 && setShowFromDropdown(true)}
              onBlur={() => setTimeout(() => { if (!isSelectingRef.current) setShowFromDropdown(false); }, 300)}
              placeholder="From (e.g., Camden Town)"
              className="flex-1 bg-transparent text-white text-xs font-mono outline-none"
            />
            {isSearchingFrom && <Loader2 size={12} className="animate-spin text-cyan-400" />}
            {selectedFromStop && <span className="text-green-400 text-[10px]">✓</span>}
          </div>
          {showFromDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded max-h-40 overflow-y-auto z-50 shadow-lg">
              {isSearchingFrom ? (
                <div className="px-3 py-2 text-xs text-gray-400 flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin" /> Searching...
                </div>
              ) : fromSuggestions.length > 0 ? (
                fromSuggestions.map((stop) => (
                  <button
                    key={stop.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectFromStop(stop)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-800 text-xs text-gray-300 font-mono truncate border-b border-gray-800 last:border-0"
                  >
                    <MapPin size={10} className="inline mr-2 text-green-400" />
                    {stop.name}
                  </button>
                ))
              ) : fromQuery.length >= 2 ? (
                <div className="px-3 py-2 text-xs text-gray-500">No stops found</div>
              ) : null}
            </div>
          )}
        </div>

        {intermediateStops.length > 0 && (
          <div className="space-y-1 pl-4 border-l-2 border-cyan-800">
            {intermediateStops.map((stop, idx) => (
              <div key={stop.id + idx} className="flex items-center gap-2 text-xs bg-gray-800/50 rounded px-2 py-1">
                <span className="text-cyan-400">Via:</span>
                <span className="text-white flex-1 truncate">{stop.name}</span>
                <button onClick={() => removeViaStop(idx)} className="text-red-400 hover:text-red-300">
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
              onChange={(e) => handleViaChange(e.target.value)}
              onFocus={() => viaSuggestions.length > 0 && setShowViaDropdown(true)}
              onBlur={() => setTimeout(() => { if (!isSelectingRef.current) setShowViaDropdown(false); }, 300)}
              placeholder="Add stop (via)"
              className="flex-1 bg-transparent text-white text-xs font-mono outline-none"
            />
            {isSearchingVia && <Loader2 size={12} className="animate-spin text-cyan-400" />}
          </div>
          {showViaDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded max-h-40 overflow-y-auto z-50 shadow-lg">
              {isSearchingVia ? (
                <div className="px-3 py-2 text-xs text-gray-400 flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin" /> Searching...
                </div>
              ) : viaSuggestions.length > 0 ? (
                viaSuggestions.map((stop) => (
                  <button
                    key={stop.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectViaStop(stop)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-800 text-xs text-gray-300 font-mono truncate border-b border-gray-800 last:border-0"
                  >
                    <MapPin size={10} className="inline mr-2 text-cyan-400" />
                    {stop.name}
                  </button>
                ))
              ) : viaQuery.length >= 2 ? (
                <div className="px-3 py-2 text-xs text-gray-500">No stops found</div>
              ) : null}
            </div>
          )}
        </div>
        
        <div className="relative">
          <div className={`flex items-center gap-2 bg-gray-900 border rounded px-2 py-1.5 ${selectedToStop ? 'border-red-600' : 'border-gray-700'}`}>
            <MapPin size={14} className="text-red-400" />
            <input
              type="text"
              value={toQuery}
              onChange={(e) => handleToChange(e.target.value)}
              onFocus={() => toSuggestions.length > 0 && setShowToDropdown(true)}
              onBlur={() => setTimeout(() => { if (!isSelectingRef.current) setShowToDropdown(false); }, 300)}
              placeholder="To (e.g., Kings Cross)"
              className="flex-1 bg-transparent text-white text-xs font-mono outline-none"
              onKeyDown={(e) => e.key === 'Enter' && searchJourneys()}
            />
            {isSearchingTo && <Loader2 size={12} className="animate-spin text-cyan-400" />}
            {selectedToStop && <span className="text-red-400 text-[10px]">✓</span>}
          </div>
          {showToDropdown && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded max-h-40 overflow-y-auto z-50 shadow-lg">
              {isSearchingTo ? (
                <div className="px-3 py-2 text-xs text-gray-400 flex items-center gap-2">
                  <Loader2 size={12} className="animate-spin" /> Searching...
                </div>
              ) : toSuggestions.length > 0 ? (
                toSuggestions.map((stop) => (
                  <button
                    key={stop.id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => selectToStop(stop)}
                    className="w-full text-left px-3 py-2 hover:bg-gray-800 text-xs text-gray-300 font-mono truncate border-b border-gray-800 last:border-0"
                  >
                    <MapPin size={10} className="inline mr-2 text-red-400" />
                    {stop.name}
                  </button>
                ))
              ) : toQuery.length >= 2 ? (
                <div className="px-3 py-2 text-xs text-gray-500">No stops found</div>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 text-xs">
        <button
          onClick={() => setIsArriveBy(false)}
          className={`px-2 py-1 rounded ${!isArriveBy ? 'bg-cyan-800 text-cyan-400' : 'bg-gray-800 text-gray-400'}`}
        >
          Depart at
        </button>
        <input
          type="time"
          value={departureTime}
          onChange={(e) => setDepartureTime(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-white font-mono"
        />
        <button
          onClick={() => setIsArriveBy(true)}
          className={`px-2 py-1 rounded ${isArriveBy ? 'bg-cyan-800 text-cyan-400' : 'bg-gray-800 text-gray-400'}`}
        >
          Arrive by
        </button>
        <button
          onClick={setLeaveNow}
          className="px-2 py-1 rounded bg-green-800 text-green-400 hover:bg-green-700"
        >
          Now
        </button>
      </div>

      <div className="flex flex-wrap gap-1">
        {modes.map(mode => (
          <button
            key={mode.id}
            onClick={() => toggleMode(mode.id)}
            className={`px-2 py-1 text-xs font-mono rounded flex items-center gap-1 ${
              selectedModes.includes(mode.id)
                ? 'bg-cyan-900 text-cyan-400 border border-cyan-700'
                : 'bg-gray-800 text-gray-500 border border-gray-700'
            }`}
          >
            {mode.icon} {mode.label}
          </button>
        ))}
      </div>

      <button
        onClick={() => setShowOptions(!showOptions)}
        className="w-full flex items-center gap-2 text-xs text-gray-400 hover:text-cyan-400 py-1"
      >
        <Settings size={12} />
        <span>Route options</span>
        <ChevronRight size={12} className={`ml-auto transition-transform ${showOptions ? 'rotate-90' : ''}`} />
      </button>

      {showOptions && (
        <div className="space-y-2 p-2 bg-gray-900/50 rounded border border-gray-700">
          <div className="text-xs text-gray-400 mb-2">Avoid</div>
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-1 text-xs text-gray-300">
              <input
                type="checkbox"
                checked={routeOptions.avoidMotorways}
                onChange={(e) => setRouteOptions(prev => ({ ...prev, avoidMotorways: e.target.checked }))}
                className="rounded bg-gray-800 border-gray-600"
              />
              Motorways
            </label>
            <label className="flex items-center gap-1 text-xs text-gray-300">
              <input
                type="checkbox"
                checked={routeOptions.avoidTolls}
                onChange={(e) => setRouteOptions(prev => ({ ...prev, avoidTolls: e.target.checked }))}
                className="rounded bg-gray-800 border-gray-600"
              />
              Tolls
            </label>
            <label className="flex items-center gap-1 text-xs text-gray-300">
              <input
                type="checkbox"
                checked={routeOptions.avoidFerries}
                onChange={(e) => setRouteOptions(prev => ({ ...prev, avoidFerries: e.target.checked }))}
                className="rounded bg-gray-800 border-gray-600"
              />
              Ferries
            </label>
          </div>
          
          <div className="text-xs text-gray-400 mt-2 mb-1">Distance units</div>
          <div className="flex gap-2">
            {(['auto', 'miles', 'km'] as const).map(unit => (
              <button
                key={unit}
                onClick={() => setRouteOptions(prev => ({ ...prev, distanceUnits: unit }))}
                className={`px-2 py-1 text-xs rounded ${
                  routeOptions.distanceUnits === unit
                    ? 'bg-cyan-800 text-cyan-400'
                    : 'bg-gray-800 text-gray-400'
                }`}
              >
                {unit === 'auto' ? 'Automatic' : unit}
              </button>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={searchJourneys}
        disabled={isLoading}
        className="w-full py-2 bg-cyan-800 hover:bg-cyan-700 text-white font-mono text-xs rounded flex items-center justify-center gap-2 disabled:opacity-50"
      >
        {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
        {isLoading ? 'SEARCHING...' : 'FIND JOURNEYS'}
      </button>

      {error && (
        <div className="text-red-400 text-xs font-mono p-2 bg-red-900/20 rounded">
          {error}
        </div>
      )}

      {journeys.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {journeys.map((journey) => (
            <button
              key={journey.id}
              onClick={() => handleSelectJourney(journey)}
              className={`w-full text-left p-2 rounded border transition-all ${
                selectedJourney?.id === journey.id
                  ? 'bg-cyan-900/50 border-cyan-600'
                  : 'bg-gray-900/50 border-gray-700 hover:border-cyan-700'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1 text-xs font-mono">
                  <Clock size={12} className="text-gray-400" />
                  <span className="text-white">{formatTime(journey.startTime)}</span>
                  <ArrowRight size={12} className="text-gray-500" />
                  <span className="text-white">{formatTime(journey.arrivalTime)}</span>
                </div>
                <span className="text-cyan-400 text-xs font-mono">{journey.duration} min</span>
              </div>
              
              <div className="flex items-center gap-1 flex-wrap">
                {journey.legs.map((leg, idx) => (
                  <React.Fragment key={idx}>
                    {idx > 0 && <ChevronRight size={10} className="text-gray-600" />}
                    <div 
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs"
                      style={{ backgroundColor: `${leg.lineColor}20`, borderColor: leg.lineColor, borderWidth: 1 }}
                    >
                      {MODE_ICONS[leg.mode]}
                      {leg.lineName && <span className="text-white text-[10px]">{leg.lineName.split(' ')[0]}</span>}
                    </div>
                  </React.Fragment>
                ))}
              </div>

              {journey.disruptions && journey.disruptions.length > 0 && (
                <div className="mt-1 flex items-center gap-1 text-yellow-400 text-[10px]">
                  <AlertTriangle size={10} />
                  <span>Disruptions on route</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {selectedJourney && (
        <div className="space-y-2 p-2 bg-gray-900/70 rounded border border-cyan-800/50">
          <div className="text-xs font-mono text-cyan-400 mb-2">JOURNEY DETAILS</div>
          {selectedJourney.legs.map((leg, idx) => (
            <div key={idx} className="flex gap-2 text-xs">
              <div className="flex flex-col items-center">
                <div 
                  className="w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: leg.lineColor }}
                >
                  {MODE_ICONS[leg.mode]}
                </div>
                {idx < selectedJourney.legs.length - 1 && (
                  <div className="w-0.5 flex-1 my-1" style={{ backgroundColor: leg.lineColor }} />
                )}
              </div>
              <div className="flex-1 pb-3">
                <div className="text-white font-mono">{leg.departureStop.name}</div>
                <div className="text-gray-400">{formatTime(leg.departureTime)} - {leg.instruction}</div>
                {leg.lineName && (
                  <div className="text-cyan-400 text-[10px]">{leg.lineName}</div>
                )}
                {leg.realtime?.platform && (
                  <div className="text-green-400 text-[10px]">Platform {leg.realtime.platform}</div>
                )}
              </div>
            </div>
          ))}
          
          {selectedJourney.fare && (
            <div className="text-xs font-mono flex justify-between pt-2 border-t border-gray-700">
              <span className="text-gray-400">Estimated fare:</span>
              <span className="text-green-400">£{selectedJourney.fare.total.toFixed(2)}</span>
            </div>
          )}
        </div>
      )}

      <button
        onClick={fetchLineStatus}
        className="w-full py-1.5 text-xs font-mono text-gray-400 hover:text-cyan-400 flex items-center justify-center gap-1"
      >
        <RefreshCw size={12} /> Refresh line status
      </button>
    </div>
  );
};

export default TransitPlanner;
