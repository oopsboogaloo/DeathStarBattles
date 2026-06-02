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
    const tcStock = Math.random() < 0.35 ? station.team?.getStock(WeaponId.TRIPLE_CANNON) ?? 0 : 0;
    const weapon  = Math.random() < 0.14 ? WeaponId.HYPERSPACE
                  : tcStock > 0          ? WeaponId.TRIPLE_CANNON
                  : WeaponId.CANNON;
    return {
      angle:   Math.round((baseAngle + noise + 360) % 360),
      power:   Math.floor(Math.random() * 600) + 200,
      weapon,
      velocity: Math.random() < 0.15
        ? { x: Math.cos(moveAngle) * moveSpeed, y: Math.sin(moveAngle) * moveSpeed }
        : null,
    };
  }

  _randomEnemy(station, gameState) {
    const enemies = gameState.teams
      .filter(t => t !== station.team && t.isAlive)
      .flatMap(t => t.stations.filter(s => s.status === 'active'));
    return enemies.length ? enemies[Math.floor(Math.random() * enemies.length)] : null;
  }
}

AIController.register(2, AimBot);
