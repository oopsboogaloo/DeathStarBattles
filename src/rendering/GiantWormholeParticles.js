// Copyright © 2026 Chloe Bolland
// contact chloe@mammoththoughts.com if you wish to use, publish or reproduce this game or any part of it in any way

// Particle spirals for giant off-screen wormholes.
// Physics state is kept in game units; canvas pixels are used only at draw time.
// Only the visible arc of the ring is populated; off-screen positions are culled.

const DEFAULTS = {
  count:         300,
  spawnMult:     1.40,  // spawn ring = impactRadius * spawnMult (game units)
  voidMult:      1.02,  // despawn just outside the event horizon
  angularSpeed:  0.80,  // rad/s at spawn radius
  momentumExp:   1.70,  // angular speed scales as (spawnR / r) ^ momentumExp
  inwardFrac:    0.15,  // inward speed = impactRadius * inwardFrac per second
  blobRadius:    14,    // particle visual radius in game units (fixed, not fraction of ir)
  alphaMax:      0.30,
  alphaFadeMult: 1.20,  // full alpha once r >= impactRadius * alphaFadeMult; fades inward below
  hueRange:      35,    // ± hue jitter per particle
  arcMargin:     0.35,  // extra radians beyond visible arc on each side for off-screen spawn
};

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

function hsvToRgb(h, s, v) {
  h = ((h % 360) + 360) % 360;
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  let r, g, b;
  if      (h < 60)  { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

export class GiantWormholeParticles {
  constructor(planet, gw, gh) {
    this._planet  = planet;
    this._gw      = gw;
    this._gh      = gh;
    this._cfg     = { ...DEFAULTS };
    const n       = this._cfg.count;
    this._angles  = new Float32Array(n);
    this._radii   = new Float32Array(n);
    this._colR    = new Float32Array(n);
    this._colG    = new Float32Array(n);
    this._colB    = new Float32Array(n);
    this._lastT   = null;

    const [pr, pg, pb] = planet.colour;
    this._baseHSV = rgbToHsv(pr, pg, pb);
    this._arc     = this._computeVisibleArc();

    for (let i = 0; i < n; i++) {
      this._setColour(i);
      this._respawn(i);
    }
  }

  // Find the contiguous arc of the ring that falls within the screen rect.
  // Sampling is centred on the direction from the wormhole toward the screen
  // centre, which avoids 0/2π wrap issues (visible arc always faces inward).
  _computeVisibleArc() {
    const { position: pos, impactRadius: ir } = this._planet;
    const cx = pos.x, cy = pos.y;
    const gw = this._gw, gh = this._gh;
    const refAngle = Math.atan2(gh / 2 - cy, gw / 2 - cx);
    let minA = Infinity, maxA = -Infinity;
    const N = 720;
    for (let i = 0; i < N; i++) {
      const a  = refAngle + (i / N - 0.5) * Math.PI * 2;
      const px = cx + ir * Math.cos(a);
      const py = cy + ir * Math.sin(a);
      if (px >= 0 && px <= gw && py >= 0 && py <= gh) {
        if (a < minA) minA = a;
        if (a > maxA) maxA = a;
      }
    }
    const margin = this._cfg.arcMargin;
    if (minA === Infinity) return { min: refAngle - 0.2, max: refAngle + 0.2 };
    return { min: minA - margin, max: maxA + margin };
  }

  _setColour(i) {
    const [h, s, v] = this._baseHSV;
    const hOff = (Math.random() * 2 - 1) * this._cfg.hueRange;
    const [cr, cg, cb] = hsvToRgb(h + hOff, s, Math.min(1, v + 0.15));
    this._colR[i] = cr;
    this._colG[i] = cg;
    this._colB[i] = cb;
  }

  _respawn(i) {
    const cfg    = this._cfg;
    const ir     = this._planet.impactRadius;
    const voidR  = ir * cfg.voidMult;
    const spawnR = ir * cfg.spawnMult;
    this._angles[i] = this._arc.min + Math.random() * (this._arc.max - this._arc.min);
    this._radii[i]  = voidR + Math.random() * (spawnR - voidR);
    this._setColour(i);
  }

  update(nowSec) {
    if (this._lastT === null) {
      this._lastT = nowSec;
      for (let i = 0; i < this._cfg.count; i++) this._respawn(i);
      return;
    }
    const dt     = Math.min(nowSec - this._lastT, 0.1);
    this._lastT  = nowSec;
    const cfg    = this._cfg;
    const ir     = this._planet.impactRadius;
    const spawnR = ir * cfg.spawnMult;
    const voidR  = ir * cfg.voidMult;
    const inward = ir * cfg.inwardFrac;
    for (let i = 0; i < cfg.count; i++) {
      const r = this._radii[i];
      if (r <= voidR) { this._respawn(i); continue; }
      this._angles[i] += cfg.angularSpeed * Math.pow(spawnR / r, cfg.momentumExp) * dt;
      this._radii[i]   = r - inward * dt;
    }
  }

  draw(ctx, conv, bounds) {
    const cfg    = this._cfg;
    const planet = this._planet;
    const cx     = planet.position.x * conv;
    const cy     = planet.position.y * conv;
    const ir     = planet.impactRadius;
    const voidR  = ir * cfg.voidMult;
    const blobPx = cfg.blobRadius * conv;
    const cull   = blobPx * 2;

    for (let i = 0; i < cfg.count; i++) {
      const r = this._radii[i];
      if (r <= voidR) continue;

      const px = cx + Math.cos(this._angles[i]) * r * conv;
      const py = cy + Math.sin(this._angles[i]) * r * conv;

      if (px < bounds.xMin - cull || px > bounds.xMax + cull ||
          py < bounds.yMin - cull || py > bounds.yMax + cull) continue;

      // Fade in near the event horizon, full alpha beyond alphaFadeMult * ir
      const alpha = cfg.alphaMax * Math.min(1, r / (ir * cfg.alphaFadeMult));

      const cr = this._colR[i];
      const cg = this._colG[i];
      const cb = this._colB[i];

      // Halo + bright core — same style as normal wormhole particles
      ctx.fillStyle   = `rgb(${Math.round(cr)},${Math.round(cg)},${Math.round(cb)})`;
      ctx.globalAlpha = alpha * 0.35;
      ctx.beginPath();
      ctx.arc(px, py, blobPx * 1.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(px, py, blobPx * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
