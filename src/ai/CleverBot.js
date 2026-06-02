import { AIController } from './AIController.js';
import { WeaponId } from '../entities/Collectable.js';

// ── SimBot ─────────────────────────────────────────────────────────────────────
// Abstract base for all simulation-based bots.
// Subclasses override the getters below to tune accuracy vs. speed.

export class SimBot extends AIController {
  constructor(level, physics) {
    super(level, physics);
    this._mem = new Map(); // key: `${shooterId}-${targetId}` → {angle, power}
  }

  get stepSize()   { return 20; }   // physics steps per sim iteration (coarser = faster)
  get simSteps()   { return 400; }  // iterations per trajectory trace
  get times()      { return 4; }    // trajectories sampled per shot
  get hyperProb()    { return 0.11; } // base hyperspace probability
  get _specialProb() { return 0.30; } // probability of spending a special weapon this turn

  // Override in SuperBot/MegaBot to enable wormhole-aware simulation
  _useWormholes(gameState) { return false; } // eslint-disable-line no-unused-vars

  chooseAction(station, gameState) {
    const target = this._selectTarget(station, gameState);
    if (!target) return { angle: Math.floor(Math.random() * 360), power: 400, weapon: WeaponId.CANNON };

    const { angle, power, closestDist } = this._findBestShot(
      station, target, gameState, this._numTrials(gameState.turn),
    );

    this._mem.set(`${station.id}-${target.id}`, { angle, power });

    const shouldHyperspace = this._shouldHyperspace(station, target, gameState, closestDist);
    const weapon = shouldHyperspace ? WeaponId.HYPERSPACE : this._pickWeapon(station);
    return {
      angle,
      power,
      weapon,
      velocity: this._chooseMoveVelocity(station, gameState),
    };
  }

  _chooseMoveVelocity(_station, _gameState) { return null; } // overridden in sub-bots

  _pickWeapon(station) {
    if (Math.random() >= this._specialProb) return WeaponId.CANNON;
    const priority = [
      WeaponId.LASER, WeaponId.ROCKET, WeaponId.MINIGUN, WeaponId.TRIPLE_CANNON,
      WeaponId.BLUNDERBUSS, WeaponId.BLASTER, WeaponId.FORCE_SHIELD,
    ];
    for (const w of priority) {
      if ((station.team?.getStock(w) ?? 0) > 0) return w;
    }
    return WeaponId.CANNON;
  }

  // Compute net gravity acceleration vector at position from all planets (G=0.2)
  static _netGravity(position, planets) {
    let gx = 0, gy = 0;
    for (const p of planets) {
      const dx = p.position.x - position.x, dy = p.position.y - position.y;
      const rSq = Math.max(1, dx * dx + dy * dy);
      const r   = Math.sqrt(rSq);
      const a   = 0.2 * p.mass / rSq;
      gx += a * dx / r; gy += a * dy / r;
    }
    return { x: gx, y: gy };
  }

  _numTrials(turn) {
    // Ramp up trials after turn 8 (bots learn the map over time)
    return turn >= 8 ? this.times : Math.max(2, Math.floor(this.times / 4));
  }

  _findBestShot(station, target, gameState, trials) {
    const opts = {
      stepSize:    this.stepSize,
      simSteps:    this.simSteps,
      useWormholes: this._useWormholes(gameState),
    };

    const mem = this._mem.get(`${station.id}-${target.id}`);
    let bA = mem ? mem.angle : Math.floor(Math.random() * 360);
    let bP = mem ? mem.power : Math.floor(Math.random() * 600) + 200;
    let bD = this.physics.simulate(bA, bP, station, target, gameState.planets, opts);

    for (let t = 1; t < trials; t++) {
      // Fine-tune when close, explore broadly when far
      const aSpread = bD < target.radius * 4 ? 12 : 65;
      const pSpread = bD < target.radius * 4 ? 50 : 220;
      const a = Math.round((bA + (Math.random() - 0.5) * aSpread + 360) % 360);
      const p = Math.max(1, Math.min(800, Math.round(bP + (Math.random() - 0.5) * pSpread)));
      const d = this.physics.simulate(a, p, station, target, gameState.planets, opts);
      if (d < bD) { bD = d; bA = a; bP = p; }
    }

    return { angle: bA, power: bP, closestDist: bD };
  }

  _selectTarget(station, gameState) {
    const enemies = gameState.teams
      .filter(t => t !== station.team && t.isAlive)
      .flatMap(t => t.stations.filter(s => s.status === 'active'));
    return enemies.length ? enemies[Math.floor(Math.random() * enemies.length)] : null;
  }

  _shouldHyperspace(_station, _target, _gs, _dist) {
    return Math.random() < this.hyperProb;
  }
}

// ── CleverBot ──────────────────────────────────────────────────────────────────

export class CleverBot extends SimBot {
  constructor(physics) { super(3, physics); }

  get stepSize()  { return 10; }
  get simSteps()  { return 800; }
  get times()     { return 8; }
  get hyperProb() { return 0.11; }

  _chooseMoveVelocity(station, gameState) {
    if (Math.random() >= 0.35) return null;
    const g   = SimBot._netGravity(station.position, gameState.planets);
    const mag = Math.sqrt(g.x * g.x + g.y * g.y);
    if (mag < 0.0001) return null;
    const speed = 0.008 + Math.random() * 0.012;
    return { x: -g.x / mag * speed, y: -g.y / mag * speed };
  }
}

AIController.register(3, CleverBot);
