
import * as THREE from 'three';

const vertexShader = `
  varying vec3 vWorldPosition;
  varying vec3 vLocalPosition;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vLocalPosition = position; // Local position in [-0.5, 0.5] range
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
  uniform float uProximity;
  uniform vec3 uBioColor;
  uniform float uExcisionLevel;
  uniform float uPhiStepMultiplier;
  uniform float uPiPrecisionThreshold;
  uniform float uMaxSteps;
  uniform float uMaxDistance;
  uniform float uDepthScale;
  uniform float uMetricExtension; 
  uniform float uEigenValue;
  uniform float uBioFieldIntensity;
  uniform float uAudioReactivity;
  uniform float uManifoldType; 
  uniform float uPhantomType; 
  uniform float uCustomParams[40]; 
  
  uniform float uBass;
  uniform float uMid;
  uniform float uTreble;
  uniform float uSub;
  uniform float uRMS;
  uniform float uPitch;
  uniform float uFlux;
  uniform float uOnset;

  uniform sampler2D uVideoTexture;
  uniform bool uHasVideo;
  uniform float uUplinkExtrusion;

  uniform vec3 uCameraWorldPosition;
  uniform mat4 uInverseModelMatrix;

  uniform float uLidarMode; 
  uniform float uReconSensitivity;
  uniform float uScanSpeed;
  uniform float uProjectionFov;
  uniform bool uShowScanlines;
  uniform float uFocalAlignment;

  varying vec3 vWorldPosition;
  varying vec3 vLocalPosition;
  varying vec2 vUv;

  const float TAU = 6.28318530718;

  mat2 rot(float a) { float s = sin(a), c = cos(a); return mat2(c, -s, s, c); }
  
  float smin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
  }

  vec2 getProjectedUV(vec3 p) {
    float r = length(p);
    float theta = acos(clamp(p.y / (r + 0.0001), -1.0, 1.0));
    float phi = atan(p.z, p.x);
    return vec2(phi / TAU + 0.5 + uFocalAlignment * 0.1, theta / uPi) * uProjectionFov;
  }

  float getUplinkDisplacement(vec3 p) {
    if(!uHasVideo) return 0.0;
    vec2 uv = getProjectedUV(p);
    float luma = texture2D(uVideoTexture, uv).r;
    return luma * uUplinkExtrusion * uDepthScale * 0.05;
  }

  // --- Manifold SDFs (0.0 to 0.5 scale for unit volume) ---

  float sdFlowerOfLife19(vec3 p) {
    float d = length(p) - (0.2 + uRMS * uAudioReactivity * 0.05);
    return d - getUplinkDisplacement(p);
  }

  float sdCliffordTorus(vec3 p) {
    vec2 t = vec2(0.2, 0.05 + uSub * 0.05);
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y - getUplinkDisplacement(p);
  }

  float sdMobiusFold(vec3 p) {
    float angle = atan(p.z, p.x);
    vec2 q = vec2(length(p.xz) - 0.2, p.y);
    q *= rot(angle * 0.5 + uTime * 0.2);
    return max(abs(q.x) - 0.02, abs(q.y) - 0.1) - getUplinkDisplacement(p);
  }

  float sdSingularity(vec3 p) {
    float r = length(p);
    float d = r - (0.15 + sin(r * 20.0 - uTime * 5.0) * 0.03);
    return d - getUplinkDisplacement(p);
  }

  float sdHyperdriveUplink(vec3 p) {
    float d = length(p.xy) - (0.15 + uBass * 0.1);
    return abs(d) - 0.01 - getUplinkDisplacement(p);
  }

  float sdKleinSlice(vec3 p) {
    float d = length(p) - 0.2;
    return d - getUplinkDisplacement(p);
  }

  float sdCalabiYau(vec3 p) {
    for(int i=0; i<3; i++) {
        p = abs(p) - 0.1;
        p.xz *= rot(uTime * 0.5 + float(i));
    }
    return length(p) - 0.05 - getUplinkDisplacement(p);
  }

  float sdNeuralFractal(vec3 p) {
    float s = 1.0;
    for(int i=0; i<3; i++) {
        p = abs(p) - 0.15;
        float r2 = dot(p, p);
        float k = 1.3 / clamp(r2, 0.05, 1.0);
        p *= k; s *= k;
    }
    return (length(p) - 0.1) / s - getUplinkDisplacement(p);
  }

  float sdPhiGeodesic(vec3 p) {
    return length(p) - 0.25 - getUplinkDisplacement(p);
  }

  float sdBasicTorus(vec3 p) {
    vec2 t = vec2(0.25, 0.08);
    vec2 q = vec2(length(p.xz) - t.x, p.y);
    return length(q) - t.y - getUplinkDisplacement(p);
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
    float h = 0.001; vec2 k = vec2(1,-1);
    return normalize(k.xyy*map(p+k.xyy*h)+k.yyx*map(p+k.yyx*h)+k.yxy*map(p+k.yxy*h)+k.xxx*map(p+k.xxx*h));
  }

  void main() {
    // Transform World Ray to Local Space
    vec4 roLocal4 = uInverseModelMatrix * vec4(uCameraWorldPosition, 1.0);
    vec3 ro = roLocal4.xyz / roLocal4.w;
    
    vec4 rdWorld = vec4(normalize(vWorldPosition - uCameraWorldPosition), 0.0);
    vec3 rd = normalize((uInverseModelMatrix * rdWorld).xyz);
    
    // Ray-AABB intersection for performance and volume bounding
    float tNear = -1e9, tFar = 1e9;
    vec3 boxMin = vec3(-0.5), boxMax = vec3(0.5);
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
    
    for(int i=0; i<96; i++) {
      vec3 p = ro + rd * dO;
      float dS = map(p);
      dO += dS * uPhiStepMultiplier;
      if(dS < 0.002) { hit = true; break; }
      if(dO > tFar) break;
    }

    if(hit) {
      vec3 p = ro + rd * dO;
      vec3 n = calcNormal(p);
      
      // Transform Normal back to world for shading
      vec3 worldNormal = normalize((transpose(uInverseModelMatrix) * vec4(n, 0.0)).xyz);
      vec3 lDir = normalize(vec3(10, 20, 10) - vWorldPosition);
      
      float diff = max(dot(worldNormal, lDir), 0.0);
      float rim = pow(1.0 - max(dot(worldNormal, -normalize(vWorldPosition - uCameraWorldPosition)), 0.0), 3.0);
      
      vec3 col = uBioColor * (diff * 0.5 + 0.2) + uBioColor * rim * 1.5;
      col *= exp(-dO * 0.5); // Depth fog in local units
      gl_FragColor = vec4(col, 1.0);
    } else {
      discard;
    }
  }
`;

