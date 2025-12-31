export const PHI = 1.618033988749895;
export const PI = 3.141592653589793;
export const TAU = 6.28318530718;

export const calculateOptimalStep = (
  n: number,
  s0: number,
  r: number,
  phi: number = PHI,
  pi: number = PI
): number => {
  const phiGrowth = Math.pow(phi, n) * s0;
  const piRefinement = (pi * r) / (n + 1);
  return Math.min(phiGrowth, piRefinement);
};

export const phiNormalize = (val: number): number => {
  return (val * PHI) % 1.0;
};

export const calculateRotorHarmonic = (x: number, y: number, z: number): number => {
  const dist = Math.sqrt(x * x + y * y);
  const angle = dist * PHI + z * (PI / PHI);
  const s = Math.sin(x * PHI + angle);
  const c = Math.cos(y * PHI - angle);
  return (s * c) * 0.5 + 0.5;
};

export const calculateRBBRRBRStitch = (
  r: number,
  z: number,
  rotor: number,
  substrate: number
): number => {
  const freq = (3.0 + PHI) * 2.0 * (0.9 + 0.2 * rotor);
  const sliceLayers = Math.floor(Math.abs(z) * 10.0 * PHI);
  const x = r * freq + z * PI + substrate * PHI + sliceLayers * 0.1;
  const x7 = x % 7.0;
  const idx = Math.floor(x7);
  const pattern = [1.0, 0.2, 0.2, 1.0, 1.0, 0.2, 1.0];
  return pattern[idx % 7];
};

export const calculateLumaDepth = (
  r: number,
  g: number,
  b: number,
  eigenValue: number = 2.618,
  metricExtension: number = 2.0
): number => {
  const luma = r * 0.299 + g * 0.587 + b * 0.114;
  return Math.pow(luma, eigenValue * 0.5) * metricExtension;
};

export const goldenAngle = (): number => {
  return PI * (3 - Math.sqrt(5));
};

export const fibonacciSphere = (index: number, total: number): { x: number; y: number; z: number } => {
  const y = 1 - (index / (total - 1)) * 2;
  const radius = Math.sqrt(1 - y * y);
  const theta = goldenAngle() * index;
  return {
    x: Math.cos(theta) * radius,
    y,
    z: Math.sin(theta) * radius
  };
};

export const calculateBivector = (
  r: number,
  g: number,
  b: number
): { e12: number; e13: number; e23: number; magnitude: number } => {
  return {
    e12: r * g,
    e13: r * b,
    e23: g * b,
    magnitude: Math.sqrt(r * r + g * g + b * b)
  };
};

export const calculateTrivector = (
  r: number,
  g: number,
  b: number
): { e123: number; magnitude: number } => {
  return {
    e123: r * g * b,
    magnitude: Math.abs(r * g * b)
  };
};

export const hashString = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
};

export const smin = (a: number, b: number, k: number): number => {
  const h = Math.max(0, Math.min(1, 0.5 + 0.5 * (b - a) / k));
  return b * (1 - h) + a * h - k * h * (1 - h);
};

export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

export const lerp = (a: number, b: number, t: number): number => {
  return a + (b - a) * t;
};

export const clamp = (value: number, min: number, max: number): number => {
  return Math.max(min, Math.min(max, value));
};

export const map = (
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number => {
  return outMin + (outMax - outMin) * ((value - inMin) / (inMax - inMin));
};
