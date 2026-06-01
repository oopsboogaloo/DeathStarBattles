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

    // Clip the corona bounding box to the bgCanvas viewport.  For off-screen
    // supergiants the full corona bounding box can be many times the screen
    // size; blurring a canvas that large is very expensive.
    const vpW    = ctx.canvas.width;
    const vpH    = ctx.canvas.height;
    const margin = 4;
    const bx0 = Math.max(0,   Math.floor(cx - r * 3.2) - margin);
    const by0 = Math.max(0,   Math.floor(cy - r * 3.2) - margin);
    const bx1 = Math.min(vpW, Math.ceil(cx  + r * 3.2) + margin);
    const by1 = Math.min(vpH, Math.ceil(cy  + r * 3.2) + margin);
    if (bx1 <= bx0 || by1 <= by0) return; // corona entirely off-screen

    const clipW = bx1 - bx0;
    const clipH = by1 - by0;

    // Star centre expressed in off-canvas coordinates (may be negative for
    // off-screen supergiants whose corona only partially overlaps the viewport).
    const oCx = cx - bx0;
    const oCy = cy - by0;

    // Chromosphere inner ring + surface bristles — STAR type only.
    // White holes, white dwarfs, and pulsars keep the plain corona.
    const isStar = planet.type === PlanetType.STAR;

    const off = document.createElement('canvas');
    off.width  = clipW;
    off.height = clipH;
    const oc = off.getContext('2d');

    if (isStar) {
      const ringGrad = oc.createRadialGradient(oCx, oCy, r * 0.85, oCx, oCy, r * 1.45);
      ringGrad.addColorStop(0,    `rgba(${cr},${cg},${cb},0)`);
      ringGrad.addColorStop(0.35, `rgba(${cr},${cg},${cb},0.72)`);
      ringGrad.addColorStop(1,    `rgba(${cr},${cg},${cb},0)`);
      oc.beginPath();
      oc.arc(oCx, oCy, r * 1.45, 0, Math.PI * 2);
      oc.fillStyle = ringGrad;
      oc.fill();
    }

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

    // Bristles — skip any whose outer tip falls outside the clip canvas since
    // those would be culled by the canvas anyway and add path overhead.
    const count = Math.max(200, Math.floor(r * 3.5));
    oc.lineWidth = Math.max(1, conv * 0.7);

    oc.strokeStyle = `rgba(${cr},${cg},${cb},0.60)`;
    oc.beginPath();
    for (let i = 0; i < count; i++) {
      const a  = Math.random() * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const e  = r * (1.10 + Math.random() * 0.50);
      const ex = oCx + ca * e, ey = oCy + sa * e;
      if (ex < 0 || ex > clipW || ey < 0 || ey > clipH) continue;
      oc.moveTo(oCx + ca * r * (0.87 + Math.random() * 0.13), oCy + sa * r * (0.87 + Math.random() * 0.13));
      oc.lineTo(ex, ey);
    }
    oc.stroke();

    oc.strokeStyle = `rgba(${cr},${cg},${cb},0.90)`;
    oc.beginPath();
    for (let i = 0, n = Math.floor(count * 0.55); i < n; i++) {
      const a  = Math.random() * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const e  = r * (1.04 + Math.random() * 0.20);
      const ex = oCx + ca * e, ey = oCy + sa * e;
      if (ex < 0 || ex > clipW || ey < 0 || ey > clipH) continue;
      oc.moveTo(oCx + ca * r * (0.92 + Math.random() * 0.08), oCy + sa * r * (0.92 + Math.random() * 0.08));
      oc.lineTo(ex, ey);
    }
    oc.stroke();

    // Composite offscreen canvas — blur disabled in simplified performance mode
    if (!_simplified) ctx.filter = 'blur(4px)';
    ctx.drawImage(off, bx0, by0);
    ctx.filter = 'none';

    // Short spikey bristles on the star surface
    if (isStar) {
      const nSpikes = Math.max(350, Math.floor(r * 7));
      const spOff   = document.createElement('canvas');
      spOff.width  = clipW;
      spOff.height = clipH;
      const sp = spOff.getContext('2d');
      sp.strokeStyle = `rgba(${pr},${pg},${pb},0.60)`;
      sp.lineWidth   = Math.max(0.5, conv * 0.45);
      sp.beginPath();
      for (let i = 0; i < nSpikes; i++) {
        const a   = Math.random() * Math.PI * 2;
        const ca  = Math.cos(a), sa = Math.sin(a);
        const tip = r + r * (0.001 + Math.random() * Math.random() * 0.20);
        const tx  = oCx + ca * tip, ty = oCy + sa * tip;
        if (tx < 0 || tx > clipW || ty < 0 || ty > clipH) continue;
        sp.moveTo(oCx + ca * r * 0.97, oCy + sa * r * 0.97);
        sp.lineTo(tx, ty);
      }
      sp.stroke();
      if (!_simplified) ctx.filter = 'blur(4px)';
      ctx.drawImage(spOff, bx0, by0);
      ctx.filter = 'none';
    }
  }

  // ----------------------------------------------------------------
  // Star body — bright core disc + white-hole halo (drawn in pass 2)
  // ----------------------------------------------------------------
  static _drawStarBody(ctx, planet, conv) {
    const cx = planet.position.x * conv;
    const cy = planet.position.y * conv;
    const r  = Math.max(3, planet.radius * conv);
    const [pr, pg, pb] = planet.colour;

    if (planet.type === PlanetType.STAR) {
      // Stars: render via offscreen canvas so the disc edge can be blurred
      const margin  = Math.ceil(r * 0.15) + 4;
      const offSize = Math.ceil(r * 2) + margin * 2;
      const off     = document.createElement('canvas');
      off.width = off.height = offSize;
      const oc  = off.getContext('2d');
      const oCx = offSize / 2;
      const oCy = offSize / 2;

      const isRedGiant = pr > pg * 2.5 && pb < 30;
      const coreGrad = oc.createRadialGradient(oCx, oCy, r * 0.05, oCx, oCy, r);
      coreGrad.addColorStop(0,   isRedGiant ? `rgb(255,45,0)` : `rgb(255,255,${Math.min(255, pb + 120)})`);
      coreGrad.addColorStop(0.7, isRedGiant ? `rgb(255,${Math.floor(pg * 0.6)},0)` : `rgb(255,255,${Math.min(255, pb + 50)})`);
      coreGrad.addColorStop(0.9, `rgb(${pr},${pg},${pb})`);
      coreGrad.addColorStop(1,   `rgb(${Math.floor(pr * .55)},${Math.floor(pg * .55)},${Math.floor(pb * .3)})`);
      oc.beginPath();
      oc.arc(oCx, oCy, r, 0, Math.PI * 2);
      oc.fillStyle = coreGrad;
      oc.fill();

      if (!_simplified) ctx.filter = 'blur(2.8px)';
      ctx.drawImage(off, cx - oCx, cy - oCy);
      ctx.filter = 'none';
      return;
    }

    // All other glowing types (white hole, white dwarf, pulsar) — draw directly,
    // no offscreen canvas, so halos of any size render correctly.
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

    if (planet.radius > 100) {
      // Giant wormhole — draw at impactRadius so the arc appears at the screen
      // corner where bullets are actually captured, not at the physics radius.
      const vr = (planet.impactRadius ?? 50) * 8 * conv;
      ctx.beginPath();
      ctx.arc(cx, cy, vr * 0.38, 0, Math.PI * 2);
      ctx.fillStyle = '#000';
      ctx.fill();
      const ringGrad = ctx.createRadialGradient(cx, cy, vr * 0.33, cx, cy, vr);
      ringGrad.addColorStop(0,    `rgba(${pr},${pg},${pb},0)`);
      ringGrad.addColorStop(0.35, `rgba(${pr},${pg},${pb},1)`);
      ringGrad.addColorStop(0.65, `rgba(${pr},${pg},${pb},0.55)`);
      ringGrad.addColorStop(1,    `rgba(${pr},${pg},${pb},0)`);
      ctx.beginPath();
      ctx.arc(cx, cy, vr, 0, Math.PI * 2);
      ctx.fillStyle = ringGrad;
      ctx.fill();
    } else {
      // Normal wormhole — full gradient ring at display radius
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.38, 0, Math.PI * 2);
      ctx.fillStyle = '#000';
      ctx.fill();
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

    // Curved colour-B bands — varying heights for a natural gas giant look
    const minH     = Math.max(2, r * 0.06);
    const maxH     = Math.max(4, r * 0.22);
    let   bandY    = ocy - r;
    let   drawBand = true;

    while (bandY < ocy + r + maxH) {
      const seed      = Math.sin(bandY * 0.13 + planet.position.x * 0.1) * 0.5 + 0.5;
      const thisBandH = minH + seed * (maxH - minH);
      if (drawBand) {
        const amp = thisBandH * (2.8 + seed * 0.15);
        oc.beginPath();
        oc.moveTo(ocx - r, bandY);
        oc.quadraticCurveTo(ocx, bandY + amp, ocx + r, bandY);
        oc.lineTo(ocx + r, bandY + thisBandH);
        oc.quadraticCurveTo(ocx, bandY + thisBandH + amp, ocx - r, bandY + thisBandH);
        oc.closePath();
        oc.fillStyle = `rgba(${br},${bg},${bb},0.50)`;
        oc.fill();
      }
      bandY += thisBandH;
      drawBand = !drawBand;
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
