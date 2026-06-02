export const WeaponId = Object.freeze({
  CANNON:        'cannon',
  HYPERSPACE:    'hyperspace',
  TRIPLE_CANNON: 'tripleCannon',
});

// Game-unit radius for collision and rendering.
// Note: collectables are visually crystal-shaped gems; "crystal" is reserved as a
// separate future entity name. In code they are called Collectable throughout.
export const COLLECTABLE_RADIUS = 5;

export class Collectable {
  constructor(position) {
    this.position = position;  // Vec2
    this.rotation = 0;         // radians — advanced by Renderer each frame
    this.alive    = true;
    this.radius   = COLLECTABLE_RADIUS;
  }
}
