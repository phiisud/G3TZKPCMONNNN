import React, { useEffect, useState } from 'react';
import { useThemeStore } from '../stores/themeStore';
import { useBusinessStore } from '../stores/businessStore';
import { G3TZKPBusinessProfile } from '../types/business';
import { MapPin, Store, Award, TrendingUp } from 'lucide-react';

interface MapMarker {
  id: string;
  business: G3TZKPBusinessProfile;
  element?: HTMLDivElement;
}

const FlowerOfLifeEmblem: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    xmlns="http://www.w3.org/2000/svg"
    style={{ filter: `drop-shadow(0 0 8px ${color})` }}
  >
    <defs>
      <filter id="glow">
        <feGaussianBlur stdDeviation="2" result="coloredBlur" />
        <feMerge>
          <feMergeNode in="coloredBlur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    <circle cx="50" cy="50" r="45" fill="none" stroke={color} strokeWidth="1" opacity="0.5" />

    {[0, 60, 120, 180, 240, 300].map((angle) => {
      const rad = (angle * Math.PI) / 180;
      const x = 50 + 25 * Math.cos(rad);
      const y = 50 + 25 * Math.sin(rad);
      return <circle key={angle} cx={x} cy={y} r="8" fill="none" stroke={color} strokeWidth="1.5" />;
    })}

    {[0, 60, 120, 180, 240, 300].map((angle) => {
      const rad = (angle * Math.PI) / 180;
      const x1 = 50;
      const y1 = 50;
      const x2 = 50 + 30 * Math.cos(rad);
      const y2 = 50 + 30 * Math.sin(rad);
      return (
        <line key={`line-${angle}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="0.5" opacity="0.4" />
      );
    })}

    <circle cx="50" cy="50" r="5" fill={color} filter="url(#glow)" />
  </svg>
);

interface BusinessMarkerPopupProps {
  business: G3TZKPBusinessProfile;
  onClose: () => void;
  theme: any;
}

const BusinessMarkerPopup: React.FC<BusinessMarkerPopupProps> = ({ business, onClose, theme }) => (
  <div
    className="absolute bg-black rounded-lg p-4 z-50 shadow-2xl border-2 max-w-sm"
    style={{
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.surface,
      minWidth: '280px'
    }}
  >
    <button
      onClick={onClose}
      className="absolute top-2 right-2 text-gray-400 hover:text-white"
    >
      ✕
    </button>

    <div className="pr-6">
      <h3 className="text-lg font-bold mb-2" style={{ color: theme.colors.primary }}>
        <Store className="inline mr-2" size={18} />
        {business.name}
      </h3>

      <p className="text-sm mb-3" style={{ color: theme.colors.textSecondary }}>
        {business.description}
      </p>

      {business.bio && (
        <div className="mb-3 p-2 rounded" style={{ backgroundColor: `${theme.colors.primary}10` }}>
          <p className="text-xs" style={{ color: theme.colors.textSecondary }}>
            {business.bio.substring(0, 100)}...
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
        <div>
          <span style={{ color: theme.colors.textSecondary }}>📍 {business.location.address.city}</span>
        </div>
        <div>
          <span style={{ color: theme.colors.textSecondary }}>📦 {business.products?.length || 0} Products</span>
        </div>
      </div>

      {business.photos && business.photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          {business.photos.slice(0, 3).map((photo) => (
            <img
              key={photo.id}
              src={photo.url}
              alt={`${business.name} photo`}
              className="w-full h-20 object-cover rounded"
            />
          ))}
        </div>
      )}

      {business.featuredProductIds && business.featuredProductIds.length > 0 && (
        <div className="border-t" style={{ borderColor: theme.colors.border }}>
          <p className="text-xs font-semibold mt-2 mb-2" style={{ color: theme.colors.primary }}>
            Featured Products:
          </p>
          {business.products
            ?.filter((p) => business.featuredProductIds?.includes(p.id))
            .slice(0, 3)
            .map((product) => (
              <div key={product.id} className="text-xs mb-1">
                <span style={{ color: theme.colors.textSecondary }}>{product.name}</span>
                <span style={{ color: theme.colors.primary }} className="ml-2">
                  £{product.price.toFixed(2)}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  </div>
);

interface G3ZKPBusinessMapComponentProps {
  center?: { lat: number; lng: number };
  zoom?: number;
  maxHeight?: string;
  onBusinessSelected?: (business: G3TZKPBusinessProfile) => void;
}

const G3ZKPBusinessMapComponent: React.FC<G3ZKPBusinessMapComponentProps> = ({
  center = { lat: 51.5074, lng: -0.1278 },
  zoom = 10,
  maxHeight = '600px',
  onBusinessSelected
}) => {
  const theme = useThemeStore((state) => state.getCurrentTheme());
  const { businesses } = useBusinessStore();
  const mapRef = React.useRef<HTMLDivElement>(null);
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [displayedBusinesses, setDisplayedBusinesses] = useState<G3TZKPBusinessProfile[]>([]);

  useEffect(() => {
    const publishedBusinesses = businesses.filter((b) => b.isPublished);
    setDisplayedBusinesses(publishedBusinesses);
  }, [businesses]);

  useEffect(() => {
    if (!mapRef.current) return;

    const container = mapRef.current;
    container.innerHTML = '';

    const canvas = document.createElement('canvas');
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    ctx.fillStyle = theme.colors.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = `${theme.colors.primary}30`;
    ctx.lineWidth = 1;
    const gridSize = 50;
    for (let i = 0; i < canvas.width; i += gridSize) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }

    ctx.strokeStyle = theme.colors.primary;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const centerX = (canvas.width / 2) * 0.5;
    const centerY = (canvas.height / 2) * 0.5;
    const crossSize = 20;
    ctx.moveTo(centerX - crossSize, centerY);
    ctx.lineTo(centerX + crossSize, centerY);
    ctx.moveTo(centerX, centerY - crossSize);
    ctx.lineTo(centerX, centerY + crossSize);
    ctx.stroke();

    container.appendChild(canvas);

    const newMarkers: MapMarker[] = displayedBusinesses.map((business) => {
      const markerElement = document.createElement('div');
      markerElement.className = 'business-map-marker';
      markerElement.style.position = 'absolute';

      const normalizedLat = (business.location.latitude + 90) / 180;
      const normalizedLng = (business.location.longitude + 180) / 360;

      const x = normalizedLng * canvas.width - 20;
      const y = normalizedLat * canvas.height - 20;

      markerElement.style.left = `${x}px`;
      markerElement.style.top = `${y}px`;
      markerElement.style.zIndex = selectedMarker === business.id ? '40' : '10';
      markerElement.style.cursor = 'pointer';

      const isSelected = selectedMarker === business.id;
      const size = isSelected ? 50 : 40;

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', String(size));
      svg.setAttribute('height', String(size));
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.style.filter = isSelected ? `drop-shadow(0 0 20px ${theme.colors.primary})` : 'none';

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', '50');
      circle.setAttribute('cy', '50');
      circle.setAttribute('r', '45');
      circle.setAttribute('fill', `${theme.colors.primary}20`);
      circle.setAttribute('stroke', theme.colors.primary);
      circle.setAttribute('stroke-width', isSelected ? '3' : '2');

      svg.appendChild(circle);

      const innerCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      innerCircle.setAttribute('cx', '50');
      innerCircle.setAttribute('cy', '50');
      innerCircle.setAttribute('r', '30');
      innerCircle.setAttribute('fill', 'none');
      innerCircle.setAttribute('stroke', theme.colors.secondary);
      innerCircle.setAttribute('stroke-width', '1');

      svg.appendChild(innerCircle);

      const centerDot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      centerDot.setAttribute('cx', '50');
      centerDot.setAttribute('cy', '50');
      centerDot.setAttribute('r', '6');
      centerDot.setAttribute('fill', theme.colors.primary);

      svg.appendChild(centerDot);

      markerElement.appendChild(svg);

      markerElement.addEventListener('click', () => {
        setSelectedMarker(business.id);
        onBusinessSelected?.(business);
      });

      container.appendChild(markerElement);

      return {
        id: business.id,
        business,
        element: markerElement
      };
    });

    setMarkers(newMarkers);
  }, [displayedBusinesses, selectedMarker, theme]);

  return (
    <div
      ref={mapRef}
      className="relative w-full rounded-lg border-2 bg-black overflow-hidden"
      style={{
        height: maxHeight,
        borderColor: theme.colors.primary
      }}
    >
      {selectedMarker && (
        <div className="absolute top-4 left-4 z-50">
          <BusinessMarkerPopup
            business={displayedBusinesses.find((b) => b.id === selectedMarker)!}
            onClose={() => setSelectedMarker(null)}
            theme={theme}
          />
        </div>
      )}

      <div className="absolute bottom-4 right-4 z-20 text-xs" style={{ color: theme.colors.textSecondary }}>
        <div className="text-center">
          <p>{displayedBusinesses.length} businesses</p>
          <p style={{ color: theme.colors.primary }}>📍 Exact Location</p>
        </div>
      </div>

      <div
        className="absolute top-4 right-4 z-20 flex flex-col gap-2"
        style={{ color: theme.colors.textSecondary }}
      >
        <div className="text-xs text-center">
          <Store size={16} className="inline mr-1" />
          G3ZKP Business Map
        </div>
      </div>
    </div>
  );
};

export default G3ZKPBusinessMapComponent;
