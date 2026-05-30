import { ShadingStyle, PlanetType, GAS_GIANT_COLOUR_PAIRS } from '../entities/Planet.js';

// Set by Renderer before drawing backgrounds in simplified performance mode.
let _simplified = false;
export function setPlanetRendererSimplified(v) { _simplified = v; }

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
      case ShadingStyle.GLOWING:    PlanetRenderer._drawStarBody(ctx, planet, conv);   break;
      case ShadingStyle.WORMHOLE:   PlanetRenderer._drawWormhole(ctx, planet, conv);   break;
      case ShadingStyle.NONE:       PlanetRenderer._drawBlackHole(ctx, planet, conv);  break;
      case ShadingStyle.GAS_GIANT:  PlanetRenderer._drawGasGiant(ctx, planet, conv);   break;
      default:                      PlanetRenderer._drawRocky(ctx, planet, conv);      break;
    }
  }

  // ----------------------------------------------------------------
  // Rocky planet / asteroid — lit-side shading
  // ASTEROID with vertices: draw rotating convex polygon (flat colour, no gradient)
  // ----------------------------------------------------------------
  static _drawRocky(ctx, planet, conv) {
    const cx = planet.position.x * conv;
    const cy = planet.position.y * conv;
    const r  = Math.max(2, planet.radius * conv);
    const [pr, pg, pb] = planet.colour;

    if (planet.type === PlanetType.ASTEROID && planet._rotatedVerts?.length) {
      ctx.beginPath();
      const verts = planet._rotatedVerts;
      ctx.moveTo(verts[0].x * conv, verts[0].y * conv);
      for (let i = 1; i < verts.length; i++) {
        ctx.lineTo(verts[i].x * conv, verts[i].y * conv);
      }
      ctx.closePath();
      ctx.fillStyle = `rgb(${pr},${pg},${pb})`;
      ctx.fill();
      return;
    }

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
  // Star corona — multi-layer halo + bristles, composited with blur (pass 1)
  // ----------------------------------------------------------------
  static _drawStarCorona(ctx, planet, conv) {
    const cx = planet.position.x * conv;
    const cy = planet.position.y * conv;
    const r  = Math.max(3, planet.radius * conv);
    const [pr, pg, pb] = planet.colour;

    const cr = Math.floor(pr * 0.30);
    const cg = Math.floor(pg * 0.38);
    const cb = Math.floor(pb * 0.15);

    // Offscreen canvas sized to fit the full corona (max extent 3.2×r)
    const margin  = 4;
    const offSize = Math.ceil(r * 3.2 * 2) + margin * 2;
    const off     = document.createElement('canvas');
    off.width = off.height = offSize;
    const oc  = off.getContext('2d');
    const oCx = offSize / 2;
    const oCy = offSize / 2;

    // Tight bright inner ring — peaks just outside the star surface then quickly
    // fades. Creates the chromosphere/inner-corona effect without extending far.
    const ringGrad = oc.createRadialGradient(oCx, oCy, r * 0.85, oCx, oCy, r * 1.45);
    ringGrad.addColorStop(0,    `rgba(${cr},${cg},${cb},0)`);
    ringGrad.addColorStop(0.35, `rgba(${cr},${cg},${cb},0.72)`);
    ringGrad.addColorStop(1,    `rgba(${cr},${cg},${cb},0)`);
    oc.beginPath();
    oc.arc(oCx, oCy, r * 1.45, 0, Math.PI * 2);
    oc.fillStyle = ringGrad;
    oc.fill();

    // 5 concentric radial-gradient layers — build up the wider atmospheric glow
    const layers = [
      { scale: 1.0, alpha: 0.35 },
      { scale: 1.4, alpha: 0.22 },
      { scale: 1.9, alpha: 0.14 },
      { scale: 2.5, alpha: 0.08 },
      { scale: 3.2, alpha: 0.04 },
    ];
    for (const { scale, alpha } of layers) {
      const lr   = r * scale;
      const grad = oc.createRadialGradient(oCx, oCy, 0, oCx, oCy, lr);
      grad.addColorStop(0, `rgba(${cr},${cg},${cb},${alpha})`);
      grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      oc.beginPath();
      oc.arc(oCx, oCy, lr, 0, Math.PI * 2);
      oc.fillStyle = grad;
      oc.fill();
    }

    // Bristles at reduced opacity for texture
    const count = Math.max(200, Math.floor(r * 3.5));
    oc.lineWidth = Math.max(1, conv * 0.7);

    oc.strokeStyle = `rgba(${cr},${cg},${cb},0.60)`;
    oc.beginPath();
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = r * (0.87 + Math.random() * 0.13);
      const e = r * (1.10 + Math.random() * 0.50);
      oc.moveTo(oCx + Math.cos(a) * s, oCy + Math.sin(a) * s);
      oc.lineTo(oCx + Math.cos(a) * e, oCy + Math.sin(a) * e);
    }
    oc.stroke();

    oc.strokeStyle = `rgba(${cr},${cg},${cb},0.90)`;
    oc.beginPath();
    for (let i = 0, n = Math.floor(count * 0.55); i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = r * (0.92 + Math.random() * 0.08);
      const e = r * (1.04 + Math.random() * 0.20);
      oc.moveTo(oCx + Math.cos(a) * s, oCy + Math.sin(a) * s);
      oc.lineTo(oCx + Math.cos(a) * e, oCy + Math.sin(a) * e);
    }
    oc.stroke();

    // Composite offscreen canvas — blur disabled in simplified performance mode
    if (!_simplified) ctx.filter = 'blur(4px)';
    ctx.drawImage(off, cx - oCx, cy - oCy);
    ctx.filter = 'none';

    // Surface fringe — drawn directly on ctx AFTER the blur so spikes are
    // sharp and don't smear back into the star body. Each spike starts just
    // inside the star edge (will be covered by the star body in pass 2) and
    // pokes out 3–11% of r beyond the surface.
    // Surface fringe on its own offscreen canvas so it gets its own blur pass.
    const spikeB   = Math.min(255, pb + 120);
    const nSpikes  = Math.max(350, Math.floor(r * 7));
    const spikeExt = r * 0.15 + 4; // max extension + margin
    const spOff    = document.createElement('canvas');
    spOff.width = spOff.height = offSize;
    const sp = spOff.getContext('2d');
    sp.strokeStyle = `rgba(255,255,${spikeB},0.92)`;
    sp.lineWidth   = Math.max(0.5, conv * 0.45);
    sp.beginPath();
    for (let i = 0; i < nSpikes; i++) {
      const a   = Math.random() * Math.PI * 2;
      const len = r * (0.012 + Math.random() * 0.032);
      sp.moveTo(oCx + Math.cos(a) * r * 0.97, oCy + Math.sin(a) * r * 0.97);
      sp.lineTo(oCx + Math.cos(a) * (r + len), oCy + Math.sin(a) * (r + len));
    }
    sp.stroke();
    if (!_simplified) ctx.filter = 'blur(2px)';
    ctx.drawImage(spOff, cx - oCx, cy - oCy);
    ctx.filter = 'none';
  }

  // ----------------------------------------------------------------
  // Star body — bright core disc + white-hole halo (drawn in pass 2)
  // ----------------------------------------------------------------
  static _drawStarBody(ctx, planet, conv) {
    const cx = planet.position.x * conv;
    const cy = planet.position.y * conv;
    const r  = Math.max(3, planet.radius * conv);
    const [pr, pg, pb] = planet.colour;

    const coreGrad = ctx.createRadialGradient(cx, cy, r * 0.05, cx, cy, r);
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
  // Gas giant — horizontal alternating stripes at 50% transparency.
  // Projectiles pass through; rendered in the live pass so it composites
  // over the background correctly (background is drawn first, then this).
  // ----------------------------------------------------------------
  static _drawGasGiant(ctx, planet, conv) {
    const cx = planet.position.x * conv;
    const cy = planet.position.y * conv;
    const r  = Math.max(2, planet.radius * conv);
    const [ar, ag, ab] = planet.colour;
    const [br, bg, bb] = planet.colourB ?? planet.colour;

    const stripeH = Math.max(2, r * 0.12);
    const margin  = 4;
    const offSize = Math.ceil(r * 2) + margin * 2;

    // Draw to an offscreen canvas so we can composite with a soft blur
    const off = document.createElement('canvas');
    off.width = off.height = offSize;
    const oc  = off.getContext('2d');
    const ocx = offSize / 2;
    const ocy = offSize / 2;

    oc.save();
    oc.beginPath();
    oc.arc(ocx, ocy, r, 0, Math.PI * 2);
    oc.clip();

    // Base fill: colour A
    oc.fillStyle = `rgba(${ar},${ag},${ab},0.50)`;
    oc.fillRect(ocx - r, ocy - r, r * 2, r * 2);

    // Curved colour-B bands
    const top     = ocy - r;
    const nStripes = Math.ceil(r * 2 / stripeH) + 2;
    for (let i = 0; i < nStripes; i += 2) {
      const y    = top + i * stripeH;
      const seed = Math.sin(i * 2.3999 + planet.position.x * 0.1) * 0.5 + 0.5;
      const amp  = stripeH * (0.15 + seed * 0.35);

      oc.beginPath();
      oc.moveTo(ocx - r, y);
      oc.quadraticCurveTo(ocx, y + amp, ocx + r, y);
      oc.lineTo(ocx + r, y + stripeH);
      oc.quadraticCurveTo(ocx, y + stripeH + amp, ocx - r, y + stripeH);
      oc.closePath();
      oc.fillStyle = `rgba(${br},${bg},${bb},0.50)`;
      oc.fill();
    }
    oc.restore();

    // Composite with a gentle blur — softens stripe edges to look gaseous
    if (!_simplified) ctx.filter = 'blur(2.5px)';
    ctx.drawImage(off, cx - ocx, cy - ocy);
    ctx.filter = 'none';
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
