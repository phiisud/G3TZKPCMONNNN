import * as THREE from 'three';

const PHI = 1.618033988749895;
const PI = 3.141592653589793;

const vertexShader = `
  varying vec3 vLocalPosition;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vLocalPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;

  uniform float uPhi;
  uniform float uPi;
  uniform float uTime;
  uniform vec3 uLocalCameraPosition;
  uniform float uPhiStepMultiplier;
  uniform float uPiPrecisionThreshold;
  uniform float uMaxSteps;
  uniform float uMaxDistance;
  uniform float uDepthScale;
  uniform float uMetricExtension; 
  uniform float uEigenValue;
  uniform float uZkpProofConsistency;
  uniform float uAssetAspect;
  
  uniform float uShowPhiSteps;
  uniform float uShowNormals;
  uniform float uShowBlade;
  uniform float uShowStepDepth;
  uniform float uBladeDepthDebug;
  
  uniform sampler2D uVideoTexture;
  uniform bool uHasVideo;
  
  // Texture modulation uniforms
  uniform float uSaturation;
  uniform float uBrightness;
  uniform float uExposure;
  uniform float uContrast;
  uniform float uShadows;
  uniform float uHighlights;
  uniform float uVibrance;
  uniform float uHue;
  uniform float uBwFilter;

  varying vec3 vLocalPosition;
  varying vec2 vUv;
  
  vec3 rgb2hsv(vec3 c) {
    vec4 K = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
  }
  
  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }
  
  vec3 applyTextureModulation(vec3 color) {
    // Exposure
    color *= pow(2.0, uExposure);
    
    // Brightness
    color += uBrightness;
    
    // Contrast
    color = (color - 0.5) * uContrast + 0.5;
    
    // Shadows/Highlights
    float luma = dot(color, vec3(0.299, 0.587, 0.114));
    float shadowMask = 1.0 - smoothstep(0.0, 0.5, luma);
    float highlightMask = smoothstep(0.5, 1.0, luma);
    color += shadowMask * uShadows * 0.5;
    color += highlightMask * uHighlights * 0.5;
    
    // Saturation
    vec3 gray = vec3(luma);
    color = mix(gray, color, uSaturation);
    
    // Vibrance (smart saturation - affects less saturated colors more)
    float maxC = max(color.r, max(color.g, color.b));
    float minC = min(color.r, min(color.g, color.b));
    float sat = (maxC - minC) / (maxC + 0.001);
    color = mix(gray, color, 1.0 + uVibrance * (1.0 - sat));
    
    // Hue shift
    vec3 hsv = rgb2hsv(color);
    hsv.x = fract(hsv.x + uHue);
    color = hsv2rgb(hsv);
    
    // BW Filter (convert to grayscale)
    color = mix(color, vec3(luma), uBwFilter);
    
    return clamp(color, 0.0, 1.0);
  }

  float getRotorHarmonic(vec3 p) {
    float dist = length(p.xy);
    float angle = dist * uPhi + p.z * (uPi / uPhi);
    float s = sin(p.x * uPhi + angle);
    float c = cos(p.y * uPhi - angle);
    return (s * c) * 0.5 + 0.5;
  }

  float getStitch(float r, float z, float rotor, float substrate) {
    float freq = (3.0 + uPhi) * 2.0 * (0.9 + 0.2 * rotor);
    float sliceLayers = floor(abs(z) * 10.0 * uPhi);
    float x = r * freq + z * uPi + substrate * uPhi + sliceLayers * 0.1;
    float x7 = mod(x, 7.0);
    int idx = int(floor(x7));
    float pulse = (idx == 0 || idx == 3 || idx == 4 || idx == 6) ? 1.0 : 0.2;
    return pulse;
  }

  struct RealityMetric {
    float depth;
    vec3 color;
    bool isValid;
  };

  RealityMetric sampleReality(vec2 uv) {
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
        return RealityMetric(0.0, vec3(0.0), false);
    }
    if (!uHasVideo) {
      // Generate procedural texture when no video
      float pattern = sin(uv.x * 20.0 + uTime) * cos(uv.y * 20.0) * 0.5 + 0.5;
      vec3 color = vec3(pattern, pattern * 0.8, pattern * 0.6);
      float depth = pattern * 0.1;
      return RealityMetric(depth, color, true);
    }

    vec4 tex = texture2D(uVideoTexture, uv);
    vec3 modColor = applyTextureModulation(tex.rgb);
    float luma = dot(modColor, vec3(0.299, 0.587, 0.114));
    float reconDepth = pow(luma, uEigenValue * 0.5) * uMetricExtension;
    return RealityMetric(reconDepth, modColor, true);
  }

  float verifyUnifiedReality(vec3 p) {
    vec2 uv = p.xy * 0.5 + 0.5;
    RealityMetric reality = sampleReality(uv);
    
    float r = length(p.xy);
    float bladeBase = pow(abs(cos(r * (uPi * 0.5))), uPhi * 0.4) * uDepthScale;
    
    float rotor = getRotorHarmonic(p);
    float stitch = getStitch(r, p.z, rotor, bladeBase);
    
    float garmentThickness = reality.depth * stitch;
    
    float totalThickness = mix(bladeBase, garmentThickness, uZkpProofConsistency);
    
    float d = abs(p.z) - totalThickness;
    
    float micro = sin(p.x * 60.0 + uTime) * cos(p.y * 60.0) * 0.0003 * uZkpProofConsistency;
    
    return (d + micro) * 0.75;
  }

  vec3 calcNormal(vec3 p) {
    float h = 0.0008;
    const vec2 k = vec2(1, -1);
    vec3 n = normalize(k.xyy * verifyUnifiedReality(p + k.xyy * h) + 
                       k.yyx * verifyUnifiedReality(p + k.yyx * h) + 
                       k.yxy * verifyUnifiedReality(p + k.yxy * h) + 
                       k.xxx * verifyUnifiedReality(p + k.xxx * h));
    return n;
  }

  void main() {
    vec3 ro = uLocalCameraPosition;
    vec3 rd = normalize(vLocalPosition - ro);

    float dO = 0.0;
    bool hit = false;
    float steps = 0.0;
    
    for(int i = 0; i < 512; i++) {
      if(float(i) >= uMaxSteps) break;
      vec3 p = ro + rd * dO;
      float dS = verifyUnifiedReality(p);
      
      dO += dS * uPhiStepMultiplier;
      steps += 1.0;
      
      if(dS < uPiPrecisionThreshold) { hit = true; break; }
      if(dO > uMaxDistance) break;
    }

    vec3 col = vec3(0.0);
    if(hit) {
      vec3 p = ro + rd * dO;
      vec3 n = calcNormal(p);
      
      vec2 uv = p.xy * 0.5 + 0.5;
      RealityMetric reality = sampleReality(uv);
      
      vec3 lPos = vec3(8.0, 8.0, 12.0 * sign(ro.z));
      vec3 lDir = normalize(lPos - p);
      float diff = max(dot(n, lDir), 0.0);
      float rim = pow(1.0 - max(dot(n, -rd), 0.0), 4.0);
      float spec = pow(max(dot(reflect(-lDir, n), -rd), 0.0), 64.0);
      
      col = reality.color * (diff + 0.12);
      
      float rotor = getRotorHarmonic(p);
      float pulse = getStitch(length(p.xy), p.z, rotor, reality.depth);
      vec3 energy = mix(vec3(0.0, 1.0, 0.9), vec3(0.9, 0.2, 1.0), pulse);
      col = mix(col, energy * (diff + rim), 0.08 * (1.0 - uZkpProofConsistency));
      
      col += vec3(1.0) * spec * 0.45;

      if(uBladeDepthDebug > 0.0) {
          col = mix(col, vec3(reality.depth * 0.3, reality.depth * 0.1, 0.5), 0.6 * uBladeDepthDebug);
      }
      if(uShowNormals > 0.5) col = n * 0.5 + 0.5;
      if(uShowPhiSteps > 0.5) {
          float s = steps / uMaxSteps;
          col = mix(vec3(0.0, 0.05, 0.15), vec3(1.0, 0.85, 0.1), s);
      }
      if(uShowStepDepth > 0.5) {
          col = vec3(pulse, rotor, fract(p.z * uPhi));
      }
    } else {
      float bg = pow(1.0 - length(vUv - 0.5), 2.2);
      col = vec3(0.0, 0.002, 0.006) * bg;
    }

    gl_FragColor = vec4(pow(col, vec3(0.4545)), 1.0);
  }
`;

