// Copyright © 2026 Chloe Bolland
// contact chloe@mammoththoughts.com if you wish to use, publish or reproduce this game or any part of it in any way

import { AIController } from './AIController.js';
import { WeaponId } from '../entities/Collectable.js';

export class RandBot extends AIController {
  constructor(physics) { super(1, physics); }

  chooseAction(_station, _gameState) {
    const angle  = Math.random() * Math.PI * 2;
    const speed  = 0.005 + Math.random() * 0.015;
    const weapon = Math.random() < 0.18
      ? WeaponId.HYPERSPACE
      : this._pickWeapon(_station, 0.40);
    return {
      angle:   Math.floor(Math.random() * 360),
      power:   Math.floor(Math.random() * 700) + 100,
      weapon,
      velocity: Math.random() < 0.15
        ? { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed }
        : null,
    };
  }

  _pickWeapon(station, prob) {
    if (Math.random() >= prob) return WeaponId.CANNON;
    const priority = [
      WeaponId.LASER, WeaponId.ROCKET, WeaponId.MINIGUN, WeaponId.TRIPLE_CANNON,
      WeaponId.BLUNDERBUSS, WeaponId.BLASTER, WeaponId.FORCE_SHIELD,
      WeaponId.FREEZE_RAY, WeaponId.SHOCK_BEAM, WeaponId.THEFT_BEAM, WeaponId.QUANTUM_BEAM, WeaponId.ICE_ROCKET,
      WeaponId.SHOCK_ROCKET, WeaponId.ICE_BOMB, WeaponId.AAARRRGGHH, WeaponId.BOUNCE_AUTOCANNON,
      WeaponId.TRIPLE_BOUNCE_CANNON, WeaponId.ICE_BLAST, WeaponId.SUIT_UP, WeaponId.SURPRISE,
    ];
    for (const w of priority) {
      if ((station.team?.getStock(w) ?? 0) > 0) return w;
    }
    return WeaponId.CANNON;
  }
}

AIController.register(1, RandBot);
