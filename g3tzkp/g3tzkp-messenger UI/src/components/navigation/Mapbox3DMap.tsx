import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Coordinate, Route } from '../../types/navigation';

interface Mapbox3DMapProps {
  currentLocation?: Coordinate;
  destination?: Coordinate;
  route?: Route;
  onMapClick?: (coord: Coordinate) => void;
  className?: string;
  heading?: number;
  pitch?: number;
}

interface MapboxConfig {
  available: boolean;
  accessToken: string;
  style: string;
}

const Mapbox3DMap: React.FC<Mapbox3DMapProps> = ({
  currentLocation,
  destination,
  route,
  onMapClick,
  className = '',
  heading = 0,
  pitch = 60
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const currentMarker = useRef<mapboxgl.Marker | null>(null);
  const destMarker = useRef<mapboxgl.Marker | null>(null);
  const [config, setConfig] = useState<MapboxConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
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

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center,
      zoom: 15,
      pitch: pitch,
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

      map.current.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });

      map.current.setFog({
        'horizon-blend': 0.15,
        'color': '#1a0a00',
        'high-color': '#ff6600',
        'space-color': '#0a0a0a',
        'star-intensity': 0.4
      });

      map.current.setPaintProperty('land', 'background-color', '#0a0a0a');
      
      try {
        map.current.setPaintProperty('water', 'fill-color', '#1a0a00');
        map.current.setPaintProperty('road-simple', 'line-color', '#ff8800');
        map.current.setPaintProperty('road-street', 'line-color', '#ff9500');
        map.current.setPaintProperty('road-primary', 'line-color', '#ffaa00');
        map.current.setPaintProperty('road-secondary-tertiary', 'line-color', '#ff8800');
        map.current.setPaintProperty('building', 'fill-color', '#1a1000');
        map.current.setPaintProperty('building', 'fill-outline-color', '#ff6600');
      } catch (e) {
        console.log('[Mapbox3D] Some layers not available for styling');
      }

      map.current.setLight({
        anchor: 'viewport',
        color: '#ff8800',
        intensity: 0.5
      });
    });

    map.current.on('click', (e) => {
      if (onMapClick) {
        onMapClick([e.lngLat.lng, e.lngLat.lat]);
      }
    });

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [config]);

  useEffect(() => {
    if (!map.current || !currentLocation) return;

    if (currentMarker.current) {
      currentMarker.current.setLngLat(currentLocation);
    } else {
      const el = document.createElement('div');
      el.className = 'current-location-3d';
      el.innerHTML = `
        <svg width="40" height="40" viewBox="0 0 100 100">
          <defs>
            <filter id="glow3d">
              <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <g filter="url(#glow3d)">
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
      map.current.flyTo({
        center: currentLocation,
        zoom: 16,
        pitch: pitch,
        bearing: heading,
        duration: 2000
      });
      initialFlyDone.current = true;
    }
  }, [currentLocation, heading, pitch]);

  useEffect(() => {
    if (!map.current || !destination) return;

    if (destMarker.current) {
      destMarker.current.setLngLat(destination);
    } else {
      const el = document.createElement('div');
      el.innerHTML = `
        <svg width="36" height="48" viewBox="0 0 36 48">
          <defs>
            <filter id="glowDest3d">
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>
          <g filter="url(#glowDest3d)">
            <path d="M18 0 C8 0 0 8 0 18 C0 28 18 48 18 48 C18 48 36 28 36 18 C36 8 28 0 18 0 Z" 
                  fill="#4caf50" stroke="#000" stroke-width="2"/>
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
            'line-width': 6,
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
  }, [route]);

  useEffect(() => {
    if (!map.current) return;
    map.current.setBearing(heading);
  }, [heading]);

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-black text-cyan-400 ${className}`} style={{ height: '100%' }}>
        <div className="text-center p-4">
          <div className="text-xl mb-2">3D Map Unavailable</div>
          <div className="text-sm text-gray-400">{error}</div>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className={`flex items-center justify-center bg-black text-cyan-400 ${className}`} style={{ height: '100%' }}>
        <div className="animate-pulse">Loading 3D Map...</div>
      </div>
    );
  }

  return (
    <div 
      ref={mapContainer} 
      className={className}
      style={{ height: '100%', width: '100%' }}
    />
  );
};

export default Mapbox3DMap;
