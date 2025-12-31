import * as THREE from 'three';

const vertexShader = `
  varying vec3 vWorldPosition;
  varying vec3 vLocalPosition;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vLocalPosition = position;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = `
  precision highp float;

  uniform float uPhi;
  uniform float uPi;
  uniform float uTime;
  uniform vec3 uBioColor;
  uniform float uExcisionLevel;
  uniform float uPhiStepMultiplier;
  uniform float uPiPrecisionThreshold;
  uniform float uMaxSteps;
  uniform float uDepthScale;
  uniform float uMetricExtension; 
  uniform float uEigenValue;
  uniform float uAudioReactivity;
  uniform float uManifoldType; 
  
  uniform float uBass;
  uniform float uMid;
  uniform float uTreble;
  uniform float uSub;
  uniform float uRMS;
  uniform float uOnset;

  uniform sampler2D uVideoTexture;
  uniform bool uHasVideo;
  uniform float uUplinkExtrusion;
  uniform float uBijectiveStrength;

  uniform vec3 uCameraWorldPosition;
  uniform mat4 uInverseModelMatrix;

  uniform bool uShowScanlines;
  uniform float uScanSpeed;
  uniform float uProjectionFov;
  uniform float uFocalAlignment;

  uniform vec3 uEnvSkyColor;
  uniform vec3 uEnvFogColor;
  uniform float uEnvLightIntensity;
  uniform float uEnvAmbientIntensity;
  uniform float uEnvGridScale;
  uniform float uEnvAudioReactivity;

  varying vec3 vWorldPosition;
  varying vec3 vLocalPosition;
  varying vec2 vUv;

  const float TAU = 6.28318530718;
  const float PHI = 1.618033988749895;

  mat2 rot(float a) { float s = sin(a), c = cos(a); return mat2(c, -s, s, c); }
  
  float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
  }

  float smootherstep(float edge0, float edge1, float x) {
    x = clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
    return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
  }

  vec2 getProjectedUV(vec3 p) {
    float r = length(p);
    float theta = acos(clamp(p.y / (r + 0.0001), -1.0, 1.0));
    float phi = atan(p.z, p.x);
    float smoothTime = uTime * 0.1;
    float uvShift = sin(smoothTime) * 0.02;
    vec2 uv = vec2(phi / TAU + 0.5 + uvShift, theta / uPi);
    uv = vec2(1.0 - uv.x, 1.0 - uv.y);
    return uv;
  }

  vec2 getPlanarUV(vec3 p) {
    return vec2(p.x + 0.5, p.y + 0.5);
  }

  vec2 getCylindricalUV(vec3 p) {
    float angle = atan(p.z, p.x);
    return vec2(angle / TAU + 0.5, p.y + 0.5);
  }

  float detectSkinTone(vec3 rgb) {
    float r = rgb.r, g = rgb.g, b = rgb.b;
    float y = 0.299 * r + 0.587 * g + 0.114 * b;
    float cr = 0.5 + 0.5 * (r - y) / 0.5;
    float cb = 0.5 + 0.5 * (b - y) / 0.5;
    bool isSkin = (cr > 0.45 && cr < 0.75) && (cb > 0.2 && cb < 0.45);
    return isSkin ? 1.5 : 1.0;
  }

  float getBijectiveDisplacement(vec3 p) {
    if(!uHasVideo) return 0.0;
    
    vec2 uvSphere = getProjectedUV(p);
    vec2 uvPlanar = getPlanarUV(p);
    
    float blendFactor = smootherstep(0.0, 1.0, 0.5 + sin(uTime * 0.3) * 0.2);
    vec2 uv = mix(uvSphere, uvPlanar, blendFactor * 0.3);
    uv = clamp(uv, 0.001, 0.999);
    
    vec4 texColor = texture2D(uVideoTexture, uv);
    float luma = texColor.r * 0.299 + texColor.g * 0.587 + texColor.b * 0.114;
    
    float skinMod = detectSkinTone(texColor.rgb);
    
    float smoothAudio = smootherstep(0.0, 1.0, uRMS);
    float smoothBass = smootherstep(0.0, 1.0, uBass);
    float smoothOnset = uOnset * 0.5;
    float audioMod = 1.0 + smoothAudio * 1.5 + smoothBass * 1.0 + smoothOnset;
    
    float breathe = 1.0 + sin(uTime * 0.8) * 0.15 + sin(uTime * 1.3) * 0.08;
    
    float rawDisplacement = luma * skinMod * audioMod * breathe;
    
    float bijectiveExtrusion = uUplinkExtrusion * uBijectiveStrength * uDepthScale;
    
    return rawDisplacement * bijectiveExtrusion * 0.4;
  }

  float getDetailDisplacement(vec3 p) {
    if(!uHasVideo) return 0.0;
    
    vec2 uv = getProjectedUV(p);
    uv = clamp(uv, 0.001, 0.999);
    
    float offset = 0.008 + sin(uTime * 0.5) * 0.002;
    
    vec4 c00 = texture2D(uVideoTexture, uv + vec2(-offset, -offset));
    vec4 c10 = texture2D(uVideoTexture, uv + vec2( offset, -offset));
    vec4 c01 = texture2D(uVideoTexture, uv + vec2(-offset,  offset));
    vec4 c11 = texture2D(uVideoTexture, uv + vec2( offset,  offset));
    
    float l00 = dot(c00.rgb, vec3(0.299, 0.587, 0.114));
    float l10 = dot(c10.rgb, vec3(0.299, 0.587, 0.114));
    float l01 = dot(c01.rgb, vec3(0.299, 0.587, 0.114));
    float l11 = dot(c11.rgb, vec3(0.299, 0.587, 0.114));
    
    float edgeX = abs(l10 - l00) + abs(l11 - l01);
    float edgeY = abs(l01 - l00) + abs(l11 - l10);
    float edge = (edgeX + edgeY) * 0.5;
    
    float pulse = 1.0 + sin(uTime * 2.0 + length(p) * 5.0) * 0.2;
    
    return edge * uBijectiveStrength * 0.25 * pulse;
  }

  float getEnvironmentGridModulation(vec3 p) {
    float gridSize = 1.0 / max(uEnvGridScale, 0.01);
    float gridDist = min(
      min(mod(p.x * gridSize, 1.0), 1.0 - mod(p.x * gridSize, 1.0)),
      min(mod(p.y * gridSize, 1.0), 1.0 - mod(p.y * gridSize, 1.0))
    );
    float gridEffect = smoothstep(0.0, 0.05, gridDist);
    return mix(1.0, 0.8, 1.0 - gridEffect) * uEnvLightIntensity;
  }

  float getEnvironmentAudioDeformation(vec3 p) {
    float audioMod = (uBass * 0.4 + uMid * 0.3 + uTreble * 0.2 + uRMS * 0.1) * uEnvAudioReactivity;
    float waveMod = sin(length(p) * 10.0 - uTime * 2.0 * uEnvAudioReactivity) * 0.02;
    return audioMod * waveMod;
  }

  vec3 getEnvironmentAmbientColor(vec3 p) {
    vec3 skyGlow = uEnvSkyColor * uEnvAmbientIntensity;
    vec3 fogGlow = uEnvFogColor * 0.5;
    float height = p.y * 0.5 + 0.5;
    return mix(fogGlow, skyGlow, smoothstep(0.0, 1.0, height));
  }

  float sdBijectiveManifold(vec3 p, float baseRadius) {
    float displacement = getBijectiveDisplacement(p);
    float detail = getDetailDisplacement(p);
    
    float smoothRMS = smootherstep(0.0, 1.0, uRMS);
    float audioExcision = uExcisionLevel * (1.0 + smoothRMS * uAudioReactivity * 0.5);
    
    float d = length(p) - baseRadius;
    
    d -= displacement;
    d -= detail;
    
    float wave = sin(length(p) * 15.0 - uTime * 2.0) * 0.015;
    d += audioExcision * wave;
    
    float envAudioDef = getEnvironmentAudioDeformation(p);
    d += envAudioDef * getEnvironmentGridModulation(p);
    
    return d;
  }

  float sdFlowerOfLife19(vec3 p) {
    float smoothAudio = smootherstep(0.0, 1.0, uRMS * uAudioReactivity);
    float smoothBass = smootherstep(0.0, 1.0, uBass);
    float baseRadius = 0.25 + smoothAudio * 0.1 + smoothBass * 0.08;
    return sdBijectiveManifold(p, baseRadius);
  }

  float sdCliffordTorus(vec3 p) {
    float displacement = getBijectiveDisplacement(p);
    float smoothBass = smootherstep(0.0, 1.0, uBass);
    float smoothSub = smootherstep(0.0, 1.0, uSub);
    vec2 t = vec2(0.22 + smoothBass * 0.04, 0.08 + smoothSub * 0.03);
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    float d = length(q) - t.y;
    return d - displacement - getDetailDisplacement(p);
  }

  float sdMobiusFold(vec3 p) {
    float displacement = getBijectiveDisplacement(p);
    float angle = atan(p.z, p.x);
    float smoothTime = uTime * 0.12;
    vec2 q = vec2(length(p.xz) - 0.22, p.y);
    q *= rot(angle * 0.5 + smoothTime);
    float d = max(abs(q.x) - 0.03, abs(q.y) - 0.15);
    d = d - displacement + getEnvironmentAudioDeformation(p) * 0.015;
    return d;
  }

  float sdSingularity(vec3 p) {
    float displacement = getBijectiveDisplacement(p);
    float r = length(p);
    float smoothMid = smootherstep(0.0, 1.0, uMid);
    float smoothBass = smootherstep(0.0, 1.0, uBass);
    float wave = sin(r * 20.0 - uTime * 3.0) * (0.025 + smoothMid * 0.015);
    float d = r - (0.2 + wave + smoothBass * 0.06);
    d = d - displacement + getEnvironmentAudioDeformation(p) * (0.2 / (r + 0.1));
    return d;
  }

  float sdHyperdriveUplink(vec3 p) {
    float displacement = getBijectiveDisplacement(p);
    float smoothBass = smootherstep(0.0, 1.0, uBass);
    float smoothTreble = smootherstep(0.0, 1.0, uTreble);
    float d = length(p.xy) - (0.2 + smoothBass * 0.1);
    float tube = abs(d) - (0.02 + smoothTreble * 0.008);
    tube = tube - displacement + getEnvironmentAudioDeformation(p) * 0.01;
    return tube;
  }

  float sdKleinSlice(vec3 p) {
    float displacement = getBijectiveDisplacement(p);
    float breathe = 1.0 + sin(uTime * 0.6) * 0.05;
    float d = length(p) - 0.25 * breathe;
    d = d - displacement + getEnvironmentAudioDeformation(p) * getEnvironmentGridModulation(p) * 0.015;
    return d;
  }

  float sdCalabiYau(vec3 p) {
    float displacement = getBijectiveDisplacement(p);
    float smoothMid = smootherstep(0.0, 1.0, uMid);
    vec3 q = p;
    for(int i=0; i<3; i++) {
        q = abs(q) - 0.12;
        float rotSpeed = 0.3 + smoothMid * 0.2;
        q.xz *= rot(uTime * rotSpeed + float(i) * 0.5);
    }
    float d = length(q) - 0.08;
    d = d - displacement + getEnvironmentAudioDeformation(p) * 0.008;
    return d;
  }

  float sdNeuralFractal(vec3 p) {
    float displacement = getBijectiveDisplacement(p);
    float s = 1.0;
    vec3 q = p;
    for(int i=0; i<4; i++) {
        q = abs(q) - 0.14;
        float r2 = dot(q, q);
        float k = 1.25 / clamp(r2, 0.04, 1.0);
        q *= k; s *= k;
    }
    float d = (length(q) - 0.1) / s;
    d = d - displacement * 0.5 + getEnvironmentAudioDeformation(p) * 0.01;
    return d;
  }

  float sdPhiGeodesic(vec3 p) {
    float displacement = getBijectiveDisplacement(p);
    float breathe = 1.0 + sin(uTime * 0.5) * 0.06;
    float d = length(p) - 0.3 * breathe;
    float patternSpeed = uTime * 0.3;
    float pattern = sin(p.x * PHI * 8.0 + patternSpeed) * sin(p.y * PHI * 8.0 + patternSpeed) * sin(p.z * PHI * 8.0 + patternSpeed) * 0.025;
    d = d + pattern - displacement + getEnvironmentAudioDeformation(p) * 0.012;
    return d;
  }

  float sdBasicTorus(vec3 p) {
    float displacement = getBijectiveDisplacement(p);
    float detail = getDetailDisplacement(p);
    float smoothBass = smootherstep(0.0, 1.0, uBass);
    float smoothSub = smootherstep(0.0, 1.0, uSub);
    float breathe = 1.0 + sin(uTime * 0.7) * 0.04;
    vec2 t = vec2((0.28 + smoothBass * 0.06) * breathe, 0.1 + smoothSub * 0.04);
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    float d = length(q) - t.y;
    d = d - displacement - detail + getEnvironmentAudioDeformation(p) * 0.018;
    return d;
  }

  float map(vec3 p) {
    int type = int(uManifoldType);
    if (type == 0) return sdFlowerOfLife19(p);
    if (type == 1) return sdCliffordTorus(p);
    if (type == 2) return sdMobiusFold(p);
    if (type == 3) return sdSingularity(p);
    if (type == 4) return sdHyperdriveUplink(p);
    if (type == 5) return sdKleinSlice(p);
    if (type == 6) return sdCalabiYau(p);
    if (type == 7) return sdNeuralFractal(p);
    if (type == 8) return sdPhiGeodesic(p);
    if (type == 9) return sdBasicTorus(p);
    return 10.0;
  }

  vec3 calcNormal(vec3 p) {
    float h = 0.0005;
    vec2 k = vec2(1,-1);
    return normalize(
      k.xyy*map(p+k.xyy*h)+
      k.yyx*map(p+k.yyx*h)+
      k.yxy*map(p+k.yxy*h)+
      k.xxx*map(p+k.xxx*h)
    );
  }

  vec3 getTextureColor(vec3 p) {
    if(!uHasVideo) return uBioColor;
    vec2 uv = getProjectedUV(p);
    uv = clamp(uv, 0.001, 0.999);
    vec3 texColor = texture2D(uVideoTexture, uv).rgb;
    float blend = 0.9;
    float glowPulse = 1.0 + sin(uTime * 1.5) * 0.3 + sin(uTime * 2.3) * 0.15;
    vec3 glowingBioColor = uBioColor * glowPulse * 1.4;
    return mix(glowingBioColor, texColor, blend);
  }

  void main() {
    vec4 roLocal4 = uInverseModelMatrix * vec4(uCameraWorldPosition, 1.0);
    vec3 ro = roLocal4.xyz / roLocal4.w;
    
    vec4 rdWorld = vec4(normalize(vWorldPosition - uCameraWorldPosition), 0.0);
    vec3 rd = normalize((uInverseModelMatrix * rdWorld).xyz);
    
    float tNear = -1e9, tFar = 1e9;
    vec3 boxMin = vec3(-1.0), boxMax = vec3(1.0);
    for (int i = 0; i < 3; i++) {
        float invDir = 1.0 / rd[i];
        float t1 = (boxMin[i] - ro[i]) * invDir;
        float t2 = (boxMax[i] - ro[i]) * invDir;
        tNear = max(tNear, min(t1, t2));
        tFar = min(tFar, max(t1, t2));
    }

    if (tFar < tNear || tFar < 0.0) discard;
    float dO = max(tNear, 0.0);
    bool hit = false;
    
    int maxIter = int(uMaxSteps);
    for(int i=0; i<128; i++) {
      if(i >= maxIter) break;
      vec3 p = ro + rd * dO;
      float dS = map(p);
      dO += dS * uPhiStepMultiplier;
      if(dS < uPiPrecisionThreshold) { hit = true; break; }
      if(dO > tFar) break;
    }

    if(hit) {
      vec3 p = ro + rd * dO;
      vec3 n = calcNormal(p);
      
      vec3 worldNormal = normalize((transpose(uInverseModelMatrix) * vec4(n, 0.0)).xyz);
      vec3 lDir = normalize(vec3(8.0, 15.0, 10.0) - vWorldPosition);
      
      float diff = max(dot(worldNormal, lDir), 0.0);
      float spec = pow(max(dot(reflect(-lDir, worldNormal), -rd), 0.0), 32.0);
      float rim = pow(1.0 - max(dot(worldNormal, -rd), 0.0), 2.5);
      
      vec3 baseColor = getTextureColor(p);
      
      float smoothRMS = smootherstep(0.0, 1.0, uRMS);
      float audioGlow = smoothRMS * 0.4 + uOnset * 0.2;
      
      vec3 envAmbient = getEnvironmentAmbientColor(p);
      vec3 col = baseColor * (diff * 0.6 + 0.3 + audioGlow * 0.15);
      col += vec3(1.0) * spec * 0.25;
      col += baseColor * rim * (1.0 + audioGlow * 0.5);
      col = mix(col, col * envAmbient, 0.3);
      col *= exp(-dO * 0.25);
      
      if(uShowScanlines) {
        float scanline = sin(p.y * 60.0 + uTime * uScanSpeed * 5.0) * 0.5 + 0.5;
        col *= 0.94 + scanline * 0.06;
      }
      
      gl_FragColor = vec4(col, 1.0);
    } else {
      discard;
    }
  }