export interface PhiPiState {
  phi: number;
  pi: number;
  phiStepMultiplier: number;
  piPrecisionThreshold: number;
  maxSteps: number;
  depthScale: number;
  metricExtension: number;
  eigenValue: number;
  zkpProofConsistency: number;
  bladeDepthDebug: number;
  showPhiSteps: boolean;
  showNormals: boolean;
  showBlade: boolean;
  showStepDepth: boolean;
  // Texture modulation
  saturation: number;
  brightness: number;
  exposure: number;
  contrast: number;
  shadows: number;
  highlights: number;
  vibrance: number;
  hue: number;
  bwFilter: number;
}

export const DEFAULT_PHIPI_STATE: PhiPiState = {
  phi: PHI,
  pi: PI,
  phiStepMultiplier: 0.5,
  piPrecisionThreshold: 0.00015,
  maxSteps: 400,
  depthScale: 1.5,
  metricExtension: 2.0,
  eigenValue: 2.618,
  zkpProofConsistency: 1.0,
  bladeDepthDebug: 0.0,
  showPhiSteps: false,
  showNormals: false,
  showBlade: false,
  showStepDepth: false,
  // Texture modulation defaults
  saturation: 1.0,
  brightness: 0.0,
  exposure: 0.0,
  contrast: 1.0,
  shadows: 0.0,
  highlights: 0.0,
  vibrance: 0.0,
  hue: 0.0,
  bwFilter: 0.0
};

