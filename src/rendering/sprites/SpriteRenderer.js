// SpriteRenderer.js — generic runtime renderer for generated *.sprite.js modules.
//
// Sprites are object-agnostic: any game entity (ship, drone, projectile, …) can be
// drawn from a sprite module produced by scripts/build-sprites.mjs. Path2D objects
// are built once in initSprite(); the per-frame draw path performs no allocations
// and no string parsing (spec/space-mammoth-sprite-spec.md §5, §10).

import { interpolateKeyframes, bracketMorphKeyframes, resolveColor, lerp } from './spriteUtils.js';

// Builds Path2D objects and lookup sets. Idempotent; call once per sprite at startup.
export function initSprite(sprite) {
  if (sprite._initialised) return sprite;
  for (const layer of sprite.layers) {
    if (layer.path) layer._path = new Path2D(layer.path);
    // morph layers have no _path; they are drawn via direct canvas commands
  }
  if (sprite.clipPath) sprite._clipPath = new Path2D(sprite.clipPath);
  sprite._clippedSet  = new Set(sprite.clippedLayers ?? []);
  sprite._initialised = true;
  return sprite;
}

// Scratch objects — reused every frame, never allocated in the draw loop
const KF      = { tx: 0, ty: 0, rot: 0, scale: 1, opacity: 1 };
const BRACKET = { a: null, b: null, t: 0 };

// Draws one sprite instance centred on (x, y). screenRadius is the on-screen
// radius in px: the sprite's viewBox width maps to screenRadius * 2.
// animPhase is 0–1 within sprite.duration (same value for all instances in a frame).
export function drawSprite(ctx, sprite, x, y, screenRadius, teamColors, animPhase) {
  const vb = sprite.viewBox;
  const s  = (screenRadius * 2) / vb[2];

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.translate(-vb[0] - vb[2] / 2, -vb[1] - vb[3] / 2);

  for (const layer of sprite.layers) {
    if (layer.minRadius !== undefined && screenRadius < layer.minRadius) continue;

    const clipped = sprite._clippedSet.has(layer.id);
    if (clipped) { ctx.save(); ctx.clip(sprite._clipPath); }

    if (layer.morphKeyframes) {
      _drawMorphLayer(ctx, layer, animPhase, teamColors);
    } else {
      _drawTransformLayer(ctx, layer, animPhase, teamColors, vb);
    }

    if (clipped) ctx.restore();
  }

  ctx.restore();
}

function _drawTransformLayer(ctx, layer, phase, teamColors, vb) {
  ctx.fillStyle = resolveColor(layer.fill, teamColors);

  if (!layer.keyframes) {           // static layer — cheapest path, no save/restore
    ctx.fill(layer._path);
    return;
  }

  const kf = interpolateKeyframes(layer.keyframes, phase, KF);

  if (kf.rot === 0 && kf.scale === 1 && kf.opacity === 1) {
    // translation-only — invert the translate instead of paying save/restore
    ctx.translate(kf.tx, kf.ty);
    ctx.fill(layer._path);
    ctx.translate(-kf.tx, -kf.ty);
    return;
  }

  ctx.save();
  if (kf.tx !== 0 || kf.ty !== 0) ctx.translate(kf.tx, kf.ty);
  if (kf.rot !== 0 || kf.scale !== 1) {
    // rotate/scale about the layer's own pivot, not the viewBox origin
    const px = layer.pivot ? layer.pivot[0] : vb[0] + vb[2] / 2;
    const py = layer.pivot ? layer.pivot[1] : vb[1] + vb[3] / 2;
    ctx.translate(px, py);
    if (kf.rot !== 0)   ctx.rotate(kf.rot * Math.PI / 180);
    if (kf.scale !== 1) ctx.scale(kf.scale, kf.scale);
    ctx.translate(-px, -py);
  }
  if (kf.opacity !== 1) ctx.globalAlpha *= kf.opacity; // compose with caller's alpha
  ctx.fill(layer._path);
  ctx.restore();
}

function _drawMorphLayer(ctx, layer, phase, teamColors) {
  const { a, b, t } = bracketMorphKeyframes(layer.morphKeyframes, phase, BRACKET);

  ctx.fillStyle = resolveColor(layer.fill, teamColors);
  ctx.beginPath();
  for (let i = 0; i < a.commands.length; i++) {
    const ca = a.commands[i], cb = b.commands[i];
    switch (ca.cmd) {
      case 'M':
        ctx.moveTo(lerp(ca.x, cb.x, t), lerp(ca.y, cb.y, t));
        break;
      case 'L':
        ctx.lineTo(lerp(ca.x, cb.x, t), lerp(ca.y, cb.y, t));
        break;
      case 'C':
        ctx.bezierCurveTo(
          lerp(ca.x1, cb.x1, t), lerp(ca.y1, cb.y1, t),
          lerp(ca.x2, cb.x2, t), lerp(ca.y2, cb.y2, t),
          lerp(ca.x,  cb.x,  t), lerp(ca.y,  cb.y,  t));
        break;
      case 'Z':
        ctx.closePath();
        break;
    }
  }
  ctx.fill();
}
