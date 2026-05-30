import { ShadingStyle, PlanetType } from '../entities/Planet.js';

export class PlanetRenderer {
  // Pass 1: draw only corona/glow effects (so they sit behind solid planet bodies)
  static drawCorona(ctx, planet, conv) {
    if (planet.shading === ShadingStyle.GLOWING) {
      PlanetRenderer._drawStarCorona(ctx, planet, conv);
    }
  }

  // Pass 2: draw solid planet body (no corona)
  static draw(ctx, planet, conv) {
    switch (planet.shading) {
      case ShadingStyle.GLOWING:  PlanetRenderer._drawStarBody(ctx, planet, conv);  break;
      case ShadingStyle.WORMHOLE: PlanetRenderer._drawWormhole(ctx, planet, conv);  break;
      case ShadingStyle.NONE:     PlanetRenderer._drawBlackHole(ctx, planet, conv); break;
      default:                    PlanetRenderer._drawRocky(ctx, planet, conv);     break;
    }
  }

  // ----------------------------------------------------------------
  // Rocky planet / asteroid — lit-side shading
  // ----------------------------------------------------------------
  static _drawRocky(ctx, planet, conv) {
    const cx = planet.position.x * conv;
    const cy = planet.position.y * conv;
    const r  = Math.max(2, planet.radius * conv);
    const [pr, pg, pb] = planet.colour;

    const grad = ctx.createRadialGradient(
      cx - r * 0.35, cy - r * 0.35, r * 0.1,
      cx, cy, r
    );
    grad.addColorStop(0,   `rgb(${Math.min(255, pr + 40)},${Math.min(255, pg + 35)},${Math.min(255, pb + 25)})`);
    grad.addColorStop(0.6, `rgb(${pr},${pg},${pb})`);
    grad.addColorStop(1,   `rgb(${Math.floor(pr * .45)},${Math.floor(pg * .45)},${Math.floor(pb * .45)})`);

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // ----------------------------------------------------------------
  // Star corona — outer glow + bristles only (drawn in pass 1)
  // ----------------------------------------------------------------
  static _drawStarCorona(ctx, planet, conv) {
    const cx = planet.position.x * conv;
    const cy = planet.position.y * conv;
    const r  = Math.max(3, planet.radius * conv);
    const [pr, pg, pb] = planet.colour;

    const cr = Math.floor(pr * 0.30);
    const cg = Math.floor(pg * 0.38);
    const cb = Math.floor(pb * 0.15);

    // Soft outer glow
    const outerGlow = ctx.createRadialGradient(cx, cy, r * 0.95, cx, cy, r * 1.65);
    outerGlow.addColorStop(0,   `rgba(${cr},${cg},${cb},0.9)`);
    outerGlow.addColorStop(0.5, `rgba(${cr},${cg},${cb},0.4)`);
    outerGlow.addColorStop(1,   `rgba(${cr},${cg},${cb},0)`);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.65, 0, Math.PI * 2);
    ctx.fillStyle = outerGlow;
    ctx.fill();

    // Bristle corona — two batched stroke() passes for inner/outer depth
    const count = Math.max(200, Math.floor(r * 3.5));
    ctx.lineWidth = Math.max(1, conv * 0.7);

    ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.55)`;
    ctx.beginPath();
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = r * (0.87 + Math.random() * 0.13);
      const e = r * (1.10 + Math.random() * 0.50);
      ctx.moveTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s);
      ctx.lineTo(cx + Math.cos(a) * e, cy + Math.sin(a) * e);
    }
    ctx.stroke();

    ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.8)`;
    ctx.beginPath();
    for (let i = 0, n = Math.floor(count * 0.55); i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = r * (0.92 + Math.random() * 0.08);
      const e = r * (1.04 + Math.random() * 0.20);
      ctx.moveTo(cx + Math.cos(a) * s, cy + Math.sin(a) * s);
      ctx.lineTo(cx + Math.cos(a) * e, cy + Math.sin(a) * e);
    }
    ctx.stroke();
  }

  // ----------------------------------------------------------------
  // Star body — bright core disc + white-hole halo (drawn in pass 2)
  // ----------------------------------------------------------------
  static _drawStarBody(ctx, planet, conv) {
    const cx = planet.position.x * conv;
    const cy = planet.position.y * conv;
    const r  = Math.max(3, planet.radius * conv);
    const [pr, pg, pb] = planet.colour;

    const coreGrad = ctx.createRadialGradient(cx - r * 0.15, cy - r * 0.15, r * 0.05, cx, cy, r);
    coreGrad.addColorStop(0,   `rgb(255,255,${Math.min(255, pb + 120)})`);
    coreGrad.addColorStop(0.5, `rgb(${pr},${pg},${pb})`);
    coreGrad.addColorStop(1,   `rgb(${Math.floor(pr * .75)},${Math.floor(pg * .75)},${Math.floor(pb * .6)})`);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = coreGrad;
    ctx.fill();

    if (planet.halo > 1.0) {
      const haloR    = r * planet.halo;
      const haloGrad = ctx.createRadialGradient(cx, cy, r, cx, cy, haloR);
      haloGrad.addColorStop(0, 'rgba(255,255,255,0.35)');
      haloGrad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.beginPath();
      ctx.arc(cx, cy, haloR, 0, Math.PI * 2);
      ctx.fillStyle = haloGrad;
      ctx.fill();
    }
  }

  // ----------------------------------------------------------------
  // Wormhole — glowing ring with dark void centre
  // Display radius is 2× physics radius (matches original)
  // ----------------------------------------------------------------
  static _drawWormhole(ctx, planet, conv) {
    const cx = planet.position.x * conv;
    const cy = planet.position.y * conv;
    const r  = Math.max(4, planet.radius * 2 * conv);
    const [pr, pg, pb] = planet.colour;

    // Dark void
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.38, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();

    // Glowing ring
    const ringGrad = ctx.createRadialGradient(cx, cy, r * 0.33, cx, cy, r);
    ringGrad.addColorStop(0,    `rgba(${pr},${pg},${pb},0)`);
    ringGrad.addColorStop(0.35, `rgba(${pr},${pg},${pb},1)`);
    ringGrad.addColorStop(0.65, `rgba(${pr},${pg},${pb},0.55)`);
    ringGrad.addColorStop(1,    `rgba(${pr},${pg},${pb},0)`);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = ringGrad;
    ctx.fill();
  }

  // ----------------------------------------------------------------
  // Black hole — near-invisible per spec; just a faint distortion ring
  // Players must infer its presence from bullet behaviour
  // ----------------------------------------------------------------
  static _drawBlackHole(ctx, planet, conv) {
    const cx = planet.position.x * conv;
    const cy = planet.position.y * conv;
    const r  = Math.max(2, planet.impactRadius * conv);

    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.8, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(30,30,55,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}
