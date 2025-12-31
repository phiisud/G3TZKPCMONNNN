import React, { useState } from 'react';
import { Train, Download, X, Navigation, Shield } from 'lucide-react';
import NavigatorMap from './NavigatorMap';
import TopLeftControlCluster from './TopLeftControlCluster';
import BottomSheetPanel from './BottomSheetPanel';
import RoutePlanner from './RoutePlanner';
import TransitPlanner from './TransitPlanner';
import OfflineMapManager from './OfflineMapManager';
import ActiveNavigation from './ActiveNavigation';
import { useNavigationStore, TransportMode } from '../../stores/useNavigationStore';
import { Coordinate, Route } from '../../types/navigation';
import { SearchResult } from '../../services/SearchService';
import navigationService from '../../services/NavigationService';
import trafficService from '../../services/TrafficService';

interface GeodesicNavigationViewProps {
  currentLocation: Coordinate | null;
  currentRoute: Route | null;
  navigationActive: boolean;
  navigationHeading: number;
  showRoutePlanner: boolean;
  showTransitPlanner: boolean;
  showOfflineManager: boolean;
  onMapClick: (coord: Coordinate) => void;
  onLocationFound: (coord: Coordinate) => void;
  onRouteCalculated: (route: Route) => void;
  onStartNavigation: () => void;
  onEndNavigation: () => void;
  onReroute: () => void;
  onToggleRoutePlanner: () => void;
  onToggleTransitPlanner: () => void;
  onToggleOfflineManager: () => void;
  onCloseRoutePlanner: () => void;
  onCloseTransitPlanner: () => void;
  onCloseOfflineManager: () => void;
}

const getRouteProfile = (mode: TransportMode): 'car' | 'foot' | 'bicycle' => {
  switch (mode) {
    case 'walk': return 'foot';
    case 'car': return 'car';
    case 'transit': return 'foot';
    default: return 'car';
  }
};

