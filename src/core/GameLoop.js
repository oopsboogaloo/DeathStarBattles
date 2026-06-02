import { Vec2 }                       from './Vec2.js';
import { GameMode }                    from './GameState.js';
import { Bullet, BulletStatus }        from '../entities/Bullet.js';
import { PRINT_EVERY, SHOW_EVERY, TIMESTEP, BULLET_LIFE } from '../physics/PhysicsEngine.js';
import { Planet, PlanetType, ShadingStyle } from '../entities/Planet.js';
import { Collectable, WeaponId } from '../entities/Collectable.js';

// Physics steps per rAF frame for each speed setting.
// Normal reduced by 30% from original; Very Slow = ¼×, Very Fast = 4×.
export const SPEED_STEPS = { verySlow: 11, slow: 21, normal: 42, fast: 84, veryFast: 168 };

export class GameLoop {
  constructor({ gameState, physics, renderer, rng, speed = 'normal', performance = 'full' }) {
    this.gs           = gameState;
    this.physics      = physics;
    this.renderer     = renderer;
    this.rng          = rng;
    this._speedSteps  = SPEED_STEPS[speed] ?? SPEED_STEPS.normal;
    this._performance = performance;

    this._rafId           = null;
    this._paused          = false;
    this._oneStep         = false;   // step one frame then re-pause (O key)
    this._turnOrder       = [];      // active stations for this turn, in order
    this._turnIdx         = 0;
    this._resultsTimer    = 0;
    this._fastFwdPrevSpeed = null;   // non-null when Fast FWD is active

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
    this._advancePulsars(); // always animate pulsars regardless of game phase
    switch (this.gs.mode) {
      case GameMode.AIMING:
        this._advanceAiming();
        break;
      case GameMode.FIRING:
        this._rotateAsteroids();
        this._advanceFiring();
        break;
      case GameMode.RESULTS:
        this._rotateAsteroids();
        this._advanceResults();
        break;
      // GAMEOVER: no advance — waits for external restart
    }
  }

  // Advance pulsar phase each rAF frame (wall-clock timing, ~1/60 s per frame).
  // Emits new pressure pulses and advances/expires existing ones.
  _advancePulsars() {
    const dt            = 1 / 60;
    const PULSE_DURATION = 1.5; // seconds for a pulse to fully expand
    for (const planet of this.gs.planets) {
      if (!planet.pulsarPulses) continue;
      planet.pulsarPhase += dt;
      if (planet.pulsarPhase >= planet.pulsarPeriod) {
        planet.pulsarPhase -= planet.pulsarPeriod;
        planet.pulsarPulses.push({ t: 0 });
      }
      const dtFrac = dt / PULSE_DURATION;
      for (const pulse of planet.pulsarPulses) pulse.t += dtFrac;
      planet.pulsarPulses = planet.pulsarPulses.filter(p => p.t < 1);
    }
  }

  // Advance asteroid rotation once per rAF frame and refresh cached world-space verts.
  _rotateAsteroids() {
    for (const planet of this.gs.planets) {
      if (!planet.vertices || planet.rotationSpeed === 0) continue;
      planet.rotation = (planet.rotation + planet.rotationSpeed) % (2 * Math.PI);
      this._computeRotatedVerts(planet);
    }
  }

  // Compute and cache world-space rotated vertices from unit-radius vertex offsets.
  _computeRotatedVerts(planet) {
    const cos = Math.cos(planet.rotation);
    const sin = Math.sin(planet.rotation);
    const px  = planet.position.x;
    const py  = planet.position.y;
    const r   = planet.radius;
    planet._rotatedVerts = planet.vertices.map(v => new Vec2(
      px + r * (v.x * cos - v.y * sin),
      py + r * (v.x * sin + v.y * cos),
    ));
  }

  // Seed the rotated-verts cache at startup so the first frame has valid data.
  _initAsteroidVerts() {
    for (const planet of this.gs.planets) {
      if (planet.vertices) this._computeRotatedVerts(planet);
    }
  }

  // ─── Comet movement ──────────────────────────────────────────────────────────

  // G used for comet self-movement is 5% of the main G, making comets weakly attracted.
  // Their gravitational pull ON projectiles and stations uses normal G (they are in gs.planets).
  static COMET_G_FACTOR = 0.05;

