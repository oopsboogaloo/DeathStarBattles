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

  // Phase 4 implementation — draws a line segment to the trail layer.
  appendTrailPoint(bullet) {
    if (!bullet._lastTrailPx) return;
    const ctx  = this.trailsCtx;
    const conv = this.conv;
    const cur  = bullet.trail[bullet.trail.length - 1];
    const prev = bullet._lastTrailPx;
    const [tr, tg, tb] = bullet.owner.team.colour;
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(cur.x * conv, cur.y * conv);
    ctx.strokeStyle = `rgb(${tr},${tg},${tb})`;
    ctx.lineWidth   = Math.max(1, conv * 0.6);
    ctx.stroke();
    bullet._lastTrailPx = { x: cur.x * conv, y: cur.y * conv };
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
    // Stations
    for (const station of gameState.allStations) {
      if (station.status !== 'dead') this._drawStation(ctx, station);
    }

    // Aiming indicator — active human station only
    const active = gameState.activeStation;
    if (active && active.status === 'active' && gameState.mode === 'aiming') {
      this._drawAimingIndicator(ctx, active);
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
    const rad = (station.angle * Math.PI) / 180;
    const dx  =  Math.sin(rad);
    const dy  = -Math.cos(rad);   // canvas y is inverted

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