export function GeodesicNavigationView({
  currentLocation,
  currentRoute,
  navigationActive,
  navigationHeading,
  showRoutePlanner,
  showTransitPlanner,
  showOfflineManager,
  onMapClick,
  onLocationFound,
  onRouteCalculated,
  onStartNavigation,
  onEndNavigation,
  onReroute,
  onToggleRoutePlanner,
  onToggleTransitPlanner,
  onToggleOfflineManager,
  onCloseRoutePlanner,
  onCloseTransitPlanner,
  onCloseOfflineManager
}: GeodesicNavigationViewProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  
  const { 
    transportMode, 
    setTransportMode,
    setDestination,
    destinationName,
    distanceToNextStep,
    timeToDestination,
    currentStepIndex
  } = useNavigationStore();

  const handleSearchSelect = async (result: SearchResult) => {
    const destCoord: Coordinate = [result.lon, result.lat];
    setDestination(destCoord, result.name);
    setShowBottomSheet(true);
    
    if (currentLocation) {
      try {
        const profile = getRouteProfile(transportMode);
        const routes = await navigationService.calculateRoute(
          [currentLocation, destCoord],
          profile,
          {}
        );
        if (routes && routes.length > 0) {
          onRouteCalculated(routes[0]);
        }
      } catch (error) {
        console.error('[GeodesicNav] Route calculation failed:', error);
      }
    }
  };

  const handleTransportModeChange = async (mode: TransportMode) => {
    setTransportMode(mode);
    
    if (mode === 'transit') {
      onToggleTransitPlanner();
      return;
    }
    
    if (currentLocation && currentRoute) {
      const destination = currentRoute.geometry.coordinates[currentRoute.geometry.coordinates.length - 1];
      try {
        const profile = getRouteProfile(mode);
        const routes = await navigationService.calculateRoute(
          [currentLocation, destination],
          profile,
          {}
        );
        if (routes && routes.length > 0) {
          onRouteCalculated(routes[0]);
        }
      } catch (error) {
        console.error('[GeodesicNav] Mode change route failed:', error);
      }
    }
  };

  const handleMenuClick = () => {
    setShowMenu(!showMenu);
    onToggleRoutePlanner();
  };

  const handleCloseBottomSheet = () => {
    setShowBottomSheet(false);
    setDestination(null);
    onCloseRoutePlanner();
  };
  
  const handleStartNav = () => {
    setShowBottomSheet(false);
    onStartNavigation();
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
      <div className={`flex-1 relative overflow-hidden ${navigationActive ? 'z-[999]' : 'z-0'}`}>
        <NavigatorMap
          currentLocation={currentLocation || undefined}
          destination={currentRoute?.geometry.coordinates[currentRoute.geometry.coordinates.length - 1]}
          route={currentRoute || undefined}
          onMapClick={onMapClick}
          onLocationFound={onLocationFound}
          className="h-full"
          streetLevelMode={navigationActive}
          heading={navigationHeading}
          showBusinessMarkers={true}
        />
      </div>

      <TopLeftControlCluster
        isNavigating={navigationActive}
        destinationName={destinationName}
        activeTransportMode={transportMode}
        currentLocation={currentLocation ? { lat: currentLocation[1], lon: currentLocation[0] } : undefined}
        onMenuClick={handleMenuClick}
        onSearchSelect={handleSearchSelect}
        onTransportModeChange={handleTransportModeChange}
        onEndNavigation={onEndNavigation}
      />

      <div className="absolute top-20 right-5 z-[1000] flex flex-col gap-2 pointer-events-auto">
        <button
          onClick={onToggleTransitPlanner}
          className={`w-11 h-11 rounded-xl shadow-lg flex items-center justify-center hover:shadow-xl transition-all border backdrop-blur-md ${
            showTransitPlanner 
              ? 'bg-purple-600 text-white border-purple-500' 
              : 'bg-slate-900/90 text-purple-400 border-slate-400/20'
          }`}
          title="Transit Planner"
        >
          <Train size={20} />
        </button>
        <button
          onClick={onToggleOfflineManager}
          className={`w-11 h-11 rounded-xl shadow-lg flex items-center justify-center hover:shadow-xl transition-all border backdrop-blur-md ${
            showOfflineManager 
              ? 'bg-teal-600 text-white border-teal-500' 
              : 'bg-slate-900/90 text-teal-400 border-slate-400/20'
          }`}
          title="Offline Maps"
        >
          <Download size={20} />
        </button>
      </div>

      {!navigationActive && (
        <>
          {showRoutePlanner && (
            <div className="absolute bottom-24 lg:bottom-4 left-5 right-5 md:left-5 md:right-auto md:w-96 z-[1000] pointer-events-auto">
              <div className="bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-400/20 overflow-hidden">
                <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
                  <h3 className="font-semibold text-teal-400 flex items-center gap-2">
                    <Navigation size={18} className="text-teal-400" />
                    Plan Route
                  </h3>
                  <button 
                    onClick={onCloseRoutePlanner}
                    className="w-8 h-8 rounded-full hover:bg-slate-800 flex items-center justify-center text-slate-400"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="p-4">
                  <RoutePlanner 
                    onRouteCalculated={onRouteCalculated}
                    currentLocation={currentLocation || undefined}
                  />
                </div>
              </div>
            </div>
          )}

          {showTransitPlanner && (
            <div className="absolute bottom-24 lg:bottom-4 left-5 right-5 md:left-5 md:right-auto md:w-96 z-[1000] pointer-events-auto">
              <div className="bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-purple-500/30 overflow-hidden max-h-[60vh] overflow-y-auto">
                <div className="p-4 border-b border-purple-500/20 flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur-md">
                  <h3 className="font-semibold text-purple-400 flex items-center gap-2">
                    <Train size={18} className="text-purple-400" />
                    Public Transit
                  </h3>
                  <button 
                    onClick={onCloseTransitPlanner}
                    className="w-8 h-8 rounded-full hover:bg-purple-500/10 flex items-center justify-center text-purple-400"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="p-4">
                  <TransitPlanner 
                    currentLocation={currentLocation || undefined}
                    onJourneySelected={(journey) => {
                      console.log('Transit journey selected:', journey);
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {showOfflineManager && (
            <div className="absolute bottom-24 lg:bottom-4 left-5 right-5 md:left-5 md:right-auto md:w-96 z-[1000] pointer-events-auto">
              <div className="bg-slate-900/95 backdrop-blur-md rounded-2xl shadow-2xl border border-teal-500/30 overflow-hidden">
                <div className="p-4 border-b border-teal-500/20 flex items-center justify-between">
                  <h3 className="font-semibold text-teal-400 flex items-center gap-2">
                    <Download size={18} className="text-teal-400" />
                    Offline Maps
                  </h3>
                  <button 
                    onClick={onCloseOfflineManager}
                    className="w-8 h-8 rounded-full hover:bg-teal-500/10 flex items-center justify-center text-teal-400"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="p-4">
                  <OfflineMapManager />
                </div>
              </div>
            </div>
          )}

          <div className="absolute bottom-24 lg:bottom-4 right-5 z-[1000] pointer-events-auto">
            <div className="bg-slate-900/90 backdrop-blur-md rounded-lg px-3 py-2 flex items-center gap-2 border border-slate-400/20">
              <Shield size={14} className="text-teal-400" />
              <span className="text-teal-400 text-xs font-mono">PRIVATE</span>
            </div>
          </div>
        </>
      )}

      <BottomSheetPanel
        isOpen={showBottomSheet && !!currentRoute && !navigationActive}
        route={currentRoute}
        destinationName={destinationName}
        transportMode={transportMode}
        distanceToNext={distanceToNextStep}
        timeToDestination={timeToDestination}
        currentStep={currentStepIndex}
        isNavigating={navigationActive}
        onClose={handleCloseBottomSheet}
        onStartNavigation={handleStartNav}
        onEndNavigation={onEndNavigation}
      />
      
      {navigationActive && currentRoute && (
        <ActiveNavigation
          route={currentRoute}
          onReroute={onReroute}
          onEndNavigation={onEndNavigation}
          onReportHazard={(type, location) => {
            trafficService.reportHazard({
              type: type as any,
              location,
              description: `${type} reported at this location`,
              reporterId: 'local_user'
            });
          }}
        />
      )}
    </div>
  );
}

export default GeodesicNavigationView;
