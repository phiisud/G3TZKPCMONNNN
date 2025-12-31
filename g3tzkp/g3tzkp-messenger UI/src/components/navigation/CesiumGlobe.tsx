import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Coordinate, Route } from '../../types/navigation';
import { Loader2, Globe } from 'lucide-react';

interface CesiumGlobeProps {
  currentLocation?: Coordinate;
  destination?: Coordinate;
  route?: Route;
  onMapClick?: (coord: Coordinate) => void;
  onLocationFound?: (coord: Coordinate) => void;
  className?: string;
  privacyLevel?: 'low' | 'medium' | 'high' | 'maximum';
}

const CesiumGlobe: React.FC<CesiumGlobeProps> = ({
  currentLocation,
  destination,
  route,
  onMapClick,
  onLocationFound,
  className = '',
  privacyLevel = 'medium'
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const mountedRef = useRef(true);

  const applyPrivacyObfuscation = useCallback((coord: Coordinate): Coordinate => {
    const offsets: Record<string, number> = {
      low: 0.0001,
      medium: 0.0005,
      high: 0.001,
      maximum: 0.005
    };
    const offset = offsets[privacyLevel] || 0.0005;
    return [
      coord[0] + (Math.random() - 0.5) * offset * 2,
      coord[1] + (Math.random() - 0.5) * offset * 2
    ];
  }, [privacyLevel]);

  useEffect(() => {
    mountedRef.current = true;
    
    const initCesium = async () => {
      if (!containerRef.current || viewerRef.current) return;

      try {
        const Cesium = await import('cesium');
        await import('cesium/Build/Cesium/Widgets/widgets.css');

        if (!mountedRef.current || !containerRef.current) return;

        (Cesium.Ion as any).defaultAccessToken = undefined;

        const creditContainer = document.createElement('div');
        creditContainer.style.display = 'none';

        const viewer = new Cesium.Viewer(containerRef.current, {
          imageryProvider: new Cesium.UrlTemplateImageryProvider({
            url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
            minimumLevel: 0,
            maximumLevel: 19
          }),
          terrainProvider: new Cesium.EllipsoidTerrainProvider(),
          baseLayerPicker: false,
          animation: false,
          timeline: false,
          navigationHelpButton: false,
          homeButton: false,
          sceneModePicker: false,
          projectionPicker: false,
          fullscreenButton: false,
          vrButton: false,
          geocoder: false,
          infoBox: false,
          selectionIndicator: false,
          creditContainer: creditContainer,
          skyBox: false,
          skyAtmosphere: false,
          orderIndependentTranslucency: false,
          contextOptions: {
            webgl: {
              alpha: false,
              antialias: true,
              preserveDrawingBuffer: true,
              failIfMajorPerformanceCaveat: false
            }
          }
        });

        viewer.scene.globe.enableLighting = false;
        viewer.scene.backgroundColor = Cesium.Color.BLACK;
        viewer.scene.fog.enabled = false;

        viewer.screenSpaceEventHandler.setInputAction((movement: any) => {
          const ray = viewer.camera.getPickRay(movement.position);
          if (!ray) return;
          const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
          if (!cartesian) return;
          const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
          const lon = Cesium.Math.toDegrees(cartographic.longitude);
          const lat = Cesium.Math.toDegrees(cartographic.latitude);
          onMapClick?.([lon, lat]);
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        const initialLon = currentLocation?.[0] || 8.5417;
        const initialLat = currentLocation?.[1] || 47.3769;
        
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(initialLon, initialLat, 15000000)
        });

        viewerRef.current = viewer;

        if (mountedRef.current) {
          setIsLoading(false);
          setIsReady(true);
        }

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              if (!mountedRef.current) return;
              const coord: Coordinate = [position.coords.longitude, position.coords.latitude];
              const obfuscated = applyPrivacyObfuscation(coord);
              onLocationFound?.(obfuscated);

              viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(obfuscated[0], obfuscated[1], 500000),
                duration: 2
              });
            },
            () => {},
            { enableHighAccuracy: true, timeout: 10000 }
          );
        }

      } catch (err) {
        console.error('Cesium init error:', err);
        if (mountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    const timer = setTimeout(initCesium, 100);

    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isReady || !viewerRef.current || viewerRef.current.isDestroyed()) return;

    const updateEntities = async () => {
      const Cesium = await import('cesium');
      const viewer = viewerRef.current;

      viewer.entities.removeAll();

      if (currentLocation) {
        const obfuscated = applyPrivacyObfuscation(currentLocation);
        viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(obfuscated[0], obfuscated[1]),
          point: {
            pixelSize: 14,
            color: Cesium.Color.CYAN,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2
          },
          label: {
            text: 'You (Privacy Protected)',
            font: '12px monospace',
            fillColor: Cesium.Color.CYAN,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -20)
          }
        });
      }

      if (destination) {
        viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(destination[0], destination[1]),
          point: {
            pixelSize: 16,
            color: Cesium.Color.LIME,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2
          },
          label: {
            text: 'Destination',
            font: '12px monospace',
            fillColor: Cesium.Color.LIME,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -20)
          }
        });
      }

      if (route && route.geometry.coordinates.length > 1) {
        const positions = route.geometry.coordinates.map(coord =>
          Cesium.Cartesian3.fromDegrees(coord[0], coord[1])
        );

        viewer.entities.add({
          polyline: {
            positions,
            width: 5,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.3,
              color: Cesium.Color.CYAN
            }),
            clampToGround: true
          }
        });
      }
    };

    updateEntities();
  }, [isReady, currentLocation, destination, route, applyPrivacyObfuscation]);

  return (
    <div 
      className={`relative w-full ${className}`}
      style={{ height: '100%', minHeight: '500px', background: '#000' }}
    >
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black z-50">
          <div className="text-center">
            <Loader2 size={48} className="animate-spin text-cyan-400 mx-auto mb-4" />
            <p className="text-cyan-400 font-mono text-sm">Initializing 3D Globe...</p>
            <p className="text-gray-500 font-mono text-xs mt-2">CesiumJS + OpenStreetMap</p>
          </div>
        </div>
      )}

      <div
        ref={containerRef}
        style={{ 
          width: '100%', 
          height: '100%',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0
        }}
      />

      {isReady && (
        <div className="absolute bottom-4 left-4 z-10 bg-black/80 border border-cyan-800 rounded p-3">
          <div className="flex items-center gap-2 text-cyan-400 font-mono text-xs">
            <Globe size={14} />
            <span>CesiumJS 3D Globe</span>
          </div>
          <div className="text-gray-500 font-mono text-[10px] mt-2">
            Privacy: {privacyLevel.toUpperCase()} | OpenStreetMap | No tracking
          </div>
        </div>
      )}
    </div>
  );
};

export default CesiumGlobe;
