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
    this.maxLifetime    = null;        // null = use BULLET_LIFE; set shorter for blunderbuss
  }
}
