// WebGL shader sources for the noisemorphism wallpaper demos.
// Shader bodies copied verbatim from the original shaders.js.

export const VS = `
    attribute vec2 a_pos;
    varying vec2 v_uv;
    void main() {
      v_uv = a_pos * 0.5 + 0.5;
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }
  `;

const COMMON = `
    precision highp float;
    varying vec2 v_uv;
    uniform vec2  u_res;
    uniform vec2  u_mouse;
    uniform vec2  u_mouseRaw;
    uniform float u_time;
    uniform float u_click;
    uniform float u_dpr;

    // hash: classic fast float hash
    float hash(vec2 p) {
      p = fract(p * vec2(234.34, 435.345));
      p += dot(p, p + 34.23);
      return fract(p.x * p.y);
    }
    float hash3(vec3 p) {
      p = fract(p * vec3(123.34, 456.21, 789.12));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y * p.z);
    }

    // value noise
    float vnoise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i + vec2(0,0)), hash(i + vec2(1,0)), u.x),
        mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x),
        u.y
      );
    }

    // fractal brownian motion
    float fbm(vec2 p) {
      float s = 0.0, a = 0.5;
      for (int i = 0; i < 6; i++) {
        s += a * vnoise(p);
        p *= 2.02; p += 17.0;
        a *= 0.5;
      }
      return s;
    }
    float fbm4(vec2 p) {
      float s = 0.0, a = 0.5;
      for (int i = 0; i < 4; i++) {
        s += a * vnoise(p);
        p *= 2.05; p += 11.0;
        a *= 0.5;
      }
      return s;
    }

    // domain warp: take p, offset by fbm of p
    vec2 warp(vec2 p, float amt, float t) {
      float nx = fbm4(p + vec2(0.0, t*0.05));
      float ny = fbm4(p + vec2(5.2, t*0.05 + 1.3));
      return p + amt * vec2(nx - 0.5, ny - 0.5);
    }

    // grain: per-pixel bluenoise-ish dither
    float grain(vec2 pixel, float t) {
      // time jitter for subtle animation without flickering
      float n = hash(pixel + fract(t * 0.13) * 7.7);
      // box-muller-ish for slight gaussian feel
      float n2 = hash(pixel * 1.37 + fract(t * 0.19) * 3.3);
      return (n + n2) * 0.5;
    }

    // convert RGB to working gamma (cheap linear-ish)
    vec3 tonemap(vec3 c) {
      c = clamp(c, 0.0, 1.0);
      return pow(c, vec3(0.95));
    }

    // smooth falloff 0..1 around dist
    float bump(float d, float r) {
      float x = clamp(1.0 - d / r, 0.0, 1.0);
      return x * x * (3.0 - 2.0 * x);
    }

    // aspect-corrected uv. returns uv in screen-units where 1 == short axis
    vec2 aspectUV(vec2 uv) {
      vec2 p = uv - 0.5;
      p.x *= u_res.x / u_res.y;
      return p;
    }
  `;

