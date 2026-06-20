// Copyright © 2026 Chloe Bolland
// contact chloe@mammoththoughts.com if you wish to use, publish or reproduce this game or any part of it in any way

// View-only camera for the in-game renderer (zoom & pan). See spec/camera-spec.md
// and spec/camera-design.md.
//
// The camera maps the renderer's "viewport-pixel space at z = 1" (the space in
// which the existing draw code expresses positions as `world * conv`) into actual
// screen pixels via a single affine transform:
//
//   screenX = world * conv * z + (ox + vpW/2 − cx * conv * z)
//
// At the default view (z = 1, cx = 350, cy = gameHeight/2) this reduces exactly to
// today's `world * conv + ox`, producing a pixel-identical frame (FR-1), because
// 350 * conv = vpW/2.
//
// The camera owns no DOM and listens for no events — CameraControls drives it.

// Screen-pixel overscroll allowed past the world edge (so edge stations' aim
// circles are reachable). A bit larger than the largest aim circle.
const OVERSCROLL_PX = 120;

export class Camera {
  constructor() {
    this.z  = 1;
    this.cx = 350;          // world centre x (700-unit world ⇒ default 350)
    this.cy = 350;          // overwritten by configure() once gameHeight is known

    // viewport geometry, supplied by the Renderer
    this._vpW = 1; this._vpH = 1; this._ox = 0; this._oy = 0;
    this._conv = 1; this._gameHeight = 700;

    // reset tween state (null when idle)
    this._tween = null;     // { z0, cx0, cy0, z1, cx1, cy1, t0, dur }

    // set true by CameraControls while a multi-touch / pan gesture is in flight
    this.navigating = false;
  }

  get MIN_Z() { return 1; }
  get MAX_Z() { return 4; }

  // Called by the Renderer whenever the viewport changes (resize / aspect lock).
  configure(vpW, vpH, ox, oy, conv, gameHeight) {
    this._vpW = vpW; this._vpH = vpH;
    this._ox = ox;   this._oy = oy;
    this._conv = conv; this._gameHeight = gameHeight;
    this._clamp();
  }

  snapshot() { return { z: this.z, cx: this.cx, cy: this.cy }; }

  isDefault() {
    return Math.abs(this.z - 1) < 1e-4 &&
           Math.abs(this.cx - 350) < 1e-3 &&
           Math.abs(this.cy - this._gameHeight / 2) < 1e-3;
  }

  // ── transforms ────────────────────────────────────────────────────────────

  // Affine for content drawn in world*conv space at the camera given by `snap`.
  // Returns [a,b,c,d,e,f] for ctx.setTransform. Pass ox=oy=0 to bake an off-screen
  // layer (no letterbox offset).
  matrixFor(snap, ox, oy) {
    const s = this._conv * snap.z;
    return [snap.z, 0, 0, snap.z,
            ox + this._vpW / 2 - snap.cx * s,
            oy + this._vpH / 2 - snap.cy * s];
  }

  // Affine for live content at the current camera.
  matrix(ox, oy) { return this.matrixFor(this, ox, oy); }

  // Affine that composites a cached bitmap baked at camera `snap` into the live
  // view at the current camera. When current == snap this is the identity blit at
  // (ox,oy); otherwise it is a cheap scaled/shifted blit (soft) — see design §4.2.
  deltaMatrix(snap, ox, oy) {
    const ratio = this.z / snap.z;
    const s     = this._conv * this.z;
    return [ratio, 0, 0, ratio,
            ox + this._vpW / 2 - (this._vpW / 2) * ratio + (snap.cx - this.cx) * s,
            oy + this._vpH / 2 - (this._vpH / 2) * ratio + (snap.cy - this.cy) * s];
  }

  // Like deltaMatrix but for extended cached bitmaps that have _ox/_oy baked in plus
  // an optional overscrollPx border on each side. Pass overscrollPx = BG_PAD (120) when
  // compositing bg/trails canvases so the 120 px camera overscroll region is covered.
  // At settled camera with overscrollPx=0 this is the identity blit. See §5.2.
  fullDeltaMatrix(snap, overscrollPx = 0) {
    const ratio = this.z / snap.z;
    const s     = this._conv * this.z;
    return [ratio, 0, 0, ratio,
            this._ox * (1 - ratio) + this._vpW / 2 * (1 - ratio) + (snap.cx - this.cx) * s - overscrollPx * ratio,
            this._oy * (1 - ratio) + this._vpH / 2 * (1 - ratio) + (snap.cy - this.cy) * s - overscrollPx * ratio];
  }

