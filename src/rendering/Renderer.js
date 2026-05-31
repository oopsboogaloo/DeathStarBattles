import { PlanetRenderer, setPlanetRendererSimplified } from './PlanetRenderer.js';
import { ShadingStyle, PlanetType } from '../entities/Planet.js';

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
    this._aimCircleScale = 1;
  }

  setAimCircleScale(scale) { this._aimCircleScale = scale ?? 1; }

  setPerformance(mode) {
    this._performance = mode ?? 'full';
    setPlanetRendererSimplified(this._simplified);
  }
  get _simplified() { return this._performance === 'simplified'; }

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

  drawBackground(stars, planets) {
    this._stars   = stars;
    this._planets = planets;
    this._renderBackground();
  }

  _renderBackground() {
    const ctx = this.bgCtx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, this._vpW, this._vpH);
    this._drawStarField(ctx);
    // Pass 1: coronas/bristles behind everything
    // Skip asteroids (drawn live — rotating), gas giants (drawn live — transparent), and comets (dynamic)
    for (const planet of this._planets) {
      if (planet.vertices || planet.shading === ShadingStyle.GAS_GIANT || planet.type === PlanetType.COMET) continue;
      PlanetRenderer.drawCorona(ctx, planet, this.conv);
    }
    // Pass 2: solid bodies on top
    for (const planet of this._planets) {
      if (planet.vertices || planet.shading === ShadingStyle.GAS_GIANT || planet.type === PlanetType.COMET) continue;
      PlanetRenderer.draw(ctx, planet, this.conv);
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
    ctx.strokeStyle = `rgb(${tr},${tg},${tb})`;
    ctx.lineWidth   = Math.max(1, conv * 0.6);
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
  }

  _drawLive(ctx, gameState) {
    // Animated wormhole pulse (time-based, overlaid on static background layer)
    const now = Date.now() / 1000;
    for (const planet of this._planets) {
      if (planet.shading === ShadingStyle.WORMHOLE) {
        this._drawWormholePulse(ctx, planet, now);
      }
    }

    // Pulsar expanding pressure rings
    for (const planet of this._planets) {
      if (planet.type === PlanetType.PULSAR && planet.pulsarPulses?.length) {
        this._drawPulsarRings(ctx, planet);
      }
    }

    // Gas giants — drawn live so their 50% transparency composites over the background
    for (const planet of this._planets) {
      if (planet.shading === ShadingStyle.GAS_GIANT) PlanetRenderer.draw(ctx, planet, this.conv);
    }

    // Comets — drawn live every frame (they move and are not in the static bg layer)
    for (const planet of gameState.planets) {
      if (planet.type === PlanetType.COMET && !planet.destroyed) this._drawComet(ctx, planet);
    }

    // Rotating asteroids — drawn live every frame so the polygon matches _rotatedVerts
    for (const planet of this._planets) {
      if (planet.vertices && !planet.destroyed) PlanetRenderer.draw(ctx, planet, this.conv);
    }

    // Ghost trail of previous shot — helps human players adjust aim
    if (gameState.mode === 'aiming' && gameState.waitingForInput) {
      const active = gameState.activeStation;
      if (active?.lastTrail?.length > 1) this._drawGhostTrail(ctx, active);
    }

    // Bullets + off-screen indicators
    for (const bullet of gameState.activeBullets) {
      if (bullet.status === 'active') {
        if (!this._simplified) this._drawBulletGlow(ctx, bullet);
        this._drawBullet(ctx, bullet);
      }
      if (bullet.status === 'exploding') this._drawExplosion(ctx, bullet);
    }
    this._drawOffScreenIndicators(ctx, gameState.activeBullets);

    // Asteroid freestanding explosions (drawn before stations so they sit behind)
    for (const ex of gameState.activeExplosions) {
      this._drawShockwave(ctx, ex.x, ex.y, ex.t, ex.radius * 4, ex.r, ex.g, ex.b);
      if (!this._simplified) this._drawParticles(ctx, ex.particles);
    }

    // Stations + station explosions + hyperspace flashes
    for (const station of gameState.allStations) {
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

    // Aiming indicator — active station in AIMING mode (hidden when hyperspace queued)
    const active = gameState.activeStation;
    if (active && active.status === 'active' && gameState.mode === 'aiming' && !active.hyperspaceQueued) {
      this._drawAimingIndicator(ctx, active);
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
    if (!gameState.waitingForInput && gameState.mode !== 'aiming') return;
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
    const header = `T e a m  ${teamNum}        S t a t i o n  ${statNum}`;
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

    // Turn counter (top-right corner, unobtrusive)
    if (gameState.mode !== 'gameover') {
      ctx.font         = `${Math.max(12, Math.floor(this._vpW / 80))}px monospace`;
      ctx.textAlign    = 'right';
      ctx.textBaseline = 'top';
      ctx.fillStyle    = 'rgba(255,255,255,0.5)';
      ctx.fillText(`Turn ${gameState.turn + 1}`, this._vpW - 10, 10);
    }
  }

  // ----------------------------------------------------------------
  // Comet — bright nucleus with pale blue trailing tail
  // ----------------------------------------------------------------

  _drawComet(ctx, comet) {
    const cx   = comet.position.x * this.conv;
    const cy   = comet.position.y * this.conv;
    const r    = Math.max(2, comet.radius * this.conv);
    const conv = this.conv;

    // Tail — drawn behind nucleus; length scales with speed
    if (comet.velocity) {
      const vx    = comet.velocity.x;
      const vy    = comet.velocity.y;
      const speed = Math.sqrt(vx * vx + vy * vy);
      if (speed > 0.0002) {
        const tailLen = Math.min(120, speed * 5000) * conv;
        const nx = -vx / speed;
        const ny = -vy / speed;

        // Draw tail as a series of fading segments for a tapered look
        const steps = 8;
        for (let i = steps; i >= 1; i--) {
          const t0 = (i - 1) / steps;
          const t1 = i       / steps;
          const alpha0 = (1 - t0) * 0.45;
          const alpha1 = (1 - t1) * 0.45;
          const w = Math.max(0.5, r * 0.7 * (1 - t0));
          ctx.beginPath();
          ctx.moveTo(cx + nx * tailLen * t0, cy + ny * tailLen * t0);
          ctx.lineTo(cx + nx * tailLen * t1, cy + ny * tailLen * t1);
          ctx.strokeStyle = `rgba(160,195,255,${(alpha0 + alpha1) / 2})`;
          ctx.lineWidth   = w;
          ctx.lineCap     = 'round';
          ctx.stroke();
        }
        ctx.lineCap = 'butt';
      }
    }

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
  // Station — Death Star icon
  // ----------------------------------------------------------------

  _drawStation(ctx, station) {
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

  // ----------------------------------------------------------------
  // Aiming indicator — white circle + direction line
  // ----------------------------------------------------------------

  _drawAimingIndicator(ctx, station) {
    const cx    = station.position.x * this.conv;
    const cy    = station.position.y * this.conv;
    const r     = Math.max(3, station.radius * this.conv);
    const boxR  = Math.max(57, 3 * r) * this._aimCircleScale;

    // Angle convention: 0 = up, 90 = right (clockwise), matches original Java
    // angle=0 → fires down (+y canvas), angle=180 → fires up (-y canvas)
    // matches Java physics: vx=sin(rad), vy=cos(rad)
    const rad = (station.angle * Math.PI) / 180;
    const dx  = Math.sin(rad);
    const dy  = Math.cos(rad);

    // Ghost aim line from last turn — shown before current line so it sits behind
    if (station.lastAngle !== null && station.lastPower !== null) {
      const lastRad  = (station.lastAngle * Math.PI) / 180;
      const lastDx   = Math.sin(lastRad);
      const lastDy   = Math.cos(lastRad);
      const lastLen  = r + (boxR - r) * (station.lastPower / 800);
      ctx.save();
      ctx.setLineDash([3, 5]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + lastDx * lastLen, cy + lastDy * lastLen);
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

    // Direction line — length scales with power (min: station surface, max: boxR edge)
    const lineLen = r + (boxR - r) * (station.power / 800);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + dx * lineLen, cy + dy * lineLen);
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth   = 2;
    ctx.stroke();
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
    const cx   = station.position.x * this.conv;
    const cy   = station.position.y * this.conv;
    const t    = station.explosionT;
    const maxR = Math.max(40, station.radius * this.conv * 4);
    const r    = t * maxR;
    const alpha = Math.max(0, 1 - t);
    const [cr, cg, cb] = station.colour;

    // Outer ring
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${cr},${cg},${cb},${alpha})`;
    ctx.lineWidth   = Math.max(1, (1 - t) * 6);
    ctx.stroke();

    // Secondary ring
    if (r > 8) {
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,200,80,${alpha * 0.6})`;
      ctx.lineWidth   = Math.max(1, (1 - t) * 3);
      ctx.stroke();
    }

    // Bright central flash (early in explosion)
    if (t < 0.3) {
      ctx.beginPath();
      ctx.arc(cx, cy, station.radius * this.conv * (1 + t * 4), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,230,120,${(0.3 - t) * 3.3})`;
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
      ctx.beginPath();
      ctx.arc(p.x * conv, p.y * conv, rad, 0, Math.PI * 2);
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
  // Wormhole pulse — animated ring overlay drawn every frame
  // ----------------------------------------------------------------

  _drawWormholePulse(ctx, planet, t) {
    const cx = planet.position.x * this.conv;
    const cy = planet.position.y * this.conv;
    const r  = Math.max(4, planet.radius * 2 * this.conv);
    const [pr, pg, pb] = planet.colour;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.8 + planet.position.x * 0.07);
    // Giant wormholes (display radius > 100 px) get half-thickness halo
    const thickMul = r > 100 ? 0.5 : 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r * (0.82 + 0.18 * pulse), 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${pr},${pg},${pb},${0.25 + 0.45 * pulse})`;
    ctx.lineWidth   = Math.max(1, (r * 0.12 + r * 0.08 * pulse) * thickMul);
    ctx.stroke();
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
    const trail = station.lastTrail;
    const conv  = this.conv;
    const [tr, tg, tb] = station.colour;
    ctx.save();
    ctx.strokeStyle = `rgba(${tr},${tg},${tb},0.55)`;
    ctx.lineWidth   = Math.max(1, conv * 0.7);
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    let penDown = false;
    for (const pt of trail) {
      if (!pt) { penDown = false; continue; } // wormhole break
      const px = pt.x * conv, py = pt.y * conv;
      if (!penDown) { ctx.moveTo(px, py); penDown = true; }
      else          { ctx.lineTo(px, py); }
    }
    ctx.stroke();
    ctx.restore();
  }

  // ----------------------------------------------------------------
  // Off-screen bullet indicators — triangle at canvas edge + distance
  // ----------------------------------------------------------------

  _drawOffScreenIndicators(ctx, bullets) {
    const cx = this._vpW / 2, cy = this._vpH / 2;

    for (const bullet of bullets) {
      if (bullet.status !== 'active') continue;
      const bx = bullet.position.x * this.conv;
      const by = bullet.position.y * this.conv;
      if (bx >= 0 && bx <= this._vpW && by >= 0 && by <= this._vpH) continue;

      const [tr, tg, tb] = bullet.owner.team.colour;
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

      // Draw number at inset position
      ctx.save();
      ctx.translate(nx, ny);
      ctx.rotate(angle);
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