  _stepComets() {
    const G_EFF = 0.2 * GameLoop.COMET_G_FACTOR; // 0.01
    for (const comet of this.gs.planets) {
      if (comet.type !== PlanetType.COMET || comet.destroyed || !comet.velocity) continue;

      let ax = 0, ay = 0;
      for (const planet of this.gs.planets) {
        if (planet === comet || planet.destroyed || planet.type === PlanetType.COMET) continue;
        const dx  = planet.position.x - comet.position.x;
        const dy  = planet.position.y - comet.position.y;
        const rSq = Math.max(1, dx * dx + dy * dy);
        const r   = Math.sqrt(rSq);
        const a   = G_EFF * planet.mass / rSq;
        ax += (dx / r) * a;
        ay += (dy / r) * a;
      }

      comet.velocity = new Vec2(
        comet.velocity.x + ax * TIMESTEP,
        comet.velocity.y + ay * TIMESTEP,
      );
      comet.position = new Vec2(
        comet.position.x + comet.velocity.x * TIMESTEP,
        comet.position.y + comet.velocity.y * TIMESTEP,
      );

      // Check comet-planet collision (gas giants pass through)
      for (const planet of this.gs.planets) {
        if (planet === comet || planet.destroyed || planet.type === PlanetType.COMET) continue;
        if (planet.type === PlanetType.GAS_GIANT) continue;
        const d = comet.position.distanceTo(planet.position);
        if (d < planet.impactRadius + comet.impactRadius) {
          comet.destroyed = true;
          break;
        }
      }

      if (comet.destroyed) continue;

      // Check comet-station collision — destroys both
      for (const station of this.gs.allStations) {
        if (station.status !== 'active') continue;
        const d = comet.position.distanceTo(station.position);
        if (d < comet.impactRadius + station.radius) {
          comet.destroyed    = true;
          station.status     = 'exploding';
          station.explosionT = 0;
          this._spawnStationExplosion(station);
          break;
        }
      }
    }
  }

  // ─── Asteroid fragmentation ──────────────────────────────────────────────────

  // ─── Station movement ────────────────────────────────────────────────────────

  // Base station speed (game-units/timestep). Fast and Rocket tiers multiply this.
  static MAX_STATION_SPEED     = 0.015;
  static STATION_SPEED_MULT    = { glacial: 1, slow: 1, normal: 1, fast: 2, rocket: 3 };
  static NORMAL_STATION_RADIUS = 6.4;  // LARGE — reference for movement distance scaling
  static LETHAL_PLANET_TYPES   = new Set([
    PlanetType.STAR, PlanetType.BLACK_HOLE, PlanetType.WHITE_DWARF,
    PlanetType.PULSAR, PlanetType.WHITE_HOLE,
  ]);

  // Max speed (game-units/timestep) for the current movement tier.
  _maxSpeedForMovement() {
    const mult = GameLoop.STATION_SPEED_MULT[this.gs.movementSpeed] ?? 1;
    return GameLoop.MAX_STATION_SPEED * mult;
  }

  // Max distance (game units) a station may travel this turn, scaled for sub-normal sizes.
  _getMaxMoveDist(station) {
    const CAPS = { glacial: 1, slow: 2, normal: 3, fast: 5, rocket: 8 };
    const mult = CAPS[this.gs.movementSpeed] ?? 0;
    if (!mult) return 0;
    const refDiam = GameLoop.NORMAL_STATION_RADIUS * 2;
    const scale   = station.radius < GameLoop.NORMAL_STATION_RADIUS
      ? station.radius / GameLoop.NORMAL_STATION_RADIUS : 1;
    return mult * refDiam * scale;
  }

