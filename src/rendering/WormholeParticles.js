export const WORMHOLE_PARTICLE_DEFAULTS = {
  count:         80,    // particles per wormhole
  spawnMult:     1.55,  // spawn ring = visualRing * spawnMult
  voidMult:      0.18,  // despawn when r < visualRing * voidMult
  angularSpeed:  1.1,   // base radians/sec at spawn radius
  momentumExp:   1.7,   // angSpeed scales as (spawnR/r)^momentumExp
  inwardFrac:    0.20,  // inward speed = visualRing * inwardFrac per second
  blobMult:      0.26,  // blob radius = visualRing * blobMult at spawn
  blobMinMult:   0.06,  // minimum blob radius near centre
  alphaMax:      0.18,  // max particle opacity
  alphaFadeMult: 0.40,  // fade starts when r < visualRing * alphaFadeMult
  hueRange:      35,    // ± degrees of per-particle colour jitter
  glowLayers:    2,     // concentric gradient passes per blob (gradient mode only)
  arms:          2,     // number of spiral arms (0 = uniform)
  armSpread:     0.55,  // angular std-dev around each arm in radians
  armRotSpeed:   0.08,  // arm rotation speed in radians/sec
};

function gaussRand() {
  // Box-Muller transform — returns a standard normal sample
  let u, v;
  do { u = Math.random(); } while (u === 0);
  do { v = Math.random(); } while (v === 0);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function hsvToRgb(h, s, v) {
  h = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = v - c;
  let r, g, b;
  if      (h < 60)  { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if      (max === r) h = ((g - b) / d + 6) % 6 * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else                h = ((r - g) / d + 4) * 60;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

export class WormholeParticles {
  constructor(planet, config = {}) {
    this._cfg     = { ...WORMHOLE_PARTICLE_DEFAULTS, ...config };
    this._planet  = planet;
    this._angles  = new Float32Array(this._cfg.count);
    this._radii   = new Float32Array(this._cfg.count);
    this._hueOff  = new Float32Array(this._cfg.count);
    this._colR    = new Float32Array(this._cfg.count);
    this._colG    = new Float32Array(this._cfg.count);
    this._colB    = new Float32Array(this._cfg.count);
    this._lastT   = null;
    this._armAngle = Math.random() * Math.PI * 2;

    const [pr, pg, pb] = planet.colour;
    this._baseHSV = rgbToHsv(pr, pg, pb);

    const cfg = this._cfg;
    for (let i = 0; i < cfg.count; i++) {
      this._angles[i] = this._spawnAngle();
      this._radii[i]  = 0; // set properly on first update via _respawn
      this._setParticleColour(i);
    }
  }

  _spawnAngle() {
    const cfg = this._cfg;
    if (!cfg.arms) return Math.random() * Math.PI * 2;
    const arm = Math.floor(Math.random() * cfg.arms);
    const armBase = this._armAngle + (arm / cfg.arms) * Math.PI * 2;
    return armBase + gaussRand() * cfg.armSpread;
  }

  _setParticleColour(i) {
    const cfg = this._cfg;
    this._hueOff[i] = (Math.random() * 2 - 1) * cfg.hueRange;
    const [h, s, v] = this._baseHSV;
    const [cr, cg, cb] = hsvToRgb(h + this._hueOff[i], s, Math.min(1, v + 0.15));
    this._colR[i] = cr;
    this._colG[i] = cg;
    this._colB[i] = cb;
  }

  _respawn(i, spawnR, voidR) {
    this._angles[i] = this._spawnAngle();
    this._radii[i]  = voidR + Math.random() * (spawnR - voidR);
    this._setParticleColour(i);
  }

  update(nowSec) {
    if (this._lastT === null) {
      this._lastT = nowSec;
      const cfg    = this._cfg;
      const conv   = this._conv ?? 1;
      const planet = this._planet;
      const visualR = Math.max(4, planet.radius * 1.8 * conv);
      const spawnR  = visualR * cfg.spawnMult;
      const voidR   = visualR * cfg.voidMult;
      for (let i = 0; i < cfg.count; i++) this._respawn(i, spawnR, voidR);
      return;
    }
    const dt = Math.min(nowSec - this._lastT, 0.1);
    this._lastT    = nowSec;
    this._armAngle += this._cfg.armRotSpeed * dt;

    const cfg     = this._cfg;
    const conv    = this._conv ?? 1;
    const planet  = this._planet;
    const visualR = Math.max(4, planet.radius * 1.8 * conv);
    const spawnR  = visualR * cfg.spawnMult;
    const voidR   = visualR * cfg.voidMult;
    const inward  = visualR * cfg.inwardFrac;

    for (let i = 0; i < cfg.count; i++) {
      let r = this._radii[i];
      if (r <= voidR) { this._respawn(i, spawnR, voidR); continue; }
      const angV = cfg.angularSpeed * Math.pow(spawnR / r, cfg.momentumExp);
      this._angles[i] += angV * dt;
      this._radii[i]   = r - inward * dt;
    }
  }

  draw(ctx, conv, useCircles = false) {
    this._conv = conv;
    const cfg     = this._cfg;
    const planet  = this._planet;
    const cx      = planet.position.x * conv;
    const cy      = planet.position.y * conv;
    const visualR = Math.max(4, planet.radius * 1.8 * conv);
    const spawnR  = visualR * cfg.spawnMult;
    const voidR   = visualR * cfg.voidMult;
    const blobFull = visualR * cfg.blobMult;
    const blobMin  = visualR * cfg.blobMinMult;

    for (let i = 0; i < cfg.count; i++) {
      const r = this._radii[i];
      if (r <= voidR) continue;

      const t     = (r - voidR) / (spawnR - voidR);
      const blobR = blobMin + (blobFull - blobMin) * t;
      const fadeT = Math.min(1, r / (visualR * cfg.alphaFadeMult));
      const alpha = cfg.alphaMax * fadeT;

      const px = cx + Math.cos(this._angles[i]) * r;
      const py = cy + Math.sin(this._angles[i]) * r;

      const cr = this._colR[i];
      const cg = this._colG[i];
      const cb = this._colB[i];

      if (useCircles) {
        // Halo + core: large dim outer circle + small bright inner circle
        ctx.fillStyle = `rgb(${Math.round(cr)},${Math.round(cg)},${Math.round(cb)})`;
        ctx.globalAlpha = alpha * 0.35;
        ctx.beginPath();
        ctx.arc(px, py, blobR * 1.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(px, py, blobR * 0.45, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Original: concentric radial gradients for soft cloud look
        for (let layer = cfg.glowLayers - 1; layer >= 0; layer--) {
          const scale  = 1 + layer * 0.7;
          const layerA = alpha * (1 - layer * 0.45);
          const grad = ctx.createRadialGradient(px, py, 0, px, py, blobR * scale);
          if (layer === 0) {
            grad.addColorStop(0,   `rgba(${Math.min(255,cr+60)},${Math.min(255,cg+50)},${Math.min(255,cb+40)},${layerA})`);
            grad.addColorStop(0.4, `rgba(${cr},${cg},${cb},${layerA * 0.7})`);
            grad.addColorStop(1,   `rgba(${cr},${cg},${cb},0)`);
          } else {
            grad.addColorStop(0,   `rgba(${cr},${cg},${cb},${layerA * 0.5})`);
            grad.addColorStop(1,   `rgba(${cr},${cg},${cb},0)`);
          }
          ctx.beginPath();
          ctx.arc(px, py, blobR * scale, 0, Math.PI * 2);
          ctx.fillStyle = grad;
          ctx.fill();
        }
      }
    }
    ctx.globalAlpha = 1;
  }
}
