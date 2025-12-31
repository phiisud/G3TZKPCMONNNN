interface LABColor {
  L: number;
  a: number;
  b: number;
}

interface YCbCrColor {
  y: number;
  cb: number;
  cr: number;
}

const SaliencyDetector = {
  detectSaliency(imageData: ImageData, threshold: number = 0.4): Uint8Array {
    const { width, height, data } = imageData;
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

    const blurred = this.gaussianBlur(saliencyMap, width, height, 3);
    const binaryMask = new Uint8Array(width * height);
    
    for (let i = 0; i < blurred.length; i++) {
      binaryMask[i] = blurred[i] > threshold ? 255 : 0;
    }

    return binaryMask;
  },

  rgbToLAB(r: number, g: number, b: number): LABColor {
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

    const fx = x / xn > 0.008856 ? Math.pow(x / xn, 1 / 3) : 7.787 * (x / xn) + 16 / 116;
    const fy = y / yn > 0.008856 ? Math.pow(y / yn, 1 / 3) : 7.787 * (y / yn) + 16 / 116;
    const fz = z / zn > 0.008856 ? Math.pow(z / zn, 1 / 3) : 7.787 * (z / zn) + 16 / 116;

    return {
      L: 116 * fy - 16,
      a: 500 * (fx - fy),
      b: 200 * (fy - fz),
    };
  },

  computeMeanLAB(data: Uint8ClampedArray, width: number, height: number): LABColor {
    let sumL = 0, sumA = 0, sumB = 0;
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
  },

  gaussianBlur(data: Float32Array, width: number, height: number, radius: number): Float32Array {
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
  },

  createGaussianKernel(radius: number): number[] {
    const sigma = radius / 2;
    const kernelSize = radius * 2 + 1;
    const kernel = new Array(kernelSize);
    let sum = 0;

    for (let i = 0; i < kernelSize; i++) {
      const x = i - radius;
      kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma)) / (Math.sqrt(2 * Math.PI) * sigma);
      sum += kernel[i];
    }

    for (let i = 0; i < kernelSize; i++) {
      kernel[i] /= sum;
    }

    return kernel;
  },
};

const ColorRangeSegmenter = {
  removeByColor(
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
        Math.pow(yDiff * 0.3, 2) + Math.pow(cbDiff * 1.0, 2) + Math.pow(crDiff * 1.0, 2)
      );

      let alphaValue = 255;

      if (colorDistance < tolerance) {
        alphaValue = 0;
      } else if (colorDistance < tolerance + softness) {
        const t = (colorDistance - tolerance) / softness;
        alphaValue = Math.floor(255 * t);
      }

      alpha[i / 4] = alphaValue;
    }

    return alpha;
  },

  rgbToYCbCr(r: number, g: number, b: number): YCbCrColor {
    const y = 0.299 * r + 0.587 * g + 0.114 * b;
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    return { y, cb, cr };
  },

  detectBackgroundColor(imageData: ImageData): [number, number, number] {
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

    if (edgeSamples.length === 0) return [255, 255, 255];

    let sumR = 0, sumG = 0, sumB = 0;
    for (const [r, g, b] of edgeSamples) {
      sumR += r;
      sumG += g;
      sumB += b;
    }

    return [
      Math.round(sumR / edgeSamples.length),
      Math.round(sumG / edgeSamples.length),
      Math.round(sumB / edgeSamples.length),
    ];
  },
};

const MorphologyProcessor = {
  featherEdges(mask: Uint8Array, width: number, height: number, radius: number): Uint8Array {
    const result = new Uint8Array(mask.length);
    const floatMask = new Float32Array(mask.length);
    
    for (let i = 0; i < mask.length; i++) {
      floatMask[i] = mask[i] / 255;
    }

    const kernel = SaliencyDetector.createGaussianKernel(radius);
    const halfSize = Math.floor(kernel.length / 2);

    const temp = new Float32Array(mask.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let weightSum = 0;

        for (let k = -halfSize; k <= halfSize; k++) {
          const nx = Math.max(0, Math.min(width - 1, x + k));
          const weight = kernel[k + halfSize];
          sum += floatMask[y * width + nx] * weight;
          weightSum += weight;
        }

        temp[y * width + x] = sum / weightSum;
      }
    }

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let sum = 0;
        let weightSum = 0;

        for (let k = -halfSize; k <= halfSize; k++) {
          const ny = Math.max(0, Math.min(height - 1, y + k));
          const weight = kernel[k + halfSize];
          sum += temp[ny * width + x] * weight;
          weightSum += weight;
        }

        result[y * width + x] = Math.floor((sum / weightSum) * 255);
      }
    }

    return result;
  },

  fillHoles(mask: Uint8Array, width: number, height: number): Uint8Array {
    const result = new Uint8Array(mask);
    const visited = new Uint8Array(width * height);

    const floodFill = (startX: number, startY: number): number[] => {
      const region: number[] = [];
      const stack: [number, number][] = [[startX, startY]];

      while (stack.length > 0) {
        const [x, y] = stack.pop()!;
        const idx = y * width + x;

        if (x < 0 || x >= width || y < 0 || y >= height || visited[idx] === 1 || mask[idx] > 0) {
          continue;
        }

        visited[idx] = 1;
        region.push(idx);

        stack.push([x + 1, y]);
        stack.push([x - 1, y]);
        stack.push([x, y + 1]);
        stack.push([x, y - 1]);
      }

      return region;
    };

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;

        if (mask[idx] === 0 && visited[idx] === 0) {
          const region = floodFill(x, y);

          let touchesEdge = false;
          for (const pixelIdx of region) {
            const px = pixelIdx % width;
            const py = Math.floor(pixelIdx / width);
            if (px === 0 || px === width - 1 || py === 0 || py === height - 1) {
              touchesEdge = true;
              break;
            }
          }

          if (!touchesEdge && region.length < (width * height) / 4) {
            for (const pixelIdx of region) {
              result[pixelIdx] = 255;
            }
          }
        }
      }
    }

    return result;
  },
};

self.onmessage = async (event: MessageEvent) => {
  const { type, imageData, params } = event.data;

  try {
    const startTime = performance.now();
    let result: Uint8Array | Uint8ClampedArray;

    switch (type) {
      case 'saliency': {
        const threshold = params?.threshold ?? 0.4;
        result = SaliencyDetector.detectSaliency(imageData, threshold);
        break;
      }

      case 'color': {
        const { targetColor, tolerance = 0.3, softness = 0.1 } = params;
        result = ColorRangeSegmenter.removeByColor(imageData, targetColor, tolerance, softness);
        break;
      }

      case 'detectBackground': {
        const bgColor = ColorRangeSegmenter.detectBackgroundColor(imageData);
        self.postMessage({
          success: true,
          result: bgColor,
          processingTime: performance.now() - startTime,
        });
        return;
      }

      case 'feather': {
        const { mask, width, height, radius = 2 } = params;
        result = MorphologyProcessor.featherEdges(mask, width, height, radius);
        break;
      }

      case 'fillHoles': {
        const { mask, width, height } = params;
        result = MorphologyProcessor.fillHoles(mask, width, height);
        break;
      }

      default:
        throw new Error(`Unknown processing type: ${type}`);
    }

    const processingTime = performance.now() - startTime;

    self.postMessage({
      success: true,
      result,
      processingTime,
    });
  } catch (error) {
    self.postMessage({
      success: false,
      error: (error as Error).message,
    });
  }
};

export {};
