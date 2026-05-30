import { SuperBot }     from './SuperBot.js';
import { AIController } from './AIController.js';

export class MegaBot extends SuperBot {
  constructor(physics) { super(physics, 5); }

  get stepSize()  { return 5; }
  get simSteps()  { return 2000; }
  get times()     { return 50; }

  _useWormholes(_gs) { return true; }

  // Target the highest-scoring enemy team
  _selectTarget(station, gameState) {
    const enemies = gameState.teams
      .filter(t => t !== station.team && t.isAlive)
      .flatMap(t => t.stations.filter(s => s.status === 'active'));
    if (!enemies.length) return null;

    const ranked = [...new Set(enemies.map(e => e.team))]
      .sort((a, b) => b.stats.score - a.stats.score);
    const topEnemies = enemies.filter(e => e.team === ranked[0]);
    return topEnemies[Math.floor(Math.random() * topEnemies.length)];
  }

  // Leaderboard-aware hyperspace: more aggressive when losing
  _shouldHyperspace(station, target, gameState, closestDist) {
    const myScore  = station.team.stats.score;
    const maxScore = Math.max(0, ...gameState.teams
      .filter(t => t !== station.team && t.isAlive)
      .map(t => t.stats.score));
    const totalMass = gameState.planets.reduce((s, p) => s + p.mass, 0);
    const threshold = target.radius * 3 + totalMass * 0.03;
    const prob = myScore < maxScore ? 0.30 : 0.15;
    return closestDist > threshold && Math.random() < prob;
  }
}

AIController.register(5, MegaBot);
