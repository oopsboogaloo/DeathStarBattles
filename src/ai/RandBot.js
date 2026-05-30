import { AIController } from './AIController.js';

export class RandBot extends AIController {
  constructor(physics) { super(1, physics); }

  chooseAction(_station, _gameState) {
    return {
      angle:      Math.floor(Math.random() * 360),
      power:      Math.floor(Math.random() * 700) + 100,
      hyperspace: Math.random() < 0.18,
    };
  }
}

AIController.register(1, RandBot);
