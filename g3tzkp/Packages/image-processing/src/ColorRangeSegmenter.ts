export interface YCbCrColor {
  y: number;
  cb: number;
  cr: number;
}

export interface ColorRemovalOptions {
  tolerance?: number;
  softness?: number;
  enableSpillSuppression?: boolean;
}

export class ColorRangeSegmenter {
  static removeByColor(
    imageData: ImageData,
    targetColor: [number, number, number],
    tolerance: number = 0.3,
    softness: number = 0.1
  ): Uint8ClampedArray {
    const { width, height, data } = imageData;
    const alpha = new Uint8ClampedArray(width * height);
    const [tr, tg, tb] = targetColor;

    const targetYCbCr = this.rgbToYCbCr(tr, tg, tb);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const ycbcr = this.rgbToYCbCr(r, g, b);

      const yDiff = Math.abs(ycbcr.y - targetYCbCr.y) / 255;
      const cbDiff = Math.abs(ycbcr.cb - targetYCbCr.cb) / 255;
      const crDiff = Math.abs(ycbcr.cr - targetYCbCr.cr) / 255;

      const colorDistance = Math.sqrt(
        Math.pow(yDiff * 0.3, 2) +
          Math.pow(cbDiff * 1.0, 2) +
          Math.pow(crDiff * 1.0, 2)
      );

      let alphaValue = 255;

      if (colorDistance < tolerance) {
        alphaValue = 0;
      } else if (colorDistance < tolerance + softness) {
        const t = (colorDistance - tolerance) / softness;
        alphaValue = Math.floor(255 * t);
      }

      if (alphaValue < 255) {
        const spillAmount = this.calculateColorSpill(r, g, b, targetColor);
        alphaValue = Math.min(Math.floor(alphaValue + spillAmount * 50), 255);
      }

      alpha[i / 4] = alphaValue;
    }

