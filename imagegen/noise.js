// noise.js — seeded PRNG and 2D value-noise fBm (dependency-free).
//
// Everything here is deterministic given a seed, so any generated image can be
// reproduced or re-rolled. Value noise is used (rather than a library) to keep
// the project hackable and offline-friendly.

/** mulberry32: tiny fast seeded PRNG. Returns a function -> [0,1). */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a string/number to a uint32 seed. */
function hashSeed(input) {
  const s = String(input);
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function smoothstep(t) {
  return t * t * (3 - 2 * t);
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * 2D value noise built on a seeded permutation table.
 * value2(x, y) -> [0,1). fbm() sums octaves for cloud-like structure.
 */
class ValueNoise {
  constructor(seed) {
    const rand = mulberry32(seed >>> 0);
    // Random gradient/value table, indexed via a shuffled permutation.
    const perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = (rand() * (i + 1)) | 0;
      const tmp = p[i];
      p[i] = p[j];
      p[j] = tmp;
    }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    this.perm = perm;
    // A random value in [0,1) for each lattice index.
    this.vals = new Float32Array(256);
    for (let i = 0; i < 256; i++) this.vals[i] = rand();
  }

  _latticeValue(ix, iy) {
    const perm = this.perm;
    const idx = perm[(perm[ix & 255] + iy) & 255];
    return this.vals[idx];
  }

  /** Value noise at (x, y) -> [0, 1). */
  value2(x, y) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = smoothstep(x - x0);
    const fy = smoothstep(y - y0);

    const v00 = this._latticeValue(x0, y0);
    const v10 = this._latticeValue(x0 + 1, y0);
    const v01 = this._latticeValue(x0, y0 + 1);
    const v11 = this._latticeValue(x0 + 1, y0 + 1);

    const top = lerp(v00, v10, fx);
    const bot = lerp(v01, v11, fx);
    return lerp(top, bot, fy);
  }

  /**
   * Fractal Brownian motion: sum octaves of noise.
   * Returns roughly [0, 1).
   */
  fbm(x, y, octaves = 6, lacunarity = 2.0, gain = 0.5) {
    let amp = 0.5;
    let freq = 1.0;
    let sum = 0;
    let norm = 0;
    for (let o = 0; o < octaves; o++) {
      sum += amp * this.value2(x * freq, y * freq);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return sum / norm;
  }
}

// Expose for the (non-module) script include in index.html.
window.ImageGenNoise = { mulberry32, hashSeed, ValueNoise, smoothstep, lerp };
