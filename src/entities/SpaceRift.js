// Copyright © 2026 Chloe Bolland
// contact chloe@mammoththoughts.com if you wish to use, publish or reproduce this game or any part of it in any way

export const RIFT_SEGMENT_LENGTH     = 10;    // ≈ 1 Medium station diameter (game units)
export const RIFT_REPULSION_STRENGTH = 0.0015; // force per vertex at d=0 (tunable)

export class SpaceRift {
  constructor({ vertices, strengthMultiplier = 1, isBoundary = false, reflective = false, influenceRadius: irOverride } = {}) {
    this.vertices          = vertices;
    this.strengthMultiplier = strengthMultiplier;
    this.isBoundary        = isBoundary;
    // Blue reflective rift: bounces any projectile that crosses a segment and
    // exerts NO repulsion force (reflect-only). Default purple rifts repel.
    this.reflective        = reflective;
    this.influenceRadius   = irOverride !== undefined
      ? irOverride
      : (vertices.length - 1) * RIFT_SEGMENT_LENGTH * 0.5;
  }
}
