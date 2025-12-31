import * as THREE from 'three';

const phiTensorShader = {
  vertexShader: `
    varying vec3 vWorldPosition;
    varying vec2 vUv;
    varying vec3 vLocalPos;
    void main() {
      vUv = uv;
      vLocalPos = position;
      vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    precision highp float;
    uniform float uPhi;
    uniform float uTime;
    uniform vec3 uCameraPosition;
    uniform vec3 uLightPosition;
    uniform sampler2D uImageTexture;
    uniform bool uHasTexture;
    uniform float uAspectRatio;
    uniform int uRecursionStages;
    uniform float uRayCount;   
    uniform float uMaxBounces; 
    
    varying vec3 vWorldPosition;
    varying vec3 vLocalPos;
    varying vec2 vUv;

    mat2 rot(float a) {
      float s = sin(a), c = cos(a);
      return mat2(c, -s, s, c);
    }

    vec3 applyTensorBasis(vec3 p, float phi) {
      float stableTheta = (phi - 1.0) * 0.1; 
      p.xy *= rot(stableTheta);
      float phiScale = sqrt(phi);
      p.x /= phiScale;
      p.y *= phiScale;
      return p;
    }

    float smax(float a, float b, float k) {
      return log(exp(k * a) + exp(k * b)) / k;
    }

    float smin(float a, float b, float k) {
      float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
      return mix(b, a, h) - k * h * (1.0 - h);
    }

    float getLuma(vec2 p, float mappingScale, bool isBack) {
      float phiScale = sqrt(uPhi);
      p.x *= phiScale;
      p.y /= phiScale;
      p.xy *= rot(-(uPhi - 1.0) * 0.1);

      vec2 uv = (p / mappingScale);
      if(isBack) uv.x = -uv.x; 
      uv.x /= uAspectRatio;
      uv += 0.5;
      
      if(!uHasTexture) return 0.5;
      vec2 clampedUv = clamp(uv, 0.001, 0.999);
      vec3 tex = texture2D(uImageTexture, clampedUv).rgb;
      return 1.0 - sqrt(clamp(dot(tex, vec3(0.299, 0.587, 0.114)), 0.0, 1.0));
    }

    float baseLatticeSDF(vec3 p, float scale, out vec3 outColor, out float outLuma) {
      vec3 p_tensor = applyTensorBasis(p, uPhi);
      
      float radius = 2.15; 
      float mappingScale = 14.0;
      float smoothing = 0.5;
      float latticeScale = 1.0 / max(0.1, uAspectRatio);
      vec2 p_lat = p_tensor.xy * latticeScale;
      
      float lFront = getLuma(p_tensor.xy, mappingScale, false);
      float lBack = getLuma(p_tensor.xy, mappingScale, true);
      
      float stitch1 = mix(lFront, lBack, 0.33);
      float stitch2 = mix(lFront, lBack, 0.66);
      float masterStitch = mix(stitch1, stitch2, 0.5);
      
      outLuma = mix(p.z >= 0.0 ? lFront : lBack, masterStitch, 0.25);

      if(uHasTexture) {
        vec2 uv = (p_tensor.xy / mappingScale);
        if(p.z < 0.0) uv.x = -uv.x;
        uv.x /= uAspectRatio;
        uv += 0.5;
        outColor = texture2D(uImageTexture, clamp(uv, 0.001, 0.999)).rgb;
      } else {
        outColor = vec3(0.0, 0.95, 1.0) * 0.15;
      }
      
      float depthRange = uMaxBounces * 0.5 * scale;
      float structuralCore = 0.75 * scale; 
      
      float zFront = lFront * depthRange + structuralCore;
      float zBack = -(lBack * depthRange + structuralCore);

      vec2 r = vec2(1.0, 1.73205081); 
      vec2 h = r * 0.5;
      vec2 a = mod(p_lat, r) - h;
      vec2 b = mod(p_lat - h, r) - h;
      vec2 gv = dot(a, a) < dot(b, b) ? a : b;
      
      float d0 = length(gv) - radius;
      float d1 = length(gv - vec2(1.0, 0.0)) - radius;
      float d2 = length(gv - vec2(0.5, 0.866025)) - radius;
      float d3 = length(gv - vec2(-0.5, 0.866025)) - radius;
      
      float vesica_union = max(d0, smin(d1, smin(d2, d3, smoothing), smoothing));
      float worldVesicaD = vesica_union / latticeScale;
      
      float zDist = smax(p.z - zFront, zBack - p.z, 2.5);
      
      float sTension1 = (abs(p.z) - (stitch1 * depthRange + structuralCore)) * 0.85;
      float sTension2 = (abs(p.z) - (stitch2 * depthRange + structuralCore)) * 0.85;
      
      float reinforcedZ = smax(zDist, smin(sTension1, sTension2, 1.2), 1.6);
      float finalD = smax(worldVesicaD, reinforcedZ, 2.2);
      
      return smax(finalD, length(p) - 23.0, 1.5);
    }

    float manifoldSDF(vec3 p, out vec3 outColor, out float outLuma) {
      vec3 col;
      float lum;
      float d = baseLatticeSDF(p, 1.0, col, lum);
      outColor = col;
      outLuma = lum;
      
      if(uRecursionStages > 1) {
          float s = 1.0;
          vec3 p_curr = p;
          int stages = clamp(uRecursionStages, 2, 6);
          for(int i = 0; i < 5; i++) {
            if(i >= stages - 1) break;
            
            float scission = (uPhi - 1.0) * 0.4;
            
            p_curr += normalize(p_curr) * d * scission;
            s /= uPhi;
            vec3 c1; float l1;
            float d1 = baseLatticeSDF(p_curr / s, s, c1, l1) * s;
            
            vec3 p_backstitch = p_curr - normalize(p_curr) * d1 * scission * 0.5;
            vec3 c2; float l2;
            float d2 = baseLatticeSDF(p_backstitch / s, s, c2, l2) * s;
            
            float di = smin(d1, d2, 0.1);
            if(di < d) {
              float blend = clamp(0.5 * (d - di) / 0.1, 0.0, 1.0);
              d = smin(d, di, 0.1);
              outColor = mix(outColor, mix(c1, c2, 0.5), blend * 0.5);
              outLuma = mix(outLuma, mix(l1, l2, 0.5), blend * 0.5);
            }
          }
      }
      return d * 0.6; 
    }

    void main() {
      vec3 ro = uCameraPosition;
      vec3 rd = normalize(vWorldPosition - uCameraPosition);
      
      float t = 0.0;
      float stepFactor = 0.65;
      bool hit = false;
      vec3 hitColor = vec3(0.0);
      float hitLuma = 0.0;
      
      float b = length(ro) - 26.0;
      if(b > 0.0) t = b;

      for(int i = 0; i < 320; i++) {
        vec3 p = ro + rd * t;
        float d = manifoldSDF(p, hitColor, hitLuma);
        if(d < 0.0006) { 
          hit = true;
          break;
        }
        t += d * stepFactor;
        stepFactor = max(0.001, stepFactor / (1.0 + (uPhi - 1.0) * 0.05));
        if(t > 180.0) break;
      }

      vec3 color = vec3(0.0, 0.02, 0.03);

      if(hit) {
        vec3 p = ro + rd * t;
        vec3 dummyCol; float dummyLum;
        float eps = mix(0.00008, 0.003, clamp(t / 140.0, 0.0, 1.0));
        
        vec3 n = normalize(vec3(
          manifoldSDF(p + vec3(eps, 0, 0), dummyCol, dummyLum) - manifoldSDF(p - vec3(eps, 0, 0), dummyCol, dummyLum),
          manifoldSDF(p + vec3(0, eps, 0), dummyCol, dummyLum) - manifoldSDF(p - vec3(0, eps, 0), dummyCol, dummyLum),
          manifoldSDF(p + vec3(0, 0, eps), dummyCol, dummyLum) - manifoldSDF(p - vec3(0, 0, eps), dummyCol, dummyLum)
        ));

        vec3 lPos = uLightPosition;
        vec3 lDir = normalize(lPos - p);
        float diff = max(dot(n, lDir), 0.0);
        float spec = pow(max(dot(reflect(-lDir, n), -rd), 0.0), 90.0);
        float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 4.0);

        float translucency = pow(max(0.0, 1.0 - hitLuma), 4.0) * 0.7;

        color = hitColor * (diff + 0.35 + translucency);
        color += vec3(0.0, 0.95, 1.0) * spec * 1.8;
        color += hitColor * fresnel * 4.5;
        color.g += fresnel * 0.06 * sin(uTime * 0.4);
        color.b += fresnel * 0.06 * cos(uTime * 0.4);
      }

      color = mix(color, vec3(0.0, 0.015, 0.02), 1.0 - exp(-t * 0.012));
      gl_FragColor = vec4(pow(color, vec3(0.4545)), 1.0);
    }
  `
};

export class PhiTensorRaymarchingMaterial extends THREE.ShaderMaterial {
  public uniforms: { [key: string]: THREE.IUniform };
  constructor() {
    const uniforms = {
      uPhi: { value: 1.017 },
      uTime: { value: 0 },
      uCameraPosition: { value: new THREE.Vector3() },
      uLightPosition: { value: new THREE.Vector3(30, 40, 30) },
      uImageTexture: { value: null },
      uHasTexture: { value: false },
      uAspectRatio: { value: 1.0 },
      uRecursionStages: { value: 1 },
      uRayCount: { value: 64.0 },
      uMaxBounces: { value: 20.0 }
    };
    super({
      uniforms,
      vertexShader: phiTensorShader.vertexShader,
      fragmentShader: phiTensorShader.fragmentShader,
      side: THREE.DoubleSide,
      transparent: true,
      depthWrite: true,
      depthTest: true
    });
    this.uniforms = uniforms;
  }
}
