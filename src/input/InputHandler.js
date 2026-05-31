import { GameMode } from '../core/GameState.js';

export class InputHandler {
  constructor({ canvas, loop, renderer }) {
    this.canvas   = canvas;
    this.loop     = loop;
    this.renderer = renderer;
    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', e => this._onKey(e));
    this.canvas.addEventListener('mousedown', e => this._onMouseDown(e));
    this.canvas.addEventListener('mousemove', e => this._onMouseMove(e));
  }

  // ─── keyboard ─────────────────────────────────────────────────────────────

  _onKey(e) {
    const loop = this.loop;
    if (!loop) return;

    // System keys work any time
    switch (e.key) {
      case 'p': case 'P': loop.togglePause(); return;
      case 'o': case 'O': loop.stepOne();     return;
    }

    // Aiming keys only when waiting for human input
    if (!this._isHumanAiming()) return;

    switch (e.key) {
      // Angle fine/coarse (Z/A = counter-clockwise = ◄, X/S = clockwise = ►)
      case 'z': case 'Z': loop.humanAngle(+0.1);  break;
      case 'x': case 'X': loop.humanAngle(-0.1);  break;
      case 'a': case 'A': loop.humanAngle(+0.5);  break;
      case 's': case 'S': loop.humanAngle(-0.5);  break;
      // Power fine/coarse
      case 'k': case 'K': loop.humanPower(+1);  break;
      case 'm': case 'M': loop.humanPower(-1);  break;
      case 'j': case 'J': loop.humanPower(+10); break;
      case 'n': case 'N': loop.humanPower(-10); break;
      // Actions
      case 'h': case 'H':  loop.humanHyperspace(); break;
      case 'Enter':        loop.humanFire();        break;
    }
  }

  // ─── mouse aiming ─────────────────────────────────────────────────────────
  // Click or drag within the aiming circle to set angle and power.

  _onMouseDown(e) { this._tryAim(e); }

  _onMouseMove(e) {
    if (e.buttons === 1) this._tryAim(e);  // only while left button held
  }

  _tryAim(e) {
    if (!this._isHumanAiming()) return;
    const station = this.loop.gs.activeStation;
    if (!station || station.status !== 'active') return;

    const conv = this.renderer.conv;
    const ox   = this.renderer._ox;
    const oy   = this.renderer._oy;
    const rect = this.canvas.getBoundingClientRect();
    // Mouse in canvas pixels
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // If waiting for a move-target click, convert canvas px → game units
    if (this.loop.gs.waitingForMove) {
      this.loop.humanSetMove((mx - ox) / conv, (my - oy) / conv);
      return;
    }

    // Station position in canvas pixels (viewport-relative + letterbox offset)
    const cx   = station.position.x * conv + ox;
    const cy   = station.position.y * conv + oy;
    const dx   = mx - cx;
    const dy   = my - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const stationR_px = station.radius * conv;
    const boxR_px     = Math.max(57, 3 * stationR_px) * (this.renderer._aimCircleScale ?? 1);
    const arrowMin_px = Math.max(10, 1.2 * stationR_px);

    // Only respond within the interactive circle and outside the station body
    if (dist <= stationR_px || dist > 1.25 * boxR_px) return;

    // Angle — atan2(dx, dy) gives clockwise-from-down convention matching physics
    station.angle = Math.round(((Math.atan2(dx, dy) * 180 / Math.PI) + 360) % 360 * 10) / 10;

    // Power — distance maps from arrowMin to boxR → 1 to 800
    const fraction = Math.max(0, Math.min(1, (dist - arrowMin_px) / (boxR_px - arrowMin_px)));
    station.power  = Math.round(800 * fraction) + 1;
  }

  _isHumanAiming() {
    const gs = this.loop?.gs;
    return gs && gs.mode === GameMode.AIMING && gs.waitingForInput;
  }
}
