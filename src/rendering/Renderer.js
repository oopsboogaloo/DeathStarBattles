// Copyright © 2026 Chloe Bolland
// contact chloe@mammoththoughts.com if you wish to use, publish or reproduce this game or any part of it in any way

import { PlanetRenderer, setPlanetRendererSimplified } from './PlanetRenderer.js';
import { ShadingStyle, PlanetType } from '../entities/Planet.js';
import { WormholeParticles } from './WormholeParticles.js';
import { GiantWormholeParticles } from './GiantWormholeParticles.js';
import { WhiteHoleParticles } from './WhiteHoleParticles.js';
import { StarSurfaceParticles } from './StarSurfaceParticles.js';
import { PhysicsEngine, G, TIMESTEP, MIN_POWER, MAX_POWER } from '../physics/PhysicsEngine.js';
import { SCENARIO_NAMES } from '../scenarios/scenarioData.js';
import { ROCKET_BASE_MASS, ROCKET_THRUST, ROCKET_FUEL_BURN_RATE,
         ROCKET_MIN_FUEL, ROCKET_MAX_FUEL, ROCKET_LAUNCH_SPEED } from '../entities/Rocket.js';
import { PLANET_OVERLAYS } from './planetOverlays.js';
import { getSprite } from './sprites/index.js';
import { SpriteSheetCache } from './sprites/SpriteSheetCache.js';

const MAX_STATION_SPEED = 0.015; // must match GameLoop.MAX_STATION_SPEED

const ANOMALY_INWARD_CFG = {
  count: 35, spawnMult: 8.0, voidMult: 1.2,
  angularSpeed: 0.4, momentumExp: 1.4, inwardFrac: 0.35,
  blobMult: 0.55, blobMinMult: 0.15, alphaMax: 0.20,
  alphaFadeMult: 0.35, hueRange: 20, glowLayers: 2,
  arms: 0, armSpread: 0, armRotSpeed: 0,
};

export class Renderer {
  constructor(mainCanvas) {
    this.mainCanvas = mainCanvas;
    this.mainCtx    = mainCanvas.getContext('2d');

    // Off-screen canvases — not attached to DOM
    this.bgCanvas     = document.createElement('canvas');
    this.bgCtx        = this.bgCanvas.getContext('2d');
    this.trailsCanvas = document.createElement('canvas');
    this.trailsCtx    = this.trailsCanvas.getContext('2d');

    this.width  = mainCanvas.width  || 800;
    this.height = mainCanvas.height || 600;
    this._stars       = [];
    this._planets     = [];
    this._performance = 'full'; // 'full' | 'simplified'
    this._isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    // Letterbox / pillarbox viewport — updated by resize() and setGameAspect()
    this._gameAspect = null; // null = no lock yet, fill window
    this._vpW = this.width;
    this._vpH = this.height;
    this._ox  = 0; // x offset of viewport within canvas (pillarbox bars)
    this._oy  = 0; // y offset of viewport within canvas (letterbox bars)
    this._aimCircleScale      = 1;
    this._bulletPathMaxLength = 0;
    this._svgOverlayCache     = new Map(); // planet → [{img, rotation, alpha}]
    this._atmosphereCache     = new Map(); // planet → [r, g, b]
    this._crackSvgImgs        = [];        // pool of crack SVG images, one picked randomly per hit
    this._wormholeParticles      = new Map(); // planet → WormholeParticles
    this._giantWormholeParticles = new Map(); // planet → GiantWormholeParticles
    this._whiteHoleParticles     = new Map(); // planet → WhiteHoleParticles
    this._starSurfaceParticles   = new Map(); // planet → StarSurfaceParticles (experimental)
    this._gasGiantCanvas      = null;      // combined viewport-sized canvas, rebuilt on game start/resize/SVG load
    this._gasGiantBitmap      = null;      // ImageBitmap snapshot for zero-flush drawImage
    this._smokeImg            = null;
    this._smokeTintCache      = new Map(); // "r,g,b" → tinted canvas
    this._spriteColorCache    = new Map(); // "r,g,b" → {primary, secondary} CSS colours
    this._spriteSheetCache    = new SpriteSheetCache(); // per-team pre-rendered animation frames
    this._loadSmokeSprite();

    this._debugOn   = false;
    this._debugEl   = null;
    this._fpsPrev   = null;
    this._fpsSmooth = 0;
  }

  setAimCircleScale(scale)      { this._aimCircleScale = scale ?? 1; }
  setBulletPathLength(setting) {
    const LENGTHS = { off: 0, full: 700, half: 350, quarter: 175, eighth: 87.5 };
    this._bulletPathMaxLength = LENGTHS[setting] ?? 0;
  }

  // Set which team is visible during a TP turn (null = show all, normal mode)
  setTPVisibleTeam(teamIndex) { this._tpVisibleTeamIndex = teamIndex ?? null; }

  setPerformance(mode) {
    this._performance = mode ?? 'full';
    setPlanetRendererSimplified(this._simplified);
  }
  get _simplified()     { return this._performance === 'simplified'; }
  get _isExperimental() { return this._performance === 'experimental' || this._performance === 'full'; }
  get _useCircles()     { return this._performance === 'full' || (this._performance === 'experimental' && this._isIOS); }

  // Returns game-unit dimensions of the visible viewport.
  get worldSize() { return { w: this._vpW / (this.conv || 1), h: this._vpH / (this.conv || 1) }; }

  // True if a circle at canvas-pixel (px,py) with given pixel radius overlaps the viewport.
  _isVisible(px, py, radius) {
    return px + radius >= 0 && px - radius <= this._vpW &&
           py + radius >= 0 && py - radius <= this._vpH;
  }

  setDebugMode(on) {
    this._debugOn = !!on;
    if (on && !this._debugEl) {
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;top:8px;left:8px;background:rgba(0,0,0,0.55);color:#fff;font:11px/1.7 monospace;padding:5px 9px;border-radius:4px;pointer-events:none;white-space:pre;z-index:9999';
      document.body.appendChild(d);
      this._debugEl = d;
    }
    if (this._debugEl) this._debugEl.style.display = on ? 'block' : 'none';
    if (!on) { this._fpsPrev = null; this._fpsSmooth = 0; }
  }

  // ----------------------------------------------------------------
  // Layout
  // ----------------------------------------------------------------

  // Called at game start to lock in the aspect ratio for the lifetime of that game.
  setGameAspect(gw, gh) {
    this._gameAspect = (gw && gh) ? gw / gh : null;
    this._calcViewport(this.width, this.height);
    this.bgCanvas.width      = this._vpW;
    this.bgCanvas.height     = this._vpH;
    this.trailsCanvas.width  = this._vpW;
    this.trailsCanvas.height = this._vpH;
  }

  // Compute letterbox/pillarbox dimensions to fit _gameAspect into w×h.
  _calcViewport(w, h) {
    if (!this._gameAspect) {
      this._vpW = w; this._vpH = h; this._ox = 0; this._oy = 0;
      return;
    }
    const winAspect = w / h;
    if (winAspect > this._gameAspect) {
      // Wider than game — pillarbox (black bars left/right)
      this._vpH = h;
      this._vpW = Math.round(h * this._gameAspect);
      this._ox  = Math.round((w - this._vpW) / 2);
      this._oy  = 0;
    } else {
      // Taller than game — letterbox (black bars top/bottom)
      this._vpW = w;
      this._vpH = Math.round(w / this._gameAspect);
      this._ox  = 0;
      this._oy  = Math.round((h - this._vpH) / 2);
    }
  }

  resize(w, h) {
    this.width  = w;
    this.height = h;
    this.mainCanvas.width  = w;
    this.mainCanvas.height = h;
    this._calcViewport(w, h);
    this.bgCanvas.width     = this._vpW;
    this.bgCanvas.height    = this._vpH;
    this.trailsCanvas.width  = this._vpW;
    this.trailsCanvas.height = this._vpH;
    if (this._stars.length) { this._renderBackground(); this._buildGasGiantCanvas(); }
  }

  // All game positions are in a 700-unit-wide coordinate space.
  // conv and gameHeight are derived from the viewport, not the full canvas.
  get conv()       { return this._vpW / 700; }
  get gameWidth()  { return 700; }
  get gameHeight() { return this._vpH / this.conv; }

  // ----------------------------------------------------------------
  // Layer 0 — Background (stars + planets, drawn once per game)
  // ----------------------------------------------------------------

  drawBackground(stars, planets, rifts = [], opts = {}) {
    this._stars       = stars;
    this._planets     = planets;
    this._rifts       = rifts;
    this._noStarField      = !!opts.noStarField;
    this._tunnelBackground = !!opts.tunnelBackground;
    this._svgOverlayCache.clear();
    this._atmosphereCache.clear();
    this._crackSvgImgs = [];
    this._wormholeParticles.clear();
    this._giantWormholeParticles.clear();
    this._whiteHoleParticles.clear();
    this._starSurfaceParticles.clear();
    this._gasGiantCanvas = null;
    this._gasGiantBitmap = null;
    for (const planet of planets) {
      if (planet.anomalyRepels !== undefined) {
        if (planet.anomalyRepels) {
          this._wormholeParticles.set(planet, new WormholeParticles(planet, ANOMALY_INWARD_CFG));
        } else {
          this._whiteHoleParticles.set(planet, new WhiteHoleParticles(planet));
        }
      } else if (planet.shading === ShadingStyle.WORMHOLE) {
        // Giant particle system only for portals whose capture ring is
        // decoupled from the physics radius (Big Wormhole); large wormholes
        // with impactRadius === radius keep the standard swirl, matching
        // PlanetRenderer._drawWormhole.
        if (planet.radius > 100 && planet.impactRadius !== planet.radius) {
          this._giantWormholeParticles.set(
            planet, new GiantWormholeParticles(planet, this.gameWidth, this.gameHeight)
          );
        } else {
          this._wormholeParticles.set(planet, new WormholeParticles(planet, planet.particleConfig));
        }
      } else if (planet.type === PlanetType.WHITE_HOLE) {
        this._whiteHoleParticles.set(planet, new WhiteHoleParticles(planet));
      } else if (planet.type === PlanetType.STAR && planet.shading === ShadingStyle.GLOWING) {
        // Surface bubbling — consumed in full and experimental modes (gated in
        // _drawLive), but built unconditionally so toggling mode needs no rebuild.
        this._starSurfaceParticles.set(planet, new StarSurfaceParticles(planet));
      }
    }

    const ATMOS_COLS = [
      [ 60, 120, 220], [ 80, 160, 255],  // blues
      [ 60, 200, 100], [ 80, 220, 140],  // greens
      [220,  60,  60], [240, 100,  50],  // reds
      [240, 210,  50], [200, 240,  60],  // yellows
    ];
    for (const planet of planets) {
      if (planet.shading !== ShadingStyle.ROCKY && planet.shading !== ShadingStyle.GAS_GIANT) continue;
      if (planet.type === PlanetType.MOON || planet.vertices) continue;
      // atmosColour lets a scenario pin the halo colour (e.g. Sol's Earth is
      // always blue, Mars rust); otherwise one is rolled at random
      this._atmosphereCache.set(planet, planet.atmosColour ?? ATMOS_COLS[Math.floor(Math.random() * ATMOS_COLS.length)]);
    }
    this._renderBackground();
    this._buildGasGiantCanvas();
    if (!this._simplified) this._loadPlanetOverlays(planets); // async, fire-and-forget
    this._loadCrackSvgs();             // async, fire-and-forget
  }

