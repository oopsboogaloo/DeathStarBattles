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

  _chooseMoveVelocity(station, gameState) {
    if (Math.random() >= 0.70) return null;
    const g   = SimBot._netGravity(station.position, gameState.planets);
    const mag = Math.sqrt(g.x * g.x + g.y * g.y);
    if (mag < 0.0001) return null;
    const speed = 0.01 + Math.random() * 0.02;
    const vel   = { x: -g.x / mag * speed, y: -g.y / mag * speed };

    // Suppress movement that would bring friendly stations closer together than threshold
    const friends = station.team.stations.filter(s => s !== station && s.status === 'active');
    if (friends.length) {
      const MIN_FRIENDLY_DIST = 30;
      const newX = station.position.x + vel.x * 60; // rough estimate: 60 steps
      const newY = station.position.y + vel.y * 60;
      const avgDist = friends.reduce((sum, f) => {
        const dx = newX - f.position.x, dy = newY - f.position.y;
        return sum + Math.sqrt(dx * dx + dy * dy);
      }, 0) / friends.length;
      if (avgDist < MIN_FRIENDLY_DIST) return null;
    }

    return vel;
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
