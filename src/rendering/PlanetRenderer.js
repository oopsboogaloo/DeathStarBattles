// Copyright © 2026 Chloe Bolland
// contact chloe@mammoththoughts.com if you wish to use, publish or reproduce this game or any part of it in any way

import { ShadingStyle, PlanetType, GAS_GIANT_COLOUR_PAIRS } from '../entities/Planet.js';

// Set by Renderer before drawing backgrounds in simplified performance mode.
// Also gates the animated star fire rim, which runs in full and experimental
// modes (everything except simplified).
let _simplified = false;
export function setPlanetRendererSimplified(v) { _simplified = v; }

export class PlanetRenderer {
  // Pass 1: draw only corona/glow effects (so they sit behind solid planet bodies)
  static drawCorona(ctx, planet, conv, bounds) {
    if (planet.shading === ShadingStyle.GLOWING) {
      PlanetRenderer._drawStarCorona(ctx, planet, conv, bounds);
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

        // Base silhouette fill: this polygon is wildly non-convex (deep spikes),
        // so a flat dark fill of the full outline guarantees space never shows
        // through any seam between the facet triangles below.
        ctx.beginPath();
        ctx.moveTo(outer[0].x, outer[0].y);
        for (let i = 1; i < n; i++) ctx.lineTo(outer[i].x, outer[i].y);
        ctx.closePath();
        ctx.fillStyle = `rgb(${Math.round(pr * 0.35)},${Math.round(pg * 0.35)},${Math.round(pb * 0.35)})`;
        ctx.fill();

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
          // C — inner ledge face (inward-pointing triangle of the mid→core ring)
          [nx, ny] = outwardNormal(mid[h].x, mid[h].y, mid[i].x, mid[i].y);
          shade(nx, ny);
          ctx.beginPath(); ctx.moveTo(mid[h].x, mid[h].y); ctx.lineTo(mid[i].x, mid[i].y); ctx.lineTo(core[i].x, core[i].y); ctx.closePath(); ctx.fill();
          // D — inner ledge valley (outward-pointing companion of C). Without this
          // the mid→core ring is only half-tiled, leaving the star-shaped holes.
          [nx, ny] = outwardNormal(core[i].x, core[i].y, core[j].x, core[j].y);
          shade(nx, ny);
          ctx.beginPath(); ctx.moveTo(core[i].x, core[i].y); ctx.lineTo(mid[i].x, mid[i].y); ctx.lineTo(core[j].x, core[j].y); ctx.closePath(); ctx.fill();
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
  static _drawStarCorona(ctx, planet, conv, bounds) {
    const cx = planet.position.x * conv;
    const cy = planet.position.y * conv;
    const r  = Math.max(3, planet.radius * conv);
    const [pr, pg, pb] = planet.colour;

    const cr = Math.floor(pr * 0.30);
    const cg = Math.floor(pg * 0.38);
    const cb = Math.floor(pb * 0.15);

    // Clip the corona bounding box to the visible local-space region (the padded
    // bgCanvas, which includes the bar + overscroll border) so the corona bleeds past
    // the world edge instead of being cut there. Falls back to the raw canvas extent.
    // For off-screen supergiants the bounding box can be many times the screen size;
    // blurring a canvas that large is very expensive, hence the clamp.
    const xMin = bounds ? Math.floor(bounds.xMin) : 0;
    const yMin = bounds ? Math.floor(bounds.yMin) : 0;
    const xMax = bounds ? Math.ceil(bounds.xMax)  : ctx.canvas.width;
    const yMax = bounds ? Math.ceil(bounds.yMax)  : ctx.canvas.height;
    const margin = 4;
    const bx0 = Math.max(xMin, Math.floor(cx - r * 3.2) - margin);
    const by0 = Math.max(yMin, Math.floor(cy - r * 3.2) - margin);
    const bx1 = Math.min(xMax, Math.ceil(cx  + r * 3.2) + margin);
    const by1 = Math.min(yMax, Math.ceil(cy  + r * 3.2) + margin);
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

    // Star surface fringe — thin spikey bristles baked into the cached
    // background for every star, in all performance modes and at all sizes.
    // In full and experimental modes an ANIMATED fire rim is also drawn live
    // every frame on top (Renderer._drawStarFireRims); this baked fringe sits
    // beneath it.
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

  // Cheap crisp star glow for the zoom/pan gesture: the chromosphere ring plus the
  // five radial-gradient halo layers from _drawStarCorona, drawn straight onto ctx
  // with no offscreen canvas, no blur, and no bristles (the expensive parts). The
  // big soft coronal halo otherwise lives ONLY in the cached background, so while
  // that background is a scaled/shifted blit it stops covering the area around the
  // crisp body — leaving the body's hard disc edge cutting into black, glaring on
  // screen-filling supergiants. This fills that region with the star's real
  // coloured glow for the cost of ~6 gradient fills (each clipped to the canvas).
  // The fine bristle texture stays soft in the background and snaps crisp on settle.
  static drawStarGlow(ctx, cx, cy, r, colour) {
    const [pr, pg, pb] = colour;
    const cr = Math.floor(pr * 0.30);
    const cg = Math.floor(pg * 0.38);
    const cb = Math.floor(pb * 0.15);

    // Chromosphere ring hugging the surface
    const ringGrad = ctx.createRadialGradient(cx, cy, r * 0.85, cx, cy, r * 1.45);
    ringGrad.addColorStop(0,    `rgba(${cr},${cg},${cb},0)`);
    ringGrad.addColorStop(0.35, `rgba(${cr},${cg},${cb},0.72)`);
    ringGrad.addColorStop(1,    `rgba(${cr},${cg},${cb},0)`);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.45, 0, Math.PI * 2);
    ctx.fillStyle = ringGrad;
    ctx.fill();

    // Wider atmospheric glow — five stacked transparent layers out to 3.2× r
    const layers = [
      { scale: 1.0, alpha: 0.35 },
      { scale: 1.4, alpha: 0.22 },
      { scale: 1.9, alpha: 0.14 },
      { scale: 2.5, alpha: 0.08 },
      { scale: 3.2, alpha: 0.04 },
    ];
    for (const { scale, alpha } of layers) {
      const lr   = r * scale;
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, lr);
      grad.addColorStop(0, `rgba(${cr},${cg},${cb},${alpha})`);
      grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.beginPath();
      ctx.arc(cx, cy, lr, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }

  // ----------------------------------------------------------------
  // Star fire rim (experimental) — 3 stacked jagged solid bands hugging the
  // star surface. Each band fills from an inner edge at the body radius up to an
  // irregular zigzag outer edge whose lower/upper vertices float above the
  // surface. The nearest band (drawn last) is the star colour and each band
  // behind it is progressively darker, so the fringe deepens outward.
  //
  // Drawn live each frame DIRECTLY onto the main canvas (no offscreen, no blur):
  // each band is one filled annular ribbon, so only the rim pixels rasterise —
  // never the star's interior. Only the teeth whose sector is on screen are
  // generated and drawn, so a supergiant larger than the viewport costs just the
  // visible arc, not its whole bounding box.
  //
  // Animated: every vertex radius oscillates within its [lo, hi] envelope as a
  // smooth function of wall-clock time, so the points glide up and down like
  // licking flames. Motion is deterministic — a stable per-vertex phase derived
  // from a hash of the vertex index, summed over two octaves (slow swell + fast
  // flicker) — so no per-star state is stored and it survives zoom changes. The
  // angular jitter is hashed (static) too, so teeth keep their identity.
  // ----------------------------------------------------------------
  static drawStarFireRim(ctx, cx, cy, r, colour, bounds) {
    const [pr, pg, pb] = colour;
    const TAU   = Math.PI * 2;
    const teeth = Math.max(108, Math.round(r * 0.84)); // ~3× the previous density
    const step  = TAU / teeth;
    const t     = performance.now() / 1000;            // seconds — drives the animation

    // Visibility mask: which teeth sit within the viewport (margin covers the
    // tip reach, including the boosted tips on smaller stars). Off-screen teeth
    // are never generated or drawn.
    const m   = r * 0.10 + 4;
    const vis = new Uint8Array(teeth);
    let anyVis = false, allVis = true;
    for (let i = 0; i < teeth; i++) {
      const a = (i + 0.5) * step;
      const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
      const v = x >= bounds.xMin - m && x <= bounds.xMax + m && y >= bounds.yMin - m && y <= bounds.yMax + m;
      vis[i] = v ? 1 : 0;
      if (v) anyVis = true; else allVis = false;
    }
    if (!anyVis) return;

    // Contiguous visible runs as sequences of valley indices (each run carries
    // one trailing valley so its last tooth closes). Full circle → one run.
    const runs = [];
    if (allVis) {
      const seq = [];
      for (let i = 0; i <= teeth; i++) seq.push(i);
      runs.push(seq);
    } else {
      let start = 0;
      for (let i = 0; i < teeth; i++) if (vis[i] && !vis[(i - 1 + teeth) % teeth]) { start = i; break; }
      let k = 0;
      while (k < teeth) {
        const idx = (start + k) % teeth;
        if (!vis[idx]) { k++; continue; }
        const seq = [idx];
        let j = k + 1;
        while (j < teeth && vis[(start + j) % teeth]) { seq.push((start + j) % teeth); j++; }
        seq.push((start + j) % teeth); // trailing valley closes the last visible tooth
        runs.push(seq);
        k = j + 1;
      }
    }

    // Stable pseudo-random in [0,1) — per-vertex phase, frequency and angular jitter.
    const hash = n => { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); };
    // Smooth oscillation in [-1,1]: slow swell plus a smaller faster flicker.
    const wave = (i, seed, baseFreq) => {
      const f = baseFreq * (0.8 + 0.4 * hash(i + seed + 3.7));
      return 0.7 * Math.sin(t * f         + hash(i + seed)        * TAU)
           + 0.3 * Math.sin(t * f * 2.7   + hash(i + seed + 11.3) * TAU);
    };
    const jit = step * 0.45;

    // One band: a filled annular ribbon over every visible run (single fill).
    const band = (rInner, vLo, vHi, tLo, tHi, seed, fill) => {
      const vMid = (vLo + vHi) / 2, vAmp = (vHi - vLo) / 2;
      const tMid = (tLo + tHi) / 2, tAmp = (tHi - tLo) / 2;
      ctx.fillStyle = fill;
      ctx.beginPath();
      for (const seq of runs) {
        const L = seq.length;
        for (let p = 0; p < L; p++) {            // outer edge: valley, tip, valley, …
          const vi = seq[p];
          const av = vi * step + (hash(vi + seed + 50) - 0.5) * jit;
          const rv = vMid + vAmp * wave(vi, seed, 2.2);
          const vx = cx + Math.cos(av) * rv, vy = cy + Math.sin(av) * rv;
          if (p === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
          if (p < L - 1) {
            const at = vi * step + step * 0.5 + (hash(vi + seed + 70) - 0.5) * jit;
            const rt = tMid + tAmp * wave(vi, seed + 5, 2.8);
            ctx.lineTo(cx + Math.cos(at) * rt, cy + Math.sin(at) * rt);
          }
        }
        for (let p = L - 1; p >= 0; p--) {       // inner edge, traced back
          const vi = seq[p];
          const av = vi * step + (hash(vi + seed + 50) - 0.5) * jit;
          ctx.lineTo(cx + Math.cos(av) * rInner, cy + Math.sin(av) * rInner);
        }
      }
      ctx.fill();
    };

    const rgb  = (cr, cg, cb) => `rgb(${cr | 0},${cg | 0},${cb | 0})`;
    const star = rgb(pr, pg, pb);
    const mid  = rgb(pr * 0.70, pg * 0.70, pb * 0.70);
    const dark = rgb(pr * 0.45, pg * 0.45, pb * 0.45);
    const rIn  = r * 1.0; // body edge — only the teeth extend beyond

    // Smaller (non-supergiant) stars get a 50% taller tip reach — the effect is
    // too subtle at small on-screen sizes. Screen-filling supergiants already
    // read well, so they stay at 1×. Classified by on-screen size.
    const visW = bounds.xMax - bounds.xMin;
    const visH = bounds.yMax - bounds.yMin;
    const tipScale = r >= 0.6 * Math.min(visW, visH) ? 1.0 : 1.5;
    const tip = k => r * (1 + (k - 1) * tipScale); // scale the tip's height above the surface

    //   rInner  valley range            tip range                   seed  fill
    band(rIn, r * 1.0100, r * 1.0250, tip(1.0325), tip(1.0550),   0, dark);  // furthest back — darkest
    band(rIn, r * 1.0050, r * 1.0200, tip(1.0225), tip(1.0400), 100, mid);   // middle — dimmed star colour
    band(rIn, r * 1.0025, r * 1.0125, tip(1.0125), tip(1.0275), 200, star);  // nearest surface — star colour
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
