export const WeaponId = Object.freeze({
  CANNON:        'cannon',
  HYPERSPACE:    'hyperspace',
  TRIPLE_CANNON: 'tripleCannon',
  BLUNDERBUSS:   'blunderbuss',
  LASER:         'laser',
  ROCKET:        'rocket',
  BLASTER:       'blaster',
  MINIGUN:       'minigun',
  FORCE_SHIELD:  'forceShield',
});

// Weapon grant table — one entry per special weapon, used when a collectable is collected.
export const WEAPON_GRANTS = [
  { id: WeaponId.TRIPLE_CANNON, charges: 3,  label: 'TRIPLE CANNON' },
  { id: WeaponId.BLUNDERBUSS,   charges: 2,  label: 'BLUNDERBUSS'   },
  { id: WeaponId.LASER,         charges: 1,  label: 'LASER'         },
  { id: WeaponId.ROCKET,        charges: 1,  label: 'ROCKET'        },
  { id: WeaponId.BLASTER,       charges: 3,  label: 'BLASTER'       },
  { id: WeaponId.MINIGUN,       charges: 1,  label: 'MINIGUN'       },
  { id: WeaponId.FORCE_SHIELD,  charges: 2,  label: 'FORCE SHIELD'  },
];

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
