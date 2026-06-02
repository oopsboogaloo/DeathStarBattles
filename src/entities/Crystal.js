export const WeaponId = Object.freeze({
  CANNON:        'cannon',
  HYPERSPACE:    'hyperspace',
  TRIPLE_CANNON: 'tripleCannon',
});

// Game-unit radius for collision and rendering.
export const CRYSTAL_RADIUS = 5;

export class Crystal {
  constructor(position) {
    this.position = position;  // Vec2
    this.rotation = 0;         // radians — advanced by Renderer each frame
    this.alive    = true;
    this.radius   = CRYSTAL_RADIUS;
  }
}