export class PhiPiRaymarchingMaterial extends THREE.ShaderMaterial {
  constructor() {
    super({
      uniforms: {
        uPhi: { value: 1.618033988749895 },
        uPi: { value: 3.141592653589793 },
        uTime: { value: 0 },
        uProximity: { value: 0.0 },
        uBioColor: { value: new THREE.Color(0.0, 0.45, 1.0) },
        uExcisionLevel: { value: 0.1 },
        uPhiStepMultiplier: { value: 0.5 },
        uPiPrecisionThreshold: { value: 0.001 },
        uMaxSteps: { value: 96.0 },
        uMaxDistance: { value: 100.0 },
        uDepthScale: { value: 1.2 },
        uMetricExtension: { value: 12.0 },
        uEigenValue: { value: 2.618 },
        uBioFieldIntensity: { value: 1.8 },
        uAudioReactivity: { value: 2.0 },
        uManifoldType: { value: 0.0 },
        uPhantomType: { value: 0.0 },
        uCustomParams: { value: Array(40).fill(0.5) },
        uBass: { value: 0 }, uMid: { value: 0 }, uTreble: { value: 0 }, uSub: { value: 0 }, 
        uRMS: { value: 0 }, uPitch: { value: 0 }, uFlux: { value: 0 }, uOnset: { value: 0 },
        uVideoTexture: { value: null }, uHasVideo: { value: false },
        uUplinkExtrusion: { value: 5.0 },
        uCameraWorldPosition: { value: new THREE.Vector3() },
        uInverseModelMatrix: { value: new THREE.Matrix4() },
        uLidarMode: { value: 0 }, uReconSensitivity: { value: 0.5 },
        uScanSpeed: { value: 1.0 }, uProjectionFov: { value: 1.5 },
        uShowScanlines: { value: true }, uFocalAlignment: { value: 0.0 }
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      side: THREE.FrontSide
    });
  }

  updateUniforms(state: any, time: number, mesh: THREE.Mesh, assetTexture: any) {
    const uniforms = (this as any).uniforms;
    if (!uniforms) return;
    
    uniforms.uTime.value = time || 0;
    if (state.bioColor) {
      uniforms.uBioColor.value.setRGB(state.bioColor[0], state.bioColor[1], state.bioColor[2]);
    }

    uniforms.uExcisionLevel.value = state.excisionLevel ?? 0.1;
    uniforms.uAudioReactivity.value = state.audioReactivity ?? 2.0;
    uniforms.uUplinkExtrusion.value = state.uplinkExtrusion ?? 5.0;

    const typeMap: any = { 
      'FLOWER_OF_LIFE_19': 0, 'CLIFFORD_TORUS': 1, 'MOBIUS_FOLD': 2, 'SINGULARITY': 3,
      'HYPERDRIVE_UPLINK': 4, 'KLEIN_SLICE': 5, 'CALABI_YAU': 6, 'NEURAL_FRACTAL': 7,
      'PHI_GEODESIC': 8, 'TORUS': 9 
    };
    uniforms.uManifoldType.value = typeMap[state.manifoldType] ?? 0;

    const am = state.audioMetrics || {};
    uniforms.uBass.value = am.bass || 0;
    uniforms.uMid.value = am.mid || 0;
    uniforms.uTreble.value = am.treble || 0;
    uniforms.uSub.value = am.sub || 0;
    uniforms.uRMS.value = am.rms || 0;

    // Critical: Update matrices for shader local-space conversion
    mesh.updateMatrixWorld();
    uniforms.uInverseModelMatrix.value.copy(mesh.matrixWorld).invert();

    if (assetTexture) { 
      uniforms.uVideoTexture.value = assetTexture; 
      uniforms.uHasVideo.value = true; 
    } else { 
      uniforms.uHasVideo.value = false; 
    }
  }
}
