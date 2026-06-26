// Copyright © 2026 Chloe Bolland
// contact chloe@mammoththoughts.com if you wish to use, publish or reproduce this game or any part of it in any way

// Expanding ring of ice fired by Ice Blast — a slow, gravity-immune projectile
// that flies dead straight and single-freezes any ship it passes through
// (new-weapons-spec §2).

export const ICE_RING_MAX_RADIUS = 36;    // game units — radius at end of life
export const ICE_RING_LIFETIME   = 6000;  // physics steps before it dissipates

export class IceRing {
  constructor({ owner, position, velocity }) {
    this.owner    = owner;       // Station reference
    this.position = position;    // Vec2 — centre of the ring
    this.velocity = velocity;    // Vec2 — constant (gravity-immune)
    this.radius   = 0;           // expands toward ICE_RING_MAX_RADIUS over lifetime
    this.lifetime = 0;           // step counter
    this.status   = 'active';    // 'active' | 'dead'
    this.hitSet   = new Set();   // stations already frozen by this ring
  }
}
