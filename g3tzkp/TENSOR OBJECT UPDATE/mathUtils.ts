
/**
 * Mathematical utilities for Phi and Pi harmonic relations.
 */

export const PHI = 1.618033988749895;
export const PI = 3.141592653589793;

/**
 * Calculates the optimal raymarching step size based on the Phi-Pi relation.
 * @param n Current iteration step
 * @param s0 Base step size
 * @param r Estimated radius of the scene bounding sphere
 */
export const calculateOptimalStep = (n: number, s0: number, r: number, phi: number = PHI, pi: number = PI): number => {
  const phiGrowth = Math.pow(phi, n) * s0;
  const piRefinement = (pi * r) / (n + 1);
  return Math.min(phiGrowth, piRefinement);
};

/**
 * Normalizes a value using the golden ratio.
 */
export const phiNormalize = (val: number): number => {
  return (val * PHI) % 1.0;
};
