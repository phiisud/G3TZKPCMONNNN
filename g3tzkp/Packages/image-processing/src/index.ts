export { SaliencyDetector } from './SaliencyDetector';
export type { LABColor, SaliencyOptions } from './SaliencyDetector';

export { ColorRangeSegmenter } from './ColorRangeSegmenter';
export type { YCbCrColor, ColorRemovalOptions } from './ColorRangeSegmenter';

export { GrabCutProcessor } from './GrabCutProcessor';
export type { GMMComponent, GrabCutOptions } from './GrabCutProcessor';

export { EdgeDetector } from './EdgeDetector';
export type { EdgeDetectionOptions } from './EdgeDetector';

export { MorphologyProcessor } from './MorphologyProcessor';
export type { StructuringElement, MorphologyOptions } from './MorphologyProcessor';

export interface ProcessingResult {
  mask: Uint8Array;
  width: number;
  height: number;
  processingTime: number;
  method: 'saliency' | 'color' | 'grabcut' | 'edge';
}

export interface BackgroundRemovalConfig {
  maxImageSize: number;
  defaultMethod: 'saliency' | 'color' | 'grabcut';
  autoDetectGreenScreen: boolean;
  enableFeathering: boolean;
  featherRadius: number;
  morphologyIterations: number;
  minRegionSize: number;
}

export const DEFAULT_CONFIG: BackgroundRemovalConfig = {
  maxImageSize: 4096,
  defaultMethod: 'saliency',
  autoDetectGreenScreen: true,
  enableFeathering: true,
  featherRadius: 2,
  morphologyIterations: 1,
  minRegionSize: 100,
};

export function applyMaskToImage(
  imageData: ImageData,
  mask: Uint8Array
): ImageData {
  const { width, height, data } = imageData;
  const result = new ImageData(new Uint8ClampedArray(data), width, height);

  for (let i = 0; i < mask.length; i++) {
    result.data[i * 4 + 3] = mask[i];
  }

  return result;
}

export function invertMask(mask: Uint8Array): Uint8Array {
  const result = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) {
    result[i] = 255 - mask[i];
  }
  return result;
}

export function combineMasks(
  mask1: Uint8Array,
  mask2: Uint8Array,
  operation: 'and' | 'or' | 'xor'
): Uint8Array {
  const result = new Uint8Array(mask1.length);

  for (let i = 0; i < mask1.length; i++) {
    switch (operation) {
      case 'and':
        result[i] = Math.min(mask1[i], mask2[i]);
        break;
      case 'or':
        result[i] = Math.max(mask1[i], mask2[i]);
        break;
      case 'xor':
        result[i] = Math.abs(mask1[i] - mask2[i]);
        break;
    }
  }

  return result;
}

export function resizeImageData(
  imageData: ImageData,
  newWidth: number,
  newHeight: number
): ImageData {
  const { width, height, data } = imageData;
  const result = new ImageData(newWidth, newHeight);

  const xRatio = width / newWidth;
  const yRatio = height / newHeight;

  for (let y = 0; y < newHeight; y++) {
    for (let x = 0; x < newWidth; x++) {
      const srcX = Math.floor(x * xRatio);
      const srcY = Math.floor(y * yRatio);
      const srcIdx = (srcY * width + srcX) * 4;
      const dstIdx = (y * newWidth + x) * 4;

      result.data[dstIdx] = data[srcIdx];
      result.data[dstIdx + 1] = data[srcIdx + 1];
      result.data[dstIdx + 2] = data[srcIdx + 2];
      result.data[dstIdx + 3] = data[srcIdx + 3];
    }
  }

  return result;
}

export function resizeMask(
  mask: Uint8Array,
  srcWidth: number,
  srcHeight: number,
  dstWidth: number,
  dstHeight: number
): Uint8Array {
  const result = new Uint8Array(dstWidth * dstHeight);

  const xRatio = srcWidth / dstWidth;
  const yRatio = srcHeight / dstHeight;

  for (let y = 0; y < dstHeight; y++) {
    for (let x = 0; x < dstWidth; x++) {
      const srcX = Math.floor(x * xRatio);
      const srcY = Math.floor(y * yRatio);
      const srcIdx = srcY * srcWidth + srcX;
      const dstIdx = y * dstWidth + x;

      result[dstIdx] = mask[srcIdx];
    }
  }

  return result;
}