export class PhiPiRaymarchingMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      uniforms: {
        uPhi: { value: PHI },
        uPi: { value: PI },
        uTime: { value: 0 },
        uLocalCameraPosition: { value: new THREE.Vector3(0, 0, 5) },
        uPhiStepMultiplier: { value: 0.5 },
        uPiPrecisionThreshold: { value: 0.00015 },
        uMaxSteps: { value: 400.0 },
        uMaxDistance: { value: 100.0 },
        uDepthScale: { value: 1.5 },
        uMetricExtension: { value: 2.0 },
        uEigenValue: { value: 2.618 },
        uZkpProofConsistency: { value: 1.0 },
        uAssetAspect: { value: 1.0 },
        uShowPhiSteps: { value: 0.0 },
        uShowNormals: { value: 0.0 },
        uShowBlade: { value: 0.0 },
        uShowStepDepth: { value: 0.0 },
        uBladeDepthDebug: { value: 0.0 },
        uVideoTexture: { value: null },
        uHasVideo: { value: false },
        // Texture modulation uniforms
        uSaturation: { value: 1.0 },
        uBrightness: { value: 0.0 },
        uExposure: { value: 0.0 },
        uContrast: { value: 1.0 },
        uShadows: { value: 0.0 },
        uHighlights: { value: 0.0 },
        uVibrance: { value: 0.0 },
        uHue: { value: 0.0 },
        uBwFilter: { value: 0.0 }
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: true,
      depthTest: true
    });
  }

  updateUniforms(
    state: PhiPiState, 
    time: number, 
    cameraPos: THREE.Vector3, 
    mesh: THREE.Mesh, 
    assetTexture: THREE.Texture | THREE.VideoTexture | null
  ) {
    const uniforms = this.uniforms;
    if (!uniforms) return;
    
    uniforms.uTime.value = time;
    uniforms.uPhi.value = state.phi;
    uniforms.uPi.value = state.pi;
    uniforms.uPhiStepMultiplier.value = state.phiStepMultiplier;
    uniforms.uPiPrecisionThreshold.value = state.piPrecisionThreshold;
    uniforms.uMaxSteps.value = state.maxSteps;
    uniforms.uDepthScale.value = state.depthScale;
    uniforms.uMetricExtension.value = state.metricExtension;
    uniforms.uEigenValue.value = state.eigenValue;
    uniforms.uZkpProofConsistency.value = state.zkpProofConsistency;
    uniforms.uBladeDepthDebug.value = state.bladeDepthDebug;
    
    if (assetTexture && (assetTexture as any).image) {
      const img = (assetTexture as any).image;
      const w = img.videoWidth || img.width || 1;
      const h = img.videoHeight || img.height || 1;
      uniforms.uAssetAspect.value = w / h;
    }
    
    const localCam = cameraPos.clone();
    mesh.worldToLocal(localCam);
    uniforms.uLocalCameraPosition.value.copy(localCam);
    
    uniforms.uShowPhiSteps.value = state.showPhiSteps ? 1.0 : 0.0;
    uniforms.uShowNormals.value = state.showNormals ? 1.0 : 0.0;
    uniforms.uShowBlade.value = state.showBlade ? 1.0 : 0.0;
    uniforms.uShowStepDepth.value = state.showStepDepth ? 1.0 : 0.0;
    
    if (assetTexture) {
      uniforms.uVideoTexture.value = assetTexture;
      uniforms.uHasVideo.value = true;
    } else {
      uniforms.uHasVideo.value = false;
    }
    
    // Texture modulation uniforms
    uniforms.uSaturation.value = state.saturation;
    uniforms.uBrightness.value = state.brightness;
    uniforms.uExposure.value = state.exposure;
    uniforms.uContrast.value = state.contrast;
    uniforms.uShadows.value = state.shadows;
    uniforms.uHighlights.value = state.highlights;
    uniforms.uVibrance.value = state.vibrance;
    uniforms.uHue.value = state.hue;
    uniforms.uBwFilter.value = state.bwFilter;
  }

  disposeResources() {
    if (this.uniforms.uVideoTexture.value) {
      this.uniforms.uVideoTexture.value.dispose();
      this.uniforms.uVideoTexture.value = null;
    }
    this.uniforms.uHasVideo.value = false;
    this.dispose();
  }

  setBladeDepthDebug(value: number) {
    this.uniforms.uBladeDepthDebug.value = value;
  }

  setShowStepDepth(value: boolean) {
    this.uniforms.uShowStepDepth.value = value ? 1.0 : 0.0;
  }

  setShowBlade(value: boolean) {
    this.uniforms.uShowBlade.value = value ? 1.0 : 0.0;
  }
}

export { PHI, PI };
