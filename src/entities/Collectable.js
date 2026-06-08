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
  ANTIMATTER_LASER:   'antimatterLaser',
  FRAGMENTATION_SHOT: 'fragmentationShot',
  SHOTGUN:            'shotgun',
  DUAL_BLASTER:       'dualBlaster',
  BOUNCE_CANNON:      'bounceCannon',
  AUTO_CANNON:        'autoCannon',
  STAR_SHOT:          'starShot',
  SCATTER_CANNON:     'scatterCannon',
  SPIRAL:             'spiral',
  RESUPPLY:           'resupply',
  HEDGEHOG:           'hedgehog',
  TEAM_SHIELD:        'teamShield',
  ARMOUR:             'armour',
  REPULSOR_FIELD:     'repulsorField',
  MAMMOTH_CANNON:     'mammothCannon',
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
  { id: WeaponId.ANTIMATTER_LASER,   charges: 1,  label: 'ANTIMATTER LASER' },
  { id: WeaponId.FRAGMENTATION_SHOT, charges: 1,  label: 'FRAG SHOT'     },
  { id: WeaponId.SHOTGUN,            charges: 1,  label: 'SHOTGUN'       },
  { id: WeaponId.DUAL_BLASTER,    charges: 1,  label: 'DUAL BLASTER'    },
  { id: WeaponId.BOUNCE_CANNON,   charges: 2,  label: 'BOUNCE CANNON'   },
  { id: WeaponId.AUTO_CANNON,     charges: 2,  label: 'AUTO CANNON'     },
  { id: WeaponId.STAR_SHOT,       charges: 1,  label: 'STAR SHOT'       },
  { id: WeaponId.SCATTER_CANNON,  charges: 2,  label: 'SCATTER CANNON'  },
  { id: WeaponId.SPIRAL,          charges: 1,  label: 'SPIRAL'          },
  { id: WeaponId.RESUPPLY,        charges: 1,  label: 'RESUPPLY'        },
  { id: WeaponId.HEDGEHOG,        charges: 1,  label: 'HEDGEHOG'        },
  { id: WeaponId.TEAM_SHIELD,     charges: 1,  label: 'TEAM SHIELD'     },
  { id: WeaponId.ARMOUR,          charges: 1,  label: 'ARMOUR'          },
  { id: WeaponId.REPULSOR_FIELD,  charges: 1,  label: 'REPULSOR FIELD'  },
  { id: WeaponId.MAMMOTH_CANNON,  charges: 1,  label: 'MAMMOTH CANNON'  },
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