  _renderBackground() {
    const ctx = this.bgCtx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this._vpW, this._vpH);
    if (this._tunnelBackground) this._drawWormholeTunnel(ctx);
    else if (!this._noStarField) this._drawStarField(ctx);
    // Pass 1: coronas/bristles behind everything
    // Skip asteroids (drawn live — rotating), gas giants (drawn live — transparent), and comets (dynamic)
    for (const planet of this._planets) {
      if (planet.vertices || planet.shading === ShadingStyle.GAS_GIANT || planet.type === PlanetType.COMET || planet.type === PlanetType.MOON) continue;
      PlanetRenderer.drawCorona(ctx, planet, this.conv);
    }
    // Pass 1b: atmosphere glow rings (drawn before solid body so planet covers interior)
    if (!this._simplified) for (const planet of this._planets) {
      if (planet.shading !== ShadingStyle.ROCKY || planet.type === PlanetType.MOON || planet.vertices) continue;
      this._drawAtmosphere(ctx, planet);
    }
    // Pass 2: solid bodies on top
    for (const planet of this._planets) {
      if (planet.vertices || planet.shading === ShadingStyle.GAS_GIANT || planet.type === PlanetType.COMET || planet.type === PlanetType.MOON) continue;
      PlanetRenderer.draw(ctx, planet, this.conv);
    }
    // Pass 3: SVG overlays for static bodies, then polar caps and shading gradient on top
    if (!this._simplified) for (const planet of this._planets) {
      if (planet.vertices || planet.shading === ShadingStyle.GAS_GIANT || planet.type === PlanetType.COMET || planet.type === PlanetType.MOON) continue;
      const overlays = this._svgOverlayCache.get(planet);
      if (overlays) for (const entry of overlays) this._drawSVGOverlay(ctx, planet, entry);
      if (planet.polarCap) this._drawPolarCap(ctx, planet);
      if (!overlays) continue;
      this._drawShadingOverlay(ctx, planet);
    }
    // Pass 4: space rifts above planets
    for (const rift of this._rifts ?? []) this._drawRift(ctx, rift);
  }

  rebuildBackground() {
    this._renderBackground();
  }

  _drawRift(ctx, rift) {
    const conv     = this.conv;
    const pts      = rift.vertices.map(v => ({ x: v.x * conv, y: v.y * conv }));
    if (pts.length < 2) return;

    // Blue palette for reflective rifts; purple for standard repulsion rifts.
    const glowRGB   = rift.reflective ? '64,160,255'  : '192,96,255';
    const coreRGB   = rift.reflective ? '180,224,255' : '232,192,255';
    const shadowHex = rift.reflective ? '#B4E0FF'     : '#E8C0FF';

    const buildPath = () => {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    };

    // Outer glow — multi-pass gradient from wide/transparent to narrow/opaque
    ctx.save();
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';
    const glowPasses = [
      { width: 80, alpha: 0.02 },
      { width: 62, alpha: 0.04 },
      { width: 48, alpha: 0.07 },
      { width: 36, alpha: 0.11 },
      { width: 26, alpha: 0.16 },
      { width: 18, alpha: 0.22 },
      { width: 10, alpha: 0.28 },
    ];
    for (const pass of glowPasses) {
      ctx.strokeStyle = `rgba(${glowRGB},${pass.alpha})`;
      ctx.lineWidth   = pass.width;
      buildPath();
      ctx.stroke();
    }
    ctx.restore();

    // Forked lightning decorations (cosmetic — Math.random() intentional)
    const nForks = 20;
    for (let f = 0; f < nForks; f++) {
      const t     = Math.random();
      const seg   = Math.floor(t * (pts.length - 1));
      const frac  = t * (pts.length - 1) - seg;
      const startX = pts[seg].x + (pts[seg + 1].x - pts[seg].x) * frac;
      const startY = pts[seg].y + (pts[seg + 1].y - pts[seg].y) * frac;
      this._drawLightningBranch(ctx, startX, startY, Math.random() * Math.PI * 2, 3 + Math.floor(Math.random() * 4), 0.3 + Math.random() * 0.2, 2, glowRGB);
    }

    // Inner glow pass
    ctx.save();
    ctx.shadowColor = shadowHex;
    ctx.shadowBlur  = 8;
    ctx.strokeStyle = `rgba(${coreRGB},0.35)`;
    ctx.lineWidth   = 7;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    buildPath();
    ctx.stroke();
    ctx.restore();

    // Core line
    ctx.save();
    ctx.strokeStyle = `rgba(${coreRGB},0.95)`;
    ctx.lineWidth   = 2;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    buildPath();
    ctx.stroke();
    ctx.restore();
  }

  _drawLightningBranch(ctx, x, y, dir, segs, alpha, depth, rgb = '192,96,255') {
    if (segs <= 0 || alpha < 0.05) return;
    const segLen = 12 + Math.random() * 18; // 12–30 px per segment
    ctx.save();
    ctx.strokeStyle = `rgba(${rgb},${alpha.toFixed(2)})`;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    let cx = x, cy = y, angle = dir;
    for (let i = 0; i < segs; i++) {
      angle += (Math.random() * 2 - 1) * (Math.PI * 40 / 180); // ±40°
      cx += Math.cos(angle) * segLen;
      cy += Math.sin(angle) * segLen;
      ctx.lineTo(cx, cy);
    }
    ctx.stroke();
    ctx.restore();
    // Fork once at minimum
    if (depth > 0) {
      const forkPt = Math.floor(segs * (0.3 + Math.random() * 0.4));
      let bx = x, by = y, ba = dir;
      for (let i = 0; i < forkPt; i++) {
        ba += (Math.random() * 2 - 1) * (Math.PI * 40 / 180);
        bx += Math.cos(ba) * segLen;
        by += Math.sin(ba) * segLen;
      }
      const subSegs = Math.max(1, Math.floor(segs * 0.6));
      this._drawLightningBranch(ctx, bx, by, ba + (Math.random() - 0.5) * Math.PI, subSegs, alpha * 0.6, depth - 1, rgb);
      this._drawLightningBranch(ctx, bx, by, ba - (Math.random() - 0.5) * Math.PI, subSegs, alpha * 0.6, depth - 1, rgb);
    }
  }

  _drawWormholeTunnel(ctx) {
    const W = this._vpW, H = this._vpH;
    const conv = this.conv;

    // Black base — outside the rift boundary remains black
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // Clip all drawing to the interior of the boundary rift polygon
    ctx.save();
    const boundaryRift = this._rifts?.find(r => r.isBoundary);
    if (boundaryRift) {
      ctx.beginPath();
      const verts = boundaryRift.vertices;
      ctx.moveTo(verts[0].x * conv, verts[0].y * conv);
      for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x * conv, verts[i].y * conv);
      ctx.closePath();
      ctx.clip();
    }

    // Soft radial glow at the vanishing point — the far end of the tunnel
    const vx = W * 0.53, vy = H * 0.54;
    const glowR = Math.min(W, H) * 0.25;
    const glow  = ctx.createRadialGradient(vx, vy, 0, vx, vy, glowR);
    glow.addColorStop(0,   'rgba(30,10,60,0.50)');
    glow.addColorStop(0.5, 'rgba(10,5,30,0.22)');
    glow.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // 32 concentric ellipses — deep perspective: inner rings tiny, outer rings fill the rift
    const N    = 32;
    const maxA = W * 0.48, maxB = H * 0.48;
    const minA = W * 0.006, minB = H * 0.006;
    ctx.globalCompositeOperation = 'lighter';

    for (let i = 0; i < N; i++) {
      const t      = (i + 1) / N;        // 0 → 1 inner to outer
      const tCurve = t * t;              // t² — strong perspective: inner rings very small and tightly packed

      // Centre drifts from vanishing point (innermost) toward canvas centre (outermost)
      const ex = vx + (W / 2 - vx) * t;
      const ey = vy + (H / 2 - vy) * t;

      const a = minA + (maxA - minA) * tCurve;
      const b = minB + (maxB - minB) * tCurve;

      // Spiral twist: ~3° per ring, 32 rings ≈ 96° total
      const rot = i * 0.052;

      const isBlue  = i % 2 === 0;
      const hue     = isBlue ? 225 + i * 1.2 : 268 + i * 0.7;
      const lness   = Math.round(5 + t * 9);
      const alpha   = 0.28 + t * 0.50;
      const strokeW = 0.5 + t * 2.0;

      ctx.beginPath();
      ctx.ellipse(ex, ey, a, b, rot, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${hue},68%,${lness}%,${alpha})`;
      ctx.lineWidth   = strokeW;
      ctx.stroke();
    }

    ctx.restore(); // removes clip, restores composite to source-over
  }

  _drawStarField(ctx) {
    const conv = this.conv;
    ctx.globalCompositeOperation = 'lighter';

    for (const star of this._stars) {
      const px = star.gx * conv;
      const py = star.gy * conv;
      const pr = Math.max(0.5, star.gr * conv);
      const a  = star.alpha ?? 1;
      const { red: r, green: g, blue: b } = star;

      const grad = ctx.createRadialGradient(px, py, 0, px, py, pr);
      if (star.giant) {
        // Soft diffuse nebula smear — no sharp core, fades from centre outward
        grad.addColorStop(0,    `rgba(${r},${g},${b},${a * 0.5})`);
        grad.addColorStop(0.25, `rgba(${r},${g},${b},${a * 0.3})`);
        grad.addColorStop(0.6,  `rgba(${r},${g},${b},${a * 0.1})`);
        grad.addColorStop(1,    `rgba(${r},${g},${b},0)`);
      } else {
        // Hot core: nudge toward white for an emissive feel
        const cr = Math.min(255, r + 60);
        const cg = Math.min(255, g + 60);
        const cb = Math.min(255, b + 60);
        // Wide bright centre, steep falloff in outer ~25%
        grad.addColorStop(0,    `rgba(${cr},${cg},${cb},${a})`);
        grad.addColorStop(0.55, `rgba(${r},${g},${b},${a})`);
        grad.addColorStop(0.82, `rgba(${Math.floor(r * 0.4)},${Math.floor(g * 0.4)},${Math.floor(b * 0.4)},${a * 0.4})`);
        grad.addColorStop(1,    `rgba(${r},${g},${b},0)`);
      }

      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  // ----------------------------------------------------------------
  // Layer 1 — Trails (cleared each turn, appended during fire phase)
  // ----------------------------------------------------------------

  clearTrails() {
    this.trailsCtx.clearRect(0, 0, this._vpW, this._vpH);
  }

  // Draw the latest trail segment — call each time a trail point is pushed.
  // null entries in the trail array are wormhole break markers — skip that segment.
  appendTrailPoint(bullet) {
    const trail = bullet.trail;
    if (trail.length < 2) return;
    const prev = trail[trail.length - 2];
    const cur  = trail[trail.length - 1];
    if (!cur) return; // cur is a wormhole marker — nothing to draw yet
    const ctx  = this.trailsCtx;
    const conv = this.conv;
    const [tr, tg, tb] = bullet.owner.team.colour;

    if (!prev) {
      // First point after a wormhole exit — draw a tiny anchor dot so the
      // next segment has something to connect to visually.
      ctx.beginPath();
      ctx.arc(cur.x * conv, cur.y * conv, Math.max(1, conv * 0.5), 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${tr},${tg},${tb})`;
      ctx.fill();
      return;
    }

    if (bullet.reinforcementSignal) {
      const AMPLITUDE  = 4.8;
      const WAVELENGTH = 30;
      const dx = cur.x - prev.x;
      const dy = cur.y - prev.y;
      const segLen = Math.sqrt(dx * dx + dy * dy);
      if (segLen === 0) return;
      const nx = -dy / segLen;   // perpendicular to segment
      const ny =  dx / segLen;
      const arcStart = bullet._trailArc ?? 0;
      const arcEnd   = arcStart + segLen;
      const w0 = Math.sin(2 * Math.PI * arcStart / WAVELENGTH) * AMPLITUDE;
      const w1 = Math.sin(2 * Math.PI * arcEnd   / WAVELENGTH) * AMPLITUDE;
      ctx.beginPath();
      ctx.moveTo((prev.x + nx * w0) * conv, (prev.y + ny * w0) * conv);
      ctx.lineTo((cur.x  + nx * w1) * conv, (cur.y  + ny * w1) * conv);
      ctx.strokeStyle = `rgba(${tr},${tg},${tb},1)`;
      ctx.lineWidth   = Math.max(1, conv * 0.6);
      ctx.stroke();
      bullet._trailArc = arcEnd;
      return;
    }

    ctx.beginPath();
    ctx.moveTo(prev.x * conv, prev.y * conv);
    ctx.lineTo(cur.x  * conv, cur.y  * conv);
    const alpha = bullet.thinTrail ? 0.28 : 1;
    ctx.strokeStyle = `rgba(${tr},${tg},${tb},${alpha})`;
    ctx.lineWidth   = bullet.thinTrail  ? Math.max(0.5, conv * 0.3)
                    : bullet.thickTrail ? Math.max(1, conv * 1.2)
                    : Math.max(1, conv * 0.6);
    ctx.stroke();
  }

  // ----------------------------------------------------------------
  // Frame composite — every animation frame
  // ----------------------------------------------------------------

  drawFrame(gameState) {
    const ctx = this.mainCtx;
    // Fill entire canvas black — letterbox/pillarbox bars are simply unpainted
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this.width, this.height);
    // Draw viewport layers at their offset position
    ctx.drawImage(this.bgCanvas,     this._ox, this._oy);
    // Animated star fire rim (full + experimental modes) sits above the cached
    // body but below the trails canvas, so bullet/ship trails pass over the
    // flames. Skipped only in simplified mode.
    if (!this._simplified) {
      ctx.save();
      ctx.translate(this._ox, this._oy);
      this._drawStarFireRims(ctx);
      ctx.restore();
    }
    ctx.drawImage(this.trailsCanvas, this._ox, this._oy);
    if (gameState) {
      ctx.save();
      ctx.translate(this._ox, this._oy);
      this._drawLive(ctx, gameState);
      ctx.restore();
    }
    if (this._debugOn && this._debugEl) this._updateDebugOverlay(gameState);
  }

  _updateDebugOverlay(gs) {
    const now = performance.now();
    if (this._fpsPrev !== null) {
      const instant   = 1000 / (now - this._fpsPrev);
      this._fpsSmooth = this._fpsSmooth === 0 ? instant : this._fpsSmooth * 0.9 + instant * 0.1;
    }
    this._fpsPrev = now;

    const celestial = gs?.planets?.length ?? 0;
    const ships     = gs?.teams?.reduce((s, t) => s + t.stations.length, 0) ?? 0;
    const bullets   = (gs?.activeBullets?.length ?? 0) + (gs?.rockets?.length ?? 0);
    const wormholePCount   = [...this._wormholeParticles.values()].reduce((s, wp) => s + wp._cfg.count, 0);
    const wholeParticleCount = [...this._whiteHoleParticles.values()].reduce((s, wp) => s + wp._cfg.count, 0);
    // Star surface bubbles run (and so count) in full and experimental modes.
    const starSurfaceCount = !this._simplified
      ? [...this._starSurfaceParticles.values()].reduce((s, sp) => s + sp.count, 0)
      : 0;
    const sfx       = (gs?.rocketSmoke?.length ?? 0)
                    + (gs?.cometSmoke?.length ?? 0)
                    + (gs?.skimParticles?.length ?? 0)
                    + (gs?.vfxList?.length ?? 0)
                    + (gs?.activeExplosions?.reduce((s, e) => s + (e.particles?.length ?? 0), 0) ?? 0)
                    + (gs?.shipExplosionBloom?.length ?? 0)
                    + (gs?.fireballs?.length ?? 0)
                    + (gs?.fireballSmoke?.length ?? 0)
                    + wormholePCount
                    + wholeParticleCount
                    + starSurfaceCount;

    const sid          = gs?.config?.scenarioId;
    const scenarioName = sid ? (SCENARIO_NAMES[sid] ?? `#${sid}`) : '—';
    const extremeTag   = gs?.config?.isExtreme ? '  EXTREME' : '';
    const wildcardLine = `Wildcards  ${gs?.config?.wildcardDesc ?? '—'}`;

    this._debugEl.textContent =
      `FPS        ${Math.round(this._fpsSmooth)}\n` +
      `Scenario   ${scenarioName}${extremeTag}\n` +
      `${wildcardLine}\n` +
      `Celestial  ${celestial}\n` +
      `Ships      ${ships}\n` +
      `Bullets    ${bullets}\n` +
      `SFX        ${sfx}`;
  }

  // Live per-frame animated fire rim for on-screen stars (full + experimental).
  // ctx is already translated by (_ox, _oy), matching the cached background, so
  // planet positions map straight through this.conv.
  _drawStarFireRims(ctx) {
    for (const planet of this._planets) {
      if (planet.shading !== ShadingStyle.GLOWING || planet.type !== PlanetType.STAR) continue;
      const r = Math.max(3, planet.radius * this.conv);
      if (r <= 20) continue;
      const cx = planet.position.x * this.conv;
      const cy = planet.position.y * this.conv;
      const reach = r * 1.12 + 4;
      if (cx + reach < 0 || cx - reach > this._vpW || cy + reach < 0 || cy - reach > this._vpH) continue;
      PlanetRenderer.drawStarFireRim(ctx, cx, cy, r, planet.colour, this._vpW, this._vpH);
    }
  }

  _drawLive(ctx, gameState) {
    // Wormhole particle spirals (skipped in simplified mode)
    const now = Date.now() / 1000;
    if (!this._simplified) {
      for (const [planet, particles] of this._wormholeParticles) {
        particles.update(now);
        particles.draw(ctx, this.conv, this._useCircles);
      }
      for (const [planet, particles] of this._giantWormholeParticles) {
        particles.update(now);
        particles.draw(ctx, this.conv, this._vpW, this._vpH);
      }
      for (const [planet, particles] of this._whiteHoleParticles) {
        particles.update(now);
        particles.draw(ctx, this.conv, this._useCircles);
      }
    }

    // Star surface bubbling — full and experimental modes (not simplified).
    // White foreshortened ovals boil across each star's visible surface
    // (off-screen patches are skipped).
    if (!this._simplified) {
      for (const [planet, particles] of this._starSurfaceParticles) {
        if (planet.destroyed) continue;
        particles.update(now);
        particles.draw(ctx, this.conv, this._vpW, this._vpH);
      }
    }

    // Pulsar expanding pressure rings
    for (const planet of this._planets) {
      if (planet.type === PlanetType.PULSAR && planet.pulsarPulses?.length) {
        this._drawPulsarRings(ctx, planet);
      }
    }

    // Gas giants — single drawImage of the pre-built combined canvas
    const ggSource = this._gasGiantBitmap ?? this._gasGiantCanvas;
    if (ggSource) ctx.drawImage(ggSource, this._ox, this._oy);

    // Comets — drawn live every frame (they move and are not in the static bg layer)
    for (const planet of gameState.planets) {
      if (planet.type === PlanetType.COMET && !planet.destroyed) this._drawComet(ctx, planet);
    }

    // Rotating asteroids — drawn live every frame so the polygon matches _rotatedVerts
    for (const planet of this._planets) {
      if (planet.vertices && !planet.destroyed) PlanetRenderer.draw(ctx, planet, this.conv);
    }

    // Moons — drawn live so cracks and damage state are always up-to-date
    for (const planet of this._planets) {
      if (planet.type === PlanetType.MOON && !planet.destroyed) this._drawMoon(ctx, planet);
    }

    // Ghost trail of previous shot — helps human players adjust aim
    if ((gameState.mode === 'aiming' || gameState.mode === 'tp_aiming') && gameState.waitingForInput) {
      const active = gameState.activeStation;
      if (active?.lastTrails?.length > 0) this._drawGhostTrail(ctx, active);
    }

    // Bullets + off-screen indicators
    for (const bullet of gameState.activeBullets) {
      if (bullet.status === 'active') {
        if (!this._simplified) this._drawBulletGlow(ctx, bullet);
        this._drawBullet(ctx, bullet);
      }
      if (bullet.status === 'exploding') this._drawExplosion(ctx, bullet);
    }
    this._drawOffScreenIndicators(ctx, gameState.activeBullets, gameState.rockets);

    // Asteroid freestanding explosions (drawn before stations so they sit behind)
    for (const ex of gameState.activeExplosions) {
      this._drawShockwave(ctx, ex.x, ex.y, ex.t, ex.radius * 4, ex.r, ex.g, ex.b);
      if (!this._simplified) this._drawParticles(ctx, ex.particles);
    }

    // Practice targets (TP mode — only the current team's surviving targets)
    if (gameState.tpGame) {
      const tp      = gameState.tpGame;
      const teamIdx = this._tpVisibleTeamIndex;

      tp.targets.forEach((tgt, i) => {
        const show = teamIdx !== null && teamIdx !== undefined
          ? !tp.isTargetDestroyed(teamIdx, i)
          : [...tp.teamData.values()].some(d => !d.targetDestroyed[i]);
        if (show) this._drawTarget(ctx, tgt);
      });
    }

    // Stations — filter to current team in TP, show all otherwise
    const stationsToRender = (this._tpVisibleTeamIndex !== null && this._tpVisibleTeamIndex !== undefined)
      ? gameState.allStations.filter(s => s.team.index === this._tpVisibleTeamIndex)
      : gameState.allStations;
    for (const station of stationsToRender) {
      if (station.hyperspaceFlash)        this._drawHyperspaceFlash(ctx, station);
      if (station.status === 'exploding') {
        if (station.implosion) this._drawStationImplosion(ctx, station);
        else                   this._drawStationExplosion(ctx, station);
      }
      if (station.shockwave)              this._drawShockwave(ctx, station.position.x, station.position.y, station.shockwave.t, station.radius * 5, station.shockwave.r, station.shockwave.g, station.shockwave.b);
      if (station.status !== 'dead')      this._drawStation(ctx, station);
      if (!this._simplified && station.particles?.length) this._drawParticles(ctx, station.particles);
    }

    // Velocity indicators — all active stations with a move queued.
    // Electrified stations move at a hidden random vector — no indicator.
    if (gameState.stationMovement) {
      for (const station of gameState.allStations) {
        if (station.status === 'active' && station.velocity && (station.electrified ?? 0) === 0) {
          this._drawVelocityIndicator(ctx, station);
        }
      }
    }

    // Experimental bitmap explosions (full and experimental modes)
    if (this._isExperimental) {
      if (gameState.shipExplosionBloom?.length) this._drawShipExplosionBloom(ctx, gameState.shipExplosionBloom);
      if (gameState.fireballs?.length)          this._drawFireballs(ctx, gameState.fireballs);
      if (gameState.fireballSmoke?.length)      this._drawFireballSmoke(ctx, gameState.fireballSmoke);
    }

    // Comet + rocket smoke (drawn behind everything else)
    if (gameState.cometSmoke?.length) this._drawCometSmoke(ctx, gameState.cometSmoke);
    if (gameState.rocketSmoke?.length) this._drawRocketSmoke(ctx, gameState.rocketSmoke);

    // Skim surface rebound particles (FR-6; non-simplified only — guard in GameLoop, safe to draw always)
    if (gameState.skimParticles?.length) this._drawParticles(ctx, gameState.skimParticles);

    // Rocket blast zones (drawn behind rockets and shields)
    if (gameState.rocketBlasts?.length) this._drawRocketBlasts(ctx, gameState.rocketBlasts);

    // Repulsor fields (drawn behind shields)
    if (gameState.repulsorFields?.length) this._drawRepulsorFields(ctx, gameState.repulsorFields);

    // Force shields
    if (gameState.shields?.length) this._drawShields(ctx, gameState.shields);

    // Rockets + trails
    if (gameState.rockets?.length) this._drawRockets(ctx, gameState.rockets);

    // Collectables
    if (gameState.collectables?.length) this._drawCollectables(ctx, gameState.collectables);

    // VFX overlays (collectable shatter, collectable grants, muzzle flashes, laser paths)
    if (gameState.vfxList?.length) this._drawVFX(ctx, gameState.vfxList);

    // Aiming indicator — active station in AIMING or TP_AIMING mode.
    // Frozen/electrified stations get a selection diamond instead: no aim
    // circle or direction line (electrified aim is hidden, frozen can't fire).
    const active = gameState.activeStation;
    if (active && active.status === 'active' && !active.hyperspaceQueued) {
      if (gameState.mode === 'aiming' || gameState.mode === 'tp_aiming') {
        if ((active.electrified ?? 0) > 0 || (active.frozen ?? 0) > 0) {
          this._drawSelectionDiamond(ctx, active);
        } else {
          this._drawAimingIndicator(ctx, active, gameState);
        }
      }
    }

    // HUD (drawn above everything)
    this._drawHUD(ctx, gameState);

    // Mode overlays (gameover screen, turn counter)
    this._drawOverlay(ctx, gameState);
  }

  // ----------------------------------------------------------------
  // HUD — team/station header + angle/power corners
  // Only shown when a human station is aiming (waitingForInput)
  // ----------------------------------------------------------------

  _drawHUD(ctx, gameState) {
    const isTP = gameState.mode === 'tp_aiming' || gameState.mode === 'tp_firing';
    if (!isTP && !gameState.waitingForInput && gameState.mode !== 'aiming') return;
    const station = gameState.activeStation;
    if (!station) return;

    const [cr, cg, cb] = station.team.colour;
    const teamNum  = station.team.index + 1;
    const statNum  = gameState.currentStatIdx + 1;

    // ── "T e a m  N     S t a t i o n  N" — top centre ──
    const headerPx = Math.max(14, Math.floor(this._vpW / 44));
    ctx.save();
    ctx.font         = `bold ${headerPx}px monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle    = `rgb(${cr},${cg},${cb})`;
    ctx.shadowColor  = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur   = 6;
    const tp = gameState.tpGame;
    const roundSuffix = tp ? `   —   Round ${tp.currentRound} / ${tp.totalRounds}` : '';
    const minimal = gameState.config?.minimalUI ?? false;
    const header = minimal
      ? `Team ${teamNum}   S${statNum}${roundSuffix}`
      : `T e a m  ${teamNum}        S t a t i o n  ${statNum}${roundSuffix}`;
    ctx.fillText(header, this._vpW / 2, 10);
    ctx.restore();

    // ── Angle / Power corners (bottom) — or HYPERSPACING ──
    const hudPx = Math.max(18, Math.floor(this._vpW / 50));
    ctx.save();
    ctx.font         = `bold ${hudPx}px monospace`;
    ctx.textBaseline = 'bottom';
    ctx.shadowColor  = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur   = 5;

    if ((station.frozen ?? 0) > 0) {
      const labels = ['', 'F R O Z E N', 'D O U B L E   F R O Z E N', 'T R I P L E   F R O Z E N'];
      const pulse  = 0.55 + 0.45 * Math.sin(Date.now() / 300);
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${pulse})`;
      ctx.fillText(labels[station.frozen] ?? labels[1], this._vpW / 2, this._vpH - 60);
    } else if ((station.electrified ?? 0) > 0) {
      const labels = ['', 'E L E C T R I F I E D', 'D O U B L E   E L E C T R I F I E D', 'T R I P L E   E L E C T R I F I E D'];
      const pulse  = 0.55 + 0.45 * Math.sin(Date.now() / 150);
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${pulse})`;
      ctx.fillText(labels[station.electrified] ?? labels[1], this._vpW / 2, this._vpH - 60);
    } else if (station.hyperspaceQueued) {
      const pulse  = 0.6 + 0.4 * Math.sin(Date.now() / 250);
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${pulse})`;
      ctx.fillText('H Y P E R S P A C I N G . . .', this._vpW / 2, this._vpH - 60);
    }
    // Angle / Power values are now rendered by AimControls DOM buttons
    ctx.restore();
  }

  _drawOverlay(ctx, gameState) {
    if (gameState.mode === 'gameover') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, this._vpW, this._vpH);

      const winner = gameState.winner;
      const fontSize = Math.max(32, Math.floor(this._vpW / 18));
      ctx.font         = `bold ${fontSize}px monospace`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';

      if (winner) {
        const [r, g, b] = winner.colour;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillText('TEAM WINS!', this._vpW / 2, this._vpH / 2 - fontSize * 0.6);
        ctx.fillStyle = '#fff';
        ctx.font      = `${Math.floor(fontSize * 0.55)}px monospace`;
        ctx.fillText('click to play again', this._vpW / 2, this._vpH / 2 + fontSize * 0.7);
      } else {
        ctx.fillStyle = '#aaa';
        ctx.fillText('DRAW', this._vpW / 2, this._vpH / 2 - fontSize * 0.6);
        ctx.fillStyle = '#fff';
        ctx.font      = `${Math.floor(fontSize * 0.55)}px monospace`;
        ctx.fillText('click to play again', this._vpW / 2, this._vpH / 2 + fontSize * 0.7);
      }
    }

    // Turn counter (top-right corner, unobtrusive) — suppressed in TP mode
    if (gameState.mode !== 'gameover' && !gameState.tpGame) {
      const hudFontSize = Math.max(12, Math.floor(this._vpW / 80));
      ctx.font         = `${hudFontSize}px monospace`;
      ctx.textAlign    = 'right';
      ctx.textBaseline = 'top';
      ctx.fillStyle    = 'rgba(255,255,255,0.5)';
      ctx.fillText(`Turn ${gameState.turn + 1}`, this._vpW - 10, 10);

      // Turn limit countdown — shown when ≤5 turns remain
      const limit = gameState.config?.turnLimit;
      if (limit && limit !== 'off' && gameState.winner === undefined) {
        const left = limit - gameState.turn;
        if (left <= 5 && left > 0) {
          ctx.font      = `bold ${hudFontSize}px monospace`;
          ctx.fillStyle = left <= 2 ? 'rgba(255,90,70,0.95)' : 'rgba(255,190,60,0.9)';
          ctx.fillText(left === 1 ? 'LAST TURN' : `${left} TURNS LEFT`, this._vpW - 10, 10 + hudFontSize + 4);
        }
      }
    }
  }

  // ----------------------------------------------------------------
  // Comet — bright nucleus with soft glow (tail handled by cometSmoke particles)
  // ----------------------------------------------------------------

  _drawComet(ctx, comet) {
    const cx   = comet.position.x * this.conv;
    const cy   = comet.position.y * this.conv;
    const r    = Math.max(2, comet.radius * this.conv);

    // Soft glow halo
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.5);
    glow.addColorStop(0,   'rgba(210,230,255,0.4)');
    glow.addColorStop(0.5, 'rgba(170,200,255,0.15)');
    glow.addColorStop(1,   'rgba(130,170,255,0)');
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.5, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Bright nucleus
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgb(255,255,230)';
    ctx.fill();
  }

  // ----------------------------------------------------------------
  // SVG planet overlays — loaded async, drawn per-frame over live bodies
  // ----------------------------------------------------------------

  _loadSmokeSprite() {
    const img = new Image();
    img.src = 'Images/Cloud1.png';
    this._smokeImg  = img;
    this._tintCanvas = document.createElement('canvas');
    this._tintCanvas.width = this._tintCanvas.height = 256;
    this._tintCtx   = this._tintCanvas.getContext('2d');
  }

  _buildGasGiantCanvas() {
    const gasGiants = this._planets.filter(p => p.shading === ShadingStyle.GAS_GIANT);
    if (!gasGiants.length) { this._gasGiantCanvas = null; this._gasGiantBitmap = null; return; }

    const c   = document.createElement('canvas');
    c.width   = this._vpW;
    c.height  = this._vpH;
    const ctx = c.getContext('2d');

    // Ring back halves — under atmosphere and body so the far side of each
    // ring reads as passing behind the planet (full and experimental modes)
    const rings = this._performance === 'full' || this._performance === 'experimental';
    if (rings) {
      for (const planet of gasGiants) this._drawGasGiantRings(ctx, planet, 'back');
    }

    // Atmosphere halos — no blur
    if (!this._simplified) {
      for (const planet of gasGiants) this._drawAtmosphere(ctx, planet);
    }

    // Bodies + SVG overlays — blur baked in (skipped in experimental mode)
    const blurred = !this._simplified && this._performance !== 'experimental';
    if (blurred) ctx.filter = 'blur(3px)';
    for (const planet of gasGiants) {
      const cx = planet.position.x * this.conv;
      const cy = planet.position.y * this.conv;
      const r  = Math.max(2, planet.radius * this.conv);
      const [ar, ag, ab] = planet.colour;
      const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.05, cx, cy, r);
      grad.addColorStop(0,   `rgba(${Math.min(255,ar+55)},${Math.min(255,ag+50)},${Math.min(255,ab+40)},0.50)`);
      grad.addColorStop(0.6, `rgba(${ar},${ag},${ab},0.50)`);
      grad.addColorStop(1,   `rgba(${Math.floor(ar*.4)},${Math.floor(ag*.4)},${Math.floor(ab*.4)},0.50)`);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      if (!this._simplified) {
        const overlays = this._svgOverlayCache.get(planet);
        if (overlays) for (const entry of overlays) this._drawSVGOverlay(ctx, planet, entry);
      }
    }
    if (blurred) ctx.filter = 'none';

    // Ring front halves — after the blur filter is reset so rings stay crisp
    if (rings) {
      for (const planet of gasGiants) this._drawGasGiantRings(ctx, planet, 'front');
    }

    this._gasGiantCanvas = c;
    this._gasGiantBitmap = null;
    createImageBitmap(c).then(bm => { if (this._gasGiantCanvas === c) this._gasGiantBitmap = bm; });
  }

  // ----------------------------------------------------------------
  // Gas giant rings — full and experimental performance modes.
  // 30% of giants get rings: a randomised set of elliptical bands with a
  // random orientation in the screen plane and a random tilt out of the page
  // (minor/major axis ratio). Rendered in two halves split along the ring's
  // major axis: the back half is drawn under the planet body, the front half
  // over it. Because the body itself is translucent a hard occlusion would
  // look wrong, so the back half is instead knocked back (destination-out)
  // where it crosses the disc — it shows faintly through the gas, dimmer
  // than the front half, which sells the depth.
  // ----------------------------------------------------------------

  _getGasGiantRings(planet) {
    if (planet._ringParams !== undefined) return planet._ringParams;
    // forceRings (e.g. Saturn in the Sol scenario) skips the roll and gets a
    // fuller, brighter ring system
    const forced = !!planet.forceRings;
    if (!forced && Math.random() >= 0.30) { planet._ringParams = null; return null; }
    const [ar, ag, ab] = planet.colour;
    const bands = [];
    const count = forced
      ? 3 + Math.floor(Math.random() * 3)              // 3–5 bands when forced
      : 2 + Math.floor(Math.random() * 4);             // 2–5 bands per giant
    let edge = 1.30 + Math.random() * 0.25;            // innermost edge (× planet radius)
    for (let i = 0; i < count && edge < 2.25; i++) {
      const thick = 0.05 + Math.random() * Math.random() * 0.20; // mostly thin, occasionally broad
      const pale  = 0.45 + Math.random() * 0.35;       // lerp toward dusty off-white
      bands.push({
        inner:  edge,
        outer:  edge + thick,
        alpha:  (0.10 + Math.random() * 0.15) * (forced ? 1.5 : 1),
        colour: [
          Math.round(ar + (228 - ar) * pale),
          Math.round(ag + (218 - ag) * pale),
          Math.round(ab + (200 - ab) * pale),
        ],
      });
      edge += thick + 0.03 + Math.random() * 0.12;     // gap before the next band
    }
    planet._ringParams = {
      theta:     Math.random() * Math.PI * 2,          // orientation in screen plane
      ratio:     0.14 + Math.random() * 0.58,          // tilt out of the page (0 = edge-on)
      outermost: bands[bands.length - 1].outer,
      bands,
    };
    return planet._ringParams;
  }

  _drawGasGiantRings(ctx, planet, half) {
    const rings = this._getGasGiantRings(planet);
    if (!rings) return;
    const cx  = planet.position.x * this.conv;
    const cy  = planet.position.y * this.conv;
    const r   = Math.max(2, planet.radius * this.conv);
    const ext = Math.ceil(rings.outermost * r) + 2;

    const off = document.createElement('canvas');
    off.width = off.height = ext * 2;
    const oc  = off.getContext('2d');

    oc.save();
    oc.translate(ext, ext);
    oc.rotate(rings.theta);
    // Clip to one side of the ring's major axis
    oc.beginPath();
    oc.rect(-ext * 2, half === 'front' ? 0 : -ext * 2, ext * 4, ext * 2);
    oc.clip();
    for (const band of rings.bands) {
      const [br, bg, bb] = band.colour;
      // Annulus between two concentric ellipses with the same axis ratio —
      // the true projection of a flat ring, unlike a uniform-width stroke
      oc.beginPath();
      oc.ellipse(0, 0, band.outer * r, band.outer * r * rings.ratio, 0, 0, Math.PI * 2);
      oc.ellipse(0, 0, band.inner * r, band.inner * r * rings.ratio, 0, 0, Math.PI * 2);
      oc.fillStyle = `rgba(${br},${bg},${bb},${band.alpha})`;
      oc.fill('evenodd');
    }
    oc.restore();

    if (half === 'back') {
      // Fade the back half where it crosses the disc; the translucent body is
      // composited over what remains, leaving a faint trace through the gas
      oc.globalCompositeOperation = 'destination-out';
      oc.beginPath();
      oc.arc(ext, ext, r, 0, Math.PI * 2);
      oc.fillStyle = 'rgba(0,0,0,0.70)';
      oc.fill();
      oc.globalCompositeOperation = 'source-over';
    }

    ctx.drawImage(off, cx - ext, cy - ext);
  }

  _getTintedSmoke(r, g, b) {
    const key = `${r},${g},${b}`;
    if (this._smokeTintCache.has(key)) return this._smokeTintCache.get(key);
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const cx = c.getContext('2d');
    cx.drawImage(this._smokeImg, 0, 0, 256, 256);
    cx.globalCompositeOperation = 'source-atop';
    cx.fillStyle = `rgb(${r},${g},${b})`;
    cx.fillRect(0, 0, 256, 256);
    this._smokeTintCache.set(key, c);
    return c;
  }

  async _loadCrackSvgs() {
    const paths  = ['Images/cracks1.svg', 'Images/cracks2.svg', 'Images/cracks3.svg'];
    const colour = 'rgb(0,0,0)';
    for (const path of paths) {
      try {
        const resp = await fetch(path);
        let   text = await resp.text();
        text = text.replace(/fill\s*:\s*(?!none|transparent|url)[^;}"]+/gi, `fill:${colour}`);
        text = text.replace(/fill="(?!none|transparent|url)[^"]+"/gi,       `fill="${colour}"`);
        text = text.replace(/stroke\s*:\s*(?!none)[^;}"]+/gi, `stroke:${colour}`);
        text = text.replace(/stroke="(?!none)[^"]+"/gi,        `stroke="${colour}"`);
        const blob = new Blob([text], { type: 'image/svg+xml' });
        const img  = new Image();
        img.src    = URL.createObjectURL(blob);
        this._crackSvgImgs.push(img);
      } catch (e) {
        console.warn(`Failed to load ${path}`, e);
      }
    }
  }

  async _loadPlanetOverlays(planets) {
    const rand = (min, max) => min + Math.random() * (max - min);

    for (const planet of planets) {
      // overlayKey lets a scenario borrow another body's overlay set
      // (e.g. Sol's Earth continents, or Mercury's moon-style craters)
      const layerDefs = PLANET_OVERLAYS[planet.overlayKey ?? planet.type];
      if (!layerDefs?.length) continue;

      const entries = [];
      for (const def of layerDefs) {
        const count = def.countRange
          ? def.countRange[0] + Math.floor(Math.random() * (def.countRange[1] - def.countRange[0] + 1))
          : (def.count ?? 1);
        for (let n = 0; n < count; n++) {
          const svgPath = def.svgs[Math.floor(Math.random() * def.svgs.length)];

          let colour;
          if (Array.isArray(def.colour)) {
            // Pool of RGB arrays — pick one at random per layer application
            const [r, g, b] = def.colour[Math.floor(Math.random() * def.colour.length)];
            colour = `rgb(${r},${g},${b})`;
          } else if (typeof def.colour === 'string') {
            // 'planet' → colourA,  'planetB' → colourB (falls back to colourA if unset)
            const src = def.colour === 'planetB' ? (planet.colourB ?? planet.colour) : planet.colour;
            const [r, g, b] = src;
            colour = `rgb(${r},${g},${b})`;
          } else {
            const h = rand(def.colour.h[0], def.colour.h[1]).toFixed(1);
            const s = rand(def.colour.s[0], def.colour.s[1]).toFixed(1);
            const l = rand(def.colour.l[0], def.colour.l[1]).toFixed(1);
            colour = `hsl(${h},${s}%,${l}%)`;
          }

          let rotation = 0;
          if (def.rotation === 'random') rotation = Math.random() * Math.PI * 2;
          else if (typeof def.rotation === 'number') rotation = def.rotation * Math.PI / 180;

          try {
            const resp = await fetch(svgPath);
            let text = await resp.text();
            // Inject colour into SVG root so paths with no explicit fill/stroke inherit it
            const strokeRoot = def.strokeVisible ? `stroke="${colour}"` : 'stroke="none"';
            text = text.replace(/(<svg\b)([^>]*)>/i, `$1$2 fill="${colour}" ${strokeRoot}>`);
            // Also replace any explicit fill/stroke values in path styles
            text = text.replace(/fill\s*:\s*(?!none|transparent|url)[^;}"]+/gi, `fill:${colour}`);
            text = text.replace(/fill="(?!none|transparent|url)[^"]+"/gi,       `fill="${colour}"`);
            if (!def.strokeVisible) {
              text = text.replace(/stroke\s*:\s*(?!none)[^;}"]+/gi, 'stroke:none');
              text = text.replace(/stroke="(?!none)[^"]+"/gi,        'stroke="none"');
            }
            const blob = new Blob([text], { type: 'image/svg+xml' });
            const url  = URL.createObjectURL(blob);
            const img  = new Image();
            img.src    = url;
            await img.decode();
            entries.push({ img, rotation, alpha: def.alpha ?? 1, scale: def.scale ?? 1 });
          } catch (e) {
            console.warn(`SVG overlay load failed: ${svgPath}`, e);
          }
        }
      }
      if (entries.length) this._svgOverlayCache.set(planet, entries);
    }
    // Re-render background so static-body overlays (rocky planets etc.) appear immediately
    this._renderBackground();
    this._buildGasGiantCanvas();
  }

  _drawSVGOverlay(ctx, planet, entry) {
    const { img, rotation, alpha, scale } = entry;
    if (!img.complete || img.naturalWidth === 0) return;
    const cx   = planet.position.x * this.conv;
    const cy   = planet.position.y * this.conv;
    const r    = Math.max(4, planet.radius * this.conv);
    const size = r * 2 * scale;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha = alpha;
    ctx.translate(cx, cy);
    ctx.rotate(rotation);
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  _drawAtmosphere(ctx, planet) {
    const atmos = this._atmosphereCache.get(planet);
    if (!atmos) return;
    const cx = planet.position.x * this.conv;
    const cy = planet.position.y * this.conv;
    const r  = Math.max(4, planet.radius * this.conv);
    const [ar, ag, ab] = atmos;
    const outerR = r * 1.18;
    // Gradient starts just inside planet rim and fades to transparent at outerR
    const grad = ctx.createRadialGradient(cx, cy, r * 0.88, cx, cy, outerR);
    grad.addColorStop(0, `rgba(${ar},${ag},${ab},0.50)`);
    grad.addColorStop(1, `rgba(${ar},${ag},${ab},0)`);
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // White polar ice cap hugging the top of the disc. planet.polarCap is the
  // cap height as a fraction of the planet radius (e.g. Earth 0.30, Mars 0.16).
  _drawPolarCap(ctx, planet) {
    const cx = planet.position.x * this.conv;
    const cy = planet.position.y * this.conv;
    const r  = Math.max(4, planet.radius * this.conv);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.beginPath();
    ctx.ellipse(cx, cy - r, r * 0.78, r * planet.polarCap, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(245,250,255,0.85)';
    ctx.fill();
    ctx.restore();
  }

  _drawShadingOverlay(ctx, planet) {
    const cx = planet.position.x * this.conv;
    const cy = planet.position.y * this.conv;
    const r  = Math.max(4, planet.radius * this.conv);
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    const grad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r);
    grad.addColorStop(0,    'rgba(255,255,255,0.40)');
    grad.addColorStop(0.45, 'rgba(0,0,0,0)');
    grad.addColorStop(1,    'rgba(0,0,0,0.65)');
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  // ----------------------------------------------------------------
  // Moon — cratered sphere with crack lines growing per hit
  // ----------------------------------------------------------------

  _drawMoon(ctx, planet) {
    const cx = planet.position.x * this.conv;
    const cy = planet.position.y * this.conv;
    const r  = Math.max(4, planet.radius * this.conv);

    // Body: light grey-blue sphere with upper-left lit-side shading
    const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.05, cx, cy, r);
    grad.addColorStop(0,   'rgb(240,243,252)');
    grad.addColorStop(0.5, 'rgb(200,207,228)');
    grad.addColorStop(1,   'rgb(100,106,130)');
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // SVG overlays (drawn above base sphere, below cracks)
    if (!this._simplified) {
      const overlays = this._svgOverlayCache.get(planet);
      if (overlays) for (const entry of overlays) this._drawSVGOverlay(ctx, planet, entry);
    }

    // SVG crack overlay — one per hit, rotated to face impact point
    if (planet.crackAngles?.length && this._crackSvgImgs.length) {
      for (let i = 0; i < planet.crackAngles.length; i++) {
        const img = this._crackSvgImgs[planet.crackSvgIdxs?.[i] ?? 0];
        if (!img?.complete) continue;
        const rotation = planet.crackAngles[i] - Math.PI / 2;
        const size     = r * 2;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.clip();
        ctx.globalAlpha = 0.5;
        ctx.translate(cx, cy);
        ctx.rotate(rotation);
        ctx.drawImage(img, -size / 2, -size / 2, size, size);
        ctx.restore();
      }
    }
  }

  // ----------------------------------------------------------------
  // Station — Death Star icon
  // ----------------------------------------------------------------

  _drawStation(ctx, station) {
    if (station.role === 'target') {
      this._drawTarget(ctx, station);
      return;
    }
    if (station.visualStyle === 'drone') {
      this._drawDroneStation(ctx, station);
    } else if (this._performance === 'experimental') {
      // Sprite-based ship rendering — experimental performance mode only
      this._drawSpriteStation(ctx, station);
    } else {
      this._drawNormalStation(ctx, station);
    }
    if ((station.armourLayers ?? 0) > 0 || (station.armourFlash ?? 0) > 0) {
      this._drawArmourRings(ctx, station);
    }
    if ((station.frozen ?? 0) > 0 || (station.frozenFlash ?? 0) > 0) {
      this._drawFrozenOverlay(ctx, station);
    }
    if ((station.electrified ?? 0) > 0 || (station.electrifiedFlash ?? 0) > 0) {
      this._drawElectrifiedOverlay(ctx, station);
    }
    if ((station.mindControlFlash ?? 0) > 0) {
      this._drawMindControlFlash(ctx, station);
    }
  }

  // Sprite-based ship (see src/rendering/sprites/). Used instead of the
  // procedural Death Star when performance mode is exactly 'experimental'.
  _drawSpriteStation(ctx, station) {
    const cx = station.position.x * this.conv;
    const cy = station.position.y * this.conv;
    const r  = Math.max(3, station.radius * this.conv);

    const alpha = station.status === 'exploding'
      ? Math.max(0, 1 - station.explosionT * 2.5)
      : 1;
    if (alpha <= 0) return;

    const sprite = getSprite('saucer1');
    // Global wall-clock phase — all ships animate in sync, no per-station state
    const animPhase = (performance.now() % sprite.duration) / sprite.duration;

    // All same-team ships are pixel-identical within a frame (global phase), so
    // draw from the per-team pre-rendered sheet: one drawImage per ship instead
    // of ~23 path calls — required for 96 ships at 60fps on iPad.
    const key = `${station.colour[0]},${station.colour[1]},${station.colour[2]}`;
    ctx.save();
    ctx.globalAlpha = alpha;
    this._spriteSheetCache.draw(ctx, sprite, cx, cy, r, key,
                                this._spriteTeamColors(station.colour), animPhase);
    ctx.restore();
  }

  // Cached team sprite palette. primary/secondary keep the original meaning
  // (base + a lighter trim). shade1–4 are a dark→light tonal ramp of the team
  // colour so one artwork can carry an interesting range of team-coloured tones
  // (saucer hull → body → dome). All share the team hue.
  _spriteTeamColors(colour) {
    const key = `${colour[0]},${colour[1]},${colour[2]}`;
    let c = this._spriteColorCache.get(key);
    if (!c) {
      const [r, g, b] = colour;
      const scale = k => `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`;
      const toward = (v, t) => Math.round(v + (255 - v) * t);
      c = {
        primary:   `rgb(${r},${g},${b})`,
        secondary: `rgb(${Math.min(255, r + 90)},${Math.min(255, g + 90)},${Math.min(255, b + 90)})`,
        shade1:    scale(0.40),                                              // darkest
        shade2:    scale(0.65),
        shade3:    `rgb(${r},${g},${b})`,                                    // base
        shade4:    `rgb(${toward(r, 0.55)},${toward(g, 0.55)},${toward(b, 0.55)})`, // lightest
      };
      this._spriteColorCache.set(key, c);
    }
    return c;
  }

  _drawNormalStation(ctx, station) {
    const cx = station.position.x * this.conv;
    const cy = station.position.y * this.conv;
    const r  = Math.max(3, station.radius * this.conv);
    const [cr, cg, cb] = station.colour;

    // Fade ship body out from the moment it starts exploding
    const alpha = station.status === 'exploding'
      ? Math.max(0, 1 - station.explosionT * 2.5)
      : 1;
    ctx.save();
    ctx.globalAlpha = alpha;

    // Sphere body with radial lighting (lit upper-left)
    const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
    grad.addColorStop(0,   `rgb(${Math.min(255,cr+65)},${Math.min(255,cg+65)},${Math.min(255,cb+65)})`);
    grad.addColorStop(0.5, `rgb(${cr},${cg},${cb})`);
    grad.addColorStop(1,   `rgb(${Math.floor(cr*.35)},${Math.floor(cg*.35)},${Math.floor(cb*.35)})`);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Equatorial trench — clipped to the sphere
    if (r >= 3) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.beginPath();
      // Curved trench — quadratic bezier bows downward to suggest a sphere
      ctx.moveTo(cx - r, cy);
      ctx.quadraticCurveTo(cx, cy + r * 0.40, cx + r, cy);
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = Math.max(1, r * 0.14);
      ctx.stroke();
      ctx.restore();
    }

    // Dome + aperture — only when large enough to be visible
    if (r >= 6) {
      const domeR  = r * 0.32;
      const domeCx = cx + r * 0.28;
      const domeCy = cy - r * 0.25;

      ctx.beginPath();
      ctx.arc(domeCx, domeCy, domeR, 0, Math.PI * 2);
      ctx.fillStyle   = 'rgba(0,0,0,0.45)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth   = 1;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(domeCx, domeCy, Math.max(1, domeR * 0.32), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fill();
    }

    ctx.restore(); // restore globalAlpha
  }

  _drawDroneStation(ctx, station) {
    const cx = station.position.x * this.conv;
    const cy = station.position.y * this.conv;
    const r  = Math.max(3, station.radius * this.conv);
    const [cr, cg, cb] = station.colour;

    const alpha = station.status === 'exploding'
      ? Math.max(0, 1 - station.explosionT * 2.5)
      : 1;
    ctx.save();
    ctx.globalAlpha = alpha;

    // Hexagonal body (flat-top orientation)
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 6) + (Math.PI / 3) * i;
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle   = `rgb(${Math.floor(cr*0.28)},${Math.floor(cg*0.28)},${Math.floor(cb*0.28)})`;
    ctx.fill();
    ctx.strokeStyle = `rgb(${cr},${cg},${cb})`;
    ctx.lineWidth   = Math.max(1, r * 0.13);
    ctx.stroke();

    // Inner cross in team colour
    if (r >= 5) {
      const arm = r * 0.52;
      ctx.beginPath();
      ctx.moveTo(cx - arm, cy); ctx.lineTo(cx + arm, cy);
      ctx.moveTo(cx, cy - arm); ctx.lineTo(cx, cy + arm);
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.45)`;
      ctx.lineWidth   = Math.max(1, r * 0.07);
      ctx.stroke();
    }

    // Bright core dot
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(1, r * 0.22), 0, Math.PI * 2);
    ctx.fillStyle = `rgb(${Math.min(255,cr+90)},${Math.min(255,cg+90)},${Math.min(255,cb+90)})`;
    ctx.fill();

    ctx.restore();
  }

  _drawTargetRing(ctx, station) {
    const cx = station.position.x * this.conv;
    const cy = station.position.y * this.conv;
    const r  = Math.max(3, station.radius * this.conv);
    const [cr, cg, cb] = station.colour;

    ctx.save();

    // Static outer ring
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.5, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.35)`;
    ctx.lineWidth   = Math.max(1, r * 0.08);
    ctx.stroke();

    // Pulsing expanding ring (expands from 1.5r to 2.5r over 1.4 s, fades out)
    const t = (Date.now() / 1400) % 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r * (1.5 + t), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${cr},${cg},${cb},${((1 - t) * 0.45).toFixed(3)})`;
    ctx.lineWidth   = Math.max(1, r * 0.07);
    ctx.stroke();

    ctx.restore();
  }

  // ----------------------------------------------------------------
  // Selection diamond — marks the active station when no aim circle is
  // shown (frozen/electrified turns): square rotated 45°, same size and
  // style as the aiming circle
  // ----------------------------------------------------------------

  _drawSelectionDiamond(ctx, station) {
    const cx   = station.position.x * this.conv;
    const cy   = station.position.y * this.conv;
    const r    = Math.max(3, station.radius * this.conv);
    const boxR = Math.max(57, 3 * r) * this._aimCircleScale;

    ctx.beginPath();
    ctx.moveTo(cx, cy - boxR);
    ctx.lineTo(cx + boxR, cy);
    ctx.lineTo(cx, cy + boxR);
    ctx.lineTo(cx - boxR, cy);
    ctx.closePath();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth   = 1;
    ctx.stroke();
  }

  // ----------------------------------------------------------------
  // Aiming indicator — white circle + direction line
  // ----------------------------------------------------------------

  _drawAimingIndicator(ctx, station, gameState) {
    const cx   = station.position.x * this.conv;
    const cy   = station.position.y * this.conv;
    const r    = Math.max(3, station.radius * this.conv);
    const boxR = Math.max(57, 3 * r) * this._aimCircleScale;

    // Ghost aim line from last turn — shown before current line so it sits behind
    if (station.lastAngle !== null && station.lastPower !== null) {
      const lastRad = (station.lastAngle * Math.PI) / 180;
      const lastLen = r + (boxR - r) * (station.lastPower / 800);
      ctx.save();
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.sin(lastRad) * lastLen, cy + Math.cos(lastRad) * lastLen);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth   = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // Bounding circle
    ctx.beginPath();
    ctx.arc(cx, cy, boxR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth   = 1;
    ctx.stroke();

    const w = station.selectedWeapon;

    // Bullet path preview (drawn behind aim lines)
    if (this._bulletPathMaxLength > 0) this._drawBulletPathPreview(ctx, station, gameState);

    // Aim lines — one per bullet angle, centre line stronger than flanking
    const noPower = new Set(['blunderbuss', 'blaster', 'laser', 'antimatterLaser', 'shotgun', 'dualBlaster', 'superLaser', 'reinforcementSignal', 'mindControlBeam', 'hedgehog']);
    const displayPower = noPower.has(w) ? 800 : station.power;
    const lineLen      = r + (boxR - r) * (displayPower / 800);

    let offsets;
    switch (w) {
      case 'tripleCannon': offsets = [-5, 0, 5];               break;
      case 'blunderbuss':  offsets = [-15, -7.5, 0, 7.5, 15]; break;
      case 'blaster': {    const h = station.power ?? 15; offsets = [-h, -h/2, 0, h/2, h]; break; }
      case 'minigun':      offsets = [-4, 0, 4];               break;
      case 'rocketPod':        offsets = [-1, 0, 1];               break;
      case 'septupleCannon':   offsets = [-10, -20 / 3, -10 / 3, 0, 10 / 3, 20 / 3, 10]; break;
      case 'antimatterLaser':  offsets = [-15, 0, 15];            break;
      case 'fragmentationShot': offsets = [0];                   break;
      case 'shotgun':           offsets = [-8, 0, 8];                        break;
      case 'dualBlaster':       offsets = [0];                               break;
      case 'bounceCannon':      offsets = [0];                               break;
      case 'autoCannon':        offsets = [-1, 0, 1];                        break;
      case 'starShot':          offsets = [0, 72, 144, 216, 288];            break;
      case 'scatterCannon':     offsets = [0];                               break;
      case 'spiral':            offsets = Array.from({length: 13}, (_, i) => i * (360 / 13)); break;
      case 'electroStun': {
        // High power = narrow spread; low power = wide spread
        const spreadDeg = 45 - (station.power - 1) / 799 * 40;
        const half      = spreadDeg / 2;
        offsets = [-half, 0, half];
        break;
      }
      case 'hedgehog': offsets = Array.from({length: 12}, (_, i) => i * 30); break;
      case 'tripleQuantumTorpedo': offsets = [-5, 0, 5];   break;
      case 'quantumAutoCannon':    offsets = [-1, 0, 1];   break;
      case 'teleport':              offsets = [0]; break; // direction only; destination shown below
      case 'reinforcementSignal':   offsets = [0]; break;
      case 'mindControlBeam':       offsets = [0]; break;
      default:                      offsets = [0]; break;
    }

    for (const off of offsets) {
      const rad = ((station.angle + off) * Math.PI) / 180;
      const alpha = off === 0 ? 0.95 : 0.45;
      const lw    = off === 0 ? 2    : 1;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.sin(rad) * lineLen, cy + Math.cos(rad) * lineLen);
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.lineWidth   = lw;
      ctx.stroke();
    }

    // Two-barrel weapons: barrel 2 aim lines (dimmer, at station.angle2)
    if (w === 'shotgun' || w === 'dualBlaster') {
      const barrel2Offsets = w === 'shotgun' ? [-8, 0, 8] : [0];
      for (const off of barrel2Offsets) {
        const rad   = ((( station.angle2 ?? station.angle) + off) * Math.PI) / 180;
        const alpha = off === 0 ? 0.60 : 0.28;
        const lw    = off === 0 ? 1.5  : 1;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.sin(rad) * lineLen, cy + Math.cos(rad) * lineLen);
        ctx.strokeStyle = `rgba(200,200,255,${alpha})`;
        ctx.lineWidth   = lw;
        ctx.stroke();
      }
    }

    // Teleport destination preview: ghost station outline + dotted line
    if (w === 'teleport') {
      const gw = this.gameWidth, gh = this.gameHeight;
      const maxDist = Math.sqrt(gw * gw + gh * gh);
      const tpDist  = (station.power / 800) * maxDist;
      const tpRad   = (station.angle * Math.PI) / 180;
      const destGX  = Math.max(station.radius, Math.min(gw - station.radius,
        station.position.x + Math.sin(tpRad) * tpDist));
      const destGY  = Math.max(station.radius, Math.min(gh - station.radius,
        station.position.y + Math.cos(tpRad) * tpDist));
      const destPX  = destGX * this.conv;
      const destPY  = destGY * this.conv;
      // Dotted line
      ctx.save();
      ctx.setLineDash([5, 7]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(destPX, destPY);
      ctx.strokeStyle = 'rgba(100,200,255,0.5)';
      ctx.lineWidth   = 1.5;
      ctx.stroke();
      ctx.restore();
      // Ghost station circle
      ctx.save();
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(destPX, destPY, Math.max(3, station.radius * this.conv), 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(100,200,255,0.7)';
      ctx.lineWidth   = 1.5;
      ctx.stroke();
      // Cross hair at destination
      const mr = Math.max(3, station.radius * this.conv) * 0.45;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(destPX - mr, destPY);
      ctx.lineTo(destPX + mr, destPY);
      ctx.moveTo(destPX, destPY - mr);
      ctx.lineTo(destPX, destPY + mr);
      ctx.strokeStyle = 'rgba(100,200,255,0.5)';
      ctx.lineWidth   = 1;
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawLaserAimPreview(ctx, station, gameState) {
    const path = this._computeLaserPreviewPath(station, station.angle, gameState.planets ?? []);
    if (path.length < 2) return;
    const c        = this.conv;
    const [tr, tg, tb] = station.team.colour;
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.lineWidth   = 2;
    ctx.strokeStyle = `rgba(${tr},${tg},${tb},0.65)`;
    ctx.beginPath();
    ctx.moveTo(path[0].x * c, path[0].y * c);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x * c, path[i].y * c);
    ctx.stroke();
    ctx.restore();
  }

  _computeLaserPreviewPath(station, angleDeg, planets, maxLength = Infinity, gravityMult = 1.0) {
    const LASER_SPEED   = 160;
    const MAX_STEPS     = 200;
    const gw = this.gameWidth;
    const gh = this.gameHeight;
    const rad = (((angleDeg % 360) + 360) % 360 * Math.PI) / 180;
    let px = station.position.x + (station.radius + 1) * Math.sin(rad);
    let py = station.position.y + (station.radius + 1) * Math.cos(rad);
    let vx = LASER_SPEED * Math.sin(rad);
    let vy = LASER_SPEED * Math.cos(rad);
    const path = [{ x: px, y: py }];
    let distTravelled = 0;
    for (let step = 0; step < MAX_STEPS; step++) {
      for (const planet of planets) {
        if (planet.destroyed) continue;
        const dx  = planet.position.x - px;
        const dy  = planet.position.y - py;
        const rSq = dx * dx + dy * dy;
        if (rSq < 0.01) continue;
        const sign  = dx < 0 ? -1 : 1;
        const theta = Math.atan(dy / dx);
        vx += Math.cos(theta) * sign * gravityMult * G * planet.mass / rSq * TIMESTEP;
        vy += Math.sin(theta) * sign * gravityMult * G * planet.mass / rSq * TIMESTEP;
      }
      const prevX = px, prevY = py;
      px += vx * TIMESTEP;
      py += vy * TIMESTEP;
      // Reflective (blue) rift bounce — mirror the previewed beam off blue rifts
      const rb = PhysicsEngine._reflectOffRifts(prevX, prevY, px, py, vx, vy, this._rifts ?? []);
      if (rb) { px = rb.x; py = rb.y; vx = rb.vx; vy = rb.vy; }
      distTravelled += Math.sqrt((px - prevX) ** 2 + (py - prevY) ** 2);
      path.push({ x: px, y: py });
      if (distTravelled >= maxLength) break;
      if (px < -gw || px > 2 * gw || py < -gw || py > gh + gw) break;
      // Stop at solid planet surface
      for (const planet of planets) {
        if (planet.destroyed) continue;
        const dx = planet.position.x - px;
        const dy = planet.position.y - py;
        if (dx * dx + dy * dy < planet.impactRadius ** 2) {
          if (planet.type !== PlanetType.GAS_GIANT &&
              planet.type !== PlanetType.ASTEROID &&
              planet.type !== PlanetType.CRYSTAL) return path;
        }
      }
    }
    return path;
  }

  _computeRocketPreviewPath(station, angleDeg, power, planets, maxLength = Infinity) {
    const STEP_SIZE = 20;
    const MAX_ITER  = 600;
    const dt  = TIMESTEP * STEP_SIZE;
    const rad = (((angleDeg % 360) + 360) % 360 * Math.PI) / 180;
    const fuel0 = ROCKET_MIN_FUEL + (power - 1) / 799 * (ROCKET_MAX_FUEL - ROCKET_MIN_FUEL);
    let px   = station.position.x + (station.radius + 1) * Math.sin(rad);
    let py   = station.position.y + (station.radius + 1) * Math.cos(rad);
    let vx   = ROCKET_LAUNCH_SPEED * Math.sin(rad);
    let vy   = ROCKET_LAUNCH_SPEED * Math.cos(rad);
    let fuel = fuel0;
    const gw = this.gameWidth;
    const gh = this.gameHeight;
    const path = [{ x: px, y: py }];
    let distTravelled = 0;

    for (let i = 0; i < MAX_ITER; i++) {
      if (fuel > 0) {
        const speed = Math.sqrt(vx * vx + vy * vy) || 1;
        vx  += (vx / speed) * ROCKET_THRUST / (ROCKET_BASE_MASS + fuel) * dt;
        vy  += (vy / speed) * ROCKET_THRUST / (ROCKET_BASE_MASS + fuel) * dt;
        fuel = Math.max(0, fuel - ROCKET_FUEL_BURN_RATE * dt);
      }
      for (const planet of planets) {
        if (planet.destroyed) continue;
        const dx  = planet.position.x - px;
        const dy  = planet.position.y - py;
        const rSq = dx * dx + dy * dy;
        if (rSq < 0.01) continue;
        const sign  = dx < 0 ? -1 : 1;
        const theta = Math.atan(dy / dx);
        vx += Math.cos(theta) * sign * G * planet.mass / rSq * dt;
        vy += Math.sin(theta) * sign * G * planet.mass / rSq * dt;
      }
      const prevX = px, prevY = py;
      px += vx * dt;
      py += vy * dt;
      // Reflective (blue) rift bounce — mirror the previewed rocket off blue rifts
      const rb = PhysicsEngine._reflectOffRifts(prevX, prevY, px, py, vx, vy, this._rifts ?? []);
      if (rb) { px = rb.x; py = rb.y; vx = rb.vx; vy = rb.vy; }
      distTravelled += Math.sqrt((px - prevX) ** 2 + (py - prevY) ** 2);
      path.push({ x: px, y: py });
      if (distTravelled >= maxLength) break;
      if (px < -gw || px > 2 * gw || py < -gw || py > gh + gw) break;
    }
    return path;
  }

  // Simulate a regular bullet arc for aim preview (coarse steps, same gravity as physics engine)
  _computeBulletPreviewPath(station, angleDeg, power, planets, maxLength = Infinity, speedOverride = null, gravityMult = 1.0) {
    const STEP_SIZE = 20;   // physics steps per preview iteration (matches AI sim)
    const MAX_ITER  = 400;
    const dt   = TIMESTEP * STEP_SIZE;
    const rad  = (((angleDeg % 360) + 360) % 360 * Math.PI) / 180;
    const vScale = speedOverride ?? (power / 1000 + MIN_POWER) * MAX_POWER;
    let px = station.position.x + (station.radius + 1) * Math.sin(rad);
    let py = station.position.y + (station.radius + 1) * Math.cos(rad);
    let vx = vScale * Math.sin(rad);
    let vy = vScale * Math.cos(rad);
    const gw = this.gameWidth;
    const gh = this.gameHeight;
    const path = [{ x: px, y: py }];
    let distTravelled = 0;

    for (let i = 0; i < MAX_ITER; i++) {
      for (const planet of planets) {
        if (planet.destroyed) continue;
        const dx  = planet.position.x - px;
        const dy  = planet.position.y - py;
        const rSq = dx * dx + dy * dy;
        if (rSq < 0.01) continue;
        const sign  = dx < 0 ? -1 : 1;
        const theta = Math.atan(dy / dx);
        const R = planet.impactRadius;
        let accel;
        if (planet.type === PlanetType.GAS_GIANT && rSq < R * R) {
          // Interior: gravity reduces linearly to zero at core (matches PhysicsEngine)
          const r = Math.sqrt(rSq);
          accel = sign * G * planet.mass * r / (R * R * R);
        } else {
          accel = sign * G * planet.mass / rSq;
        }
        vx += Math.cos(theta) * accel * gravityMult * dt;
        vy += Math.sin(theta) * accel * gravityMult * dt;
      }
      const prevX = px, prevY = py;
      px += vx * dt;
      py += vy * dt;
      // Reflective (blue) rift bounce — mirror the previewed arc off blue rifts
      const rb = PhysicsEngine._reflectOffRifts(prevX, prevY, px, py, vx, vy, this._rifts ?? []);
      if (rb) { px = rb.x; py = rb.y; vx = rb.vx; vy = rb.vy; }
      distTravelled += Math.sqrt((px - prevX) ** 2 + (py - prevY) ** 2);
      path.push({ x: px, y: py });
      if (distTravelled >= maxLength) break;
      if (px < -gw || px > 2 * gw || py < -gw || py > gh + gw) break;
      for (const planet of planets) {
        if (planet.destroyed) continue;
        const dx = planet.position.x - px;
        const dy = planet.position.y - py;
        if (dx * dx + dy * dy < planet.impactRadius ** 2) {
          if (planet.type !== PlanetType.GAS_GIANT &&
              planet.type !== PlanetType.ASTEROID &&
              planet.type !== PlanetType.CRYSTAL) return path;
        }
      }
    }
    return path;
  }

  _drawBulletPathPreview(ctx, station, gameState) {
    const w       = station.selectedWeapon;
    const planets = gameState.planets ?? [];
    const maxLen  = this._bulletPathMaxLength;
    const MAX_V   = (800 / 1000 + MIN_POWER) * MAX_POWER;

    let shots;
    switch (w) {
      case 'cannon':
        shots = [{ dAngle: 0, speed: null, alpha: 0.7, lw: 1.5 }];
        break;
      case 'tripleCannon':
        shots = [
          { dAngle: -5, speed: null, alpha: 0.35, lw: 1   },
          { dAngle:  0, speed: null, alpha: 0.7,  lw: 1.5 },
          { dAngle:  5, speed: null, alpha: 0.35, lw: 1   },
        ];
        break;
      case 'blaster': {
        const h = station.power ?? 15;
        shots = [-h, 0, h].map(dAngle => ({
          dAngle, speed: MAX_V * 0.55,
          alpha: dAngle === 0 ? 0.7 : 0.35, lw: dAngle === 0 ? 1.5 : 1,
        }));
        break;
      }
      case 'blunderbuss':
        shots = [-15, 0, 15].map(dAngle => ({
          dAngle, speed: MAX_V * 0.275,
          alpha: dAngle === 0 ? 0.7 : 0.25, lw: dAngle === 0 ? 1.5 : 1,
        }));
        break;
      case 'minigun':
        shots = [-4, 0, 4].map(dAngle => ({
          dAngle, speed: MAX_V * 1.5,
          alpha: dAngle === 0 ? 0.7 : 0.25, lw: dAngle === 0 ? 1.5 : 1,
        }));
        break;
      case 'laser': {
        const path = this._computeLaserPreviewPath(station, station.angle, planets, maxLen);
        if (path.length >= 2) {
          const [tr, tg, tb] = station.team.colour;
          this._drawFadingPath(ctx, path, 0.7, 1.5, `${tr},${tg},${tb}`);
        }
        return;
      }
      case 'rocket': {
        const path = this._computeRocketPreviewPath(station, station.angle, station.power, planets, maxLen);
        if (path.length >= 2) this._drawFadingPath(ctx, path, 0.7, 1.5);
        return;
      }
      case 'septupleCannon':
        shots = [-10, -20 / 3, -10 / 3, 0, 10 / 3, 20 / 3, 10].map(dAngle => ({
          dAngle, speed: null,
          alpha: dAngle === 0 ? 0.7 : 0.35, lw: dAngle === 0 ? 1.5 : 1,
        }));
        break;
      case 'antimatterLaser': {
        for (const dAngle of [-15, 0, 15]) {
          const path = this._computeLaserPreviewPath(station, station.angle + dAngle, planets, maxLen);
          if (path.length >= 2) {
            const [tr, tg, tb] = station.team.colour;
            this._drawFadingPath(ctx, path, dAngle === 0 ? 0.7 : 0.25, dAngle === 0 ? 1.5 : 1, `${tr},${tg},${tb}`);
          }
        }
        return;
      }
      case 'fragmentationShot':
        shots = [{ dAngle: 0, speed: MAX_V * 0.75, alpha: 0.7, lw: 1.5 }];
        break;
      case 'bounceCannon':
        shots = [{ dAngle: 0, speed: null, alpha: 0.7, lw: 1.5 }];
        break;
      case 'scatterCannon':
        shots = [{ dAngle: 0, speed: null, alpha: 0.7, lw: 1.5 }];
        break;
      case 'spiral': {
        const MAX_V = (800 / 1000 + MIN_POWER) * MAX_POWER;
        for (let i = 0; i < 13; i++) {
          const path = this._computeBulletPreviewPath(
            station, station.angle + i * (360 / 13), station.power, planets, maxLen, MAX_V * 0.55,
          );
          if (path.length >= 2) this._drawFadingPath(ctx, path, i === 0 ? 0.7 : 0.35, i === 0 ? 1.5 : 1);
        }
        return;
      }
      case 'autoCannon':
        shots = [-1, 0, 1].map(dAngle => ({
          dAngle, speed: null,
          alpha: dAngle === 0 ? 0.7 : 0.35, lw: dAngle === 0 ? 1.5 : 1,
        }));
        break;
      case 'starShot':
        shots = [0, 72, 144, 216, 288].map(dAngle => ({
          dAngle, speed: null, alpha: 0.7, lw: 1.5,
        }));
        break;
      case 'dualBlaster': {
        const MAX_V = (800 / 1000 + MIN_POWER) * MAX_POWER;
        const b2    = station.angle2 ?? station.angle;
        const path1 = this._computeBulletPreviewPath(station, station.angle, station.power, planets, maxLen, MAX_V * 0.55);
        const path2 = this._computeBulletPreviewPath(station, b2,            station.power, planets, maxLen, MAX_V * 0.55);
        if (path1.length >= 2) this._drawFadingPath(ctx, path1, 0.7,  1.5);
        if (path2.length >= 2) this._drawFadingPath(ctx, path2, 0.45, 1.5);
        return;
      }
      case 'shotgun': {
        const b2 = station.angle2 ?? station.angle;
        const shotgunShots = [
          { baseAngle: station.angle, dAngle: -8, speed: MAX_V * 0.275, alpha: 0.35, lw: 1   },
          { baseAngle: station.angle, dAngle:  0, speed: MAX_V * 0.275, alpha: 0.70, lw: 1.5 },
          { baseAngle: station.angle, dAngle:  8, speed: MAX_V * 0.275, alpha: 0.35, lw: 1   },
          { baseAngle: b2,            dAngle: -8, speed: MAX_V * 0.275, alpha: 0.22, lw: 1   },
          { baseAngle: b2,            dAngle:  0, speed: MAX_V * 0.275, alpha: 0.45, lw: 1.5 },
          { baseAngle: b2,            dAngle:  8, speed: MAX_V * 0.275, alpha: 0.22, lw: 1   },
        ];
        for (const shot of shotgunShots) {
          const path = this._computeBulletPreviewPath(
            station, shot.baseAngle + shot.dAngle, station.power, planets, maxLen, shot.speed,
          );
          if (path.length < 2) continue;
          this._drawFadingPath(ctx, path, shot.alpha, shot.lw);
        }
        return;
      }
      case 'mammothCannon': {
        // Half speed, quarter gravity
        const speed = ((station.power / 1000 + MIN_POWER) * MAX_POWER) * 0.5;
        const path  = this._computeBulletPreviewPath(station, station.angle, station.power, planets, maxLen, speed, 0.25);
        if (path.length >= 2) this._drawFadingPath(ctx, path, 0.7, 2.5);
        return;
      }
      case 'gravityCannon': {
        // Half speed, quarter gravity
        const speed = ((station.power / 1000 + MIN_POWER) * MAX_POWER) * 0.5;
        const path  = this._computeBulletPreviewPath(station, station.angle, station.power, planets, maxLen, speed, 0.25);
        if (path.length >= 2) this._drawFadingPath(ctx, path, 0.7, 2.5);
        return;
      }
      case 'quantumTorpedo':
        shots = [{ dAngle: 0, speed: null, alpha: 0.7, lw: 1.5 }];
        break;
      case 'tripleQuantumTorpedo':
        shots = [
          { dAngle: -5, speed: null, alpha: 0.35, lw: 1   },
          { dAngle:  0, speed: null, alpha: 0.7,  lw: 1.5 },
          { dAngle:  5, speed: null, alpha: 0.35, lw: 1   },
        ];
        break;
      case 'quantumAutoCannon':
        shots = [{ dAngle: 0, speed: null, alpha: 0.7, lw: 1.5 }];
        break;
      case 'superLaser': {
        // Straight-line beam — no gravity deflection
        const path = this._computeLaserPreviewPath(station, station.angle, planets, maxLen, 0);
        if (path.length >= 2) {
          const [tr, tg, tb] = station.team.colour;
          this._drawFadingPath(ctx, path, 0.7, 1.5, `${tr},${tg},${tb}`);
        }
        return;
      }
      case 'rocketPod': {
        // Two wings: rockets alternate left/right perpendicular to aim direction
        const rad    = (((station.angle % 360) + 360) % 360 * Math.PI) / 180;
        const offset = station.radius * 2;
        const perpX  = -Math.cos(rad), perpY = Math.sin(rad);
        const mkProxy = (sign) => ({
          position: { x: station.position.x + sign * perpX * offset, y: station.position.y + sign * perpY * offset },
          radius: 0, team: station.team, size: station.size,
        });
        const pathL = this._computeRocketPreviewPath(mkProxy(+1), station.angle, station.power, planets, maxLen);
        const pathR = this._computeRocketPreviewPath(mkProxy(-1), station.angle, station.power, planets, maxLen);
        if (pathL.length >= 2) this._drawFadingPath(ctx, pathL, 0.7,  1.5);
        if (pathR.length >= 2) this._drawFadingPath(ctx, pathR, 0.45, 1.5);
        return;
      }
      case 'hedgehog': {
        // 12 rockets evenly spaced around station.angle with fixed power 400
        for (let i = 0; i < 12; i++) {
          const path = this._computeRocketPreviewPath(station, station.angle + i * 30, 400, planets, maxLen);
          if (path.length >= 2) this._drawFadingPath(ctx, path, 0.55, 1);
        }
        return;
      }
      case 'reinforcementSignal':
        return; // reaches edge of map; no useful path preview
      case 'mindControlBeam': {
        const path = this._computeLaserPreviewPath(station, station.angle, planets, maxLen);
        if (path.length >= 2) {
          const [tr, tg, tb] = station.team.colour;
          this._drawFadingPath(ctx, path, 0.6, 1.5, `${tr},${tg},${tb}`);
        }
        return;
      }
      case 'repulsorField':
        shots = [{ dAngle: 0, speed: null, alpha: 0.7, lw: 1.5 }];
        break;
      case 'forceShield':
        shots = [{ dAngle: 0, speed: null, alpha: 0.7, lw: 1.5 }];
        break;
      default:
        return; // hyperspace — no path preview
    }

    for (const shot of shots) {
      const path = this._computeBulletPreviewPath(
        station, station.angle + shot.dAngle, station.power, planets, maxLen, shot.speed,
      );
      if (path.length < 2) continue;
      this._drawFadingPath(ctx, path, shot.alpha, shot.lw);
    }
  }

  _drawFadingPath(ctx, path, startAlpha, lw, colour = '255,255,255') {
    const c  = this.conv;
    const x0 = path[0].x * c,               y0 = path[0].y * c;
    const x1 = path[path.length - 1].x * c, y1 = path[path.length - 1].y * c;
    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, `rgba(${colour},${startAlpha})`);
    grad.addColorStop(1, `rgba(${colour},0)`);
    ctx.save();
    ctx.strokeStyle = grad;
    ctx.lineWidth   = lw;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    for (let i = 1; i < path.length; i++) ctx.lineTo(path[i].x * c, path[i].y * c);
    ctx.stroke();
    ctx.restore();
  }

  // ----------------------------------------------------------------
  // Velocity indicator — transparent triangle showing movement direction
  // ----------------------------------------------------------------

  _drawVelocityIndicator(ctx, station) {
    const cx  = station.position.x * this.conv;
    const cy  = station.position.y * this.conv;
    const vx  = station.velocity.x;
    const vy  = station.velocity.y;
    const mag = Math.sqrt(vx * vx + vy * vy);
    if (mag < 0.0001) return;

    const [cr, cg, cb] = station.colour;
    // Scale arrow length: 1 unit of speed → 200px visual length
    const len   = Math.min(80, mag / MAX_STATION_SPEED * 60);
    const angle = Math.atan2(vy, vx);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(len,        0);
    ctx.lineTo(len * 0.5, -8);
    ctx.lineTo(len * 0.5,  8);
    ctx.closePath();
    ctx.fillStyle   = `rgba(${cr},${cg},${cb},0.45)`;
    ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.75)`;
    ctx.lineWidth   = 1;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // ----------------------------------------------------------------
  // Station explosion — large expanding ring in team colour
  // ----------------------------------------------------------------

  _drawStationImplosion(ctx, station) {
    const t     = station.explosionT;
    const scale = Math.max(0, 1 - t * t);  // quad ease-in collapse
    if (scale <= 0) return;
    const cx  = station.position.x * this.conv;
    const cy  = station.position.y * this.conv;
    const r   = Math.max(1, station.radius * this.conv * scale);
    const [cr, cg, cb] = station.colour;
    const bright = t * 220;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(${Math.round(Math.min(255, cr + bright))},${Math.round(Math.min(255, cg + bright))},${Math.round(Math.min(255, cb + bright))})`;
    ctx.fill();
  }

  _drawStationExplosion(ctx, station) {
    const cx    = station.position.x * this.conv;
    const cy    = station.position.y * this.conv;
    const t     = station.explosionT;
    const maxR  = Math.max(40, station.radius * this.conv * 4);
    const r     = t * maxR;
    const alpha = Math.max(0, 1 - t);

    const isTarget = station.role === 'target';
    const [cr, cg, cb] = isTarget ? [204, 17, 17] : station.colour;

    // Outer ring
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${cr},${cg},${cb},${alpha})`;
    ctx.lineWidth   = Math.max(1, (1 - t) * 6);
    ctx.stroke();

    // Secondary ring — white for targets, orange for normal
    if (r > 8) {
      const [sr, sg, sb] = isTarget ? [255, 255, 255] : [255, 200, 80];
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${sr},${sg},${sb},${alpha * 0.6})`;
      ctx.lineWidth   = Math.max(1, (1 - t) * 3);
      ctx.stroke();
    }

    // Bright central flash (early in explosion)
    if (t < 0.3) {
      const [fr, fg, fb] = isTarget ? [255, 120, 120] : [255, 230, 120];
      ctx.beginPath();
      ctx.arc(cx, cy, station.radius * this.conv * (1 + t * 4), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${fr},${fg},${fb},${(0.3 - t) * 3.3})`;
      ctx.fill();
    }
  }

  // ----------------------------------------------------------------
  // Bullet glow trace — short trail of segments behind the bullet,
  // white-hot at the tip cooling toward the team colour at the tail.
  // ----------------------------------------------------------------

  _drawBulletGlow(ctx, bullet) {
    const trail = bullet.trail;
    const conv  = this.conv;
    const [tr, tg, tb] = bullet.owner.team.colour;

    // Collect the last few trail points plus the live bullet position as the tip
    const N = Math.min(7, trail.length);
    const pts = [];
    for (let i = trail.length - N; i < trail.length; i++) {
      if (trail[i]) pts.push(trail[i]);
    }
    pts.push(bullet.position); // live tip

    if (pts.length < 2) return;

    for (let i = 1; i < pts.length; i++) {
      const frac  = i / (pts.length - 1); // 0 = tail, 1 = tip
      const alpha = frac * 0.85;
      const r     = Math.round(tr + (255 - tr) * frac);
      const g     = Math.round(tg + (255 - tg) * frac);
      const b     = Math.round(tb + (255 - tb) * frac);
      const sizeMult = bullet.sizeMultiplier ?? 1;
      const lw    = Math.max(1, conv * (0.4 + frac * 1.0) * sizeMult);

      ctx.beginPath();
      ctx.moveTo(pts[i - 1].x * conv, pts[i - 1].y * conv);
      ctx.lineTo(pts[i].x     * conv, pts[i].y     * conv);
      ctx.strokeStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.lineWidth   = lw;
      ctx.stroke();
    }
  }

  // ----------------------------------------------------------------
  // Shockwave — solid disc that expands quickly then fades.
  // Masks object removal on the first few frames of an explosion.
  // Coordinates in game units; maxR is the maximum radius in game units.
  // ----------------------------------------------------------------

  _drawShockwave(ctx, gx, gy, t, maxR, r, g, b) {
    const cx   = gx * this.conv;
    const cy   = gy * this.conv;
    const ease = 1 - (1 - Math.min(1, t)) ** 2; // quad ease-out
    const rad  = Math.max(1, ease * maxR * this.conv);
    const alpha = Math.max(0, (1 - t) * 0.80);
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
    ctx.fill();
  }

  // ----------------------------------------------------------------
  // Particles — small radial debris dots fading over their lifetime.
  // Particle positions in game units.
  // ----------------------------------------------------------------

  _drawParticles(ctx, particles) {
    if (!particles?.length) return;
    const conv = this.conv;
    for (const p of particles) {
      const alpha = Math.max(0, 1 - p.t);
      const rad   = Math.max(1, conv * (1.2 - p.t * 0.8));
      const px    = p.x * conv;
      const py    = p.y * conv;
      if (!this._isVisible(px, py, rad)) continue;
      ctx.beginPath();
      ctx.arc(px, py, rad, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${Math.round(p.r)},${Math.round(p.g)},${Math.round(p.b)},${alpha})`;
      ctx.fill();
    }
  }

  // ----------------------------------------------------------------
  // Bullet — small filled circle in team colour
  // ----------------------------------------------------------------

  _drawBullet(ctx, bullet) {
    const cx   = bullet.position.x * this.conv;
    const cy   = bullet.position.y * this.conv;
    const mult = bullet.sizeMultiplier ?? 1;
    const r    = Math.max(2, bullet.owner.size.bulletRadius * this.conv * mult);
    const [cr, cg, cb] = bullet.owner.team.colour;

    if (bullet.reinforcementSignal) {
      // Pulsing radio-wave rings
      const pulse = (Date.now() / 400) % 1;
      for (let i = 0; i < 3; i++) {
        const t     = (pulse + i / 3) % 1;
        const ringR = r * (1 + t * 2.5);
        const alpha = (1 - t) * 0.6;
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},${alpha})`;
        ctx.lineWidth   = Math.max(1, r * 0.25);
        ctx.stroke();
      }
    }

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
    ctx.fill();
  }

  // ----------------------------------------------------------------
  // Explosion — expanding ring that fades out
  // ----------------------------------------------------------------

  _drawExplosion(ctx, bullet) {
    const cx = bullet.position.x * this.conv;
    const cy = bullet.position.y * this.conv;
    const t  = bullet.explosionT;               // 0→1
    const maxR = Math.max(20, 40 * this.conv);
    const r    = t * maxR;
    const alpha = Math.max(0, 1 - t);
    const [cr, cg, cb] = bullet.owner.team.colour;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${cr},${cg},${cb},${alpha})`;
    ctx.lineWidth   = Math.max(1, (1 - t) * 4);
    ctx.stroke();
    // Inner flash
    if (t < 0.3) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,200,${(0.3 - t) * 3})`;
      ctx.fill();
    }
  }

  // ----------------------------------------------------------------
  // Pulsar pressure rings — expanding circles that fade as they grow
  // ----------------------------------------------------------------

  _drawPulsarRings(ctx, planet) {
    const cx = planet.position.x * this.conv;
    const cy = planet.position.y * this.conv;
    const [pr, pg, pb] = planet.colour;
    const PULSE_MAX_R = 180;
    const bodyR = planet.impactRadius;

    for (const pulse of planet.pulsarPulses) {
      const t      = pulse.t;
      const pulseR = (bodyR + (PULSE_MAX_R - bodyR) * t) * this.conv;
      const alpha  = (1 - t) * 0.65;
      const width  = Math.max(1, (1 - t) * 3.5);

      ctx.beginPath();
      ctx.arc(cx, cy, pulseR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${pr},${pg},${pb},${alpha})`;
      ctx.lineWidth   = width;
      ctx.stroke();
    }
  }

  // ----------------------------------------------------------------
  // Hyperspace flash — departure ring + arrival glow
  // ----------------------------------------------------------------

  _drawHyperspaceFlash(ctx, station) {
    const flash = station.hyperspaceFlash;
    const [cr, cg, cb] = station.colour;
    const t      = flash.t;
    const maxR   = Math.max(40, station.radius * this.conv * 5);
    const fadeOut = Math.max(0, 1 - t);

    // Departure: expanding ring at old position
    const ox = flash.oldPos.x * this.conv;
    const oy = flash.oldPos.y * this.conv;
    ctx.beginPath();
    ctx.arc(ox, oy, t * maxR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${cr},${cg},${cb},${fadeOut * 0.85})`;
    ctx.lineWidth   = Math.max(1, fadeOut * 5);
    ctx.stroke();
    // Inner flash at departure
    if (t < 0.25) {
      ctx.beginPath();
      ctx.arc(ox, oy, maxR * 0.3 * (1 - t / 0.25), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${(0.25 - t) * 3})`;
      ctx.fill();
    }

    // Arrival: contracting glow at new position
    const nx = flash.newPos.x * this.conv;
    const ny = flash.newPos.y * this.conv;
    if (t > 0.1) {
      const at = Math.min(1, (t - 0.1) / 0.9);
      ctx.beginPath();
      ctx.arc(nx, ny, maxR * (1 - at), 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${(1 - at) * 0.7})`;
      ctx.lineWidth   = Math.max(1, (1 - at) * 4);
      ctx.stroke();
    }
  }

  // ----------------------------------------------------------------
  // Ghost trail — previous shot, drawn dashed at low opacity during AIMING
  // ----------------------------------------------------------------

  _drawGhostTrail(ctx, station) {
    const conv  = this.conv;
    const [tr, tg, tb] = station.colour;
    ctx.save();
    ctx.strokeStyle = `rgba(${tr},${tg},${tb},0.55)`;
    ctx.lineWidth   = Math.max(1, conv * 0.7);
    ctx.setLineDash([5, 5]);
    for (const trail of station.lastTrails) {
      ctx.beginPath();
      let penDown = false;
      for (const pt of trail) {
        if (!pt) { penDown = false; continue; } // wormhole break
        const px = pt.x * conv, py = pt.y * conv;
        if (!penDown) { ctx.moveTo(px, py); penDown = true; }
        else          { ctx.lineTo(px, py); }
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // ----------------------------------------------------------------
  // Off-screen bullet indicators — triangle at canvas edge + distance
  // ----------------------------------------------------------------

  _drawOffScreenIndicators(ctx, bullets, rockets = []) {
    const cx = this._vpW / 2, cy = this._vpH / 2;

    const entities = [
      ...bullets.filter(b => b.status === 'active').map(b => ({
        x: b.position.x, y: b.position.y, colour: b.owner.team.colour,
      })),
      ...(rockets ?? []).filter(r => r.status === 'active').map(r => ({
        x: r.position.x, y: r.position.y, colour: r.owner.team.colour,
      })),
    ];

    for (const entity of entities) {
      const bx = entity.x * this.conv;
      const by = entity.y * this.conv;
      if (bx >= 0 && bx <= this._vpW && by >= 0 && by <= this._vpH) continue;

      const [tr, tg, tb] = entity.colour;
      const colour = `rgb(${tr},${tg},${tb})`;
      const angle  = Math.atan2(by - cy, bx - cx);
      const cosA   = Math.cos(angle), sinA = Math.sin(angle);

      const edgeT = m => {
        let t = Infinity;
        if (cosA > 0) t = Math.min(t, (this._vpW - m - cx) / cosA);
        if (cosA < 0) t = Math.min(t, (m         - cx) / cosA);
        if (sinA > 0) t = Math.min(t, (this._vpH - m - cy) / sinA);
        if (sinA < 0) t = Math.min(t, (m         - cy) / sinA);
        return t;
      };

      // Triangle sits at the very canvas edge (m = 6 so it's not clipped)
      const tTri = edgeT(6);
      const tx   = cx + cosA * tTri, ty = cy + sinA * tTri;

      // Distance number sits inset (m = 30), where triangle used to be
      const tNum = edgeT(30);
      const nx   = cx + cosA * tNum, ny = cy + sinA * tNum;

      // Distance from nearest screen edge in game units
      const distPx = Math.max(0, -bx, bx - this._vpW, -by, by - this._vpH);
      const dist   = Math.round(distPx / this.conv);

      // Draw number at inset position — keep text right-side-up on left half
      const textAngle = (Math.abs(angle) > Math.PI / 2)
        ? angle - Math.PI
        : angle;
      ctx.save();
      ctx.translate(nx, ny);
      ctx.rotate(textAngle);
      ctx.font         = `bold 11px monospace`;
      ctx.fillStyle    = colour;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(dist, 0, 0);
      ctx.restore();

      // Draw triangle at edge
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo( 10,  0);
      ctx.lineTo( -7, -5);
      ctx.lineTo( -7,  5);
      ctx.closePath();
      ctx.fillStyle = colour;
      ctx.fill();
      ctx.restore();
    }
  }

  // ----------------------------------------------------------------
  // Redraw all bullet trails after a canvas resize (handles null breaks)
  // ----------------------------------------------------------------

  redrawTrails(bullets) {
    const ctx  = this.trailsCtx;
    const conv = this.conv;
    for (const bullet of bullets) {
      const trail = bullet.trail;
      if (trail.length < 2) continue;
      const [tr, tg, tb] = bullet.owner.team.colour;
      ctx.strokeStyle = `rgb(${tr},${tg},${tb})`;
      ctx.lineWidth   = Math.max(1, conv * 0.6);
      ctx.beginPath();
      let penDown = false;
      for (const pt of trail) {
        if (!pt) { penDown = false; continue; } // wormhole break
        const px = pt.x * conv, py = pt.y * conv;
        if (!penDown) { ctx.moveTo(px, py); penDown = true; }
        else          { ctx.lineTo(px, py); }
      }
      ctx.stroke();
    }
  }

  // ----------------------------------------------------------------
  // Collectables — rotating icy gems drawn live (rotation animated each frame)
  // ----------------------------------------------------------------

  _drawCollectables(ctx, collectables) {
    for (const collectable of collectables) {
      if (!collectable.alive) continue;
      this._drawCollectable(ctx, collectable);
    }
  }

  _drawCollectable(ctx, collectable) {
    const cx = collectable.position.x * this.conv;
    const cy = collectable.position.y * this.conv;
    const r  = Math.max(3, collectable.radius * this.conv);

    collectable.rotation = ((collectable.rotation ?? 0) + 0.018) % (Math.PI * 2);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(collectable.rotation);

    // Soft icy glow
    const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.8);
    glow.addColorStop(0,   'rgba(184,232,255,0.22)');
    glow.addColorStop(0.5, 'rgba(184,232,255,0.10)');
    glow.addColorStop(1,   'rgba(184,232,255,0)');
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.8, 0, Math.PI * 2);
    ctx.fillStyle = glow;
    ctx.fill();

    // Six spokes — alternating long (even) and short (odd)
    const spokeLen = [r * 0.9, r * 0.55, r * 0.9, r * 0.55, r * 0.9, r * 0.55];
    ctx.strokeStyle = '#B8E8FF';
    ctx.lineWidth   = Math.max(1, r * 0.12);
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 * i) / 6;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * spokeLen[i], Math.sin(a) * spokeLen[i]);
      ctx.stroke();
    }

    // Hexagon connecting spoke tips
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI * 2 * i) / 6;
      const x = Math.cos(a) * spokeLen[i];
      const y = Math.sin(a) * spokeLen[i];
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(184,232,255,0.6)';
    ctx.lineWidth   = Math.max(0.5, r * 0.08);
    ctx.stroke();

    // Bright centre dot
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(1, r * 0.18), 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    ctx.restore();
  }

  // ----------------------------------------------------------------
  // ----------------------------------------------------------------
  // Comet smoke trail — white puffs, same lifecycle as rocket smoke
  // ----------------------------------------------------------------

  _drawCometSmoke(ctx, smoke) {
    const conv = this.conv;
    for (const s of smoke) {
      let radius, alpha;
      const shrink = s.fast ? 1.0 : 0.95; // fast = collapses quickly; slow = barely shrinks
      if (s.t < 0.18) {
        radius = s.maxR * (s.t / 0.18) * conv;
        alpha  = s.fast ? 0.45 : 0.6;
      } else {
        let frac;
        if (s.t < 0.75) {
          frac = (s.t - 0.18) / 0.82;
        } else {
          const fracAt75 = (0.75 - 0.18) / 0.82;
          frac = fracAt75 + (s.t - 0.75) / 0.82 / (s.fast ? 3 : 5);
        }
        radius = s.maxR * Math.max(0, 1.0 - frac * shrink) * conv;
        alpha  = Math.max(0, (s.fast ? 0.45 : 0.6) * (1 - frac));
      }
      if (radius <= 0) continue;
      const cx = s.x * conv;
      const cy = s.y * conv;
      if (!this._isVisible(cx, cy, radius)) continue;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(220,235,255,${alpha.toFixed(3)})`;
      ctx.fill();
    }
  }

  // ----------------------------------------------------------------
  // Experimental: bitmap bloom particles for ship explosion
  // ----------------------------------------------------------------

  _drawShipExplosionBloom(ctx, particles) {
    const conv = this.conv;
    const img  = this._smokeImg?.complete ? this._smokeImg : null;
    const tc   = this._tintCanvas;
    const tctx = this._tintCtx;
    const lerp = (a, b, t) => a + (b - a) * t;

    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
      // Colour: ship → white → ship → black
      let cr, cg, cb;
      if (p.t < 0.3) {
        const f = p.t / 0.3;
        cr = Math.round(lerp(p.r, 255, f));
        cg = Math.round(lerp(p.g, 255, f));
        cb = Math.round(lerp(p.b, 255, f));
      } else if (p.t < 0.6) {
        const f = (p.t - 0.3) / 0.3;
        cr = Math.round(lerp(255, p.r, f));
        cg = Math.round(lerp(255, p.g, f));
        cb = Math.round(lerp(255, p.b, f));
      } else {
        const f = (p.t - 0.6) / 0.4;
        cr = Math.round(lerp(p.r, 0, f));
        cg = Math.round(lerp(p.g, 0, f));
        cb = Math.round(lerp(p.b, 0, f));
      }

      // Size: expand then contract
      let radius;
      if (p.t < 0.25) {
        radius = p.maxR * (p.t / 0.25) * conv;
      } else {
        radius = p.maxR * Math.max(0, 1.0 - (p.t - 0.25) / 0.75 * 0.95) * conv;
      }
      if (radius <= 0) continue;
      if (!this._isVisible(p.x * conv, p.y * conv, radius)) continue;

      // Alpha: quick fade-in, hold, fade-out
      let alpha;
      if (p.t < 0.1)      alpha = (p.t / 0.1) * 0.8;
      else if (p.t > 0.7) alpha = ((1 - p.t) / 0.3) * 0.8;
      else                 alpha = 0.8;

      ctx.globalAlpha = alpha;
      if (img && !this._useCircles) {
        tctx.clearRect(0, 0, 256, 256);
        tctx.drawImage(img, 0, 0, 256, 256);
        tctx.globalCompositeOperation = 'source-atop';
        tctx.fillStyle = `rgb(${cr},${cg},${cb})`;
        tctx.fillRect(0, 0, 256, 256);
        tctx.globalCompositeOperation = 'source-over';
        const size = radius * 2;
        ctx.drawImage(tc, p.x * conv - radius, p.y * conv - radius, size, size);
      } else {
        // Halo + core: mimics bitmap falloff without offscreen canvas cost
        ctx.globalAlpha = alpha * 0.35;
        ctx.beginPath();
        ctx.arc(p.x * conv, p.y * conv, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
        ctx.fill();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x * conv, p.y * conv, radius * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  // ----------------------------------------------------------------
  // Experimental: fireball smoke — instant expand, slow fade hold
  // ----------------------------------------------------------------

  _drawFireballSmoke(ctx, smoke) {
    const conv = this.conv;
    const img  = this._smokeImg?.complete ? this._smokeImg : null;
    for (const s of smoke) {
      let radius, alpha;
      if (s.t < 0.03) {
        // Almost instant bloom to full size
        radius = s.maxR * (s.t / 0.03) * conv;
        alpha  = 0.5;
      } else {
        // Hold size, slow alpha fade
        const frac = (s.t - 0.03) / 0.97;
        radius = s.maxR * conv;
        alpha  = Math.max(0, 0.5 * (1 - frac));
      }
      if (radius <= 0) continue;
      const px   = s.x * conv;
      const py   = s.y * conv;
      if (!this._isVisible(px, py, radius)) continue;
      const size = radius * 2;
      if (img && !this._useCircles) {
        const tinted = this._getTintedSmoke(s.r, s.g, s.b);
        ctx.globalAlpha = alpha;
        ctx.drawImage(tinted, px - radius, py - radius, size, size);
        ctx.globalAlpha = 1;
      } else {
        ctx.fillStyle = `rgb(${s.r},${s.g},${s.b})`;
        ctx.globalAlpha = alpha * 0.35;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(px, py, radius * 0.45, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  // ----------------------------------------------------------------
  // Experimental: fireball emitters
  // ----------------------------------------------------------------

  _drawFireballs(ctx, fireballs) {
    const conv = this.conv;
    const img  = this._smokeImg?.complete ? this._smokeImg : null;
    const tc   = this._tintCanvas;
    const tctx = this._tintCtx;

    ctx.globalCompositeOperation = 'lighter';
    for (const fb of fireballs) {
      const radius = (7.5 + 4.5 * (1 - fb.t)) * conv;
      if (!this._isVisible(fb.x * conv, fb.y * conv, radius)) continue;
      const alpha  = Math.max(0, 0.7 * (1 - fb.t));

      ctx.globalAlpha = alpha;
      if (img && !this._useCircles) {
        tctx.clearRect(0, 0, 256, 256);
        tctx.drawImage(img, 0, 0, 256, 256);
        tctx.globalCompositeOperation = 'source-atop';
        tctx.fillStyle = `rgb(${fb.r},${fb.g},${fb.b})`;
        tctx.fillRect(0, 0, 256, 256);
        tctx.globalCompositeOperation = 'source-over';
        const size = radius * 2;
        ctx.drawImage(tc, fb.x * conv - radius, fb.y * conv - radius, size, size);
      } else {
        ctx.fillStyle = `rgb(${fb.r},${fb.g},${fb.b})`;
        ctx.globalAlpha = alpha * 0.35;
        ctx.beginPath();
        ctx.arc(fb.x * conv, fb.y * conv, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(fb.x * conv, fb.y * conv, radius * 0.45, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  // ----------------------------------------------------------------
  // Rocket smoke trail — expand quickly then contract + fade slowly
  // ----------------------------------------------------------------

  _drawRocketSmoke(ctx, smoke) {
    const conv = this.conv;
    const img  = this._smokeImg?.complete && this._smokeImg.naturalWidth > 0 ? this._smokeImg : null;
    for (const s of smoke) {
      let radius, alpha;
      if (s.t < 0.18) {
        // Quick expand phase
        radius = s.maxR * (s.t / 0.18) * conv;
        alpha  = 0.5;
      } else {
        // Contract + fade phase — last 25% of life runs at 1/5 speed
        let frac;
        if (s.t < 0.75) {
          frac = (s.t - 0.18) / 0.82;
        } else {
          const fracAt75 = (0.75 - 0.18) / 0.82;          // progress at 75% mark
          frac = fracAt75 + (s.t - 0.75) / 0.82 / 4;      // 5× slower from here
        }
        radius = s.maxR * Math.max(0, 1.0 - frac * 0.5) * conv;
        alpha  = Math.max(0, 0.5 * (1 - frac));
      }
      if (radius <= 0) continue;
      const px   = s.x * conv;
      const py   = s.y * conv;
      if (!this._isVisible(px, py, radius)) continue;
      const size = radius * 2;
      if (this._performance === 'experimental' && img && !this._useCircles) {
        const tinted = this._getTintedSmoke(s.r, s.g, s.b);
        ctx.globalAlpha = alpha;
        ctx.drawImage(tinted, px - radius, py - radius, size, size);
        ctx.globalAlpha = 1;
      } else {
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${s.r},${s.g},${s.b},${alpha.toFixed(3)})`;
        ctx.fill();
      }
    }
  }

  // ----------------------------------------------------------------
  // Rocket blast zones — solid expanding circle, visual = collision boundary
  // ----------------------------------------------------------------

  _drawRocketBlasts(ctx, blasts) {
    const conv = this.conv;
    for (const blast of blasts) {
      const cx = blast.x * conv;
      const cy = blast.y * conv;
      const r  = blast.currentRadius * conv;
      const t  = blast.currentRadius / blast.maxRadius; // 0 → 1
      const [cr, cg, cb] = blast.owner.team.colour;

      // Solid fill — stays opaque while lethal, fades only in last 20%
      const fillAlpha = t < 0.8 ? 0.55 : 0.55 * (1 - (t - 0.8) / 0.2);
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${fillAlpha.toFixed(3)})`;
      ctx.fill();

      // Bright hard edge showing the exact kill boundary
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${(0.9 - t * 0.6).toFixed(3)})`;
      ctx.lineWidth   = Math.max(2, conv * 0.7);
      ctx.stroke();
    }
  }

  // ----------------------------------------------------------------
  // Armour Rings — dashed rings indicating active armour layers
  // ----------------------------------------------------------------

  _drawArmourRings(ctx, station) {
    const conv  = this.conv;
    const cx    = station.position.x * conv;
    const cy    = station.position.y * conv;
    const r     = Math.max(3, station.radius * conv);
    const [cr, cg, cb] = station.colour;
    const flash = station.armourFlash ?? 0;
    const layers = station.armourLayers ?? 0;

    ctx.save();
    ctx.setLineDash([Math.max(2, r * 0.25), Math.max(2, r * 0.15)]);

    // Flash ring when a layer was just absorbed (shows even at 0 layers)
    if (flash > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.25, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,220,80,${flash * 0.9})`;
      ctx.lineWidth   = Math.max(1.5, conv * 0.6);
      ctx.stroke();
    }

    // One dashed ring per remaining layer
    for (let i = 0; i < layers; i++) {
      const ringR = r * (1.22 + i * 0.18);
      ctx.beginPath();
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.75)`;
      ctx.lineWidth   = Math.max(1, conv * 0.45);
      ctx.stroke();
    }

    ctx.setLineDash([]);
    ctx.restore();
  }

  // ----------------------------------------------------------------
  // Frozen station overlay — stationary ice blob particles
  // ----------------------------------------------------------------

  _drawFrozenOverlay(ctx, station) {
    const conv  = this.conv;
    const cx    = station.position.x * conv;
    const cy    = station.position.y * conv;
    const r     = Math.max(3, station.radius * conv);
    const depth = station.frozen ?? 0;
    const flash = station.frozenFlash ?? 0;

    // Use whichever is higher — ongoing frozen turn (flash reset to 1) or residual from impact
    const baseAlpha = Math.max(depth > 0 ? 0.85 : 0, flash);
    if (baseAlpha <= 0) return;

    const blobCount = Math.max(depth, 1) * 14; // 14 / 28 / 42 blobs per stack level
    ctx.save();
    for (let i = 0; i < blobCount; i++) {
      // Fixed positions derived from index — golden angle spread for even coverage
      const ang  = i * 2.399963; // golden angle in radians
      const band = i % 4;        // 4 concentric bands
      const dist = r * (0.15 + band * 0.25);
      const bx   = cx + Math.cos(ang) * dist;
      const by   = cy + Math.sin(ang) * dist;
      const br   = r * (0.13 + (i % 5) * 0.04);

      // Individual fade: later blobs begin fading earlier
      const fadeThreshold = 1 - (i / blobCount) * 0.6;
      const blobAlpha = baseAlpha > fadeThreshold
        ? baseAlpha * 0.9
        : (baseAlpha / fadeThreshold) * 0.9;

      ctx.globalAlpha = Math.min(0.92, blobAlpha);
      // Outer ice highlight
      ctx.fillStyle = 'rgba(210,240,255,1)';
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
      // Inner bright core
      ctx.fillStyle = 'rgba(240,252,255,1)';
      ctx.beginPath();
      ctx.arc(bx - br * 0.25, by - br * 0.25, br * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ----------------------------------------------------------------
  // Electrified station overlay — electric arcs crawling across the
  // hull, slowly morphing (smooth functions of time, no per-frame
  // randomness, no gradients)
  // ----------------------------------------------------------------

  _drawElectrifiedOverlay(ctx, station) {
    const conv   = this.conv;
    const cx     = station.position.x * conv;
    const cy     = station.position.y * conv;
    const r      = Math.max(3, station.radius * conv);
    const stacks = station.electrified ?? 0;
    const flash  = station.electrifiedFlash ?? 0;

    // Use whichever is higher — ongoing condition (steady crackle) or residual hit flash
    const alpha = Math.max(stacks > 0 ? 0.85 : 0, flash);
    if (alpha <= 0) return;

    const t    = Date.now() / 1000;
    const seed = (Number(station.id) || 0) * 2.4; // de-sync multiple electrified ships

    ctx.save();
    ctx.lineCap  = 'round';
    ctx.lineJoin = 'round';

    // Arcs rooted on the rim, snaking across the hull with layered slow sine wobble
    const numArcs = 2 + stacks; // 3 / 4 / 5 arcs at stack 1 / 2 / 3
    const SEGS    = 9;
    for (let i = 0; i < numArcs; i++) {
      const ph  = seed + i * 2.4;
      // Endpoint angles on the rim, drifting slowly around the hull
      const th0 = ph + t * 0.30 + Math.sin(t * 0.45 + ph) * 0.7;
      const th1 = th0 + Math.PI * (0.7 + 0.35 * Math.sin(t * 0.27 + ph * 1.7));
      const x0  = cx + Math.cos(th0) * r, y0 = cy + Math.sin(th0) * r;
      const x1  = cx + Math.cos(th1) * r, y1 = cy + Math.sin(th1) * r;
      // Wobble applied perpendicular to the chord
      const dx  = x1 - x0, dy = y1 - y0;
      const len = Math.hypot(dx, dy) || 1;
      const px  = -dy / len, py = dx / len;

      ctx.beginPath();
      ctx.moveTo(x0, y0);
      for (let s = 1; s < SEGS; s++) {
        const f   = s / SEGS;
        const env = Math.sin(f * Math.PI); // pin endpoints to the rim
        const wob = (Math.sin(t * 1.1 + ph + s * 2.7) * 0.30 +
                     Math.sin(t * 1.9 + ph * 1.3 + s * 5.1) * 0.14) * env * r;
        ctx.lineTo(x0 + dx * f + px * wob, y0 + dy * f + py * wob);
      }
      ctx.lineTo(x1, y1);

      // Per-arc shimmer so arcs brighten and fade out of phase
      const shimmer = 0.65 + 0.35 * Math.sin(t * 2.2 + ph * 2.1);
      // Wide soft glow stroke, then bright core over the same path
      ctx.strokeStyle = `rgba(90,180,255,${(alpha * shimmer * 0.35).toFixed(3)})`;
      ctx.lineWidth   = Math.max(2, r * 0.22);
      ctx.stroke();
      ctx.strokeStyle = `rgba(225,245,255,${(alpha * shimmer).toFixed(3)})`;
      ctx.lineWidth   = Math.max(1, r * 0.07);
      ctx.stroke();

      // Bright contact nodes where the arcs root onto the hull
      ctx.fillStyle = `rgba(200,235,255,${(alpha * shimmer * 0.9).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(x0, y0, Math.max(1, r * 0.09), 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x1, y1, Math.max(1, r * 0.09), 0, Math.PI * 2); ctx.fill();
    }

    // Faint outer corona ring breathing with the condition
    const breathe = 0.5 + 0.5 * Math.sin(t * 1.6 + seed);
    ctx.beginPath();
    ctx.arc(cx, cy, r * (1.3 + breathe * 0.12), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(140,210,255,${(alpha * 0.25).toFixed(3)})`;
    ctx.lineWidth   = Math.max(1, r * 0.06);
    ctx.stroke();

    ctx.restore();
  }

  // ----------------------------------------------------------------
  // Mind control flash — rippling colour wash on a converted station
  // ----------------------------------------------------------------

  _drawMindControlFlash(ctx, station) {
    const conv  = this.conv;
    const cx    = station.position.x * conv;
    const cy    = station.position.y * conv;
    const r     = Math.max(3, station.radius * conv);
    const alpha = station.mindControlFlash ?? 0;
    if (alpha <= 0) return;

    const [cr, cg, cb] = station.team.colour;

    ctx.save();
    // Expanding ripple rings
    for (let i = 0; i < 3; i++) {
      const t     = Math.max(0, alpha - i * 0.25);
      const ringR = r * (1.1 + i * 0.35 + (1 - alpha) * 0.8);
      ctx.beginPath();
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${(t * 0.7).toFixed(3)})`;
      ctx.lineWidth   = Math.max(1, r * 0.12);
      ctx.stroke();
    }
    // Overlay wash
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${cr},${cg},${cb},${(alpha * 0.45).toFixed(3)})`;
    ctx.fill();
    ctx.restore();
  }

  // ----------------------------------------------------------------
  // Repulsor Fields — subtle expanding ring centred on station
  // ----------------------------------------------------------------

  _drawRepulsorFields(ctx, repulsorFields) {
    if (!repulsorFields?.length) return;
    const conv = this.conv;
    const now  = Date.now() / 1000;
    for (const rf of repulsorFields) {
      const cx = rf.station.position.x * conv;
      const cy = rf.station.position.y * conv;
      const R  = rf.influenceRadius * conv;
      const [cr, cg, cb] = rf.station.team.colour;

      // Two pulsing rings at different phases so the field looks animated
      for (let phase = 0; phase < 2; phase++) {
        const t     = ((now * 0.7 + phase * 0.5) % 1);
        const ringR = R * (0.3 + t * 0.7);
        const alpha = (1 - t) * 0.35;
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${cr},${cg},${cb},${alpha})`;
        ctx.lineWidth   = Math.max(1, conv * 0.4);
        ctx.stroke();
      }

      // Faint fill
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${cr},${cg},${cb},0.03)`;
      ctx.fill();
    }
  }

  // ----------------------------------------------------------------
  // Force Shields
  // ----------------------------------------------------------------

  _drawShields(ctx, shields) {
    const conv = this.conv;
    const now  = Date.now() / 1000;
    for (const shield of shields) {
      if (!shield.alive) continue;
      const cx = shield.station.position.x * conv;
      const cy = shield.station.position.y * conv;
      const r  = shield.radius * conv + Math.sin(now * 4 * Math.PI) * 2;
      const [cr, cg, cb] = shield.station.team.colour;

      // Faint fill
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${cr},${cg},${cb},0.07)`;
      ctx.fill();

      // Pulsing ring
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},0.7)`;
      ctx.lineWidth   = Math.max(1.5, conv * 0.5);
      ctx.stroke();
    }
  }

  // ----------------------------------------------------------------
  // Rockets
  // ----------------------------------------------------------------

  _drawRockets(ctx, rockets) {
    const conv = this.conv;
    for (const rocket of rockets) {
      if (rocket.status === 'dead') continue;

      // Particle trail
      const trail = rocket.trail;
      if (trail.length > 1) {
        const [cr, cg, cb] = rocket.owner.team.colour;
        for (let i = Math.max(0, trail.length - 20); i < trail.length - 1; i++) {
          const alpha = ((i - (trail.length - 21)) / 20) * 0.5;
          ctx.beginPath();
          ctx.moveTo(trail[i].x * conv, trail[i].y * conv);
          ctx.lineTo(trail[i + 1].x * conv, trail[i + 1].y * conv);
          ctx.strokeStyle = `rgba(${cr},${cg},${cb},${alpha.toFixed(2)})`;
          ctx.lineWidth   = Math.max(1.5, conv * 0.8);
          ctx.stroke();
        }
      }

      // Rocket body — small glowing circle
      if (rocket.status !== 'exploding') {
        const px = rocket.position.x * conv;
        const py = rocket.position.y * conv;
        const [cr, cg, cb] = rocket.owner.team.colour;
        ctx.beginPath();
        ctx.arc(px, py, Math.max(2, conv * 1.2), 0, Math.PI * 2);
        ctx.fillStyle   = `rgb(${cr},${cg},${cb})`;
        ctx.shadowColor = `rgba(${cr},${cg},${cb},0.8)`;
        ctx.shadowBlur  = 6;
        ctx.fill();
        ctx.shadowBlur  = 0;
      }
    }
  }

  // ----------------------------------------------------------------
  // VFX — collectable shatter, collectable grant text, triple-cannon muzzle, laser path
  // ----------------------------------------------------------------

  _drawVFX(ctx, vfxList) {
    for (const vfx of vfxList) {
      switch (vfx.type) {
        case 'collectableShatter':     this._drawCollectableShatter(ctx, vfx);      break;
        case 'collectableGrant':       this._drawCollectableGrant(ctx, vfx);        break;
        case 'tripleCannonMuzzle':     this._drawTripleCannonMuzzle(ctx, vfx);      break;
        case 'laserPath':              this._drawLaserPath(ctx, vfx);               break;
        case 'glitter':                this._drawGlitter(ctx, vfx);                 break;
        case 'qtFlash':                this._drawQtFlash(ctx, vfx);                 break;
        case 'electroStun':            this._drawElectroStun(ctx, vfx);             break;
        case 'teleportFlash':          this._drawTeleportFlash(ctx, vfx);           break;
        case 'superLaserConverge':     this._drawSuperLaserConverge(ctx, vfx);      break;
        case 'superLaserBeam':         this._drawSuperLaserBeam(ctx, vfx);          break;
        case 'mindControlCharge':      this._drawMindControlCharge(ctx, vfx);       break;
        case 'mindControlBeam':        this._drawMindControlBeam(ctx, vfx);         break;
      }
    }
  }

  _drawCollectableShatter(ctx, vfx) {
    const cx   = vfx.x * this.conv;
    const cy   = vfx.y * this.conv;
    const t    = vfx.t;
    const conv = this.conv;

    for (const shard of vfx.shards) {
      const dist  = shard.speed * t * conv * 20;
      const sx    = cx + Math.cos(shard.angle) * dist;
      const sy    = cy + Math.sin(shard.angle) * dist;
      const len   = Math.max(1, shard.length * conv);
      const alpha = Math.max(0, 1 - t);

      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(shard.angle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(len, 0);
      ctx.strokeStyle = `rgba(184,232,255,${alpha})`;
      ctx.lineWidth   = Math.max(1, conv * 0.3);
      ctx.stroke();
      ctx.restore();
    }
  }

  _drawCollectableGrant(ctx, vfx) {
    const cx   = vfx.x * this.conv;
    const cy   = vfx.y * this.conv;
    const t    = vfx.t;
    const rise = t * 20 * this.conv;
    // Quick fade-in, then a continuous, gentle ease all the way down to zero
    // (no opacity plateau, smooth/zero slope as it vanishes) so the grant label
    // melts away gracefully instead of holding solid then cutting off.
    const fadeIn  = Math.min(1, t / 0.12);
    const fadeOut = 0.5 * (1 + Math.cos(Math.min(1, t) * Math.PI)); // 1 → 0, eased
    const alpha   = Math.max(0, fadeIn * fadeOut);

    ctx.save();
    ctx.font         = `bold ${Math.max(10, Math.floor(this._vpW / 55))}px monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha  = alpha;
    ctx.fillStyle    = vfx.colour;
    ctx.shadowColor  = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur   = 4;
    ctx.fillText(vfx.text, cx, cy - rise);
    ctx.restore();
  }

  _drawTripleCannonMuzzle(ctx, vfx) {
    const cx    = vfx.x * this.conv;
    const cy    = vfx.y * this.conv;
    const t     = vfx.t;
    const alpha = Math.max(0, 1 - t);
    const len   = (1 - t) * 18 * this.conv;
    const [cr, cg, cb] = vfx.colour;

    for (const dDeg of [-5, 0, 5]) {
      const rad = (((vfx.angle + dDeg) % 360 + 360) % 360 * Math.PI) / 180;
      const dx  = Math.sin(rad);
      const dy  = Math.cos(rad);

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + dx * len, cy + dy * len);
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},${alpha})`;
      ctx.lineWidth   = Math.max(1, (1 - t) * 3.5);
      ctx.stroke();
    }
  }

  _drawGlitter(ctx, vfx) {
    const conv  = this.conv;
    const alpha = Math.max(0, 1 - vfx.t);
    for (const p of vfx.particles) {
      const px = (p.ox + p.vx * vfx.t * 30) * conv;
      const py = (p.oy + p.vy * vfx.t * 30) * conv;
      const r  = Math.max(1, p.size * conv * (1 - vfx.t * 0.6));
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fillStyle = p.colour;
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ----------------------------------------------------------------
  // Quantum Torpedo teleport flash — expanding ring at entry / exit
  // ----------------------------------------------------------------

  _drawQtFlash(ctx, vfx) {
    const cx = vfx.x * this.conv;
    const cy = vfx.y * this.conv;
    const t  = vfx.t;
    const r  = t * 18 * this.conv;
    const ringA  = Math.max(0, 1 - t * 2.2);
    const flashA = Math.max(0, (0.35 - t) * 3);

    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(1, r), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${vfx.r},${vfx.g},${vfx.b},${ringA})`;
    ctx.lineWidth   = Math.max(1, (1 - t) * 3 * this.conv);
    ctx.stroke();

    if (flashA > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1, r * 0.5), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${flashA})`;
      ctx.fill();
    }
  }

  // ----------------------------------------------------------------
  // Electro Stun — flickering forked lightning bolts
  // ----------------------------------------------------------------

  _drawElectroStun(ctx, vfx) {
    const conv  = this.conv;
    const cx    = vfx.x * conv;
    const cy    = vfx.y * conv;
    const alpha = Math.max(0, 1 - vfx.t * 1.8);
    if (alpha <= 0) return;
    const { r, g, b } = vfx;
    const numBolts = vfx.numBolts;
    const rangeConv = vfx.range * conv;

    ctx.save();
    for (let i = 0; i < numBolts; i++) {
      const boltAngle = numBolts > 1
        ? vfx.angle - vfx.spreadRad + (i / (numBolts - 1)) * vfx.spreadRad * 2
        : vfx.angle;
      const segs   = 6 + Math.floor(Math.random() * 4);
      const segLen = rangeConv / segs;
      const mainDX = Math.sin(boltAngle), mainDY = Math.cos(boltAngle);
      const perpDX = -mainDY,              perpDY = mainDX;
      let bx = cx, by = cy;
      const pts = [[bx, by]];
      for (let s = 0; s < segs; s++) {
        const jitter = (Math.random() - 0.5) * segLen * 1.0;
        bx += mainDX * segLen + perpDX * jitter;
        by += mainDY * segLen + perpDY * jitter;
        pts.push([bx, by]);
      }
      // Colour glow
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let p = 1; p < pts.length; p++) ctx.lineTo(pts[p][0], pts[p][1]);
      ctx.strokeStyle = `rgba(${r},${g},${b},${(alpha * 0.5).toFixed(3)})`;
      ctx.lineWidth   = 7;
      ctx.stroke();
      // White core
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let p = 1; p < pts.length; p++) ctx.lineTo(pts[p][0], pts[p][1]);
      ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
      ctx.lineWidth   = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  // ----------------------------------------------------------------
  // Teleport flash — expanding ring at origin and destination
  // ----------------------------------------------------------------

  _drawTeleportFlash(ctx, vfx) {
    const cx = vfx.x * this.conv;
    const cy = vfx.y * this.conv;
    const t  = vfx.t;
    const r  = t * 22 * this.conv;
    const ringA  = Math.max(0, 1 - t * 2);
    const flashA = Math.max(0, (0.45 - t) * 3);

    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(1, r), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${vfx.r},${vfx.g},${vfx.b},${ringA})`;
    ctx.lineWidth   = Math.max(1, (1 - t) * 3.5 * this.conv);
    ctx.stroke();

    if (flashA > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(1, r * 0.45), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180,230,255,${flashA})`;
      ctx.fill();
    }
  }

  // ----------------------------------------------------------------
  // Super Laser convergence — thin beams assembling at focal point
  // ----------------------------------------------------------------

  _drawSuperLaserConverge(ctx, vfx) {
    const conv   = this.conv;
    const cx     = vfx.x * conv;
    const cy     = vfx.y * conv;
    const t      = vfx.t;
    const alpha  = Math.min(1, t * 4) * Math.max(0, 1 - (t - 0.5) * 4);
    if (alpha <= 0) return;
    const rad    = (vfx.angle * Math.PI) / 180;
    const focalD = 18 * conv;
    const focalX = cx + Math.sin(rad) * focalD;
    const focalY = cy + Math.cos(rad) * focalD;
    const { r, g, b } = vfx;

    ctx.save();
    const numBeams = 6;
    for (let i = 0; i < numBeams; i++) {
      const beamAngle = (i / numBeams) * Math.PI * 2;
      const beamDist  = (1 - t * 0.85) * 45 * conv;
      const startX    = cx + Math.cos(beamAngle) * beamDist;
      const startY    = cy + Math.sin(beamAngle) * beamDist;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(focalX, focalY);
      ctx.strokeStyle = `rgba(${r},${g},${b},${(alpha * 0.55).toFixed(3)})`;
      ctx.lineWidth   = Math.max(1, (1 - t * 0.5) * 2.5);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(focalX, focalY);
      ctx.strokeStyle = `rgba(255,255,255,${(alpha * 0.28).toFixed(3)})`;
      ctx.lineWidth   = 1;
      ctx.stroke();
    }

    // Pulsing focal dot
    const pulseR = (2 + Math.sin(t * Math.PI * 14) * 1.5) * conv;
    ctx.beginPath();
    ctx.arc(focalX, focalY, Math.max(2, pulseR), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${(alpha * 0.9).toFixed(3)})`;
    ctx.fill();

    ctx.restore();
  }

  // ----------------------------------------------------------------
  // Super Laser beam — thick devastating straight-line beam
  // ----------------------------------------------------------------

  _drawSuperLaserBeam(ctx, vfx) {
    if (!vfx.path?.length) return;
    const conv  = this.conv;
    const t     = vfx.t;
    const alpha = Math.sin(t * Math.PI);
    const { r, g, b } = vfx;

    ctx.save();
    // Outer glow
    ctx.beginPath();
    ctx.moveTo(vfx.path[0].x * conv, vfx.path[0].y * conv);
    for (let i = 1; i < vfx.path.length; i++) ctx.lineTo(vfx.path[i].x * conv, vfx.path[i].y * conv);
    ctx.strokeStyle = `rgba(${r},${g},${b},${(alpha * 0.22).toFixed(3)})`;
    ctx.lineWidth   = 22;
    ctx.stroke();

    // Mid glow
    ctx.beginPath();
    ctx.moveTo(vfx.path[0].x * conv, vfx.path[0].y * conv);
    for (let i = 1; i < vfx.path.length; i++) ctx.lineTo(vfx.path[i].x * conv, vfx.path[i].y * conv);
    ctx.strokeStyle = `rgba(${r},${g},${b},${(alpha * 0.65).toFixed(3)})`;
    ctx.lineWidth   = 9;
    ctx.stroke();

    // White core
    ctx.beginPath();
    ctx.moveTo(vfx.path[0].x * conv, vfx.path[0].y * conv);
    for (let i = 1; i < vfx.path.length; i++) ctx.lineTo(vfx.path[i].x * conv, vfx.path[i].y * conv);
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
    ctx.lineWidth   = 3;
    ctx.stroke();

    ctx.restore();
  }

  // ----------------------------------------------------------------
  // Mind Control Charge — brief glowing aura around the station
  // ----------------------------------------------------------------

  _drawMindControlCharge(ctx, vfx) {
    const cx    = vfx.x * this.conv;
    const cy    = vfx.y * this.conv;
    const t     = vfx.t;
    const alpha = Math.sin(t * Math.PI) * 0.75;
    const R     = (40 + t * 30) * this.conv;
    const { r, g, b } = vfx;

    ctx.save();
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    grad.addColorStop(0,   `rgba(${r},${g},${b},${(alpha * 0.8).toFixed(3)})`);
    grad.addColorStop(0.5, `rgba(${r},${g},${b},${(alpha * 0.3).toFixed(3)})`);
    grad.addColorStop(1,   `rgba(${r},${g},${b},0)`);
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();
  }

  // ----------------------------------------------------------------
  // Mind Control Beam — animated sine-wave laser in team colour
  // ----------------------------------------------------------------

  _drawMindControlBeam(ctx, vfx) {
    if (!vfx.path?.length) return;
    const conv  = this.conv;
    const t     = vfx.t;
    const alpha = Math.sin(t * Math.PI);
    const { r, g, b } = vfx;
    const phase = -Date.now() / 83;

    const AMPLITUDE    = 4.8;  // ± one medium-station radius (= medium station width peak-to-peak)
    const CYCLES       = 10.5;
    const POINT_SPACING = 2;   // game units between sub-sampled points (~12 pts/cycle)

    // Linearly sub-sample the physics path so the sine wave is smooth
    const raw = vfx.path;
    const dense = [raw[0]];
    for (let i = 1; i < raw.length; i++) {
      const ax = raw[i - 1].x, ay = raw[i - 1].y;
      const bx = raw[i].x,     by = raw[i].y;
      const dx = bx - ax,      dy = by - ay;
      const n  = Math.max(1, Math.ceil(Math.sqrt(dx * dx + dy * dy) / POINT_SPACING));
      for (let s = 1; s <= n; s++) {
        const f = s / n;
        dense.push({ x: ax + dx * f, y: ay + dy * f });
      }
    }

    // Cumulative arc length for uniform wavelength regardless of point spacing
    const arc = [0];
    for (let i = 1; i < dense.length; i++) {
      const dx = dense[i].x - dense[i - 1].x;
      const dy = dense[i].y - dense[i - 1].y;
      arc.push(arc[i - 1] + Math.sqrt(dx * dx + dy * dy));
    }
    const totalArc = arc[arc.length - 1] || 1;

    // Pre-compute transverse-sine-wave canvas coordinates
    const pts = dense.map((pt, i) => {
      const segDx = i < dense.length - 1
        ? dense[i + 1].x - pt.x : pt.x - dense[i - 1].x;
      const segDy = i < dense.length - 1
        ? dense[i + 1].y - pt.y : pt.y - dense[i - 1].y;
      const len  = Math.sqrt(segDx * segDx + segDy * segDy) || 1;
      const nx   = -segDy / len;
      const ny   =  segDx / len;
      const wave = Math.sin(2 * Math.PI * CYCLES * (arc[i] / totalArc) + phase) * AMPLITUDE;
      return { x: (pt.x + nx * wave) * conv, y: (pt.y + ny * wave) * conv };
    });

    const tracePath = () => {
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    };

    ctx.save();

    // Outer glow
    ctx.beginPath(); tracePath();
    ctx.strokeStyle = `rgba(${r},${g},${b},${(alpha * 0.2).toFixed(3)})`;
    ctx.lineWidth   = 14;
    ctx.stroke();

    // Coloured wave
    ctx.beginPath(); tracePath();
    ctx.strokeStyle = `rgba(${r},${g},${b},${(alpha * 0.85).toFixed(3)})`;
    ctx.lineWidth   = 2.5;
    ctx.stroke();

    // White core
    ctx.beginPath(); tracePath();
    ctx.strokeStyle = `rgba(255,255,255,${(alpha * 0.5).toFixed(3)})`;
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    ctx.restore();
  }

  // ----------------------------------------------------------------
  // Practice target — archery bullseye
  // ----------------------------------------------------------------

  _drawTarget(ctx, target) {
    const conv = this.conv;
    const cx   = target.position.x * conv;
    const cy   = target.position.y * conv;
    const r    = Math.max(4, target.radius * conv);

    for (let i = 5; i >= 1; i--) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * i / 5, 0, Math.PI * 2);
      ctx.fillStyle = i % 2 === 0 ? '#cc1111' : '#ffffff';
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth   = Math.max(0.5, conv * 0.2);
    ctx.stroke();
  }

  _drawLaserPath(ctx, vfx) {
    if (!vfx.path?.length) return;
    const conv  = this.conv;
    const alpha = Math.sin(vfx.t * Math.PI);
    const [cr, cg, cb] = vfx.colour;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(vfx.path[0].x * conv, vfx.path[0].y * conv);
    for (let i = 1; i < vfx.path.length; i++)
      ctx.lineTo(vfx.path[i].x * conv, vfx.path[i].y * conv);

    // Wide team-colour glow
    ctx.strokeStyle = `rgba(${cr},${cg},${cb},${(alpha * 0.5).toFixed(3)})`;
    ctx.lineWidth   = 6;
    ctx.stroke();

    // Narrow white core
    ctx.beginPath();
    ctx.moveTo(vfx.path[0].x * conv, vfx.path[0].y * conv);
    for (let i = 1; i < vfx.path.length; i++)
      ctx.lineTo(vfx.path[i].x * conv, vfx.path[i].y * conv);
    ctx.strokeStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
    ctx.lineWidth   = 2;
    ctx.stroke();

    ctx.restore();
  }

  // ----------------------------------------------------------------
  // Star field generation — value-noise clustering, small transparent
  // stars, composited with a light blur for a nebula feel.
  // ----------------------------------------------------------------

  static generateStarField(gameWidth, gameHeight, count = 8000) {
    // Build a layered value-noise density map — three octaves for large cloud shapes down to fine detail
    const makeNoise = (G) => {
      const grid = Array.from({ length: (G + 1) * (G + 1) }, () => Math.random());
      return (nx, ny) => {
        const ix = Math.floor(nx * G), iy = Math.floor(ny * G);
        const fx = nx * G - ix,        fy = ny * G - iy;
        const ux = fx * fx * (3 - 2 * fx); // smoothstep
        const uy = fy * fy * (3 - 2 * fy);
        const v00 = grid[ iy      * (G + 1) + ix    ];
        const v10 = grid[ iy      * (G + 1) + ix + 1];
        const v01 = grid[(iy + 1) * (G + 1) + ix    ];
        const v11 = grid[(iy + 1) * (G + 1) + ix + 1];
        return v00 + (v10 - v00) * ux + ((v01 - v00) + (v00 - v10 - v01 + v11) * ux) * uy;
      };
    };

    const noise1 = makeNoise(5);   // very coarse — large cloud shapes
    const noise2 = makeNoise(12);  // medium — region structure
    const noise3 = makeNoise(28);  // fine detail

    // Blend, then raise to a power to sharpen contrast: dense regions pull stars in hard, voids stay empty
    const rawDensity = (nx, ny) => noise1(nx, ny) * 0.50 + noise2(nx, ny) * 0.35 + noise3(nx, ny) * 0.15;
    const density    = (nx, ny) => Math.pow(rawDensity(nx, ny), 3);

    const stars = [];
    const deadline = Date.now() + 5000;
    for (let i = 0; i < count; i++) {
      if (i % 100 === 0 && Date.now() > deadline) break;
      // Rejection sampling: accept candidate with probability = density at that point
      let gx, gy, placedDensity = 0.3; // fallback density for randomly-placed stars
      for (let attempt = 0; attempt < 20; attempt++) {
        const cx = Math.random(), cy = Math.random();
        const d = density(cx, cy);
        if (Math.random() < d) { gx = cx * gameWidth; gy = cy * gameHeight; placedDensity = d; break; }
      }
      if (gx === undefined) { gx = Math.random() * gameWidth; gy = Math.random() * gameHeight; }

      // Small radii — mostly sub-pixel, occasional slightly larger
      // Giants are weighted by local density — sparse areas rarely get large fuzzy smears
      const isGiant = Math.random() < 0.40 * placedDensity;
      const gr = isGiant
        ? (0.4 + Math.random() * 1.0) * 10    // 10%: 10× size (4.0–14.0)
        : Math.random() < 0.85
          ? 0.4 + Math.random() * 1.0          // tiny (0.4–1.4)
          : 1.4 + Math.random() * Math.random() * 2.0; // occasional larger (1.4–3.4)

      // Nebula colour palette: cooler, deeper tones biased toward blue
      const palette = Math.random();
      let red, green, blue;
      if (palette < 0.45) {
        // Deep blue / indigo (boosted blue channel)
        red   = Math.floor(10 + Math.random() * 40);
        green = Math.floor(10 + Math.random() * 30);
        blue  = Math.floor(150 + Math.random() * 105);
      } else if (palette < 0.72) {
        // Purple / blue-violet (less red, more blue)
        red   = Math.floor(50 + Math.random() * 90);
        green = Math.floor(5  + Math.random() * 25);
        blue  = Math.floor(130 + Math.random() * 125);
      } else if (palette < 0.88) {
        // Deep red / crimson (dimmed)
        red   = Math.floor(90 + Math.random() * 90);
        green = Math.floor(5  + Math.random() * 25);
        blue  = Math.floor(15 + Math.random() * 45);
      } else {
        // Rare cool white / blue-white (shifted blue)
        red   = Math.floor(170 + Math.random() * 60);
        green = Math.floor(175 + Math.random() * 55);
        blue  = Math.floor(210 + Math.random() * 45);
      }

      // Alpha: reduced range for a darker, less distracting background
      const alpha = isGiant
        ? (0.18 + Math.random() * 0.32) / 1.5  // giant stars: 1.5× fainter
        : 0.18 + Math.random() * 0.32;

      stars.push({ gx, gy, gr, red, green, blue, alpha, giant: isGiant });
    }
    return stars;
  }
}
