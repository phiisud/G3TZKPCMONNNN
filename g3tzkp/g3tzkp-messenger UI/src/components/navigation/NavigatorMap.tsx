import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Coordinate, Route } from '../../types/navigation';

interface NavigatorMapProps {
  currentLocation?: Coordinate;
  destination?: Coordinate;
  route?: Route;
  onMapClick?: (coord: Coordinate) => void;
  onLocationFound?: (coord: Coordinate) => void;
  onRefreshLocation?: () => void;
  showTraffic?: boolean;
  className?: string;
  streetLevelMode?: boolean;
  heading?: number;
  showBusinessMarkers?: boolean;
}

interface MapboxConfig {
  available: boolean;
  accessToken: string;
}

const NavigatorMap: React.FC<NavigatorMapProps> = ({
  currentLocation,
  destination,
  route,
  onMapClick,
  onLocationFound,
  onRefreshLocation,
  className = '',
  streetLevelMode = false,
  heading = 0,
  showBusinessMarkers = true
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const currentMarker = useRef<mapboxgl.Marker | null>(null);
  const destMarker = useRef<mapboxgl.Marker | null>(null);
  const [config, setConfig] = useState<MapboxConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const initialFlyDone = useRef(false);

  useEffect(() => {
    fetch('/api/mapbox/config')
      .then(res => res.json())
      .then(data => {
        if (data.available && data.accessToken) {
          setConfig(data);
        } else {
          setError('Mapbox not configured');
        }
      })
      .catch(() => setError('Failed to load Mapbox config'));
  }, []);

  useEffect(() => {
    if (!config || !mapContainer.current || map.current) return;

    mapboxgl.accessToken = config.accessToken;

    const center: [number, number] = currentLocation 
      ? [currentLocation[0], currentLocation[1]]
      : [8.5417, 47.3769];

    const pitch = streetLevelMode ? 60 : 0;
    const zoom = streetLevelMode ? 17 : 13;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center,
      zoom,
      pitch,
      bearing: heading,
      antialias: true
    });

    map.current.on('load', () => {
      if (!map.current) return;

      map.current.addSource('mapbox-dem', {
        type: 'raster-dem',
        url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
        tileSize: 512,
        maxzoom: 14
      });

      if (streetLevelMode) {
        map.current.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
      }

      map.current.setFog({
        'horizon-blend': 0.1,
        'color': '#1a0800',
        'high-color': '#ff6600',
        'space-color': '#0a0a0a',
        'star-intensity': 0.3
      });

      try {
        map.current.setPaintProperty('water', 'fill-color', '#0a0500');
        map.current.setPaintProperty('land', 'background-color', '#0a0a0a');
        
        const roadLayers = ['road-simple', 'road-street', 'road-primary', 'road-secondary-tertiary', 'road-motorway-trunk'];
        roadLayers.forEach(layer => {
          try {
            map.current!.setPaintProperty(layer, 'line-color', '#ff8800');
          } catch {}
        });

        try {
          map.current.setPaintProperty('building', 'fill-color', '#1a0800');
          map.current.setPaintProperty('building', 'fill-outline-color', '#ff6600');
        } catch {}
      } catch (e) {
        console.log('[NavigatorMap] Layer styling fallback');
      }

      map.current.setLight({
        anchor: 'viewport',
        color: '#ff8800',
        intensity: 0.4
      });
    });

    map.current.on('click', (e) => {
      if (onMapClick) {
        onMapClick([e.lngLat.lng, e.lngLat.lat]);
      }
    });

    if (!streetLevelMode) {
      map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
    }

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [config, streetLevelMode]);

  useEffect(() => {
    if (!map.current || !currentLocation) return;

    if (currentMarker.current) {
      currentMarker.current.setLngLat(currentLocation);
    } else {
      const el = document.createElement('div');
      el.className = 'holographic-location-marker';
      el.innerHTML = `
        <svg width="40" height="40" viewBox="0 0 100 100">
          <defs>
            <filter id="glow-holo">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <g filter="url(#glow-holo)">
            <circle cx="50" cy="50" r="15" fill="none" stroke="#ff9500" stroke-width="2"/>
            <circle cx="50" cy="35" r="15" fill="none" stroke="#ff9500" stroke-width="2"/>
            <circle cx="50" cy="65" r="15" fill="none" stroke="#ff9500" stroke-width="2"/>
            <circle cx="63" cy="42.5" r="15" fill="none" stroke="#ff9500" stroke-width="2"/>
            <circle cx="37" cy="42.5" r="15" fill="none" stroke="#ff9500" stroke-width="2"/>
            <circle cx="63" cy="57.5" r="15" fill="none" stroke="#ff9500" stroke-width="2"/>
            <circle cx="37" cy="57.5" r="15" fill="none" stroke="#ff9500" stroke-width="2"/>
            <circle cx="50" cy="50" r="4" fill="#ff9500"/>
          </g>
        </svg>
      `;

      currentMarker.current = new mapboxgl.Marker({ element: el })
        .setLngLat(currentLocation)
        .addTo(map.current);
    }

    if (!initialFlyDone.current) {
      const targetZoom = streetLevelMode ? 17 : 14;
      map.current.flyTo({
        center: currentLocation,
        zoom: targetZoom,
        pitch: streetLevelMode ? 60 : 0,
        bearing: heading,
        duration: 2000
      });
      initialFlyDone.current = true;
    }
  }, [currentLocation, streetLevelMode, heading]);

  useEffect(() => {
    if (!map.current || !destination) return;

    if (destMarker.current) {
      destMarker.current.setLngLat(destination);
    } else {
      const el = document.createElement('div');
      el.innerHTML = `
        <svg width="36" height="48" viewBox="0 0 36 48">
          <defs>
            <filter id="glowDest">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <g filter="url(#glowDest)">
            <path d="M18 0 C8 0 0 8 0 18 C0 28 18 48 18 48 C18 48 36 28 36 18 C36 8 28 0 18 0 Z" 
                  fill="#ff6600" stroke="#000" stroke-width="2"/>
            <text x="18" y="24" font-family="serif" font-size="20" font-style="italic" 
                  fill="#000" text-anchor="middle" dominant-baseline="middle" font-weight="bold">φ</text>
          </g>
        </svg>
      `;

      destMarker.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat(destination)
        .addTo(map.current);
    }
  }, [destination]);

  useEffect(() => {
    if (!map.current || !route) return;

    const sourceId = 'route-line';
    const layerId = 'route-layer';

    const addRouteLayer = () => {
      if (!map.current) return;
      
      if (map.current.getSource(sourceId)) {
        (map.current.getSource(sourceId) as mapboxgl.GeoJSONSource).setData({
          type: 'Feature',
          properties: {},
          geometry: route.geometry
        });
      } else {
        map.current.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: route.geometry
          }
        });

        map.current.addLayer({
          id: layerId,
          type: 'line',
          source: sourceId,
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          paint: {
            'line-color': '#ff9500',
            'line-width': streetLevelMode ? 8 : 5,
            'line-opacity': 0.9
          }
        });
      }
    };

    if (map.current.isStyleLoaded()) {
      addRouteLayer();
    } else {
      map.current.once('load', addRouteLayer);
    }
  }, [route, streetLevelMode]);

  useEffect(() => {
    if (!map.current) return;
    map.current.setBearing(heading);
  }, [heading]);

  const handleRefreshLocation = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    initialFlyDone.current = false;
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coord: Coordinate = [position.coords.longitude, position.coords.latitude];
          console.log('[NavigatorMap] Refreshed location:', coord);
          if (onLocationFound) {
            onLocationFound(coord);
          }
          if (onRefreshLocation) {
            onRefreshLocation();
          }
          if (map.current) {
            map.current.flyTo({
              center: coord,
              zoom: 15,
              duration: 1500
            });
          }
          setIsRefreshing(false);
        },
        (err) => {
          console.error('[NavigatorMap] Refresh location error:', err.message);
          setIsRefreshing(false);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0
        }
      );
    } else {
      setIsRefreshing(false);
    }
  };

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-black text-orange-400 ${className}`} style={{ height: '100%' }}>
        <div className="text-center p-4">
          <div className="text-xl mb-2">Map Unavailable</div>
          <div className="text-sm text-gray-400">{error}</div>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className={`flex items-center justify-center bg-black text-orange-400 ${className}`} style={{ height: '100%' }}>
        <div className="animate-pulse">Loading Holographic Map...</div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ height: '100%', width: '100%' }}>
      <div 
        ref={mapContainer} 
        style={{ height: '100%', width: '100%' }}
      />
      
      <div className="absolute bottom-4 left-4 bg-black/80 border border-orange-600 rounded px-3 py-2 z-[1000]">
        <div className="text-orange-400 text-xs font-mono">
          {streetLevelMode ? '3D_TERRAIN_MODE' : 'GEODESIC_NAVIGATOR_v2.0'}
        </div>
        <div className="text-orange-300 text-xs font-mono mt-1">
          Mapbox GL | Holographic Theme
        </div>
      </div>
    </div>
  );
};

export default NavigatorMap;
