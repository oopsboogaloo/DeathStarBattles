import { PlanetRenderer, setPlanetRendererSimplified } from './PlanetRenderer.js';
import { ShadingStyle, PlanetType } from '../entities/Planet.js';
import { WormholeParticles } from './WormholeParticles.js';
import { G, TIMESTEP, MIN_POWER, MAX_POWER } from '../physics/PhysicsEngine.js';
import { ROCKET_BASE_MASS, ROCKET_THRUST, ROCKET_FUEL_BURN_RATE,
         ROCKET_MIN_FUEL, ROCKET_MAX_FUEL, ROCKET_LAUNCH_SPEED } from '../entities/Rocket.js';
import { PLANET_OVERLAYS } from './planetOverlays.js';

const MAX_STATION_SPEED = 0.015; // must match GameLoop.MAX_STATION_SPEED

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
    this._wormholeParticles   = new Map(); // planet → WormholeParticles
    this._smokeImg            = null;
    this._smokeTintCache      = new Map(); // "r,g,b" → tinted canvas
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
  get _isExperimental() { return this._performance === 'experimental' || this._performance === 'exp-ipad' || this._performance === 'full'; }
  get _useCircles()     { return this._performance === 'exp-ipad' || this._performance === 'full'; }

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
    if (this._stars.length) this._renderBackground();
  }

  // All game positions are in a 700-unit-wide coordinate space.
  // conv and gameHeight are derived from the viewport, not the full canvas.
  get conv()       { return this._vpW / 700; }
  get gameWidth()  { return 700; }
  get gameHeight() { return this._vpH / this.conv; }

  // ----------------------------------------------------------------
  // Layer 0 — Background (stars + planets, drawn once per game)
  // ----------------------------------------------------------------

  drawBackground(stars, planets, rifts = []) {
    this._stars   = stars;
    this._planets = planets;
    this._rifts   = rifts;
    this._svgOverlayCache.clear();
    this._atmosphereCache.clear();
    this._crackSvgImgs = [];
    this._wormholeParticles.clear();
    for (const planet of planets) {
      if (planet.shading === ShadingStyle.WORMHOLE && planet.radius <= 100) {
        this._wormholeParticles.set(planet, new WormholeParticles(planet, planet.particleConfig));
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
      this._atmosphereCache.set(planet, ATMOS_COLS[Math.floor(Math.random() * ATMOS_COLS.length)]);
    }
    this._renderBackground();
    if (!this._simplified) this._loadPlanetOverlays(planets); // async, fire-and-forget
    this._loadCrackSvgs();             // async, fire-and-forget
  }

  _renderBackground() {
    const ctx = this.bgCtx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this._vpW, this._vpH);
    this._drawStarField(ctx);
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
    // Pass 3: SVG overlays for static bodies, then shading gradient on top
    if (!this._simplified) for (const planet of this._planets) {
      if (planet.vertices || planet.shading === ShadingStyle.GAS_GIANT || planet.type === PlanetType.COMET || planet.type === PlanetType.MOON) continue;
      const overlays = this._svgOverlayCache.get(planet);
      if (!overlays) continue;
      for (const entry of overlays) this._drawSVGOverlay(ctx, planet, entry);
      this._drawShadingOverlay(ctx, planet);
    }
    // Pass 4: space rifts above planets
    for (const rift of this._rifts ?? []) this._drawRift(ctx, rift);
  }

  _drawRift(ctx, rift) {
    const conv     = this.conv;
    const pts      = rift.vertices.map(v => ({ x: v.x * conv, y: v.y * conv }));
    if (pts.length < 2) return;

    const buildPath = () => {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    };

    // Outer glow
    ctx.save();
    ctx.shadowColor  = '#C060FF';
    ctx.shadowBlur   = 20;
    ctx.strokeStyle  = 'rgba(192,96,255,0.3)';
    ctx.lineWidth    = 28;
    ctx.lineCap      = 'round';
    ctx.lineJoin     = 'round';
    buildPath();
    ctx.stroke();
    ctx.restore();

    // Forked lightning decorations (cosmetic — Math.random() intentional)
    const nForks = 2 + Math.floor(Math.random() * 3); // 2–4
    for (let f = 0; f < nForks; f++) {
      const t     = Math.random();
      const seg   = Math.floor(t * (pts.length - 1));
      const frac  = t * (pts.length - 1) - seg;
      const startX = pts[seg].x + (pts[seg + 1].x - pts[seg].x) * frac;
      const startY = pts[seg].y + (pts[seg + 1].y - pts[seg].y) * frac;
      this._drawLightningBranch(ctx, startX, startY, Math.random() * Math.PI * 2, 3 + Math.floor(Math.random() * 4), 0.3 + Math.random() * 0.2, 2);
    }

    // Inner glow pass
    ctx.save();
    ctx.shadowColor = '#E8C0FF';
    ctx.shadowBlur  = 8;
    ctx.strokeStyle = 'rgba(232,192,255,0.35)';
    ctx.lineWidth   = 7;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    buildPath();
    ctx.stroke();
    ctx.restore();

    // Core line
    ctx.save();
    ctx.strokeStyle = 'rgba(232,192,255,0.95)';
    ctx.lineWidth   = 2;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    buildPath();
    ctx.stroke();
    ctx.restore();
  }

  _drawLightningBranch(ctx, x, y, dir, segs, alpha, depth) {
    if (segs <= 0 || alpha < 0.05) return;
    const segLen = 12 + Math.random() * 18; // 12–30 px per segment
    ctx.save();
    ctx.strokeStyle = `rgba(192,96,255,${alpha.toFixed(2)})`;
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
      this._drawLightningBranch(ctx, bx, by, ba + (Math.random() - 0.5) * Math.PI, subSegs, alpha * 0.6, depth - 1);
      this._drawLightningBranch(ctx, bx, by, ba - (Math.random() - 0.5) * Math.PI, subSegs, alpha * 0.6, depth - 1);
    }
  }

  _drawStarField(ctx) {
    const conv = this.conv;

    for (const star of this._stars) {
      const px = star.gx * conv;
      const py = star.gy * conv;
      const pr = Math.max(0.5, star.gr * conv);
      const a  = star.alpha ?? 1;
      const { red: r, green: g, blue: b } = star;

      // Hot core: nudge toward white for an emissive feel
      const cr = Math.min(255, r + 60);
      const cg = Math.min(255, g + 60);
      const cb = Math.min(255, b + 60);

      // Gradient biased toward the edge — wide bright centre, steep falloff in outer ~25%
      const grad = ctx.createRadialGradient(px, py, 0, px, py, pr);
      grad.addColorStop(0,    `rgba(${cr},${cg},${cb},${a})`);
      grad.addColorStop(0.55, `rgba(${r},${g},${b},${a})`);
      grad.addColorStop(0.82, `rgba(${Math.floor(r * 0.4)},${Math.floor(g * 0.4)},${Math.floor(b * 0.4)},${a * 0.4})`);
      grad.addColorStop(1,    `rgba(${r},${g},${b},0)`);

      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
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

    ctx.beginPath();
    ctx.moveTo(prev.x * conv, prev.y * conv);
    ctx.lineTo(cur.x  * conv, cur.y  * conv);
    const alpha = bullet.thinTrail ? 0.28 : 1;
    ctx.strokeStyle = `rgba(${tr},${tg},${tb},${alpha})`;
    ctx.lineWidth   = bullet.thinTrail ? Math.max(0.5, conv * 0.3) : Math.max(1, conv * 0.6);
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
    const wormholePCount = [...this._wormholeParticles.values()].reduce((s, wp) => s + wp._cfg.count, 0);
    const sfx       = (gs?.rocketSmoke?.length ?? 0)
                    + (gs?.cometSmoke?.length ?? 0)
                    + (gs?.vfxList?.length ?? 0)
                    + (gs?.activeExplosions?.reduce((s, e) => s + (e.particles?.length ?? 0), 0) ?? 0)
                    + (gs?.shipExplosionBloom?.length ?? 0)
                    + (gs?.fireballs?.length ?? 0)
                    + (gs?.fireballSmoke?.length ?? 0)
                    + wormholePCount;

    this._debugEl.textContent =
      `FPS        ${Math.round(this._fpsSmooth)}\n` +
      `Celestial  ${celestial}\n` +
      `Ships      ${ships}\n` +
      `Bullets    ${bullets}\n` +
      `SFX        ${sfx}`;
  }

  _drawLive(ctx, gameState) {
    // Wormhole particle spirals (skipped in simplified mode)
    const now = Date.now() / 1000;
    if (!this._simplified) {
      for (const [planet, particles] of this._wormholeParticles) {
        particles.update(now);
        particles.draw(ctx, this.conv, this._useCircles);
      }
    }

    // Pulsar expanding pressure rings
    for (const planet of this._planets) {
      if (planet.type === PlanetType.PULSAR && planet.pulsarPulses?.length) {
        this._drawPulsarRings(ctx, planet);
      }
    }

    // Gas giants — drawn live so their 50% transparency composites correctly over background.
    // Base circle in colourA; SVG overlay in colourB replaces old stripe rendering.
    if (!this._simplified) for (const planet of this._planets) {
      if (planet.shading !== ShadingStyle.GAS_GIANT) continue;
      this._drawAtmosphere(this.mainCtx, planet);
    }
    if (!this._simplified) ctx.filter = 'blur(3px)';
    for (const planet of this._planets) {
      if (planet.shading !== ShadingStyle.GAS_GIANT) continue;
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
    if (!this._simplified) ctx.filter = 'none';

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
      if (station.status === 'exploding') this._drawStationExplosion(ctx, station);
      if (station.shockwave)              this._drawShockwave(ctx, station.position.x, station.position.y, station.shockwave.t, station.radius * 5, station.shockwave.r, station.shockwave.g, station.shockwave.b);
      if (station.status !== 'dead')      this._drawStation(ctx, station);
      if (!this._simplified && station.particles?.length) this._drawParticles(ctx, station.particles);
    }

    // Velocity indicators — all active stations with a move queued
    if (gameState.stationMovement) {
      for (const station of gameState.allStations) {
        if (station.status === 'active' && station.velocity) {
          this._drawVelocityIndicator(ctx, station);
        }
      }
    }

    // Experimental bitmap explosions (both experimental and exp-ipad)
    if (this._isExperimental) {
      if (gameState.shipExplosionBloom?.length) this._drawShipExplosionBloom(ctx, gameState.shipExplosionBloom);
      if (gameState.fireballs?.length)          this._drawFireballs(ctx, gameState.fireballs);
      if (gameState.fireballSmoke?.length)      this._drawFireballSmoke(ctx, gameState.fireballSmoke);
    }

    // Comet + rocket smoke (drawn behind everything else)
    if (gameState.cometSmoke?.length) this._drawCometSmoke(ctx, gameState.cometSmoke);
    if (gameState.rocketSmoke?.length) this._drawRocketSmoke(ctx, gameState.rocketSmoke);

    // Rocket blast zones (drawn behind rockets and shields)
    if (gameState.rocketBlasts?.length) this._drawRocketBlasts(ctx, gameState.rocketBlasts);

    // Force shields
    if (gameState.shields?.length) this._drawShields(ctx, gameState.shields);

    // Rockets + trails
    if (gameState.rockets?.length) this._drawRockets(ctx, gameState.rockets);

    // Collectables
    if (gameState.collectables?.length) this._drawCollectables(ctx, gameState.collectables);

    // VFX overlays (collectable shatter, collectable grants, muzzle flashes, laser paths)
    if (gameState.vfxList?.length) this._drawVFX(ctx, gameState.vfxList);

    // Aiming indicator — active station in AIMING or TP_AIMING mode
    const active = gameState.activeStation;
    if (active && active.status === 'active' && !active.hyperspaceQueued) {
      if (gameState.mode === 'aiming' || gameState.mode === 'tp_aiming') {
        this._drawAimingIndicator(ctx, active, gameState);
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
    const headerPx = Math.max(22, Math.floor(this._vpW / 32));
    ctx.save();
    ctx.font         = `bold ${headerPx}px monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle    = `rgb(${cr},${cg},${cb})`;
    ctx.shadowColor  = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur   = 6;
    const tp = gameState.tpGame;
    const roundSuffix = tp ? `   —   Round ${tp.currentRound} / ${tp.totalRounds}` : '';
    const header = `T e a m  ${teamNum}        S t a t i o n  ${statNum}${roundSuffix}`;
    ctx.fillText(header, this._vpW / 2, 10);
    ctx.restore();

    // ── Angle / Power corners (bottom) — or HYPERSPACING ──
    const hudPx = Math.max(18, Math.floor(this._vpW / 50));
    ctx.save();
    ctx.font         = `bold ${hudPx}px monospace`;
    ctx.textBaseline = 'bottom';
    ctx.shadowColor  = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur   = 5;

    if (station.hyperspaceQueued) {
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
      ctx.font         = `${Math.max(12, Math.floor(this._vpW / 80))}px monospace`;
      ctx.textAlign    = 'right';
      ctx.textBaseline = 'top';
      ctx.fillStyle    = 'rgba(255,255,255,0.5)';
      ctx.fillText(`Turn ${gameState.turn + 1}`, this._vpW - 10, 10);
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
      const layerDefs = PLANET_OVERLAYS[planet.type];
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
    } else {
      this._drawNormalStation(ctx, station);
    }
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
    const noPower = new Set(['blunderbuss', 'blaster', 'laser']);
    const displayPower = noPower.has(w) ? 800 : station.power;
    const lineLen      = r + (boxR - r) * (displayPower / 800);

    let offsets;
    switch (w) {
      case 'tripleCannon': offsets = [-5, 0, 5];               break;
      case 'blunderbuss':  offsets = [-15, -7.5, 0, 7.5, 15]; break;
      case 'blaster':      offsets = [-10, -5, 0, 5, 10];     break;
      case 'minigun':      offsets = [-2, 0, 2];               break;
      case 'rocketPod':    offsets = [-1, 0, 1];               break;
      default:             offsets = [0];                      break;
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

  _computeLaserPreviewPath(station, angleDeg, planets, maxLength = Infinity) {
    const LASER_SPEED   = 160;
    const LASER_GRAVITY = 1.0;
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
        vx += Math.cos(theta) * sign * LASER_GRAVITY * G * planet.mass / rSq * TIMESTEP;
        vy += Math.sin(theta) * sign * LASER_GRAVITY * G * planet.mass / rSq * TIMESTEP;
      }
      const prevX = px, prevY = py;
      px += vx * TIMESTEP;
      py += vy * TIMESTEP;
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
      distTravelled += Math.sqrt((px - prevX) ** 2 + (py - prevY) ** 2);
      path.push({ x: px, y: py });
      if (distTravelled >= maxLength) break;
      if (px < -gw || px > 2 * gw || py < -gw || py > gh + gw) break;
    }
    return path;
  }

  // Simulate a regular bullet arc for aim preview (coarse steps, same gravity as physics engine)
  _computeBulletPreviewPath(station, angleDeg, power, planets, maxLength = Infinity, speedOverride = null) {
    const STEP_SIZE = 20;   // physics steps per preview iteration (matches AI sim)
    const MAX_ITER  = 400;
    const dt  = TIMESTEP * STEP_SIZE;
    const rad = (((angleDeg % 360) + 360) % 360 * Math.PI) / 180;
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
        vx += Math.cos(theta) * sign * G * planet.mass / rSq * dt;
        vy += Math.sin(theta) * sign * G * planet.mass / rSq * dt;
      }
      const prevX = px, prevY = py;
      px += vx * dt;
      py += vy * dt;
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
      case 'blaster':
        shots = [-10, -5, 0, 5, 10].map(dAngle => ({
          dAngle, speed: MAX_V * 0.55,
          alpha: dAngle === 0 ? 0.7 : 0.35, lw: dAngle === 0 ? 1.5 : 1,
        }));
        break;
      case 'blunderbuss':
        shots = [-15, 0, 15].map(dAngle => ({
          dAngle, speed: MAX_V * 0.275,
          alpha: dAngle === 0 ? 0.7 : 0.25, lw: dAngle === 0 ? 1.5 : 1,
        }));
        break;
      case 'minigun':
        shots = [-2, 0, 2].map(dAngle => ({
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
      case 'rocketPod':
        return; // self-propelled; no path preview
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
      const lw    = Math.max(1, conv * (0.4 + frac * 1.0));

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
    const cx = bullet.position.x * this.conv;
    const cy = bullet.position.y * this.conv;
    const r  = Math.max(2, bullet.owner.size.bulletRadius * this.conv);
    const [cr, cg, cb] = bullet.owner.team.colour;
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
    const alpha = Math.max(0, Math.sin(t * Math.PI));

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

  static generateStarField(gameWidth, gameHeight, count = 3500) {
    // Build a layered value-noise density map on a coarse grid
    const G = 12; // grid resolution
    const grid = Array.from({ length: (G + 1) * (G + 1) }, () => Math.random());

    const noise = (nx, ny) => {
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

    // Second octave for finer detail
    const G2 = 28;
    const grid2 = Array.from({ length: (G2 + 1) * (G2 + 1) }, () => Math.random());
    const noise2 = (nx, ny) => {
      const ix = Math.floor(nx * G2), iy = Math.floor(ny * G2);
      const fx = nx * G2 - ix,         fy = ny * G2 - iy;
      const ux = fx * fx * (3 - 2 * fx);
      const uy = fy * fy * (3 - 2 * fy);
      const v00 = grid2[ iy      * (G2 + 1) + ix    ];
      const v10 = grid2[ iy      * (G2 + 1) + ix + 1];
      const v01 = grid2[(iy + 1) * (G2 + 1) + ix    ];
      const v11 = grid2[(iy + 1) * (G2 + 1) + ix + 1];
      return v00 + (v10 - v00) * ux + ((v01 - v00) + (v00 - v10 - v01 + v11) * ux) * uy;
    };

    const density = (nx, ny) => noise(nx, ny) * 0.65 + noise2(nx, ny) * 0.35;

    const stars = [];
    for (let i = 0; i < count; i++) {
      // Rejection sampling: accept candidate with probability = density at that point
      let gx, gy;
      for (let attempt = 0; attempt < 8; attempt++) {
        const cx = Math.random(), cy = Math.random();
        if (Math.random() < density(cx, cy)) { gx = cx * gameWidth; gy = cy * gameHeight; break; }
      }
      if (gx === undefined) { gx = Math.random() * gameWidth; gy = Math.random() * gameHeight; }

      // Small radii — mostly sub-pixel, occasional slightly larger
      const gr = Math.random() < 0.85
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
      const alpha = 0.18 + Math.random() * 0.32;

      stars.push({ gx, gy, gr, red, green, blue, alpha });
    }
    return stars;
  }
}
