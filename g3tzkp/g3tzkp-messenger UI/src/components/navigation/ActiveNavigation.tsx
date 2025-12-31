import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
  Navigation, ArrowUp, ArrowRight, ArrowLeft, ArrowUpRight, ArrowUpLeft,
  RotateCcw, Flag, Volume2, VolumeX, AlertTriangle, Car, Shield, Camera,
  Construction, Gauge, MapPin, Clock, Milestone, Zap, ChevronUp, ChevronDown, X
} from 'lucide-react';
import { Route as RouteType, Coordinate, RouteStep } from '../../types/navigation';

interface ActiveNavigationProps {
  route: RouteType;
  onReroute: () => void;
  onEndNavigation: () => void;
  onReportHazard: (type: string, location: Coordinate) => void;
}

interface NavigationState {
  currentLocation: Coordinate | null;
  currentStepIndex: number;
  distanceToNextManeuver: number;
  remainingDistance: number;
  remainingTime: number;
  eta: Date;
  speed: number;
  heading: number;
  accuracy: number;
  gpsStatus: 'acquiring' | 'active' | 'weak' | 'lost';
}

const getManeuverIcon = (type: string, modifier?: string) => {
  const iconClass = "text-white";
  const size = 64;
  
  if (type === 'arrive') return <Flag size={size} className="text-green-400" />;
  if (type === 'depart') return <ArrowUp size={size} className={iconClass} />;
  
  if (modifier?.includes('right')) {
    if (modifier.includes('slight')) return <ArrowUpRight size={size} className={iconClass} />;
    return <ArrowRight size={size} className={iconClass} />;
  }
  if (modifier?.includes('left')) {
    if (modifier.includes('slight')) return <ArrowUpLeft size={size} className={iconClass} />;
    return <ArrowLeft size={size} className={iconClass} />;
  }
  
  return <ArrowUp size={size} className={iconClass} />;
};

