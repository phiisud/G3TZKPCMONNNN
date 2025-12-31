export interface ProcessedImageAnalysis {
  hadBackgroundRemoved: boolean;
  removalMethod: 'saliency' | 'color' | 'manual' | 'unknown' | null;
  suspiciousPatterns: string[];
  isLegitimateOperation: boolean;
  metadata: {
    originalSize?: number;
    processedSize?: number;
    transparencyPercentage: number;
    edgeComplexity: number;
    colorDistribution: {
      dominant: [number, number, number];
      uniformity: number;
    };
  };
  riskScore: number;
  timestamp: number;
}

export interface ImageMetadata {
  width: number;
  height: number;
  hasAlpha: boolean;
  colorDepth: number;
  estimatedQuality: 'low' | 'medium' | 'high' | 'professional';
}

const isBrowser = typeof window !== 'undefined' && typeof document !== 'undefined';

export class ImageAnalyzer {
  static async analyzeProcessedImage(
    originalImage: Blob | null,
    processedImage: Blob,
    _mask: Blob | null = null
  ): Promise<ProcessedImageAnalysis> {
    const analysis: ProcessedImageAnalysis = {
      hadBackgroundRemoved: false,
      removalMethod: null,
      suspiciousPatterns: [],
      isLegitimateOperation: false,
      metadata: {
        transparencyPercentage: 0,
        edgeComplexity: 0,
        colorDistribution: {
          dominant: [0, 0, 0],
          uniformity: 0,
        },
      },
      riskScore: 0,
      timestamp: Date.now(),
    };

    try {
      // Check for legitimate operation markers
      analysis.isLegitimateOperation = await this.checkLegitimateOperation(processedImage);
      
      const hasTransparency = await this.checkImageTransparency(processedImage);
      analysis.hadBackgroundRemoved = hasTransparency;

      if (hasTransparency) {
        const transparencyData = await this.analyzeTransparency(processedImage);
        analysis.metadata.transparencyPercentage = transparencyData.percentage;
        analysis.metadata.edgeComplexity = transparencyData.edgeComplexity;

        analysis.removalMethod = this.classifyRemovalMethod(transparencyData);

        if (transparencyData.percentage > 0.6) {
          analysis.suspiciousPatterns.push('high_transparency_ratio');
        }

        if (transparencyData.edgeComplexity < 0.1) {
          analysis.suspiciousPatterns.push('unnaturally_smooth_edges');
        }

        if (transparencyData.edgeComplexity > 0.9) {
          analysis.suspiciousPatterns.push('professional_cutout_quality');
        }

        if (transparencyData.uniformity > 0.95) {
          analysis.suspiciousPatterns.push('studio_quality_removal');
        }
      }

      if (originalImage) {
        analysis.metadata.originalSize = originalImage.size;
        analysis.metadata.processedSize = processedImage.size;

        const sizeRatio = processedImage.size / originalImage.size;
        if (sizeRatio > 2) {
          analysis.suspiciousPatterns.push('unusual_size_increase');
        }
      }

      // Reduce risk score for legitimate operations
      analysis.riskScore = this.calculateRiskScore(analysis);
      if (analysis.isLegitimateOperation) {
        analysis.riskScore *= 0.1; // 90% reduction for legitimate background removal
      }
    } catch (error) {
      console.error('[ImageAnalyzer] Analysis failed:', error);
    }

    return analysis;
  }

  static async checkLegitimateOperation(imageBlob: Blob): Promise<boolean> {
    if (!isBrowser) return false;
    
    try {
      // Check if image contains legitimate operation markers
      const text = await imageBlob.text();
      return text.includes('"operation": "background_removal"') && 
             text.includes('"legitimate": true');
    } catch {
      return false;
    }
  }

  static async checkImageTransparency(imageBlob: Blob): Promise<boolean> {
    if (!isBrowser) {
      console.warn('[ImageAnalyzer] checkImageTransparency called in non-browser context');
      return false;
    }
    
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(img.width, 512);
        canvas.height = Math.min(img.height, 512);
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

          let hasTransparency = false;
          for (let i = 3; i < imageData.data.length; i += 4) {
            if (imageData.data[i] !== undefined && imageData.data[i] < 255) {
              hasTransparency = true;
              break;
            }
          }

          resolve(hasTransparency);
        } else {
          resolve(false);
        }

