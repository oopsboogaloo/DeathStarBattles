import { PlanetRenderer } from './PlanetRenderer.js';

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
    this._stars   = [];
    this._planets = [];
  }

  // ----------------------------------------------------------------
  // Layout
  // ----------------------------------------------------------------

  resize(w, h) {
    this.width  = w;
    this.height = h;
    for (const c of [this.mainCanvas, this.bgCanvas, this.trailsCanvas]) {
      c.width  = w;
      c.height = h;
    }
    if (this._stars.length) this._renderBackground();
  }

  // All game positions are in a 700-unit-wide coordinate space.
  get conv()       { return this.width / 700; }
  get gameWidth()  { return 700; }
  get gameHeight() { return this.height / this.conv; }

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
    ctx.fillRect(0, 0, this.width, this.height);
    this._drawStarField(ctx);
    for (const planet of this._planets) {
      PlanetRenderer.draw(ctx, planet, this.conv);
    }
  }

  _drawStarField(ctx) {
    for (const star of this._stars) {
      const px = star.gx * this.conv;
      const py = star.gy * this.conv;
      const pr = Math.max(1, star.gr * this.conv);
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${star.red},${star.green},${star.blue})`;
      ctx.fill();
    }
  }

  // ----------------------------------------------------------------
  // Layer 1 — Trails (cleared each turn, appended during fire phase)
  // ----------------------------------------------------------------

  clearTrails() {
    this.trailsCtx.clearRect(0, 0, this.width, this.height);
  }

  // Draw the latest trail segment — call each time a trail point is pushed.
  appendTrailPoint(bullet) {
    const trail = bullet.trail;
    if (trail.length < 2) return;
    const ctx  = this.trailsCtx;
    const conv = this.conv;
    const [tr, tg, tb] = bullet.owner.team.colour;
    const prev = trail[trail.length - 2];
    const cur  = trail[trail.length - 1];
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
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.drawImage(this.bgCanvas,     0, 0);
    ctx.drawImage(this.trailsCanvas, 0, 0);
    if (gameState) this._drawLive(ctx, gameState);
  }

  _drawLive(ctx, gameState) {
    // Bullets
    for (const bullet of gameState.activeBullets) {
      if (bullet.status === 'active')    this._drawBullet(ctx, bullet);
      if (bullet.status === 'exploding') this._drawExplosion(ctx, bullet);
    }

    // Stations + station explosions
    for (const station of gameState.allStations) {
      if (station.status === 'exploding') this._drawStationExplosion(ctx, station);
      if (station.status !== 'dead')      this._drawStation(ctx, station);
    }

    // Aiming indicator — active station in AIMING mode
    const active = gameState.activeStation;
    if (active && active.status === 'active' && gameState.mode === 'aiming') {
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
    const headerPx = Math.max(22, Math.floor(this.width / 32));
    ctx.save();
    ctx.font         = `bold ${headerPx}px monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle    = `rgb(${cr},${cg},${cb})`;
    ctx.shadowColor  = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur   = 6;
    const header = `T e a m  ${teamNum}        S t a t i o n  ${statNum}`;
    ctx.fillText(header, this.width / 2, 10);
    ctx.restore();

    // ── Angle / Power corners (bottom) — or HYPERSPACING ──
    const hudPx = Math.max(18, Math.floor(this.width / 50));
    ctx.save();
    ctx.font         = `bold ${hudPx}px monospace`;
    ctx.textBaseline = 'bottom';
    ctx.shadowColor  = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur   = 5;

    if (station.hyperspaceQueued) {
      // Pulsing team-colour HYPERSPACING text centred
      const pulse  = 0.6 + 0.4 * Math.sin(Date.now() / 250);
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${pulse})`;
      ctx.fillText('H Y P E R S P A C I N G . . .', this.width / 2, this.height - 14);
    } else {
      // Angle bottom-left, Power bottom-right
      const powerDisplay = (station.power / 8).toFixed(1);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.fillText(`Angle:${station.angle}`, 14, this.height - 14);
      ctx.textAlign = 'right';
      ctx.fillText(`Power:${powerDisplay}`, this.width - 14, this.height - 14);
    }
    ctx.restore();
  }

  _drawOverlay(ctx, gameState) {
    if (gameState.mode === 'gameover') {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, this.width, this.height);

      const winner = gameState.winner;
      const fontSize = Math.max(32, Math.floor(this.width / 18));
      ctx.font         = `bold ${fontSize}px monospace`;
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';

      if (winner) {
        const [r, g, b] = winner.colour;
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillText('TEAM WINS!', this.width / 2, this.height / 2 - fontSize * 0.6);
        ctx.fillStyle = '#fff';
        ctx.font      = `${Math.floor(fontSize * 0.55)}px monospace`;
        ctx.fillText('click to play again', this.width / 2, this.height / 2 + fontSize * 0.7);
      } else {
        ctx.fillStyle = '#aaa';
        ctx.fillText('DRAW', this.width / 2, this.height / 2 - fontSize * 0.6);
        ctx.fillStyle = '#fff';
        ctx.font      = `${Math.floor(fontSize * 0.55)}px monospace`;
        ctx.fillText('click to play again', this.width / 2, this.height / 2 + fontSize * 0.7);
      }
    }

    // Turn counter (top-right corner, unobtrusive)
    if (gameState.mode !== 'gameover') {
      ctx.font         = `${Math.max(12, Math.floor(this.width / 80))}px monospace`;
      ctx.textAlign    = 'right';
      ctx.textBaseline = 'top';
      ctx.fillStyle    = 'rgba(255,255,255,0.5)';
      ctx.fillText(`Turn ${gameState.turn + 1}`, this.width - 10, 10);
    }
  }

  // ----------------------------------------------------------------
  // Station — Death Star icon
  // ----------------------------------------------------------------

  _drawStation(ctx, station) {
    const cx = station.position.x * this.conv;
    const cy = station.position.y * this.conv;
    const r  = Math.max(3, station.radius * this.conv);
    const [cr, cg, cb] = station.colour;

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
    if (r >= 6) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      ctx.beginPath();
      ctx.moveTo(cx - r, cy);
      ctx.lineTo(cx + r, cy);
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = Math.max(1, r * 0.14);
      ctx.stroke();
      ctx.restore();
    }

    // Dome + aperture — only at Medium+ sizes (r ≥ 10 px)
    if (r >= 10) {
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
  }

  // ----------------------------------------------------------------
  // Aiming indicator — white circle + direction line
  // ----------------------------------------------------------------

  _drawAimingIndicator(ctx, station) {
    const cx    = station.position.x * this.conv;
    const cy    = station.position.y * this.conv;
    const r     = Math.max(3, station.radius * this.conv);
    const boxR  = Math.max(30, 3 * r);   // interactive zone radius in px

    // Angle convention: 0 = up, 90 = right (clockwise), matches original Java
    // angle=0 → fires down (+y canvas), angle=180 → fires up (-y canvas)
    // matches Java physics: vx=sin(rad), vy=cos(rad)
    const rad = (station.angle * Math.PI) / 180;
    const dx  = Math.sin(rad);
    const dy  = Math.cos(rad);

    // Bounding circle
    ctx.beginPath();
    ctx.arc(cx, cy, boxR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth   = 1;
    ctx.stroke();

    // Direction line from centre to circle edge
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + dx * boxR, cy + dy * boxR);
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth   = 2;
    ctx.stroke();
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
  // Star field generation (static — called once per new game)
  // ----------------------------------------------------------------

  static generateStarField(gameWidth, gameHeight, count = 2000) {
    const stars = [];
    for (let i = 0; i < count; i++) {
      // Cubic size distribution biased toward small stars (matches original)
      const gr = 10 * Math.random() * Math.random() * Math.random()
               + 1.8 * Math.random()
               + 1.8 * Math.random()
               + 2;
      stars.push({
        gx:    Math.random() * gameWidth,
        gy:    Math.random() * gameHeight,
        gr,
        red:   Math.floor(14 * Math.random() + 95 * Math.random()),
        green: Math.floor( 3 * Math.random() + 12 * Math.random()),
        blue:  Math.floor(10 * Math.random() + 80 * Math.random()),
      });
    }
    return stars;
  }
}