const formatDistance = (meters: number): string => {
  if (meters < 100) return `${Math.round(meters)} m`;
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
};

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes} min`;
};

const calculateDistance = (coord1: Coordinate, coord2: Coordinate): number => {
  const R = 6371000;
  const dLat = (coord2[1] - coord1[1]) * Math.PI / 180;
  const dLon = (coord2[0] - coord1[0]) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(coord1[1] * Math.PI / 180) * Math.cos(coord2[1] * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

const ActiveNavigation: React.FC<ActiveNavigationProps> = ({
  route,
  onReroute,
  onEndNavigation,
  onReportHazard
}) => {
  const [navState, setNavState] = useState<NavigationState>({
    currentLocation: null,
    currentStepIndex: 0,
    distanceToNextManeuver: 0,
    remainingDistance: route.distance,
    remainingTime: route.duration,
    eta: new Date(Date.now() + route.duration * 1000),
    speed: 0,
    heading: 0,
    accuracy: 0,
    gpsStatus: 'acquiring'
  });
  
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [showHazardMenu, setShowHazardMenu] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const watchIdRef = useRef<number | null>(null);
  const lastAnnouncedStepRef = useRef<number>(-1);

  const steps = route.legs[0]?.steps || [];
  const currentStep = steps[navState.currentStepIndex];
  const nextStep = steps[navState.currentStepIndex + 1];

  const speak = useCallback((text: string) => {
    if (voiceEnabled && 'speechSynthesis' in window) {
      speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      speechSynthesis.speak(utterance);
    }
  }, [voiceEnabled]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setNavState(prev => ({ ...prev, gpsStatus: 'lost' }));
      return;
    }

    speak('Navigation started. ' + (currentStep?.instruction || 'Proceed to route'));

    const handlePosition = (position: GeolocationPosition) => {
      const newLocation: Coordinate = [position.coords.longitude, position.coords.latitude];
      const speed = position.coords.speed !== null ? position.coords.speed * 3.6 : 0;
      const heading = position.coords.heading || 0;
      const accuracy = position.coords.accuracy;

      setNavState(prev => {
        let newStepIndex = prev.currentStepIndex;
        let distToNext = prev.distanceToNextManeuver;
        
        if (currentStep) {
          const stepEnd = currentStep.maneuver.location;
          distToNext = calculateDistance(newLocation, stepEnd);
          
          if (distToNext < 30 && newStepIndex < steps.length - 1) {
            newStepIndex = prev.currentStepIndex + 1;
            const nextInstruction = steps[newStepIndex]?.instruction;
            if (nextInstruction && lastAnnouncedStepRef.current !== newStepIndex) {
              speak(nextInstruction);
              lastAnnouncedStepRef.current = newStepIndex;
            }
          } else if (distToNext < 100 && distToNext > 30 && lastAnnouncedStepRef.current !== prev.currentStepIndex) {
            speak(`In ${formatDistance(distToNext)}, ${currentStep.instruction}`);
            lastAnnouncedStepRef.current = prev.currentStepIndex;
          }
        }

        const destination = route.geometry.coordinates[route.geometry.coordinates.length - 1];
        const remainingDist = calculateDistance(newLocation, destination);
        const avgSpeed = speed > 0 ? speed : 50;
        const remainingTimeSeconds = (remainingDist / 1000) / (avgSpeed / 3.6) * 3600;

        if (remainingDist < 50) {
          speak('You have arrived at your destination');
          onEndNavigation();
        }

        return {
          ...prev,
          currentLocation: newLocation,
          currentStepIndex: newStepIndex,
          distanceToNextManeuver: distToNext,
          remainingDistance: remainingDist,
          remainingTime: remainingTimeSeconds,
          eta: new Date(Date.now() + remainingTimeSeconds * 1000),
          speed,
          heading,
          accuracy,
          gpsStatus: accuracy < 20 ? 'active' : accuracy < 50 ? 'weak' : 'acquiring'
        };
      });
    };

    const handleError = (error: GeolocationPositionError) => {
      console.error('GPS error:', error);
      setNavState(prev => ({ ...prev, gpsStatus: 'lost' }));
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      speechSynthesis.cancel();
    };
  }, [route, speak, currentStep, steps, onEndNavigation]);

  const hazardTypes = [
    { id: 'police', icon: Shield, label: 'Police', color: 'bg-blue-600' },
    { id: 'accident', icon: AlertTriangle, label: 'Accident', color: 'bg-red-600' },
    { id: 'hazard', icon: Construction, label: 'Road Hazard', color: 'bg-orange-600' },
    { id: 'camera', icon: Camera, label: 'Speed Camera', color: 'bg-purple-600' }
  ];

  const handleReportHazard = (type: string) => {
    if (navState.currentLocation) {
      onReportHazard(type, navState.currentLocation);
      speak(`${type} reported`);
    }
    setShowHazardMenu(false);
  };

  return (
    <div className="fixed inset-x-0 top-0 bottom-0 z-[9999] pointer-events-none flex flex-col">
      <div className="pointer-events-auto flex-shrink-0">
        <div className="bg-gradient-to-b from-black via-black/95 to-transparent">
          <div className="bg-cyan-900 p-4">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                {currentStep && getManeuverIcon(currentStep.maneuver.type, currentStep.maneuver.modifier)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-4xl font-bold text-white font-mono">
                  {formatDistance(navState.distanceToNextManeuver)}
                </div>
                <div className="text-lg text-cyan-200 font-mono truncate">
                  {currentStep?.instruction || 'Calculating...'}
                </div>
              </div>
              <button
                onClick={() => setVoiceEnabled(!voiceEnabled)}
                className="p-3 rounded-full bg-black/30 hover:bg-black/50"
              >
                {voiceEnabled ? <Volume2 size={24} className="text-white" /> : <VolumeX size={24} className="text-gray-400" />}
              </button>
            </div>
          </div>

          {nextStep && (
            <div className="bg-gray-900/90 px-4 py-2 flex items-center gap-3 border-b border-cyan-800/30">
              <span className="text-gray-400 text-sm font-mono">THEN</span>
              <div className="flex-shrink-0 scale-50 origin-left">
                {getManeuverIcon(nextStep.maneuver.type, nextStep.maneuver.modifier)}
              </div>
              <span className="text-gray-300 text-sm font-mono truncate">{nextStep.instruction}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto pointer-events-auto flex-shrink-0">
        <div className="bg-gradient-to-t from-black via-black/95 to-transparent pt-8">
          <div 
            className="bg-black/95 border-t border-cyan-800 cursor-pointer"
            onClick={() => setExpanded(!expanded)}
          >
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400 font-mono">
                    {formatDistance(navState.remainingDistance)}
                  </div>
                  <div className="text-xs text-gray-400 font-mono">REMAINING</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-cyan-400 font-mono">
                    {formatDuration(navState.remainingTime)}
                  </div>
                  <div className="text-xs text-gray-400 font-mono">TIME</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white font-mono">
                    {navState.eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="text-xs text-gray-400 font-mono">ETA</div>
                </div>
              </div>
              {expanded ? <ChevronDown size={24} className="text-gray-400" /> : <ChevronUp size={24} className="text-gray-400" />}
            </div>

            {expanded && (
              <div className="px-4 pb-4 space-y-3">
                <div className="flex items-center justify-between text-sm font-mono">
                  <div className="flex items-center gap-2">
                    <Gauge size={16} className="text-cyan-400" />
                    <span className="text-gray-400">Speed:</span>
                    <span className="text-white">{Math.round(navState.speed)} km/h</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Navigation size={16} className="text-cyan-400" />
                    <span className="text-gray-400">Heading:</span>
                    <span className="text-white">{Math.round(navState.heading)}°</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Milestone size={16} className="text-cyan-400" />
                    <span className="text-gray-400">Step:</span>
                    <span className="text-white">{navState.currentStepIndex + 1}/{steps.length}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    navState.gpsStatus === 'active' ? 'bg-green-500 animate-pulse' :
                    navState.gpsStatus === 'weak' ? 'bg-yellow-500' :
                    navState.gpsStatus === 'acquiring' ? 'bg-blue-500 animate-pulse' :
                    'bg-red-500'
                  }`} />
                  <span className="text-xs text-gray-400 font-mono">
                    GPS: {navState.gpsStatus.toUpperCase()} 
                    {navState.accuracy > 0 && ` (±${Math.round(navState.accuracy)}m)`}
                  </span>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); onReroute(); }}
                    className="flex-1 py-2 bg-cyan-900 hover:bg-cyan-800 text-cyan-400 font-mono text-sm rounded flex items-center justify-center gap-2"
                  >
                    <RotateCcw size={16} /> REROUTE
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); onEndNavigation(); }}
                    className="flex-1 py-2 bg-red-900 hover:bg-red-800 text-red-400 font-mono text-sm rounded flex items-center justify-center gap-2"
                  >
                    <X size={16} /> END
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="fixed right-4 top-1/2 -translate-y-1/2 z-[9999] pointer-events-auto">
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setShowHazardMenu(!showHazardMenu)}
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg ${
              showHazardMenu ? 'bg-orange-600' : 'bg-gray-800 hover:bg-gray-700'
            }`}
          >
            <AlertTriangle size={24} className="text-white" />
          </button>
          
          {showHazardMenu && (
            <div className="flex flex-col gap-2 animate-in slide-in-from-right">
              {hazardTypes.map(hazard => (
                <button
                  key={hazard.id}
                  onClick={() => handleReportHazard(hazard.id)}
                  className={`w-14 h-14 rounded-full ${hazard.color} flex items-center justify-center shadow-lg hover:opacity-80`}
                  title={hazard.label}
                >
                  <hazard.icon size={24} className="text-white" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="fixed left-4 top-1/2 -translate-y-1/2 z-[9999] pointer-events-auto">
        <div className="bg-black/80 rounded-lg p-3 border border-cyan-800/50">
          <div className="text-center">
            <Car size={32} className="text-cyan-400 mx-auto mb-1" />
            <div className="text-2xl font-bold text-white font-mono">
              {Math.round(navState.speed)}
            </div>
            <div className="text-xs text-gray-400 font-mono">km/h</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActiveNavigation;
