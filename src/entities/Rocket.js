// Copyright © 2026 Chloe Bolland
// contact chloe@mammoththoughts.com if you wish to use, publish or reproduce this game or any part of it in any way

export const RocketStatus = Object.freeze({
  ACTIVE:    'active',
  EXPLODING: 'exploding',
  DEAD:      'dead',
});

export const ROCKET_BASE_MASS      = 1.0;
export const ROCKET_THRUST         = 0.15;  // acceleration applied each step while fuel > 0
export const ROCKET_FUEL_BURN_RATE = 0.5;   // fuel units consumed per game-time unit
export const ROCKET_MIN_FUEL       = 1.0;   // fuel at power 1
export const ROCKET_MAX_FUEL       = 6.0;   // fuel at power 800
export const ROCKET_LAUNCH_SPEED   = 0.15;  // initial speed (game units / TIMESTEP) — always slow
export const ROCKET_BLAST_RADIUS   = 46;    // fixed explosion radius in game units
export const ROCKET_HITBOX_RADIUS  = 8;     // radius for shoot-down bullet collision

export class Rocket {
  constructor({ owner, position, velocity }) {
    this.owner      = owner;      // Station reference
    this.position   = position;   // Vec2
    this.velocity   = velocity;   // Vec2 (unit direction × ROCKET_LAUNCH_SPEED)
    this.fuel           = 0;      // set by caller after construction
    this.status         = RocketStatus.ACTIVE;
    this.explosionT     = 0;
    this.trail          = [];    // Vec2[] — positions for particle trail rendering
    this.teleportCount  = 0;     // wormhole traversal count (max 100)
  }
}
