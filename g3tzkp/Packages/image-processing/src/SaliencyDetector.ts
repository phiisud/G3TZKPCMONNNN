export interface LABColor {
  L: number;
  a: number;
  b: number;
}

export interface SaliencyOptions {
  blurRadius?: number;
  threshold?: number;
  enhanceContrast?: boolean;
}

export class SaliencyDetector {
  private static GAUSSIAN_BLUR_RADIUS = 3;
  private static SALIENCY_THRESHOLD = 0.4;

  static detectSaliency(
    imageData: ImageData,
    options: SaliencyOptions = {}
  ): Uint8Array {
    const { width, height, data } = imageData;
    const blurRadius = options.blurRadius ?? this.GAUSSIAN_BLUR_RADIUS;
    const threshold = options.threshold ?? this.SALIENCY_THRESHOLD;
    const saliencyMap = new Float32Array(width * height);

    const meanLab = this.computeMeanLAB(data, width, height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;

        const pixelLab = this.rgbToLAB(data[idx], data[idx + 1], data[idx + 2]);

        const diff =
          Math.sqrt(
            Math.pow(pixelLab.L - meanLab.L, 2) +
              Math.pow(pixelLab.a - meanLab.a, 2) +
              Math.pow(pixelLab.b - meanLab.b, 2)
          ) / 100;

        saliencyMap[y * width + x] = Math.min(1.0, diff * 2);
      }
    }

    const blurred = this.gaussianBlur(saliencyMap, width, height, blurRadius);

    const binaryMask = new Uint8Array(width * height);
    for (let i = 0; i < blurred.length; i++) {
      binaryMask[i] = blurred[i] > threshold ? 255 : 0;
    }

    return binaryMask;
  }

  static detectSaliencyWithAlpha(
    imageData: ImageData,
    options: SaliencyOptions = {}
  ): Uint8Array {
    const { width, height, data } = imageData;
    const blurRadius = options.blurRadius ?? this.GAUSSIAN_BLUR_RADIUS;
    const saliencyMap = new Float32Array(width * height);

    const meanLab = this.computeMeanLAB(data, width, height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const pixelLab = this.rgbToLAB(data[idx], data[idx + 1], data[idx + 2]);

        const diff =
          Math.sqrt(
            Math.pow(pixelLab.L - meanLab.L, 2) +
              Math.pow(pixelLab.a - meanLab.a, 2) +
              Math.pow(pixelLab.b - meanLab.b, 2)
          ) / 100;

        saliencyMap[y * width + x] = Math.min(1.0, diff * 2);
      }
    }

    const blurred = this.gaussianBlur(saliencyMap, width, height, blurRadius);

    const alphaMask = new Uint8Array(width * height);
    for (let i = 0; i < blurred.length; i++) {
      alphaMask[i] = Math.floor(Math.min(255, blurred[i] * 255 * 1.5));
    }

    return alphaMask;
  }

  static rgbToLAB(r: number, g: number, b: number): LABColor {
    let rr = r / 255;
    let gg = g / 255;
    let bb = b / 255;

    rr = rr > 0.04045 ? Math.pow((rr + 0.055) / 1.055, 2.4) : rr / 12.92;
    gg = gg > 0.04045 ? Math.pow((gg + 0.055) / 1.055, 2.4) : gg / 12.92;
    bb = bb > 0.04045 ? Math.pow((bb + 0.055) / 1.055, 2.4) : bb / 12.92;

    const x = rr * 0.4124 + gg * 0.3576 + bb * 0.1805;
    const y = rr * 0.2126 + gg * 0.7152 + bb * 0.0722;
    const z = rr * 0.0193 + gg * 0.1192 + bb * 0.9505;

    const xn = 0.95047;
    const yn = 1.0;
    const zn = 1.08883;

    const fx =
      x / xn > 0.008856
        ? Math.pow(x / xn, 1 / 3)
        : 7.787 * (x / xn) + 16 / 116;
    const fy =
      y / yn > 0.008856
        ? Math.pow(y / yn, 1 / 3)
        : 7.787 * (y / yn) + 16 / 116;
    const fz =
      z / zn > 0.008856
        ? Math.pow(z / zn, 1 / 3)
        : 7.787 * (z / zn) + 16 / 116;

    const L = 116 * fy - 16;
    const a = 500 * (fx - fy);
    const bVal = 200 * (fy - fz);

    return { L, a, b: bVal };
  }

  private static computeMeanLAB(
    data: Uint8ClampedArray,
    width: number,
    height: number
  ): LABColor {
    let sumL = 0,
      sumA = 0,
      sumB = 0;
    const totalPixels = width * height;

    for (let i = 0; i < data.length; i += 4) {
      const lab = this.rgbToLAB(data[i], data[i + 1], data[i + 2]);
      sumL += lab.L;
      sumA += lab.a;
      sumB += lab.b;
    }

    return {
      L: sumL / totalPixels,
      a: sumA / totalPixels,
      b: sumB / totalPixels,
    };
  }

  static gaussianBlur(
    data: Float32Array,
    width: number,
    height: number,
    radius: number
  ): Float32Array {
    const result = new Float32Array(data.length);
    const kernel = this.createGaussianKernel(radius);
    const halfKernel = Math.floor(kernel.length / 2);

    const temp = new Float32Array(data.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let weightSum = 0;

        for (let k = -halfKernel; k <= halfKernel; k++) {
          const px = Math.max(0, Math.min(width - 1, x + k));
          const weight = kernel[k + halfKernel];
          sum += data[y * width + px] * weight;
          weightSum += weight;
        }

        temp[y * width + x] = sum / weightSum;
      }
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let weightSum = 0;

        for (let k = -halfKernel; k <= halfKernel; k++) {
          const py = Math.max(0, Math.min(height - 1, y + k));
          const weight = kernel[k + halfKernel];
          sum += temp[py * width + x] * weight;
          weightSum += weight;
        }

        result[y * width + x] = sum / weightSum;
      }
    }

    return result;
  }

  private static createGaussianKernel(radius: number): number[] {
    const sigma = radius / 2;
    const kernelSize = radius * 2 + 1;
    const kernel = new Array(kernelSize);
    let sum = 0;

    for (let i = 0; i < kernelSize; i++) {
      const x = i - radius;
      kernel[i] =
        Math.exp(-(x * x) / (2 * sigma * sigma)) /
        (Math.sqrt(2 * Math.PI) * sigma);
      sum += kernel[i];
    }

    for (let i = 0; i < kernelSize; i++) {
      kernel[i] /= sum;
    }

    return kernel;
  }
}
