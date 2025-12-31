export interface GMMComponent {
  mean: [number, number, number];
  covariance: number[][];
  weight: number;
  determinant: number;
  inverse: number[][];
}

export interface GrabCutOptions {
  iterations?: number;
  gmmComponents?: number;
}

export class GrabCutProcessor {
  private static readonly GMM_COMPONENTS = 5;
  private static readonly ITERATIONS = 5;

  static process(
    imageData: ImageData,
    trimap: Uint8Array,
    options: GrabCutOptions = {}
  ): Uint8Array {
    const { iterations = this.ITERATIONS, gmmComponents = this.GMM_COMPONENTS } = options;
    const { width, height, data } = imageData;
    const mask = new Uint8Array(trimap);

    const foregroundPixels: number[] = [];
    const backgroundPixels: number[] = [];

    for (let i = 0; i < mask.length; i++) {
      if (mask[i] === 255) foregroundPixels.push(i);
      if (mask[i] === 0) backgroundPixels.push(i);
    }

    if (foregroundPixels.length === 0 || backgroundPixels.length === 0) {
      return this.processWithEdgeInit(imageData, trimap, options);
    }

    const fgGMM = this.initializeGMM(foregroundPixels, data, gmmComponents);
    const bgGMM = this.initializeGMM(backgroundPixels, data, gmmComponents);

    for (let iter = 0; iter < iterations; iter++) {
      this.estimateSegmentation(mask, data, width, fgGMM, bgGMM, trimap);
    }

    return mask;
  }

