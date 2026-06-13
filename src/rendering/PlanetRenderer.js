import { ShadingStyle, PlanetType, GAS_GIANT_COLOUR_PAIRS } from '../entities/Planet.js';

// Set by Renderer before drawing backgrounds in simplified performance mode.
let _simplified = false;
export function setPlanetRendererSimplified(v) { _simplified = v; }

// Set by Renderer — true only in the 'experimental' performance mode, which
// enables the up-close star fire rim (3 jagged solid layers at the surface).
let _experimental = false;
export function setPlanetRendererExperimental(v) { _experimental = v; }

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

    const isAsteroid = planet.type === PlanetType.ASTEROID || planet.type === PlanetType.GIANT_ASTEROID;
    const isCrystal  = planet.type === PlanetType.CRYSTAL;
    if ((isAsteroid || isCrystal) && planet._rotatedVerts?.length) {
      const verts = planet._rotatedVerts;
      const n = verts.length;

      const outer = verts.map(v => ({ x: v.x * conv, y: v.y * conv }));

      const INNER = isCrystal ? 0.38 : 0.52; // crystals have a deeper inner face
      const inner = outer.map(v => ({
        x: cx + (v.x - cx) * INNER,
        y: cy + (v.y - cy) * INNER,
      }));

      const ldx = -0.62, ldy = -0.78;

      const shade = (nx, ny) => {
        const f = 0.35 + Math.max(0, nx * ldx + ny * ldy) * 0.85;
        ctx.fillStyle = `rgb(${Math.min(255, Math.round(pr * f))},${Math.min(255, Math.round(pg * f))},${Math.min(255, Math.round(pb * f))})`;
      };
      const outwardNormal = (ax, ay, bx, by) => {
        const edx = bx - ax, edy = by - ay, len = Math.hypot(edx, edy) || 1;
        let nx = -edy / len, ny = edx / len;
        if (((ax + bx) / 2 - cx) * nx + ((ay + by) / 2 - cy) * ny < 0) { nx = -nx; ny = -ny; }
        return [nx, ny];
      };

      if (planet.type === PlanetType.GIANT_ASTEROID) {
        // Staggered mid ring: midpoints of outer edges pulled to 62% of their
        // centre distance. Mid vertices sit angularly between outer vertices,
        // so the inner row of triangle faces has genuinely different normals
        // and shading — producing two visually distinct rows.
        const mid = outer.map((v, i) => {
          const j = (i + 1) % n;
          const mx = (v.x + outer[j].x) / 2, my = (v.y + outer[j].y) / 2;
          return { x: cx + (mx - cx) * 0.62, y: cy + (my - cy) * 0.62 };
        });
        const core = outer.map(v => ({
          x: cx + (v.x - cx) * 0.32,
          y: cy + (v.y - cy) * 0.32,
        }));

        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n, h = (i - 1 + n) % n;
          // A — outer face
          let [nx, ny] = outwardNormal(outer[i].x, outer[i].y, outer[j].x, outer[j].y);
          shade(nx, ny);
          ctx.beginPath(); ctx.moveTo(outer[i].x, outer[i].y); ctx.lineTo(outer[j].x, outer[j].y); ctx.lineTo(mid[i].x, mid[i].y); ctx.closePath(); ctx.fill();
          // B — corner connector
          [nx, ny] = outwardNormal(mid[h].x, mid[h].y, outer[i].x, outer[i].y);
          shade(nx, ny);
          ctx.beginPath(); ctx.moveTo(mid[h].x, mid[h].y); ctx.lineTo(outer[i].x, outer[i].y); ctx.lineTo(mid[i].x, mid[i].y); ctx.closePath(); ctx.fill();
          // C — inner ledge face
          [nx, ny] = outwardNormal(mid[h].x, mid[h].y, mid[i].x, mid[i].y);
          shade(nx, ny);
          ctx.beginPath(); ctx.moveTo(mid[h].x, mid[h].y); ctx.lineTo(mid[i].x, mid[i].y); ctx.lineTo(core[i].x, core[i].y); ctx.closePath(); ctx.fill();
        }
        // Deep inner top face
        ctx.beginPath();
        ctx.moveTo(core[0].x, core[0].y);
        for (let i = 1; i < n; i++) ctx.lineTo(core[i].x, core[i].y);
        ctx.closePath();
        ctx.fillStyle = `rgb(${Math.min(255, Math.round(pr * 0.72))},${Math.min(255, Math.round(pg * 0.72))},${Math.min(255, Math.round(pb * 0.72))})`;
        ctx.fill();
        return;
      }

      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const edx = outer[j].x - outer[i].x;
        const edy = outer[j].y - outer[i].y;
        const len = Math.hypot(edx, edy) || 1;
        let nx = -edy / len, ny = edx / len;
        const mx = (outer[i].x + outer[j].x) / 2;
        const my = (outer[i].y + outer[j].y) / 2;
        if ((mx - cx) * nx + (my - cy) * ny < 0) { nx = -nx; ny = -ny; }

        const ndotl = Math.max(0, nx * ldx + ny * ldy);
        // Crystals have sharper specular highlights (wider f range)
        const f = isCrystal
          ? 0.20 + ndotl * 1.40  // 0.20 (deep shadow) → 1.60 (bright specular)
          : 0.35 + ndotl * 0.85;
        ctx.beginPath();
        ctx.moveTo(outer[i].x, outer[i].y);
        ctx.lineTo(outer[j].x, outer[j].y);
        ctx.lineTo(inner[j].x, inner[j].y);
        ctx.lineTo(inner[i].x, inner[i].y);
        ctx.closePath();
        ctx.fillStyle = `rgb(${Math.min(255, Math.round(pr * f))},${Math.min(255, Math.round(pg * f))},${Math.min(255, Math.round(pb * f))})`;
        ctx.fill();
      }

      // Inner (top) face
      ctx.beginPath();
      ctx.moveTo(inner[0].x, inner[0].y);
      for (let i = 1; i < n; i++) ctx.lineTo(inner[i].x, inner[i].y);
      ctx.closePath();
      // Crystals: bright near-white core
      if (isCrystal) {
        ctx.fillStyle = `rgb(${Math.min(255, Math.round(pr * 1.1))},${Math.min(255, Math.round(pg * 1.05))},255)`;
      } else {
        ctx.fillStyle = `rgb(${Math.min(255, Math.round(pr * 0.80))},${Math.min(255, Math.round(pg * 0.80))},${Math.min(255, Math.round(pb * 0.80))})`;
      }
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

    // Star surface edge. Experimental mode swaps the thin spikey bristles for a
    // chunkier 3-layer fire rim; all other modes keep the original spikes.
    if (isStar && _experimental && r > 20) {
      PlanetRenderer._drawStarFireRim(ctx, clipW, clipH, oCx, oCy, bx0, by0, r, planet.colour);
    } else if (isStar) {
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
  // Star fire rim (experimental) — 3 stacked jagged solid bands hugging the
  // star surface. Each band fills from a hidden inner edge up to an irregular
  // zigzag outer edge: alternating lower/upper vertices whose radii BOTH vary
  // randomly, and whose angular spacing is jittered, so the rim reads as a
  // ragged flame fringe rather than regular triangles. The zigzag's low points
  // float above the star surface (they never reach the base). The darkest band
  // sits furthest back (drawn first), the star colour in the middle, and the
  // brightest band nearest the surface (drawn last). Fills are fully opaque;
  // depth comes from layering, not alpha. Composited through a light 1px blur.
  // ----------------------------------------------------------------
  static _drawStarFireRim(ctx, clipW, clipH, oCx, oCy, bx0, by0, r, colour) {
    const [pr, pg, pb] = colour;
    const TAU   = Math.PI * 2;
    const teeth = Math.max(108, Math.round(r * 0.84)); // ~3× the previous density
    const step  = TAU / teeth;

    const off = document.createElement('canvas');
    off.width  = clipW;
    off.height = clipH;
    const g = off.getContext('2d');

    // One jagged solid band. The outer edge zigzags between a lower vertex
    // (radius random in [vLo, vHi]) and an upper vertex (random in [tLo, tHi]),
    // both with jittered angles. Solid fill runs from rInner up to that edge.
    const band = (rInner, vLo, vHi, tLo, tHi, fill) => {
      g.fillStyle = fill;
      g.beginPath();
      const jit = step * 0.45;
      for (let i = 0; i < teeth; i++) {
        const aB = i * step;
        const av = aB + (Math.random() - 0.5) * jit;             // lower vertex
        const rv = vLo + Math.random() * (vHi - vLo);
        const vx = oCx + Math.cos(av) * rv, vy = oCy + Math.sin(av) * rv;
        if (i === 0) g.moveTo(vx, vy); else g.lineTo(vx, vy);
        const at = aB + step * 0.5 + (Math.random() - 0.5) * jit; // upper vertex
        const rt = tLo + Math.random() * (tHi - tLo);
        g.lineTo(oCx + Math.cos(at) * rt, oCy + Math.sin(at) * rt);
      }
      for (let i = teeth; i >= 0; i--) {                         // inner edge, traced back
        const a = (i / teeth) * TAU;
        g.lineTo(oCx + Math.cos(a) * rInner, oCy + Math.sin(a) * rInner);
      }
      g.closePath();
      g.fill();
    };

    const rgb    = (cr, cg, cb) => `rgb(${cr | 0},${cg | 0},${cb | 0})`;
    const darker = rgb(pr * 0.45, pg * 0.45, pb * 0.45);
    const bright = rgb(pr + (255 - pr) * 0.55, pg + (255 - pg) * 0.55, pb + (210 - pb) * 0.55);
    const rIn    = r * 0.88; // hidden behind the body disc; keeps every band solid to the base

    //   rInner  valley range          tip range            fill
    band(rIn, r * 1.020, r * 1.050, r * 1.065, r * 1.110, darker);          // furthest back — darkest
    band(rIn, r * 1.010, r * 1.040, r * 1.045, r * 1.080, rgb(pr, pg, pb)); // middle — star colour
    band(rIn, r * 1.005, r * 1.025, r * 1.025, r * 1.055, bright);          // nearest surface — brightest

    ctx.filter = 'blur(1px)';
    ctx.drawImage(off, bx0, by0);
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
  // Display radius is 1.8× physics radius
  // ----------------------------------------------------------------
  static _drawWormhole(ctx, planet, conv) {
    // Giant rendering only when the capture ring was explicitly decoupled
    // from the physics radius (Big Wormhole's huge off-screen portals).
    // Large wormholes whose capture ring IS their radius use the standard
    // style — its bright rim already sits at the capture boundary.
    if (planet.radius > 100 && planet.impactRadius !== planet.radius) {
      PlanetRenderer._drawGiantWormhole(ctx, planet, conv);
      return;
    }
    const cx = planet.position.x * conv;
    const cy = planet.position.y * conv;
    const r  = Math.max(4, planet.radius * 1.8 * conv);
    const [pr, pg, pb] = planet.colour;

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

  // ----------------------------------------------------------------
  // Giant wormhole — dedicated renderer for portals whose capture ring
  // (impactRadius) is decoupled from their physics radius.
  // The brightest ring sits exactly at impactRadius (the physics capture
  // boundary), so the visual precisely matches where bullets teleport.
  // ----------------------------------------------------------------
  static _drawGiantWormhole(ctx, planet, conv) {
    const cx = planet.position.x * conv;
    const cy = planet.position.y * conv;
    const ir = (planet.impactRadius ?? 50) * conv;  // capture boundary = peak
    const [pr, pg, pb] = planet.colour;

    const outerR = ir * 3.5;
    const t      = ir / outerR;  // normalised position of the ring within gradient

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, outerR);
    grad.addColorStop(0,                          `rgba(${pr},${pg},${pb},0)`);
    grad.addColorStop(t * 0.75,                   `rgba(${pr},${pg},${pb},0.07)`);
    grad.addColorStop(t * 0.93,                   `rgba(${pr},${pg},${pb},0.55)`);
    grad.addColorStop(t,                          `rgba(${pr},${pg},${pb},1.0)`);
    grad.addColorStop(Math.min(1, t + (1-t)*0.15),`rgba(${pr},${pg},${pb},0.55)`);
    grad.addColorStop(Math.min(1, t + (1-t)*0.45),`rgba(${pr},${pg},${pb},0.15)`);
    grad.addColorStop(1,                          `rgba(${pr},${pg},${pb},0)`);

    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Void — solid black at centre, fading to transparent exactly at the event
    // horizon so the transition into the bright ring is smooth, not a hard edge.
    const voidGrad = ctx.createRadialGradient(cx, cy, ir * 0.70, cx, cy, ir);
    voidGrad.addColorStop(0, 'rgba(0,0,0,1)');
    voidGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.beginPath();
    ctx.arc(cx, cy, ir, 0, Math.PI * 2);
    ctx.fillStyle = voidGrad;
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
