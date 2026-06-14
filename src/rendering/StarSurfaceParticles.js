// Star surface bubbling — experimental performance mode only.
//
// Small white, partly-transparent ovals that boil across a star's visible
// surface to suggest convective bubbling. Each bubble fades in quickly while
// expanding, then fades out more slowly, and respawns at a fresh random spot.
//
// Foreshortening: a bubble is a full circle at the centre of the disc and
// squashes radially toward the limb (radial axis scaled by sqrt(1-ρ²), where
// ρ is the bubble's distance from centre as a fraction of the radius), so the
// ovals hug the apparent curvature of the sphere.
//
// Ovals are drawn as flat-alpha ctx.ellipse fills (no gradients) so the effect
// stays cheap on iPad, matching the other particle systems' "circles" path.
//
// On-screen only: bubbles are sampled and drawn within the intersection of the
// star's disc and the viewport. For supergiants larger than the screen we never
// touch the huge off-screen remainder — only the visible patch is populated.

export const STAR_SURFACE_PARTICLE_DEFAULTS = {
  count:        320,    // bubbles per ordinary star
  supergiantMult: 3,    // supergiants (planet.supergiant) get this many times as many bubbles
  sizeMult:     0.025,  // full oval tangential radius = visualR * sizeMult
  maxSize:      5,      // px cap on the full radius so supergiants don't get huge ovals
  sizeJitter: 0.6,    // per-bubble size randomisation: size ∈ [1-j, 1+j]
  alphaMax:   0.50,   // peak opacity of the white ovals
  fadeInFrac: 0.18,   // fraction of life spent fading in + expanding (quick)
  minLife:    0.7,    // seconds — shortest bubble life
  maxLife:    1.8,    // seconds — longest bubble life
  growFrom:   0.25,   // size fraction at birth (expands to full during fade-in)
  growTo:     1.15,   // size fraction reached by death (gentle later expansion)
  edgeMargin: 2,      // px slack when testing on-screen
};

export class StarSurfaceParticles {
  constructor(planet, config = {}) {
    this._cfg    = { ...STAR_SURFACE_PARTICLE_DEFAULTS, ...config };
    this._planet = planet;
    // Supergiants get supergiantMult times as many bubbles (see planet.supergiant).
    const n = this._cfg.count * (planet.supergiant ? this._cfg.supergiantMult : 1);
    this.count   = n; // exposed so the SFX/debug counter can include these bubbles
    this._dx     = new Float32Array(n); // normalised disc x: (px - cx) / R, in [-1,1]
    this._dy     = new Float32Array(n); // normalised disc y: (py - cy) / R, in [-1,1]
    this._phase  = new Float32Array(n); // 0..1 life progress
    this._life   = new Float32Array(n); // seconds for one full cycle
    this._size   = new Float32Array(n); // per-bubble size multiplier
    this._placed = new Uint8Array(n);   // 0 = needs a fresh surface position
    this._lastT  = null;

    for (let i = 0; i < n; i++) {
      this._phase[i] = Math.random();        // desync so bubbles don't pulse together
      this._life[i]  = this._randLife();
      this._size[i]  = this._randSize();
    }
  }

  _randLife() {
    const { minLife, maxLife } = this._cfg;
    return minLife + Math.random() * (maxLife - minLife);
  }

  _randSize() {
    const j = this._cfg.sizeJitter;
    return 1 - j + Math.random() * 2 * j;
  }

  // Advance each bubble's life. Geometry-free, so it is safe before the first
  // draw establishes conv/viewport. A bubble that completes its cycle is flagged
  // to respawn at a new random spot on the next draw.
  update(nowSec) {
    if (this._lastT === null) { this._lastT = nowSec; return; }
    const dt = Math.min(nowSec - this._lastT, 0.1);
    this._lastT = nowSec;
    for (let i = 0; i < this.count; i++) {
      this._phase[i] += dt / this._life[i];
      if (this._phase[i] >= 1) {
        this._phase[i] -= 1;
        this._life[i]   = this._randLife();
        this._size[i]   = this._randSize();
        this._placed[i] = 0; // old bubble dies; a new one will appear elsewhere
      }
    }
  }

  draw(ctx, conv, vpW, vpH) {
    const cfg    = this._cfg;
    const planet = this._planet;
    const cx     = planet.position.x * conv;
    const cy     = planet.position.y * conv;
    const R      = Math.max(3, planet.radius * conv);

    // Full oval radius, capped in pixels so supergiants don't get huge ovals.
    const fullSize = Math.min(R * cfg.sizeMult, cfg.maxSize);

    // Visible disc region = intersection of the disc's bounding box and the
    // viewport (widened by the largest possible oval reach). Empty → fully
    // off-screen, nothing to do.
    const m   = fullSize * (1 + cfg.sizeJitter) * cfg.growTo + cfg.edgeMargin;
    const bx0 = Math.max(-m,      cx - R);
    const by0 = Math.max(-m,      cy - R);
    const bx1 = Math.min(vpW + m, cx + R);
    const by1 = Math.min(vpH + m, cy + R);
    if (bx1 <= bx0 || by1 <= by0) return;
    const boxW = bx1 - bx0, boxH = by1 - by0;

    ctx.fillStyle = '#fff';
    for (let i = 0; i < this.count; i++) {
      // Place (or replace) this bubble somewhere on the visible surface.
      if (!this._placed[i] && !this._sampleVisible(i, cx, cy, R, bx0, by0, boxW, boxH)) continue;

      const px = cx + this._dx[i] * R;
      const py = cy + this._dy[i] * R;
      if (px < bx0 || px > bx1 || py < by0 || py > by1) continue; // off-screen (e.g. after resize)

      const ph = this._phase[i];
      let alpha, grow;
      if (ph < cfg.fadeInFrac) {
        const u = ph / cfg.fadeInFrac;          // quick fade-in + expansion
        alpha = cfg.alphaMax * u;
        grow  = cfg.growFrom + (1 - cfg.growFrom) * u;
      } else {
        const u = (ph - cfg.fadeInFrac) / (1 - cfg.fadeInFrac); // slow fade-out
        alpha = cfg.alphaMax * (1 - u);
        grow  = 1 + (cfg.growTo - 1) * u;
      }
      if (alpha <= 0.003) continue;

      // Radial foreshortening toward the limb.
      const rho  = Math.hypot(this._dx[i], this._dy[i]);
      const fore = Math.sqrt(Math.max(0, 1 - rho * rho));
      const tang = fullSize * this._size[i] * grow; // tangential (full) radius
      const rad  = tang * fore;                      // radial (squashed) radius
      const ang  = Math.atan2(this._dy[i], this._dx[i]); // radial direction

      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.ellipse(px, py, Math.max(0.4, rad), Math.max(0.4, tang), ang, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Rejection-sample a point uniformly within the on-screen part of the disc.
  // Sampling inside the visible box (not the whole disc) keeps the acceptance
  // rate high and guarantees we never place bubbles off-screen.
  _sampleVisible(i, cx, cy, R, bx0, by0, boxW, boxH) {
    for (let tries = 0; tries < 12; tries++) {
      const px = bx0 + Math.random() * boxW;
      const py = by0 + Math.random() * boxH;
      const ddx = (px - cx) / R, ddy = (py - cy) / R;
      if (ddx * ddx + ddy * ddy <= 1) {
        this._dx[i] = ddx;
        this._dy[i] = ddy;
        this._placed[i] = 1;
        return true;
      }
    }
    return false; // box barely clips the disc — retry next frame
  }
}
