// Copyright © 2026 Chloe Bolland
// contact chloe@mammoththoughts.com if you wish to use, publish or reproduce this game or any part of it in any way

import { Vec2 }                       from './Vec2.js';
import { GameMode }                    from './GameState.js';
import { SoundManager }               from '../audio/SoundManager.js';
import { Bullet, BulletStatus }        from '../entities/Bullet.js';
import { PhysicsEngine, PRINT_EVERY, SHOW_EVERY, TIMESTEP, BULLET_LIFE, G,
         SKIM_PARTICLE_DURATION, FRAG_BOUNCE_RETENTION, PULSE_MAX_R } from '../physics/PhysicsEngine.js';
import { Planet, PlanetType, ShadingStyle, isUnstable, UNSTABLE_GLOW } from '../entities/Planet.js';
import { Ejecta, EjectaKind }              from '../entities/Ejecta.js';
import { Collectable, WeaponId, WEAPON_GRANTS } from '../entities/Collectable.js';
import { Rocket, RocketStatus, ROCKET_BASE_MASS, ROCKET_THRUST, ROCKET_FUEL_BURN_RATE,
         ROCKET_MIN_FUEL, ROCKET_MAX_FUEL, ROCKET_LAUNCH_SPEED,
         ROCKET_BLAST_RADIUS, ROCKET_HITBOX_RADIUS } from '../entities/Rocket.js';
import { IceRing, ICE_RING_MAX_RADIUS, ICE_RING_LIFETIME } from '../entities/IceRing.js';
import { Station, StationSize }            from '../entities/Station.js';
import { Team }                            from '../entities/Team.js';
import { AIController }                    from '../ai/AIController.js';

// Physics steps per rAF frame for each speed setting.
// Normal reduced by 30% from original; Very Slow = ¼×, Very Fast = 4×.
export const SPEED_STEPS = { verySlow: 11, slow: 21, normal: 42, fast: 84, veryFast: 168 };

// ── Unstable-planet eruption tuning (spec/unstable-planets-spec.md §9) ────────
// Ejecta are stepped once per physics sub-step (like bullets), so lifetimes are
// in steps, not frames — bullets live tens of thousands of steps to cross the map.
const EJECTA_COUNT_MIN        = 5;
const EJECTA_COUNT_MAX        = 7;
const EJECTA_SPREAD_DEG       = 25;   // max angular offset from the surface normal
const EJECTA_MIN_FRAC         = 0.65; // pyro/cryo speed as a fraction of escape velocity
const EJECTA_MAX_FRAC         = 0.95; // (below 1 → arcs back under gravity)
const EJECTA_VELOCITY_FACTOR  = 0.60; // launch slower → slow, dramatic blobs
const EJECTA_GRAVITY_FACTOR   = 0.18; // pyro/cryo feel ~18% of gravity → blobs arc back into the fray
const EJECTA_MAX_RADIUS       = 6.0;  // grown blob size (≈ a Large station radius)
const EJECTA_GROW_STEPS       = 90;   // steps to grow from 0 → full (fast then slows)
const ERUPTION_STAGGER_STEPS  = 300;  // max random per-particle launch delay (~0.18s)
// Drawn-out eruption choreography (pyro/cryo): a build-up of escalating cosmetic
// mini-bursts with the lethal ejecta released in 1 → 2–3 → 1–2 waves.
const ERUPTION_DURATION_STEPS = 9000; // gen-0 sequence length (~3.6s) — long, slow rumble
const ERUPTION_MINI_MIN_GAP   = 26;   // min steps between mini-bursts (denser rumble)
const ERUPTION_MINI_MAX_GAP   = 100;  // max steps between mini-bursts (random → overlapping)
const ERUPTION_DEBRIS_LIFE    = 840;  // cosmetic debris lifetime (steps) — long-lingering rumble
const ERUPTION_DEBRIS_GRAV    = 0.167; // debris feel ~17% gravity (0.5 ÷ 3) — float more
const MAX_ERUPTION_DEBRIS     = 600;  // global cosmetic-debris cap (raised for the longer life)
const EJECTA_MAX_LIFETIME     = 24000; // steps before a ballistic blob fades (slow blobs need airtime to travel)
const ELECTRO_SPEED           = 1.6;  // electro bolt speed (units/time) — fast & straight
const ELECTRO_REACH_MULT      = 3;    // electro range = this × planet radius
const MAX_EJECTA              = 30;   // global active-ejecta cap
const BEAM_CHARGE_STEPS       = 5200; // beam precursor build-up before the laser fires (~2s)
const BEAM_CALM_STEPS         = 3600; // beam particle calm-down after firing (~1.4s)
// Electro forked-lightning (grown one segment per path per rendered frame)
const LIGHTNING_SEG_LEN       = 11;   // segment length (~a regular station width)
const LIGHTNING_MAX_ANGLE     = 30;   // ± degrees a segment may turn from the previous one
const LIGHTNING_FORK_CHANCE   = 0.30; // fork chance per segment WHILE there is a single path
const LIGHTNING_FORK_MULTI    = 0.10; // fork chance per segment WHILE there are multiple paths
const LIGHTNING_END_CHANCE    = 0.05; // per-path chance to end per segment WHILE multiple paths
const LIGHTNING_MAX_SEGMENTS  = 30;   // total segment budget for a gen-0 strike
const LIGHTNING_MAX_HEADS     = 10;   // cap on simultaneously growing path heads
const LIGHTNING_HOLD_FRAMES   = 60;   // ~1s hold once fully grown
const LIGHTNING_FADE_FRAMES   = 14;   // quick fade-out
const SHOCK_BOLT_COUNT        = 15;   // Shock Rocket: forked bolts radiating from the burst
const SHOCK_BOLT_SEGMENTS     = 25;   // segment budget per Shock Rocket bolt
const SHOCK_LIGHTNING_COLOUR  = [120, 210, 255]; // bright electric blue for weapon shocks

// Mammoth Cannon tuning constants
const MAMMOTH_SIZE_MULT        = 3;     // bullet draw radius multiplier
const MAMMOTH_BLAST_MULT       = 4;     // blast radius multiplier vs standard rocket
const MAMMOTH_FRAG_COUNT       = 11;
const MAMMOTH_FRAG_SPEED_MIN   = 0.30; // fraction of MAX_CANNON_SPEED
const MAMMOTH_FRAG_SPEED_MAX   = 0.60;
const MAMMOTH_BLAST_SPEED_MULT = 0.4;  // blast expansion speed relative to normal

// Repulsor Field tuning constants
const REPULSOR_FIELD_RADIUS    = 50;   // influence radius in game units
const REPULSOR_FIELD_STRENGTH  = 5;    // multiplier vs standard rift-node repulsion

// Gravity Cannon tuning constants
const GRAVITY_CANNON_SIZE_MULT = 3;    // bullet draw radius multiplier
const GRAVITY_CANNON_MASS      = 800;  // gravitational mass exerted on nearby bullets

// Electro Stun tuning constants
const ELECTRO_STUN_BOLTS      = 5;    // forked lightning bolt count per cast
const ELECTRO_STUN_MIN_SPREAD = 5;    // spread in degrees at maximum power (focused)
const ELECTRO_STUN_MAX_SPREAD = 45;   // spread in degrees at minimum power (wide)
const ELECTRO_STUN_BASE_RANGE = 225;  // max range in game units at maximum power

// Teleport tuning constants
const TELEPORT_FIRE_STEP = 600;       // physics steps before teleport executes

// Super Laser tuning constants
const SUPER_LASER_CHARGE_STEPS  = 800;  // physics steps of charge-up before beam fires
const SUPER_LASER_BEAM_DURATION = 2.5;  // VFX duration for main beam (seconds)
const SUPER_LASER_CONV_DURATION = 0.45; // VFX duration for convergence beams (seconds)

// Mind Control Beam tuning constants
const MIND_CONTROL_DELAY_STEPS  = 1200; // physics steps of charge-up before beam fires

// Reinforcement Signal tuning constants
const REINF_SIGNAL_GRAVITY_MULT = 0.2;
const REINF_SIGNAL_SPEED_MULT   = 0.5;

// Ice Bomb — very large freeze-zone explosion (new-weapons-spec §5)
const ICE_BOMB_BLAST_RADIUS = 120;

export class GameLoop {
  get _isExperimental() { return this._performance === 'experimental' || this._performance === 'full'; }

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
    this._collectablesClaimed = false; // leftover collectables granted at game end (once)
    this._fastFwdPrevSpeed = null;   // non-null when Fast FWD is active
    this._tpResultsCb     = null;

    this._boundaryRift = this.gs.rifts?.find(r => r.isBoundary) ?? null;
    this._hasReflectiveRift = (this.gs.rifts ?? []).some(r => r.reflective);