        URL.revokeObjectURL(img.src);
      };

      img.onerror = () => {
        resolve(false);
      };

      img.src = URL.createObjectURL(imageBlob);
    });
  }

  private static async analyzeTransparency(
    imageBlob: Blob
  ): Promise<{
    percentage: number;
    edgeComplexity: number;
    uniformity: number;
    distribution: 'center' | 'edges' | 'scattered';
  }> {
    if (!isBrowser) {
      return {
        percentage: 0,
        edgeComplexity: 0,
        uniformity: 0,
        distribution: 'scattered',
      };
    }
    
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 512;
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        canvas.width = Math.floor(img.width * scale);
        canvas.height = Math.floor(img.height * scale);
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          resolve({
            percentage: 0,
            edgeComplexity: 0,
            uniformity: 0,
            distribution: 'scattered',
          });
          return;
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const { width, height, data } = imageData;

        let transparentPixels = 0;
        let edgePixels = 0;
        let totalEdgeLength = 0;
        let centerTransparent = 0;
        let edgeTransparent = 0;

        const marginX = Math.floor(width * 0.2);
        const marginY = Math.floor(height * 0.2);

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const alpha = data[idx + 3];

            if (alpha !== undefined && alpha < 255) {
              transparentPixels++;

              const isCenter =
                x > marginX &&
                x < width - marginX &&
                y > marginY &&
                y < height - marginY;
              if (isCenter) centerTransparent++;
              else edgeTransparent++;

              if (x > 0 && y > 0 && x < width - 1 && y < height - 1) {
                const neighbors = [
                  data[((y - 1) * width + x) * 4 + 3],
                  data[((y + 1) * width + x) * 4 + 3],
                  data[(y * width + (x - 1)) * 4 + 3],
                  data[(y * width + (x + 1)) * 4 + 3],
                ];

                const hasOpaqueNeighbor = neighbors.some((n) => n === 255);
                if (hasOpaqueNeighbor) {
                  edgePixels++;
                  totalEdgeLength++;
                }
              }
            }
          }
        }

        const totalPixels = width * height;
        const percentage = transparentPixels / totalPixels;

        const _perimeter = 2 * (width + height);
        const expectedEdgeLength = Math.sqrt(transparentPixels) * 4;
        const edgeComplexity = Math.min(
          1,
          totalEdgeLength / (expectedEdgeLength + 1)
        );

        const uniformity =
          transparentPixels > 0
            ? 1 - Math.abs(0.5 - centerTransparent / transparentPixels) * 2
            : 0;

        let distribution: 'center' | 'edges' | 'scattered' = 'scattered';
        if (transparentPixels > 0) {
          const centerRatio = centerTransparent / transparentPixels;
          if (centerRatio < 0.2) distribution = 'edges';
          else if (centerRatio > 0.8) distribution = 'center';
        }

        URL.revokeObjectURL(img.src);

        resolve({
          percentage,
          edgeComplexity,
          uniformity,
          distribution,
        });
      };

      img.onerror = () => {
        resolve({
          percentage: 0,
          edgeComplexity: 0,
          uniformity: 0,
          distribution: 'scattered',
        });
      };

      img.src = URL.createObjectURL(imageBlob);
    });
  }

  private static classifyRemovalMethod(data: {
    percentage: number;
    edgeComplexity: number;
    uniformity: number;
    distribution: string;
  }): 'saliency' | 'color' | 'manual' | 'unknown' {
    if (data.uniformity > 0.9 && data.edgeComplexity < 0.3) {
      return 'color';
    }

    if (data.edgeComplexity > 0.6 && data.distribution === 'edges') {
      return 'saliency';
    }

    if (data.edgeComplexity > 0.4 && data.edgeComplexity < 0.7) {
      return 'manual';
    }

    return 'unknown';
  }

  private static calculateRiskScore(analysis: ProcessedImageAnalysis): number {
    let score = 0;

    const patternWeights: Record<string, number> = {
      high_transparency_ratio: 0.1,
      unnaturally_smooth_edges: 0.15,
      professional_cutout_quality: 0.2,
      studio_quality_removal: 0.25,
      unusual_size_increase: 0.1,
    };

    for (const pattern of analysis.suspiciousPatterns) {
      score += patternWeights[pattern] || 0.05;
    }

    if (analysis.metadata.edgeComplexity > 0.85) {
      score += 0.15;
    }

    if (analysis.metadata.transparencyPercentage > 0.8) {
      score += 0.1;
    }

    return Math.min(1, score);
  }

  static async extractImageMetadata(imageBlob: Blob): Promise<ImageMetadata> {
    if (!isBrowser) {
      return {
        width: 0,
        height: 0,
        hasAlpha: false,
        colorDepth: 24,
        estimatedQuality: 'low',
      };
    }
    
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(img.width, 256);
        canvas.height = Math.min(img.height, 256);
        const ctx = canvas.getContext('2d');

        let hasAlpha = false;
        let estimatedQuality: 'low' | 'medium' | 'high' | 'professional' = 'medium';

        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

          for (let i = 3; i < imageData.data.length; i += 4) {
            if (imageData.data[i] !== undefined && imageData.data[i] < 255) {
              hasAlpha = true;
              break;
            }
          }
        }

        const totalPixels = img.width * img.height;
        if (totalPixels < 500000) estimatedQuality = 'low';
        else if (totalPixels < 2000000) estimatedQuality = 'medium';
        else if (totalPixels < 8000000) estimatedQuality = 'high';
        else estimatedQuality = 'professional';

        URL.revokeObjectURL(img.src);

        resolve({
          width: img.width,
          height: img.height,
          hasAlpha,
          colorDepth: 24,
          estimatedQuality,
        });
      };

      img.onerror = () => {
        resolve({
          width: 0,
          height: 0,
          hasAlpha: false,
          colorDepth: 24,
          estimatedQuality: 'low',
        });
      };

      img.src = URL.createObjectURL(imageBlob);
    });
  }

  static generateAuditLog(
    analysis: ProcessedImageAnalysis,
    operatorId: string
  ): {
    id: string;
    timestamp: number;
    operatorId: string;
    action: string;
    details: Record<string, unknown>;
    riskLevel: 'low' | 'medium' | 'high';
  } {
    const riskLevel: 'low' | 'medium' | 'high' =
      analysis.riskScore < 0.3 ? 'low' : analysis.riskScore < 0.6 ? 'medium' : 'high';

    return {
      id: `img_audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      operatorId,
      action: 'background_removal',
      details: {
        hadBackgroundRemoved: analysis.hadBackgroundRemoved,
        removalMethod: analysis.removalMethod,
        suspiciousPatterns: analysis.suspiciousPatterns,
        transparencyPercentage: analysis.metadata.transparencyPercentage,
        edgeComplexity: analysis.metadata.edgeComplexity,
        riskScore: analysis.riskScore,
      },
      riskLevel,
    };
  }
}

export default ImageAnalyzer;
