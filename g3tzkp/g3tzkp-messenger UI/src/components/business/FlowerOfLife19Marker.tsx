import React, { useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import { sacredGeometryService } from '../../services/SacredGeometryService';

interface FlowerOfLife19MarkerProps {
  position: [number, number];
  map: L.Map | null;
  color?: string;
  size?: number;
  pulse?: boolean;
  businessName?: string;
  onClick?: () => void;
}

export function FlowerOfLife19Marker({ 
  position, 
  map, 
  color = '#00ffff', 
  size = 100,
  pulse = true,
  businessName,
  onClick
}: FlowerOfLife19MarkerProps) {
  const markerRef = useRef<L.Marker | null>(null);
  const animationIdRef = useRef<string>(`fol19-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

  const svgContent = useMemo(() => {
    const pattern = sacredGeometryService.generateFlowerOfLife19(50, 50, 8);
    const animId = animationIdRef.current;
    
    const circleElements = pattern.circles.map((circle, index) => {
      const opacity = circle.ring === 0 ? 1 : circle.ring === 1 ? 0.9 : 0.7;
      const animDelay = (index * 0.1).toFixed(2);
      return `<circle 
        cx="${circle.x}" 
        cy="${circle.y}" 
        r="${circle.radius}" 
        fill="none" 
        stroke="${color}" 
        stroke-width="1.5"
        opacity="${opacity}"
      >
        ${pulse ? `<animate 
          attributeName="opacity" 
          values="${opacity};${opacity * 0.5};${opacity}" 
          dur="3s" 
          begin="${animDelay}s"
          repeatCount="indefinite"
        />` : ''}
      </circle>`;
    }).join('\n');

    const numOrbitingSpheres = 6;
    const orbitRadius = 42;
    const sphereRadius = 3;
    const orbitDuration = 8;
    
    const orbitingSpheres = Array.from({ length: numOrbitingSpheres }, (_, i) => {
      const startAngle = (i * 360) / numOrbitingSpheres;
      const delay = (i * orbitDuration) / numOrbitingSpheres;
      
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
          <animate
            attributeName="opacity"
            values="0.9;1;0.6;1;0.9"
            dur="${orbitDuration / 2}s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="r"
            values="${sphereRadius};${sphereRadius * 1.3};${sphereRadius}"
            dur="${orbitDuration / 4}s"
            repeatCount="indefinite"
          />
        </circle>
      `;
    }).join('\n');

    const innerOrbitingSpheres = Array.from({ length: 3 }, (_, i) => {
      const startAngle = (i * 120) + 60;
      const innerOrbitRadius = 25;
      const innerSphereRadius = 2;
      const innerDuration = 5;
      
      return `
        <circle cx="50" cy="${50 - innerOrbitRadius}" r="${innerSphereRadius}" fill="${color}" opacity="0.7">
          <animateTransform
            attributeName="transform"
            type="rotate"
            from="${startAngle} 50 50"
            to="${startAngle - 360} 50 50"
            dur="${innerDuration}s"
            repeatCount="indefinite"
          />
        </circle>
      `;
    }).join('\n');

    return `
      <svg width="${size}" height="${size}" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" style="cursor: pointer;">
        <defs>
          <filter id="glow-${animId}">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <radialGradient id="center-glow-${animId}" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color="${color}" stop-opacity="1"/>
            <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
          </radialGradient>
        </defs>
        
        <!-- Outer glow ring -->
        <circle cx="50" cy="50" r="48" fill="none" stroke="${color}" stroke-width="0.5" opacity="0.3">
          <animate attributeName="r" values="48;50;48" dur="4s" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0.3;0.5;0.3" dur="4s" repeatCount="indefinite"/>
        </circle>
        
        <!-- Main 19-circle Flower of Life pattern -->
        <g filter="url(#glow-${animId})">
          ${circleElements}
        </g>
        
        <!-- Orbiting spheres (outer ring - 6 spheres) -->
        ${orbitingSpheres}
        
        <!-- Orbiting spheres (inner ring - 3 spheres, counter-rotating) -->
        ${innerOrbitingSpheres}
        
        <!-- Center point with glow -->
        <circle cx="50" cy="50" r="4" fill="url(#center-glow-${animId})">
          <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite"/>
        </circle>
        <circle cx="50" cy="50" r="2" fill="${color}">
          <animate attributeName="opacity" values="1;0.7;1" dur="1.5s" repeatCount="indefinite"/>
        </circle>
        
        <!-- Sacred geometry verification badge -->
        <text x="50" y="97" font-size="5" fill="${color}" text-anchor="middle" font-family="monospace" opacity="0.6">19</text>
      </svg>
    `;
  }, [color, size, pulse]);

  useEffect(() => {
    if (!map) return;

    const svgIcon = L.divIcon({
      html: `<div class="flower-of-life-19-business-marker" style="filter: drop-shadow(0 0 10px ${color}40);">${svgContent}</div>`,
      className: 'flower-of-life-19-marker-container',
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2]
    });

    markerRef.current = L.marker(position, { icon: svgIcon }).addTo(map);
    
    if (businessName) {
      markerRef.current.bindTooltip(businessName, {
        permanent: false,
        direction: 'top',
        className: 'business-tooltip',
        offset: [0, -size / 2]
      });
    }

    if (onClick) {
      markerRef.current.on('click', onClick);
    }

    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
      }
    };
  }, [map, position, svgContent, size, businessName, onClick, color]);

  return null;
}

export default FlowerOfLife19Marker;