  // canvas px → world*conv (viewport-z1) px, in which stations sit at world*conv.
  screenToLocal(px, py) {
    const m = this.matrix(this._ox, this._oy);
    return { x: (px - m[4]) / this.z, y: (py - m[5]) / this.z };
  }

  // canvas px → world units (for move-target hit-testing).
  screenToWorld(px, py) {
    const l = this.screenToLocal(px, py);
    return { x: l.x / this._conv, y: l.y / this._conv };
  }

  // world units → canvas px (includes letterbox offset).
  worldToScreen(wx, wy) {
    const m = this.matrix(this._ox, this._oy);
    return { x: wx * this._conv * this.z + m[4], y: wy * this._conv * this.z + m[5] };
  }

  // ── mutations (all re-clamp, FR-4) ──────────────────────────────────────────

  // Zoom by `factor`, keeping the world point under the focal screen px fixed (FR-7).
  zoomAt(focusPx, focusPy, factor) {
    this._tween = null;
    const w  = this.screenToWorld(focusPx, focusPy);
    this.z   = Math.max(this.MIN_Z, Math.min(this.MAX_Z, this.z * factor));
    const s  = this._conv * this.z;
    this.cx  = w.x + (this._ox + this._vpW / 2 - focusPx) / s;
    this.cy  = w.y + (this._oy + this._vpH / 2 - focusPy) / s;
    this._clamp();
  }

  // Pan so content tracks the gesture by (dxPx, dyPx) screen px (FR-5).
  panByScreen(dxPx, dyPx) {
    this._tween = null;
    const s = this._conv * this.z;
    this.cx -= dxPx / s;
    this.cy -= dyPx / s;
    this._clamp();
  }

  // Return to the full-battlefield view (FR-18 / FR-22).
  resetToDefault({ animated = true } = {}) {
    const z1 = 1, cx1 = 350, cy1 = this._gameHeight / 2;
    if (!animated) {
      this._tween = null;
      this.z = z1; this.cx = cx1; this.cy = cy1;
      this._clamp();
      return;
    }
    if (this.isDefault()) return;
    this._tween = {
      z0: this.z, cx0: this.cx, cy0: this.cy,
      z1, cx1, cy1,
      t0: performance.now(), dur: 320,
    };
  }

  // Advance the reset tween. Returns true while a tween is animating.
  tick(now) {
    const tw = this._tween;
    if (!tw) return false;
    const t = Math.min(1, (now - tw.t0) / tw.dur);
    const e = 1 - Math.pow(1 - t, 3); // ease-out cubic
    this.z  = tw.z0  + (tw.z1  - tw.z0)  * e;
    this.cx = tw.cx0 + (tw.cx1 - tw.cx0) * e;
    this.cy = tw.cy0 + (tw.cy1 - tw.cy0) * e;
    this._clamp();
    if (t >= 1) { this._tween = null; return false; }
    return true;
  }

  _clamp() {
    this.z = Math.max(this.MIN_Z, Math.min(this.MAX_Z, this.z));
    // Allow a small overscroll past the world edge so a station sitting right on
    // the boundary can be panned far enough in that its (off-station) aim circle
    // is fully reachable. The margin is a constant screen distance regardless of
    // zoom, so it never reveals more black than necessary.
    const marginW = OVERSCROLL_PX / (this._conv * this.z);
    const halfW = 350 / this.z;
    const halfH = (this._gameHeight / 2) / this.z;
    const minX = halfW - marginW, maxX = (700 - halfW) + marginW;
    const minY = halfH - marginW, maxY = (this._gameHeight - halfH) + marginW;
    this.cx = minX > maxX ? 350                  : Math.max(minX, Math.min(maxX, this.cx));
    this.cy = minY > maxY ? this._gameHeight / 2 : Math.max(minY, Math.min(maxY, this.cy));
  }
}
