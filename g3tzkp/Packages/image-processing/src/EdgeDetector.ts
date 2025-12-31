export interface EdgeDetectionOptions {
  lowThreshold?: number;
  highThreshold?: number;
  blurRadius?: number;
}

export class EdgeDetector {
  static detectEdges(
    imageData: ImageData,
    options: EdgeDetectionOptions = {}
  ): Uint8Array {
    const { lowThreshold = 50, highThreshold = 150, blurRadius = 1 } = options;
    const { width, height, data } = imageData;

    const grayscale = this.toGrayscale(data, width, height);

    const blurred = this.gaussianBlur(grayscale, width, height, blurRadius);

    const { magnitude, direction } = this.computeGradients(blurred, width, height);

    const suppressed = this.nonMaxSuppression(magnitude, direction, width, height);

    const edges = this.hysteresisThreshold(
      suppressed,
      width,
      height,
      lowThreshold,
      highThreshold
    );

    return edges;
  }

  static detectEdgesSimple(imageData: ImageData): Uint8Array {
    const { width, height, data } = imageData;
    const edges = new Uint8Array(width * height);

    const grayscale = this.toGrayscale(data, width, height);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;

        const gx =
          -grayscale[(y - 1) * width + (x - 1)] +
          grayscale[(y - 1) * width + (x + 1)] +
          -2 * grayscale[y * width + (x - 1)] +
          2 * grayscale[y * width + (x + 1)] +
          -grayscale[(y + 1) * width + (x - 1)] +
          grayscale[(y + 1) * width + (x + 1)];

        const gy =
          -grayscale[(y - 1) * width + (x - 1)] +
          -2 * grayscale[(y - 1) * width + x] +
          -grayscale[(y - 1) * width + (x + 1)] +
          grayscale[(y + 1) * width + (x - 1)] +
          2 * grayscale[(y + 1) * width + x] +
          grayscale[(y + 1) * width + (x + 1)];

        const magnitude = Math.sqrt(gx * gx + gy * gy);
        edges[idx] = Math.min(255, Math.floor(magnitude));
      }
    }

    return edges;
  }

  private static toGrayscale(
    data: Uint8ClampedArray,
    width: number,
    height: number
  ): Float32Array {
    const gray = new Float32Array(width * height);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      gray[i / 4] = 0.299 * r + 0.587 * g + 0.114 * b;
    }

    return gray;
  }

  private static gaussianBlur(
    data: Float32Array,
    width: number,
    height: number,
    radius: number
  ): Float32Array {
    const kernel = this.createGaussianKernel(radius);
    const halfKernel = Math.floor(kernel.length / 2);
    const result = new Float32Array(data.length);

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

  private static computeGradients(
    data: Float32Array,
    width: number,
    height: number
  ): { magnitude: Float32Array; direction: Float32Array } {
    const magnitude = new Float32Array(width * height);
    const direction = new Float32Array(width * height);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;

        const gx =
          -data[(y - 1) * width + (x - 1)] +
          data[(y - 1) * width + (x + 1)] +
          -2 * data[y * width + (x - 1)] +
          2 * data[y * width + (x + 1)] +
          -data[(y + 1) * width + (x - 1)] +
          data[(y + 1) * width + (x + 1)];

        const gy =
          -data[(y - 1) * width + (x - 1)] +
          -2 * data[(y - 1) * width + x] +
          -data[(y - 1) * width + (x + 1)] +
          data[(y + 1) * width + (x - 1)] +
          2 * data[(y + 1) * width + x] +
          data[(y + 1) * width + (x + 1)];

        magnitude[idx] = Math.sqrt(gx * gx + gy * gy);
        direction[idx] = Math.atan2(gy, gx);
      }
    }

    return { magnitude, direction };
  }

  private static nonMaxSuppression(
    magnitude: Float32Array,
    direction: Float32Array,
    width: number,
    height: number
  ): Float32Array {
    const result = new Float32Array(width * height);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const angle = direction[idx];

        let q = 255;
        let r = 255;

        const normalizedAngle = ((angle * 180) / Math.PI + 180) % 180;

        if (
          (normalizedAngle >= 0 && normalizedAngle < 22.5) ||
          (normalizedAngle >= 157.5 && normalizedAngle <= 180)
        ) {
          q = magnitude[y * width + (x + 1)];
          r = magnitude[y * width + (x - 1)];
        } else if (normalizedAngle >= 22.5 && normalizedAngle < 67.5) {
          q = magnitude[(y - 1) * width + (x + 1)];
          r = magnitude[(y + 1) * width + (x - 1)];
        } else if (normalizedAngle >= 67.5 && normalizedAngle < 112.5) {
          q = magnitude[(y - 1) * width + x];
          r = magnitude[(y + 1) * width + x];
        } else if (normalizedAngle >= 112.5 && normalizedAngle < 157.5) {
          q = magnitude[(y - 1) * width + (x - 1)];
          r = magnitude[(y + 1) * width + (x + 1)];
        }

        if (magnitude[idx] >= q && magnitude[idx] >= r) {
          result[idx] = magnitude[idx];
        }
      }
    }

    return result;
  }

  private static hysteresisThreshold(
    data: Float32Array,
    width: number,
    height: number,
    lowThreshold: number,
    highThreshold: number
  ): Uint8Array {
    const result = new Uint8Array(width * height);
    const strong = 255;
    const weak = 75;

    for (let i = 0; i < data.length; i++) {
      if (data[i] >= highThreshold) {
        result[i] = strong;
      } else if (data[i] >= lowThreshold) {
        result[i] = weak;
      }
    }

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;

        if (result[idx] === weak) {
          let hasStrongNeighbor = false;

          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (result[(y + dy) * width + (x + dx)] === strong) {
                hasStrongNeighbor = true;
                break;
              }
            }
            if (hasStrongNeighbor) break;
          }

          result[idx] = hasStrongNeighbor ? strong : 0;
        }
      }
    }

    return result;
  }

  static findContours(
    mask: Uint8Array,
    width: number,
    height: number
  ): number[][] {
    const contours: number[][] = [];
    const visited = new Uint8Array(width * height);

    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;

        if (mask[idx] > 0 && visited[idx] === 0) {
          const isEdge =
            mask[(y - 1) * width + x] === 0 ||
            mask[(y + 1) * width + x] === 0 ||
            mask[y * width + (x - 1)] === 0 ||
            mask[y * width + (x + 1)] === 0;

          if (isEdge) {
            const contour = this.traceContour(mask, visited, width, height, x, y);
            if (contour.length > 10) {
              contours.push(contour);
            }
          }
        }
      }
    }

    return contours;
  }

  private static traceContour(
    mask: Uint8Array,
    visited: Uint8Array,
    width: number,
    height: number,
    startX: number,
    startY: number
  ): number[] {
    const contour: number[] = [];
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

      const isEdge =
        mask[(y - 1) * width + x] === 0 ||
        mask[(y + 1) * width + x] === 0 ||
        mask[y * width + (x - 1)] === 0 ||
        mask[y * width + (x + 1)] === 0;

      if (!isEdge) continue;

      visited[idx] = 1;
      contour.push(x, y);

      stack.push([x + 1, y]);
      stack.push([x - 1, y]);
      stack.push([x, y + 1]);
      stack.push([x, y - 1]);
    }

    return contour;
  }
}
