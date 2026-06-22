// Copyright © 2026 Chloe Bolland
// contact chloe@mammoththoughts.com if you wish to use, publish or reproduce this game or any part of it in any way

export const BulletStatus = Object.freeze({
  ACTIVE:    'active',
  EXPLODING: 'exploding',
  DEAD:      'dead',
});

export class Bullet {
  constructor({ owner, position, velocity }) {
    this.owner         = owner;       // Station reference
    this.position      = position;    // Vec2, game units (current)
    this.velocity      = velocity;    // Vec2, game units per physics step
    this.status        = BulletStatus.ACTIVE;
    this.trail         = [];          // Vec2[] — sampled positions in game units
    this.teleportCount  = 0;           // wormhole traversal count (max 100)
    this.explosionT     = 0;           // 0→1 animation progress when EXPLODING
    this.lifetime       = 0;           // total physics steps taken
    this.trickShotDone  = false;       // true once bullet has completed a 360° loop
    this._prevAngle     = null;        // previous velocity angle for rotation tracking
    this._angleAccum    = 0;           // accumulated signed rotation (radians)
    this.nearMissed     = new Set();   // stations already counted as near-missed
    this.thinTrail      = false;       // true for spread/burst weapons (lower trail opacity)
    this.thickTrail     = false;       // true for fragmentation shot primary (2× trail width)
    this.maxLifetime    = null;        // null = use BULLET_LIFE; set shorter for blunderbuss
    this.skimCount      = 0;           // number of surface skims this bullet has performed
    this.fragTimer        = null;        // physics steps until detonation (fragmentation shot primary)
    this.fragBouncy       = false;       // primary bounces off surfaces instead of exploding
    this.fragFragment     = false;       // fragment bullet spawned on frag shot detonation
    this.bouncePlanetOnly = false;       // bounces off planets but explodes on station contact
    this.scatterTimer     = null;        // steps until cannon scatter (scatter cannon primary)
    this.gravityMultiplier = 1;          // multiplied into all gravitational acceleration (Mammoth Cannon: 0.25)
    this.sizeMultiplier    = 1;          // multiplied into drawn bullet radius
    this.mammothCannon     = false;      // triggers large area blast on any solid-body hit
    this.quantumTorpedo    = false;      // teleports through solid non-hazard bodies
    this._qtTeleportPlanet = null;       // set by PhysicsEngine to signal a pending QT teleport
    this.gravityCannon     = false;      // exerts gravitational attraction on all nearby bullets
    this.iceBomb           = false;      // detonates into a freeze-zone blast (fuse or impact)
    this.iceBombTimer      = null;       // physics steps until ice-bomb fuse detonation
    this.birthdayPresent   = false;      // grants weapons to the struck team on hit
    this.gravityScale      = 1;          // extra per-bullet gravity scale (Birthday Present: 1/9)
    this.bounceCount       = 0;          // number of surface bounces (for trickshot award)
  }
}
