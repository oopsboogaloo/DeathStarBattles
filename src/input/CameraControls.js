// Copyright © 2026 Chloe Bolland
// contact chloe@mammoththoughts.com if you wish to use, publish or reproduce this game or any part of it in any way

// Gesture recognition for the view camera (zoom & pan). See spec/camera-spec.md §6–7.
//
// This is the single owner of canvas pointer / wheel input. It decides between
// aiming and navigating, so InputHandler no longer binds pointer events itself:
//   • 1 pointer  → forwarded to InputHandler aim (single-finger / left-drag).
//   • 2 pointers → pinch-zoom + two-finger pan, simultaneously (FR-10..FR-12).
//   • wheel      → zoom anchored at the cursor (FR-15).
//   • middle-drag→ pan on desktop (FR-16).
//   • double-tap / double-click → animated reset to the default view (FR-14/FR-17).
//
// Cached-layer re-rasterisation on settle (FR-26) is handled by the Renderer,
// which watches the camera each frame, so this class only mutates the camera.

const TAP_MS  = 300;   // max gap between taps for a double-tap
const TAP_PX  = 24;    // max move between taps for a double-tap

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function mid(a, b)  { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }

export class CameraControls {
  // getInputHandler returns the live InputHandler (recreated per game).
  constructor({ canvas, renderer, getInputHandler }) {
    this.canvas    = canvas;
    this.renderer  = renderer;
    this._getInput = getInputHandler;

    this._pointers = new Map();   // pointerId → {x,y}  (touch/pen only)
    this._lastDist = 0;           // last two-finger spread
    this._lastMid  = null;        // last two-finger midpoint

    this._mousePan = null;        // {x,y} while middle-button dragging
    this._navigating = false;     // suppresses aim during/after a 2-finger gesture

    this._lastTapTime = 0;        // touch double-tap tracking
    this._lastTapPos  = null;
    this._lastClickTime = 0;      // mouse double-click tracking
    this._lastClickPos  = null;

    // Take full control of touch gestures so the browser does not pan/pinch-zoom
    // the page. Aim is delivered through pointer events, not mouse-compat events.
    canvas.style.touchAction = 'none';
    this._bind();
  }

  get _camera() { return this.renderer.camera; }
  _input() { return this._getInput?.(); }

  _xy(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  _bind() {
    const c = this.canvas;
    c.addEventListener('pointerdown',   e => this._onDown(e));
    c.addEventListener('pointermove',   e => this._onMove(e));
    c.addEventListener('pointerup',     e => this._onUp(e));
    c.addEventListener('pointercancel', e => this._onUp(e));
    c.addEventListener('wheel',         e => this._onWheel(e), { passive: false });
  }

  // ── pointer down ────────────────────────────────────────────────────────────

  _onDown(e) {
    const p = this._xy(e);

    if (e.pointerType === 'mouse') {
      if (e.button === 1) {                 // middle button → pan
        e.preventDefault();
        this._mousePan   = p;
        this._navigating = true;
      } else if (e.button === 0) {          // left button → aim (or double-click reset)
        const now = performance.now();
        if (now - this._lastClickTime < TAP_MS && this._lastClickPos &&
            dist(p, this._lastClickPos) < TAP_PX) {
          this._camera.resetToDefault({ animated: true });
          this._lastClickTime = 0; this._lastClickPos = null;
          return;
        }
        this._lastClickTime = now; this._lastClickPos = p;
        this._input()?.aimDown(p.x, p.y);
      }
      return;
    }

    // touch / pen
    this._pointers.set(e.pointerId, p);
    const n = this._pointers.size;
    if (n === 1) {
      this._input()?.aimDown(p.x, p.y);
    } else if (n === 2) {
      this._navigating = true;              // FR-13: a 2nd finger means navigation
      const [a, b] = [...this._pointers.values()];
      this._lastDist = dist(a, b);
      this._lastMid  = mid(a, b);
    }
  }

  // ── pointer move ──────────────────────────────────────────────────────────

  _onMove(e) {
    if (e.pointerType === 'mouse') {
      if (this._mousePan && (e.buttons & 4)) {       // middle-drag pan
        const p = this._xy(e);
        this._camera.panByScreen(p.x - this._mousePan.x, p.y - this._mousePan.y);
        this._mousePan = p;
      } else if ((e.buttons & 1) && !this._navigating) {
        const p = this._xy(e);
        this._input()?.aimMove(p.x, p.y);
      }
      return;
    }

    if (!this._pointers.has(e.pointerId)) return;
    const p = this._xy(e);
    this._pointers.set(e.pointerId, p);
    const n = this._pointers.size;

    if (n === 1 && !this._navigating) {
      this._input()?.aimMove(p.x, p.y);
    } else if (n >= 2) {
      const pts = [...this._pointers.values()];
      const a = pts[0], b = pts[1];
      const d = dist(a, b), m = mid(a, b);
      if (this._lastDist > 0) this._camera.zoomAt(m.x, m.y, d / this._lastDist); // FR-10
      if (this._lastMid)      this._camera.panByScreen(m.x - this._lastMid.x,
                                                       m.y - this._lastMid.y);   // FR-11/12
      this._lastDist = d;
      this._lastMid  = m;
    }
  }

  // ── pointer up / cancel ─────────────────────────────────────────────────────

  _onUp(e) {
    if (e.pointerType === 'mouse') {
      if (e.button === 1) { this._mousePan = null; this._navigating = false; }
      return;
    }

    this._pointers.delete(e.pointerId);
    const n = this._pointers.size;

    if (n === 1) {
      // Dropped from two fingers to one — keep navigating until the last finger
      // lifts so a residual finger never snaps into an aim (FR-13 / EC-3).
      this._lastDist = 0;
      this._lastMid  = null;
    } else if (n === 0) {
      if (!this._navigating) {           // genuine single-finger tap → double-tap?
        const now = performance.now();
        const p   = this._xy(e);
        if (now - this._lastTapTime < TAP_MS && this._lastTapPos &&
            dist(p, this._lastTapPos) < TAP_PX) {
          this._camera.resetToDefault({ animated: true });   // FR-14
          this._lastTapTime = 0; this._lastTapPos = null;
        } else {
          this._lastTapTime = now; this._lastTapPos = p;
        }
      }
      this._navigating = false;
      this._lastDist   = 0;
      this._lastMid    = null;
    }
  }

  // ── wheel / trackpad zoom ───────────────────────────────────────────────────

  _onWheel(e) {
    e.preventDefault();
    const p = this._xy(e);
    // ~1.1× per notch (deltaY ≈ ±100), continuous for trackpad pinch (FR-8/FR-15).
    const factor = Math.pow(1.1, -e.deltaY / 100);
    this._camera.zoomAt(p.x, p.y, factor);
  }
}
