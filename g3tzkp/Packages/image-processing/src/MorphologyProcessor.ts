export type StructuringElement = 'circle' | 'square' | 'cross';

export interface MorphologyOptions {
  kernelSize?: number;
  element?: StructuringElement;
}

export class MorphologyProcessor {
  static dilate(
    mask: Uint8Array,
    width: number,
    height: number,
    options: MorphologyOptions = {}
  ): Uint8Array {
    const { kernelSize = 3, element = 'circle' } = options;
    const kernel = this.createKernel(kernelSize, element);
    const result = new Uint8Array(mask.length);
    const halfSize = Math.floor(kernelSize / 2);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let maxVal = 0;

        for (let ky = -halfSize; ky <= halfSize; ky++) {
          for (let kx = -halfSize; kx <= halfSize; kx++) {
            const nx = x + kx;
            const ny = y + ky;

            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const kernelIdx = (ky + halfSize) * kernelSize + (kx + halfSize);
              if (kernel[kernelIdx]) {
                const pixelIdx = ny * width + nx;
                maxVal = Math.max(maxVal, mask[pixelIdx]);
              }
            }
          }
        }

        result[y * width + x] = maxVal;
      }
    }

    return result;
  }

  static erode(
    mask: Uint8Array,
    width: number,
    height: number,
    options: MorphologyOptions = {}
  ): Uint8Array {
    const { kernelSize = 3, element = 'circle' } = options;
    const kernel = this.createKernel(kernelSize, element);
    const result = new Uint8Array(mask.length);
    const halfSize = Math.floor(kernelSize / 2);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let minVal = 255;

        for (let ky = -halfSize; ky <= halfSize; ky++) {
          for (let kx = -halfSize; kx <= halfSize; kx++) {
            const nx = x + kx;
            const ny = y + ky;

            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const kernelIdx = (ky + halfSize) * kernelSize + (kx + halfSize);
              if (kernel[kernelIdx]) {
                const pixelIdx = ny * width + nx;
                minVal = Math.min(minVal, mask[pixelIdx]);
              }
            }
          }
        }

        result[y * width + x] = minVal;
      }
    }

    return result;
  }

  static open(
    mask: Uint8Array,
    width: number,
    height: number,
    options: MorphologyOptions = {}
  ): Uint8Array {
    const eroded = this.erode(mask, width, height, options);
    return this.dilate(eroded, width, height, options);
  }

  static close(
    mask: Uint8Array,
    width: number,
    height: number,
    options: MorphologyOptions = {}
  ): Uint8Array {
    const dilated = this.dilate(mask, width, height, options);
    return this.erode(dilated, width, height, options);
  }

  static featherEdges(
    mask: Uint8Array,
    width: number,
    height: number,
    radius: number
  ): Uint8Array {
    const result = new Uint8Array(mask.length);

    const floatMask = new Float32Array(mask.length);
    for (let i = 0; i < mask.length; i++) {
      floatMask[i] = mask[i] / 255;
    }

    const kernel = this.createGaussianKernel(radius);
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
  }

  static smoothMaskEdges(
    mask: Uint8Array,
    width: number,
    height: number,
    iterations: number = 2
  ): Uint8Array {
    let result = new Uint8Array(mask);

    for (let iter = 0; iter < iterations; iter++) {
      const temp = new Uint8Array(result.length);

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = y * width + x;

          const sum =
            result[(y - 1) * width + (x - 1)] +
            result[(y - 1) * width + x] * 2 +
            result[(y - 1) * width + (x + 1)] +
            result[y * width + (x - 1)] * 2 +
            result[idx] * 4 +
            result[y * width + (x + 1)] * 2 +
            result[(y + 1) * width + (x - 1)] +
            result[(y + 1) * width + x] * 2 +
            result[(y + 1) * width + (x + 1)];

          temp[idx] = Math.floor(sum / 16);
        }
      }

      result = temp;
    }

    return result;
  }

  static fillHoles(
    mask: Uint8Array,
    width: number,
    height: number
  ): Uint8Array {
    const result = new Uint8Array(mask);
    const visited = new Uint8Array(width * height);

    const floodFill = (startX: number, startY: number): number[] => {
      const region: number[] = [];
      const stack: [number, number][] = [[startX, startY]];

      while (stack.length > 0) {
        const [x, y] = stack.pop()!;
        const idx = y * width + x;

        if (
          x < 0 ||
          x >= width ||
          y < 0 ||
          y >= height ||
          visited[idx] === 1 ||
          mask[idx] > 0
        ) {
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
  }

  static removeSmallRegions(
    mask: Uint8Array,
    width: number,
    height: number,
    minSize: number
  ): Uint8Array {
    const result = new Uint8Array(mask);
    const visited = new Uint8Array(width * height);

    const floodFill = (startX: number, startY: number): number[] => {
      const region: number[] = [];
      const stack: [number, number][] = [[startX, startY]];

      while (stack.length > 0) {
        const [x, y] = stack.pop()!;
        const idx = y * width + x;

        if (
          x < 0 ||
          x >= width ||
          y < 0 ||
          y >= height ||
          visited[idx] === 1 ||
          mask[idx] === 0
        ) {
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

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;

        if (mask[idx] > 0 && visited[idx] === 0) {
          const region = floodFill(x, y);

          if (region.length < minSize) {
            for (const pixelIdx of region) {
              result[pixelIdx] = 0;
            }
          }
        }
      }
    }

    return result;
  }

  private static createKernel(size: number, element: StructuringElement): Uint8Array {
    const kernel = new Uint8Array(size * size);
    const center = Math.floor(size / 2);
    const radiusSq = center * center;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = x - center;
        const dy = y - center;

        switch (element) {
          case 'circle':
            kernel[y * size + x] = dx * dx + dy * dy <= radiusSq ? 1 : 0;
            break;
          case 'square':
            kernel[y * size + x] = 1;
            break;
          case 'cross':
            kernel[y * size + x] = dx === 0 || dy === 0 ? 1 : 0;
            break;
        }
      }
    }

    return kernel;
  }

  private static createGaussianKernel(radius: number): number[] {
    const sigma = Math.max(1, radius / 2);
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
