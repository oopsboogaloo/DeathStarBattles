export const WeaponId = Object.freeze({
  CANNON:             'cannon',
  HYPERSPACE:         'hyperspace',
  TRIPLE_CANNON:      'tripleCannon',
  BLUNDERBUSS:        'blunderbuss',
  LASER:              'laser',
  ROCKET:             'rocket',
  ROCKET_POD:         'rocketPod',
  BLASTER:            'blaster',
  MINIGUN:            'minigun',
  FORCE_SHIELD:       'forceShield',
  SEPTUPLE_CANNON:    'septupleCannon',
  PULSE_LASER:        'pulseLaser',
  FRAGMENTATION_SHOT: 'fragmentationShot',
});

// Weapon grant table — one entry per special weapon, used when a collectable is collected.
export const WEAPON_GRANTS = [
  { id: WeaponId.TRIPLE_CANNON, charges: 3,  label: 'TRIPLE CANNON' },
  { id: WeaponId.BLUNDERBUSS,   charges: 2,  label: 'BLUNDERBUSS'   },
  { id: WeaponId.LASER,         charges: 1,  label: 'LASER'         },
  { id: WeaponId.ROCKET,        charges: 1,  label: 'ROCKET'        },
  { id: WeaponId.ROCKET_POD,   charges: 1,  label: 'ROCKET POD'    },
  { id: WeaponId.BLASTER,       charges: 3,  label: 'BLASTER'       },
  { id: WeaponId.MINIGUN,            charges: 1,  label: 'MINIGUN'      },
  { id: WeaponId.FORCE_SHIELD,       charges: 2,  label: 'FORCE SHIELD' },
  { id: WeaponId.SEPTUPLE_CANNON,    charges: 1,  label: 'SEPT. CANNON'  },
  { id: WeaponId.PULSE_LASER,        charges: 1,  label: 'PULSE LASER'   },
  { id: WeaponId.FRAGMENTATION_SHOT, charges: 1,  label: 'FRAG SHOT'     },
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
