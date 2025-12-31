import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';
import { useBusinessStore } from '../../stores/businessStore';
import { G3TZKPBusinessProfile } from '../../types/business';
import { sacredGeometryService } from '../../services/SacredGeometryService';
import { BusinessStorefrontDisplay } from './BusinessStorefrontDisplay';
import { businessCallingService } from '../../services/BusinessCallingService';

interface BusinessLeafletLayerProps {
  onBusinessSelect?: (business: G3TZKPBusinessProfile) => void;
}

const iconCache = new Map<string, L.DivIcon>();

const createFlowerOfLife19Icon = (color: string = '#4caf50', size: number = 60, isSelected: boolean = false): L.DivIcon => {
  const cacheKey = `${color}-${size}-${isSelected}`;
  if (iconCache.has(cacheKey)) {
    return iconCache.get(cacheKey)!;
  }

  const pattern = sacredGeometryService.generateFlowerOfLife19(50, 50, 8);
  
  const circleElements = pattern.circles.map((circle, index) => {
    const opacity = circle.ring === 0 ? 1 : circle.ring === 1 ? 0.9 : 0.7;
    const animDelay = (index * 0.08).toFixed(2);
    return `<circle 
      cx="${circle.x}" 
      cy="${circle.y}" 
      r="${circle.radius}" 
      fill="none" 
      stroke="${color}" 
      stroke-width="1.2"
      opacity="${opacity}"
    >
      <animate 
        attributeName="opacity" 
        values="${opacity};${opacity * 0.4};${opacity}" 
        dur="3s" 
        begin="${animDelay}s"
        repeatCount="indefinite"
      />
    </circle>`;
  }).join('');

  const numOrbitingSpheres = 6;
  const orbitRadius = 42;
  const sphereRadius = 2.5;
  const orbitDuration = 8;
  
  const orbitingSpheres = Array.from({ length: numOrbitingSpheres }, (_, i) => {
    const startAngle = (i * 360) / numOrbitingSpheres;
    return `
      <circle cx="50" cy="${50 - orbitRadius}" r="${sphereRadius}" fill="${color}" opacity="0.9">
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="${startAngle} 50 50"
          to="${startAngle + 360} 50 50"
          dur="${orbitDuration}s"
          repeatCount="indefinite"
        />
      </circle>
    `;
  }).join('');

  const innerSpheres = Array.from({ length: 3 }, (_, i) => {
    const startAngle = (i * 120) + 60;
    return `
      <circle cx="50" cy="${50 - 25}" r="2" fill="${color}" opacity="0.7">
        <animateTransform
          attributeName="transform"
          type="rotate"
          from="${startAngle} 50 50"
          to="${startAngle - 360} 50 50"
          dur="5s"
          repeatCount="indefinite"
        />
      </circle>
    `;
  }).join('');

  const filterId = `glow-biz-${cacheKey.replace(/[^a-zA-Z0-9]/g, '')}`;
  const svgContent = `
    <svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="cursor: pointer;">
      <defs>
        <filter id="${filterId}">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      
      <circle cx="50" cy="50" r="48" fill="none" stroke="${color}" stroke-width="0.5" opacity="0.3">
        <animate attributeName="r" values="46;50;46" dur="4s" repeatCount="indefinite"/>
      </circle>
      
      <g filter="url(#${filterId})">
        ${circleElements}
      </g>
      
      ${orbitingSpheres}
      ${innerSpheres}
      
      <circle cx="50" cy="50" r="3" fill="${color}">
        <animate attributeName="opacity" values="1;0.6;1" dur="1.5s" repeatCount="indefinite"/>
      </circle>
      
      <text x="50" y="97" font-size="5" fill="${color}" text-anchor="middle" font-family="monospace" opacity="0.5">19</text>
    </svg>
  `;

  const icon = L.divIcon({
    html: `<div class="flower-of-life-business-marker" style="filter: drop-shadow(0 0 8px ${color}40);">${svgContent}</div>`,
    className: 'flower-of-life-19-marker',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2]
  });

  iconCache.set(cacheKey, icon);
  return icon;
};

