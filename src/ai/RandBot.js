import { AIController } from './AIController.js';

export class RandBot extends AIController {
  constructor(physics) { super(1, physics); }

  chooseAction(_station, _gameState) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.005 + Math.random() * 0.015;
    return {
      angle:      Math.floor(Math.random() * 360),
      power:      Math.floor(Math.random() * 700) + 100,
      hyperspace: Math.random() < 0.18,
      velocity:   Math.random() < 0.15
        ? { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed }
        : null,
    };
  }
}

AIController.register(1, RandBot);
