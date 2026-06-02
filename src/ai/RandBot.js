import { AIController } from './AIController.js';
import { WeaponId } from '../entities/Collectable.js';

export class RandBot extends AIController {
  constructor(physics) { super(1, physics); }

  chooseAction(_station, _gameState) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.005 + Math.random() * 0.015;
    const tcStock = Math.random() < 0.40 ? _station.team?.getStock(WeaponId.TRIPLE_CANNON) ?? 0 : 0;
    const weapon  = Math.random() < 0.18 ? WeaponId.HYPERSPACE
                  : tcStock > 0          ? WeaponId.TRIPLE_CANNON
                  : WeaponId.CANNON;
    return {
      angle:   Math.floor(Math.random() * 360),
      power:   Math.floor(Math.random() * 700) + 100,
      weapon,
      velocity: Math.random() < 0.15
        ? { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed }
        : null,
    };
  }
}

AIController.register(1, RandBot);
