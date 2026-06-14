// Copyright © 2026 Chloe Bolland
// contact chloe@mammoththoughts.com if you wish to use, publish or reproduce this game or any part of it in any way

// Base class + registration factory.
// Concrete bots self-register at module evaluation time; main.js imports them
// to trigger registration before any call to AIController.create().

const _registry = new Map();

export class AIController {
  constructor(level, physics) {
    this.level   = level;
    this.physics = physics;
  }

  // Returns { angle: int, power: int, weapon: WeaponId }
  chooseAction(_station, _gameState) {
    throw new Error('AIController.chooseAction() is abstract');
  }

  static register(level, Cls) {
    _registry.set(level, Cls);
  }

  static create(level, physics) {
    const Cls = _registry.get(level) ?? _registry.get(1);
    if (!Cls) throw new Error(`No AI registered for level ${level}`);
    return new Cls(physics);
  }
}