    // TP mode: caller is responsible for calling startTP() after construction
    if (!gameState.tpGame) this._startTurn();
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
    this._advanceCollectableVFX(); // real-time fade, decoupled from sim sub-steps
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
      case GameMode.TP_AIMING:
        this._advanceTPAiming();
        break;
      case GameMode.TP_FIRING:
        this._rotateAsteroids();
        this._advanceTPFiring();
        break;
      // GAMEOVER / STORY_DIALOG / TP_RESULTS: no advance — waits for external interaction
    }
  }

  // Advance pulsar phase each rAF frame (wall-clock timing, ~1/60 s per frame).
  // Emits new pressure pulses and advances/expires existing ones.
  // Also applies outward nudge to stations when a ring sweeps through them (§4.5.2).
  _advancePulsars() {
    const dt             = 1 / 60;
    const PULSE_DURATION = 1.5;
    const RING_HALF_W    = 9;
    const movementOn     = this.gs.movementSpeed && this.gs.movementSpeed !== 'off';
    for (const planet of this.gs.planets) {
      if (!planet.pulsarPulses) continue;
      planet.pulsarPhase += dt;
      if (planet.pulsarPhase >= planet.pulsarPeriod) {
        planet.pulsarPhase -= planet.pulsarPeriod;
        planet.pulsarPulses.push({ t: 0, _nudged: new Set() });
      }
      const dtFrac = dt / PULSE_DURATION;
      for (const pulse of planet.pulsarPulses) {
        pulse.t += dtFrac;
        if (!movementOn) continue;
        if (!pulse._nudged) pulse._nudged = new Set();
        const pulseR = planet.impactRadius + (PULSE_MAX_R - planet.impactRadius) * pulse.t;
        for (const station of this.gs.allStations) {
          if (station.status !== 'active' || pulse._nudged.has(station)) continue;
          const dx = station.position.x - planet.position.x;
          const dy = station.position.y - planet.position.y;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (Math.abs(d - pulseR) >= RING_HALF_W) continue;
          pulse._nudged.add(station);
          const maxSpd  = this._maxSpeedForMovement();
          const nudge   = maxSpd * 0.2;
          const outX    = d > 0.001 ? dx / d : 1;
          const outY    = d > 0.001 ? dy / d : 0;
          const cur     = station.velocity ?? new Vec2(0, 0);
          const nx      = cur.x + outX * nudge;
          const ny      = cur.y + outY * nudge;
          const spd     = Math.hypot(nx, ny);
          const capped  = spd > maxSpd ? maxSpd / spd : 1;
          station.velocity = new Vec2(nx * capped, ny * capped);
          if (!station._moveDistRemaining) station._moveDistRemaining = this._getMaxMoveDist(station);
        }
      }
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

      // Check comet-planet collision (gas giants pass through; wormholes teleport)
      for (const planet of this.gs.planets) {
        if (planet === comet || planet.destroyed || planet.type === PlanetType.COMET) continue;
        if (planet.type === PlanetType.GAS_GIANT) continue;
        const d = comet.position.distanceTo(planet.position);
        if (d >= planet.impactRadius + comet.impactRadius) continue;
        if (this._isWormhole(planet.type)) {
          this._teleportComet(comet, planet);
        } else {
          comet.destroyed = true;
        }
        break;
      }

      if (comet.destroyed) continue;

      // Check comet-station collision — comet destroyed; station is frozen (armour absorbs)
      for (const station of this.gs.allStations) {
        if (station.status !== 'active') continue;
        const d = comet.position.distanceTo(station.position);
        if (d < comet.impactRadius + station.radius) {
          comet.destroyed = true;
          if ((station.armourLayers ?? 0) > 0) {
            station.armourLayers--;
            station.armourFlash = 1.0;
          } else {
            station.frozen      = Math.min(3, (station.frozen ?? 0) + 1);
            station.frozenFlash = 1.0;
            this._notifyCondition(station, 'frozen');
          }
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

  // Segment-segment intersection test (used for rift bounce).
  _segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy) {
    const d1x = bx - ax, d1y = by - ay;
    const d2x = dx - cx, d2y = dy - cy;
    const cross = d1x * d2y - d1y * d2x;
    if (Math.abs(cross) < 1e-10) return false;
    const t = ((cx - ax) * d2y - (cy - ay) * d2x) / cross;
    const u = ((cx - ax) * d1y - (cy - ay) * d1x) / cross;
    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
  }

  // Find the nearest rift segment to a point; returns { nx, ny, segIdx, riftIdx } or null.
  _nearestRiftSegment(px, py) {
    const rifts = this.gs.rifts ?? [];
    let bestDist = Infinity, bestNx = 0, bestNy = 1;
    for (const rift of rifts) {
      const verts = rift.vertices;
      for (let i = 0; i < verts.length - 1; i++) {
        const ax = verts[i].x, ay = verts[i].y;
        const bx = verts[i+1].x, by = verts[i+1].y;
        const dx = bx - ax, dy = by - ay;
        const lenSq = dx*dx + dy*dy;
        if (lenSq < 1e-10) continue;
        const t  = Math.max(0, Math.min(1, ((px-ax)*dx + (py-ay)*dy) / lenSq));
        const cx = ax + t*dx, cy = ay + t*dy;
        const d  = Math.hypot(px-cx, py-cy);
        if (d < bestDist) {
          bestDist = d;
          const len = Math.sqrt(lenSq);
          // Left normal of segment
          bestNx = -dy / len;
          bestNy =  dx / len;
        }
      }
    }
    return bestDist < Infinity ? { nx: bestNx, ny: bestNy } : null;
  }

  // Ray-casting point-in-polygon test against a rift's vertices (treated as closed).
  _isInsideBoundaryPolygon(px, py, rift) {
    const verts = rift.vertices;
    const n = verts.length;
    let inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = verts[i].x, yi = verts[i].y;
      const xj = verts[j].x, yj = verts[j].y;
      if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi))
        inside = !inside;
    }
    return inside;
  }

  // Hard-teleport a station to just inside the nearest boundary rift segment.
  _ejectFromBoundary(station, rift) {
    const verts = rift.vertices;
    const px = station.position.x, py = station.position.y;
    let bestDist = Infinity, nearX = 0, nearY = 0;
    for (let i = 0; i < verts.length - 1; i++) {
      const ax = verts[i].x, ay = verts[i].y;
      const bx = verts[i+1].x, by = verts[i+1].y;
      const dx = bx - ax, dy = by - ay;
      const lenSq = dx*dx + dy*dy;
      if (lenSq < 1e-10) continue;
      const t  = Math.max(0, Math.min(1, ((px-ax)*dx + (py-ay)*dy) / lenSq));
      const cx = ax + t*dx, cy = ay + t*dy;
      const d  = Math.hypot(px-cx, py-cy);
      if (d < bestDist) { bestDist = d; nearX = cx; nearY = cy; }
    }
    const gcx = this.physics.gw / 2, gcy = this.physics.gh / 2;
    const inX = gcx - nearX, inY = gcy - nearY;
    const inLen = Math.hypot(inX, inY);
    const push = 15 + station.radius;
    station.position = new Vec2(nearX + (inX / inLen) * push, nearY + (inY / inLen) * push);
    station.velocity = null;
  }

  // Safety net for a reflective boundary rift: snap a bullet that slipped outside
  // back to the nearest boundary segment and reflect its velocity inward.
  _nudgeBulletInsideBoundary(bullet) {
    const rift = this._boundaryRift;
    const verts = rift.vertices;
    const px = bullet.position.x, py = bullet.position.y;
    let bestDist = Infinity, nearX = px, nearY = py, nx = 0, ny = 0;
    for (let i = 0; i < verts.length - 1; i++) {
      const ax = verts[i].x, ay = verts[i].y;
      const bx = verts[i + 1].x, by = verts[i + 1].y;
      const dx = bx - ax, dy = by - ay;
      const lenSq = dx * dx + dy * dy;
      if (lenSq < 1e-10) continue;
      const t  = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
      const cx = ax + t * dx, cy = ay + t * dy;
      const d  = Math.hypot(px - cx, py - cy);
      if (d < bestDist) {
        bestDist = d; nearX = cx; nearY = cy;
        const len = Math.sqrt(lenSq);
        nx = -dy / len; ny = dx / len;
      }
    }
    // Orient normal toward the interior (map centre) and reflect velocity inward
    const inX = this.physics.gw / 2 - nearX, inY = this.physics.gh / 2 - nearY;
    if (nx * inX + ny * inY < 0) { nx = -nx; ny = -ny; }
    bullet.position = new Vec2(nearX + nx * 1, nearY + ny * 1);
    const dot = bullet.velocity.x * nx + bullet.velocity.y * ny;
    if (dot < 0) bullet.velocity = new Vec2(bullet.velocity.x - 2 * dot * nx, bullet.velocity.y - 2 * dot * ny);
  }

  // Move all stations one physics step and check for collisions.
  _stepStations(allStations) {
    const { gw, gh } = this.physics;
    const WHITE_HOLE_PUSH_RADIUS  = 40;
    const WHITE_HOLE_PUSH_STRENGTH = 0.008; // tunable: force per unit per step
    const movementOn = this.gs.movementSpeed && this.gs.movementSpeed !== 'off';
    const rifts      = this.gs.rifts ?? [];

    // ── White hole push — apply before position update ───────────────────────
    if (movementOn) {
      const maxSpd15 = this._maxSpeedForMovement() * 1.5;
      for (const station of allStations) {
        if (station.status !== 'active') continue;
        for (const planet of this.gs.planets) {
          if (planet.destroyed || planet.type !== PlanetType.WHITE_HOLE) continue;
          const dx = station.position.x - planet.position.x;
          const dy = station.position.y - planet.position.y;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (d >= WHITE_HOLE_PUSH_RADIUS || d < 0.001) continue;
          const strength = WHITE_HOLE_PUSH_STRENGTH * (1 - d / WHITE_HOLE_PUSH_RADIUS);
          const cur  = station.velocity ?? new Vec2(0, 0);
          const nx   = cur.x + (dx / d) * strength;
          const ny   = cur.y + (dy / d) * strength;
          const spd  = Math.hypot(nx, ny);
          const cap  = spd > maxSpd15 ? maxSpd15 / spd : 1;
          station.velocity = new Vec2(nx * cap, ny * cap);
          if (!station._moveDistRemaining) station._moveDistRemaining = this._getMaxMoveDist(station);
        }
      }
    }

    // ── Position update + distance cap ──────────────────────────────────────
    for (const station of allStations) {
      if (station.status !== 'active') continue;
      if ((station.frozen ?? 0) > 0) { station.velocity = null; continue; }
      if (!station.velocity) continue;
      const r  = station.radius;
      let vx = station.velocity.x;
      let vy = station.velocity.y;

      // Consume from remaining distance budget; stop if exhausted
      const stepDist = Math.hypot(vx, vy) * TIMESTEP;
      const rem      = (station._moveDistRemaining ?? 0) - stepDist;
      station._moveDistRemaining = Math.max(0, rem);
      const fraction = rem >= 0 ? 1 : 1 + rem / stepDist; // partial last step
      if (station.stats) station.stats.distanceMoved += stepDist * Math.max(0, Math.min(1, fraction)); // Runner award (§21)

      let x = station.position.x + vx * TIMESTEP * fraction;
      let y = station.position.y + vy * TIMESTEP * fraction;

      if (station._moveDistRemaining <= 0) station.velocity = null;

      // Reflect off play area boundaries
      if (x < r)      { x = r;      vx =  Math.abs(vx); }
      if (x > gw - r) { x = gw - r; vx = -Math.abs(vx); }
      if (y < r)      { y = r;      vy =  Math.abs(vy); }
      if (y > gh - r) { y = gh - r; vy = -Math.abs(vy); }

      // Rift bounce — reflect off any rift segment the path would cross (§4.5.1)
      const ox = station.position.x, oy = station.position.y;
      for (const rift of rifts) {
        const verts = rift.vertices;
        for (let i = 0; i < verts.length - 1; i++) {
          const ax = verts[i].x, ay = verts[i].y;
          const bx = verts[i+1].x, by = verts[i+1].y;
          if (!this._segmentsIntersect(ox, oy, x, y, ax, ay, bx, by)) continue;
          // Segment normal (ensure it faces toward the incoming side)
          const sdx = bx - ax, sdy = by - ay;
          const len  = Math.hypot(sdx, sdy);
          let nx = -sdy / len, ny = sdx / len;
          if (nx * (ox - ax) + ny * (oy - ay) < 0) { nx = -nx; ny = -ny; }
          const dot = vx * nx + vy * ny;
          vx -= 2 * dot * nx;
          vy -= 2 * dot * ny;
          // Push position back to the correct side
          x = ox; y = oy;
          break;
        }
      }

      station.position = new Vec2(x, y);
      if (station.velocity && (vx !== station.velocity.x || vy !== station.velocity.y)) {
        station.velocity = new Vec2(vx, vy);
      }
    }

    // ── Wormhole Tunnel boundary ejection (safety net — bounce should handle most cases) ──
    if (this._boundaryRift) {
      for (const station of allStations) {
        if (station.status !== 'active') continue;
        if (!this._isInsideBoundaryPolygon(station.position.x, station.position.y, this._boundaryRift))
          this._ejectFromBoundary(station, this._boundaryRift);
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
          // Asteroids and crystals are destroyed on contact
          if (planet.type === PlanetType.ASTEROID) {
            planet.destroyed = true;
            this._spawnAsteroidExplosion(planet);
          } else if (planet.type === PlanetType.CRYSTAL) {
            planet.destroyed = true;
            this._spawnCrystalExplosion(planet);
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
    // ── Collectable pickup on movement contact ───────────────────────────────
    for (const station of allStations) {
      if (station.status !== 'active') continue;
      for (const c of this.gs.collectables) {
        if (!c.alive) continue;
        if (station.position.distanceSqTo(c.position) >= (station.radius + c.radius) ** 2) continue;
        c.alive = false;
        const grant = this._pickCollectableGrant();
        station.team.addStock(grant.id, grant.charges);
        this._creditCollectableStat(station, grant);
        if (this.gs.storyState && station.team.isHuman) this.gs.storyState.collectCount++;
        this.gs.vfxList.push(this._makeCollectableShatterVFX(c));
        const [cr, cg, cb] = station.team.colour;
        this.gs.vfxList.push({ type: 'collectableGrant', x: c.position.x, y: c.position.y, text: grant.label, colour: `rgb(${cr},${cg},${cb})`, t: 0, duration: 2.0 });
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
      if (p.type === PlanetType.MOON || p.type === PlanetType.GIANT_ASTEROID) {
        continue; // Moon/giant-asteroid destruction + fragmentation handled in _handleMoonHit
      } else if (p.type === PlanetType.COMET) {
        this._spawnCometExplosion(p);
      } else if (p.type === PlanetType.CRYSTAL) {
        children.push(...this._fragmentCrystalAsteroid(p));
        this._spawnCrystalExplosion(p);
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
    if (parent.radius < MIN_RADIUS) {
      // Too small to break into children, but a pure rock still pays out its bonus.
      if (parent.pure) this._spawnCollectablesNear(parent.position, parent.radius, 2 + Math.floor(this.rng.next() * 3));
      return [];
    }

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

    const collectablesOn = this.gs.config?.collectables !== 'off';
    const richProb = collectablesOn
      ? ({ off: 0, rare: 0.01, normal: 0.05, common: 0.10, abundant: 0.25, overwhelming: 1.0 }[this.gs.config?.richAsteroids] ?? 0.05)
      : 0;

    const spawnedCollectable = parent.rich && collectablesOn && centers.length > 0;
    if (spawnedCollectable) {
      const col = new Collectable(new Vec2(centers[0].x, centers[0].y));
      col.radius = this._collectableRadius();
      this.gs.collectables.push(col);
    }

    // Pure rock: drop 2-4 collectables on top of the standard rich payout above.
    if (parent.pure) this._spawnCollectablesNear(parent.position, parent.radius, 2 + Math.floor(this.rng.next() * 3));

    // Skip centers[0] if a collectable replaced that fragment slot
    return centers.slice(spawnedCollectable ? 1 : 0).map(c => {
      // Pure parents always shatter into pure children; otherwise re-roll richness.
      const isRich = parent.pure || (richProb > 0 && this.rng.next() < richProb);
      return this._makeChildAsteroid(new Vec2(c.x, c.y), childR, parent.density, isRich, parent.pure);
    });
  }

  // Create a single child asteroid planet with fresh polygon and rotated-verts cache.
  // pure implies rich; pure children are gold and themselves shatter into pure children.
  _makeChildAsteroid(position, radius, density, rich = false, pure = false) {
    const n        = 6 + Math.floor(this.rng.next() * 5);
    const vertices = this._randomAsteroidVerts(n);
    const rotation = this.rng.next() * Math.PI * 2;
    const speed    = (0.1 + this.rng.next() * this.rng.next() * 0.7) * Math.PI / 180;

    const planet = new Planet({
      position, radius, density,
      type:          PlanetType.ASTEROID,
      colour:        pure ? [230, 195, 60] : rich ? [75, 90, 120] : [120, 80, 10],
      shading:       ShadingStyle.ROCKY,
      vertices, rotation, rotationSpeed: speed, rich: rich || pure, pure,
    });

    this._computeRotatedVerts(planet);
    return planet;
  }

  // Spawn `count` collectables at random offsets within `spread` of a centre point.
  _spawnCollectablesNear(center, spread, count) {
    if (this.gs.config?.collectables === 'off') return;
    for (let c = 0; c < count; c++) {
      const angle = this.rng.next() * Math.PI * 2;
      const dist  = this.rng.next() * spread;
      const col   = new Collectable(new Vec2(
        center.x + Math.cos(angle) * dist,
        center.y + Math.sin(angle) * dist,
      ));
      col.radius = this._collectableRadius();
      this.gs.collectables.push(col);
    }
  }

  // Create a child Crystal Asteroid (same size/shape as regular asteroid child).
  _makeCrystalAsteroid(position, radius, density) {
    const n        = 6 + Math.floor(this.rng.next() * 5);
    const vertices = this._randomAsteroidVerts(n);
    const rotation = this.rng.next() * Math.PI * 2;
    const speed    = (0.1 + this.rng.next() * this.rng.next() * 0.7) * Math.PI / 180;

    const planet = new Planet({
      position, radius, density,
      type:          PlanetType.CRYSTAL,
      colour:        [160, 210, 255],
      shading:       ShadingStyle.ROCKY,
      vertices, rotation, rotationSpeed: speed,
    });

    this._computeRotatedVerts(planet);
    return planet;
  }

  // Fragment a Crystal Asteroid into Crystal Asteroid children.
  _fragmentCrystalAsteroid(parent) {
    const MIN_RADIUS = 10;
    if (parent.radius < MIN_RADIUS) return [];

    const n      = 2 + Math.floor(this.rng.next() * 3);
    const factor = n === 2 ? 0.42 : n === 3 ? 0.35 : 0.30;
    const childR = parent.radius * factor;
    const maxDist = parent.radius - childR;

    const centers = [];
    for (let i = 0; i < n; i++) {
      let placed = false;
      for (let attempt = 0; attempt < 120; attempt++) {
        const angle = this.rng.next() * Math.PI * 2;
        const dist  = Math.sqrt(this.rng.next()) * maxDist;
        const cx    = parent.position.x + Math.cos(angle) * dist;
        const cy    = parent.position.y + Math.sin(angle) * dist;
        const minSep = 2 * childR;
        if (centers.every(c => (cx - c.x) ** 2 + (cy - c.y) ** 2 >= minSep * minSep)) {
          centers.push({ x: cx, y: cy });
          placed = true;
          break;
        }
      }
      if (!placed) break;
    }

    return centers.map(c => this._makeCrystalAsteroid(new Vec2(c.x, c.y), childR, parent.density));
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
      const humansAlive = this.gs.teams.some(t => t.isHuman && t.isAlive);
      if (humansAlive) {
        this._speedSteps      = this._fastFwdPrevSpeed;
        this._fastFwdPrevSpeed = null;
      }
      // No humans alive — stay in Fast FWD for all remaining AI turns
    }
    this._processStoryEvents(); // may spawn stations and set storyDialogText
    // Decrement frozen/electrified for stations that served the condition last turn
    for (const s of this.gs.allStations) {
      if (s._frozenActive)      { s.frozen      = Math.max(0, s.frozen - 1);             s._frozenActive      = false; }
      if (s._electrifiedActive) { s.electrified = Math.max(0, (s.electrified ?? 0) - 1); s._electrifiedActive = false; }
    }
    this._turnOrder = this.gs.allStations.filter(s => s.status === 'active' && s.role !== 'target');
    this._turnIdx   = 0;
    this.gs.waitingForInput = false;
    this.gs.waitingForMove  = false;
    this.gs.mode = GameMode.AIMING;
    // Each new round opens at the full-battlefield view (FR-22).
    this.renderer?.camera?.resetToDefault({ animated: true });
    const cannonEnabled = this.gs.storyState?.mission.settings.cannonEnabled !== false;
    for (const s of this._turnOrder) {
      if (!cannonEnabled && s.team.getStock(WeaponId.ROCKET) > 0) {
        s.selectedWeapon = WeaponId.ROCKET;
      } else {
        s.selectedWeapon = cannonEnabled ? WeaponId.CANNON : WeaponId.HYPERSPACE;
      }
    }
    if (this.gs.stationMovement) this._clearStationVelocities();
    if (this.gs.storyDialogText !== null) {
      this.gs._storyPrevMode = GameMode.AIMING;
      this.gs.mode = GameMode.STORY_DIALOG;
      return;
    }
    // Process leading AI stations immediately so first human gets the indicator
    this._advanceAiming();
  }

  _advanceAiming() {
    if (this.gs.waitingForInput) return;

    while (this._turnIdx < this._turnOrder.length) {
      const station = this._turnOrder[this._turnIdx];

      // Frozen: station skips its turn; frozen supersedes electrified
      // (electrified still decrements in the background — frozen-condition-spec §7.1)
      if ((station.frozen ?? 0) > 0) {
        station._frozenActive = true;  // signals _startTurn to decrement next turn
        if ((station.electrified ?? 0) > 0) station._electrifiedActive = true;
        station.frozenFlash   = 1.0;
        station.velocity      = null;
        this._setActive(station);
        if (station.team.isHuman) {
          this.gs.waitingForInput = true;
          return;
        }
        this._turnIdx++;
        continue;
      }

      // Electrified: angle/power randomised — the station fires (and moves) at
      // these values; the player cannot control them, only end the turn
      if ((station.electrified ?? 0) > 0) {
        station._electrifiedActive = true;  // signals _startTurn to decrement next turn
        station.electrifiedFlash   = 1.0;
        station.angle          = Math.floor(Math.random() * 360);
        station.power          = Math.floor(Math.random() * 700) + 100;
        station.selectedWeapon = WeaponId.CANNON;
        if (this.gs.stationMovement) {
          const moveAngle = Math.random() * Math.PI * 2;
          const moveSpeed = 0.005 + Math.random() * 0.015;
          station.velocity = new Vec2(Math.cos(moveAngle) * moveSpeed, Math.sin(moveAngle) * moveSpeed);
          station._moveDistRemaining = this._getMaxMoveDist(station);
        } else {
          station.velocity = null;
        }
        this._setActive(station);
        if (station.team.isHuman) {
          this.gs.waitingForInput = true;
          return;
        }
        this._turnIdx++;
        continue;
      }

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

    // Every station has acted — fire. If the view is still gliding back to the
    // full battlefield after an end-turn reset, hold the shot until it settles
    // so the player sees the whole board before bullets fly (Item 1). The mode
    // stays AIMING, so this method re-runs each frame and fires once settled.
    if (this.renderer?.camera?.isAnimating()) return;
    this._fireAll();
  }

  _setActive(station) {
    this.gs.currentTeamIdx = station.team.index;
    this.gs.currentStatIdx = station.team.stations.indexOf(station);
  }

  _fireAll() {
    this.gs.activeBullets   = [];
    this.gs.rockets         = [];
    this.gs.iceRings        = [];
    this.gs.shields         = [];
    this.gs.repulsorFields  = [];
    this.gs.rocketBlasts    = [];
    this.gs.rocketSmoke         = [];
    this.gs.shipExplosionBloom  = [];
    this.gs.fireballs           = [];
    this.gs.fireballSmoke       = [];
    this.gs.skimParticles       = [];
    this.gs.burstQueue          = [];
    this.gs.pendingLasers         = [];
    this.gs.pendingSwaps          = [];
    this.gs.pendingTeleports      = [];
    this.gs.pendingReinforcements = [];
    this._silencePendingBeams();
    this.gs.ejecta                = [];
    this.gs.eruptions             = [];
    this.gs.eruptionDebris        = [];
    this.gs.lightning             = [];
    this.gs.firingStep            = 0;

    for (const station of this._turnOrder) {
      if (station.status !== 'active') continue;
      if ((station.frozen ?? 0) > 0) continue; // frozen stations do not fire
      let w = station.selectedWeapon;

      station.lastTrails = null; // clear previous ghost trails before this turn's action

      // Surprise — resolve into a random tier 2/3 weapon before dispatch. A temp
      // charge is granted so the drawn weapon's branch can spend it (net zero).
      if (w === WeaponId.SURPRISE) {
        if (station.team.spendStock(WeaponId.SURPRISE)) {
          const drawn = this._pickSurpriseWeapon();
          station.team.addStock(drawn, 1);
          station.selectedWeapon = drawn;
          w = drawn;
          const [sr, sg, sb] = station.team.colour;
          const lbl = WEAPON_GRANTS.find(g => g.id === drawn)?.label ?? 'SURPRISE';
          this.gs.vfxList.push({ type: 'collectableGrant', x: station.position.x,
            y: station.position.y - station.radius * 2, text: lbl,
            colour: `rgb(${sr},${sg},${sb})`, t: 0, duration: 2.5 });
        } else {
          w = WeaponId.CANNON;
          station.selectedWeapon = WeaponId.CANNON;
        }
      }

      if (w === WeaponId.HYPERSPACE) continue; // teleports after firing phase
      if (w === WeaponId.FORCE_SHIELD && station.team.spendStock(WeaponId.FORCE_SHIELD)) {
        this.gs.shields.push({ station, radius: station.radius * 1.6, alive: true });
        this.gs.activeBullets.push(this._makeBullet(station, station.angle, station.power));
        station.lastTrails = []; // allow bullet trail to accumulate
        SoundManager.play('pop');
        station.stats.turns++;
        continue;
      }

      if (w === WeaponId.TRIPLE_CANNON && station.team.spendStock(WeaponId.TRIPLE_CANNON)) {
        this.gs.vfxList.push({
          type: 'tripleCannonMuzzle', x: station.position.x, y: station.position.y,
          angle: station.angle, colour: station.team.colour, t: 0, duration: 0.25,
        });
        for (const dAngle of [-5, 0, 5]) {
          this.gs.activeBullets.push(this._makeBullet(station, station.angle + dAngle, station.power));
        }
        SoundManager.play('cannon', { volume: 0.8 });
      } else if (w === WeaponId.BLUNDERBUSS && station.team.spendStock(WeaponId.BLUNDERBUSS)) {
        const MAX_V = (800 / 1000 + 0.2) * 0.8;
        for (let i = 0; i < 11; i++) {
          const spread  = (this.rng.next() * 2 - 1) * 15;
          const vFrac   = 0.25 + this.rng.next() * 0.05;
          const b = this._makeBulletVelocity(station, station.angle + spread, MAX_V * vFrac);
          b.thinTrail   = true;
          b.maxLifetime = Math.floor(BULLET_LIFE * (0.17 + this.rng.next() * 0.06)); // 17–23% lifespan
          this.gs.activeBullets.push(b);
        }
        SoundManager.play('blunderbuss');
      } else if (w === WeaponId.LASER && station.team.spendStock(WeaponId.LASER)) {
        this.gs.pendingLasers.push({ station, angle: station.angle, delaySteps: 400 + Math.floor(this.rng.next() * 400) });
        SoundManager.play('laser');
      } else if (w === WeaponId.ROCKET && station.team.spendStock(WeaponId.ROCKET)) {
        const fuel  = ROCKET_MIN_FUEL + (station.power - 1) / 799 * (ROCKET_MAX_FUEL - ROCKET_MIN_FUEL);
        const rad   = (station.angle * Math.PI) / 180;
        const pos   = new Vec2(
          station.position.x + (station.radius + 1) * Math.sin(rad),
          station.position.y + (station.radius + 1) * Math.cos(rad),
        );
        const vel   = new Vec2(ROCKET_LAUNCH_SPEED * Math.sin(rad), ROCKET_LAUNCH_SPEED * Math.cos(rad));
        const rocket = new Rocket({ owner: station, position: pos, velocity: vel });
        rocket.fuel  = fuel;
        this.gs.rockets.push(rocket);
        SoundManager.play('rocket');
      } else if ((w === WeaponId.ICE_ROCKET || w === WeaponId.SHOCK_ROCKET) && station.team.spendStock(w)) {
        const fuel  = ROCKET_MIN_FUEL + (station.power - 1) / 799 * (ROCKET_MAX_FUEL - ROCKET_MIN_FUEL);
        const rad   = (station.angle * Math.PI) / 180;
        const pos   = new Vec2(
          station.position.x + (station.radius + 1) * Math.sin(rad),
          station.position.y + (station.radius + 1) * Math.cos(rad),
        );
        const vel    = new Vec2(ROCKET_LAUNCH_SPEED * Math.sin(rad), ROCKET_LAUNCH_SPEED * Math.cos(rad));
        const rocket = new Rocket({ owner: station, position: pos, velocity: vel });
        rocket.fuel       = fuel;
        rocket.blastRadius = ROCKET_BLAST_RADIUS * 3;
        if (w === WeaponId.ICE_ROCKET) { rocket.freezeAmount = 2; rocket.whiteBlast = true; rocket.iceTrail = true; }
        else                           { rocket.shockAmount  = 2; rocket.lightningBlast = true; }
        this.gs.rockets.push(rocket);
        SoundManager.play('rocket');
      } else if (w === WeaponId.ROCKET_POD && station.team.spendStock(WeaponId.ROCKET_POD)) {
        this.gs.burstQueue.push({
          station, weapon: WeaponId.ROCKET_POD, shotsRemaining: 8, totalShots: 8,
          intervalSteps: 600, nextFireStep: 0,
          angle: station.angle, power: station.power,
        });
        SoundManager.play('rocketPod');
      } else if (w === WeaponId.BLASTER && station.team.spendStock(WeaponId.BLASTER)) {
        this.gs.burstQueue.push({
          station, weapon: WeaponId.BLASTER, shotsRemaining: 5, totalShots: 5,
          intervalSteps: 600, nextFireStep: 0,
          angle: station.angle, power: station.power,
        });
        SoundManager.play('blaster');
      } else if (w === WeaponId.MINIGUN && station.team.spendStock(WeaponId.MINIGUN)) {
        this.gs.burstQueue.push({
          station, weapon: WeaponId.MINIGUN, shotsRemaining: 13,
          intervalSteps: 200, nextFireStep: 0,
          angle: station.angle, power: station.power,
        });
        SoundManager.play('minigun');
      } else if (w === WeaponId.SEPTUPLE_CANNON && station.team.spendStock(WeaponId.SEPTUPLE_CANNON)) {
        this.gs.vfxList.push({
          type: 'tripleCannonMuzzle', x: station.position.x, y: station.position.y,
          angle: station.angle, colour: station.team.colour, t: 0, duration: 0.25,
        });
        for (const dAngle of [-10, -20 / 3, -10 / 3, 0, 10 / 3, 20 / 3, 10]) {
          this.gs.activeBullets.push(this._makeBullet(station, station.angle + dAngle, station.power));
        }
        SoundManager.play('cannon', { volume: 0.8 });
      } else if (w === WeaponId.ANTIMATTER_LASER && station.team.spendStock(WeaponId.ANTIMATTER_LASER)) {
        for (let i = 0; i < 9; i++) {
          const baseAngle = station.angle - 15 + i * (30 / 8);
          const jitter    = (this.rng.next() * 2 - 1) * 1.0;
          this.gs.pendingLasers.push({ station, angle: baseAngle + jitter, delaySteps: 50 + i * 60, vfxDuration: 0.75 });
        }
        SoundManager.play('laserCharged');
      } else if (w === WeaponId.SHOTGUN && station.team.spendStock(WeaponId.SHOTGUN)) {
        this.gs.burstQueue.push({
          station, weapon: WeaponId.SHOTGUN, shotsRemaining: 2, totalShots: 2,
          intervalSteps: 900, nextFireStep: 0,
          angle: station.angle, angle2: station.angle2 ?? station.angle, power: station.power,
        });
        SoundManager.play('shotgun');
      } else if (w === WeaponId.SCATTER_CANNON && station.team.spendStock(WeaponId.SCATTER_CANNON)) {
        const b = this._makeBullet(station, station.angle, station.power);
        b.scatterTimer = 2700;
        this.gs.activeBullets.push(b);
        SoundManager.play('cannon');
      } else if (w === WeaponId.ICE_BOMB && station.team.spendStock(WeaponId.ICE_BOMB)) {
        const b = this._makeBullet(station, station.angle, station.power);
        b.iceBomb          = true;
        b.iceBombTimer     = Math.round((1 + (station.power - 1) / 799 * 4) * 1800);
        b.fragBouncy       = true;
        b.bouncePlanetOnly = true;
        b.thickTrail       = true;
        this.gs.activeBullets.push(b);
        SoundManager.play('cannon');
      } else if (w === WeaponId.SPIRAL && station.team.spendStock(WeaponId.SPIRAL)) {
        this.gs.burstQueue.push({
          station, weapon: WeaponId.SPIRAL, shotsRemaining: 13, totalShots: 13,
          intervalSteps: 600, nextFireStep: 0,
          angle: station.angle, power: station.power,
        });
        SoundManager.play('cannon');
      } else if (w === WeaponId.BOUNCE_CANNON && station.team.spendStock(WeaponId.BOUNCE_CANNON)) {
        const b = this._makeBullet(station, station.angle, station.power);
        b.fragBouncy       = true;
        b.bouncePlanetOnly = true;
        b.thickTrail       = true;
        this.gs.activeBullets.push(b);
        SoundManager.play('cannon');
      } else if (w === WeaponId.AUTO_CANNON && station.team.spendStock(WeaponId.AUTO_CANNON)) {
        this.gs.burstQueue.push({
          station, weapon: WeaponId.AUTO_CANNON, shotsRemaining: 5, totalShots: 5,
          intervalSteps: 500, nextFireStep: 0,
          angle: station.angle, power: station.power,
        });
        SoundManager.play('minigun');
      } else if (w === WeaponId.STAR_SHOT && station.team.spendStock(WeaponId.STAR_SHOT)) {
        for (let i = 0; i < 5; i++) {
          this.gs.activeBullets.push(this._makeBullet(station, station.angle + i * 72, station.power));
        }
        SoundManager.play('rocketPod');
      } else if (w === WeaponId.DUAL_BLASTER && station.team.spendStock(WeaponId.DUAL_BLASTER)) {
        this.gs.burstQueue.push({
          station, weapon: WeaponId.DUAL_BLASTER, shotsRemaining: 2, totalShots: 2,
          intervalSteps: 900, nextFireStep: 0,
          angle: station.angle, angle2: station.angle2 ?? station.angle, power: station.power,
        });
        SoundManager.play('blaster');
      } else if (w === WeaponId.FRAGMENTATION_SHOT && station.team.spendStock(WeaponId.FRAGMENTATION_SHOT)) {
        const MAX_V = (800 / 1000 + 0.2) * 0.8;
        const b = this._makeBulletVelocity(station, station.angle, MAX_V * 0.75);
        b.fragBouncy = true;
        b.fragTimer  = Math.round((1 + (station.power - 1) / 799 * 4) * 1800);
        b.thickTrail = true;
        this.gs.activeBullets.push(b);
        SoundManager.play('cannon');
      } else if (w === WeaponId.RESUPPLY && station.team.spendStock(WeaponId.RESUPPLY)) {
        const count = 3 + Math.floor(this.rng.next() * 3); // 3–5
        for (let i = 0; i < count; i++) {
          const ang  = this.rng.next() * Math.PI * 2;
          const dist = station.radius * (4 + this.rng.next() * 6);
          const pos  = new Vec2(
            Math.max(5, Math.min(this.physics.gw - 5, station.position.x + Math.sin(ang) * dist)),
            Math.max(5, Math.min(this.physics.gh - 5, station.position.y + Math.cos(ang) * dist)),
          );
          const col = new Collectable(pos);
          col.radius = this._collectableRadius();
          this.gs.collectables.push(col);
        }
        SoundManager.play('nova', { volume: 0.5 });
        station.stats.turns++;
        continue;
      } else if (w === WeaponId.HEDGEHOG && station.team.spendStock(WeaponId.HEDGEHOG)) {
        this.gs.shields.push({ station, radius: station.radius * 1.6, alive: true });
        for (let volley = 0; volley < 4; volley++) {
          for (let shot = 0; shot < 3; shot++) {
            this.gs.burstQueue.push({
              station, weapon: WeaponId.HEDGEHOG,
              shotsRemaining: 1, totalShots: 1,
              intervalSteps: 0,
              nextFireStep: this.gs.firingStep + volley * 200,
              angle: station.angle + volley * 30 + shot * 120, power: 400,
            });
          }
        }
        SoundManager.play('rocketPod');
        station.stats.turns++;
        continue;
      } else if (w === WeaponId.TEAM_SHIELD && station.team.spendStock(WeaponId.TEAM_SHIELD)) {
        for (const s of this.gs.allStations) {
          if (s.status === 'active' && s.team === station.team) {
            this.gs.shields.push({ station: s, radius: s.radius * 1.6, alive: true });
          }
        }
        SoundManager.play('pop');
        station.stats.turns++;
        continue;
      } else if (w === WeaponId.ARMOUR && station.team.spendStock(WeaponId.ARMOUR)) {
        station.armourLayers += 2;
        SoundManager.play('pop2');
        station.stats.turns++;
        continue;
      } else if (w === WeaponId.REPULSOR_FIELD && station.team.spendStock(WeaponId.REPULSOR_FIELD)) {
        this.gs.repulsorFields.push({ station, influenceRadius: REPULSOR_FIELD_RADIUS, strength: REPULSOR_FIELD_STRENGTH });
        this.gs.activeBullets.push(this._makeBullet(station, station.angle, station.power));
        SoundManager.play('pop2');
      } else if (w === WeaponId.MAMMOTH_CANNON && station.team.spendStock(WeaponId.MAMMOTH_CANNON)) {
        const b = this._makeBullet(station, station.angle, station.power);
        b.velocity         = new Vec2(b.velocity.x * 0.5, b.velocity.y * 0.5);
        b.gravityMultiplier = 0.25;
        b.sizeMultiplier    = MAMMOTH_SIZE_MULT;
        b.thickTrail        = true;
        b.mammothCannon     = true;
        this.gs.activeBullets.push(b);
        SoundManager.play('cannon', { pitch: -0.2 });
      } else if (w === WeaponId.QUANTUM_TORPEDO && station.team.spendStock(WeaponId.QUANTUM_TORPEDO)) {
        const b = this._makeBullet(station, station.angle, station.power);
        b.quantumTorpedo = true;
        this.gs.activeBullets.push(b);
        SoundManager.play('teleport', { volume: 0.6, pitch: 0.15 });
      } else if (w === WeaponId.TRIPLE_QUANTUM_TORPEDO && station.team.spendStock(WeaponId.TRIPLE_QUANTUM_TORPEDO)) {
        for (const dAngle of [-5, 0, 5]) {
          const b = this._makeBullet(station, station.angle + dAngle, station.power);
          b.quantumTorpedo = true;
          this.gs.activeBullets.push(b);
        }
        this.gs.vfxList.push({
          type: 'tripleCannonMuzzle', x: station.position.x, y: station.position.y,
          angle: station.angle, colour: station.colour, t: 0, duration: 0.3,
        });
        SoundManager.play('teleport', { volume: 0.6 });
      } else if (w === WeaponId.QUANTUM_AUTO_CANNON && station.team.spendStock(WeaponId.QUANTUM_AUTO_CANNON)) {
        this.gs.burstQueue.push({
          station, weapon: WeaponId.QUANTUM_AUTO_CANNON, shotsRemaining: 5, totalShots: 5,
          intervalSteps: 500, nextFireStep: 0,
          angle: station.angle, power: station.power,
        });
        SoundManager.play('minigun');
      } else if (w === WeaponId.GRAVITY_CANNON && station.team.spendStock(WeaponId.GRAVITY_CANNON)) {
        const b = this._makeBullet(station, station.angle, station.power);
        b.velocity          = new Vec2(b.velocity.x * 0.5, b.velocity.y * 0.5);
        b.gravityMultiplier = 0.25;
        b.sizeMultiplier    = GRAVITY_CANNON_SIZE_MULT;
        b.thickTrail        = true;
        b.gravityCannon     = true;
        this.gs.activeBullets.push(b);
        SoundManager.play('nova');
      } else if (w === WeaponId.ELECTRO_STUN && station.team.spendStock(WeaponId.ELECTRO_STUN)) {
        const t            = (station.power - 1) / 799;
        const spreadDeg    = ELECTRO_STUN_MAX_SPREAD - t * (ELECTRO_STUN_MAX_SPREAD - ELECTRO_STUN_MIN_SPREAD);
        const halfSpreadRad = (spreadDeg / 2) * Math.PI / 180;
        const range        = ELECTRO_STUN_BASE_RANGE * (0.2 + t * 0.8);
        const centerRad    = (station.angle * Math.PI) / 180;
        const centerDirX   = Math.sin(centerRad);
        const centerDirY   = Math.cos(centerRad);

        for (const target of this.gs.allStations) {
          if (target === station || target.status !== 'active') continue;
          const dx   = target.position.x - station.position.x;
          const dy   = target.position.y - station.position.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > range || dist < 0.001) continue;
          // Arc check via dot product
          if ((dx / dist) * centerDirX + (dy / dist) * centerDirY < Math.cos(halfSpreadRad)) continue;
          // Line-of-sight block by solid planets
          let blocked = false;
          for (const planet of this.gs.planets) {
            if (planet.destroyed || planet.type === PlanetType.GAS_GIANT) continue;
            if (planet.type === PlanetType.WORMHOLE_PAIRED || planet.type === PlanetType.WORMHOLE_CYCLIC ||
                planet.type === PlanetType.WORMHOLE_RANDOM || planet.type === PlanetType.WORMHOLE_PLANET ||
                planet.type === PlanetType.WORMHOLE_SELF   || planet.type === PlanetType.WORMHOLE_NETWORK) continue;
            const pdx  = planet.position.x - station.position.x;
            const pdy  = planet.position.y - station.position.y;
            const u    = Math.max(0, Math.min(1, (pdx * dx + pdy * dy) / (dist * dist)));
            const cdx  = pdx - u * dx;
            const cdy  = pdy - u * dy;
            if (cdx * cdx + cdy * cdy < planet.impactRadius * planet.impactRadius) { blocked = true; break; }
          }
          if (blocked) continue;
          // Apply effect (armour absorbs)
          if ((target.armourLayers ?? 0) > 0) {
            target.armourLayers--;
            target.armourFlash = 1.0;
          } else {
            target.electrified      = Math.min(3, (target.electrified ?? 0) + 1);
            target.electrifiedFlash = 1.0;
            this._notifyCondition(target, 'electrified');
          }
        }
        const [er, eg, eb] = station.team.colour;
        this.gs.vfxList.push({ type: 'electroStun', x: station.position.x, y: station.position.y,
          angle: centerRad, spreadRad: halfSpreadRad, range,
          numBolts: ELECTRO_STUN_BOLTS, r: er, g: eg, b: eb, t: 0, duration: 0.6 });
        station.stats.turns++;
        continue;
      } else if (w === WeaponId.TELEPORT && station.team.spendStock(WeaponId.TELEPORT)) {
        const { gw, gh }  = this.physics;
        const maxDist     = Math.sqrt(gw * gw + gh * gh);
        const dist        = (station.power / 800) * maxDist;
        const rad         = (station.angle * Math.PI) / 180;
        const rawX        = station.position.x + Math.sin(rad) * dist;
        const rawY        = station.position.y + Math.cos(rad) * dist;
        const [safeX, safeY] = this._findSafeTeleportDest(station, rawX, rawY, gw, gh);
        this.gs.pendingTeleports.push({ station, destX: safeX, destY: safeY, fireStep: TELEPORT_FIRE_STEP });
        SoundManager.play('teleport');
        station.stats.turns++;
        continue;
      } else if (w === WeaponId.SUPER_LASER && station.team.spendStock(WeaponId.SUPER_LASER)) {
        const [slr, slg, slb] = station.team.colour;
        this.gs.vfxList.push({ type: 'superLaserConverge',
          x: station.position.x, y: station.position.y, angle: station.angle,
          r: slr, g: slg, b: slb, t: 0, duration: SUPER_LASER_CONV_DURATION });
        this.gs.pendingLasers.push({ station, angle: station.angle,
          delaySteps: SUPER_LASER_CHARGE_STEPS, superLaser: true,
          vfxDuration: SUPER_LASER_BEAM_DURATION });
        SoundManager.play('laserAlt', { pitch: -0.10 });
      } else if (w === WeaponId.REINFORCEMENT_SIGNAL && station.team.spendStock(WeaponId.REINFORCEMENT_SIGNAL)) {
        const MAX_V = (800 / 1000 + 0.2) * 0.8;
        const b = this._makeBulletVelocity(station, station.angle, MAX_V * REINF_SIGNAL_SPEED_MULT);
        b.gravityMultiplier   = REINF_SIGNAL_GRAVITY_MULT;
        b.fragBouncy          = true;
        b.bounceRetention     = 1.0;
        b.reinforcementSignal = true;
        this.gs.activeBullets.push(b);
        SoundManager.play('rocketPod');
      } else if (w === WeaponId.MIND_CONTROL_BEAM && station.team.spendStock(WeaponId.MIND_CONTROL_BEAM)) {
        const [mr, mg, mb] = station.team.colour;
        this.gs.vfxList.push({ type: 'mindControlCharge',
          x: station.position.x, y: station.position.y, angle: station.angle,
          r: mr, g: mg, b: mb, t: 0, duration: 0.5 });
        this.gs.pendingLasers.push({ station, angle: station.angle,
          delaySteps: MIND_CONTROL_DELAY_STEPS, mindControlBeam: true });
        SoundManager.play('laserBeam');
      } else if (w === WeaponId.TRIPLE_BOUNCE_CANNON && station.team.spendStock(WeaponId.TRIPLE_BOUNCE_CANNON)) {
        this.gs.vfxList.push({
          type: 'tripleCannonMuzzle', x: station.position.x, y: station.position.y,
          angle: station.angle, colour: station.team.colour, t: 0, duration: 0.25,
        });
        for (const dAngle of [-5, 0, 5]) {
          const b = this._makeBullet(station, station.angle + dAngle, station.power);
          b.fragBouncy = true; b.bouncePlanetOnly = true; b.thickTrail = true;
          this.gs.activeBullets.push(b);
        }
        SoundManager.play('cannon', { volume: 0.8 });
      } else if (w === WeaponId.BOUNCE_AUTOCANNON && station.team.spendStock(WeaponId.BOUNCE_AUTOCANNON)) {
        this.gs.burstQueue.push({
          station, weapon: WeaponId.BOUNCE_AUTOCANNON, shotsRemaining: 5, totalShots: 5,
          intervalSteps: 500, nextFireStep: 0,
          angle: station.angle, power: station.power,
        });
        SoundManager.play('minigun');
      } else if (w === WeaponId.AAARRRGGHH && station.team.spendStock(WeaponId.AAARRRGGHH)) {
        this.gs.burstQueue.push({
          station, weapon: WeaponId.AUTO_CANNON, shotsRemaining: 5, totalShots: 5,
          intervalSteps: 500, nextFireStep: 0, angle: station.angle, power: station.power,
        });
        this.gs.burstQueue.push({
          station, weapon: WeaponId.ROCKET_POD, shotsRemaining: 8, totalShots: 8,
          intervalSteps: 600, nextFireStep: 0, angle: station.angle, power: station.power,
        });
        const [aar, aag, aab] = station.team.colour;
        this.gs.vfxList.push({ type: 'collectableGrant', x: station.position.x, y: station.position.y - station.radius * 2,
          text: 'AAARRRGGHH!', colour: `rgb(${aar},${aag},${aab})`, t: 0, duration: 1.0 });
        SoundManager.play('rocketPod');
      } else if (w === WeaponId.TEAM_ARMOUR && station.team.spendStock(WeaponId.TEAM_ARMOUR)) {
        for (const s of this.gs.allStations) {
          if (s.status === 'active' && s.team === station.team) {
            s.armourLayers += 2;
            s.armourFlash = 1.0;
            const [tar, tag, tab] = s.team.colour;
            this.gs.vfxList.push({ type: 'teamArmour', x: s.position.x, y: s.position.y,
              radius: s.radius, r: tar, g: tag, b: tab, t: 0, duration: 0.8 });
          }
        }
        SoundManager.play('pop2');
        station.stats.turns++;
        continue;
      } else if (w === WeaponId.SUIT_UP && station.team.spendStock(WeaponId.SUIT_UP)) {
        station.armourLayers += 3;
        station.armourFlash = 1.0;
        this.gs.shields.push({ station, radius: station.radius * 1.6, alive: true });
        const [sur, sug, sub] = station.team.colour;
        this.gs.vfxList.push({ type: 'teamArmour', x: station.position.x, y: station.position.y,
          radius: station.radius, r: sur, g: sug, b: sub, t: 0, duration: 0.8 });
        this.gs.burstQueue.push({
          station, weapon: WeaponId.MINIGUN, shotsRemaining: 13,
          intervalSteps: 200, nextFireStep: 0, angle: station.angle, power: station.power,
        });
        SoundManager.play('minigun');
      } else if (w === WeaponId.ICE_BLAST && station.team.spendStock(WeaponId.ICE_BLAST)) {
        this.gs.burstQueue.push({
          station, weapon: WeaponId.ICE_BLAST, shotsRemaining: 8, totalShots: 8,
          intervalSteps: 300, nextFireStep: 0, angle: station.angle, power: station.power,
        });
        SoundManager.play('laser', { pitch: -0.3 });
      } else if (w === WeaponId.FREEZE_RAY && station.team.spendStock(WeaponId.FREEZE_RAY)) {
        this.gs.pendingLasers.push({ station, angle: station.angle, delaySteps: 400 + Math.floor(this.rng.next() * 400), freezeRay: true });
        SoundManager.play('laser');
      } else if (w === WeaponId.SHOCK_BEAM && station.team.spendStock(WeaponId.SHOCK_BEAM)) {
        this.gs.pendingLasers.push({ station, angle: station.angle, delaySteps: 400 + Math.floor(this.rng.next() * 400), shockBeam: true });
        SoundManager.play('laser');
      } else if (w === WeaponId.THEFT_BEAM && station.team.spendStock(WeaponId.THEFT_BEAM)) {
        this.gs.pendingLasers.push({ station, angle: station.angle, delaySteps: 400 + Math.floor(this.rng.next() * 400), theftBeam: true });
        SoundManager.play('laser');
      } else if (w === WeaponId.QUANTUM_BEAM && station.team.spendStock(WeaponId.QUANTUM_BEAM)) {
        this.gs.pendingLasers.push({ station, angle: station.angle, delaySteps: 400 + Math.floor(this.rng.next() * 400), quantumBeam: true });
        SoundManager.play('teleport', { volume: 0.6, pitch: 0.2 });
      } else if (w === WeaponId.BIRTHDAY_PRESENT && station.team.spendStock(WeaponId.BIRTHDAY_PRESENT)) {
        // Slow shot following the same arc as a cannon shot: speed ×1/3, gravity ×1/9
        const b = this._makeBullet(station, station.angle, station.power);
        b.velocity          = new Vec2(b.velocity.x / 3, b.velocity.y / 3);
        b.gravityMultiplier = 1 / 9;
        b.birthdayPresent   = true;
        b.sizeMultiplier    = 2;
        b.thickTrail        = true;
        this.gs.activeBullets.push(b);
        SoundManager.play('cannon', { pitch: -0.3 });
      } else if (w === WeaponId.THRUST_BOOSTER && station.team.spendStock(WeaponId.THRUST_BOOSTER)) {
        this.gs.activeBullets.push(this._makeBullet(station, station.angle, station.power));
        // Double this turn's movement distance budget (boost is wasted if not moving)
        if (station.velocity) {
          station._moveDistRemaining = (station._moveDistRemaining || this._getMaxMoveDist(station)) * 2;
        }
        SoundManager.play('cannon');
      } else if (this.gs.storyState?.mission.settings.cannonEnabled !== false) {
        // Cannon (or fallback) — skipped when cannonEnabled: false
        this.gs.activeBullets.push(this._makeBullet(station, station.angle, station.power));
        SoundManager.play('cannon');
      }

      station.lastAngle  = station.angle;
      station.lastPower  = station.power;
      station.lastTrails = [];
      station.angle2     = station.angle; // reset shotgun barrel 2 for next turn
      station.stats.shots++;
      station.stats.totalPower += station.power;
      station.stats.turns++;
    }
    this.gs.mode = GameMode.FIRING;
  }

  _makeBullet(station, angleDeg, power) {
    const { position, velocity } = this.physics.initialState(
      ((angleDeg % 360) + 360) % 360, power, station,
    );
    const b = new Bullet({ owner: station, position, velocity });
    b.trail.push(new Vec2(position.x, position.y));
    return b;
  }

  _makeBulletVelocity(station, angleDeg, speed) {
    const rad = (((angleDeg % 360) + 360) % 360 * Math.PI) / 180;
    const pos = new Vec2(
      station.position.x + (station.radius + 1) * Math.sin(rad),
      station.position.y + (station.radius + 1) * Math.cos(rad),
    );
    const vel = new Vec2(speed * Math.sin(rad), speed * Math.cos(rad));
    const b   = new Bullet({ owner: station, position: pos, velocity: vel });
    b.trail.push(new Vec2(pos.x, pos.y));
    return b;
  }

  // ─── FIRING ─────────────────────────────────────────────────────────────────

  _advanceFiring() {
    const allStations   = this.gs.allStations;
    const stepsPerFrame = this._paused ? PRINT_EVERY : this._speedSteps;

    for (let i = 0; i < stepsPerFrame; i++) {
      this.gs.firingStep++;

      // ── Burst queue ───────────────────────────────────────────────────────────
      for (const burst of this.gs.burstQueue) {
        if (this.gs.firingStep < burst.nextFireStep) continue;

        if (burst.weapon === WeaponId.HEDGEHOG) {
          const rad    = (((burst.angle % 360) + 360) % 360 * Math.PI) / 180;
          const spawnR = burst.station.radius * 1.6 + 2; // outside the force shield
          const pos    = new Vec2(
            burst.station.position.x + spawnR * Math.sin(rad),
            burst.station.position.y + spawnR * Math.cos(rad),
          );
          const vel    = new Vec2(ROCKET_LAUNCH_SPEED * Math.sin(rad), ROCKET_LAUNCH_SPEED * Math.cos(rad));
          const rocket = new Rocket({ owner: burst.station, position: pos, velocity: vel });
          rocket.fuel  = ROCKET_MIN_FUEL + (burst.power - 1) / 799 * (ROCKET_MAX_FUEL - ROCKET_MIN_FUEL);
          rocket.blastRadius = ROCKET_BLAST_RADIUS * 0.5;
          this.gs.rockets.push(rocket);
        } else if (burst.weapon === WeaponId.ROCKET_POD) {
          const shotIdx  = (burst.totalShots ?? 8) - burst.shotsRemaining;
          const deviation = (this.rng.next() * 2 - 1) * 1.0;
          const rad       = (((burst.angle + deviation) % 360 + 360) % 360 * Math.PI) / 180;
          const offset    = burst.station.radius * 2;
          const isLeft    = shotIdx % 2 === 0;
          const perpX     = isLeft ? -Math.cos(rad) : Math.cos(rad);
          const perpY     = isLeft ?  Math.sin(rad) : -Math.sin(rad);
          const pos       = new Vec2(
            burst.station.position.x + perpX * offset,
            burst.station.position.y + perpY * offset,
          );
          const vel    = new Vec2(ROCKET_LAUNCH_SPEED * Math.sin(rad), ROCKET_LAUNCH_SPEED * Math.cos(rad));
          const rocket = new Rocket({ owner: burst.station, position: pos, velocity: vel });
          rocket.fuel  = ROCKET_MIN_FUEL + (burst.power - 1) / 799 * (ROCKET_MAX_FUEL - ROCKET_MIN_FUEL);
          rocket.blastRadius = ROCKET_BLAST_RADIUS * 0.5;
          this.gs.rockets.push(rocket);
        } else if (burst.weapon === WeaponId.DUAL_BLASTER) {
          const MAX_V      = (800 / 1000 + 0.2) * 0.8;
          const shotIdx    = (burst.totalShots ?? 2) - burst.shotsRemaining;
          const barrelAngle = shotIdx === 0 ? burst.angle : burst.angle2;
          const b = this._makeBulletVelocity(burst.station, barrelAngle, MAX_V * 0.55);
          b.thinTrail = true;
          this.gs.activeBullets.push(b);
        } else if (burst.weapon === WeaponId.SPIRAL) {
          const MAX_V   = (800 / 1000 + 0.2) * 0.8;
          const shotIdx = (burst.totalShots ?? 13) - burst.shotsRemaining;
          const b = this._makeBulletVelocity(burst.station, burst.angle + shotIdx * (360 / 13), MAX_V * 0.55);
          b.thinTrail = true;
          this.gs.activeBullets.push(b);
        } else if (burst.weapon === WeaponId.AUTO_CANNON) {
          const spread = (this.rng.next() * 2 - 1) * 1;
          this.gs.activeBullets.push(this._makeBullet(burst.station, burst.angle + spread, burst.power));
        } else if (burst.weapon === WeaponId.BOUNCE_AUTOCANNON) {
          const spread = (this.rng.next() * 2 - 1) * 1;
          const b = this._makeBullet(burst.station, burst.angle + spread, burst.power);
          b.fragBouncy = true; b.bouncePlanetOnly = true; b.thickTrail = true;
          this.gs.activeBullets.push(b);
        } else if (burst.weapon === WeaponId.ICE_BLAST) {
          const MAX_V = (800 / 1000 + 0.2) * 0.8;
          const rad   = (((burst.angle % 360) + 360) % 360 * Math.PI) / 180;
          const pos   = new Vec2(
            burst.station.position.x + (burst.station.radius + 1) * Math.sin(rad),
            burst.station.position.y + (burst.station.radius + 1) * Math.cos(rad),
          );
          const vel   = new Vec2(MAX_V * 0.08 * Math.sin(rad), MAX_V * 0.08 * Math.cos(rad));
          const ring  = new IceRing({ owner: burst.station, position: pos, velocity: vel });
          ring.radius = burst.station.radius;
          this.gs.iceRings.push(ring);
        } else if (burst.weapon === WeaponId.QUANTUM_AUTO_CANNON) {
          const spread = (this.rng.next() * 2 - 1) * 1;
          const b = this._makeBullet(burst.station, burst.angle + spread, burst.power);
          b.quantumTorpedo = true;
          this.gs.activeBullets.push(b);
        } else if (burst.weapon === WeaponId.SHOTGUN) {
          const MAX_V      = (800 / 1000 + 0.2) * 0.8;
          const shotIdx    = (burst.totalShots ?? 2) - burst.shotsRemaining;
          const barrelAngle = shotIdx === 0 ? burst.angle : burst.angle2;
          for (let i = 0; i < 6; i++) {
            const spread = (this.rng.next() * 2 - 1) * 8;
            const vFrac  = 0.25 + this.rng.next() * 0.05;
            const b = this._makeBulletVelocity(burst.station, barrelAngle + spread, MAX_V * vFrac);
            b.thinTrail   = true;
            b.maxLifetime = Math.floor(BULLET_LIFE * (0.17 + this.rng.next() * 0.06));
            this.gs.activeBullets.push(b);
          }
        } else {
          const MAX_V = (800 / 1000 + 0.2) * 0.8;
          let spread, speed;
          if (burst.weapon === WeaponId.BLASTER) {
            const shotIdx    = (burst.totalShots ?? 5) - burst.shotsRemaining;
            const halfSpread = burst.power ?? 15;
            spread = -halfSpread + shotIdx * (halfSpread / 2);
            speed  = MAX_V * 0.55;
          } else {
            spread = (this.rng.next() * 2 - 1) * 4.0;
            speed  = MAX_V * 1.5;
          }
          const b = this._makeBulletVelocity(burst.station, burst.angle + spread, speed);
          b.thinTrail = true;
          this.gs.activeBullets.push(b);
        }

        burst.shotsRemaining--;
        burst.nextFireStep = this.gs.firingStep + burst.intervalSteps;
      }
      this.gs.burstQueue = this.gs.burstQueue.filter(b => b.shotsRemaining > 0);

      // ── Pending lasers ────────────────────────────────────────────────────────
      for (const pl of this.gs.pendingLasers) {
        pl.delaySteps--;
        if (pl.delaySteps <= 0) {
          if (pl.mindControlBeam) {
            const path = this._simulateMindControlPath(pl.station, pl.angle);
            const [mr, mg, mb] = pl.station.team.colour;
            this.gs.vfxList.push({ type: 'mindControlBeam', path, r: mr, g: mg, b: mb, t: 0, duration: 1.5 });
            if (pl.station.lastTrails) pl.station.lastTrails.push([...path]);
          } else if (pl.superLaser) {
            const path = this._simulateSuperLaserPath(pl.station, pl.angle);
            this.renderer?.rebuildBackground();
            const [slr, slg, slb] = pl.station.team.colour;
            this.gs.vfxList.push({ type: 'superLaserBeam', path, r: slr, g: slg, b: slb, t: 0, duration: pl.vfxDuration ?? SUPER_LASER_BEAM_DURATION });
            if (pl.station.lastTrails) pl.station.lastTrails.push([...path]);
          } else if (pl.freezeRay) {
            const path = this._simulateLaserPath(pl.station, pl.angle, { condition: 'frozen', amount: 3 });
            this.gs.vfxList.push({ type: 'laserPath', path, colour: [136, 221, 255], t: 0, duration: 1.5 });
            if (pl.station.lastTrails) pl.station.lastTrails.push([...path]);
          } else if (pl.shockBeam) {
            const path = this._simulateLaserPath(pl.station, pl.angle, { condition: 'electrified', amount: 2 });
            this.gs.vfxList.push({ type: 'shockBeam', path, colour: pl.station.team.colour, t: 0, duration: 1.2 });
            if (pl.station.lastTrails) pl.station.lastTrails.push([...path]);
          } else if (pl.theftBeam) {
            const path = this._simulateLaserPath(pl.station, pl.angle, { theftBeam: true, theftOwner: pl.station });
            this.gs.vfxList.push({ type: 'theftBeam', path, colour: pl.station.team.colour, t: 0, duration: 1.5 });
            if (pl.station.lastTrails) pl.station.lastTrails.push([...path]);
          } else if (pl.quantumBeam) {
            const { path, target } = this._simulateQuantumBeamPath(pl.station, pl.angle);
            this.gs.vfxList.push({ type: 'quantumBeam', path, colour: pl.station.team.colour, t: 0, duration: 1.5 });
            if (target) this.gs.pendingSwaps.push({ firer: pl.station, target });
            if (pl.station.lastTrails) pl.station.lastTrails.push([...path]);
          } else {
            const path = this._simulateLaserPath(pl.station, pl.angle);
            this.gs.vfxList.push({ type: 'laserPath', path, colour: pl.station.team.colour, t: 0, duration: pl.vfxDuration ?? 1.5 });
            if (pl.station.lastTrails) pl.station.lastTrails.push([...path]);
          }
        }
      }
      this.gs.pendingLasers = this.gs.pendingLasers.filter(pl => pl.delaySteps > 0);

      // ── Pending teleports ─────────────────────────────────────────────────────
      for (let pti = this.gs.pendingTeleports.length - 1; pti >= 0; pti--) {
        const pt = this.gs.pendingTeleports[pti];
        if (this.gs.firingStep < pt.fireStep) continue;
        const { gw, gh } = this.physics;
        const oldX = pt.station.position.x, oldY = pt.station.position.y;
        pt.station.position = new Vec2(
          Math.max(pt.station.radius, Math.min(gw - pt.station.radius, pt.destX)),
          Math.max(pt.station.radius, Math.min(gh - pt.station.radius, pt.destY)),
        );
        this.gs.shields.push({ station: pt.station, radius: pt.station.radius * 1.6, alive: true });
        const [tr, tg, tb] = pt.station.team.colour;
        this.gs.vfxList.push({ type: 'teleportFlash', x: oldX,                 y: oldY,                 r: tr, g: tg, b: tb, t: 0, duration: 0.5 });
        this.gs.vfxList.push({ type: 'teleportFlash', x: pt.station.position.x, y: pt.station.position.y, r: tr, g: tg, b: tb, t: 0, duration: 0.5 });
        SoundManager.play('teleport');
        this.gs.pendingTeleports.splice(pti, 1);
      }

      // ── Ice rings (Ice Blast) ──────────────────────────────────────────────────
      if (this.gs.iceRings.length) {
        const { gw, gh } = this.physics;
        for (const ring of this.gs.iceRings) {
          if (ring.status !== 'active') continue;
          ring.lifetime++;
          // Gravity (full G)
          for (const planet of this.gs.planets) {
            if (planet.destroyed) continue;
            const dx = planet.position.x - ring.position.x, dy = planet.position.y - ring.position.y;
            const rSq = dx * dx + dy * dy;
            if (rSq < 0.01) continue;
            const sign  = dx < 0 ? -1 : 1;
            const theta = Math.atan(dy / dx);
            const accel = sign * G * planet.mass / rSq;
            ring.velocity = new Vec2(ring.velocity.x + Math.cos(theta) * accel * TIMESTEP,
                                     ring.velocity.y + Math.sin(theta) * accel * TIMESTEP);
          }
          ring.position = new Vec2(ring.position.x + ring.velocity.x * TIMESTEP,
                                   ring.position.y + ring.velocity.y * TIMESTEP);
          ring.radius = Math.min(ICE_RING_MAX_RADIUS, ring.radius + ICE_RING_MAX_RADIUS / ICE_RING_LIFETIME);
          // Freeze stations it passes through (single freeze; ring continues)
          for (const s of allStations) {
            if (s.status !== 'active' || ring.hitSet.has(s) || s === ring.owner) continue;
            const dx = s.position.x - ring.position.x, dy = s.position.y - ring.position.y;
            const rr = ring.radius + s.radius;
            if (dx * dx + dy * dy < rr * rr) {
              ring.hitSet.add(s);
              this._applyBeamCondition(s, 'frozen', 1);
            }
          }
          // Solid planets stop the ring (asteroids / crystals / gas giants pass through)
          for (const planet of this.gs.planets) {
            if (planet.destroyed) continue;
            if (planet.type === PlanetType.ASTEROID || planet.type === PlanetType.CRYSTAL ||
                planet.type === PlanetType.GAS_GIANT) continue;
            const R = planet.impactRadius;
            const dx = planet.position.x - ring.position.x, dy = planet.position.y - ring.position.y;
            if (dx * dx + dy * dy < R * R) { ring.status = 'dead'; break; }
          }
          if (ring.lifetime >= ICE_RING_LIFETIME) ring.status = 'dead';
          if (ring.position.x < -gw || ring.position.x > 2 * gw ||
              ring.position.y < -gw || ring.position.y > gh + gw) ring.status = 'dead';
        }
        this.gs.iceRings = this.gs.iceRings.filter(r => r.status === 'active');
      }

      // ── Rocket physics ────────────────────────────────────────────────────────
      for (const rocket of this.gs.rockets) {
        if (rocket.status !== RocketStatus.ACTIVE) continue;

        // Thrust
        if (rocket.fuel > 0) {
          const speed = Math.sqrt(rocket.velocity.x ** 2 + rocket.velocity.y ** 2) || 1;
          const ax    = (rocket.velocity.x / speed) * ROCKET_THRUST / (ROCKET_BASE_MASS + rocket.fuel) * TIMESTEP;
          const ay    = (rocket.velocity.y / speed) * ROCKET_THRUST / (ROCKET_BASE_MASS + rocket.fuel) * TIMESTEP;
          rocket.velocity = new Vec2(rocket.velocity.x + ax, rocket.velocity.y + ay);
          rocket.fuel    -= ROCKET_FUEL_BURN_RATE * TIMESTEP;
        }

        // Gravity
        for (const planet of this.gs.planets) {
          if (planet.destroyed) continue;
          const dx  = planet.position.x - rocket.position.x;
          const dy  = planet.position.y - rocket.position.y;
          const rSq = dx * dx + dy * dy;
          if (rSq < 0.01) continue;
          const sign  = dx < 0 ? -1 : 1;
          const theta = Math.atan(dy / dx);
          const R     = planet.impactRadius;
          let accel;
          if (planet.type === PlanetType.GAS_GIANT && rSq < R * R) {
            // Interior of gas giant: gravity reduces linearly to zero at core (matches bullet physics)
            const r = Math.sqrt(rSq);
            accel = sign * G * planet.mass * r / (R * R * R);
          } else {
            accel = sign * G * planet.mass / rSq;
          }
          rocket.velocity = new Vec2(
            rocket.velocity.x + Math.cos(theta) * accel * TIMESTEP,
            rocket.velocity.y + Math.sin(theta) * accel * TIMESTEP,
          );
        }

        const rPrevX = rocket.position.x, rPrevY = rocket.position.y;
        rocket.position = new Vec2(
          rocket.position.x + rocket.velocity.x * TIMESTEP,
          rocket.position.y + rocket.velocity.y * TIMESTEP,
        );

        // Reflective (blue) rift bounce — a mirror barrier bounces rockets too
        if (this._hasReflectiveRift) {
          const rb = PhysicsEngine._reflectOffRifts(
            rPrevX, rPrevY, rocket.position.x, rocket.position.y,
            rocket.velocity.x, rocket.velocity.y, this.gs.rifts);
          if (rb) {
            rocket.position = new Vec2(rb.x, rb.y);
            rocket.velocity = new Vec2(rb.vx, rb.vy);
          }
        }

        // Record trail point
        if (this.gs.firingStep % PRINT_EVERY === 0) rocket.trail.push(new Vec2(rocket.position.x, rocket.position.y));

        // Boundary
        const { gw, gh } = this.physics;
        const { x, y }   = rocket.position;
        if (this.physics.periodicBoundary) {
          let nx = x, ny = y;
          if (x < 0 || x > gw) nx = ((x % gw) + gw) % gw;
          if (y < 0 || y > gh) ny = ((y % gh) + gh) % gh;
          if (nx !== x || ny !== y) { rocket.position = new Vec2(nx, ny); rocket.trail = []; }
        } else if (x < -gw || x > 2 * gw || y < -gw || y > gh + gw) {
          if (rocket.owner?.lastTrails && rocket.trail.length > 1) rocket.owner.lastTrails.push([...rocket.trail]);
          rocket.status = RocketStatus.DEAD; continue;
        }

        // Lifetime cap — same as bullets (BULLET_LIFE trail points). Prevents a rocket
        // trapped in a stable orbit from keeping the round alive forever; it expires
        // harmlessly (no blast), like an off-map rocket or a timed-out bullet.
        if (rocket.trail.length >= BULLET_LIFE) {
          if (rocket.owner?.lastTrails && rocket.trail.length > 1) rocket.owner.lastTrails.push([...rocket.trail]);
          rocket.status = RocketStatus.DEAD; continue;
        }

        // Collectable pickup — rocket gathers any collectable it flies through and keeps going
        for (const c of this.gs.collectables) {
          if (!c.alive) continue;
          if (rocket.position.distanceSqTo(c.position) >= (ROCKET_HITBOX_RADIUS + c.radius) ** 2) continue;
          c.alive = false;
          const grant = this._pickCollectableGrant();
          rocket.owner.team.addStock(grant.id, grant.charges);
          this._creditCollectableStat(rocket.owner, grant);
          if (this.gs.storyState && rocket.owner.team.isHuman) this.gs.storyState.collectCount++;
          this.gs.vfxList.push(this._makeCollectableShatterVFX(c));
          const [cr, cg, cb] = rocket.owner.team.colour;
          this.gs.vfxList.push({ type: 'collectableGrant', x: c.position.x, y: c.position.y, text: grant.label, colour: `rgb(${cr},${cg},${cb})`, t: 0, duration: 2.0 });
        }

        // Shield collision → detonate
        let detonated = false;
        for (const shield of this.gs.shields) {
          if (!shield.alive) continue;
          if (rocket.position.distanceSqTo(shield.station.position) < shield.radius ** 2) {
            this._detonateRocket(rocket); detonated = true; break;
          }
        }
        if (detonated) continue;

        // Planet collision → teleport through wormhole or detonate (gas giants passed through)
        for (const planet of this.gs.planets) {
          if (planet.destroyed || planet.type === PlanetType.GAS_GIANT) continue;
          // Broad-phase bounding circle, then exact polygon narrow-phase for asteroids
          // (same test bullets use) so a rocket only strikes the actual jagged rock,
          // not the empty circle around it.
          if (rocket.position.distanceSqTo(planet.position) >= planet.impactRadius ** 2) continue;
          if ((planet.type === PlanetType.ASTEROID || planet.type === PlanetType.GIANT_ASTEROID)
              && planet._rotatedVerts?.length
              && !PhysicsEngine._pointInPolygon(rocket.position, planet._rotatedVerts)) continue;
          if (this._isWormhole(planet.type)) {
            this._teleportRocket(rocket, planet);
          } else {
            // Multi-hit bodies (moon, giant asteroid): a rocket deals 1 hit before detonating.
            if (planet.type === PlanetType.GIANT_ASTEROID || planet.type === PlanetType.MOON) {
              this._handleMoonHit(planet, rocket.position.x, rocket.position.y);
            }
            this._detonateRocket(rocket); detonated = true;
          }
          break;
        }
        if (detonated) continue;

        // Station collision → detonate
        for (const station of allStations) {
          if (station.status !== 'active') continue;
          if (rocket.position.distanceSqTo(station.position) < station.radius ** 2) {
            this._detonateRocket(rocket); break;
          }
        }

        // Shoot-down: bullets hitting the rocket
        for (const bullet of this.gs.activeBullets) {
          if (bullet.status !== BulletStatus.ACTIVE) continue;
          if (bullet.position.distanceSqTo(rocket.position) < ROCKET_HITBOX_RADIUS ** 2) {
            bullet.status = BulletStatus.EXPLODING;
            if (bullet.owner?.lastTrails && bullet.trail.length > 1) bullet.owner.lastTrails.push([...bullet.trail]);
            this._detonateRocket(rocket);
            break;
          }
        }
      }

      // ── Bullet-shield reflection ──────────────────────────────────────────────
      for (const bullet of this.gs.activeBullets) {
        if (bullet.status !== BulletStatus.ACTIVE) continue;
        // Gravity Cannon ignores force shields and strikes the ship inside.
        if (bullet.gravityCannon) continue;
        for (const shield of this.gs.shields) {
          if (!shield.alive) continue;
          if (bullet.owner === shield.station) {
            // Pass through while moving outward; reflect if it orbits back inward
            const odx = bullet.position.x - shield.station.position.x;
            const ody = bullet.position.y - shield.station.position.y;
            if (bullet.velocity.x * odx + bullet.velocity.y * ody > 0) continue;
          }
          if (bullet.position.distanceSqTo(shield.station.position) < shield.radius ** 2) {
            const nx = (bullet.position.x - shield.station.position.x) / shield.radius;
            const ny = (bullet.position.y - shield.station.position.y) / shield.radius;
            const dot = bullet.velocity.x * nx + bullet.velocity.y * ny;
            bullet.velocity = new Vec2(bullet.velocity.x - 2 * dot * nx, bullet.velocity.y - 2 * dot * ny);
            bullet.position = new Vec2(
              shield.station.position.x + nx * (shield.radius + 0.5),
              shield.station.position.y + ny * (shield.radius + 0.5),
            );
            SoundManager.play('pop');
            break;
          }
        }
      }

      // ── Normal bullet physics ─────────────────────────────────────────────────
      for (const bullet of this.gs.activeBullets) {
        if (bullet.status !== BulletStatus.ACTIVE) continue;

        const preX = bullet.position.x, preY = bullet.position.y;
        this.physics.step(bullet, this.gs.planets, this.gs.rifts, this.gs.repulsorFields ?? []);

        // Reflective (blue) rift bounce — mirror the bullet off any segment its path crossed
        if (bullet.status === BulletStatus.ACTIVE && this._hasReflectiveRift) {
          const bounce = PhysicsEngine._reflectOffRifts(
            preX, preY, bullet.position.x, bullet.position.y,
            bullet.velocity.x, bullet.velocity.y, this.gs.rifts);
          if (bounce) {
            bullet.position = new Vec2(bounce.x, bounce.y);
            bullet.velocity = new Vec2(bounce.vx, bounce.vy);
          }
        }

        // Reinforcement Signal: detect when it exits the map boundary
        if (bullet.reinforcementSignal && bullet.status === BulletStatus.ACTIVE) {
          const { gw, gh } = this.physics;
          const { x, y } = bullet.position;
          if (x < 0 || x > gw || y < 0 || y > gh) {
            const edgeX = Math.max(0, Math.min(gw, x));
            const edgeY = Math.max(0, Math.min(gh, y));
            this.gs.pendingReinforcements.push({ team: bullet.owner.team, x: edgeX, y: edgeY, size: bullet.owner.size });
            bullet.status = BulletStatus.DEAD;
            if (bullet.owner.lastTrails && bullet.trail.length > 1) bullet.owner.lastTrails.push([...bullet.trail]);
            continue;
          }
        }

        // Wormhole Tunnel boundary. A reflective (blue) boundary bounces bullets
        // back into the arena (handled above); the polygon test is only a safety
        // net that nudges any escapee back inside. A non-reflective boundary kills
        // bullets that leave the oval, as before.
        if (this._boundaryRift && bullet.status === BulletStatus.ACTIVE &&
            !this._isInsideBoundaryPolygon(bullet.position.x, bullet.position.y, this._boundaryRift)) {
          if (this._boundaryRift.reflective) {
            this._nudgeBulletInsideBoundary(bullet);
          } else {
            bullet.status = BulletStatus.DEAD;
            if (bullet.owner.lastTrails && bullet.trail.length > 1) bullet.owner.lastTrails.push([...bullet.trail]);
            continue;
          }
        }

        // Moon hit — must check before trail recording since step() may EXPLODE the bullet
        if (bullet._hitMoon) {
          this._handleMoonHit(bullet._hitMoon, bullet._hitMoonX, bullet._hitMoonY);
          bullet._hitMoon = null;
        }

        // Unstable planet hit — trigger an eruption at the contact point
        if (bullet._eruptPlanet) {
          this._triggerEruption(bullet._eruptPlanet, bullet._eruptX, bullet._eruptY, bullet.owner);
          bullet._eruptPlanet = null;
        }

        // Quantum Torpedo: teleport through solid body
        if (bullet._qtTeleportPlanet) {
          this._handleQuantumTeleport(bullet);
          bullet._qtTeleportPlanet = null;
        }

        // Skim event — increment skim stat (FR-8) and spawn particle effect (FR-6)
        if (bullet._skimEvent) {
          bullet.owner.stats.skimShots++;
          if (this._performance !== 'simplified') {
            this._spawnSkimParticles(bullet._skimEvent);
          }
          bullet._skimEvent = null;
        }

        if (bullet.lifetime % PRINT_EVERY === 0) {
          bullet.trail.push(new Vec2(bullet.position.x, bullet.position.y));
          this.renderer.appendTrailPoint(bullet);
        }

        const hit = this.physics.checkStationCollisions(bullet, allStations);
        if (hit) {
          if (bullet.fragBouncy && !bullet.bouncePlanetOnly) {
            this._fragBounceOffStation(bullet, hit);
          } else {
            this._resolveStationHit(bullet, hit);
          }
        } else {
          for (const _s of this.physics.checkNearMisses(bullet, allStations))
            bullet.owner.stats.nearMisses++;
        }

        // Mammoth Cannon: spawn area blast when bullet detonates on any impact
        if (bullet.mammothCannon && bullet.status === BulletStatus.EXPLODING && !bullet._mammothBlasted) {
          bullet._mammothBlasted = true;
          this._spawnMammothBlast(bullet);
        }

        // Frag shot: tick timer and detonate when it expires
        if (bullet.fragBouncy && bullet.fragTimer !== null && bullet.status === BulletStatus.ACTIVE) {
          bullet.fragTimer--;
          if (bullet.fragTimer <= 0) this._detonateFragShot(bullet);
        }

        // Scatter cannon: tick timer and split when it expires
        if (bullet.scatterTimer !== null && bullet.status === BulletStatus.ACTIVE) {
          bullet.scatterTimer--;
          if (bullet.scatterTimer <= 0) this._scatterCannon(bullet);
        }

        // Ice Bomb: detonate on fuse expiry or on impact
        if (bullet.iceBomb && !bullet._iceBombed) {
          if (bullet.status === BulletStatus.ACTIVE && bullet.iceBombTimer !== null) {
            bullet.iceBombTimer--;
            if (bullet.iceBombTimer <= 0) this._detonateIceBomb(bullet);
          } else if (bullet.status === BulletStatus.EXPLODING) {
            this._detonateIceBomb(bullet);
          }
        }

        // Stuck detection for bouncing bullets — explode if barely moved over 2 seconds
        if (bullet.bouncePlanetOnly && bullet.status === BulletStatus.ACTIVE && bullet.lifetime % 120 === 0) {
          if (bullet._stuckPos) {
            const dx = bullet.position.x - bullet._stuckPos.x;
            const dy = bullet.position.y - bullet._stuckPos.y;
            if (dx * dx + dy * dy < 4) {
              bullet._stuckCount = (bullet._stuckCount ?? 0) + 1;
              if (bullet._stuckCount >= 10) bullet.status = BulletStatus.EXPLODING;
            } else {
              bullet._stuckCount = 0;
            }
          }
          bullet._stuckPos = new Vec2(bullet.position.x, bullet.position.y);
        }

        // Collectable collision — bullet passes through, collectable destroyed
        const hitCollectable = this.physics.checkCollectableCollision(bullet, this.gs.collectables);
        if (hitCollectable) {
          hitCollectable.alive = false;
          const grant = this._pickCollectableGrant();
          bullet.owner.team.addStock(grant.id, grant.charges);
          this._creditCollectableStat(bullet.owner, grant);
          if (this.gs.storyState && bullet.owner.team.isHuman) this.gs.storyState.collectCount++;
          SoundManager.play('glassSmash');
          this.gs.vfxList.push(this._makeCollectableShatterVFX(hitCollectable));
          const [r, g, b] = bullet.owner.team.colour;
          this.gs.vfxList.push({
            type: 'collectableGrant',
            x: hitCollectable.position.x, y: hitCollectable.position.y,
            text: grant.label, colour: `rgb(${r},${g},${b})`,
            t: 0, duration: 2.0,
          });
        }

        // Save trail as ghost the moment a bullet leaves the active state
        if (bullet.status !== BulletStatus.ACTIVE && bullet.trail.length > 1) {
          if (bullet.owner.lastTrails) bullet.owner.lastTrails.push([...bullet.trail]);
          if (bullet.status === BulletStatus.EXPLODING) {
            SoundManager.playRandom(['explosionSmall', 'explosionSmall2', 'explosionSmall3']);
          }
        }
      }

      // Gravity Cannon: each active GC bullet attracts all other bullets
      for (const gcb of this.gs.activeBullets) {
        if (!gcb.gravityCannon || gcb.status !== BulletStatus.ACTIVE) continue;
        for (const b of this.gs.activeBullets) {
          if (b === gcb || b.status !== BulletStatus.ACTIVE) continue;
          const gdx   = gcb.position.x - b.position.x;
          const gdy   = gcb.position.y - b.position.y;
          const grSq  = Math.max(4, gdx * gdx + gdy * gdy);
          const gSign = gdx < 0 ? -1 : 1;
          const gAccel = gSign * G * GRAVITY_CANNON_MASS / grSq;
          const gTheta = Math.atan(gdy / gdx);
          b.velocity.x += Math.cos(gTheta) * gAccel * TIMESTEP;
          b.velocity.y += Math.sin(gTheta) * gAccel * TIMESTEP;
        }
      }

      // Move stations one physics step (only when feature is enabled)
      if (this.gs.stationMovement) this._stepStations(allStations);

      // Move comets one physics step
      this._stepComets();

      // Advance unstable-planet eruption sequences, ejecta, and cosmetic debris
      if (this.gs.eruptions.length)      this._stepEruptions();
      if (this.gs.ejecta.length)         this._stepEjecta(allStations);
      if (this.gs.eruptionDebris.length) this._stepEruptionDebris();
    }

    // Pyro/Cryo ejecta emit comet-style smoke puffs (once per frame, like comets)
    if (this.gs.ejecta.length) this._emitEjectaSmoke();
    // Grow/hold/fade electro forked lightning (once per frame → fast lightning)
    if (this.gs.lightning.length) this._stepLightning(allStations);

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

    // Advance expanding rocket blasts (once per rAF frame, not per physics step)
    for (let i = this.gs.rocketBlasts.length - 1; i >= 0; i--) {
      const blast = this.gs.rocketBlasts[i];
      blast.currentRadius += blast.maxRadius / 22 * (blast.speed ?? 1);

      const r2    = blast.currentRadius * blast.currentRadius;
      const proxy = { owner: blast.owner, status: 'active', teleportCount: 0, trickShotDone: false };
      const isCondition = blast.freezeAmount || blast.shockAmount || blast.freezeZones;

      for (const s of allStations) {
        if (s.status !== 'active' || blast.hitSet.has(s)) continue;
        const dx = s.position.x - blast.x, dy = s.position.y - blast.y;
        if (dx * dx + dy * dy < r2) {
          blast.hitSet.add(s);
          if (isCondition) this._applyConditionBlast(blast, s);
          else             this._resolveStationHit(proxy, s);
        }
      }
      if (!blast.noKillBullets) {
        for (const b of this.gs.activeBullets) {
          if (b.status !== BulletStatus.ACTIVE || blast.hitSet.has(b)) continue;
          const dx = b.position.x - blast.x, dy = b.position.y - blast.y;
          if (dx * dx + dy * dy < r2) { blast.hitSet.add(b); b.status = BulletStatus.DEAD; }
        }
      }
      for (const p of this.gs.planets) {
        if (p.destroyed || blast.hitSet.has(p)) continue;
        if (p.type !== PlanetType.ASTEROID && p.type !== PlanetType.CRYSTAL) continue;
        const dx = p.position.x - blast.x, dy = p.position.y - blast.y;
        if (dx * dx + dy * dy < r2) { blast.hitSet.add(p); p.destroyed = true; }
      }
      for (const c of this.gs.collectables) {
        if (!c.alive || blast.hitSet.has(c)) continue;
        const dx = c.position.x - blast.x, dy = c.position.y - blast.y;
        if (dx * dx + dy * dy < r2) {
          blast.hitSet.add(c);
          c.alive = false;
          const grant = this._pickCollectableGrant();
          blast.owner.team.addStock(grant.id, grant.charges);
          this._creditCollectableStat(blast.owner, grant);
          if (this.gs.storyState && blast.owner.team.isHuman) this.gs.storyState.collectCount++;
          this.gs.vfxList.push(this._makeCollectableShatterVFX(c));
          const [cr, cg, cb] = blast.owner.team.colour;
          this.gs.vfxList.push({ type: 'collectableGrant', x: c.position.x, y: c.position.y, text: grant.label, colour: `rgb(${cr},${cg},${cb})`, t: 0, duration: 2.0 });
        }
      }

      if (blast.currentRadius >= blast.maxRadius) this.gs.rocketBlasts.splice(i, 1);
    }

    // Emit smoke from active rockets and advance all smoke puffs (once per rAF frame)
    for (const rocket of this.gs.rockets) {
      if (rocket.status !== RocketStatus.ACTIVE) continue;
      const speed  = Math.sqrt(rocket.velocity.x ** 2 + rocket.velocity.y ** 2) || 1;
      const angle  = Math.atan2(rocket.velocity.y, rocket.velocity.x) + Math.PI; // behind rocket
      const dist   = 2 + this.rng.next() * 2;
      const jitter = (this.rng.next() - 0.5) * 3;
      const [sr, sg, sb] = rocket.owner.team.colour;
      this.gs.rocketSmoke.push({
        x: rocket.position.x + Math.cos(angle) * dist + Math.cos(angle + Math.PI / 2) * jitter,
        y: rocket.position.y + Math.sin(angle) * dist + Math.sin(angle + Math.PI / 2) * jitter,
        maxR: 3 + this.rng.next() * 4,
        t: 0, r: sr, g: sg, b: sb,
      });
    }
    for (let i = this.gs.rocketSmoke.length - 1; i >= 0; i--) {
      this.gs.rocketSmoke[i].t += 1 / (400+ Math.random() * 800);
      if (this.gs.rocketSmoke[i].t >= 1) this.gs.rocketSmoke.splice(i, 1);
    }

    // Comet smoke — two layers: fast surface haze + slow central tail
    for (const planet of this.gs.planets) {
      if (planet.type !== PlanetType.COMET || planet.destroyed) continue;

      // Layer 1: fast-shrinking surface puffs (hazy coma)
      for (let p = 0; p < 3; p++) {
        const a = this.rng.next() * Math.PI * 2;
        this.gs.cometSmoke.push({
          x: planet.position.x + Math.cos(a) * (planet.radius + 0.5),
          y: planet.position.y + Math.sin(a) * (planet.radius + 0.5),
          maxR: 2 + this.rng.next() * 4, dt: 1 / 110, fast: true, t: 0,
        });
      }

      // Layer 2: slow central tail puffs (sharp defined trail)
      if (planet.velocity) {
        const speed = Math.sqrt(planet.velocity.x ** 2 + planet.velocity.y ** 2);
        if (speed > 0.0002) {
          const tailAngle = Math.atan2(planet.velocity.y, planet.velocity.x) + Math.PI;
          const dist   = planet.radius + 2 + this.rng.next() * 4;
          const jitter = (this.rng.next() - 0.5) * planet.radius * 0.4;
          this.gs.cometSmoke.push({
            x: planet.position.x + Math.cos(tailAngle) * dist + Math.cos(tailAngle + Math.PI / 2) * jitter,
            y: planet.position.y + Math.sin(tailAngle) * dist + Math.sin(tailAngle + Math.PI / 2) * jitter,
            maxR: 5 + this.rng.next() * 6, dt: 1 / 400, fast: false, t: 0,
          });
        }
      }
    }
    for (let i = this.gs.cometSmoke.length - 1; i >= 0; i--) {
      this.gs.cometSmoke[i].t += this.gs.cometSmoke[i].dt;
      if (this.gs.cometSmoke[i].t >= 1) this.gs.cometSmoke.splice(i, 1);
    }

    // Advance rocket explosion timers; remove dead
    for (const rocket of this.gs.rockets) {
      if (rocket.status === RocketStatus.EXPLODING) {
        rocket.explosionT += 0.025;
        if (rocket.explosionT >= 1) rocket.status = RocketStatus.DEAD;
      }
    }
    this.gs.rockets = this.gs.rockets.filter(r => r.status !== RocketStatus.DEAD);

    // Remove dead bullets
    this.gs.activeBullets = this.gs.activeBullets.filter(b => b.status !== BulletStatus.DEAD);

    // Clean up destroyed collectables and advance VFX
    this.gs.collectables = this.gs.collectables.filter(c => c.alive);
    this._advanceVFX();

    this._advanceExplosionEffects();

    // All resolved → RESULTS (wait for moving stations, burst queue, pending lasers, teleports, and rockets)
    const bulletsGone    = this.gs.activeBullets.length === 0;
    const rocketsGone    = this.gs.rockets.length === 0;
    const ringsGone      = this.gs.iceRings.length === 0;
    const blastsGone     = this.gs.rocketBlasts.length === 0;
    const burstsGone     = this.gs.burstQueue.length === 0;
    const lasersGone     = this.gs.pendingLasers.length === 0;
    // Wait only for a PRIMARY (bullet-triggered) eruption sequence to finish — not
    // for the ejecta it throws, nor for chain eruptions those ejecta set off.
    const primaryErupting = this.gs.eruptions.some(s => !s.chain);
    // Likewise wait for a primary (bullet-triggered) lightning strike to finish.
    const primaryLightning = this.gs.lightning.some(L => !L.chain);
    const teleportsGone  = (this.gs.pendingTeleports?.length ?? 0) === 0;
    const stationsMoving = this.gs.stationMovement &&
      allStations.some(s => s.status === 'active' && s.velocity);
    if (bulletsGone && rocketsGone && ringsGone && blastsGone && burstsGone && lasersGone && !primaryErupting && !primaryLightning && teleportsGone && !stationsMoving) {
      // Mid-flight ejecta, chain eruptions, debris, and lightning just stop — clear them
      this._silencePendingBeams();
      this.gs.ejecta = [];
      this.gs.eruptions = [];
      this.gs.eruptionDebris = [];
      this.gs.lightning = [];
      for (const reinf of this.gs.pendingReinforcements ?? []) {
        this._spawnReinforcementStation(reinf.team, reinf.x, reinf.y, reinf.size);
      }
      this.gs.pendingReinforcements = [];
      this.gs.shields        = [];
      this.gs.repulsorFields = [];
      this.gs.rocketBlasts   = [];
      this.gs.pendingTeleports = [];
      // Quantum Beam position swaps — both stations must still be alive
      for (const sw of this.gs.pendingSwaps ?? []) {
        if (sw.firer.status !== 'active' || sw.target.status !== 'active') continue;
        const tmp = sw.firer.position;
        sw.firer.position  = sw.target.position;
        sw.target.position = tmp;
        for (const st of [sw.firer, sw.target]) {
          const [qr, qg, qb] = st.team.colour;
          this.gs.vfxList.push({ type: 'teleportFlash', x: st.position.x, y: st.position.y, r: qr, g: qg, b: qb, t: 0, duration: 0.5 });
        }
      }
      this.gs.pendingSwaps = [];
      this._processHyperspace();
      this._checkWin();
      this._resultsTimer = 240; // ~4 s at 60 fps
      this.gs.mode = GameMode.RESULTS;
    }
  }

  // Spawn shockwave + particle burst on a newly-killed station.
  _spawnStationExplosion(station) {
    if (this._isExperimental) {
      this._spawnBitmapExplosion(station);
      return;
    }
    if (station.role === 'target') {
      station.shockwave = { t: 0, r: 204, g: 17, b: 17 };
      station.particles = [
        ...this._makeParticles(station.position.x, station.position.y, 204, 17,  17,  8),
        ...this._makeParticles(station.position.x, station.position.y, 255, 255, 255, 8),
      ];
      return;
    }
    const [r, g, b] = station.colour;
    station.shockwave = { t: 0, r, g, b };
    station.particles = this._makeParticles(station.position.x, station.position.y, r, g, b, 16);
  }

  _spawnBitmapExplosion(station) {
    const ox = station.position.x;
    const oy = station.position.y;
    const [sr, sg, sb] = station.role === 'target' ? [204, 17, 17] : station.colour;
    station.shockwave = { t: 0, r: sr, g: sg, b: sb };

    // 10 bloom particles scattered around blast centre
    for (let i = 0; i < 10; i++) {
      const angle  = Math.random() * Math.PI * 2;
      const spread = station.radius * (0.2 + Math.random() * 0.4);
      this.gs.shipExplosionBloom.push({
        x: ox + Math.cos(angle) * spread,
        y: oy + Math.sin(angle) * spread,
        maxR: 9 + Math.random() * 12,
        t:    0,
        dt:   0.006 + Math.random() * 0.005,
        r: sr, g: sg, b: sb,
      });
    }

    // 3–5 fireballs flying outward, capped globally at 20
    const nFB = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < nFB; i++) {
      if (this.gs.fireballs.length >= 20) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = (3 + Math.random() * 5) * 0.15;
      this.gs.fireballs.push({
        x: ox, y: oy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: sr, g: sg, b: sb,
        t: 0,
        dt: (0.003 + Math.random() * 0.003) * 2.5,
        smokeTimer: 0,
      });
    }
  }

  // Spawn a freestanding explosion for an asteroid (position in game units).
  _spawnAsteroidExplosion(planet) {
    SoundManager.playRandom(['explosionSmall', 'explosionSmall2']);
    const r = 139, g = 26, b = 26; // dark red
    this.gs.activeExplosions.push({
      x: planet.position.x, y: planet.position.y,
      radius: planet.radius,
      t: 0, r, g, b,
      particles: this._makeParticles(planet.position.x, planet.position.y, r, g, b, 10),
    });
  }

  _handleMoonHit(moon, impactX, impactY) {
    moon.hitCount++;
    const hitLimit = moon.type === PlanetType.GIANT_ASTEROID ? 9 : 3;
    if (moon.hitCount >= hitLimit) {
      moon.destroyed = true;

      if (moon.type === PlanetType.GIANT_ASTEROID) {
        this._fragmentGiantAsteroid(moon);
      } else {
        this._fragmentMoon(moon);
      }

      this._spawnAsteroidExplosion(moon);
      const idx = this.gs.planets.indexOf(moon);
      if (idx !== -1) this.gs.planets.splice(idx, 1);
    } else {
      // Non-fatal hit — moons show crack overlays; giant asteroids just absorb the hit
      if (moon.type !== PlanetType.GIANT_ASTEROID) {
        if (!moon.crackAngles)   moon.crackAngles   = [];
        if (!moon.crackSvgIdxs) moon.crackSvgIdxs  = [];
        moon.crackAngles.push(Math.atan2(impactY - moon.position.y, impactX - moon.position.x));
        moon.crackSvgIdxs.push(Math.floor(this.rng.next() * 3));
      }
    }
  }

  // Fragment a destroyed moon into 3–5 child asteroids.
  _fragmentMoon(moon) {
    const n       = 3 + Math.floor(this.rng.next() * 3); // 3-5
    const factor  = n <= 3 ? 0.40 : n <= 4 ? 0.35 : 0.30;
    const childR  = moon.radius * factor;
    const maxDist = moon.radius - childR;
    const placed  = [];
    for (let i = 0; i < n; i++) {
      const angle = this.rng.next() * Math.PI * 2;
      const dist  = Math.sqrt(this.rng.next()) * maxDist;
      const pos   = new Vec2(
        moon.position.x + Math.cos(angle) * dist,
        moon.position.y + Math.sin(angle) * dist,
      );
      const r = Math.max(8, childR);
      const overlaps = (cx, cy, cr) => {
        const ddx = pos.x - cx, ddy = pos.y - cy;
        return ddx * ddx + ddy * ddy < (r + cr) ** 2;
      };
      if (this.gs.planets.some(p => p !== moon && !p.destroyed && overlaps(p.position.x, p.position.y, p.impactRadius))) continue;
      if (placed.some(p => overlaps(p.x, p.y, p.r))) continue;
      placed.push({ x: pos.x, y: pos.y, r });
      this.gs.planets.push(this._makeChildAsteroid(pos, r, moon.density, false));
    }
  }

  // Fragment a destroyed giant asteroid into 25–40 child asteroids.
  // If the parent was rich, all children are rich and 3–6 collectables are spawned.
  _fragmentGiantAsteroid(moon) {
    const n       = 25 + Math.floor(this.rng.next() * 16); // 25-40
    const minR    = Math.max(8,  moon.radius * 0.06);
    const maxR    = Math.max(16, moon.radius * 0.18);
    const placed  = [];
    for (let attempts = 0; placed.length < n && attempts < n * 40; attempts++) {
      // Bias toward small: square the random value so large rocks are rarer
      const t      = this.rng.next() ** 2;
      const childR = minR + t * (maxR - minR);
      const maxDist = moon.radius - childR;
      const angle  = this.rng.next() * Math.PI * 2;
      const dist   = Math.sqrt(this.rng.next()) * maxDist;
      const pos    = new Vec2(
        moon.position.x + Math.cos(angle) * dist,
        moon.position.y + Math.sin(angle) * dist,
      );
      const overlaps = (ex, ey, er) => {
        const dx = pos.x - ex, dy = pos.y - ey;
        return dx * dx + dy * dy < (childR + er) ** 2;
      };
      if (this.gs.planets.some(p => p !== moon && !p.destroyed && overlaps(p.position.x, p.position.y, p.impactRadius))) continue;
      if (placed.some(p => overlaps(p.x, p.y, p.r))) continue;
      placed.push({ x: pos.x, y: pos.y, r: childR });
      this.gs.planets.push(this._makeChildAsteroid(pos, childR, moon.density, moon.rich ?? false, moon.pure ?? false));
    }

    if (moon.rich && this.gs.config?.collectables !== 'off') {
      this._spawnCollectablesNear(moon.position, moon.radius * 0.8, 3 + Math.floor(this.rng.next() * 4)); // 3-6
    }
    // Pure giant: 2-4 collectables on top of the standard rich payout above.
    if (moon.pure) this._spawnCollectablesNear(moon.position, moon.radius * 0.8, 2 + Math.floor(this.rng.next() * 3));
  }

  _generateMoonCracks(moon, ix, iy) {
    const n      = 5 + Math.floor(this.rng.next() * 4); // 5-8 cracks
    const cracks = [];
    for (let i = 0; i < n; i++) {
      const baseAngle = (2 * Math.PI * i) / n + (this.rng.next() - 0.5) * 0.8;
      const pts    = [new Vec2(ix, iy)];
      let cx = ix, cy = iy;
      const steps  = 3 + Math.floor(this.rng.next() * 3); // 3-5 segments
      const segLen = moon.radius / steps;
      let angle    = baseAngle;
      for (let s = 0; s < steps; s++) {
        angle += (this.rng.next() - 0.5) * 0.4;
        cx += Math.cos(angle) * segLen;
        cy += Math.sin(angle) * segLen;
        pts.push(new Vec2(cx, cy));
        const ddx = cx - moon.position.x, ddy = cy - moon.position.y;
        if (ddx * ddx + ddy * ddy > moon.radius * moon.radius * 1.1) break;
      }
      cracks.push(pts);
    }
    return cracks;
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

  // Simulate laser path from station at angle. Pierces stations/asteroids, reflects off shields.
  // opts.condition ('frozen' | 'electrified') makes the beam apply that condition (Freeze Ray /
  // Shock Beam) instead of killing, and pass through asteroids without destroying them.
  _simulateLaserPath(station, angleDeg, opts = {}) {
    const LASER_SPEED    = 160;
    const LASER_GRAVITY  = 1.0;
    const MAX_STEPS      = 200;
    const rad = (((angleDeg % 360) + 360) % 360 * Math.PI) / 180;
    let px = station.position.x + (station.radius + 1) * Math.sin(rad);
    let py = station.position.y + (station.radius + 1) * Math.cos(rad);
    let vx = LASER_SPEED * Math.sin(rad);
    let vy = LASER_SPEED * Math.cos(rad);
    const path    = [new Vec2(px, py)];
    const proxy   = { owner: station, status: 'active', teleportCount: 0, trickShotDone: false };
    const hitStations = new Set(); // condition beams apply once per station
    const { gw, gh } = this.physics;

    for (let step = 0; step < MAX_STEPS; step++) {
      // Reduced gravity
      for (const planet of this.gs.planets) {
        if (planet.destroyed) continue;
        const dx  = planet.position.x - px;
        const dy  = planet.position.y - py;
        const rSq = dx * dx + dy * dy;
        if (rSq < 0.01) continue;
        const sign  = dx < 0 ? -1 : 1;
        const theta = Math.atan(dy / dx);
        const accel = sign * LASER_GRAVITY * G * planet.mass / rSq;
        vx += Math.cos(theta) * accel * TIMESTEP;
        vy += Math.sin(theta) * accel * TIMESTEP;
      }
      const px0 = px, py0 = py;
      px += vx * TIMESTEP;
      py += vy * TIMESTEP;
      path.push(new Vec2(px, py));

      if (px < -gw || px > 2 * gw || py < -gw || py > gh + gw) break;

      // Reflective (blue) rift bounce — mirror the beam off any segment it crossed
      if (this._hasReflectiveRift) {
        const rb = PhysicsEngine._reflectOffRifts(px0, py0, px, py, vx, vy, this.gs.rifts);
        if (rb) { px = rb.x; py = rb.y; vx = rb.vx; vy = rb.vy; path.push(new Vec2(px, py)); continue; }
      }

      // Shield reflection
      let reflected = false;
      for (const shield of this.gs.shields) {
        if (!shield.alive) continue;
        const dx = px - shield.station.position.x;
        const dy = py - shield.station.position.y;
        if (dx * dx + dy * dy < shield.radius ** 2) {
          const d    = Math.sqrt(dx * dx + dy * dy) || 1;
          const nx   = dx / d, ny = dy / d;
          const dot  = vx * nx + vy * ny;
          vx -= 2 * dot * nx;
          vy -= 2 * dot * ny;
          px = shield.station.position.x + nx * (shield.radius + 0.5);
          py = shield.station.position.y + ny * (shield.radius + 0.5);
          path.push(new Vec2(px, py));
          reflected = true;
          break;
        }
      }
      if (reflected) continue;

      // Station hit — swept segment vs circle so fast steps don't skip over ships
      for (const s of this.gs.allStations) {
        if (s.status !== 'active' || s === station) continue;
        const sdx = px0 - s.position.x, sdy = py0 - s.position.y;
        const edx = px  - s.position.x, edy = py  - s.position.y;
        const segDx = px - px0, segDy = py - py0;
        const a  = segDx * segDx + segDy * segDy;
        const b  = 2 * (sdx * segDx + sdy * segDy);
        const c  = sdx * sdx + sdy * sdy - s.radius * s.radius;
        const disc = b * b - 4 * a * c;
        if (disc < 0) continue;
        const sq = Math.sqrt(disc);
        const t1 = (-b - sq) / (2 * a);
        const t2 = (-b + sq) / (2 * a);
        if ((t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1)) {
          if (opts.condition) {
            if (!hitStations.has(s)) { hitStations.add(s); this._applyBeamCondition(s, opts.condition, opts.amount ?? 1); }
          } else if (opts.theftBeam) {
            if (!hitStations.has(s)) { hitStations.add(s); this._applyTheftBeam(opts.theftOwner, s); }
          } else {
            this._resolveStationHit(proxy, s);
          }
        }
      }

      // Collectable hit — laser collects it (passes through)
      for (const c of this.gs.collectables) {
        if (!c.alive) continue;
        const cdx = px - c.position.x, cdy = py - c.position.y;
        if (cdx * cdx + cdy * cdy < c.radius * c.radius) {
          c.alive = false;
          const grant = this._pickCollectableGrant();
          station.team.addStock(grant.id, grant.charges);
        this._creditCollectableStat(station, grant);
          if (this.gs.storyState && station.team.isHuman) this.gs.storyState.collectCount++;
          this.gs.vfxList.push(this._makeCollectableShatterVFX(c));
          const [cr, cg, cb] = station.team.colour;
          this.gs.vfxList.push({ type: 'collectableGrant', x: c.position.x, y: c.position.y, text: grant.label, colour: `rgb(${cr},${cg},${cb})`, t: 0, duration: 2.0 });
        }
      }

      // Planet hit — asteroids shatter, solid planets stop laser
      let blocked = false;
      for (const planet of this.gs.planets) {
        if (planet.destroyed) continue;
        const R  = planet.impactRadius;
        const dx = planet.position.x - px;
        const dy = planet.position.y - py;
        if (dx * dx + dy * dy < R * R) {
          if (planet.type === PlanetType.ASTEROID || planet.type === PlanetType.CRYSTAL) {
            // Condition beams and Theft Beam pass through without destroying
            if (!opts.condition && !opts.theftBeam) {
              planet.destroyed = true;
              this._spawnAsteroidExplosion(planet);
            }
          } else if (planet.type !== PlanetType.GAS_GIANT) {
            blocked = true;
          }
          break;
        }
      }
      if (blocked) break;
    }
    return path;
  }

  // Bodies the Quantum Beam reflects off (vs passes through).
  _isReflectiveBody(planet) {
    switch (planet.type) {
      case PlanetType.ROCKY: case PlanetType.STAR: case PlanetType.JOVIAN:
      case PlanetType.WHITE_DWARF: case PlanetType.PULSAR: case PlanetType.MOON:
      case PlanetType.GIANT_ASTEROID:
        return true;
      default:
        return false; // asteroids, crystals, gas giants, wormholes, holes — pass through
    }
  }

  // Quantum Beam path: straight beam that reflects off solid bodies and shields,
  // passes through asteroids/gas-giants/wormholes, and stops at the first station
  // hit (recording a position-swap). Returns { path, target }.
  _simulateQuantumBeamPath(station, angleDeg) {
    const SPEED = 8, MAX_STEPS = 300, MAX_BOUNCES = 10;
    const rad = (((angleDeg % 360) + 360) % 360 * Math.PI) / 180;
    let px = station.position.x + (station.radius + 1) * Math.sin(rad);
    let py = station.position.y + (station.radius + 1) * Math.cos(rad);
    let vx = SPEED * Math.sin(rad), vy = SPEED * Math.cos(rad);
    const path = [new Vec2(px, py)];
    const { gw, gh } = this.physics;
    let bounces = 0, target = null;

    for (let step = 0; step < MAX_STEPS; step++) {
      const px0 = px, py0 = py;
      px += vx; py += vy;
      path.push(new Vec2(px, py));
      if (px < -gw || px > 2 * gw || py < -gw || py > gh + gw) break;

      // Shield reflection
      let reflected = false;
      for (const shield of this.gs.shields) {
        if (!shield.alive) continue;
        const dx = px - shield.station.position.x, dy = py - shield.station.position.y;
        if (dx * dx + dy * dy < shield.radius ** 2) {
          const d = Math.sqrt(dx * dx + dy * dy) || 1, nx = dx / d, ny = dy / d, dot = vx * nx + vy * ny;
          vx -= 2 * dot * nx; vy -= 2 * dot * ny;
          px = shield.station.position.x + nx * (shield.radius + 0.5);
          py = shield.station.position.y + ny * (shield.radius + 0.5);
          path.push(new Vec2(px, py)); reflected = true; bounces++; break;
        }
      }
      if (reflected) { if (bounces >= MAX_BOUNCES) break; continue; }

      // Station hit — swept segment vs circle so fast steps don't skip ships
      for (const s of this.gs.allStations) {
        if (s.status !== 'active' || s === station) continue;
        const sdx = px0 - s.position.x, sdy = py0 - s.position.y;
        const segDx = px - px0, segDy = py - py0;
        const a = segDx * segDx + segDy * segDy;
        const b = 2 * (sdx * segDx + sdy * segDy);
        const c = sdx * sdx + sdy * sdy - s.radius * s.radius;
        const disc = b * b - 4 * a * c;
        if (disc < 0) continue;
        const sq = Math.sqrt(disc);
        const t1 = (-b - sq) / (2 * a), t2 = (-b + sq) / (2 * a);
        if ((t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1)) { target = s; break; }
      }
      if (target) break;

      // Collectable collect (pass through)
      for (const c of this.gs.collectables) {
        if (!c.alive) continue;
        const cdx = px - c.position.x, cdy = py - c.position.y;
        if (cdx * cdx + cdy * cdy < c.radius * c.radius) {
          c.alive = false;
          const grant = this._pickCollectableGrant();
          station.team.addStock(grant.id, grant.charges);
        this._creditCollectableStat(station, grant);
          this.gs.vfxList.push(this._makeCollectableShatterVFX(c));
          const [cr, cg, cb] = station.team.colour;
          this.gs.vfxList.push({ type: 'collectableGrant', x: c.position.x, y: c.position.y, text: grant.label, colour: `rgb(${cr},${cg},${cb})`, t: 0, duration: 2.0 });
        }
      }

      // Planet — reflect off solid bodies, pass through the rest
      for (const planet of this.gs.planets) {
        if (planet.destroyed) continue;
        const R = planet.impactRadius;
        const dx = px - planet.position.x, dy = py - planet.position.y;
        if (dx * dx + dy * dy < R * R) {
          if (this._isReflectiveBody(planet)) {
            const d = Math.sqrt(dx * dx + dy * dy) || 1, nx = dx / d, ny = dy / d, dot = vx * nx + vy * ny;
            vx -= 2 * dot * nx; vy -= 2 * dot * ny;
            px = planet.position.x + nx * (R + 0.5); py = planet.position.y + ny * (R + 0.5);
            path.push(new Vec2(px, py)); bounces++;
          }
          break;
        }
      }
      if (bounces >= MAX_BOUNCES) break;
    }
    return { path, target };
  }

  // Apply a freeze/shock condition from a beam hit; armour absorbs one layer.
  _applyBeamCondition(station, kind, amount) {
    if ((station.armourLayers ?? 0) > 0) {
      station.armourLayers--;
      station.armourFlash = 1.0;
      return;
    }
    if (kind === 'frozen') {
      station.frozen = Math.min(3, (station.frozen ?? 0) + amount);
      station.frozenFlash = 1.0;
    } else {
      station.electrified = Math.min(3, (station.electrified ?? 0) + amount);
      station.electrifiedFlash = 1.0;
    }
    this._notifyCondition(station, kind);
  }

  // ─── Unstable planet eruptions (spec/unstable-planets-spec.md §4) ──────────

  // Trigger an eruption at contact point (x,y) on an unstable planet. `owner` is
  // the station whose projectile struck it — credited for any kill/condition,
  // propagated through chains. Honours the per-planet re-eruption cooldown.
  // `generation` bounds the chain: 0 = bullet-triggered (full eruption); a payload
  // that triggers another planet passes its generation + 1. Gen 1 is a small burst
  // (2–3 ejecta); gen 2+ is visual-only (no payload), so cascades can't run away.
  // There is intentionally NO per-planet cooldown — every impact triggers (so a
  // Triple Cannon triple-triggers); the generation cap keeps the total bounded.
  _triggerEruption(planet, x, y, owner, generation = 0) {
    if (!planet || planet.destroyed || !isUnstable(planet.type)) return;

    // Outward surface normal at the contact point
    let nx = x - planet.position.x;
    let ny = y - planet.position.y;
    const nLen = Math.hypot(nx, ny) || 1;
    nx /= nLen; ny /= nLen;
    const ox = planet.position.x + nx * (planet.radius + 0.5);
    const oy = planet.position.y + ny * (planet.radius + 0.5);
    const baseAngle = Math.atan2(ny, nx);
    const [gr, gg, gb] = UNSTABLE_GLOW[planet.type] ?? [255, 200, 80];
    const vEsc = Math.sqrt(2 * G * planet.mass / Math.max(1, planet.radius));
    const params = { kind: planet.type, owner, sourcePlanet: planet, ox, oy, nx, ny, baseAngle, vEsc, gr, gg, gb, generation };
    const flash = (dur) => this.gs.vfxList.push({ type: 'eruptionFlash', x: ox, y: oy, r: gr, g: gg, b: gb, t: 0, duration: dur });

    // Beam: a piercing laser with a CHARGE-UP. On impact it starts a precursor particle
    // build-up at the contact point; after BEAM_CHARGE_STEPS the laser fires, then the
    // particles calm down (handled in _stepBeamEruption). Gen 2+ is visual only — a flash
    // + debris, no laser. Its hits chain at generation+1.
    if (planet.type === PlanetType.BEAM) {
      flash(generation === 0 ? 0.4 : 0.3);
      if (generation >= 2) { this._spawnEruptionDebris(params, 4, 1.0); return; }
      const chargeSound = SoundManager.playHandle('laserCharged');
      this.gs.eruptions.push({
        ...params, beam: true, chain: generation > 0,
        age: 0, chargeSteps: BEAM_CHARGE_STEPS, calmSteps: BEAM_CALM_STEPS, fired: false, chargeSound,
      });
      return;
    }

    // Electro: a forked lightning strike that grows out into the map (one segment per
    // path per frame), electrifying anything it touches, then holds and fades. Gen 2+ is
    // visual only. Gen 1 is a shorter strike.
    if (planet.type === PlanetType.ELECTRO) {
      flash(generation === 0 ? 0.5 : 0.35);
      if (generation >= 2) { this._spawnEruptionDebris(params, 4, 1.0); return; }
      SoundManager.play('laser', { pitch: 0.3 });
      this._spawnLightning({
        ox, oy, angle: baseAngle, owner, generation, chain: generation > 0,
        colour: [gr, gg, gb], sourcePlanet: planet,
        maxSegments: generation === 0 ? LIGHTNING_MAX_SEGMENTS : Math.round(LIGHTNING_MAX_SEGMENTS * 0.4),
      });
      return;
    }

    // Pyro / Cryo — a drawn-out rumble SEQUENCE at EVERY generation (so chained
    // eruptions rumble just like the primary), scaled down as it chains:
    //   gen 0 = full, long sequence with 1 → 2–3 → 1–2 ejecta waves
    //   gen 1 = shorter rumble, 2–3 ejecta over two waves
    //   gen 2+ = shorter rumble, NO ejecta (visual only) — cascade ends here
    if (generation < 2) SoundManager.playRandom(['explosionSmall', 'explosionSmall2', 'explosionSmall3']);
    flash(generation === 0 ? 0.5 : 0.35);
    const durScale = generation === 0 ? 1 : generation === 1 ? 0.6 : 0.42;
    const duration = Math.floor(ERUPTION_DURATION_STEPS * durScale * (0.8 + this.rng.next() * 0.4));
    let waves;
    if (generation === 0) {
      waves = [
        { at: Math.floor(duration * 0.30), count: 1,                                  fired: false, big: false },
        { at: Math.floor(duration * 0.60), count: 2 + Math.floor(this.rng.next() * 2), fired: false, big: true  }, // 2–3
        { at: Math.floor(duration * 0.88), count: 1 + Math.floor(this.rng.next() * 2), fired: false, big: false }, // 1–2
      ];
    } else if (generation === 1) {
      waves = [
        { at: Math.floor(duration * 0.40), count: 1,                                  fired: false, big: false },
        { at: Math.floor(duration * 0.78), count: 1 + Math.floor(this.rng.next() * 2), fired: false, big: true  }, // 1–2 (total 2–3)
      ];
    } else {
      waves = []; // gen 2+: rumble only, no ejecta
    }
    this.gs.eruptions.push({ ...params, chain: generation > 0, age: 0, duration, nextMiniAt: 0, waves });
  }

  // Advance every active eruption sequence one step: emit escalating mini-bursts
  // at random overlapping intervals and fire the lethal ejecta waves on schedule.
  _stepEruptions() {
    for (const seq of this.gs.eruptions) {
      if (seq.beam) { this._stepBeamEruption(seq); continue; }
      seq.age++;
      // Mini-bursts — escalate then taper across the sequence (sine envelope)
      if (seq.age >= seq.nextMiniAt && seq.age < seq.duration) {
        const env      = Math.sin((seq.age / seq.duration) * Math.PI); // 0 → 1 → 0
        const strength = 2 + Math.floor(env * 8 * (0.5 + this.rng.next() * 0.6));
        this._spawnEruptionDebris(seq, strength, 0.6 + env * 0.8);
        seq.nextMiniAt = seq.age + ERUPTION_MINI_MIN_GAP +
          Math.floor(this.rng.next() * (ERUPTION_MINI_MAX_GAP - ERUPTION_MINI_MIN_GAP));
      }
      // Ejecta waves — each accompanied by its own flash + debris burst
      for (const w of seq.waves) {
        if (w.fired || seq.age < w.at) continue;
        w.fired = true;
        this.gs.vfxList.push({ type: 'eruptionFlash', x: seq.ox, y: seq.oy, r: seq.gr, g: seq.gg, b: seq.gb,
          t: 0, duration: w.big ? 0.55 : 0.4 });
        this._spawnEruptionDebris(seq, w.big ? 14 : 8, w.big ? 1.6 : 1.1);
        this._spawnEjectaWave(seq, w.count);
      }
    }
    // A sequence is done once it has run its full duration and fired every wave (or, for
    // a beam, once it has fired and finished its calm-down). Stop a finished beam's sounds
    // so the laser/charge audio can't outlive the eruption.
    this.gs.eruptions = this.gs.eruptions.filter(s => {
      if (s.beam) {
        const alive = !s.fired || (s.age - s.chargeSteps) < s.calmSteps;
        if (!alive) { this._stopSound(s.chargeSound); this._stopSound(s.beamSound); }
        return alive;
      }
      return s.age < s.duration || s.waves.some(w => !w.fired);
    });
  }

  // Beam charge sequence: build precursor particles at the contact point, fire the laser
  // when the charge completes, then taper the particles off.
  _stepBeamEruption(seq) {
    seq.age++;
    if (!seq.fired) {
      // Build-up: converging "charging" particles, intensifying toward the fire moment
      const prog = Math.min(1, seq.age / seq.chargeSteps);
      if (this.rng.next() < 0.04 + prog * 0.13) this._spawnBeamCharge(seq);
      if (seq.age >= seq.chargeSteps) {
        seq.fired = true;
        this._stopSound(seq.chargeSound); seq.chargeSound = null; // charge done → silence it
        this.gs.vfxList.push({ type: 'eruptionFlash', x: seq.ox, y: seq.oy, r: seq.gr, g: seq.gg, b: seq.gb, t: 0, duration: 0.55 });
        seq.beamSound = SoundManager.playHandle('laserBeam'); // stoppable so it can't outlive the beam
        const path = this._simulateUnstableBeamPath(seq.ox, seq.oy, seq.baseAngle, seq.owner, seq.sourcePlanet, seq.generation);
        this.gs.vfxList.push({ type: 'laserPath', path, colour: [...UNSTABLE_GLOW.beam], t: 0, duration: 1.2 });
        this._spawnEruptionDebris(seq, 12, 1.5); // muzzle burst as it discharges
      }
    } else {
      // Calm-down: a tapering scatter of sparks dissipating from the muzzle
      const taper = 1 - (seq.age - seq.chargeSteps) / seq.calmSteps;
      if (taper > 0 && this.rng.next() < taper * 0.12) this._spawnEruptionDebris(seq, 1, 0.7);
    }
  }

  // One converging "charging" particle: spawn on a ring around the contact point, moving
  // inward toward it so the energy looks like it's gathering before the laser fires.
  _spawnBeamCharge(seq) {
    if (this.gs.eruptionDebris.length >= MAX_ERUPTION_DEBRIS) return;
    const r  = seq.sourcePlanet?.radius ?? 30;
    const a  = this.rng.next() * Math.PI * 2;
    const cr = r * (0.3 + this.rng.next() * 0.4);
    const px = seq.ox + Math.cos(a) * cr, py = seq.oy + Math.sin(a) * cr;
    const dx = seq.ox - px, dy = seq.oy - py, dd = Math.hypot(dx, dy) || 1;
    const sp = cr / 40; // converge onto the point over roughly its lifetime
    this.gs.eruptionDebris.push({
      x: px, y: py,
      vx: (dx / dd) * sp, vy: (dy / dd) * sp,
      t: 0, dt: 1 / (250 * (0.6 + this.rng.next() * 0.6)),
      size: 0.7 + this.rng.next() * 1.3,
      r: seq.gr, g: seq.gg, b: seq.gb,
    });
  }

  // Stop a held sound source (e.g. a beam charge) if it's still playing.
  _stopSound(src) { if (src) { try { src.stop(); } catch (_) {} } }

  // Silence the charge sound of any beam eruption that hasn't fired yet (used before
  // clearing eruptions, so neither the charge hum nor the laser sound can outlive a beam.
  _silencePendingBeams() {
    for (const e of this.gs.eruptions) {
      if (!e.beam) continue;
      this._stopSound(e.chargeSound); e.chargeSound = null;
      this._stopSound(e.beamSound);   e.beamSound = null;
    }
  }

  // Spawn `count` lethal pyro/cryo blobs from an eruption sequence.
  _spawnEjectaWave(seq, count) {
    for (let i = 0; i < count; i++) {
      if (this.gs.ejecta.length >= MAX_EJECTA) break;
      const spread = (this.rng.next() * 2 - 1) * EJECTA_SPREAD_DEG * Math.PI / 180;
      const a      = seq.baseAngle + spread;
      const speed  = seq.vEsc * (EJECTA_MIN_FRAC + this.rng.next() * (EJECTA_MAX_FRAC - EJECTA_MIN_FRAC)) * EJECTA_VELOCITY_FACTOR;
      const jit    = (this.rng.next() - 0.5) * 1.5;
      this.gs.ejecta.push(new Ejecta({
        position:    new Vec2(seq.ox - seq.ny * jit, seq.oy + seq.nx * jit),
        velocity:    new Vec2(Math.cos(a) * speed, Math.sin(a) * speed),
        kind: seq.kind, owner: seq.owner, sourcePlanet: seq.sourcePlanet,
        launchDelay: 0,
        maxLifetime: EJECTA_MAX_LIFETIME,
        maxRadius:   EJECTA_MAX_RADIUS * (0.85 + this.rng.next() * 0.3),
        generation:  seq.generation ?? 0,
      }));
    }
  }

  // Spawn `n` small cosmetic debris particles (no gameplay effect) for a mini-burst.
  // `vScale` widens the velocity spread for the stronger bursts.
  _spawnEruptionDebris(seq, n, vScale = 1) {
    const base = seq.vEsc * 0.28 * vScale;
    for (let i = 0; i < n; i++) {
      if (this.gs.eruptionDebris.length >= MAX_ERUPTION_DEBRIS) break;
      const a     = seq.baseAngle + (this.rng.next() * 2 - 1) * (EJECTA_SPREAD_DEG + 15) * Math.PI / 180;
      const speed = base * (0.4 + this.rng.next() * 0.9);
      this.gs.eruptionDebris.push({
        x: seq.ox, y: seq.oy,
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        t: 0, dt: 1 / (ERUPTION_DEBRIS_LIFE * (0.6 + this.rng.next() * 0.8)),
        size: 1.0 + this.rng.next() * 2.2,
        r: seq.gr, g: seq.gg, b: seq.gb,
      });
    }
  }

  // Step cosmetic eruption debris: stronger gravity, then fade out.
  _stepEruptionDebris() {
    const { gw, gh } = this.physics;
    for (const d of this.gs.eruptionDebris) {
      for (const planet of this.gs.planets) {
        if (planet.destroyed) continue;
        const dx = planet.position.x - d.x, dy = planet.position.y - d.y;
        const rSq = dx * dx + dy * dy;
        if (rSq < 0.01) continue;
        const sign = dx < 0 ? -1 : 1;
        const theta = Math.atan(dy / dx);
        const accel = sign * G * planet.mass / rSq * ERUPTION_DEBRIS_GRAV;
        d.vx += Math.cos(theta) * accel * TIMESTEP;
        d.vy += Math.sin(theta) * accel * TIMESTEP;
      }
      d.x += d.vx * TIMESTEP; d.y += d.vy * TIMESTEP;
      d.t += d.dt;
      if (d.x < -gw || d.x > 2 * gw || d.y < -gw || d.y > gh + gw) d.t = 1;
    }
    this.gs.eruptionDebris = this.gs.eruptionDebris.filter(d => d.t < 1);
  }

  // Step all ejecta one physics step: gravity (pyro/cryo), straight (electro),
  // then resolve shield / station / planet collisions and chain reactions.
  _stepEjecta(allStations) {
    const { gw, gh } = this.physics;
    for (const e of this.gs.ejecta) {
      if (e.dead) continue;
      if (e.launchDelay > 0) { e.launchDelay--; continue; }

      if (e.kind !== EjectaKind.ELECTRO) {
        let vx = e.velocity.x, vy = e.velocity.y;
        for (const planet of this.gs.planets) {
          if (planet.destroyed) continue;
          const dx = planet.position.x - e.position.x;
          const dy = planet.position.y - e.position.y;
          const rSq = dx * dx + dy * dy;
          if (rSq < 0.01) continue;
          const sign  = dx < 0 ? -1 : 1;
          const theta = Math.atan(dy / dx);
          const accel = sign * G * planet.mass / rSq * EJECTA_GRAVITY_FACTOR;
          vx += Math.cos(theta) * accel * TIMESTEP;
          vy += Math.sin(theta) * accel * TIMESTEP;
        }
        e.velocity = new Vec2(vx, vy);
      }

      e.position = new Vec2(e.position.x + e.velocity.x * TIMESTEP, e.position.y + e.velocity.y * TIMESTEP);
      e.lifetime++;

      // Blob growth — fast then easing to full size (ease-out cubic), then holds
      if (e.maxRadius > 0) {
        const p = Math.min(1, e.lifetime / EJECTA_GROW_STEPS);
        e.radius = e.maxRadius * (1 - Math.pow(1 - p, 3));
      } else if (e.lifetime % 2 === 0) {
        // Electro bolt — keep a short trail for the lightning look
        e.trail.push(new Vec2(e.position.x, e.position.y));
        if (e.trail.length > 12) e.trail.shift();
      }

      if (e.lifetime >= e.maxLifetime) { e.dead = true; continue; }
      const px = e.position.x, py = e.position.y;
      if (px < -gw || px > 2 * gw || py < -gw || py > gh + gw) { e.dead = true; continue; }
      const er = e.radius;

      // Shield block (the blob edge counts)
      let blocked = false;
      for (const shield of this.gs.shields) {
        if (!shield.alive) continue;
        const dx = px - shield.station.position.x, dy = py - shield.station.position.y;
        const rr = shield.radius + er;
        if (dx * dx + dy * dy < rr * rr) { blocked = true; break; }
      }
      if (blocked) { e.dead = true; continue; }

      // Station collision — apply effect to the first station the blob touches
      let hitStation = null;
      for (const s of allStations) {
        if (s.status !== 'active') continue;
        const dx = px - s.position.x, dy = py - s.position.y;
        const rr = s.radius + er;
        if (dx * dx + dy * dy < rr * rr) { hitStation = s; break; }
      }
      if (hitStation) { this._applyEjectaToStation(e, hitStation); e.dead = true; continue; }

      // Planet collision
      for (const planet of this.gs.planets) {
        if (planet.destroyed || planet.type === PlanetType.GAS_GIANT) continue;
        const dx = planet.position.x - px, dy = planet.position.y - py;
        const d2 = dx * dx + dy * dy;
        if (planet === e.sourcePlanet) {
          // Source planet absorbs only when the blob CENTRE falls back inside it,
          // so a growing blob isn't eaten by its own surface as it leaves.
          if (d2 < planet.radius * planet.radius) { e.dead = true; break; }
          continue;
        }
        const reach = planet.impactRadius + er;
        if (d2 >= reach * reach) continue;
        if (isUnstable(planet.type)) { this._triggerEruption(planet, px, py, e.owner, (e.generation ?? 0) + 1); e.dead = true; break; }
        if (e.kind === EjectaKind.PYRO &&
            (planet.type === PlanetType.ASTEROID || planet.type === PlanetType.CRYSTAL)) {
          planet.destroyed = true;                                     // pyro fragments asteroids
          if (e.owner?.stats) e.owner.stats.rockHits++;
        }
        e.dead = true; break;                                          // absorbed by any other planet
      }
    }
    this.gs.ejecta = this.gs.ejecta.filter(e => !e.dead);
  }

  // Emit short-lived comet-style smoke puffs from live pyro/cryo blobs — once per
  // frame so the count stays bounded and game-speed independent.
  _emitEjectaSmoke() {
    for (const e of this.gs.ejecta) {
      if (e.dead || e.launchDelay > 0) continue;
      if (e.kind !== EjectaKind.PYRO && e.kind !== EjectaKind.CRYO) continue;
      const [sr, sg, sb] = e.kind === EjectaKind.PYRO ? [255, 140, 50] : [205, 235, 255];
      this.gs.cometSmoke.push({
        x: e.position.x + (this.rng.next() - 0.5) * e.radius,
        y: e.position.y + (this.rng.next() - 0.5) * e.radius,
        maxR: 1.2 + this.rng.next() * 2.0, dt: 1 / 24, fast: true, t: 0,
        r: sr, g: sg, b: sb,
      });
    }
  }

  // Create one forked-lightning strike (see spec/forked-lightning-spec.md). Reusable for
  // any electric shock: pass the origin, launch angle, owner, colour, segment budget, the
  // shock strength to apply on a station hit, and whether it may chain unstable planets.
  _spawnLightning({ ox, oy, angle, owner, generation = 0, chain = false, colour,
                    maxSegments = LIGHTNING_MAX_SEGMENTS, sourcePlanet = null,
                    shockAmount = 1, noChain = false }) {
    this.gs.lightning.push({
      owner, sourcePlanet, generation, chain,
      r: colour[0], g: colour[1], b: colour[2],
      segments: [],                                  // {x1,y1,x2,y2} placed bolt segments
      heads: [{ x: ox, y: oy, angle }],              // active growing path heads
      total: 0, maxSegments,
      phase: 'growing', holdT: 0, alpha: 1,
      hitStations: new Set(), hitPlanets: new Set(),
      shockAmount, noChain,
    });
  }

  // Shock Rocket burst: fire SHOCK_BOLT_COUNT forked bolts radiating in all directions
  // from (x,y), each electrifying anything it touches. Replaces the old expanding blast.
  _spawnShockBurst(x, y, owner, shockAmount) {
    // A Shock Rocket usually detonates on/inside the planet it struck. If the burst point
    // sits within a solid planet, every bolt would otherwise lay its first segment inside
    // that planet and ground out immediately. So when we're inside a planet, start each
    // bolt just outside that planet's surface along its own outward direction, pointing
    // radially away — the bolts spray off the surface instead of being absorbed.
    let host = null;
    for (const p of this.gs.planets) {
      if (p.destroyed || p.type === PlanetType.GAS_GIANT) continue;
      const dx = x - p.position.x, dy = y - p.position.y;
      if (dx * dx + dy * dy < p.impactRadius * p.impactRadius) { host = p; break; }
    }

    const base = this.rng.next() * Math.PI * 2;
    for (let i = 0; i < SHOCK_BOLT_COUNT; i++) {
      const angle = base + (i / SHOCK_BOLT_COUNT) * Math.PI * 2 + (this.rng.next() - 0.5) * 0.35;
      let ox = x, oy = y;
      if (host) {
        // Offset the origin 1 unit from the impact point along this bolt's heading. The
        // outward-heading bolts then emanate right at the impact point; the inward-heading
        // ones still start inside the planet and ground out naturally.
        ox = x + Math.cos(angle) * 1;
        oy = y + Math.sin(angle) * 1;
      }
      this._spawnLightning({
        ox, oy, angle, owner,
        colour: SHOCK_LIGHTNING_COLOUR, maxSegments: SHOCK_BOLT_SEGMENTS,
        shockAmount, noChain: true, chain: false,
      });
    }
  }

  // Advance electro forked-lightning once per rendered frame: while growing, each active
  // path head lays one segment (turning ±30° from the previous, 15% chance to fork a new
  // path) and electrifies anything it crosses; once the segment budget is spent it holds
  // ~1s then fades. Grown per frame (not per sub-step) so it reads as fast lightning.
  _stepLightning(allStations) {
    if (!this.gs.lightning.length) return;

    for (const L of this.gs.lightning) {
      if (L.phase === 'growing') {
        // Stutter: each frame advance the whole strike by a random 0–3 rounds, so it
        // sometimes halts for a beat and sometimes jumps ahead — like real lightning.
        const rounds = Math.floor(this.rng.next() * 4); // 0,1,2,3
        for (let r = 0; r < rounds && L.phase === 'growing'; r++) this._growLightningRound(L, allStations);
      } else if (L.phase === 'hold') {
        if (++L.holdT >= LIGHTNING_HOLD_FRAMES) L.phase = 'fading';
      } else {
        L.alpha -= 1 / LIGHTNING_FADE_FRAMES;
      }
    }
    this.gs.lightning = this.gs.lightning.filter(L => L.alpha > 0);
  }

  // One growth round of a lightning strike: every active head lays a segment.
  _growLightningRound(L, allStations) {
    const { gw, gh } = this.physics;
    const mx0 = -gw * 0.35, mx1 = gw * 1.35, my0 = -gh * 0.35, my1 = gh * 1.35;
    const maxAng = LIGHTNING_MAX_ANGLE * Math.PI / 180;
    const newHeads = [];
    const single = L.heads.length === 1; // a lone path forks more; multiple paths thin out
    const forkAt = (ex, ey, ang) => {
      if (L.total >= L.maxSegments || L.heads.length + newHeads.length >= LIGHTNING_MAX_HEADS) return;
      const fa = ang + (this.rng.next() < 0.5 ? 1 : -1) * (maxAng + this.rng.next() * maxAng);
      newHeads.push({ x: ex, y: ey, angle: fa });
    };
    for (const h of L.heads) {
      if (h.dead || L.total >= L.maxSegments) continue;
      const ang = h.angle + (this.rng.next() * 2 - 1) * maxAng;
      const len = LIGHTNING_SEG_LEN * (0.8 + this.rng.next() * 0.4);
      const ex  = h.x + Math.cos(ang) * len, ey = h.y + Math.sin(ang) * len;
      const seg = { x1: h.x, y1: h.y, x2: ex, y2: ey };
      L.segments.push(seg);
      L.total++;
      const blocker = this._lightningHitCheck(L, h.x, h.y, ex, ey, allStations);
      if (blocker) {
        // Clip the final segment to the planet surface so the bolt grounds cleanly
        const clip = this._clipSegToCircle(h.x, h.y, ex, ey, blocker.position.x, blocker.position.y, blocker.impactRadius);
        seg.x2 = clip.x; seg.y2 = clip.y;
        h.dead = true; continue;
      }
      h.x = ex; h.y = ey; h.angle = ang;
      // A branch also stops when it leaves the map
      if (ex < mx0 || ex > mx1 || ey < my0 || ey > my1) { h.dead = true; continue; }
      if (single) {
        // Lone path: 30% chance to fork a new branch
        if (this.rng.next() < LIGHTNING_FORK_CHANCE) forkAt(ex, ey, ang);
      } else {
        // Multiple paths: a general 10% fork keeps it busy, plus each path has a
        // 5% chance to die off this segment
        if (this.rng.next() < LIGHTNING_FORK_MULTI) forkAt(ex, ey, ang);
        if (this.rng.next() < LIGHTNING_END_CHANCE) h.dead = true;
      }
    }
    L.heads = L.heads.filter(h => !h.dead).concat(newHeads);
    if (L.total >= L.maxSegments || L.heads.length === 0) { L.phase = 'hold'; L.holdT = 0; }
  }

  // A lightning segment electrifies any station it crosses (shield blocks, armour
  // absorbs) and chain-triggers any other unstable planet it touches.
  _lightningHitCheck(L, x1, y1, x2, y2, allStations) {
    for (const s of allStations) {
      if (s.status !== 'active' || L.hitStations.has(s)) continue;
      if (this._segHitsCircle(x1, y1, x2, y2, s.position.x, s.position.y, s.radius)) {
        L.hitStations.add(s);
        const shielded = this.gs.shields.some(sh => sh.alive && sh.station === s);
        if (!shielded) this._applyBeamCondition(s, 'electrified', L.shockAmount ?? 1);
      }
    }
    // Planets stop a branch. The source planet is exempt for the first segment (the bolt
    // emanates from its surface); a different unstable planet also chain-triggers (once),
    // unless this strike is `noChain` (a weapon shock that shouldn't set off planets).
    let blocker = null;
    for (const p of this.gs.planets) {
      if (p.destroyed || p.type === PlanetType.GAS_GIANT) continue; // bolts pass through gas giants
      if (p === L.sourcePlanet && L.total <= 1) continue;           // don't self-block at launch
      if (!this._segHitsCircle(x1, y1, x2, y2, p.position.x, p.position.y, p.impactRadius)) continue;
      if (!L.noChain && isUnstable(p.type) && p !== L.sourcePlanet && !L.hitPlanets.has(p)) {
        L.hitPlanets.add(p);
        this._triggerEruption(p, x2, y2, L.owner, L.generation + 1);
      }
      blocker = p; // hitting any solid planet ends this branch
      break;
    }
    return blocker;
  }

  // Point where segment A→B first reaches `rad` of (cx,cy), clamped to the segment.
  _clipSegToCircle(x1, y1, x2, y2, cx, cy, rad) {
    const dx = x2 - x1, dy = y2 - y1;
    const fx = x1 - cx, fy = y1 - cy;
    const a = dx * dx + dy * dy;
    const b = 2 * (fx * dx + fy * dy);
    const c = fx * fx + fy * fy - rad * rad;
    let disc = b * b - 4 * a * c;
    if (a < 1e-9 || disc < 0) return { x: x2, y: y2 };
    disc = Math.sqrt(disc);
    let t = (-b - disc) / (2 * a);
    if (t < 0) t = (-b + disc) / (2 * a);
    t = Math.max(0, Math.min(1, t));
    return { x: x1 + t * dx, y: y1 + t * dy };
  }

  // True if segment (x1,y1)-(x2,y2) comes within `rad` of (cx,cy).
  _segHitsCircle(x1, y1, x2, y2, cx, cy, rad) {
    const dx = x2 - x1, dy = y2 - y1;
    const l2 = dx * dx + dy * dy;
    let t = l2 > 0 ? ((cx - x1) * dx + (cy - y1) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    const px = x1 + t * dx, py = y1 + t * dy;
    const ddx = cx - px, ddy = cy - py;
    return ddx * ddx + ddy * ddy <= rad * rad;
  }

  // Apply an ejecta's effect to a station: pyro kills, cryo freezes, electro shocks.
  _applyEjectaToStation(e, station) {
    if (e.kind === EjectaKind.PYRO) {
      const proxy = { owner: e.owner, status: 'active', teleportCount: 0, trickShotDone: false };
      this._resolveStationHit(proxy, station);
    } else if (e.kind === EjectaKind.CRYO) {
      this._applyBeamCondition(station, 'frozen', 1);
    } else {
      this._applyBeamCondition(station, 'electrified', 1);
    }
  }

  // Simulate a Beam planet's laser from origin (ox,oy) along angleRad. Pierces and
  // destroys stations, shatters asteroids, reflects off shields/blue rifts, chains
  // to other unstable planets, and is absorbed by solid bodies. Returns the path.
  _simulateUnstableBeamPath(ox, oy, angleRad, owner, sourcePlanet, generation = 0) {
    const LASER_SPEED = 160, LASER_GRAVITY = 1.0, MAX_STEPS = 200;
    let px = ox, py = oy;
    let vx = LASER_SPEED * Math.cos(angleRad);
    let vy = LASER_SPEED * Math.sin(angleRad);
    const path  = [new Vec2(px, py)];
    const proxy = { owner, status: 'active', teleportCount: 0, trickShotDone: false };
    const { gw, gh } = this.physics;

    for (let step = 0; step < MAX_STEPS; step++) {
      for (const planet of this.gs.planets) {
        if (planet.destroyed) continue;
        const dx = planet.position.x - px, dy = planet.position.y - py;
        const rSq = dx * dx + dy * dy;
        if (rSq < 0.01) continue;
        const sign  = dx < 0 ? -1 : 1;
        const theta = Math.atan(dy / dx);
        const accel = sign * LASER_GRAVITY * G * planet.mass / rSq;
        vx += Math.cos(theta) * accel * TIMESTEP;
        vy += Math.sin(theta) * accel * TIMESTEP;
      }
      const px0 = px, py0 = py;
      px += vx * TIMESTEP; py += vy * TIMESTEP;
      path.push(new Vec2(px, py));
      if (px < -gw || px > 2 * gw || py < -gw || py > gh + gw) break;

      if (this._hasReflectiveRift) {
        const rb = PhysicsEngine._reflectOffRifts(px0, py0, px, py, vx, vy, this.gs.rifts);
        if (rb) { px = rb.x; py = rb.y; vx = rb.vx; vy = rb.vy; path.push(new Vec2(px, py)); continue; }
      }

      let reflected = false;
      for (const shield of this.gs.shields) {
        if (!shield.alive) continue;
        const dx = px - shield.station.position.x, dy = py - shield.station.position.y;
        if (dx * dx + dy * dy < shield.radius ** 2) {
          const d = Math.sqrt(dx * dx + dy * dy) || 1, nx = dx / d, ny = dy / d, dot = vx * nx + vy * ny;
          vx -= 2 * dot * nx; vy -= 2 * dot * ny;
          px = shield.station.position.x + nx * (shield.radius + 0.5);
          py = shield.station.position.y + ny * (shield.radius + 0.5);
          path.push(new Vec2(px, py)); reflected = true; break;
        }
      }
      if (reflected) continue;

      for (const s of this.gs.allStations) {
        if (s.status !== 'active') continue;
        const sdx = px0 - s.position.x, sdy = py0 - s.position.y;
        const segDx = px - px0, segDy = py - py0;
        const a = segDx * segDx + segDy * segDy;
        const b = 2 * (sdx * segDx + sdy * segDy);
        const c = sdx * sdx + sdy * sdy - s.radius * s.radius;
        const disc = b * b - 4 * a * c;
        if (disc < 0) continue;
        const sq = Math.sqrt(disc);
        const t1 = (-b - sq) / (2 * a), t2 = (-b + sq) / (2 * a);
        if ((t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1)) this._resolveStationHit(proxy, s);
      }

      let blocked = false;
      for (const planet of this.gs.planets) {
        if (planet.destroyed || planet.type === PlanetType.GAS_GIANT) continue;
        const R = planet.impactRadius;
        const dx = planet.position.x - px, dy = planet.position.y - py;
        if (dx * dx + dy * dy >= R * R) continue;
        if (planet === sourcePlanet) continue; // fires outward — never re-trigger its own source
        if (isUnstable(planet.type)) { this._triggerEruption(planet, px, py, owner, generation + 1); blocked = true; break; }
        if (planet.type === PlanetType.ASTEROID || planet.type === PlanetType.CRYSTAL) {
          planet.destroyed = true; this._spawnAsteroidExplosion(planet);
        } else {
          blocked = true;
        }
        break;
      }
      if (blocked) break;
    }
    return path;
  }

  // Theft Beam hit — steal all stock of 2 random weapons from the target's team
  // and transfer them to the firer's team. Shows grant labels in firer's colour.
  _applyTheftBeam(firer, target) {
    if ((target.armourLayers ?? 0) > 0) {
      target.armourLayers--;
      target.armourFlash = 1.0;
      return;
    }
    const targetTeam = target.team;
    const firerTeam  = firer.team;
    if (targetTeam === firerTeam) return;
    const pool = WEAPON_GRANTS.filter(g => targetTeam.getStock(g.id) > 0);
    const stolen = [];
    for (let i = 0; i < 2 && pool.length > 0; i++) {
      const idx = Math.floor(this.rng.next() * pool.length);
      stolen.push(pool.splice(idx, 1)[0]);
    }
    if (stolen.length === 0) return;
    const [fr, fg, fb] = firerTeam.colour;
    for (let i = 0; i < stolen.length; i++) {
      const grant = stolen[i];
      const count = targetTeam.getStock(grant.id);
      targetTeam.weaponStock.set(grant.id, 0);
      firerTeam.addStock(grant.id, count);
      this.gs.vfxList.push({
        type: 'collectableGrant',
        x: target.position.x,
        y: target.position.y - target.radius * (2 + i * 2.5),
        text: grant.label,
        colour: `rgb(${fr},${fg},${fb})`,
        t: 0, duration: 2.0,
      });
    }
  }

  // Simulate super laser path: straight line, no gravity.
  // Kills enemies, destroys asteroids/moons/comets, passes through gas giants + friendlies.
  _simulateSuperLaserPath(station, angleDeg) {
    const { gw, gh } = this.physics;
    const MAX_STEPS  = 1200;
    const STEP       = 4;
    const rad  = (((angleDeg % 360) + 360) % 360 * Math.PI) / 180;
    let ddx  = Math.sin(rad), ddy = Math.cos(rad);
    let px = station.position.x + (station.radius + 1) * ddx;
    let py = station.position.y + (station.radius + 1) * ddy;
    const path = [new Vec2(px, py)];
    const proxy = { owner: station, status: 'active', teleportCount: 0, trickShotDone: false, superLaser: true };
    const hitStations = new Set();
    const moonsToDestroy = [];
    let solidPlanetHit = null;
    let hazardHitPos   = null;

    for (let step = 0; step < MAX_STEPS; step++) {
      const px0 = px, py0 = py;
      px += ddx * STEP;
      py += ddy * STEP;
      path.push(new Vec2(px, py));
      if (px < -gw || px > 2 * gw || py < -gw || py > gh + gw) break;

      // Reflective (blue) rift bounce — the super laser ricochets off blue rifts
      if (this._hasReflectiveRift) {
        const rb = PhysicsEngine._reflectOffRifts(px0, py0, px, py, ddx, ddy, this.gs.rifts);
        if (rb) { px = rb.x; py = rb.y; ddx = rb.vx; ddy = rb.vy; path.push(new Vec2(px, py)); continue; }
      }

      // Enemy station hits — swept segment vs circle so the wide step can't skip small ships
      for (const s of this.gs.allStations) {
        if (s.status !== 'active' || hitStations.has(s) || s.team === station.team) continue;
        const sdx = px0 - s.position.x, sdy = py0 - s.position.y;
        const segDx = px - px0, segDy = py - py0;
        const a    = segDx * segDx + segDy * segDy;
        const b    = 2 * (sdx * segDx + sdy * segDy);
        const c    = sdx * sdx + sdy * sdy - s.radius * s.radius;
        const disc = b * b - 4 * a * c;
        if (disc < 0) continue;
        const sq = Math.sqrt(disc);
        const t1 = (-b - sq) / (2 * a);
        const t2 = (-b + sq) / (2 * a);
        if ((t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1)) {
          hitStations.add(s);
          this._resolveStationHit(proxy, s);
        }
      }

      // Planet hits
      let blocked = false;
      for (const planet of this.gs.planets) {
        if (planet.destroyed) continue;
        const pdx = planet.position.x - px, pdy = planet.position.y - py;
        if (pdx * pdx + pdy * pdy >= planet.impactRadius * planet.impactRadius) continue;
        if (planet.type === PlanetType.GAS_GIANT) continue;
        if (planet.type === PlanetType.WORMHOLE_PAIRED || planet.type === PlanetType.WORMHOLE_CYCLIC ||
            planet.type === PlanetType.WORMHOLE_RANDOM || planet.type === PlanetType.WORMHOLE_PLANET ||
            planet.type === PlanetType.WORMHOLE_SELF   || planet.type === PlanetType.WORMHOLE_NETWORK) continue;
        if (planet.type === PlanetType.ASTEROID || planet.type === PlanetType.CRYSTAL) {
          planet.destroyed = true; continue;
        }
        if (planet.type === PlanetType.COMET) {
          planet.destroyed = true; continue;
        }
        if (planet.type === PlanetType.MOON || planet.type === PlanetType.GIANT_ASTEROID) {
          if (!moonsToDestroy.includes(planet)) moonsToDestroy.push(planet);
          planet.destroyed = true; continue;
        }
        if (planet.type === PlanetType.STAR || planet.type === PlanetType.BLACK_HOLE ||
            planet.type === PlanetType.WHITE_DWARF || planet.type === PlanetType.PULSAR ||
            planet.type === PlanetType.WHITE_HOLE) {
          hazardHitPos = { x: px, y: py };
          blocked = true; break;
        }
        // Solid planet: destroy, fragment, stop beam
        solidPlanetHit = planet;
        blocked = true; break;
      }
      if (blocked) break;

      // Collectables
      for (const c of this.gs.collectables) {
        if (!c.alive) continue;
        const cdx = px - c.position.x, cdy = py - c.position.y;
        if (cdx * cdx + cdy * cdy < c.radius * c.radius) {
          c.alive = false;
          const grant = this._pickCollectableGrant();
          station.team.addStock(grant.id, grant.charges);
        this._creditCollectableStat(station, grant);
          if (this.gs.storyState && station.team.isHuman) this.gs.storyState.collectCount++;
          this.gs.vfxList.push(this._makeCollectableShatterVFX(c));
          const [cr, cg, cb] = station.team.colour;
          this.gs.vfxList.push({ type: 'collectableGrant', x: c.position.x, y: c.position.y, text: grant.label, colour: `rgb(${cr},${cg},${cb})`, t: 0, duration: 2.0 });
        }
      }
    }

    // Fragment moons destroyed along the path
    for (const moon of moonsToDestroy) {
      const idx = this.gs.planets.indexOf(moon);
      if (idx !== -1) this.gs.planets.splice(idx, 1);
      if (moon.type === PlanetType.GIANT_ASTEROID) this._fragmentGiantAsteroid(moon);
      else this._fragmentMoon(moon);
      this._spawnAsteroidExplosion(moon);
    }

    // Solid planet destruction + fragment + blast
    if (solidPlanetHit) {
      const planet = solidPlanetHit;
      const idx = this.gs.planets.indexOf(planet);
      if (idx !== -1) this.gs.planets.splice(idx, 1);
      this._fragmentMoon(planet);
      this._spawnAsteroidExplosion(planet);
      this.gs.rocketBlasts.push({ x: planet.position.x, y: planet.position.y,
        maxRadius: ROCKET_BLAST_RADIUS * 2, currentRadius: 1, owner: station, hitSet: new Set() });
    }

    // Hazard contact: blast at contact point
    if (hazardHitPos) {
      this.gs.rocketBlasts.push({ x: hazardHitPos.x, y: hazardHitPos.y,
        maxRadius: ROCKET_BLAST_RADIUS * 2, currentRadius: 1, owner: station, hitSet: new Set() });
    }

    return path;
  }

  // Simulate mind control beam path: gravity-affected, stops at first hard surface or station.
  // Converts the first enemy station it hits; friendly stations block it without conversion.
  _simulateMindControlPath(station, angleDeg) {
    const LASER_SPEED   = 160;
    const LASER_GRAVITY = 1.0;
    const MAX_STEPS     = 200;
    const rad = (((angleDeg % 360) + 360) % 360 * Math.PI) / 180;
    let px = station.position.x + (station.radius + 1) * Math.sin(rad);
    let py = station.position.y + (station.radius + 1) * Math.cos(rad);
    let vx = LASER_SPEED * Math.sin(rad);
    let vy = LASER_SPEED * Math.cos(rad);
    const path  = [new Vec2(px, py)];
    const proxy = { owner: station, status: 'active', teleportCount: 0, trickShotDone: false };
    const { gw, gh } = this.physics;

    for (let step = 0; step < MAX_STEPS; step++) {
      for (const planet of this.gs.planets) {
        if (planet.destroyed) continue;
        const dx  = planet.position.x - px;
        const dy  = planet.position.y - py;
        const rSq = dx * dx + dy * dy;
        if (rSq < 0.01) continue;
        const sign  = dx < 0 ? -1 : 1;
        const theta = Math.atan(dy / dx);
        const accel = sign * LASER_GRAVITY * G * planet.mass / rSq;
        vx += Math.cos(theta) * accel * TIMESTEP;
        vy += Math.sin(theta) * accel * TIMESTEP;
      }
      const px0 = px, py0 = py;
      px += vx * TIMESTEP;
      py += vy * TIMESTEP;
      path.push(new Vec2(px, py));

      if (px < -gw || px > 2 * gw || py < -gw || py > gh + gw) break;

      // Reflective (blue) rift bounce — mirror the beam off any segment it crossed
      if (this._hasReflectiveRift) {
        const rb = PhysicsEngine._reflectOffRifts(px0, py0, px, py, vx, vy, this.gs.rifts);
        if (rb) { px = rb.x; py = rb.y; vx = rb.vx; vy = rb.vy; path.push(new Vec2(px, py)); continue; }
      }

      // Station hit — swept segment check
      let stationBlocked = false;
      for (const s of this.gs.allStations) {
        if (s.status !== 'active' || s === station) continue;
        const sdx = px0 - s.position.x, sdy = py0 - s.position.y;
        const segDx = px - px0, segDy = py - py0;
        const a    = segDx * segDx + segDy * segDy;
        const b    = 2 * (sdx * segDx + sdy * segDy);
        const c    = sdx * sdx + sdy * sdy - s.radius * s.radius;
        const disc = b * b - 4 * a * c;
        if (disc < 0) continue;
        const sq = Math.sqrt(disc);
        const t1 = (-b - sq) / (2 * a);
        const t2 = (-b + sq) / (2 * a);
        if ((t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1)) {
          if (s.team !== station.team) this._convertStation(station, s);
          stationBlocked = true;
          break;
        }
      }
      if (stationBlocked) break;

      // Planet hit — asteroids shatter, solid planets stop beam
      let blocked = false;
      for (const planet of this.gs.planets) {
        if (planet.destroyed) continue;
        const R  = planet.impactRadius;
        const dx = planet.position.x - px;
        const dy = planet.position.y - py;
        if (dx * dx + dy * dy < R * R) {
          if (planet.type === PlanetType.ASTEROID || planet.type === PlanetType.CRYSTAL) {
            planet.destroyed = true;
            this._spawnAsteroidExplosion(planet);
          } else if (planet.type !== PlanetType.GAS_GIANT) {
            blocked = true;
          }
          break;
        }
      }
      if (blocked) break;
    }
    return path;
  }

  // Transfer an enemy station to the firing station's team.
  _convertStation(firingStation, target) {
    const oldTeam = target.team;
    const newTeam = firingStation.team;
    const idx = oldTeam.stations.indexOf(target);
    if (idx !== -1) oldTeam.stations.splice(idx, 1);
    newTeam.stations.push(target);
    target.team  = newTeam;
    target.role  = newTeam.isHuman ? 'human' : 'ai';
    target.mindControlFlash = 1.0;
    firingStation.stats.kills++;
    newTeam.stats.kills++;
    newTeam.stats.score++;
    oldTeam.stats.score--;
  }

  // Spawn a new friendly station at the map edge where the reinforcement signal exited.
  _spawnReinforcementStation(team, x, y, size = StationSize.LARGE) {
    const { gw, gh } = this.physics;
    const r    = size.radius;
    const safeX = Math.max(r + 1, Math.min(gw - r - 1, x));
    const safeY = Math.max(r + 1, Math.min(gh - r - 1, y));
    const id    = `reinf_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const newStation = new Station({
      id,
      team,
      position: new Vec2(safeX, safeY),
      size,
    });
    newStation.role = team.isHuman ? 'human' : 'ai';
    const [r1, g1, b1] = team.colour;
    newStation.shockwave = { t: 0, r: r1, g: g1, b: b1 };
    team.stations.push(newStation);
  }

  // Find a safe teleport destination along the travel direction.
  _findSafeTeleportDest(station, rawX, rawY, gw, gh) {
    const sr  = station.radius;
    const clampX = x => Math.max(sr, Math.min(gw - sr, x));
    const clampY = y => Math.max(sr, Math.min(gh - sr, y));
    let cx = clampX(rawX), cy = clampY(rawY);

    const isClear = (x, y) => {
      for (const planet of this.gs.planets) {
        if (planet.destroyed || planet.type === PlanetType.GAS_GIANT) continue;
        const dx = planet.position.x - x, dy = planet.position.y - y;
        if (dx * dx + dy * dy < (planet.impactRadius + sr + 1) ** 2) return false;
      }
      for (const s of this.gs.allStations) {
        if (s === station || s.status !== 'active') continue;
        const dx = s.position.x - x, dy = s.position.y - y;
        if (dx * dx + dy * dy < (s.radius + sr + 1) ** 2) return false;
      }
      return true;
    };

    if (isClear(cx, cy)) return [cx, cy];

    // Spiral outward from the raw destination to find a clear spot
    for (let r = 2; r <= 60; r += 2) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        const tx = clampX(cx + Math.cos(a) * r);
        const ty = clampY(cy + Math.sin(a) * r);
        if (isClear(tx, ty)) return [tx, ty];
      }
    }
    return [cx, cy]; // fallback: overlapping position
  }

  // Explode a rocket at its current position, applying blast damage.
  _isWormhole(type) {
    return type === PlanetType.WORMHOLE_PAIRED || type === PlanetType.WORMHOLE_CYCLIC ||
           type === PlanetType.WORMHOLE_RANDOM || type === PlanetType.WORMHOLE_NETWORK ||
           type === PlanetType.WORMHOLE_PLANET || type === PlanetType.WORMHOLE_SELF;
  }

  _teleportComet(comet, planet) {
    if ((comet._wormholeTeleports ?? 0) >= 20) { comet.destroyed = true; return; }
    const theta = Math.atan2(
      comet.position.y - planet.position.y,
      comet.position.x - planet.position.x,
    );
    const r = comet.impactRadius + 0.5;
    const { gw, gh } = this.physics;

    switch (planet.type) {
      case PlanetType.WORMHOLE_PAIRED:
      case PlanetType.WORMHOLE_CYCLIC: {
        if (!planet.partner) { comet.destroyed = true; return; }
        const d = planet.partner;
        comet.position = new Vec2(
          d.position.x + Math.cos(theta) * (d.impactRadius + r),
          d.position.y + Math.sin(theta) * (d.impactRadius + r),
        );
        break;
      }
      case PlanetType.WORMHOLE_RANDOM:
        comet.position = new Vec2(Math.random() * gw, Math.random() * gh);
        break;
      case PlanetType.WORMHOLE_NETWORK: {
        const others = this.gs.planets.filter(p => p !== planet && p.type === PlanetType.WORMHOLE_NETWORK && !p.destroyed);
        if (others.length > 0) {
          const dest = others[Math.floor(Math.random() * others.length)];
          comet.position = new Vec2(
            dest.position.x + Math.cos(theta) * (dest.impactRadius + r),
            dest.position.y + Math.sin(theta) * (dest.impactRadius + r),
          );
        } else {
          comet.position = new Vec2(Math.random() * gw, Math.random() * gh);
        }
        break;
      }
      case PlanetType.WORMHOLE_PLANET: {
        const others = this.gs.planets.filter(p => p !== planet && p.type === PlanetType.WORMHOLE_PLANET && !p.destroyed);
        const dest = others.length > 0 ? others[0] : null;
        comet.position = dest
          ? new Vec2(dest.position.x + Math.cos(theta) * (dest.impactRadius + r), dest.position.y + Math.sin(theta) * (dest.impactRadius + r))
          : new Vec2(Math.random() * gw, Math.random() * gh);
        break;
      }
      case PlanetType.WORMHOLE_SELF:
        comet.position = new Vec2(
          planet.position.x + Math.cos(theta + Math.PI) * (planet.impactRadius + r),
          planet.position.y + Math.sin(theta + Math.PI) * (planet.impactRadius + r),
        );
        break;
      default:
        comet.destroyed = true; return;
    }
    comet._wormholeTeleports = (comet._wormholeTeleports ?? 0) + 1;
  }

  _teleportRocket(rocket, planet) {
    if (rocket.teleportCount >= 100) { this._detonateRocket(rocket); return; }
    const dx    = planet.position.x - rocket.position.x;
    const dy    = planet.position.y - rocket.position.y;
    const sign  = dx < 0 ? -1 : 1;
    const theta = Math.atan(dy / dx);
    const theta2 = sign < 0 ? theta + Math.PI : theta;
    const { gw, gh } = this.physics;

    switch (planet.type) {
      case PlanetType.WORMHOLE_PAIRED:
      case PlanetType.WORMHOLE_CYCLIC: {
        if (!planet.partner) { this._detonateRocket(rocket); return; }
        const d = planet.partner;
        rocket.position = new Vec2(
          d.position.x + Math.cos(theta2) * (d.impactRadius + 0.5),
          d.position.y + Math.sin(theta2) * (d.impactRadius + 0.5),
        );
        break;
      }
      case PlanetType.WORMHOLE_RANDOM:
        rocket.position = new Vec2(Math.random() * gw, Math.random() * gh);
        break;
      case PlanetType.WORMHOLE_NETWORK: {
        const others = this.gs.planets.filter(p => p !== planet && p.type === PlanetType.WORMHOLE_NETWORK && !p.destroyed);
        if (others.length > 0) {
          const dest = others[Math.floor(Math.random() * others.length)];
          const a = Math.random() * Math.PI * 2;
          rocket.position = new Vec2(dest.position.x + Math.cos(a) * (dest.impactRadius + 0.5), dest.position.y + Math.sin(a) * (dest.impactRadius + 0.5));
        } else {
          rocket.position = new Vec2(Math.random() * gw, Math.random() * gh);
        }
        break;
      }
      case PlanetType.WORMHOLE_PLANET: {
        const others = this.gs.planets.filter(p => p !== planet && p.type === PlanetType.WORMHOLE_PLANET && !p.destroyed);
        const dest = others.length > 0 ? others[0] : null;
        rocket.position = dest
          ? new Vec2(dest.position.x + Math.cos(theta2) * (dest.impactRadius + 0.5), dest.position.y + Math.sin(theta2) * (dest.impactRadius + 0.5))
          : new Vec2(Math.random() * gw, Math.random() * gh);
        break;
      }
      case PlanetType.WORMHOLE_SELF:
        rocket.position = new Vec2(
          planet.position.x + Math.cos(theta2) * (planet.impactRadius + 0.5),
          planet.position.y + Math.sin(theta2) * (planet.impactRadius + 0.5),
        );
        break;
      default:
        this._detonateRocket(rocket); return;
    }
    rocket.teleportCount++;
  }

  _detonateRocket(rocket) {
    if (rocket.status !== RocketStatus.ACTIVE) return;
    if (rocket.owner?.lastTrails && rocket.trail.length > 1) rocket.owner.lastTrails.push([...rocket.trail]);

    // Shock Rocket: no explosion / expanding shock zone — burst into a fan of forked
    // lightning bolts that electrify anything they touch as they travel.
    if (rocket.lightningBlast) {
      rocket.status = RocketStatus.DEAD;
      SoundManager.play('laser', { pitch: 0.25 });
      this._spawnShockBurst(rocket.position.x, rocket.position.y, rocket.owner, rocket.shockAmount ?? 2);
      return;
    }

    rocket.status = RocketStatus.EXPLODING;
    SoundManager.playRandom(['explosionMed', 'explosionMed2']);
    // Spawn an expanding blast zone — damage is applied progressively as it grows.
    this.gs.rocketBlasts.push({
      x: rocket.position.x, y: rocket.position.y,
      maxRadius:     rocket.blastRadius ?? ROCKET_BLAST_RADIUS,
      currentRadius: 1,
      owner:         rocket.owner,
      hitSet:        new Set(),
      // Condition-rocket flags (Ice Rocket / Shock Rocket); absent = normal kill blast
      freezeAmount:  rocket.freezeAmount,
      shockAmount:   rocket.shockAmount,
      whiteBlast:    rocket.whiteBlast,
      lightningBlast: rocket.lightningBlast,
      noKillBullets: rocket.freezeAmount || rocket.shockAmount ? true : undefined,
    });
  }

  // Ice Bomb detonation — large white freeze-zone blast (3/2/1 by distance band).
  _detonateIceBomb(bullet) {
    if (bullet._iceBombed) return;
    bullet._iceBombed = true;
    bullet.status = BulletStatus.EXPLODING;
    SoundManager.playRandom(['explosionLarge', 'explosionLarge2']);
    this.gs.rocketBlasts.push({
      x: bullet.position.x, y: bullet.position.y,
      maxRadius: ICE_BOMB_BLAST_RADIUS, currentRadius: 1,
      owner: bullet.owner, hitSet: new Set(),
      freezeZones: true, whiteBlast: true, noKillBullets: true,
    });
  }

  // Push a floating condition-notification label (FROZEN / DOUBLE FROZEN /
  // ELECTRIFIED …) on the affected station, in its team colour. (new-weapons-spec §18)
  _notifyCondition(station, kind) {
    const v = kind === 'frozen' ? (station.frozen ?? 0) : (station.electrified ?? 0);
    if (v <= 0) return;
    const names = kind === 'frozen'
      ? { 1: 'FROZEN', 2: 'DOUBLE FROZEN', 3: 'TRIPLE FROZEN' }
      : { 1: 'ELECTRIFIED', 2: 'DOUBLE ELECTRIFIED', 3: 'TRIPLE ELECTRIFIED' };
    const [r, g, b] = station.team.colour;
    this.gs.vfxList.push({
      type: 'conditionNotify', x: station.position.x, y: station.position.y - station.radius,
      text: names[v] ?? names[3], colour: `rgb(${r},${g},${b})`, t: 0, duration: 2.0,
    });
  }

  // Apply a freeze/shock condition (instead of a kill) to a station reached by a
  // condition blast. Armour absorbs one layer and blocks the condition entirely.
  _applyConditionBlast(blast, station) {
    if ((station.armourLayers ?? 0) > 0) {
      station.armourLayers--;
      station.armourFlash = 1.0;
      return;
    }
    if (blast.freezeZones) {
      const dx = station.position.x - blast.x, dy = station.position.y - blast.y;
      const d    = Math.sqrt(dx * dx + dy * dy);
      const frac = d / blast.maxRadius;
      const amt  = frac < 1 / 3 ? 3 : frac < 2 / 3 ? 2 : 1;
      station.frozen = Math.min(3, (station.frozen ?? 0) + amt);
      station.frozenFlash = 1.0;
      this._notifyCondition(station, 'frozen');
    } else if (blast.freezeAmount) {
      station.frozen = Math.min(3, (station.frozen ?? 0) + blast.freezeAmount);
      station.frozenFlash = 1.0;
      this._notifyCondition(station, 'frozen');
    } else if (blast.shockAmount) {
      station.electrified = Math.min(3, (station.electrified ?? 0) + blast.shockAmount);
      station.electrifiedFlash = 1.0;
      this._notifyCondition(station, 'electrified');
    }
  }

  // Spawn a bright blue sparkle explosion for a destroyed crystal.
  _spawnCrystalExplosion(crystal) {
    SoundManager.play('glassSmash');
    const r = 140, g = 210, b = 255;
    this.gs.activeExplosions.push({
      x: crystal.position.x, y: crystal.position.y,
      radius: crystal.radius * 1.5,
      t: 0, r, g, b,
      particles: this._makeParticles(crystal.position.x, crystal.position.y, r, g, b, 8),
    });
  }

  // Spawn directional particles emitted perpendicular to the star surface at a skim contact (FR-6).
  _spawnSkimParticles({ x, y, nx, ny, planet }) {
    const [pr, pg, pb] = planet.colour;
    const n   = 8;
    const dt  = 1 / (SKIM_PARTICLE_DURATION * 60); // advance per rAF frame
    const fan = Math.PI / 5; // ±36° spread around the outward normal

    for (let i = 0; i < n; i++) {
      const spread = (Math.random() * 2 - 1) * fan;
      const cosS   = Math.cos(spread);
      const sinS   = Math.sin(spread);
      // Rotate outward normal by spread angle
      const ax     = nx * cosS - ny * sinS;
      const ay     = nx * sinS + ny * cosS;
      const speed  = 1.2 + Math.random() * 2.0;
      const hue    = Math.random() * 40 - 20;
      this.gs.skimParticles.push({
        x, y,
        vx: ax * speed,
        vy: ay * speed,
        t:  0,
        dt,
        r: Math.min(255, Math.max(0, pr + hue)),
        g: Math.min(255, Math.max(0, pg + hue * 0.5)),
        b: Math.min(255, Math.max(0, pb + hue * 0.2)),
      });
    }
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

    // Birthday Present — deliver a windfall of weapons to the struck team on
    // contact, then return without dealing damage (it's a gift).
    if (bullet.birthdayPresent && !bullet._presentDelivered) {
      bullet._presentDelivered = true;
      this._deliverBirthdayPresent(bullet, target);
      return;
    }

    // Record the strike (lethal or absorbed) for awards (§21): hits on enemies,
    // selfHits on friendlies with a min-distance tiebreak.
    const _shooter = bullet.owner;
    if (_shooter?.stats && _shooter.position) {
      const _d = _shooter.position.distanceTo(target.position);
      if (_shooter.team === target.team) {
        _shooter.stats.selfHits++;
        _shooter.stats.selfHitMinDist = Math.min(_shooter.stats.selfHitMinDist ?? Infinity, _d);
      } else {
        _shooter.stats.hits++;
      }
    }

    // Armour absorption — consume one layer instead of destroying the station.
    // Gravity Cannon and Super Laser punch through armour and destroy outright.
    if ((target.armourLayers ?? 0) > 0 && !bullet.gravityCannon && !bullet.superLaser) {
      target.armourLayers--;
      target.armourFlash = 1.0;
      SoundManager.play('pop2');
      return;
    }

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
    if (bullet.gravityCannon) {
      target.implosion = true;  // shrink-to-nothing instead of explosion
    } else {
      this._spawnStationExplosion(target);
    }
    SoundManager.playRandom(['explosionLarge', 'explosionLarge2']);

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

      // Awards rework (§21): single best-shot extrema + best trickshot
      shooter.stats.longestKillDist = Math.max(shooter.stats.longestKillDist ?? 0, dist);
      shooter.stats.closestKillDist = Math.min(shooter.stats.closestKillDist ?? Infinity, dist);
      const _ev = (bullet.teleportCount ?? 0) + (bullet.skimCount ?? 0) + (bullet.bounceCount ?? 0);
      if (_ev >= 1 && (_ev > (shooter.stats.bestTrickshotEvents ?? 0) ||
          (_ev === shooter.stats.bestTrickshotEvents && dist > (shooter.stats.bestTrickshotDist ?? 0)))) {
        shooter.stats.bestTrickshotEvents = _ev;
        shooter.stats.bestTrickshotDist   = dist;
      }

      shooter.stats.kills++;
      shooter.team.stats.kills++;
      shooter.team.stats.score++;
      target.team.stats.killedBy = shooter; // record for future vengeance
    }
  }

  _fragBounceOffStation(bullet, station) {
    const dx = station.position.x - bullet.position.x;
    const dy = station.position.y - bullet.position.y;
    const r  = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dx / r;
    const ny = -dy / r;
    const dot       = bullet.velocity.x * nx + bullet.velocity.y * ny;
    const retention = bullet.bounceRetention ?? FRAG_BOUNCE_RETENTION;
    bullet.velocity = new Vec2(
      (bullet.velocity.x - 2 * dot * nx) * retention,
      (bullet.velocity.y - 2 * dot * ny) * retention,
    );
    bullet.position = new Vec2(
      station.position.x + nx * (station.radius + 1),
      station.position.y + ny * (station.radius + 1),
    );
    bullet.bounceCount = (bullet.bounceCount ?? 0) + 1; // Trick Shot award (§21)
  }

  _detonateFragShot(bullet) {
    const MAX_V          = (800 / 1000 + 0.2) * 0.8;
    const FRAG_SPEED_MIN = MAX_V * 0.20;
    const FRAG_SPEED_MAX = MAX_V * 0.40;
    const fragCount      = 11 + Math.floor(this.rng.next() * 3); // 11–13
    const rotOffset      = this.rng.next() * Math.PI * 2;

    bullet.status = BulletStatus.EXPLODING;
    SoundManager.play('fireworkBang');

    for (let i = 0; i < fragCount; i++) {
      const angle = rotOffset + i * (Math.PI * 2 / fragCount);
      const speed = FRAG_SPEED_MIN + this.rng.next() * (FRAG_SPEED_MAX - FRAG_SPEED_MIN);
      const frag  = new Bullet({
        owner:    bullet.owner,
        position: new Vec2(bullet.position.x, bullet.position.y),
        velocity: new Vec2(speed * Math.sin(angle), speed * Math.cos(angle)),
      });
      frag.thinTrail    = true;
      frag.fragFragment = true;
      this.gs.activeBullets.push(frag);
    }
  }

  _spawnMammothBlast(bullet) {
    // Large expanding area blast — slow so fragments can escape
    this.gs.rocketBlasts.push({
      x: bullet.position.x, y: bullet.position.y,
      maxRadius:     ROCKET_BLAST_RADIUS * MAMMOTH_BLAST_MULT,
      currentRadius: 1,
      speed:         MAMMOTH_BLAST_SPEED_MULT,  // expands at 40% normal rate
      noKillBullets: true,                      // let own fragments clear the zone
      owner:         bullet.owner,
      hitSet:        new Set(),
    });

    // Spray fragments radially outward
    const MAX_V    = (800 / 1000 + 0.2) * 0.8;
    const speedMin = MAX_V * MAMMOTH_FRAG_SPEED_MIN;
    const speedMax = MAX_V * MAMMOTH_FRAG_SPEED_MAX;
    const rotOff   = this.rng.next() * Math.PI * 2;
    for (let i = 0; i < MAMMOTH_FRAG_COUNT; i++) {
      const angle = rotOff + i * (Math.PI * 2 / MAMMOTH_FRAG_COUNT);
      const speed = speedMin + this.rng.next() * (speedMax - speedMin);
      const frag  = new Bullet({
        owner:    bullet.owner,
        position: new Vec2(bullet.position.x, bullet.position.y),
        velocity: new Vec2(speed * Math.sin(angle), speed * Math.cos(angle)),
      });
      frag.thinTrail    = true;
      frag.fragFragment = true;
      this.gs.activeBullets.push(frag);
    }
  }

  _handleQuantumTeleport(bullet) {
    const planet = bullet._qtTeleportPlanet;
    const R = planet.impactRadius;

    const vLen = Math.sqrt(bullet.velocity.x ** 2 + bullet.velocity.y ** 2);
    if (vLen < 0.001) { bullet.status = BulletStatus.EXPLODING; return; }
    const uvx = bullet.velocity.x / vLen;
    const uvy = bullet.velocity.y / vLen;

    // Ray from bullet's current position (inside planet) forward along velocity.
    // Find the positive-t exit point on the sphere of radius R.
    const Dx    = bullet.position.x - planet.position.x;
    const Dy    = bullet.position.y - planet.position.y;
    const dotDV = Dx * uvx + Dy * uvy;
    const disc  = dotDV * dotDV + R * R - (Dx * Dx + Dy * Dy);
    if (disc < 0) { bullet.status = BulletStatus.EXPLODING; return; }

    const t      = -dotDV + Math.sqrt(disc);
    const entryX = bullet.position.x;
    const entryY = bullet.position.y;

    bullet.position = new Vec2(
      bullet.position.x + uvx * (t + 2),  // 2 extra units past surface
      bullet.position.y + uvy * (t + 2),
    );
    bullet.trail.push(null); // break trail at entry
    bullet.teleportCount++;

    // VFX: expanding ring at entry and exit
    const [r, g, b] = bullet.owner.team.colour;
    this.gs.vfxList.push({ type: 'qtFlash', x: entryX,            y: entryY,            t: 0, duration: 0.5, r, g, b });
    this.gs.vfxList.push({ type: 'qtFlash', x: bullet.position.x, y: bullet.position.y, t: 0, duration: 0.5, r, g, b });
  }

  _scatterCannon(bullet) {
    const speed     = Math.sqrt(bullet.velocity.x ** 2 + bullet.velocity.y ** 2);
    const baseAngle = Math.atan2(bullet.velocity.x, bullet.velocity.y) * 180 / Math.PI;
    for (const dAngle of [-10, -5, 0, 5, 10]) {
      const rad  = (((baseAngle + dAngle) % 360 + 360) % 360 * Math.PI) / 180;
      const frag = new Bullet({
        owner:    bullet.owner,
        position: new Vec2(bullet.position.x, bullet.position.y),
        velocity: new Vec2(Math.sin(rad) * speed, Math.cos(rad) * speed),
      });
      this.gs.activeBullets.push(frag);
    }
    bullet.status = BulletStatus.DEAD;
  }

  _processHyperspace() {
    const { gw, gh } = this.physics;
    const isHyperscenario = this.gs.config?.scenarioId === 26;
    for (const station of this.gs.allStations) {
      if (station.status !== 'active') continue;
      const voluntary = station.hyperspaceQueued;
      if (voluntary) station.selectedWeapon = WeaponId.CANNON;
      // Normal: teleport if voluntary. Hyperspace scenario: teleport if NOT voluntary (forced shuffle).
      // Selecting hyperspace in the hyperspace scenario is an anchor — ship stays put.
      const shouldTeleport = voluntary ? !isHyperscenario : isHyperscenario;
      if (!shouldTeleport) continue;
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

  // ─── Story mode helpers ──────────────────────────────────────────────────────

  _processStoryEvents() {
    const ss = this.gs.storyState;
    if (!ss) return;
    for (const event of ss.mission.events ?? []) {
      if (event.turn !== this.gs.turn || ss.firedEvents.has(event)) continue;
      ss.firedEvents.add(event);
      if (event.spawnStations?.length) {
        const teamWeaponsGiven = new Set();
        for (const def of event.spawnStations) {
          const station = this._buildStoryStation(def);
          if (!teamWeaponsGiven.has(def.team) && def.startingWeapons) {
            station.team.addStartingWeapons(def.startingWeapons);
            teamWeaponsGiven.add(def.team);
          }
        }
      }
      if (event.dialog) this.gs.storyDialogText = event.dialog;
      for (const obj of event.addObjectives ?? []) ss.addObjective(obj);
    }
  }

  _buildStoryStation(def) {
    const { gw, gh } = this.physics;
    let team = this.gs.teams.find(t => t.index === def.team);
    if (!team) {
      team = new Team({ index: def.team, isHuman: false });
      this.gs.teams.push(team);
    }
    if (!team.controller && def.role === 'ai') {
      team.controller = AIController.create(def.aiLevel ?? 2, this.physics);
    }
    const size  = StationSize[this.gs.storyState.mission.settings.stationSize?.toUpperCase()] ?? StationSize.LARGE;
    const newId = this.gs.teams.reduce((sum, t) => sum + t.stations.length, 0);
    const station = new Station({ id: newId, team, position: new Vec2(0, 0), size });
    station.role        = def.role        ?? 'ai';
    station.visualStyle = def.visualStyle ?? 'drone';
    if (def.x !== null && def.y !== null) {
      station.position = new Vec2(def.x * gw, def.y * gh);
    } else {
      let placed = false;
      for (let a = 0; a < 300; a++) {
        const candidate = new Vec2(this.rng.next() * gw, this.rng.next() * gh);
        const clearOfPlanets  = this.gs.planets.every(
          p => candidate.distanceSqTo(p.position) >= (p.impactRadius + station.radius + 5) ** 2,
        );
        const clearOfStations = this.gs.allStations.every(
          s => s.status !== 'active' ||
               candidate.distanceSqTo(s.position) >= (station.radius + s.radius + 5) ** 2,
        );
        if (clearOfPlanets && clearOfStations) {
          station.position = candidate;
          placed = true;
          break;
        }
      }
      if (!placed) station.position = new Vec2(gw * 0.5, gh * 0.5);
    }
    team.stations.push(station);
    return station;
  }

  _pickCollectableGrant() {
    const wid = this.gs.storyState?.mission.settings.collectableWeapon;
    if (wid) {
      const match = WEAPON_GRANTS.find(g => g.id === wid);
      if (match) return match;
    }
    // Tier weights: 1=80%, 2=16%, 3=4%
    const r = this.rng.next();
    const tier = r < 0.80 ? 1 : r < 0.96 ? 2 : 3;
    const movementOn = this.gs.movementSpeed && this.gs.movementSpeed !== 'off';
    const pool = WEAPON_GRANTS.filter(g => g.tier === tier && (!g.needsMovement || movementOn));
    return pool[Math.floor(this.rng.next() * pool.length)];
  }

  // Birthday Present — grant 3–5 random tier 2/3 weapons to the struck team.
  _deliverBirthdayPresent(bullet, target) {
    const count  = 3 + Math.floor(this.rng.next() * 3); // 3–5
    const labels = [];
    for (let i = 0; i < count; i++) {
      const grant = this._pickTier23Grant();
      target.team.addStock(grant.id, grant.charges);
      labels.push(grant.label);
    }
    const [r, g, b] = target.team.colour;
    this.gs.vfxList.push({ type: 'birthdayGrant', x: target.position.x,
      y: target.position.y - target.radius, labels, colour: `rgb(${r},${g},${b})`, t: 0, duration: 3.0 });
    SoundManager.play('nova', { volume: 0.5 });
  }

  // Credit a collected collectable to the collecting station for the Greedy award (§21).
  _creditCollectableStat(station, grant) {
    if (!station?.stats) return;
    station.stats.collectablesGrabbed++;
    station.stats.collectableTierSum += (grant?.tier ?? 1);
  }

  // Random tier 2/3 grant object (for Birthday Present windfalls).
  _pickTier23Grant() {
    const movementOn = this.gs.movementSpeed && this.gs.movementSpeed !== 'off';
    const pool = WEAPON_GRANTS.filter(g =>
      (g.tier === 2 || g.tier === 3) && g.id !== WeaponId.SURPRISE &&
      g.id !== WeaponId.BIRTHDAY_PRESENT && (!g.needsMovement || movementOn));
    return pool[Math.floor(this.rng.next() * pool.length)];
  }

  // Pick a random tier 2 or 3 weapon for Surprise (excludes Surprise itself and
  // movement-only weapons when movement is off). Returns a WeaponId.
  _pickSurpriseWeapon() {
    const movementOn = this.gs.movementSpeed && this.gs.movementSpeed !== 'off';
    const pool = WEAPON_GRANTS.filter(g =>
      (g.tier === 2 || g.tier === 3) && g.id !== WeaponId.SURPRISE && (!g.needsMovement || movementOn));
    return pool[Math.floor(this.rng.next() * pool.length)].id;
  }

  humanDismissDialog() {
    if (this.gs.mode !== GameMode.STORY_DIALOG) return;
    this.gs.storyDialogText  = null;
    const prev               = this.gs._storyPrevMode ?? GameMode.AIMING;
    this.gs._storyPrevMode   = null;
    this.gs.mode             = prev;
    if (prev === GameMode.AIMING) this._advanceAiming();
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
      if (station.armourFlash      > 0) station.armourFlash      = Math.max(0, station.armourFlash      - 0.04);
      if (station.electrifiedFlash > 0) station.electrifiedFlash = Math.max(0, station.electrifiedFlash - 0.012);
      if (station.mindControlFlash > 0) station.mindControlFlash = Math.max(0, station.mindControlFlash - 0.02);
      if (station.frozenFlash      > 0) station.frozenFlash      = Math.max(0, station.frozenFlash      - 0.005);
    }

    // Freestanding asteroid explosions
    for (const ex of this.gs.activeExplosions) {
      ex.t += DT_SW;
      for (const p of ex.particles) { p.x += p.vx; p.y += p.vy; p.t += DT_P; }
      ex.particles = ex.particles.filter(p => p.t < 1);
    }
    this.gs.activeExplosions = this.gs.activeExplosions.filter(ex => ex.t < 1 || ex.particles.length > 0);

    // Skim rebound particles — use per-particle dt for tunable duration (FR-6)
    if (this.gs.skimParticles?.length) {
      for (const p of this.gs.skimParticles) { p.x += p.vx; p.y += p.vy; p.t += p.dt; }
      this.gs.skimParticles = this.gs.skimParticles.filter(p => p.t < 1);
    }

    // Experimental bitmap explosions
    if (this._isExperimental) {
      for (const p of this.gs.shipExplosionBloom) p.t += p.dt;
      this.gs.shipExplosionBloom = this.gs.shipExplosionBloom.filter(p => p.t < 1);

      for (const fb of this.gs.fireballs) {
        for (const planet of this.gs.planets) {
          if (planet.destroyed) continue;
          const dx    = planet.position.x - fb.x;
          const dy    = planet.position.y - fb.y;
          const rSq   = dx * dx + dy * dy;
          if (rSq < 0.01) continue;
          const sign  = dx < 0 ? -1 : 1;
          const theta = Math.atan(dy / dx);
          const accel = sign * G * planet.mass / rSq * 2.0;
          fb.vx += Math.cos(theta) * accel;
          fb.vy += Math.sin(theta) * accel;
        }
        fb.x += fb.vx;
        fb.y += fb.vy;
        fb.t += fb.dt;

        // Remove fireball if it drifts far outside the game world
        const { w: gW, h: gH } = this.renderer.worldSize;
        const margin = 150;
        if (fb.x < -margin || fb.x > gW + margin || fb.y < -margin || fb.y > gH + margin) {
          fb.t = 1; continue;
        }

        // Remove fireball on planet collision
        let destroyed = false;
        for (const planet of this.gs.planets) {
          if (planet.destroyed) continue;
          const cx = planet.position.x - fb.x;
          const cy = planet.position.y - fb.y;
          if (cx * cx + cy * cy < planet.radius * planet.radius) { destroyed = true; break; }
        }
        if (destroyed) { fb.t = 1; continue; }

        fb.smokeTimer++;
        if (fb.smokeTimer >= 4) {
          fb.smokeTimer = 0;
          for (let e = 0; e < 3; e++) {
            this.gs.fireballSmoke.push({
              x: fb.x, y: fb.y,
              maxR: 3 + Math.random() * 4.5,
              t: 0,
              r: fb.r, g: fb.g, b: fb.b,
            });
          }
        }
      }
      this.gs.fireballs = this.gs.fireballs.filter(fb => fb.t < 1);

      for (let i = this.gs.fireballSmoke.length - 1; i >= 0; i--) {
        this.gs.fireballSmoke[i].t += 1 / (25 + Math.random() * 10);
        if (this.gs.fireballSmoke[i].t >= 1) this.gs.fireballSmoke.splice(i, 1);
      }
    }
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

    // Once the game is decided, claim any leftover collectables in-game so the
    // grant animation (weapon name in the collecting team's colour) plays on
    // screen before the game-over screen appears, keeping it visible to players.
    if (this.gs.winner !== undefined && !this._collectablesClaimed) {
      this._collectablesClaimed = true;
      if (this._claimRemainingCollectables() > 0) {
        // Hold on RESULTS long enough for the grant animation to finish.
        this._resultsTimer = Math.max(this._resultsTimer, 150);
      }
    }

    if (--this._resultsTimer <= 0) {
      if (this.gs.storyState && !this.gs.storyState.passed && !this.gs.storyState.failed) {
        const ss = this.gs.storyState;
        ss.evaluate(this.gs);

        if (ss.allObjectivesMet) {
          ss.passed = true;
          ss.score  = ss.computeScore(this.gs, this.gs.turn);
          this.gs.mode = GameMode.STORY_DEBRIEF;
          return;
        }

        const maxTurnsFc = ss.mission.failConditions.find(fc => fc.type === 'max_turns');
        if (maxTurnsFc && this.gs.turn + 1 >= maxTurnsFc.turns) {
          ss.failed = true;
          this.gs.mode = GameMode.STORY_DEBRIEF;
          return;
        }

        const humansDead   = this.gs.teams.filter(t => t.isHuman).every(t => !t.isAlive);
        const enemiesAlive = this.gs.teams.filter(t => !t.isHuman).some(t => t.isAlive);
        if (humansDead && enemiesAlive) {
          ss.failed = true;
          this.gs.mode = GameMode.STORY_DEBRIEF;
          return;
        }

        this.gs.turn++;
        this.renderer.clearTrails();
        this._trySpawnCollectable();
        this._startTurn();
        return;
      }

      if (this.gs.winner !== undefined) {
        this.gs.mode = GameMode.GAMEOVER;
      } else {
        this.gs.turn++;
        this._checkTurnLimit();
        if (this.gs.winner !== undefined) {
          // Winner just decided by the turn limit — claim leftover collectables
          // in-game and hold on RESULTS so the grant animation is visible.
          if (!this._collectablesClaimed) {
            this._collectablesClaimed = true;
            if (this._claimRemainingCollectables() > 0) {
              this._resultsTimer = 150;
              return;
            }
          }
          this.gs.mode = GameMode.GAMEOVER;
        } else {
          this.renderer.clearTrails();
          this._trySpawnCollectable();
          this._startTurn();
        }
      }
    }
  }

  _checkTurnLimit() {
    const limit = this.gs.config?.turnLimit;
    if (!limit || limit === 'off' || this.gs.winner !== undefined) return;
    if (this.gs.turn < limit) return;
    const alive = this.gs.aliveTeams;
    if (!alive.length) { this.gs.winner = null; return; }
    const counts = alive.map(t => ({ team: t, n: t.stations.filter(s => s.status === 'active').length }));
    const max    = Math.max(...counts.map(c => c.n));
    const leaders = counts.filter(c => c.n === max).map(c => c.team);
    this.gs.winner = leaders.length === 1 ? leaders[0] : null;
    for (const s of this.gs.allStations) {
      if (s.status === 'active') s.stats.survived = 1;
    }
  }

  // Immediately destroy all of a team's active stations (resign).
  resignTeam(team) {
    for (const sta of team.stations) {
      if (sta.status === 'active') {
        sta.status     = 'exploding';
        sta.explosionT = 0;
        this._spawnStationExplosion(sta);
      }
    }
    this._checkWin();
  }

  // ─── human input API (called by InputHandler in Phase 6) ────────────────────

  humanFire() {
    if (this.gs.mode === GameMode.TP_AIMING && this.gs.waitingForInput) {
      this.gs.waitingForInput = false;
      this.gs.waitingForMove  = false;
      this._turnIdx++;
      // Glide back to the full view for the next aim; if this fires, the shot is
      // held in _advanceTPAiming until the reset settles (Item 1).
      this.renderer?.camera?.resetToDefault({ animated: true });
      this._advanceTPAiming();
      return;
    }
    if (this.gs.mode !== GameMode.AIMING || !this.gs.waitingForInput) return;
    this.gs.waitingForInput = false;
    this.gs.waitingForMove  = false;
    this._turnIdx++;
    // Reset zoom/pan to the full battlefield for the next aiming. If this
    // end-turn fires (all stations have acted), _advanceAiming holds the shot
    // until the reset tween completes so the whole board is visible (Item 1).
    this.renderer?.camera?.resetToDefault({ animated: true });
    this._advanceAiming();
  }

  humanHyperspace() {
    const s = this.gs.activeStation;
    if (!s) return;
    const cannonOk = this.gs.storyState?.mission.settings.cannonEnabled !== false;
    const weapons  = cannonOk ? [WeaponId.CANNON, WeaponId.HYPERSPACE] : [WeaponId.HYPERSPACE];
    if (s.team.getStock(WeaponId.TRIPLE_CANNON) > 0) weapons.splice(cannonOk ? 1 : 0, 0, WeaponId.TRIPLE_CANNON);
    const idx = weapons.indexOf(s.selectedWeapon);
    s.selectedWeapon = weapons[(idx + 1) % weapons.length];
  }

  humanCycleWeapon() {
    const s = this.gs.activeStation;
    if (!s) return;
    const cannonOk = this.gs.storyState?.mission.settings.cannonEnabled !== false;
    const allOrder = [
      ...(cannonOk ? [WeaponId.CANNON] : []),
      WeaponId.HYPERSPACE,
      WeaponId.TRIPLE_CANNON,
      WeaponId.BLUNDERBUSS,
      WeaponId.LASER,
      WeaponId.ROCKET,
      WeaponId.ROCKET_POD,
      WeaponId.BLASTER,
      WeaponId.MINIGUN,
      WeaponId.FORCE_SHIELD,
      WeaponId.ELECTRO_STUN, WeaponId.TELEPORT, WeaponId.SUPER_LASER,
      WeaponId.REINFORCEMENT_SIGNAL, WeaponId.MIND_CONTROL_BEAM,
    ];
    const available = allOrder.filter(w => {
      if (w === WeaponId.CANNON || w === WeaponId.HYPERSPACE) return true;
      const reserved = s.team.stations.filter(
        t => t !== s && t.status === 'active' && t.selectedWeapon === w
      ).length;
      return s.team.getStock(w) - reserved > 0;
    });
    if (available.length === 0) return;
    const idx = available.indexOf(s.selectedWeapon);
    s.selectedWeapon = available[(idx + 1) % available.length];
  }

  humanSelectWeapon(weaponId) {
    const s = this.gs.activeStation;
    if (!s) return;
    if (weaponId === WeaponId.CANNON && this.gs.storyState?.mission.settings.cannonEnabled === false) return;
    if (weaponId !== WeaponId.CANNON && weaponId !== WeaponId.HYPERSPACE) {
      const reserved = s.team.stations.filter(
        t => t !== s && t.status === 'active' && t.selectedWeapon === weaponId
      ).length;
      if (s.team.getStock(weaponId) - reserved <= 0) return;
    }
    s.selectedWeapon = weaponId;
    if (weaponId === WeaponId.SHOTGUN || weaponId === WeaponId.DUAL_BLASTER) s.angle2 = s.angle;
    if (weaponId === WeaponId.BLASTER) s.power = (s.power >= 3 && s.power <= 15) ? s.power : 8;
  }

  humanAngle(delta) {
    const s = this.gs.activeStation;
    if (s) s.angle = Math.round(((s.angle + delta) % 360 + 360) % 360 * 10) / 10;
  }

  humanPower(delta) {
    const s = this.gs.activeStation;
    if (!s) return;
    if (s.selectedWeapon === WeaponId.SHOTGUN || s.selectedWeapon === WeaponId.DUAL_BLASTER) {
      s.angle2 = Math.round(((s.angle2 - delta) % 360 + 360) % 360 * 10) / 10;
    } else if (s.selectedWeapon === WeaponId.BLASTER) {
      s.power = Math.max(3, Math.min(15, s.power + delta));
    } else {
      s.power = Math.max(1, Math.min(800, s.power + delta));
    }
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
    const cap = this.gs.config?.maxCollectableSpawn ?? 3;
    if (cap !== 'unlimited' && this.gs.collectables.length >= cap) return;
    // No collectables in Hyperspace scenario (id 21)
    if (this.gs.config?.scenarioId === 26) return;

    const probMap = { rare: 0.20, normal: 0.40, common: 0.75, continuous: 1.0 };
    const prob = probMap[collectables] ?? 0;
    if (this.rng.next() > prob) return;

    const pos = this._findCollectableSpawnPos();
    if (pos) {
      const c    = new Collectable(pos);
      c.radius   = this._collectableRadius();
      this.gs.collectables.push(c);
    }
  }

  _collectableRadius() {
    const s = this.gs.config?.collectableSize ?? 'medium';
    const sizes = { tiny: 2.5, medium: 5, large: 7.5, huge: 10, mammoth: 15 };
    if (s === 'varied') {
      const opts = [2.5, 5, 7.5, 10, 15];
      return opts[Math.floor(this.rng.next() * opts.length)];
    }
    return sizes[s] ?? 5;
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

  // Distribute the collectables still on the map to the surviving teams when a
  // game ends (tournament "claim collectables" setting). Grants are applied to
  // each team's weapon stock — so they carry over via the game-end snapshot —
  // and the same shatter + named-grant VFX used for normal pickups is spawned
  // so players can see who claimed what, in the collecting team's colour.
  // Returns the number of collectables claimed.
  _claimRemainingCollectables() {
    if (this.gs.config?.mode !== 'tournament' || !this.gs.config?.claimCollectables) return 0;
    const remaining = this.gs.collectables.filter(c => c.alive);
    const survivors = this.gs.teams.filter(t => t.stations.some(s => s.status === 'active'));
    if (!remaining.length || !survivors.length) return 0;
    // Shuffle survivors so the leftovers are split fairly at random.
    for (let i = survivors.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng.next() * (i + 1));
      [survivors[i], survivors[j]] = [survivors[j], survivors[i]];
    }
    remaining.forEach((c, i) => {
      const team  = survivors[i % survivors.length];
      const grant = this._pickCollectableGrant();
      team.addStock(grant.id, grant.charges);
      c.alive = false;
      this.gs.vfxList.push(this._makeCollectableShatterVFX(c));
      const [cr, cg, cb] = team.colour;
      this.gs.vfxList.push({ type: 'collectableGrant', x: c.position.x, y: c.position.y, text: grant.label, colour: `rgb(${cr},${cg},${cb})`, t: 0, duration: 2.0 });
    });
    return remaining.length;
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
    // Collectable shatter/grant VFX are advanced once per frame in
    // _advanceCollectableVFX so their fade stays smooth at any game speed;
    // skip them here to avoid advancing multiple times per physics sub-step.
    for (const vfx of this.gs.vfxList) {
      if (vfx.type === 'collectableGrant' || vfx.type === 'collectableShatter' || vfx.type === 'conditionNotify') continue;
      vfx.t += DT / vfx.duration;
    }
    this.gs.vfxList = this.gs.vfxList.filter(v => v.t < 1);
  }

  // Advance collectable shatter/grant VFX in real wall-clock time — exactly
  // once per rendered frame, independent of how many physics sub-steps run that
  // frame — so the named-grant label fades in and out smoothly instead of
  // popping at higher game speeds.
  _advanceCollectableVFX() {
    const DT = 1 / 60;
    for (const vfx of this.gs.vfxList) {
      if (vfx.type === 'collectableGrant' || vfx.type === 'collectableShatter' || vfx.type === 'conditionNotify') {
        vfx.t += DT / vfx.duration;
      }
    }
    this.gs.vfxList = this.gs.vfxList.filter(v => v.t < 1);
  }

  togglePause()  { this._paused = !this._paused; }
  stepOne()      { if (this._paused) this._oneStep = true; }
  get isPaused() { return this._paused; }

  // ─── Target Practice ─────────────────────────────────────────────────────────

  setTPResultsCallback(cb) { this._tpResultsCb = cb; }

  startTP() { this._startTPRound(); }

  // Start a new round: build the ordered list of teams that still have targets.
  _startTPRound() {
    const tp = this.gs.tpGame;
    this._tpTeamOrder = [...tp.teamData.keys()].filter(ti => !tp.isTeamDone(ti));
    this._tpTeamIdx   = 0;

    if (this._tpTeamOrder.length === 0) {
      this.gs.mode = GameMode.TP_RESULTS;
      this._tpResultsCb?.();
      return;
    }
    this._startTPTeamTurn();
  }

  // Start the aiming phase for the current team in this round.
  _startTPTeamTurn() {
    const tp      = this.gs.tpGame;
    const teamIdx = this._tpTeamOrder[this._tpTeamIdx];

    this._turnOrder = tp.stationList.filter(s =>
      s.status === 'active' && s.team.index === teamIdx,
    );

    if (this._turnOrder.length === 0) {
      this._advanceTPTeam();
      return;
    }

    this.gs.activeBullets   = [];
    this.gs.waitingForInput = false;
    this.gs.waitingForMove  = false;
    this.renderer.clearTrails();
    this.gs.mode  = GameMode.TP_AIMING;
    this._turnIdx = 0;
    // Each Target Practice turn opens at the full-battlefield view (FR-22).
    this.renderer?.camera?.resetToDefault({ animated: true });
    for (const s of this._turnOrder) s.selectedWeapon = 'cannon';

    this._advanceTPAiming();
  }

  // Called when a team's firing phase ends. Advance to the next team or next round.
  _advanceTPTeam() {
    const tp      = this.gs.tpGame;
    const teamIdx = this._tpTeamOrder[this._tpTeamIdx];

    // Record finish if this team just cleared all their targets
    const data = tp.teamData.get(teamIdx);
    if (data && data.finishedRound === null && tp.isAllTargetsCleared(teamIdx)) {
      data.finishedRound = tp.currentRound;
    }

    this._tpTeamIdx++;

    if (this._tpTeamIdx < this._tpTeamOrder.length) {
      this._startTPTeamTurn();
    } else {
      tp.currentRound++;
      if (tp.allTeamsDone || tp.currentRound > tp.totalRounds) {
        this.gs.mode = GameMode.TP_RESULTS;
        this._tpResultsCb?.();
      } else {
        this._startTPRound();
      }
    }
  }

  _advanceTPAiming() {
    if (this.gs.waitingForInput) return;

    while (this._turnIdx < this._turnOrder.length) {
      const station = this._turnOrder[this._turnIdx];

      if (!station.team.isHuman) {
        this._tpAIAim(station);
        this._setActive(station);
        this._turnIdx++;
      } else {
        this._setActive(station);
        this.gs.waitingForInput = true;
        return;
      }
    }

    // Hold the shot until the end-turn view reset has settled (Item 1).
    if (this.renderer?.camera?.isAnimating()) return;
    this._tpFireAll();
  }

  _tpAIAim(station) {
    const tp           = this.gs.tpGame;
    const aliveIndices = tp.survivingTargetIndices(station.team.index);

    if (!aliveIndices.length) {
      station.angle = Math.floor(Math.random() * 360);
      station.power = 400;
      return;
    }

    const ti     = aliveIndices[Math.floor(Math.random() * aliveIndices.length)];
    const target = tp.targets[ti];

    if (station.team.controller?._findBestShot) {
      const { angle, power } = station.team.controller._findBestShot(
        station, target, { planets: this.gs.planets, turn: 20 }, 10,
      );
      station.angle = angle;
      station.power = power;
    } else {
      const dx = target.position.x - station.position.x;
      const dy = target.position.y - station.position.y;
      station.angle = Math.round(((Math.atan2(dx, dy) * 180 / Math.PI) % 360 + 360) % 360);
      station.power = 400;
    }
  }

  _tpFireAll() {
    this.gs.activeBullets = [];
    this.gs.firingStep    = 0;

    for (const station of this._turnOrder) {
      station.lastAngle  = station.angle;
      station.lastPower  = station.power;
      station.lastTrails = [];
      this.gs.activeBullets.push(this._makeBullet(station, station.angle, station.power));
    }
    this.gs.mode = GameMode.TP_FIRING;
  }

  _advanceTPFiring() {
    const tp            = this.gs.tpGame;
    const stepsPerFrame = this._paused ? PRINT_EVERY : this._speedSteps;

    for (let i = 0; i < stepsPerFrame; i++) {
      this.gs.firingStep++;

      for (const bullet of this.gs.activeBullets) {
        if (bullet.status !== BulletStatus.ACTIVE) continue;

        this.physics.step(bullet, this.gs.planets, this.gs.rifts, this.gs.repulsorFields ?? []);

        if (bullet.lifetime % PRINT_EVERY === 0) {
          bullet.trail.push(new Vec2(bullet.position.x, bullet.position.y));
          this.renderer.appendTrailPoint(bullet);
        }

        // Target hit detection — pass-through, per-team shared pool
        const teamIndex = bullet.owner.team.index;
        for (let ti = 0; ti < tp.targets.length; ti++) {
          if (tp.isTargetDestroyed(teamIndex, ti)) continue;
          const tgt = tp.targets[ti];
          const dx  = tgt.position.x - bullet.position.x;
          const dy  = tgt.position.y - bullet.position.y;
          if (dx * dx + dy * dy < tgt.radius * tgt.radius) {
            const accuracy = this._tpAccuracy(bullet.velocity, dx, dy);
            if (tp.recordHit(bullet.owner.id, teamIndex, ti, accuracy)) {
              this.gs.vfxList.push(this._makeGlitterVFX(tgt.position.x, tgt.position.y));
            }
          }
        }

        if (bullet._hitMoon) {
          this._handleMoonHit(bullet._hitMoon, bullet._hitMoonX, bullet._hitMoonY);
          bullet._hitMoon = null;
        }

        if (bullet._eruptPlanet) {
          this._triggerEruption(bullet._eruptPlanet, bullet._eruptX, bullet._eruptY, bullet.owner);
          bullet._eruptPlanet = null;
        }

        if (bullet._skimEvent) {
          if (this._performance !== 'simplified') this._spawnSkimParticles(bullet._skimEvent);
          bullet._skimEvent = null;
        }

        if (bullet.status !== BulletStatus.ACTIVE && bullet.trail.length > 1) {
          if (bullet.owner.lastTrails) bullet.owner.lastTrails.push([...bullet.trail]);
        }
      }

      if (this.gs.eruptions.length)      this._stepEruptions();
      if (this.gs.ejecta.length)         this._stepEjecta(this.gs.allStations);
      if (this.gs.eruptionDebris.length) this._stepEruptionDebris();
    }

    if (this.gs.ejecta.length) this._emitEjectaSmoke();
    if (this.gs.lightning.length) this._stepLightning(this.gs.allStations);

    this._processAsteroidFragments();
    this._processGreySplits();

    for (const bullet of this.gs.activeBullets) {
      if (bullet.status === BulletStatus.EXPLODING) {
        bullet.explosionT += 0.025;
        if (bullet.explosionT >= 1) bullet.status = BulletStatus.DEAD;
      }
    }
    this.gs.activeBullets = this.gs.activeBullets.filter(b => b.status !== BulletStatus.DEAD);

    this._advanceVFX();
    this._advanceExplosionEffects();

    if (this.gs.activeBullets.length === 0) {
      this._advanceTPTeam();
    }
  }

  _tpAccuracy(velocity, dxToCenter, dyToCenter) {
    const vMag = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);
    const dMag = Math.sqrt(dxToCenter ** 2 + dyToCenter ** 2);
    if (vMag < 1e-9 || dMag < 1e-9) return 1;
    const dot   = (velocity.x * dxToCenter + velocity.y * dyToCenter) / (vMag * dMag);
    const theta = Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);
    return Math.max(0, 1 - theta / 90);
  }

  _makeGlitterVFX(x, y) {
    const colours = ['#ffffff', '#ffffff', '#ff1111', '#ff1111', '#dd0000'];
    return {
      type:     'glitter',
      x, y,
      t:        0,
      duration: 0.8,
      particles: Array.from({ length: 24 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 3.5;
        return {
          vx:     Math.cos(angle) * speed,
          vy:     Math.sin(angle) * speed,
          colour: colours[Math.floor(Math.random() * colours.length)],
          size:   2 + Math.random() * 3,
          ox: x, oy: y,
        };
      }),
    };
  }

}
