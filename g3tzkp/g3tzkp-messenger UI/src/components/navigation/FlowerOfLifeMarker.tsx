import React, { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import { sacredGeometryService } from '../../services/SacredGeometryService';

interface FlowerOfLifeMarkerProps {
  position: [number, number];
  map: L.Map | null;
  color?: string;
  size?: number;
  pulse?: boolean;
}

export function FlowerOfLifeMarker({ 
  position, 
  map, 
  color = '#00ffff', 
  size = 80,
  pulse = true
}: FlowerOfLifeMarkerProps) {
  const markerRef = useRef<L.Marker | null>(null);

  const svgContent = useMemo(() => {
    const pattern = sacredGeometryService.generateFlowerOfLife19(50, 50, 8);
    
    const circleElements = pattern.circles.map((circle, index) => {
      const opacity = circle.ring === 0 ? 1 : circle.ring === 1 ? 0.9 : 0.7;
      return `<circle 
        cx="${circle.x}" 
        cy="${circle.y}" 
        r="${circle.radius}" 
        fill="none" 
        stroke="${color}" 
        stroke-width="1.5"
        opacity="${opacity}"
      />`;
    }).join('\n');

    const pulseAnimation = pulse ? `
      <animate 
        attributeName="opacity" 
        values="0.6;1;0.6" 
        dur="2s" 
        repeatCount="indefinite"
      />
    ` : '';

    return `
      <svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="glow-19">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <g filter="url(#glow-19)">
          ${pulseAnimation}
          ${circleElements}
          <circle cx="50" cy="50" r="2" fill="${color}"/>
        </g>
        <text x="50" y="98" font-size="6" fill="${color}" text-anchor="middle" opacity="0.5">19</text>
      </svg>
    `;
  }, [color, size, pulse]);

  useEffect(() => {
    if (!map) return;

    const svgIcon = L.divIcon({
      html: svgContent,
      className: 'flower-of-life-19-marker',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });

    markerRef.current = L.marker(position, { icon: svgIcon }).addTo(map);

    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
      }
    };
  }, [map, position, svgContent, size]);

  return null;
}

export default FlowerOfLifeMarker;