const MOUND_FS = COMMON + `
    // stable time-varying fbm that flows like a slow current
    float flowFbm(vec2 p, float t) {
      // domain-warp the sample with itself for turbulent-looking flow
      float n1 = fbm4(p + vec2(t * 0.18, -t * 0.11));
      float n2 = fbm4(p + vec2(-t * 0.14, t * 0.15) + n1 * 1.4);
      return n2;
    }

    void main() {
      vec2 uv = v_uv;
      vec2 p  = aspectUV(uv);
      vec2 m  = aspectUV(u_mouse);
      float t = u_time;

      // background: soft cool gradient
      vec3 bg  = mix(vec3(0.93, 0.95, 0.98), vec3(0.86, 0.90, 0.95), uv.y);
      bg = mix(bg, vec3(0.95, 0.96, 0.98), smoothstep(0.2, 0.8, 1.0 - length(p)*0.6));

      // ambient drift: lissajous + small noise wobble on the mound center
      vec2 drift = vec2(
        sin(t * 0.35) * 0.14 + sin(t * 0.8 + 1.3) * 0.05,
        cos(t * 0.28 + 0.7) * 0.10 + cos(t * 0.72) * 0.04
      );
      // mouse pulls on top of drift
      vec2 c = drift + m * 0.35;
      vec2 d = p - c;

      // flow field warps the silhouette: this is the main source of motion
      float fx = flowFbm(d * 1.6 + vec2(0.0, 3.1), t * 1.8) - 0.5;
      float fy = flowFbm(d * 1.6 + vec2(5.2, 1.3), t * 1.8 + 7.7) - 0.5;
      vec2 w  = d + 0.42 * vec2(fx, fy);

      // primary peak: squeezed anisotropically and sheared by flow
      float shear = 0.4 * sin(t * 0.48);
      vec2 ws = vec2(w.x + shear * w.y, w.y * 1.25);
      float h  = exp(-dot(ws * 1.9, ws * 1.9) * 0.55);

      // breathing amplitude: mound grows / shrinks
      float breath = 0.85 + 0.25 * sin(t * 0.7);
      h *= breath;

      // secondary lobe that orbits and fades in/out: adds asymmetry
      vec2 lobeOff = vec2(cos(t * 0.42) * 0.22, sin(t * 0.35 + 1.1) * 0.14);
      vec2 dL = p - c - lobeOff;
      float lobeFade = 0.5 + 0.5 * sin(t * 0.55 + 2.2);
      float hL = exp(-dot(dL * 3.2, dL * 3.2) * 1.1) * (0.35 * lobeFade);

      // soft base pool
      float hB = exp(-dot(d*vec2(1.1,1.5), d*vec2(1.1,1.5)) * 1.6) * 0.55;

      // tendrils: additional flow-warped fbm density to add wispiness
      float tendril = max(0.0,
        fbm4(p * 2.4 + vec2(t*0.3, -t*0.25)) - 0.55
      ) * smoothstep(0.0, 0.35, exp(-dot(d,d)*1.2));

      // color: warm red-orange palette. Base is deep terracotta, mid is
      // the default brand red-orange (#E85D4C), tip is the lighter variant
      // (#F07563). A subtle hue-shift cycles the mid between default and
      // light so it breathes.
      float hueShift = 0.5 + 0.5 * sin(t * 0.22);
      vec3 colBase = mix(vec3(0.52, 0.18, 0.16), vec3(0.62, 0.24, 0.20), hueShift); // deep terracotta
      vec3 colMid  = mix(vec3(0.910, 0.365, 0.298), vec3(0.941, 0.459, 0.388), hueShift); // #E85D4C → #F07563
      vec3 colTip  = mix(vec3(0.98, 0.72, 0.60), vec3(0.99, 0.80, 0.70), hueShift);  // peach highlight

      float yFac = smoothstep(0.0, 1.0, -ws.y * 1.2 + 0.55);
      vec3 moundCol = mix(colBase, colMid, yFac);
      moundCol = mix(moundCol, colTip, smoothstep(0.55, 1.0, h));

      // total density
      float density = clamp(h + hL + hB * 0.5 + tendril * 0.6, 0.0, 1.0);

      // grain dither
      vec2 px = gl_FragCoord.xy;
      float g = grain(px, t);
      float mask = smoothstep(0.0, 0.9, density - g * 0.85);
      float halo = smoothstep(0.0, 0.4, density) * 0.4;

      vec3 col = bg;
      col = mix(col, moundCol * 0.92, mask);
      col = mix(col, moundCol, halo * 0.4);

      // click deepens contrast
      col = mix(col, col * 0.85 + vec3(0.02, 0.04, 0.03), u_click * mask);

      col *= 1.0 - 0.12 * pow(length(p), 2.0);
      col += (g - 0.5) * 0.025;

      gl_FragColor = vec4(tonemap(col), 1.0);
    }
  `;

