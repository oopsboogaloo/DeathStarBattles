const DEFAULTS = {
  count:          40,
  innerMult:      0.7,   // spawn ring = visualR * innerMult
  outerMult:      7.0,   // despawn ring = visualR * outerMult
  outwardFrac:    1.2,   // outward speed = visualR * outwardFrac per second
  angularSpeed:   0.18,  // angular drift magnitude, radians/sec
  blobMult:       0.20,  // blob radius at spawn = visualR * blobMult
  blobMinMult:    0.04,  // blob radius at despawn
  alphaMax:       0.22,
  alphaInnerFade: 0.15,  // fraction of range over which alpha fades in
  alphaOuterFade: 0.65,  // fraction of range at which alpha starts fading out
};

export class WhiteHoleParticles {
  constructor(planet, config = {}) {
    this._cfg    = { ...DEFAULTS, ...config };
    this._planet = planet;
    this._conv   = 1;
    const n = this._cfg.count;
    this._angles = new Float32Array(n);
    this._radii  = new Float32Array(n);
    this._drifts = new Float32Array(n); // per-particle angular drift direction & speed
    this._lastT  = null;

    for (let i = 0; i < n; i++) {
      this._angles[i] = Math.random() * Math.PI * 2;
      this._drifts[i] = (Math.random() < 0.5 ? 1 : -1) * (0.4 + Math.random() * 0.9);
    }
  }

  _respawn(i, innerR, outerR) {
    this._angles[i] = Math.random() * Math.PI * 2;
    this._radii[i]  = innerR + Math.random() * (outerR - innerR) * 0.2;
  }

  update(nowSec) {
    const cfg     = this._cfg;
    const visualR = Math.max(4, this._planet.radius * 1.8 * this._conv);
    const innerR  = visualR * cfg.innerMult;
    const outerR  = visualR * cfg.outerMult;

    if (this._lastT === null) {
      this._lastT = nowSec;
      // Scatter particles across the full range on first init so it doesn't look empty
      for (let i = 0; i < cfg.count; i++) {
        this._radii[i] = innerR + Math.random() * (outerR - innerR);
      }
      return;
    }

    const dt    = Math.min(nowSec - this._lastT, 0.1);
    this._lastT = nowSec;
    const speed = visualR * cfg.outwardFrac;

    for (let i = 0; i < cfg.count; i++) {
      this._radii[i]  += speed * dt;
      this._angles[i] += cfg.angularSpeed * this._drifts[i] * dt;
      if (this._radii[i] >= outerR) this._respawn(i, innerR, outerR);
    }
  }

  draw(ctx, conv, useCircles = false) {
    this._conv = conv;
    const cfg     = this._cfg;
    const planet  = this._planet;
    const cx      = planet.position.x * conv;
    const cy      = planet.position.y * conv;
    const visualR = Math.max(4, planet.radius * 1.8 * conv);
    const innerR  = visualR * cfg.innerMult;
    const outerR  = visualR * cfg.outerMult;
    const range   = outerR - innerR;
    const blobFull = visualR * cfg.blobMult;
    const blobMin  = visualR * cfg.blobMinMult;

    for (let i = 0; i < cfg.count; i++) {
      const r = this._radii[i];
      if (r < innerR || r >= outerR) continue;

      const t    = (r - innerR) / range; // 0 = inner, 1 = outer
      const blobR = blobFull + (blobMin - blobFull) * t;

      let alpha;
      if (t < cfg.alphaInnerFade) {
        alpha = cfg.alphaMax * (t / cfg.alphaInnerFade);
      } else if (t > cfg.alphaOuterFade) {
        alpha = cfg.alphaMax * (1 - (t - cfg.alphaOuterFade) / (1 - cfg.alphaOuterFade));
      } else {
        alpha = cfg.alphaMax;
      }

      const px = cx + Math.cos(this._angles[i]) * r;
      const py = cy + Math.sin(this._angles[i]) * r;

      if (useCircles) {
        ctx.fillStyle   = 'rgb(255,255,255)';
        ctx.globalAlpha = alpha * 0.35;
        ctx.beginPath();
        ctx.arc(px, py, blobR * 1.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(px, py, blobR * 0.45, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const grad = ctx.createRadialGradient(px, py, 0, px, py, blobR * 1.7);
        grad.addColorStop(0,   `rgba(255,255,255,${alpha})`);
        grad.addColorStop(0.5, `rgba(255,255,255,${alpha * 0.55})`);
        grad.addColorStop(1,   'rgba(255,255,255,0)');
        ctx.beginPath();
        ctx.arc(px, py, blobR * 1.7, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }
}
