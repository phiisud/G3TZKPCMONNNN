import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Navigation, ArrowUp, ArrowUpRight, ArrowUpLeft, ArrowRight, ArrowLeft, RotateCcw, Flag, Volume2, Locate } from 'lucide-react';
import { Route, Coordinate, RouteStep } from '../../types/navigation';

interface NavigationInterfaceProps {
  route: Route;
  currentLocation: Coordinate;
  heading: number;
  speed: number;
  onReroute: () => void;
  onArrived: () => void;
}

const getManeuverIcon = (type: string) => {
  switch (type) {
    case 'turn-right':
    case 'right':
      return <ArrowRight size={48} className="text-cyan-400" />;
    case 'turn-left':
    case 'left':
      return <ArrowLeft size={48} className="text-cyan-400" />;
    case 'slight-right':
      return <ArrowUpRight size={48} className="text-cyan-400" />;
    case 'slight-left':
      return <ArrowUpLeft size={48} className="text-cyan-400" />;
    case 'arrive':
      return <Flag size={48} className="text-green-400" />;
    default:
      return <ArrowUp size={48} className="text-cyan-400" />;
  }
};

const formatDistance = (meters: number): string => {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
};

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
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

const NavigationInterface: React.FC<NavigationInterfaceProps> = ({
  route,
  currentLocation: initialLocation,
  heading: initialHeading,
  speed: initialSpeed,
  onReroute,
  onArrived
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [distanceToNext, setDistanceToNext] = useState(0);
  const [eta, setEta] = useState<Date>(new Date());
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [liveLocation, setLiveLocation] = useState<Coordinate>(initialLocation);
  const [liveSpeed, setLiveSpeed] = useState(initialSpeed);
  const [liveHeading, setLiveHeading] = useState(initialHeading);
  const [gpsStatus, setGpsStatus] = useState<'acquiring' | 'active' | 'error'>('acquiring');
  const watchIdRef = useRef<number | null>(null);

  const currentStep = route.legs[0]?.steps[currentStepIndex];
  const nextStep = route.legs[0]?.steps[currentStepIndex + 1];

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsStatus('error');
      return;
    }

    const handlePosition = (position: GeolocationPosition) => {
      setGpsStatus('active');
      const newLocation: Coordinate = [position.coords.longitude, position.coords.latitude];
      setLiveLocation(newLocation);
      
      if (position.coords.speed !== null) {
        setLiveSpeed(position.coords.speed);
      }
      if (position.coords.heading !== null) {
        setLiveHeading(position.coords.heading);
      }
    };

    const handleError = (error: GeolocationPositionError) => {
      console.error('Geolocation error:', error);
      setGpsStatus('error');
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 1000
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!currentStep) return;

    const stepEnd = currentStep.maneuver.location;
    const distance = calculateDistance(liveLocation, stepEnd);
    setDistanceToNext(distance);

    if (distance < 30 && nextStep) {
      setCurrentStepIndex(prev => prev + 1);
      
      if (voiceEnabled && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(nextStep.instruction);
        utterance.rate = 0.9;
        speechSynthesis.speak(utterance);
      }
    }

    const destination = route.geometry.coordinates[route.geometry.coordinates.length - 1];
    const distanceToEnd = calculateDistance(liveLocation, destination);
    if (distanceToEnd < 50) {
      onArrived();
      if (voiceEnabled && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance('You have arrived at your destination');
        speechSynthesis.speak(utterance);
      }
    }

    const remainingSteps = route.legs[0].steps.slice(currentStepIndex);
    const remainingDuration = remainingSteps.reduce((sum, step) => sum + step.duration, 0);
    setEta(new Date(Date.now() + remainingDuration * 1000));
  }, [liveLocation, currentStep, nextStep, route, currentStepIndex, voiceEnabled, onArrived]);

  const speakCurrentInstruction = useCallback(() => {
    if (currentStep && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(
        `In ${formatDistance(distanceToNext)}, ${currentStep.instruction}`
      );
      utterance.rate = 0.9;
      speechSynthesis.speak(utterance);
    }
  }, [currentStep, distanceToNext]);

  if (!currentStep) {
    return (
      <div className="text-center py-8">
        <Flag size={64} className="mx-auto text-green-400 mb-4" />
        <div className="text-green-400 font-mono text-xl">DESTINATION_REACHED</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-cyan-400 font-mono flex items-center gap-2">
          <Navigation size={18} className="animate-pulse" />
          ACTIVE_NAVIGATION
        </h3>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-mono ${
            gpsStatus === 'active' ? 'bg-green-900 text-green-400' :
            gpsStatus === 'acquiring' ? 'bg-yellow-900 text-yellow-400' :
            'bg-red-900 text-red-400'
          }`}>
            <Locate size={12} />
            {gpsStatus.toUpperCase()}
          </div>
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`p-2 rounded ${voiceEnabled ? 'bg-cyan-900 text-cyan-400' : 'bg-gray-800 text-gray-500'}`}
            aria-label={voiceEnabled ? 'Disable voice' : 'Enable voice'}
          >
            <Volume2 size={16} />
          </button>
        </div>
      </div>

      <div 
        className="bg-black border border-cyan-800 rounded-lg p-6 text-center cursor-pointer hover:bg-cyan-900/10"
        onClick={speakCurrentInstruction}
      >
        <div className="mb-4">
          {getManeuverIcon(currentStep.maneuver.type)}
        </div>
        <div className="text-3xl font-mono text-white mb-2">
          {formatDistance(distanceToNext)}
        </div>
        <div className="text-gray-400 font-mono text-sm">
          {currentStep.instruction || currentStep.name}
        </div>
      </div>

      {nextStep && (
        <div className="bg-gray-900 border border-gray-700 rounded p-3 flex items-center gap-3">
          <div className="text-gray-500">
            {getManeuverIcon(nextStep.maneuver.type)}
          </div>
          <div className="flex-1">
            <div className="text-gray-400 text-sm font-mono">THEN</div>
            <div className="text-white text-sm font-mono truncate">
              {nextStep.instruction || nextStep.name}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-gray-900 border border-gray-700 rounded p-3">
          <div className="text-gray-400 text-xs font-mono">REMAINING</div>
          <div className="text-green-400 text-lg font-mono">
            {formatDistance(route.distance)}
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded p-3">
          <div className="text-gray-400 text-xs font-mono">TIME</div>
          <div className="text-green-400 text-lg font-mono">
            {formatDuration(route.duration)}
          </div>
        </div>
        <div className="bg-gray-900 border border-gray-700 rounded p-3">
          <div className="text-gray-400 text-xs font-mono">ETA</div>
          <div className="text-green-400 text-lg font-mono">
            {eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500 font-mono">
        <span>Speed: {Math.round(liveSpeed * 3.6)} km/h</span>
        <span>Heading: {Math.round(liveHeading)}°</span>
        <span>Step: {currentStepIndex + 1}/{route.legs[0].steps.length}</span>
      </div>

      <button
        onClick={onReroute}
        className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-mono rounded flex items-center justify-center gap-2"
      >
        <RotateCcw size={16} /> RECALCULATE_ROUTE
      </button>

      <div className="text-center text-gray-600 text-xs font-mono">
        Live GPS tracking enabled - Real position updates
      </div>
    </div>
  );
};

export default NavigationInterface;
