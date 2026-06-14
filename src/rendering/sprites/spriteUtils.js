// Copyright © 2026 Chloe Bolland
// contact chloe@mammoththoughts.com if you wish to use, publish or reproduce this game or any part of it in any way

// spriteUtils.js — keyframe interpolation and colour resolution for the sprite renderer.
// All functions are allocation-free in the draw loop (results written into caller scratch).

export function resolveColor(fill, teamColors) {
  if (fill === 'team.primary')   return teamColors.primary;
  if (fill === 'team.secondary') return teamColors.secondary;
  if (fill === 'team.shade1')    return teamColors.shade1;
  if (fill === 'team.shade2')    return teamColors.shade2;
  if (fill === 'team.shade3')    return teamColors.shade3;
  if (fill === 'team.shade4')    return teamColors.shade4;
  return fill;
}

// Interpolates transform keyframes at phase (0–1) into `out`
// ({tx, ty, rot, scale, opacity}). Returns `out`.
export function interpolateKeyframes(keyframes, phase, out) {
  let a = keyframes[0], b = keyframes[keyframes.length - 1];
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (phase >= keyframes[i].t && phase <= keyframes[i + 1].t) {
      a = keyframes[i]; b = keyframes[i + 1]; break;
    }
  }
  const t = a.t === b.t ? 0 : (phase - a.t) / (b.t - a.t);
  out.tx      = lerp(a.tx ?? 0, b.tx ?? 0, t);
  out.ty      = lerp(a.ty ?? 0, b.ty ?? 0, t);
  out.rot     = lerp(a.rot ?? 0, b.rot ?? 0, t);
  out.scale   = lerp(a.scale ?? 1, b.scale ?? 1, t);
  out.opacity = lerp(a.opacity ?? 1, b.opacity ?? 1, t);
  return out;
}

// Finds the bracketing morph keyframes for phase; writes {a, b, t} into `out`.
export function bracketMorphKeyframes(morphKeyframes, phase, out) {
  let a = morphKeyframes[0], b = morphKeyframes[morphKeyframes.length - 1];
  for (let i = 0; i < morphKeyframes.length - 1; i++) {
    if (phase >= morphKeyframes[i].t && phase <= morphKeyframes[i + 1].t) {
      a = morphKeyframes[i]; b = morphKeyframes[i + 1]; break;
    }
  }
  out.a = a;
  out.b = b;
  out.t = a.t === b.t ? 0 : (phase - a.t) / (b.t - a.t);
  return out;
}

export function lerp(a, b, t) { return a + (b - a) * t; }