  static processWithEdgeInit(
    imageData: ImageData,
    trimap: Uint8Array,
    options: GrabCutOptions = {}
  ): Uint8Array {
    const { iterations = this.ITERATIONS, gmmComponents = this.GMM_COMPONENTS } = options;
    const { width, height, data } = imageData;
    const mask = new Uint8Array(trimap);

    const edgeBackground: number[] = [];
    const centerForeground: number[] = [];

    const marginX = Math.floor(width * 0.1);
    const marginY = Math.floor(height * 0.1);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (mask[idx] === 128) {
          if (x < marginX || x >= width - marginX || y < marginY || y >= height - marginY) {
            edgeBackground.push(idx);
          } else if (
            x > marginX * 2 &&
            x < width - marginX * 2 &&
            y > marginY * 2 &&
            y < height - marginY * 2
          ) {
            centerForeground.push(idx);
          }
        }
      }
    }

    if (edgeBackground.length === 0 || centerForeground.length === 0) {
      for (let i = 0; i < mask.length; i++) {
        if (mask[i] === 128) mask[i] = 255;
      }
      return mask;
    }

    const bgGMM = this.initializeGMM(edgeBackground, data, gmmComponents);
    const fgGMM = this.initializeGMM(centerForeground, data, gmmComponents);

    for (let iter = 0; iter < iterations; iter++) {
      this.estimateSegmentation(mask, data, width, fgGMM, bgGMM, trimap);
    }

    return mask;
  }

  private static initializeGMM(
    pixels: number[],
    imageData: Uint8ClampedArray,
    k: number
  ): GMMComponent[] {
    if (pixels.length === 0) {
      return this.createDefaultGMM(k);
    }

    const actualK = Math.min(k, pixels.length);
    const step = Math.max(1, Math.floor(pixels.length / actualK));
    
    const centroids: [number, number, number][] = [];
    for (let i = 0; i < actualK; i++) {
      const idx = pixels[Math.min(i * step, pixels.length - 1)];
      const dataIdx = idx * 4;
      centroids.push([
        imageData[dataIdx],
        imageData[dataIdx + 1],
        imageData[dataIdx + 2],
      ]);
    }

    const clusters: number[][] = Array(actualK).fill(null).map(() => []);

    for (let iter = 0; iter < 10; iter++) {
      for (let c = 0; c < actualK; c++) {
        clusters[c] = [];
      }

      for (const pixelIdx of pixels) {
        const dataIdx = pixelIdx * 4;
        const r = imageData[dataIdx];
        const g = imageData[dataIdx + 1];
        const b = imageData[dataIdx + 2];

        let minDist = Infinity;
        let bestCluster = 0;

        for (let c = 0; c < actualK; c++) {
          const [cr, cg, cb] = centroids[c];
          const dist = Math.sqrt(
            Math.pow(r - cr, 2) + Math.pow(g - cg, 2) + Math.pow(b - cb, 2)
          );

          if (dist < minDist) {
            minDist = dist;
            bestCluster = c;
          }
        }

        clusters[bestCluster].push(pixelIdx);
      }

      for (let c = 0; c < actualK; c++) {
        if (clusters[c].length > 0) {
          let sumR = 0,
            sumG = 0,
            sumB = 0;
          for (const idx of clusters[c]) {
            const dataIdx = idx * 4;
            sumR += imageData[dataIdx];
            sumG += imageData[dataIdx + 1];
            sumB += imageData[dataIdx + 2];
          }
          centroids[c] = [
            sumR / clusters[c].length,
            sumG / clusters[c].length,
            sumB / clusters[c].length,
          ];
        }
      }
    }

    const components: GMMComponent[] = [];
    for (let c = 0; c < actualK; c++) {
      if (clusters[c].length > 0) {
        const { covariance, determinant, inverse } = this.estimateCovariance(
          clusters[c],
          imageData,
          centroids[c]
        );

        components.push({
          mean: centroids[c],
          covariance,
          weight: clusters[c].length / pixels.length,
          determinant,
          inverse,
        });
      }
    }

    if (components.length === 0) {
      return this.createDefaultGMM(1);
    }

    return components;
  }

  private static estimateCovariance(
    pixelIndices: number[],
    imageData: Uint8ClampedArray,
    mean: [number, number, number]
  ): { covariance: number[][]; determinant: number; inverse: number[][] } {
    const n = pixelIndices.length;
    const cov: number[][] = [
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ];

    for (const idx of pixelIndices) {
      const dataIdx = idx * 4;
      const r = imageData[dataIdx] - mean[0];
      const g = imageData[dataIdx + 1] - mean[1];
      const b = imageData[dataIdx + 2] - mean[2];

      cov[0][0] += r * r;
      cov[0][1] += r * g;
      cov[0][2] += r * b;
      cov[1][0] += g * r;
      cov[1][1] += g * g;
      cov[1][2] += g * b;
      cov[2][0] += b * r;
      cov[2][1] += b * g;
      cov[2][2] += b * b;
    }

    const regularization = 0.01;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        cov[i][j] = cov[i][j] / n + (i === j ? regularization : 0);
      }
    }

    const determinant = this.determinant3x3(cov);
    const inverse = this.inverse3x3(cov, determinant);

    return { covariance: cov, determinant: Math.abs(determinant) + 1e-10, inverse };
  }

  private static determinant3x3(m: number[][]): number {
    return (
      m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
      m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
      m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
    );
  }

  private static inverse3x3(m: number[][], det: number): number[][] {
    const invDet = 1 / (det + 1e-10);
    return [
      [
        (m[1][1] * m[2][2] - m[1][2] * m[2][1]) * invDet,
        (m[0][2] * m[2][1] - m[0][1] * m[2][2]) * invDet,
        (m[0][1] * m[1][2] - m[0][2] * m[1][1]) * invDet,
      ],
      [
        (m[1][2] * m[2][0] - m[1][0] * m[2][2]) * invDet,
        (m[0][0] * m[2][2] - m[0][2] * m[2][0]) * invDet,
        (m[0][2] * m[1][0] - m[0][0] * m[1][2]) * invDet,
      ],
      [
        (m[1][0] * m[2][1] - m[1][1] * m[2][0]) * invDet,
        (m[0][1] * m[2][0] - m[0][0] * m[2][1]) * invDet,
        (m[0][0] * m[1][1] - m[0][1] * m[1][0]) * invDet,
      ],
    ];
  }

  private static createDefaultGMM(k: number): GMMComponent[] {
    const components: GMMComponent[] = [];
    for (let i = 0; i < k; i++) {
      components.push({
        mean: [128, 128, 128],
        covariance: [
          [100, 0, 0],
          [0, 100, 0],
          [0, 0, 100],
        ],
        weight: 1 / k,
        determinant: 1000000,
        inverse: [
          [0.01, 0, 0],
          [0, 0.01, 0],
          [0, 0, 0.01],
        ],
      });
    }
    return components;
  }

  private static calculateGMMProbability(
    pixel: [number, number, number],
    gmm: GMMComponent[]
  ): number {
    let totalProb = 0;

    for (const component of gmm) {
      const diff = [
        pixel[0] - component.mean[0],
        pixel[1] - component.mean[1],
        pixel[2] - component.mean[2],
      ];

      let mahalanobis = 0;
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          mahalanobis += diff[i] * component.inverse[i][j] * diff[j];
        }
      }

      const exponent = -0.5 * mahalanobis;
      const normalization = Math.pow(2 * Math.PI, -1.5) * Math.pow(component.determinant, -0.5);
      const prob = component.weight * normalization * Math.exp(Math.max(-500, exponent));

      totalProb += prob;
    }

    return totalProb;
  }

  private static estimateSegmentation(
    mask: Uint8Array,
    imageData: Uint8ClampedArray,
    width: number,
    fgGMM: GMMComponent[],
    bgGMM: GMMComponent[],
    originalTrimap: Uint8Array
  ): void {
    for (let i = 0; i < mask.length; i++) {
      if (originalTrimap[i] === 128) {
        const dataIdx = i * 4;
        const pixel: [number, number, number] = [
          imageData[dataIdx],
          imageData[dataIdx + 1],
          imageData[dataIdx + 2],
        ];

        const fgProb = this.calculateGMMProbability(pixel, fgGMM);
        const bgProb = this.calculateGMMProbability(pixel, bgGMM);

        mask[i] = fgProb > bgProb ? 255 : 0;
      }
    }
  }

  static createTrimapFromRect(
    width: number,
    height: number,
    rect: { x: number; y: number; width: number; height: number }
  ): Uint8Array {
    const trimap = new Uint8Array(width * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const inRect =
          x >= rect.x &&
          x < rect.x + rect.width &&
          y >= rect.y &&
          y < rect.y + rect.height;

        trimap[idx] = inRect ? 128 : 0;
      }
    }

    return trimap;
  }

  static refineMaskWithBrush(
    mask: Uint8Array,
    width: number,
    height: number,
    x: number,
    y: number,
    radius: number,
    value: number
  ): void {
    const radiusSq = radius * radius;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const px = x + dx;
        const py = y + dy;

        if (px >= 0 && px < width && py >= 0 && py < height) {
          if (dx * dx + dy * dy <= radiusSq) {
            mask[py * width + px] = value;
          }
        }
      }
    }
  }
}
