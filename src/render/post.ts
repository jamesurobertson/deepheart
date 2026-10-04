import * as THREE from 'three';

/**
 * Tilt-shift blur along one axis, with a sharp band around `focus` (screen y, 0 = bottom)
 * so the action stays crisp and only the foreground/background soften.
 */
export function tiltShift() {
  return {
    uniforms: {
      tDiffuse: { value: null as THREE.Texture | null },
      step: { value: new THREE.Vector2(0.001, 0) },
      focus: { value: 0.45 },
      band: { value: 0.18 },
      amount: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform vec2 step;
      uniform float focus, band, amount;
      varying vec2 vUv;
      void main() {
        float d = max(0.0, abs(vUv.y - focus) - band) / (1.0 - band);
        vec2 o = step * d * amount;
        vec4 s = texture2D(tDiffuse, vUv) * 0.2270;
        s += (texture2D(tDiffuse, vUv + o * 1.38) + texture2D(tDiffuse, vUv - o * 1.38)) * 0.3162;
        s += (texture2D(tDiffuse, vUv + o * 3.23) + texture2D(tDiffuse, vUv - o * 3.23)) * 0.0703;
        gl_FragColor = s;
      }`,
  };
}

/** Final grade: multiplicative vignette (never pushes below black), warm shadows, and saturation (for slow-motion moments). */
export const GradeShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    vignette: { value: 0.55 },
    warmth: { value: 0.06 },
    saturation: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float vignette, warmth, saturation;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 p = (vUv - 0.5) * vec2(1.25, 1.0);
      float v = 1.0 - vignette * smoothstep(0.25, 0.85, length(p));
      float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb += warmth * (1.0 - smoothstep(0.0, 0.35, lum)) * vec3(0.35, 0.12, -0.1);
      c.rgb = mix(vec3(lum), c.rgb, saturation);
      gl_FragColor = vec4(max(c.rgb * v, 0.0), c.a);
    }`,
};
