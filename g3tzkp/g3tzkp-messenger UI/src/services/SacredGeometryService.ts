/**
 * G3ZKP Sacred Geometry Service
 * Provides EXACTLY 19-circle Flower of Life generation
 * Sacred geometry calculations with divine precision
 * 
 * Circle count: 1 (center) + 6 (first ring) + 12 (second ring) = 19 CIRCLES EXACTLY
 */

export interface FlowerCircle {
  x: number;
  y: number;
  radius: number;
  ring: 0 | 1 | 2;
}

export interface FlowerOfLife19Pattern {
  circles: FlowerCircle[];
  centerX: number;
  centerY: number;
  baseRadius: number;
  verified: boolean;
}

const REQUIRED_CIRCLE_COUNT = 19;
const RING_0_COUNT = 1;
const RING_1_COUNT = 6;
const RING_2_COUNT = 12;

class SacredGeometryService {
  private static instance: SacredGeometryService;

  private constructor() {}

  static getInstance(): SacredGeometryService {
    if (!SacredGeometryService.instance) {
      SacredGeometryService.instance = new SacredGeometryService();
    }
    return SacredGeometryService.instance;
  }

  generateFlowerOfLife19(
    centerX: number = 0,
    centerY: number = 0,
    baseRadius: number = 1
  ): FlowerOfLife19Pattern {
    const circles: FlowerCircle[] = [];
    
    circles.push({
      x: centerX,
      y: centerY,
      radius: baseRadius,
      ring: 0
    });

    const ring1Distance = baseRadius * 2;
    for (let i = 0; i < RING_1_COUNT; i++) {
      const angle = (i * Math.PI) / 3;
      circles.push({
        x: centerX + Math.cos(angle) * ring1Distance,
        y: centerY + Math.sin(angle) * ring1Distance,
        radius: baseRadius,
        ring: 1
      });
    }

    const ring2Positions = [
      { angle: 0, distance: baseRadius * 4 },
      { angle: Math.PI / 3, distance: baseRadius * 4 },
      { angle: (2 * Math.PI) / 3, distance: baseRadius * 4 },
      { angle: Math.PI, distance: baseRadius * 4 },
      { angle: (4 * Math.PI) / 3, distance: baseRadius * 4 },
      { angle: (5 * Math.PI) / 3, distance: baseRadius * 4 },
      { angle: Math.PI / 6, distance: baseRadius * 2 * Math.sqrt(3) },
      { angle: Math.PI / 2, distance: baseRadius * 2 * Math.sqrt(3) },
      { angle: (5 * Math.PI) / 6, distance: baseRadius * 2 * Math.sqrt(3) },
      { angle: (7 * Math.PI) / 6, distance: baseRadius * 2 * Math.sqrt(3) },
      { angle: (3 * Math.PI) / 2, distance: baseRadius * 2 * Math.sqrt(3) },
      { angle: (11 * Math.PI) / 6, distance: baseRadius * 2 * Math.sqrt(3) }
    ];

    for (const pos of ring2Positions) {
      circles.push({
        x: centerX + Math.cos(pos.angle) * pos.distance,
        y: centerY + Math.sin(pos.angle) * pos.distance,
        radius: baseRadius,
        ring: 2
      });
    }

    this.verify19Circles(circles.length);

    return {
      circles,
      centerX,
      centerY,
      baseRadius,
      verified: circles.length === REQUIRED_CIRCLE_COUNT
    };
  }

  verify19Circles(circleCount: number): void {
    if (circleCount !== REQUIRED_CIRCLE_COUNT) {
      const error = new Error(
        `GEOMETRIC SACRILEGE: Flower of Life has ${circleCount} circles. ` +
        `REQUIRED: ${REQUIRED_CIRCLE_COUNT} circles exactly. ` +
        `Breakdown: ${RING_0_COUNT} center + ${RING_1_COUNT} first ring + ${RING_2_COUNT} second ring = 19`
      );
      
      console.error('%c SACRED GEOMETRY ERROR ', 'background: red; color: white; font-size: 16px; font-weight: bold;');
      console.error(error.message);
      
      throw error;
    }
    
    console.log('%c SACRED GEOMETRY VERIFIED: 19 circles ', 'background: green; color: white; font-weight: bold;');
  }

  generateSVGPath(pattern: FlowerOfLife19Pattern): string {
    let pathData = '';
    
    for (const circle of pattern.circles) {
      pathData += `M ${circle.x - circle.radius} ${circle.y} `;
      pathData += `A ${circle.radius} ${circle.radius} 0 1 1 ${circle.x + circle.radius} ${circle.y} `;
      pathData += `A ${circle.radius} ${circle.radius} 0 1 1 ${circle.x - circle.radius} ${circle.y} `;
    }
    
    return pathData;
  }

  generateSVGCircles(
    pattern: FlowerOfLife19Pattern,
    color: string = '#00ffff',
    strokeWidth: number = 1
  ): string {
    return pattern.circles
      .map(c => `<circle cx="${c.x}" cy="${c.y}" r="${c.radius}" fill="none" stroke="${color}" stroke-width="${strokeWidth}"/>`)
      .join('\n');
  }

  toThreeJSData(pattern: FlowerOfLife19Pattern): Array<{ position: [number, number, number]; radius: number }> {
    return pattern.circles.map(c => ({
      position: [c.x, c.y, 0] as [number, number, number],
      radius: c.radius
    }));
  }
}

export const sacredGeometryService = SacredGeometryService.getInstance();
export default sacredGeometryService;
