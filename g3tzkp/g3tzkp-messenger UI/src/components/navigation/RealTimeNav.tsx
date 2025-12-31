import React, { useEffect, useState, useRef, useCallback } from 'react';
import { navigationService } from '../../services/NavigationService';
import { TrafficService, TrafficIncident, RoadCondition } from '../../services/TrafficService';
import { PrivacyService } from '../../services/PrivacyService';
import { useNavigationStore } from '../../stores/useNavigationStore';
import { Coordinate, Route } from '../../types/navigation';
import { 
  Navigation, AlertTriangle, Shield, Volume2, VolumeX, 
  RotateCcw, Camera, Car, AlertCircle, Fuel, Leaf, Clock,
  ChevronRight, MapPin, Radio
} from 'lucide-react';

interface RealTimeNavProps {
  currentRoute: Route;
  currentLocation: Coordinate;
  heading: number;
  speed: number;
  onReroute: () => Promise<void>;
  onArrived: () => void;
  viewMode: '2d' | '3d';
}

const MANEUVER_ICONS: Record<string, string> = {
  'turn': '↪️', 'turn-left': '↙️', 'turn-right': '↘️', 'turn-slight-left': '↖️',
  'turn-slight-right': '↗️', 'continue': '⬆️', 'merge': '🔀', 'roundabout': '🔄',
  'ramp': '↗️', 'exit': '🚪', 'uturn': '↩️', 'arrive': '🎯', 'depart': '🚀'
};

const INCIDENT_ICONS: Record<string, string> = {
  'accident': '💥', 'congestion': '🚗', 'road_closure': '🚧', 'hazard': '⚠️',
  'police': '👮', 'speed_camera': '📸', 'construction': '🏗️', 'weather': '🌧️'
};

const CONDITION_ICONS: Record<string, string> = {
  'wet': '💧', 'icy': '❄️', 'foggy': '🌫️', 'windy': '💨',
  'bumpy': '🔴', 'smooth': '🟢', 'gravel': '🪨', 'potholes': '🕳️'
};

