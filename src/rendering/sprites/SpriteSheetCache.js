// SpriteSheetCache.js — per-team pre-rendered animation frames for mass sprite drawing.
//
// Animation phase is global (spec §9), so every instance of a sprite with the same
// team colours is pixel-identical within a frame. Instead of replaying ~23 canvas
// path calls per ship, each (sprite, team) pair gets a horizontal sheet of
// SHEET_FRAMES pre-rendered phase frames; drawing a ship is then one drawImage.
// This is what makes 96 ships at 60fps viable on iPad (spec §10.1).
//
// Sheets are built lazily on first use (~one sheet per team actually in play) and
// snapshotted to ImageBitmap where supported, for zero-flush drawImage on iOS —
// same pattern as the gas giant canvas in Renderer.js.

import { drawSprite } from './SpriteRenderer.js';

export const SHEET_FRAMES = 24; // 2400ms loop → 100ms per frame, steps invisible at game sizes

export class SpriteSheetCache {
  // frameSize: square frame edge in px. Frames are rendered at full detail
  // (radius frameSize/2) and downscaled per ship, so 128 covers ships up to
  // 64px radius with headroom. One sheet ≈ frameSize² × SHEET_FRAMES × 4 bytes
  // (≈ 1.5MB at 128) per team in play.
  constructor(frameSize = 128) {
    this._frameSize = frameSize;
    this._sheets = new Map(); // "spriteName|teamKey" → {canvas, src}
  }

  // Draws one instance centred on (x, y). teamKey must uniquely identify
  // teamColors (e.g. "r,g,b"); sprite must already be initialised.
  draw(ctx, sprite, x, y, screenRadius, teamKey, teamColors, animPhase) {
    const key = sprite.name + '|' + teamKey;
    let sheet = this._sheets.get(key);
    if (!sheet) {
      sheet = this._build(sprite, teamColors);
      this._sheets.set(key, sheet);
    }
    const fs = this._frameSize;
    const i  = Math.min(SHEET_FRAMES - 1, (animPhase * SHEET_FRAMES) | 0);
    const d  = screenRadius * 2;
    ctx.drawImage(sheet.src, i * fs, 0, fs, fs, x - screenRadius, y - screenRadius, d, d);
  }

  _build(sprite, teamColors) {
    const fs = this._frameSize;
    const canvas = document.createElement('canvas');
    canvas.width  = fs * SHEET_FRAMES;
    canvas.height = fs;
    const c = canvas.getContext('2d');
    for (let i = 0; i < SHEET_FRAMES; i++) {
      drawSprite(c, sprite, i * fs + fs / 2, fs / 2, fs / 2, teamColors, i / SHEET_FRAMES);
    }
    const sheet = { canvas, src: canvas };
    if (typeof createImageBitmap === 'function') {
      createImageBitmap(canvas).then(b => { sheet.src = b; }).catch(() => {});
    }
    return sheet;
  }

  clear() {
    this._sheets.clear();
  }
}