    return alpha;
  }

  static removeByColorAdvanced(
    imageData: ImageData,
    targetColor: [number, number, number],
    options: ColorRemovalOptions = {}
  ): Uint8ClampedArray {
    const {
      tolerance = 0.3,
      softness = 0.1,
      enableSpillSuppression = true,
    } = options;

    const { width, height, data } = imageData;
    const alpha = new Uint8ClampedArray(width * height);
    const [tr, tg, tb] = targetColor;

    const targetHSV = this.rgbToHSV(tr, tg, tb);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const pixelHSV = this.rgbToHSV(r, g, b);

      let hueDiff = Math.abs(pixelHSV.h - targetHSV.h);
      if (hueDiff > 180) hueDiff = 360 - hueDiff;
      hueDiff /= 180;

      const satDiff = Math.abs(pixelHSV.s - targetHSV.s);
      const valDiff = Math.abs(pixelHSV.v - targetHSV.v);

      const colorDistance = Math.sqrt(
        Math.pow(hueDiff * 2, 2) +
          Math.pow(satDiff * 0.5, 2) +
          Math.pow(valDiff * 0.3, 2)
      );

      let alphaValue = 255;

      if (colorDistance < tolerance) {
        alphaValue = 0;
      } else if (colorDistance < tolerance + softness) {
        const t = (colorDistance - tolerance) / softness;
        alphaValue = Math.floor(255 * this.smoothstep(0, 1, t));
      }

      if (enableSpillSuppression && alphaValue > 0 && alphaValue < 255) {
        const spillAmount = this.calculateColorSpill(r, g, b, targetColor);
        alphaValue = Math.min(
          255,
          Math.floor(alphaValue * (1 + spillAmount * 0.3))
        );
      }

      alpha[i / 4] = alphaValue;
    }

    return alpha;
  }

  static detectBackgroundColor(
    imageData: ImageData
  ): [number, number, number] {
    const { width, height, data } = imageData;

    const edgeSamples: [number, number, number][] = [];
    const sampleStep = Math.max(1, Math.floor(width / 50));

    for (let x = 0; x < width; x += sampleStep) {
      const idx = x * 4;
      edgeSamples.push([data[idx], data[idx + 1], data[idx + 2]]);
    }

    for (let x = 0; x < width; x += sampleStep) {
      const idx = ((height - 1) * width + x) * 4;
      edgeSamples.push([data[idx], data[idx + 1], data[idx + 2]]);
    }

    for (let y = 0; y < height; y += sampleStep) {
      const idx = y * width * 4;
      edgeSamples.push([data[idx], data[idx + 1], data[idx + 2]]);
    }

    for (let y = 0; y < height; y += sampleStep) {
      const idx = (y * width + width - 1) * 4;
      edgeSamples.push([data[idx], data[idx + 1], data[idx + 2]]);
    }

    return this.findDominantColor(edgeSamples);
  }

  static detectGreenScreen(imageData: ImageData): boolean {
    const bgColor = this.detectBackgroundColor(imageData);
    const [r, g, b] = bgColor;

    return g > r * 1.3 && g > b * 1.3 && g > 100;
  }

  static detectBlueScreen(imageData: ImageData): boolean {
    const bgColor = this.detectBackgroundColor(imageData);
    const [r, g, b] = bgColor;

    return b > r * 1.3 && b > g * 1.3 && b > 100;
  }

  static rgbToYCbCr(r: number, g: number, b: number): YCbCrColor {
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;

    return { y, cb, cr };
  }

  private static rgbToHSV(
    r: number,
    g: number,
    b: number
  ): { h: number; s: number; v: number } {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;

    let h = 0;
    const s = max === 0 ? 0 : d / max;
    const v = max;

    if (max !== min) {
      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
          break;
        case g:
          h = ((b - r) / d + 2) * 60;
          break;
        case b:
          h = ((r - g) / d + 4) * 60;
          break;
      }
    }

    return { h, s, v };
  }

  private static smoothstep(edge0: number, edge1: number, x: number): number {
    const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
    return t * t * (3 - 2 * t);
  }

  private static calculateColorSpill(
    r: number,
    g: number,
    b: number,
    targetColor: [number, number, number]
  ): number {
    const [tr, tg, tb] = targetColor;

    const isGreenScreen = tg > tr && tg > tb;
    const isBlueScreen = tb > tr && tb > tg;

    if (isGreenScreen) {
      const warmColor = r > b;
      if (warmColor && g > r * 0.7) {
        return Math.min(1, (g - r * 0.7) / 100);
      }
    }

    if (isBlueScreen) {
      const warmColor = r > g;
      if (warmColor && b > r * 0.7) {
        return Math.min(1, (b - r * 0.7) / 100);
      }
    }

    return 0;
  }

  private static findDominantColor(
    samples: [number, number, number][]
  ): [number, number, number] {
    if (samples.length === 0) {
      return [255, 255, 255];
    }

    const k = 3;
    const maxIterations = 20;

    let centroids: [number, number, number][] = [];
    const step = Math.max(1, Math.floor(samples.length / k));
    for (let i = 0; i < k && i * step < samples.length; i++) {
      centroids.push([...samples[i * step]]);
    }

    while (centroids.length < k) {
      centroids.push([...samples[0]]);
    }

    for (let iter = 0; iter < maxIterations; iter++) {
      const clusters: [number, number, number][][] = Array(k)
        .fill(null)
        .map(() => []);

      for (const sample of samples) {
        let minDist = Infinity;
        let bestCluster = 0;

        for (let c = 0; c < k; c++) {
          const dist = Math.sqrt(
            Math.pow(sample[0] - centroids[c][0], 2) +
              Math.pow(sample[1] - centroids[c][1], 2) +
              Math.pow(sample[2] - centroids[c][2], 2)
          );

          if (dist < minDist) {
            minDist = dist;
            bestCluster = c;
          }
        }

        clusters[bestCluster].push(sample);
      }

      for (let c = 0; c < k; c++) {
        if (clusters[c].length > 0) {
          const sumR = clusters[c].reduce((sum, s) => sum + s[0], 0);
          const sumG = clusters[c].reduce((sum, s) => sum + s[1], 0);
          const sumB = clusters[c].reduce((sum, s) => sum + s[2], 0);
          centroids[c] = [
            Math.round(sumR / clusters[c].length),
            Math.round(sumG / clusters[c].length),
            Math.round(sumB / clusters[c].length),
          ];
        }
      }
    }

    const clusterSizes = centroids.map((_, i) => {
      let count = 0;
      for (const sample of samples) {
        let minDist = Infinity;
        let bestCluster = 0;
        for (let c = 0; c < k; c++) {
          const dist = Math.sqrt(
            Math.pow(sample[0] - centroids[c][0], 2) +
              Math.pow(sample[1] - centroids[c][1], 2) +
              Math.pow(sample[2] - centroids[c][2], 2)
          );
          if (dist < minDist) {
            minDist = dist;
            bestCluster = c;
          }
        }
        if (bestCluster === i) count++;
      }
      return count;
    });

    let maxSize = 0;
    let dominantIndex = 0;
    for (let i = 0; i < k; i++) {
      if (clusterSizes[i] > maxSize) {
        maxSize = clusterSizes[i];
        dominantIndex = i;
      }
    }

    return centroids[dominantIndex];
  }

  static applySpillSuppression(
    imageData: ImageData,
    mask: Uint8Array,
    targetColor: [number, number, number]
  ): ImageData {
    const { width, height, data } = imageData;
    const result = new ImageData(
      new Uint8ClampedArray(data),
      width,
      height
    );

    const [tr, tg, tb] = targetColor;
    const isGreenScreen = tg > tr && tg > tb;
    const isBlueScreen = tb > tr && tb > tg;

    for (let i = 0; i < mask.length; i++) {
      if (mask[i] > 0 && mask[i] < 255) {
        const idx = i * 4;
        const r = result.data[idx];
        const g = result.data[idx + 1];
        const b = result.data[idx + 2];

        if (isGreenScreen) {
          const spillAmount = Math.max(0, g - Math.max(r, b));
          result.data[idx + 1] = Math.max(0, g - spillAmount * 0.5);
        }

        if (isBlueScreen) {
          const spillAmount = Math.max(0, b - Math.max(r, g));
          result.data[idx + 2] = Math.max(0, b - spillAmount * 0.5);
        }
      }
    }

    return result;
  }
}
