import React, { useState, useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown, X, Navigation, Clock, MapPin, ArrowRight, Bus, Car, Footprints } from 'lucide-react';
import { Route } from '../../types/navigation';
import { TransportMode } from '../../stores/useNavigationStore';

interface BottomSheetPanelProps {
  isOpen: boolean;
  route?: Route | null;
  destinationName?: string | null;
  transportMode: TransportMode;
  distanceToNext?: number;
  timeToDestination?: number;
  currentStep?: number;
  isNavigating: boolean;
  onClose: () => void;
  onStartNavigation: () => void;
  onEndNavigation: () => void;
}

export function BottomSheetPanel({
  isOpen,
  route,
  destinationName,
  transportMode,
  distanceToNext = 0,
  timeToDestination = 0,
  currentStep = 0,
  isNavigating,
  onClose,
  onStartNavigation,
  onEndNavigation
}: BottomSheetPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hours}h ${remainingMins}m`;
  };

  const formatDistance = (meters: number): string => {
    if (meters < 1000) return `${Math.round(meters)}m`;
    return `${(meters / 1000).toFixed(1)}km`;
  };

  const TransportIcon = transportMode === 'car' ? Car : transportMode === 'transit' ? Bus : Footprints;

  if (!isOpen && !route) return null;

  const sheetHeight = expanded ? 'h-[50vh]' : 'h-auto max-h-[35vh]';

  return (
    <div 
      ref={sheetRef}
      className={`fixed bottom-0 left-0 right-0 z-[999] transition-all duration-400 ease-out ${sheetHeight}`}
      style={{ 
        transform: isOpen || route ? 'translateY(0)' : 'translateY(100%)',
      }}
    >
      <div className="bg-slate-900/95 backdrop-blur-md border-t border-slate-400/20 rounded-t-2xl shadow-2xl h-full flex flex-col">
        <div 
          className="flex items-center justify-center py-2 cursor-grab active:cursor-grabbing"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="w-10 h-1 bg-slate-600 rounded-full" />
        </div>

        <div className="px-4 pb-4 flex-1 overflow-y-auto">
          {route ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-teal-500/20 rounded-xl flex items-center justify-center">
                    <TransportIcon className="w-6 h-6 text-teal-400" />
                  </div>
                  <div>
                    <h3 className="text-slate-200 font-semibold text-lg">
                      {formatDuration(route.duration)}
                    </h3>
                    <p className="text-slate-400 text-sm">
                      {formatDistance(route.distance)} via {transportMode === 'car' ? 'fastest route' : transportMode}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {destinationName && (
                <div className="flex items-center gap-3 mb-4 p-3 bg-slate-800/50 rounded-xl">
                  <MapPin className="w-5 h-5 text-green-400" />
                  <span className="text-slate-200 font-medium truncate">{destinationName}</span>
                </div>
              )}

              {!isNavigating ? (
                <button
                  onClick={onStartNavigation}
                  className="w-full py-4 bg-teal-500 hover:bg-teal-400 text-slate-900 font-bold rounded-xl transition-colors flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <Navigation className="w-5 h-5" />
                  Start Navigation
                </button>
              ) : (
                <div className="space-y-3">
                  {distanceToNext > 0 && (
                    <div className="p-4 bg-teal-500/20 border border-teal-500/30 rounded-xl">
                      <div className="flex items-center gap-3">
                        <ArrowRight className="w-8 h-8 text-teal-400" />
                        <div>
                          <p className="text-teal-300 font-bold text-xl">{formatDistance(distanceToNext)}</p>
                          <p className="text-slate-400 text-sm">to next turn</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-400 text-sm">Remaining</span>
                    </div>
                    <span className="text-slate-200 font-medium">{formatDuration(timeToDestination)}</span>
                  </div>

                  <button
                    onClick={onEndNavigation}
                    className="w-full py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium rounded-xl transition-colors border border-red-500/30"
                  >
                    End Navigation
                  </button>
                </div>
              )}

              {expanded && route.legs && route.legs[0]?.steps && (
                <div className="mt-4 space-y-2">
                  <h4 className="text-slate-400 text-sm font-medium mb-2">Route Steps</h4>
                  {route.legs[0].steps.map((step, index) => (
                    <div 
                      key={index}
                      className={`p-3 rounded-lg border transition-colors ${
                        index === currentStep
                          ? 'bg-teal-500/20 border-teal-500/30'
                          : 'bg-slate-800/50 border-slate-700/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === currentStep ? 'bg-teal-500 text-slate-900' : 'bg-slate-700 text-slate-400'
                        }`}>
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${index === currentStep ? 'text-teal-300' : 'text-slate-300'}`}>
                            {step.maneuver?.instruction || step.name || 'Continue'}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {formatDistance(step.distance)} · {formatDuration(step.duration)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <MapPin className="w-12 h-12 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">Search for a destination to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BottomSheetPanel;