`;

export class PhiPiRaymarchingMaterial extends THREE.ShaderMaterial {
  private isMobile: boolean;

  constructor(isMobileOverride?: boolean) {
    const isMobile = isMobileOverride ?? /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const maxStepsValue = isMobile ? 32.0 : 64.0;
    const phiStepMultiplier = isMobile ? 0.8 : 0.5;
    const precisionThreshold = isMobile ? 0.002 : 0.001;

    super({
      uniforms: {
        uPhi: { value: 1.618033988749895 },
        uPi: { value: 3.141592653589793 },
        uTime: { value: 0 },
        uBioColor: { value: new THREE.Color(0.0, 0.45, 1.0) },
        uExcisionLevel: { value: 0.05 },
        uPhiStepMultiplier: { value: phiStepMultiplier },
        uPiPrecisionThreshold: { value: precisionThreshold },
        uMaxSteps: { value: maxStepsValue },
        uDepthScale: { value: 2.0 },
        uMetricExtension: { value: 12.0 },
        uEigenValue: { value: 2.618 },
        uAudioReactivity: { value: 3.0 },
        uManifoldType: { value: 0.0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uTreble: { value: 0 },
        uSub: { value: 0 },
        uRMS: { value: 0 },
        uOnset: { value: 0 },
        uVideoTexture: { value: null },
        uHasVideo: { value: false },
        uUplinkExtrusion: { value: 1.0 },
        uBijectiveStrength: { value: 1.0 },
        uCameraWorldPosition: { value: new THREE.Vector3() },
        uInverseModelMatrix: { value: new THREE.Matrix4() },
        uScanSpeed: { value: 1.0 },
        uProjectionFov: { value: 1.0 },
        uShowScanlines: { value: true },
        uFocalAlignment: { value: 0.0 },
        uEnvSkyColor: { value: new THREE.Color(0.02, 0.05, 0.15) },
        uEnvFogColor: { value: new THREE.Color(0.0, 0.3, 1.0) },
        uEnvLightIntensity: { value: 1.5 },
        uEnvAmbientIntensity: { value: 0.6 },
        uEnvGridScale: { value: 0.5 },
        uEnvAudioReactivity: { value: 2.5 }
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      side: THREE.FrontSide
    });
    
    this.isMobile = isMobile;
  }

  bindTexture(texture: THREE.Texture | null) {
    if (texture) {
      this.uniforms.uVideoTexture.value = texture;
      this.uniforms.uHasVideo.value = true;
      if (texture instanceof THREE.VideoTexture) {
        texture.needsUpdate = true;
      }
    } else {
      this.uniforms.uVideoTexture.value = null;
      this.uniforms.uHasVideo.value = false;
    }
  }

  updateUniforms(
    params: {
      bioColor?: [number, number, number];
      manifoldType?: string;
      audioMetrics?: { bass?: number; mid?: number; treble?: number; sub?: number; rms?: number; onset?: boolean };
      depthScale?: number;
      uplinkExtrusion?: number;
      bijectiveStrength?: number;
      audioReactivity?: number;
      excisionLevel?: number;
      envSkyColor?: [number, number, number];
      envFogColor?: [number, number, number];
      envLightIntensity?: number;
      envAmbientIntensity?: number;
      envGridScale?: number;
      envAudioReactivity?: number;
    },
    time: number,
    mesh: THREE.Mesh,
    texture: THREE.Texture | null
  ) {
    const uniforms = this.uniforms;
    
    uniforms.uTime.value = time;
    
    if (params.bioColor) {
      uniforms.uBioColor.value.setRGB(params.bioColor[0], params.bioColor[1], params.bioColor[2]);
    }

    uniforms.uExcisionLevel.value = params.excisionLevel ?? 0.05;
    uniforms.uAudioReactivity.value = params.audioReactivity ?? 3.0;
    uniforms.uUplinkExtrusion.value = params.uplinkExtrusion ?? 1.0;
    uniforms.uBijectiveStrength.value = params.bijectiveStrength ?? 1.0;
    uniforms.uDepthScale.value = params.depthScale ?? 2.0;

    const typeMap: Record<string, number> = { 
      'FLOWER_OF_LIFE_19': 0, 
      'CLIFFORD_TORUS': 1, 
      'MOBIUS_FOLD': 2, 
      'SINGULARITY': 3,
      'HYPERDRIVE_UPLINK': 4, 
      'KLEIN_SLICE': 5, 
      'CALABI_YAU': 6, 
      'NEURAL_FRACTAL': 7,
      'PHI_GEODESIC': 8, 
      'TORUS': 9 
    };
    uniforms.uManifoldType.value = typeMap[params.manifoldType || 'FLOWER_OF_LIFE_19'] ?? 0;

    const am = params.audioMetrics || {};
    uniforms.uBass.value = am.bass || 0;
    uniforms.uMid.value = am.mid || 0;
    uniforms.uTreble.value = am.treble || 0;
    uniforms.uSub.value = am.sub || 0;
    uniforms.uRMS.value = am.rms || 0;
    uniforms.uOnset.value = am.onset ? 1.0 : 0.0;

    if (params.envSkyColor) {
      uniforms.uEnvSkyColor.value.setRGB(params.envSkyColor[0], params.envSkyColor[1], params.envSkyColor[2]);
    }
    if (params.envFogColor) {
      uniforms.uEnvFogColor.value.setRGB(params.envFogColor[0], params.envFogColor[1], params.envFogColor[2]);
    }
    uniforms.uEnvLightIntensity.value = params.envLightIntensity ?? 1.5;
    uniforms.uEnvAmbientIntensity.value = params.envAmbientIntensity ?? 0.6;
    uniforms.uEnvGridScale.value = params.envGridScale ?? 0.5;
    uniforms.uEnvAudioReactivity.value = params.envAudioReactivity ?? 2.5;

    mesh.updateMatrixWorld();
    uniforms.uInverseModelMatrix.value.copy(mesh.matrixWorld).invert();

    this.bindTexture(texture);
  }
}
