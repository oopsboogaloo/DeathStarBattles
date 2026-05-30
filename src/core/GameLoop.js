import { Vec2 }                       from './Vec2.js';
import { GameMode }                    from './GameState.js';
import { Bullet, BulletStatus }        from '../entities/Bullet.js';
import { PRINT_EVERY, SHOW_EVERY }     from '../physics/PhysicsEngine.js';

// Physics steps per rAF frame for each speed setting
export const SPEED_STEPS = { slow: 30, normal: 60, fast: 120 };

export class GameLoop {
  constructor({ gameState, physics, renderer, rng, speed = 'normal' }) {
    this.gs         = gameState;
    this.physics    = physics;
    this.renderer   = renderer;
    this.rng        = rng;
    this._speedSteps = SPEED_STEPS[speed] ?? SPEED_STEPS.normal;

    this._rafId        = null;
    this._paused       = false;
    this._oneStep      = false;   // step one frame then re-pause (O key)
    this._turnOrder    = [];      // active stations for this turn, in order
    this._turnIdx      = 0;
    this._resultsTimer = 0;

    this._startTurn();
  }

  // ─── rAF driver ─────────────────────────────────────────────────────────────

  start() {
    const tick = () => {
      this._rafId = requestAnimationFrame(tick);
      if (this._paused && !this._oneStep) {
        this.renderer.drawFrame(this.gs);
        return;
      }
      this._oneStep = false;
      this._advance();
      this.renderer.drawFrame(this.gs);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  stop() {
    if (this._rafId !== null) { cancelAnimationFrame(this._rafId); this._rafId = null; }
  }

  // ─── state machine ──────────────────────────────────────────────────────────

  _advance() {
    switch (this.gs.mode) {
      case GameMode.AIMING:  this._advanceAiming();  break;
      case GameMode.FIRING:  this._advanceFiring();  break;
      case GameMode.RESULTS: this._advanceResults(); break;
      // GAMEOVER: no advance — waits for external restart
    }
  }

  // ─── AIMING ─────────────────────────────────────────────────────────────────

  _startTurn() {
    this._turnOrder = this.gs.allStations.filter(s => s.status === 'active');
    this._turnIdx   = 0;
    this.gs.waitingForInput = false;
    this.gs.mode = GameMode.AIMING;
    // Process leading AI stations immediately so first human gets the indicator
    this._advanceAiming();
  }

  _advanceAiming() {
    if (this.gs.waitingForInput) return;

    while (this._turnIdx < this._turnOrder.length) {
      const station = this._turnOrder[this._turnIdx];

      if (!station.team.isHuman) {
        let action;
        if (station.team.controller) {
          action = station.team.controller.chooseAction(station, this.gs);
        } else {
          action = {
            angle:      Math.floor(Math.random() * 360),
            power:      Math.floor(Math.random() * 700) + 100,
            hyperspace: Math.random() < 0.12,
          };
        }
        station.angle            = action.angle;
        station.power            = action.power;
        station.hyperspaceQueued = action.hyperspace ?? false;
        this._setActive(station);
        this._turnIdx++;
      } else {
        // Human — set the active indicator and wait for input
        this._setActive(station);
        this.gs.waitingForInput = true;
        return;
      }
    }

    // Every station has acted — fire
    this._fireAll();
  }

  _setActive(station) {
    this.gs.currentTeamIdx = station.team.index;
    this.gs.currentStatIdx = station.team.stations.indexOf(station);
  }

  _fireAll() {
    this.gs.activeBullets = [];
    for (const station of this._turnOrder) {
      if (station.status !== 'active') continue;
      if (station.hyperspaceQueued)    continue; // will teleport after firing phase

      const { position, velocity } = this.physics.initialState(
        station.angle, station.power, station,
      );
      const bullet = new Bullet({ owner: station, position, velocity });
      bullet.trail.push(new Vec2(position.x, position.y));
      this.gs.activeBullets.push(bullet);

      station.lastAngle = station.angle;
      station.lastPower = station.power;
      station.stats.shots++;
      station.stats.totalPower += station.power;
      station.stats.turns++;
    }
    this.gs.mode = GameMode.FIRING;
  }

  // ─── FIRING ─────────────────────────────────────────────────────────────────

  _advanceFiring() {
    const allStations   = this.gs.allStations;
    const stepsPerFrame = this._paused ? PRINT_EVERY : this._speedSteps;

    for (let i = 0; i < stepsPerFrame; i++) {
      // Physics step + trail (no explosion advancement inside the inner loop)
      for (const bullet of this.gs.activeBullets) {
        if (bullet.status !== BulletStatus.ACTIVE) continue;

        this.physics.step(bullet, this.gs.planets);

        if (bullet.lifetime % PRINT_EVERY === 0) {
          bullet.trail.push(new Vec2(bullet.position.x, bullet.position.y));
          this.renderer.appendTrailPoint(bullet);
        }

        const hit = this.physics.checkStationCollisions(bullet, allStations);
        if (hit) this._resolveStationHit(bullet, hit);

        // Save trail as ghost the moment a bullet leaves the active state
        if (bullet.status !== BulletStatus.ACTIVE && bullet.trail.length > 1) {
          bullet.owner.lastTrail = [...bullet.trail];
        }
      }
    }

    // Advance explosion animations once per rAF frame (not per physics step)
    // This keeps explosions visible for ~20–25 frames instead of < 1 frame.
    for (const bullet of this.gs.activeBullets) {
      if (bullet.status === BulletStatus.EXPLODING) {
        bullet.explosionT += 0.025;
        if (bullet.explosionT >= 1) bullet.status = BulletStatus.DEAD;
      }
    }
    for (const station of allStations) {
      if (station.status === 'exploding') {
        station.explosionT += 0.02;
        if (station.explosionT >= 1) station.status = 'dead';
      }
    }

    // Remove dead bullets
    this.gs.activeBullets = this.gs.activeBullets.filter(b => b.status !== BulletStatus.DEAD);

    // All resolved → RESULTS
    if (this.gs.activeBullets.length === 0) {
      this._processHyperspace();
      this._checkWin();
      this._resultsTimer = 240; // ~4 s at 60 fps
      this.gs.mode = GameMode.RESULTS;
    }
  }

  _resolveStationHit(bullet, target) {
    bullet.status = BulletStatus.EXPLODING;
    if (target.status !== 'active') return;

    // Capture pre-kill state for kill-type classification
    const aliveTeams = this.gs.aliveTeams;
    const scores     = aliveTeams.map(t => t.stats.score);
    const maxScore   = Math.max(...scores);
    const minScore   = Math.min(...scores);
    const staCounts  = aliveTeams.map(t => t.stations.filter(s => s.status === 'active').length);
    const maxSta     = Math.max(...staCounts);
    const minSta     = Math.min(...staCounts);
    const targetSta  = target.team.stations.filter(s => s.status === 'active').length;

    target.status     = 'exploding';
    target.explosionT = 0;

    const shooter = bullet.owner;
    target.stats.killedBy = shooter;

    if (shooter.team === target.team) {
      if (shooter === target) {
        shooter.stats.suicides++;
        shooter.team.stats.suicides++;
      } else {
        shooter.stats.ownGoals++;
        shooter.team.stats.ownGoals++;
      }
      shooter.team.stats.score--;
    } else {
      // Kill-type classification
      if (target.team.stats.score >= maxScore)    shooter.stats.strategyKills++;
      if (target.team.stats.score <= minScore)    shooter.stats.oppressionKills++;
      if (targetSta >= maxSta)                    shooter.stats.tacticsKills++;
      if (targetSta <= minSta)                    shooter.stats.bullyKills++;

      const dist = shooter.position.distanceTo(target.position);
      if (dist > this.physics.gw * 0.6)           shooter.stats.longshotKills++;
      if (dist < this.physics.gw * 0.2)           shooter.stats.closeshotKills++;
      if (shooter.team.stats.killedBy === target) shooter.stats.vengeanceKills++;

      shooter.stats.kills++;
      shooter.team.stats.kills++;
      shooter.team.stats.score++;
      target.team.stats.killedBy = shooter; // record for future vengeance
    }
  }

  _processHyperspace() {
    const { gw, gh } = this.physics;
    for (const station of this.gs.allStations) {
      if (!station.hyperspaceQueued || station.status !== 'active') continue;
      station.hyperspaceQueued = false;
      const oldPos = new Vec2(station.position.x, station.position.y);
      for (let a = 0; a < 300; a++) {
        const pos = new Vec2(this.rng.next() * gw, this.rng.next() * gh);
        const clear = this.gs.planets.every(
          p => pos.distanceSqTo(p.position) >= (p.impactRadius + station.radius + 5) ** 2,
        );
        if (clear) {
          station.position      = pos;
          station.hyperspaceFlash = { t: 0, oldPos, newPos: new Vec2(pos.x, pos.y) };
          break;
        }
      }
    }
  }

  _checkWin() {
    const alive = this.gs.aliveTeams;
    if (alive.length <= 1) {
      this.gs.winner = alive[0] ?? null;
      for (const s of this.gs.allStations) {
        if (s.status === 'active') s.stats.survived = 1;
      }
    }
  }

  // ─── RESULTS ────────────────────────────────────────────────────────────────

  _advanceResults() {
    for (const station of this.gs.allStations) {
      // Finish lingering explosions
      if (station.status === 'exploding') {
        station.explosionT += 0.02;
        if (station.explosionT >= 1) station.status = 'dead';
      }
      // Advance hyperspace flash animation
      if (station.hyperspaceFlash) {
        station.hyperspaceFlash.t += 0.04;
        if (station.hyperspaceFlash.t >= 1) station.hyperspaceFlash = null;
      }
    }

    if (--this._resultsTimer <= 0) {
      if (this.gs.winner !== undefined) {
        this.gs.mode = GameMode.GAMEOVER;
      } else {
        this.gs.turn++;
        this.renderer.clearTrails();
        this._startTurn();
      }
    }
  }

  // ─── human input API (called by InputHandler in Phase 6) ────────────────────

  humanFire() {
    if (this.gs.mode !== GameMode.AIMING || !this.gs.waitingForInput) return;
    this.gs.waitingForInput = false;
    this._turnIdx++;
    this._advanceAiming();
  }

  humanHyperspace() {
    const s = this.gs.activeStation;
    if (s) s.hyperspaceQueued = !s.hyperspaceQueued;
  }

  humanAngle(delta) {
    const s = this.gs.activeStation;
    if (s) s.angle = ((s.angle + delta) % 360 + 360) % 360;
  }

  humanPower(delta) {
    const s = this.gs.activeStation;
    if (s) s.power = Math.max(1, Math.min(800, s.power + delta));
  }

  togglePause()  { this._paused = !this._paused; }
  stepOne()      { if (this._paused) this._oneStep = true; }
  get isPaused() { return this._paused; }
}
