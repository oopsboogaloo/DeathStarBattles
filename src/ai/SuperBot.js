import { SimBot }       from './CleverBot.js';
import { AIController } from './AIController.js';
import { WeaponId } from '../entities/Collectable.js';
// SimBot imported for _netGravity helper

export class SuperBot extends SimBot {
  constructor(physics, level = 4) { super(level, physics); }

  get stepSize()  { return 10; }
  get simSteps()  { return 800; }
  get times()     { return 25; }

  // Wormhole-aware simulation after turn 3
  _useWormholes(gs) { return gs.turn >= 3; }

  get _specialProb() { return 0.25; }

  // Prefer the nearest enemy station (70% of the time)
  _selectTarget(station, gameState) {
    const enemies = gameState.teams
      .filter(t => t !== station.team && t.isAlive)
      .flatMap(t => t.stations.filter(s => s.status === 'active'));
    if (!enemies.length) return null;

    enemies.sort((a, b) =>
      station.position.distanceSqTo(a.position) - station.position.distanceSqTo(b.position),
    );
    return Math.random() < 0.70
      ? enemies[0]
      : enemies[Math.floor(Math.random() * enemies.length)];
  }

  _chooseMoveVelocity(station, gameState) {
    if (Math.random() >= 0.70) return null;
    const g   = SimBot._netGravity(station.position, gameState.planets);
    const mag = Math.sqrt(g.x * g.x + g.y * g.y);
    if (mag < 0.0001) return null;
    const speed = 0.01 + Math.random() * 0.02;
    return { x: -g.x / mag * speed, y: -g.y / mag * speed };
  }

  // Hyperspace when the trajectory is far from the target and conditions are bad
  _shouldHyperspace(_station, target, gameState, closestDist) {
    const totalMass = gameState.planets.reduce((s, p) => s + p.mass, 0);
    const threshold = target.radius * 4 + totalMass * 0.05;
    return closestDist > threshold && Math.random() < 0.25;
  }
}

AIController.register(4, SuperBot);
