// Copyright © 2026 Chloe Bolland
// contact chloe@mammoththoughts.com if you wish to use, publish or reproduce this game or any part of it in any way

import { GameMode } from '../core/GameState.js';
import { WeaponId } from '../entities/Collectable.js';

export class InputHandler {
  constructor({ canvas, loop, renderer }) {
    this.canvas            = canvas;
    this.loop              = loop;
    this.renderer          = renderer;
    this._shotgunAimBarrel = 1;
    this._bind();
  }

  _bind() {
    window.addEventListener('keydown', e => this._onKey(e));
    // Pointer (mouse/touch) input is owned by CameraControls, which forwards
    // single-pointer drags here via aimDown()/aimMove() so navigation gestures
    // and aiming never fight over the same events.
  }

  // ─── keyboard ─────────────────────────────────────────────────────────────

  _onKey(e) {
    const loop = this.loop;
    if (!loop) return;

    // Aiming keys only when waiting for human input
    if (!this._isHumanAiming()) return;

    // Frozen and electrified stations cannot be controlled — only End Turn
    const locked = (loop.gs?.activeStation?.frozen ?? 0) > 0 ||
                   (loop.gs?.activeStation?.electrified ?? 0) > 0;

    switch (e.key) {
      // Angle fine/coarse (Z/A = counter-clockwise = ◄, X/S = clockwise = ►)
      case 'z': case 'Z': if (!locked) loop.humanAngle(+0.1);  break;
      case 'x': case 'X': if (!locked) loop.humanAngle(-0.1);  break;
      case 'a': case 'A': if (!locked) loop.humanAngle(+0.5);  break;
      case 's': case 'S': if (!locked) loop.humanAngle(-0.5);  break;
      // Power fine/coarse
      case 'k': case 'K': if (!locked) loop.humanPower(+1);  break;
      case 'm': case 'M': if (!locked) loop.humanPower(-1);  break;
      case 'j': case 'J': if (!locked) loop.humanPower(+10); break;
      case 'n': case 'N': if (!locked) loop.humanPower(-10); break;
      // Actions (weapon/hyperspace disabled while locked; End Turn always allowed)
      case 'w': case 'W':  if (!locked) loop.humanCycleWeapon(); break;
      case 'h': case 'H':  if (!locked) loop.humanHyperspace(); break;
      case 'Enter':        loop.humanFire();        break;
    }
  }

  // ─── pointer aiming ─────────────────────────────────────────────────────────
  // Click or drag within the aiming circle to set angle and power. Called by
  // CameraControls with canvas-pixel coordinates. All screen↔world conversion
  // goes through the camera (FR-2) so aiming works at any zoom/pan.

  aimDown(mx, my) {
    if (this._isHumanAiming()) {
      const station = this.loop?.gs?.activeStation;
      const w = station?.selectedWeapon;
      if (w === WeaponId.SHOTGUN || w === WeaponId.DUAL_BLASTER) {
        this._shotgunAimBarrel = this._shotgunAimBarrel === 1 ? 2 : 1;
      } else {
        this._shotgunAimBarrel = 1;
      }
    }
    this._tryAim(mx, my);
  }

  aimMove(mx, my) { this._tryAim(mx, my); }

  _tryAim(mx, my) {
    if (!this._isHumanAiming()) return;
    const station = this.loop.gs.activeStation;
    if (!station || station.status !== 'active') return;
    if ((station.frozen ?? 0) > 0 || (station.electrified ?? 0) > 0) return;

    const conv   = this.renderer.conv;
    const camera = this.renderer.camera;

    // If waiting for a move-target click, convert canvas px → game units
    if (this.loop.gs.waitingForMove) {
      const w = camera.screenToWorld(mx, my);
      this.loop.humanSetMove(w.x, w.y);
      return;
    }

    // Work in viewport-z1 (world*conv) space: the camera maps pointer px back
    // into the same space the aim circle is drawn in, so the existing pixel
    // thresholds below are unchanged and scale automatically with zoom.
    const loc  = camera.screenToLocal(mx, my);
    const cx   = station.position.x * conv;
    const cy   = station.position.y * conv;
    const dx   = loc.x - cx;
    const dy   = loc.y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const stationR_px = station.radius * conv;
    const boxR_px     = Math.max(57, 3 * stationR_px) * (this.renderer._aimCircleScale ?? 1);
    const arrowMin_px = Math.max(10, 1.2 * stationR_px);

    // Only respond within the interactive circle and outside the station body
    if (dist <= stationR_px || dist > 1.25 * boxR_px) return;

    // Angle — atan2(dx, dy) gives clockwise-from-down convention matching physics
    const angleDeg = Math.round(((Math.atan2(dx, dy) * 180 / Math.PI) + 360) % 360 * 10) / 10;

    const isTwoBarrel = station.selectedWeapon === WeaponId.SHOTGUN || station.selectedWeapon === WeaponId.DUAL_BLASTER;
    const isBlaster   = station.selectedWeapon === WeaponId.BLASTER;
    if (isTwoBarrel && this._shotgunAimBarrel === 2) {
      station.angle2 = angleDeg;
    } else {
      station.angle = angleDeg;
      const fraction = Math.max(0, Math.min(1, (dist - arrowMin_px) / (boxR_px - arrowMin_px)));
      if (isBlaster) {
        // Distance maps to spread: inner edge = 3°, outer edge = 15°
        station.power = Math.max(3, Math.min(15, Math.round(3 + fraction * 12)));
      } else if (!isTwoBarrel) {
        // Normal power — distance maps from arrowMin to boxR → 1 to 800
        station.power = Math.round(800 * fraction) + 1;
      }
    }
  }

  _isHumanAiming() {
    const gs = this.loop?.gs;
    return gs && (gs.mode === GameMode.AIMING || gs.mode === GameMode.TP_AIMING) && gs.waitingForInput;
  }
}
