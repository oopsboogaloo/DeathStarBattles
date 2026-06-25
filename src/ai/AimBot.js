// Copyright © 2026 Chloe Bolland
// contact chloe@mammoththoughts.com if you wish to use, publish or reproduce this game or any part of it in any way

import { AIController } from './AIController.js';
import { WeaponId } from '../entities/Collectable.js';

// Direct-aim with Gaussian-style noise scaled by total planet mass.
// More mass = more gravitational deflection = harder to aim straight.

export class AimBot extends AIController {
  constructor(physics) { super(2, physics); }

  chooseAction(station, gameState) {
    const target = this._randomEnemy(station, gameState);
    if (!target) return { angle: Math.floor(Math.random() * 360), power: 400, weapon: WeaponId.CANNON };

    const dx = target.position.x - station.position.x;
    const dy = target.position.y - station.position.y;
    // Angle convention: 0=down (+y), clockwise. atan2(dx, dy) gives radians from down.
    const baseAngle = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;

    const totalMass = gameState.planets.reduce((s, p) => s + p.mass, 0);
    const noiseMag  = Math.min(80, Math.sqrt(totalMass) * 2);
    const noise     = (Math.random() - 0.5) * 2 * noiseMag;

    const moveAngle = Math.random() * Math.PI * 2;
    const moveSpeed = 0.005 + Math.random() * 0.015;
    const weapon  = Math.random() < 0.14 ? WeaponId.HYPERSPACE
                  : this._pickWeapon(station, 0.35);
    return {
      angle:   Math.round((baseAngle + noise + 360) % 360),
      power:   Math.floor(Math.random() * 600) + 200,
      weapon,
      velocity: Math.random() < 0.15
        ? { x: Math.cos(moveAngle) * moveSpeed, y: Math.sin(moveAngle) * moveSpeed }
        : null,
    };
  }

  _pickWeapon(station, prob) {
    if (Math.random() >= prob) return WeaponId.CANNON;
    const priority = [
      WeaponId.LASER, WeaponId.ROCKET, WeaponId.MINIGUN, WeaponId.TRIPLE_CANNON,
      WeaponId.BLUNDERBUSS, WeaponId.BLASTER, WeaponId.FORCE_SHIELD,
      WeaponId.FREEZE_RAY, WeaponId.SHOCK_BEAM, WeaponId.ELECTRO_STUN, WeaponId.THEFT_BEAM, WeaponId.QUANTUM_BEAM, WeaponId.ICE_ROCKET,
      WeaponId.SHOCK_ROCKET, WeaponId.ICE_BOMB, WeaponId.AAARRRGGHH, WeaponId.BOUNCE_AUTOCANNON,
      WeaponId.TRIPLE_BOUNCE_CANNON, WeaponId.ICE_BLAST, WeaponId.SUIT_UP, WeaponId.SURPRISE,
    ];
    for (const w of priority) {
      if ((station.team?.getStock(w) ?? 0) > 0) return w;
    }
    return WeaponId.CANNON;
  }

  _randomEnemy(station, gameState) {
    const enemies = gameState.teams
      .filter(t => t !== station.team && t.isAlive)
      .flatMap(t => t.stations.filter(s => s.status === 'active'));
    return enemies.length ? enemies[Math.floor(Math.random() * enemies.length)] : null;
  }
}

AIController.register(2, AimBot);