  // Move all stations one physics step and check for collisions.
  _stepStations(allStations) {
    const { gw, gh } = this.physics;

    // ── Position update + distance cap ──────────────────────────────────────
    for (const station of allStations) {
      if (station.status !== 'active' || !station.velocity) continue;
      const r  = station.radius;
      let vx = station.velocity.x;
      let vy = station.velocity.y;

      // Consume from remaining distance budget; stop if exhausted
      const stepDist = Math.hypot(vx, vy) * TIMESTEP;
      const rem      = (station._moveDistRemaining ?? 0) - stepDist;
      station._moveDistRemaining = Math.max(0, rem);
      const fraction = rem >= 0 ? 1 : 1 + rem / stepDist; // partial last step

      let x = station.position.x + vx * TIMESTEP * fraction;
      let y = station.position.y + vy * TIMESTEP * fraction;

      if (station._moveDistRemaining <= 0) station.velocity = null;

      // Reflect off play area boundaries
      if (x < r)      { x = r;      vx =  Math.abs(vx); }
      if (x > gw - r) { x = gw - r; vx = -Math.abs(vx); }
      if (y < r)      { y = r;      vy =  Math.abs(vy); }
      if (y > gh - r) { y = gh - r; vy = -Math.abs(vy); }

      station.position = new Vec2(x, y);
      if (station.velocity && (vx !== station.velocity.x || vy !== station.velocity.y)) {
        station.velocity = new Vec2(vx, vy);
      }
    }

    // ── Planet collisions ────────────────────────────────────────────────────
    for (const station of allStations) {
      if (station.status !== 'active') continue;
      for (const planet of this.gs.planets) {
        if (planet.destroyed || planet.type === PlanetType.GAS_GIANT || planet.type === PlanetType.COMET) continue;
        const d = station.position.distanceTo(planet.position);
        if (d >= planet.impactRadius + station.radius) continue;

        if (this._isWormhole(planet.type)) {
          this._teleportStation(station, planet);
        } else if (GameLoop.LETHAL_PLANET_TYPES.has(planet.type)) {
          station.status     = 'exploding';
          station.explosionT = 0;
          this._spawnStationExplosion(station);
        } else {
          // Elastic bounce — reflect velocity off planet surface normal
          const safeD = Math.max(d, 0.001);
          const nx    = (station.position.x - planet.position.x) / safeD;
          const ny    = (station.position.y - planet.position.y) / safeD;
          const vel   = station.velocity ?? new Vec2(0, 0);
          const dot   = vel.x * nx + vel.y * ny;
          const rvx   = vel.x - 2 * dot * nx;
          const rvy   = vel.y - 2 * dot * ny;
          const safe  = planet.impactRadius + station.radius + 0.5;
          station.position = new Vec2(planet.position.x + nx * safe, planet.position.y + ny * safe);
          station.velocity = new Vec2(rvx, rvy);
          // Asteroids are destroyed on contact
          if (planet.type === PlanetType.ASTEROID) {
            planet.destroyed = true;
            this._spawnAsteroidExplosion(planet);
          }
        }
        break;
      }
    }

    // ── Station-station collisions ───────────────────────────────────────────
    for (let i = 0; i < allStations.length; i++) {
      for (let j = i + 1; j < allStations.length; j++) {
        const a = allStations[i], b = allStations[j];
        if (a.status !== 'active' || b.status !== 'active') continue;
        if (!a.velocity && !b.velocity) continue;
        if (a.position.distanceSqTo(b.position) < (a.radius + b.radius) ** 2) {
          a.status = b.status = 'exploding';
          a.explosionT = b.explosionT = 0;
          this._spawnStationExplosion(a);
          this._spawnStationExplosion(b);
        }
      }
    }
  }

  _isWormhole(type) {
    return type === PlanetType.WORMHOLE_PAIRED
        || type === PlanetType.WORMHOLE_CYCLIC
        || type === PlanetType.WORMHOLE_RANDOM
        || type === PlanetType.WORMHOLE_NETWORK
        || type === PlanetType.WORMHOLE_PLANET
        || type === PlanetType.WORMHOLE_SELF;
  }

  _teleportStation(station, planet) {
    const { gw, gh } = this.physics;
    const sr = station.radius;
    switch (planet.type) {
      case PlanetType.WORMHOLE_PAIRED:
      case PlanetType.WORMHOLE_CYCLIC:
        if (planet.partner) {
          const dest  = planet.partner;
          const angle = Math.atan2(
            station.position.y - planet.position.y,
            station.position.x - planet.position.x,
          );
          station.position = new Vec2(
            dest.position.x + Math.cos(angle) * (dest.impactRadius + sr + 2),
            dest.position.y + Math.sin(angle) * (dest.impactRadius + sr + 2),
          );
        }
        break;
      case PlanetType.WORMHOLE_SELF:
        station.position = new Vec2(
          planet.position.x + (station.position.x - planet.position.x) * -1,
          planet.position.y + (station.position.y - planet.position.y) * -1,
        );
        break;
      case PlanetType.WORMHOLE_PLANET: {
        const dest  = this.gs.planets[Math.floor(Math.random() * this.gs.planets.length)];
        const angle = Math.random() * Math.PI * 2;
        station.position = new Vec2(
          dest.position.x + Math.cos(angle) * (dest.impactRadius + sr + 2),
          dest.position.y + Math.sin(angle) * (dest.impactRadius + sr + 2),
        );
        break;
      }
      case PlanetType.WORMHOLE_NETWORK: {
        const others = this.gs.planets.filter(p => p !== planet && p.type === PlanetType.WORMHOLE_NETWORK && !p.destroyed);
        const dest   = others.length > 0 ? others[Math.floor(Math.random() * others.length)] : null;
        if (dest) {
          const angle = Math.random() * Math.PI * 2;
          station.position = new Vec2(
            dest.position.x + Math.cos(angle) * (dest.impactRadius + sr + 2),
            dest.position.y + Math.sin(angle) * (dest.impactRadius + sr + 2),
          );
        } else {
          station.position = new Vec2(Math.random() * gw, Math.random() * gh);
        }
        break;
      }
      default:
        // WORMHOLE_RANDOM: random map position
        station.position = new Vec2(Math.random() * gw, Math.random() * gh);
        break;
    }
    // Clamp to map bounds
    station.position = new Vec2(
      Math.max(sr, Math.min(gw - sr, station.position.x)),
      Math.max(sr, Math.min(gh - sr, station.position.y)),
    );
  }