const NEBULA_FS = COMMON + `
    // returns density 0..1
    float nblob(vec2 p, vec2 c, float r, float tt, float seed) {
      vec2 d = p - c;
      // gentle noise offset: keep blob coherent
      float nx = fbm4(d * 1.2 + vec2(seed, tt * 0.08));
      float ny = fbm4(d * 1.2 + vec2(seed + 5.2, tt * 0.08 + 1.3));
      vec2 w = d + 0.12 * vec2(nx - 0.5, ny - 0.5);
      return exp(-dot(w, w) / (r*r));
    }

    void main() {
      vec2 uv = v_uv;
      vec2 p  = aspectUV(uv);
      vec2 m  = aspectUV(u_mouse);
      float t = u_time;

      // cream-100 bg (#FDF8F3) with a faint warm gradient
      vec3 bg = mix(vec3(0.992, 0.973, 0.953), vec3(0.976, 0.953, 0.929), uv.y);

      // 5 blobs on slow orbits
      float dens = 0.0;
      vec3 accCol = vec3(0.0);

      // attract blobs slightly toward mouse
      vec2 attract = m * 0.25;

      // blob 1: magenta
      vec2 c1 = vec2(sin(t*0.28)*0.35, cos(t*0.23)*0.25) + attract;
      float b1 = nblob(p, c1, 0.42, t, 1.1);
      accCol += vec3(0.95, 0.35, 0.60) * b1;
      dens += b1;

      // blob 2: amber
      vec2 c2 = vec2(cos(t*0.19+2.0)*0.5, sin(t*0.31+1.0)*0.3) + attract*0.7;
      float b2 = nblob(p, c2, 0.38, t, 3.3);
      accCol += vec3(0.98, 0.72, 0.30) * b2;
      dens += b2;

      // blob 3: cyan
      vec2 c3 = vec2(sin(t*0.16+4.0)*0.55, cos(t*0.24+3.0)*0.35) + attract*0.5;
      float b3 = nblob(p, c3, 0.45, t, 5.5);
      accCol += vec3(0.30, 0.78, 0.92) * b3;
      dens += b3;

      // blob 4: violet
      vec2 c4 = vec2(cos(t*0.25+6.0)*0.4, sin(t*0.18+5.0)*0.45) + attract*1.1;
      float b4 = nblob(p, c4, 0.35, t, 7.7);
      accCol += vec3(0.55, 0.40, 0.92) * b4;
      dens += b4;

      // blob 5: ember
      vec2 c5 = vec2(sin(t*0.34+1.5)*0.25, cos(t*0.21+4.0)*0.40) + attract*0.3;
      float b5 = nblob(p, c5, 0.30, t, 9.9);
      accCol += vec3(0.95, 0.45, 0.35) * b5;
      dens += b5;

      vec3 nebulaCol = accCol / max(dens, 0.001);

      // dither
      vec2 px = gl_FragCoord.xy;
      float g = grain(px, t);
      float mask = smoothstep(0.0, 0.85, dens - g * 0.6);
      float soft = clamp(dens * 0.7, 0.0, 1.0);

      // on a cream bg, blend blobs by *darkening* toward their color instead
      // of adding. Use mix with the blob color at a strength proportional
      // to density; additive would blow out to white.
      vec3 col = bg;
      col = mix(col, nebulaCol * 0.95, mask);
      col = mix(col, nebulaCol * 0.85, soft * 0.55);

      // faint dust specks (dark) scattered where density is low: reads
      // as noise flecks on cream
      float star = step(0.997, hash(px)) * (1.0 - smoothstep(0.0, 1.0, dens));
      col = mix(col, vec3(0.55, 0.45, 0.50), star * 0.35);

      // click deepens blob color slightly
      col = mix(col, col * 0.88, u_click * mask);

      col += (g - 0.5) * 0.02;
      col *= 1.0 - 0.08 * pow(length(p), 2.2);

      gl_FragColor = vec4(tonemap(col), 1.0);
    }
  `;

export interface ShaderSpec {
  id: string;
  name: string;
  fs: string;
  desc: string;
}

export const SHADERS: Record<string, ShaderSpec> = {
  mound: {
    id: 'mound',
    name: 'Mound',
    fs: MOUND_FS,
    desc: 'A noisemorphism-inspired blob of particles. Click to compact it.',
  },
  nebula: {
    id: 'nebula',
    name: 'Nebula',
    fs: NEBULA_FS,
    desc: 'Five drifting blobs that try to gather near your cursor.',
  },
};
