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
    // Phases 3–6 will populate this with stations, bullets, HUD
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