  // Clear velocity on all stations at start of each new turn.
  _clearStationVelocities() {
    for (const s of this.gs.allStations) { s.velocity = null; s._moveDistRemaining = 0; }
  }

  // Human API — toggle movement targeting mode
  humanStartMove() {
    if (!this.gs.stationMovement || !this.gs.waitingForInput) return;
    this.gs.waitingForMove = !this.gs.waitingForMove;
  }

  // Human API — called by InputHandler with canvas coords when waitingForMove
  humanSetMove(gameX, gameY) {
    if (!this.gs.waitingForMove) return;
    const station = this.gs.activeStation;
    if (!station) return;
    const dx  = gameX - station.position.x;
    const dy  = gameY - station.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) { station.velocity = null; this.gs.waitingForMove = false; return; }
    const speed = Math.min(this._maxSpeedForMovement(), dist * 0.002);
    station.velocity = new Vec2(dx / dist * speed, dy / dist * speed);
    station._moveDistRemaining = this._getMaxMoveDist(station);
    this.gs.waitingForMove = false;
  }

  // Compute net gravity vector at a position (for AI movement decisions)
  _gravityAt(position) {
    let gx = 0, gy = 0;
    for (const planet of this.gs.planets) {
      const dx  = planet.position.x - position.x;
      const dy  = planet.position.y - position.y;
      const rSq = Math.max(1, dx * dx + dy * dy);
      const a   = 0.2 * planet.mass / rSq; // G=0.2
      const r   = Math.sqrt(rSq);
      gx += a * dx / r;
      gy += a * dy / r;
    }
    return { x: gx, y: gy };
  }

  // AI movement: move away from the net gravity gradient with given probability.
  _aiMoveAwayFromGravity(station, prob) {
    if (Math.random() >= prob) return null;
    const g    = this._gravityAt(station.position);
    const mag  = Math.sqrt(g.x * g.x + g.y * g.y);
    if (mag < 0.0001) return null;
    const maxSpd = this._maxSpeedForMovement();
    const speed  = maxSpd * (0.5 + this.rng.next());
    return new Vec2(-g.x / mag * speed, -g.y / mag * speed);
  }

  // Grey wormhole split: physics already teleported the bullet to exit B.
  // Spawn plain copies at any remaining exits (C, D...), same as if each were
  // a separate paired wormhole. No special flags — normal wormhole rules apply.
  _processGreySplits() {
    const triggers = this.gs.activeBullets.filter(b => b._greySplitExtras);
    if (!triggers.length) return;

    const bulletCap = 120;

    for (const trigger of triggers) {
      const extras = trigger._greySplitExtras;
      delete trigger._greySplitExtras;

      for (const exit of extras) {
        if (this.gs.activeBullets.length >= bulletCap) break;
        const angle = Math.random() * Math.PI * 2;
        const ir    = exit.impactRadius ?? exit.radius;
        const spawn = new Bullet({
          owner:    trigger.owner,
          position: new Vec2(
            exit.position.x + Math.cos(angle) * (ir + 0.5),
            exit.position.y + Math.sin(angle) * (ir + 0.5),
          ),
          velocity: new Vec2(trigger.velocity.x, trigger.velocity.y),
        });
        spawn.teleportCount = trigger.teleportCount;
        // Match trigger's remaining life (physics already halved it)
        const triggerUsed  = trigger.trail.length + (trigger._trailStart ?? 0);
        spawn._trailStart  = Math.max(0, triggerUsed - 1);
        spawn.trail.push(new Vec2(spawn.position.x, spawn.position.y));
        this.gs.activeBullets.push(spawn);
      }
    }
  }

  // Remove destroyed asteroids/comets; asteroids may produce child fragments.
  _processAsteroidFragments() {
    const children = [];
    for (let i = this.gs.planets.length - 1; i >= 0; i--) {
      const p = this.gs.planets[i];
      if (!p.destroyed) continue;
      this.gs.planets.splice(i, 1);
      if (p.type === PlanetType.COMET) {
        this._spawnCometExplosion(p);
      } else {
        children.push(...this._fragmentAsteroid(p));
        this._spawnAsteroidExplosion(p);
      }
    }
    if (children.length) this.gs.planets.push(...children);
  }

  // Return 2–4 child asteroid planets placed inside the parent bounding circle.
  // Returns [] if the parent is too small to fragment.
  _fragmentAsteroid(parent) {
    const MIN_RADIUS = 10;
    if (parent.radius < MIN_RADIUS) return [];

    const n      = 2 + Math.floor(this.rng.next() * 3); // 2, 3, or 4
    const factor = n === 2 ? 0.42 : n === 3 ? 0.35 : 0.30;
    const childR = parent.radius * factor;
    const maxDist = parent.radius - childR; // max center offset so child fits inside

    const centers = [];
    for (let i = 0; i < n; i++) {
      let placed = false;
      for (let attempt = 0; attempt < 120; attempt++) {
        const angle = this.rng.next() * Math.PI * 2;
        const dist  = Math.sqrt(this.rng.next()) * maxDist; // uniform-in-disk sampling
        const cx    = parent.position.x + Math.cos(angle) * dist;
        const cy    = parent.position.y + Math.sin(angle) * dist;
        const minSep = 2 * childR;
        if (centers.every(c => (cx - c.x) ** 2 + (cy - c.y) ** 2 >= minSep * minSep)) {
          centers.push({ x: cx, y: cy });
          placed = true;
          break;
        }
      }
      if (!placed) break; // give up on remaining children if placement fails
    }

    return centers.map(c => this._makeChildAsteroid(new Vec2(c.x, c.y), childR, parent.density));
  }

  // Create a single child asteroid planet with fresh polygon and rotated-verts cache.
  _makeChildAsteroid(position, radius, density) {
    const n        = 6 + Math.floor(this.rng.next() * 5);
    const vertices = this._randomAsteroidVerts(n);
    const rotation = this.rng.next() * Math.PI * 2;
    const speed    = (0.1 + this.rng.next() * this.rng.next() * 0.7) * Math.PI / 180;

    const planet = new Planet({
      position, radius, density,
      type:          PlanetType.ASTEROID,
      colour:        [120, 80, 10],
      shading:       ShadingStyle.ROCKY,
      vertices, rotation, rotationSpeed: speed,
    });

    // Pre-compute rotated verts so rendering and collision are correct immediately
    this._computeRotatedVerts(planet);
    return planet;
  }

  // Generate N unit-radius polygon vertex offsets (same algorithm as ScenarioFactory).
  _randomAsteroidVerts(n) {
    const verts = [];
    for (let i = 0; i < n; i++) {
      const base  = (2 * Math.PI * i) / n;
      const angle = base + (this.rng.next() - 0.5) * (Math.PI / n) * 1.2;
      const r     = 0.55 + this.rng.next() * 0.45;
      verts.push(new Vec2(r * Math.cos(angle), r * Math.sin(angle)));
    }
    return verts;
  }

  // ─── AIMING ─────────────────────────────────────────────────────────────────

  _startTurn() {
    if (this._fastFwdPrevSpeed !== null) {
      this._speedSteps      = this._fastFwdPrevSpeed;
      this._fastFwdPrevSpeed = null;
    }
    this._turnOrder = this.gs.allStations.filter(s => s.status === 'active');
    this._turnIdx   = 0;
    this.gs.waitingForInput = false;
    this.gs.waitingForMove  = false;
    this.gs.mode = GameMode.AIMING;
    for (const s of this._turnOrder) s.selectedWeapon = WeaponId.CANNON;
    if (this.gs.stationMovement) this._clearStationVelocities();
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
        station.angle = action.angle;
        station.power = action.power;
        // Support both new weapon field and legacy hyperspace bool
        if (action.weapon) {
          station.selectedWeapon = action.weapon;
        } else {
          station.selectedWeapon = action.hyperspace ? WeaponId.HYPERSPACE : WeaponId.CANNON;
        }
        const vel = this.gs.stationMovement ? (action.velocity ?? null) : null;
        station.velocity = vel;
        if (vel) station._moveDistRemaining = this._getMaxMoveDist(station);
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
      if (station.hyperspaceQueued) continue; // will teleport after firing phase

      const isTriple = station.selectedWeapon === WeaponId.TRIPLE_CANNON &&
                       station.team.spendStock(WeaponId.TRIPLE_CANNON);

      if (isTriple) {
        // Muzzle flash VFX
        this.gs.vfxList.push({
          type: 'tripleCannonMuzzle',
          x: station.position.x, y: station.position.y,
          angle: station.angle, colour: station.team.colour,
          t: 0, duration: 0.25,
        });
        // Three bullets at angle -5, 0, +5
        for (const dAngle of [-5, 0, 5]) {
          const a = ((station.angle + dAngle) % 360 + 360) % 360;
          const { position, velocity } = this.physics.initialState(a, station.power, station);
          const bullet = new Bullet({ owner: station, position, velocity });
          bullet.trail.push(new Vec2(position.x, position.y));
          this.gs.activeBullets.push(bullet);
        }
      } else {
        const { position, velocity } = this.physics.initialState(
          station.angle, station.power, station,
        );
        const bullet = new Bullet({ owner: station, position, velocity });
        bullet.trail.push(new Vec2(position.x, position.y));
        this.gs.activeBullets.push(bullet);
      }

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
        if (hit) {
          this._resolveStationHit(bullet, hit);
        } else {
          for (const _s of this.physics.checkNearMisses(bullet, allStations))
            bullet.owner.stats.nearMisses++;
        }

        // Collectable collision — bullet passes through, collectable destroyed
        const hitCollectable = this.physics.checkCollectableCollision(bullet, this.gs.collectables);
        if (hitCollectable) {
          hitCollectable.alive = false;
          bullet.owner.team.addStock(WeaponId.TRIPLE_CANNON, 3);
          this.gs.vfxList.push(this._makeCollectableShatterVFX(hitCollectable));
          const [r, g, b] = bullet.owner.team.colour;
          this.gs.vfxList.push({
            type: 'collectableGrant',
            x: hitCollectable.position.x, y: hitCollectable.position.y,
            text: 'TRIPLE CANNON', colour: `rgb(${r},${g},${b})`,
            t: 0, duration: 2.0,
          });
        }

        // Save trail as ghost the moment a bullet leaves the active state
        if (bullet.status !== BulletStatus.ACTIVE && bullet.trail.length > 1) {
          bullet.owner.lastTrail = [...bullet.trail];
        }
      }

      // Move stations one physics step (only when feature is enabled)
      if (this.gs.stationMovement) this._stepStations(allStations);

      // Move comets one physics step
      this._stepComets();
    }

    // Fragment any asteroids hit this frame (mutates gs.planets in-place)
    this._processAsteroidFragments();

    // Spawn grey-wormhole split copies before the dead-bullet filter runs
    this._processGreySplits();

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
        station.explosionT += 0.008; // 40% of original speed
        if (station.explosionT >= 1) station.status = 'dead';
      }
    }

    // Remove dead bullets
    this.gs.activeBullets = this.gs.activeBullets.filter(b => b.status !== BulletStatus.DEAD);

    // Clean up destroyed collectables and advance VFX
    this.gs.collectables = this.gs.collectables.filter(c => c.alive);
    this._advanceVFX();

    this._advanceExplosionEffects();

    // All resolved → RESULTS (wait for moving stations to exhaust their distance too)
    const bulletsGone    = this.gs.activeBullets.length === 0;
    const stationsMoving = this.gs.stationMovement &&
      allStations.some(s => s.status === 'active' && s.velocity);
    if (bulletsGone && !stationsMoving) {
      this._processHyperspace();
      this._checkWin();
      this._resultsTimer = 240; // ~4 s at 60 fps
      this.gs.mode = GameMode.RESULTS;
    }
  }

  // Spawn shockwave + particle burst on a newly-killed station.
  _spawnStationExplosion(station) {
    const [r, g, b] = station.colour;
    station.shockwave = { t: 0, r, g, b };
    station.particles = this._makeParticles(station.position.x, station.position.y, r, g, b, 16);
  }

  // Spawn a freestanding explosion for an asteroid (position in game units).
  _spawnAsteroidExplosion(planet) {
    const r = 139, g = 26, b = 26; // dark red
    this.gs.activeExplosions.push({
      x: planet.position.x, y: planet.position.y,
      radius: planet.radius,
      t: 0, r, g, b,
      particles: this._makeParticles(planet.position.x, planet.position.y, r, g, b, 10),
    });
  }

  // Spawn a bright white flash explosion for a destroyed comet.
  _spawnCometExplosion(comet) {
    const r = 240, g = 250, b = 255;
    this.gs.activeExplosions.push({
      x: comet.position.x, y: comet.position.y,
      radius: comet.radius * 3,
      t: 0, r, g, b,
      particles: this._makeParticles(comet.position.x, comet.position.y, r, g, b, 12),
    });
  }

  // Build N radial particles at (ox, oy) in game units.
  _makeParticles(ox, oy, r, g, b, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const angle = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.8;
      const speed = 0.8 + Math.random() * 2.2; // game units per rAF frame
      const hue   = Math.random() * 40 - 20;   // ±20 hue jitter
      out.push({
        x: ox, y: oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        t: 0,
        r: Math.min(255, Math.max(0, r + hue)),
        g: Math.min(255, Math.max(0, g + hue * 0.5)),
        b: Math.min(255, Math.max(0, b + hue * 0.2)),
      });
    }
    return out;
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
    this._spawnStationExplosion(target);

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
      if (bullet.teleportCount > 0)               shooter.stats.wormholeKills++;
      if (bullet.trickShotDone)                   shooter.stats.trickShotKills++;

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
      station.selectedWeapon = WeaponId.CANNON;
      const oldPos = new Vec2(station.position.x, station.position.y);
      for (let a = 0; a < 300; a++) {
        const pos = new Vec2(this.rng.next() * gw, this.rng.next() * gh);
        const clearOfPlanets = this.gs.planets.every(
          p => pos.distanceSqTo(p.position) >= (p.impactRadius + station.radius + 5) ** 2,
        );
        const clearOfStations = this.gs.allStations.every(
          s => s === station || s.status !== 'active' ||
               pos.distanceSqTo(s.position) >= (station.radius + s.radius + 5) ** 2,
        );
        if (clearOfPlanets && clearOfStations) {
          station.position        = pos;
          station.hyperspaceFlash = { t: 0, oldPos, newPos: new Vec2(pos.x, pos.y) };
          station.stats.hyperspaceCount++;
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

  // ─── Explosion effect advancement ────────────────────────────────────────────

  _advanceExplosionEffects() {
    const DT_SW = 0.014; // shockwave expansion rate (40% of original 0.035)
    const DT_P  = 0.016; // particle fade rate (40% of original 0.04)

    // Station shockwaves + particles
    for (const station of this.gs.allStations) {
      if (station.shockwave) {
        station.shockwave.t += DT_SW;
        if (station.shockwave.t >= 1) station.shockwave = null;
      }
      if (station.particles?.length) {
        for (const p of station.particles) { p.x += p.vx; p.y += p.vy; p.t += DT_P; }
        station.particles = station.particles.filter(p => p.t < 1);
      }
    }

    // Freestanding asteroid explosions
    for (const ex of this.gs.activeExplosions) {
      ex.t += DT_SW;
      for (const p of ex.particles) { p.x += p.vx; p.y += p.vy; p.t += DT_P; }
      ex.particles = ex.particles.filter(p => p.t < 1);
    }
    this.gs.activeExplosions = this.gs.activeExplosions.filter(ex => ex.t < 1 || ex.particles.length > 0);
  }

  // ─── RESULTS ────────────────────────────────────────────────────────────────

  _advanceResults() {
    for (const station of this.gs.allStations) {
      // Finish lingering explosions
      if (station.status === 'exploding') {
        station.explosionT += 0.008; // 40% of original speed
        if (station.explosionT >= 1) station.status = 'dead';
      }
      // Advance hyperspace flash animation
      if (station.hyperspaceFlash) {
        station.hyperspaceFlash.t += 0.04;
        if (station.hyperspaceFlash.t >= 1) station.hyperspaceFlash = null;
      }
    }

    this._advanceExplosionEffects();

    this._advanceVFX();

    if (--this._resultsTimer <= 0) {
      if (this.gs.winner !== undefined) {
        this.gs.mode = GameMode.GAMEOVER;
      } else {
        this.gs.turn++;
        this.renderer.clearTrails();
        this._trySpawnCollectable();
        this._startTurn();
      }
    }
  }

  // ─── human input API (called by InputHandler in Phase 6) ────────────────────

  humanFire() {
    if (this.gs.mode !== GameMode.AIMING || !this.gs.waitingForInput) return;
    this.gs.waitingForInput = false;
    this.gs.waitingForMove  = false;
    this._turnIdx++;
    this._advanceAiming();
  }

  humanHyperspace() {
    const s = this.gs.activeStation;
    if (!s) return;
    // Build ordered weapon list for this station's team
    const weapons = [WeaponId.CANNON, WeaponId.HYPERSPACE];
    if (s.team.getStock(WeaponId.TRIPLE_CANNON) > 0) weapons.splice(1, 0, WeaponId.TRIPLE_CANNON);
    const idx = weapons.indexOf(s.selectedWeapon);
    s.selectedWeapon = weapons[(idx + 1) % weapons.length];
  }

  humanSelectWeapon(weaponId) {
    const s = this.gs.activeStation;
    if (!s) return;
    if (weaponId === WeaponId.TRIPLE_CANNON && s.team.getStock(WeaponId.TRIPLE_CANNON) <= 0) return;
    s.selectedWeapon = weaponId;
  }

  humanAngle(delta) {
    const s = this.gs.activeStation;
    if (s) s.angle = Math.round(((s.angle + delta) % 360 + 360) % 360 * 10) / 10;
  }

  humanPower(delta) {
    const s = this.gs.activeStation;
    if (s) s.power = Math.max(1, Math.min(800, s.power + delta));
  }

  humanFastFwd() {
    if (this._fastFwdPrevSpeed === null) {
      this._fastFwdPrevSpeed = this._speedSteps;
      this._speedSteps       = SPEED_STEPS.veryFast;
    }
  }

  humanSkip(aiLevel) {
    if (this.gs.mode === GameMode.GAMEOVER) return;
    const ACC = [0, 0.25, 0.42, 0.55, 0.70, 0.85];
    const acc = ACC[Math.min(5, Math.max(1, aiLevel ?? 3))];

    this.gs.activeBullets = [];

    for (let iter = 0; iter < 5000; iter++) {
      const living     = this.gs.allStations.filter(s => s.status === 'active');
      const aliveTeams = [...new Set(living.map(s => s.team))];
      if (aliveTeams.length <= 1) break;

      for (const attacker of living) {
        const enemies = this.gs.allStations.filter(
          s => s.status === 'active' && s.team !== attacker.team,
        );
        if (!enemies.length) continue;
        if (Math.random() < acc) {
          const target = enemies[Math.floor(Math.random() * enemies.length)];
          target.status = 'dead';
          attacker.stats.kills++;
          attacker.team.stats.kills++;
          attacker.team.stats.score++;
          target.team.stats.score--;
        }
      }
    }

    this._checkWin();
    this._resultsTimer = 90;
    this.gs.mode = GameMode.RESULTS;
  }

  // ─── Collectable spawning ─────────────────────────────────────────────────────────

  _trySpawnCollectable() {
    const collectables = this.gs.config?.collectables ?? 'off';
    if (collectables === 'off') return;
    if (this.gs.collectables.length >= 3) return;
    // No collectables in Hyperspace scenario (id 21)
    if (this.gs.config?.scenarioId === 21) return;

    const probMap = { rare: 0.20, normal: 0.40, common: 0.75, continuous: 1.0 };
    const prob = probMap[collectables] ?? 0;
    if (this.rng.next() > prob) return;

    const pos = this._findCollectableSpawnPos();
    if (pos) this.gs.collectables.push(new Collectable(pos));
  }

  _findCollectableSpawnPos() {
    const { gw, gh } = this.physics;
    const R = 5; // COLLECTABLE_RADIUS
    for (let i = 0; i < 200; i++) {
      const x = R + this.rng.next() * (gw - 2 * R);
      const y = R + this.rng.next() * (gh - 2 * R);
      let ok = true;

      for (const planet of this.gs.planets) {
        if (planet.destroyed) continue;
        const d = Math.hypot(x - planet.position.x, y - planet.position.y);
        if (d < planet.impactRadius + R) { ok = false; break; }
      }
      if (!ok) continue;

      for (const station of this.gs.allStations) {
        if (station.status !== 'active') continue;
        const d = Math.hypot(x - station.position.x, y - station.position.y);
        if (d < station.radius * 3 + R) { ok = false; break; }
      }
      if (!ok) continue;

      for (const collectable of this.gs.collectables) {
        if (!collectable.alive) continue;
        const d = Math.hypot(x - collectable.position.x, y - collectable.position.y);
        if (d < R * 4) { ok = false; break; }
      }
      if (!ok) continue;

      return new Vec2(x, y);
    }
    return null;
  }

  _makeCollectableShatterVFX(collectable) {
    return {
      type: 'collectableShatter',
      x: collectable.position.x, y: collectable.position.y,
      t: 0, duration: 0.6,
      shards: Array.from({ length: 10 }, () => ({
        angle: Math.random() * Math.PI * 2,
        speed: 2 + Math.random() * 6,
        length: 1 + Math.random() * 3,
      })),
    };
  }

  _advanceVFX() {
    const DT = 1 / 60;
    for (const vfx of this.gs.vfxList) vfx.t += DT / vfx.duration;
    this.gs.vfxList = this.gs.vfxList.filter(v => v.t < 1);
  }

  togglePause()  { this._paused = !this._paused; }
  stepOne()      { if (this._paused) this._oneStep = true; }
  get isPaused() { return this._paused; }
}