export function BusinessLeafletLayer({ onBusinessSelect }: BusinessLeafletLayerProps) {
  const map = useMap();
  const { businesses, loadBusinesses, selectedBusiness, setSelectedBusiness } = useBusinessStore();
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const [isStorefrontOpen, setIsStorefrontOpen] = useState(false);
  const [storefrontBusiness, setStorefrontBusiness] = useState<G3TZKPBusinessProfile | null>(null);
  const [callingServiceReady, setCallingServiceReady] = useState(false);

  useEffect(() => {
    businessCallingService.initialize().then(() => {
      setCallingServiceReady(true);
      console.log('[BusinessLeafletLayer] BusinessCallingService ready');
    }).catch((err) => {
      console.error('[BusinessLeafletLayer] Failed to initialize BusinessCallingService:', err);
    });
  }, []);

  const handleBusinessClick = useCallback((business: G3TZKPBusinessProfile) => {
    setSelectedBusiness(business);
    setStorefrontBusiness(business);
    setIsStorefrontOpen(true);
    if (onBusinessSelect) {
      onBusinessSelect(business);
    }
  }, [setSelectedBusiness, onBusinessSelect]);

  const handleCallBusiness = useCallback(async (business: G3TZKPBusinessProfile) => {
    if (!callingServiceReady) {
      console.warn('[BusinessLeafletLayer] Calling service not ready yet');
      return;
    }
    
    try {
      const availability = await businessCallingService.checkBusinessAvailability(business);
      if (availability.isOpen) {
        const session = await businessCallingService.initiateCallToBusiness(
          business.id,
          'local_caller',
          'Local User'
        );
        console.log('[BusinessLeafletLayer] Call initiated:', session);
      } else {
        console.log('[BusinessLeafletLayer] Business is closed. Next open:', availability.nextOpenTime);
      }
    } catch (error) {
      console.error('[BusinessLeafletLayer] Failed to call business:', error);
    }
  }, [callingServiceReady]);

  useEffect(() => {
    console.log('[BusinessLeafletLayer] Component mounted, loading businesses...');
    loadBusinesses();
  }, [loadBusinesses]);

  useEffect(() => {
    console.log('[BusinessLeafletLayer] Businesses updated:', businesses.length);
  }, [businesses]);

  useEffect(() => {
    if (!map) return;

    if (!layerGroupRef.current) {
      layerGroupRef.current = L.layerGroup().addTo(map);
    }

    return () => {
      if (layerGroupRef.current) {
        layerGroupRef.current.clearLayers();
        layerGroupRef.current.remove();
        layerGroupRef.current = null;
      }
      markersRef.current.clear();
    };
  }, [map]);

  useEffect(() => {
    if (!map || !layerGroupRef.current) return;

    const currentBusinessIds = new Set(businesses.map(b => b.id));
    markersRef.current.forEach((marker, id) => {
      if (!currentBusinessIds.has(id)) {
        layerGroupRef.current?.removeLayer(marker);
        markersRef.current.delete(id);
      }
    });

    businesses.forEach((business) => {
      const existingMarker = markersRef.current.get(business.id);
      
      if (existingMarker) {
        return;
      }

      const isSelected = selectedBusiness?.id === business.id;
      const color = isSelected ? '#00f3ff' : '#4caf50';
      const icon = createFlowerOfLife19Icon(color, isSelected ? 80 : 60, isSelected);

      const marker = L.marker(
        [business.location.latitude, business.location.longitude],
        { icon }
      );

      marker.bindTooltip(
        `<div class="bg-black/90 px-2 py-1 border border-[#4caf50]/50 rounded">
          <div class="text-[#00f3ff] font-bold text-xs">${business.name}</div>
          <div class="text-[#4caf50] text-[10px]">${business.category}</div>
        </div>`,
        {
          permanent: false,
          direction: 'top',
          className: 'business-leaflet-tooltip',
          offset: [0, -30]
        }
      );

      marker.on('click', () => {
        handleBusinessClick(business);
      });

      layerGroupRef.current?.addLayer(marker);
      markersRef.current.set(business.id, marker);
    });
  }, [businesses, setSelectedBusiness, onBusinessSelect, map]);

  useEffect(() => {
    businesses.forEach((business) => {
      const marker = markersRef.current.get(business.id);
      if (marker) {
        const isSelected = selectedBusiness?.id === business.id;
        const color = isSelected ? '#00f3ff' : '#4caf50';
        const icon = createFlowerOfLife19Icon(color, isSelected ? 80 : 60);
        marker.setIcon(icon);
      }
    });
  }, [selectedBusiness, businesses]);

  return (
    <>
      {storefrontBusiness && (
        <BusinessStorefrontDisplay
          business={storefrontBusiness}
          isOpen={isStorefrontOpen}
          onClose={() => {
            setIsStorefrontOpen(false);
            setStorefrontBusiness(null);
          }}
          onCallBusiness={handleCallBusiness}
        />
      )}
    </>
  );
}

export default BusinessLeafletLayer;