export const RealTimeNav: React.FC<RealTimeNavProps> = ({
  currentRoute,
  currentLocation,
  heading,
  speed,
  onReroute,
  onArrived,
  viewMode
}) => {
  const [nextManeuver, setNextManeuver] = useState<any>(null);
  const [distanceToNext, setDistanceToNext] = useState<number>(0);
  const [timeToDestination, setTimeToDestination] = useState<number>(0);
  const [trafficIncidents, setTrafficIncidents] = useState<TrafficIncident[]>([]);
  const [roadConditions, setRoadConditions] = useState<RoadCondition[]>([]);
  const [speedLimit, setSpeedLimit] = useState<number | null>(null);
  const [isRerouting, setIsRerouting] = useState<boolean>(false);
  const [arrivalTime, setArrivalTime] = useState<Date>(new Date());
  const [routeProgress, setRouteProgress] = useState<number>(0);
  const fuelEfficiency = 0.08;
  
  const lastNotificationRef = useRef<number>(0);
  
  const {
    audioGuidance,
    nightMode,
    autoReroute,
    hazardAlerts,
    toggleAudioGuidance
  } = useNavigationStore();

  const calculateDistance = useCallback((coord1: Coordinate, coord2: Coordinate): number => {
    const R = 6371000;
    const lat1 = coord1[1] * Math.PI / 180;
    const lat2 = coord2[1] * Math.PI / 180;
    const dLat = (coord2[1] - coord1[1]) * Math.PI / 180;
    const dLon = (coord2[0] - coord1[0]) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  const findNearestPointOnRoute = useCallback((location: Coordinate, coordinates: Coordinate[]): { index: number; distance: number } => {
    let minDist = Infinity;
    let nearestIndex = 0;
    
    for (let i = 0; i < coordinates.length; i++) {
      const dist = calculateDistance(location, coordinates[i]);
      if (dist < minDist) {
        minDist = dist;
        nearestIndex = i;
      }
    }
    
    return { index: nearestIndex, distance: minDist };
  }, [calculateDistance]);

  const playAudioGuidance = useCallback((type: string, instruction?: string) => {
    if (!audioGuidance || !('speechSynthesis' in window)) return;
    
    const texts: Record<string, string> = {
      'turn_now': `Now, ${instruction}`,
      'turn_soon': `In 500 meters, ${instruction}`,
      'turn_ahead': `In 1 kilometer, ${instruction}`,
      'rerouting': 'Heavy traffic ahead. Calculating new route.',
      'arrival': 'You have arrived at your destination.',
      'speed_camera': 'Speed camera ahead.',
      'police_ahead': 'Police reported ahead.',
      'accident_ahead': 'Accident reported ahead.',
      'hazard_reported': 'Hazard reported. Thank you.',
      'police_reported': 'Police report sent.',
      'speed_camera_reported': 'Speed camera reported.',
      'accident_reported': 'Accident report sent.'
    };
    
    const text = texts[type] || '';
    if (!text) return;
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.1;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
  }, [audioGuidance]);

  const updateNavigation = useCallback(() => {
    if (!currentRoute?.geometry?.coordinates?.length) return;
    
    const coords = currentRoute.geometry.coordinates;
    const { index, distance } = findNearestPointOnRoute(currentLocation, coords);
    const progress = index / Math.max(1, coords.length - 1);
    setRouteProgress(progress);
    
    let currentStep = currentRoute.legs?.[0]?.steps?.[0];
    let accumulatedDist = 0;
    const distanceTraveled = currentRoute.distance * progress;
    
    for (const leg of currentRoute.legs || []) {
      for (const step of leg.steps || []) {
        accumulatedDist += step.distance;
        if (accumulatedDist >= distanceTraveled) {
          currentStep = step;
          break;
        }
      }
    }
    
    setNextManeuver(currentStep);
    
    const stepCoords = currentStep?.geometry?.coordinates || [];
    if (stepCoords.length > 0) {
      const stepEnd = stepCoords[stepCoords.length - 1];
      const distToStep = calculateDistance(currentLocation, stepEnd);
      setDistanceToNext(distToStep);
      
      if (audioGuidance) {
        const now = Date.now();
        if (now - lastNotificationRef.current > 5000) {
          if (distToStep < 100) {
            playAudioGuidance('turn_now', currentStep?.maneuver?.instruction);
            lastNotificationRef.current = now;
          } else if (distToStep < 500) {
            playAudioGuidance('turn_soon', currentStep?.maneuver?.instruction);
            lastNotificationRef.current = now;
          }
        }
      }
    }
    
    const remainingDist = currentRoute.distance * (1 - progress);
    const avgSpeed = Math.max(speed, 30);
    const eta = (remainingDist / 1000) / avgSpeed * 3600;
    setTimeToDestination(eta);
    setArrivalTime(new Date(Date.now() + eta * 1000));
    
    if (progress >= 0.99 && distance < 50) {
      playAudioGuidance('arrival');
      setTimeout(onArrived, 3000);
    }
  }, [currentRoute, currentLocation, speed, audioGuidance, calculateDistance, findNearestPointOnRoute, playAudioGuidance, onArrived]);

  useEffect(() => {
    if (!currentRoute?.legs?.[0]?.steps?.[0]) return;
    
    const fetchData = async () => {
      const incidents = await TrafficService.getNearbyIncidents(currentLocation, 5000);
      setTrafficIncidents(incidents);
      
      const conditions = await TrafficService.getRoadConditions(currentLocation, 2000);
      setRoadConditions(conditions);
      
      const limit = await navigationService.getSpeedLimit(currentLocation);
      setSpeedLimit(limit);
    };
    
    fetchData();
    
    const navInterval = setInterval(updateNavigation, 1000);
    const trafficInterval = setInterval(async () => {
      const incidents = await TrafficService.getNearbyIncidents(currentLocation, 5000);
      setTrafficIncidents(incidents);
      
      const obfuscated = PrivacyService.obfuscateCoordinate(currentLocation, 'medium');
      await TrafficService.reportTraffic({
        location: obfuscated,
        speed,
        timestamp: Date.now(),
        roadType: 'road',
        confidence: 0.9
      });
    }, 30000);
    
    return () => {
      clearInterval(navInterval);
      clearInterval(trafficInterval);
    };
  }, [currentRoute, currentLocation, speed, updateNavigation]);

  useEffect(() => {
    if (!autoReroute || isRerouting || trafficIncidents.length === 0) return;
    
    const severeAhead = trafficIncidents.some(i => 
      i.severity > 0.7 && i.distance < 2000 && i.distance > 100
    );
    
    if (severeAhead) {
      setIsRerouting(true);
      playAudioGuidance('rerouting');
      setTimeout(async () => {
        await onReroute();
        setIsRerouting(false);
      }, 1000);
    }
  }, [trafficIncidents, autoReroute, isRerouting, onReroute, playAudioGuidance]);

  const reportHazard = async (type: 'police' | 'accident' | 'hazard' | 'speed_camera') => {
    const obfuscated = PrivacyService.obfuscateCoordinate(currentLocation, 'high');
    await TrafficService.reportHazard({
      type,
      location: obfuscated,
      timestamp: Date.now(),
      direction: heading,
      confidence: 0.9,
      additionalInfo: ''
    });
    playAudioGuidance(`${type}_reported`);
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  const formatDistance = (meters: number): string => {
    return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
  };

  const calculateFuelUsage = (): number => {
    const remaining = currentRoute.distance * (1 - routeProgress);
    return (remaining / 1000) * fuelEfficiency;
  };

  const calculateCO2 = (): number => calculateFuelUsage() * 2.31;

  const getManeuverIcon = (type?: string): string => MANEUVER_ICONS[type || ''] || '⬆️';

  return (
    <div className={`real-time-nav font-mono text-sm ${nightMode ? 'night-mode' : ''}`}>
      <div className="bg-black/90 border border-cyan-800 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl">{getManeuverIcon(nextManeuver?.maneuver?.type)}</div>
            <div>
              <div className="text-cyan-400 text-lg font-bold">
                {nextManeuver?.maneuver?.instruction || 'Continue straight'}
              </div>
              <div className="text-gray-400">
                {formatDistance(distanceToNext)}
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-2xl text-green-400 font-bold">
              {formatTime(timeToDestination)}
            </div>
            <div className="text-gray-500 text-xs">
              Arrive {arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between bg-black/50 rounded p-3 border border-gray-800">
          <div className="text-center">
            <div className="text-3xl text-white font-bold">{Math.round(speed)}</div>
            <div className="text-gray-500 text-xs">km/h</div>
          </div>
          
          {speedLimit && (
            <div className={`w-14 h-14 rounded-full border-4 flex items-center justify-center font-bold text-xl
              ${speed > speedLimit ? 'border-red-500 text-red-500 bg-red-900/30' : 'border-white text-white'}`}>
              {speedLimit}
            </div>
          )}
          
          <div className="text-center">
            <div className="text-lg text-cyan-400">{formatDistance(currentRoute.distance * (1 - routeProgress))}</div>
            <div className="text-gray-500 text-xs">remaining</div>
          </div>
        </div>

        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-cyan-500 to-green-500 transition-all duration-1000"
            style={{ width: `${routeProgress * 100}%` }}
          />
        </div>

        {trafficIncidents.length > 0 && hazardAlerts && (
          <div className="space-y-2">
            <div className="text-yellow-400 text-xs flex items-center gap-1">
              <AlertTriangle size={12} />
              <span>ALERTS ({trafficIncidents.length})</span>
            </div>
            {trafficIncidents.slice(0, 3).map((incident, idx) => (
              <div key={idx} className={`flex items-center justify-between p-2 rounded border 
                ${incident.severity > 0.7 ? 'border-red-800 bg-red-900/20' : 
                  incident.severity > 0.4 ? 'border-yellow-800 bg-yellow-900/20' : 
                  'border-gray-700 bg-gray-900/20'}`}>
                <div className="flex items-center gap-2">
                  <span>{INCIDENT_ICONS[incident.type] || '⚠️'}</span>
                  <span className="text-gray-300">{incident.description}</span>
                </div>
                <span className="text-gray-500">{formatDistance(incident.distance)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-between gap-2">
          <button 
            onClick={() => reportHazard('accident')} 
            className="flex-1 p-2 bg-red-900/40 hover:bg-red-800/60 border border-red-700 rounded text-red-400 transition-colors"
            title="Report Accident"
          >
            💥
          </button>
          <button 
            onClick={() => reportHazard('police')} 
            className="flex-1 p-2 bg-blue-900/40 hover:bg-blue-800/60 border border-blue-700 rounded text-blue-400 transition-colors"
            title="Report Police"
          >
            👮
          </button>
          <button 
            onClick={() => reportHazard('speed_camera')} 
            className="flex-1 p-2 bg-yellow-900/40 hover:bg-yellow-800/60 border border-yellow-700 rounded text-yellow-400 transition-colors"
            title="Report Camera"
          >
            📸
          </button>
          <button 
            onClick={() => reportHazard('hazard')} 
            className="flex-1 p-2 bg-orange-900/40 hover:bg-orange-800/60 border border-orange-700 rounded text-orange-400 transition-colors"
            title="Report Hazard"
          >
            ⚠️
          </button>
          <button 
            onClick={onReroute} 
            disabled={isRerouting}
            className="flex-1 p-2 bg-cyan-900/40 hover:bg-cyan-800/60 border border-cyan-700 rounded text-cyan-400 transition-colors disabled:opacity-50"
            title="Reroute"
          >
            {isRerouting ? <RotateCcw size={16} className="mx-auto animate-spin" /> : '↪️'}
          </button>
          <button 
            onClick={toggleAudioGuidance}
            className={`flex-1 p-2 border rounded transition-colors
              ${audioGuidance ? 'bg-green-900/40 border-green-700 text-green-400' : 'bg-gray-900/40 border-gray-700 text-gray-400'}`}
            title={audioGuidance ? 'Mute' : 'Unmute'}
          >
            {audioGuidance ? <Volume2 size={16} className="mx-auto" /> : <VolumeX size={16} className="mx-auto" />}
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          <div className="p-2 bg-black/50 rounded border border-gray-800">
            <Fuel size={14} className="mx-auto mb-1 text-cyan-400" />
            <div className="text-white">{calculateFuelUsage().toFixed(1)} L</div>
            <div className="text-gray-500">Fuel</div>
          </div>
          <div className="p-2 bg-black/50 rounded border border-gray-800">
            <Leaf size={14} className="mx-auto mb-1 text-green-400" />
            <div className="text-white">{calculateCO2().toFixed(1)} kg</div>
            <div className="text-gray-500">CO2</div>
          </div>
          <div className="p-2 bg-black/50 rounded border border-gray-800">
            <Car size={14} className="mx-auto mb-1 text-yellow-400" />
            <div className="text-white">{Math.round(currentRoute.distance / currentRoute.duration * 3.6)}</div>
            <div className="text-gray-500">Avg km/h</div>
          </div>
          <div className="p-2 bg-black/50 rounded border border-gray-800">
            <Shield size={14} className="mx-auto mb-1 text-cyan-400" />
            <div className="text-green-400">ACTIVE</div>
            <div className="text-gray-500">Privacy</div>
          </div>
        </div>

        {roadConditions.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {roadConditions.map((cond, idx) => (
              <span key={idx} className="px-2 py-1 bg-gray-800 rounded text-xs flex items-center gap-1">
                {CONDITION_ICONS[cond.type] || '🟡'}
                <span className="text-gray-400">{cond.description}</span>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-gray-500 border-t border-gray-800 pt-2">
          <div className="flex items-center gap-1">
            <Radio size={10} className="text-green-400" />
            <span>GPS: {Math.round(speed)} km/h</span>
          </div>
          <div className="flex items-center gap-1">
            <AlertCircle size={10} className="text-yellow-400" />
            <span>{trafficIncidents.length} alerts</span>
          </div>
          <div className="flex items-center gap-1">
            <Shield size={10} className="text-cyan-400" />
            <span>Privacy: Active</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock size={10} />
            <span>{nightMode ? 'Night' : 'Day'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RealTimeNav;
