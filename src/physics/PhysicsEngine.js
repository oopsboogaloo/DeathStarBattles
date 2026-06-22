// Copyright © 2026 Chloe Bolland
// contact chloe@mammoththoughts.com if you wish to use, publish or reproduce this game or any part of it in any way

import { Vec2 }          from '../core/Vec2.js';
import { PlanetType }    from '../entities/Planet.js';
import { BulletStatus }  from '../entities/Bullet.js';
import { RIFT_REPULSION_STRENGTH } from '../entities/SpaceRift.js';

// ─── constants (match original Java values exactly) ───────────────────────────
export const G             = 0.2;
export const TIMESTEP      = 0.15;
export const PRINT_EVERY   = 10;    // record trail point every N physics steps
export const SHOW_EVERY    = 10;    // repaint every N*PRINT_EVERY steps
export const BULLET_LIFE   = 8000;  // max trail points before bullet expires
export const MAX_TELEPORTS = 100;
export const MIN_POWER     = 0.2;
export const MAX_POWER     = 0.8;
export const INIT_DIST     = 1.0;   // gap between station surface and bullet spawn
export const PULSE_MAX_R   = 180;   // pulsar pressure ring max radius (game units)
export const COMET_HITS_TO_DESTROY = 2; // bullet hits required to destroy a comet

// ─── Projectile skimming constants (NFR-2) ────────────────────────────────────
export const MAX_CANNON_SPEED       = (800 / 1000 + MIN_POWER) * MAX_POWER; // = 0.8
export const SKIM_ANGLE_THRESHOLD   = 20;   // degrees from surface tangent (≤ → skim)
export const SKIM_MIN_SPEED_FACTOR  = 0.30; // fraction of MAX_CANNON_SPEED required to skim
export const SKIM_SPEED_REDUCTION    = 0.10; // fraction of speed lost per skim event
export const SKIM_PARTICLE_DURATION  = 0.4;  // seconds for the skim particle effect
export const FRAG_BOUNCE_RETENTION   = 0.6;  // speed retention for fragmentation shot bounce

export class PhysicsEngine {
  constructor(gameWidth, gameHeight) {
    this.gw = gameWidth;
    this.gh = gameHeight;
    this.periodicBoundary = false;
  }

  // ─── initial bullet state from angle/power/station ────────────────────────

  initialState(angle, power, station) {
    const rad    = (angle * Math.PI) / 180;
    const vScale = (power / 1000 + MIN_POWER) * MAX_POWER;
    return {
      position: new Vec2(
        station.position.x + (station.radius + INIT_DIST) * Math.sin(rad),
        station.position.y + (station.radius + INIT_DIST) * Math.cos(rad),
      ),
      velocity: new Vec2(
        vScale * Math.sin(rad),
        vScale * Math.cos(rad),
      ),
    };
  }

  // ─── single physics timestep ──────────────────────────────────────────────
  // Applies Newtonian gravity from all planets, then moves bullet.
  // Handles planet impacts (collision + wormholes) in-step.

  step(bullet, planets, rifts = [], repulsorFields = []) {
    if (bullet.status !== BulletStatus.ACTIVE) return;

    let vx = bullet.velocity.x;
    let vy = bullet.velocity.y;
    const gMult = bullet.gravityMultiplier ?? 1;

    for (const planet of planets) {
      if (planet.destroyed) continue; // already queued for removal this frame

      const dx  = planet.position.x - bullet.position.x;
      const dy  = planet.position.y - bullet.position.y;
      const rSq = dx * dx + dy * dy;
      const R   = planet.impactRadius;

      // Gas giant: bullet passes through; apply linearly-reduced interior gravity
      if (planet.type === PlanetType.GAS_GIANT) {
        const sign  = dx < 0 ? -1 : 1;
        const theta = Math.atan(dy / dx);
        let accel;
        if (rSq >= R * R) {
          accel = sign * G * planet.mass / rSq;
        } else {
          // Interior: g reduces linearly from surface value to zero at core
          const r   = Math.sqrt(rSq);
          accel = sign * G * planet.mass * r / (R * R * R);
        }
        vx += Math.cos(theta) * accel * TIMESTEP * gMult;
        vy += Math.sin(theta) * accel * TIMESTEP * gMult;
        continue; // never impacts — no collision check
      }

      // Broad-phase: skip collision if bullet is outside the bounding circle
      if (rSq >= R * R) {
        // gravity only (below)
      } else if ((planet.type === PlanetType.ASTEROID || planet.type === PlanetType.GIANT_ASTEROID) && planet._rotatedVerts?.length) {
        if (PhysicsEngine._pointInPolygon(bullet.position, planet._rotatedVerts)) {
          this._handlePlanetImpact(bullet, planet, dx, dy, planets);
          return;
        }
      } else {
        this._handlePlanetImpact(bullet, planet, dx, dy, planets);
        return; // don't update position after an impact
      }

      // F = G*M/r², decomposed via atan — matches original Java exactly
      const sign  = dx < 0 ? -1 : 1;
      const theta = Math.atan(dy / dx);
      const accel = sign * G * planet.mass / rSq;
      vx += Math.cos(theta) * accel * TIMESTEP * gMult;
      vy += Math.sin(theta) * accel * TIMESTEP * gMult;

      // Pulsar: outward impulse when bullet crosses an active pressure ring
      if (planet.type === PlanetType.PULSAR && planet.pulsarPulses?.length) {
        const RING_HALF_W = 9;
        const d = Math.sqrt(rSq);
        for (const pulse of planet.pulsarPulses) {
          const pulseR = planet.impactRadius + (PULSE_MAX_R - planet.impactRadius) * pulse.t;
          if (Math.abs(d - pulseR) < RING_HALF_W) {
            const strength = (1 - pulse.t) * 0.027; // fades to zero as ring expands
            vx += (-dx / d) * strength;
            vy += (-dy / d) * strength;
          }
        }
      }
    }

    // Rift repulsion — linear-falloff force from each vertex, bullets only.
    // Reflective (blue) rifts exert no force; their bounce is handled in GameLoop.
    for (const rift of rifts) {
      if (rift.reflective) continue;
      for (const v of rift.vertices) {
        const rdx = bullet.position.x - v.x;
        const rdy = bullet.position.y - v.y;
        const d   = Math.sqrt(rdx * rdx + rdy * rdy);
        if (d < 0.01 || d >= rift.influenceRadius) continue;
        const F = RIFT_REPULSION_STRENGTH * (rift.strengthMultiplier ?? 1) * (1 - d / rift.influenceRadius);
        vx += (rdx / d) * F * TIMESTEP;
        vy += (rdy / d) * F * TIMESTEP;
      }
    }

    // Repulsor field — point repulsion centred on each active station, bullets only
    for (const rf of repulsorFields) {
      const rdx = bullet.position.x - rf.station.position.x;
      const rdy = bullet.position.y - rf.station.position.y;
      const d   = Math.sqrt(rdx * rdx + rdy * rdy);
      if (d < 0.01 || d >= rf.influenceRadius) continue;
      const F = RIFT_REPULSION_STRENGTH * (rf.strength ?? 1) * (1 - d / rf.influenceRadius);
      vx += (rdx / d) * F * TIMESTEP;
      vy += (rdy / d) * F * TIMESTEP;
    }

    // Trick shot: accumulate signed rotation; flag when a full 360° loop is complete
    if (!bullet.trickShotDone) {
      const newAngle = Math.atan2(vy, vx);
      if (bullet._prevAngle !== null) {
        let delta = newAngle - bullet._prevAngle;
        if (delta >  Math.PI) delta -= 2 * Math.PI;
        if (delta < -Math.PI) delta += 2 * Math.PI;
        bullet._angleAccum += delta;
        if (Math.abs(bullet._angleAccum) >= 2 * Math.PI) bullet.trickShotDone = true;
      }
      bullet._prevAngle = newAngle;
    }

    bullet.velocity = new Vec2(vx, vy);
    bullet.position = new Vec2(
      bullet.position.x + vx * TIMESTEP,
      bullet.position.y + vy * TIMESTEP,
    );
    bullet.lifetime++;

    // Boundary — wrap (periodic) or kill (normal)
    const { x, y } = bullet.position;
    if (this.periodicBoundary) {
      let nx = x, ny = y;
      if (x < 0 || x > this.gw) nx = ((x % this.gw) + this.gw) % this.gw;
      if (y < 0 || y > this.gh) ny = ((y % this.gh) + this.gh) % this.gh;
      if (nx !== x || ny !== y) {
        bullet.position = new Vec2(nx, ny);
        bullet.trail = [];
      }
    } else if (x < -this.gw || x > 2 * this.gw || y < -this.gw || y > this.gh + this.gw) {
      bullet.status = BulletStatus.DEAD;
    }

    // Lifetime cap — trail full → start explosion (spawned splits carry a _trailStart offset)
    const life = bullet.maxLifetime ?? BULLET_LIFE;
    if (bullet.trail.length + (bullet._trailStart ?? 0) >= life) {
      bullet.status = BulletStatus.EXPLODING;
    }
  }

  // ─── station collision check (called after step) ──────────────────────────
  // Returns the hit Station or null.

  checkStationCollisions(bullet, stations) {
    if (bullet.status !== BulletStatus.ACTIVE) return null;
    for (const station of stations) {
      if (station.status !== 'active') continue;
      if (bullet.position.distanceSqTo(station.position) < station.radius * station.radius) {
        return station;
      }
    }
    return null;
  }

  // Returns stations the bullet is newly near-missing this step (within 3× their radius but
  // outside their hit radius, excluding the owner and already-counted stations).
  checkNearMisses(bullet, stations) {
    if (bullet.status !== BulletStatus.ACTIVE) return [];
    const result = [];
    for (const station of stations) {
      if (station.status !== 'active') continue;
      if (station === bullet.owner) continue;
      if (bullet.nearMissed.has(station)) continue;
      const dSq = bullet.position.distanceSqTo(station.position);
      const r   = station.radius;
      if (dSq < (r * 3) ** 2 && dSq >= r * r) {
        bullet.nearMissed.add(station);
        result.push(station);
      }
    }
    return result;
  }

  // Returns the first alive collectable hit by this bullet, or null.
  // Collectable collision does NOT stop the bullet — call site handles award + destruction.
  checkCollectableCollision(bullet, collectables) {
    if (bullet.status !== BulletStatus.ACTIVE || !collectables?.length) return null;
    for (const collectable of collectables) {
      if (!collectable.alive) continue;
      if (bullet.position.distanceSqTo(collectable.position) < collectable.radius * collectable.radius) {
        return collectable;
      }
    }
    return null;
  }

  // ─── fast trajectory simulation for AI ───────────────────────────────────
  // Runs a coarser version of the physics loop and returns the closest-approach
  // distance the bullet achieves to targetStation.position over the simulation.
  // stepSize: number of TIMESTEP units advanced per iteration (larger = faster, less accurate).

  simulate(angle, power, fromStation, targetStation, planets, opts = {}) {
    const { stepSize = 20, simSteps = 400, useWormholes = false, rifts = [] } = opts;
    const init = this.initialState(angle, power, fromStation);
    let px = init.position.x, py = init.position.y;
    let vx = init.velocity.x, vy = init.velocity.y;
    const dt = TIMESTEP * stepSize;
    const tx = targetStation.position.x, ty = targetStation.position.y;
    let minDist = 1e9;

    for (let i = 0; i < simSteps; i++) {
      let ax = 0, ay = 0, stop = false;

      for (const planet of planets) {
        const dx  = planet.position.x - px;
        const dy  = planet.position.y - py;
        const rSq = dx * dx + dy * dy;

        if (rSq < planet.impactRadius * planet.impactRadius) {
          const isWH = planet.type === PlanetType.WORMHOLE_PAIRED
                    || planet.type === PlanetType.WORMHOLE_CYCLIC;
          if (useWormholes && isWH && planet.partner) {
            const dest  = planet.partner;
            const sign  = dx < 0 ? -1 : 1;
            const theta = Math.atan(dy / dx);
            const t2    = sign < 0 ? theta + Math.PI : theta;
            px = dest.position.x + Math.cos(t2) * (dest.impactRadius + 0.5);
            py = dest.position.y + Math.sin(t2) * (dest.impactRadius + 0.5);
          } else {
            stop = true;
          }
          break;
        }

        // Direct vector formula (avoids atan/cos/sin; mathematically equivalent)
        const r3inv = 1 / (rSq * Math.sqrt(rSq));
        const accel = G * planet.mass * r3inv;
        ax += dx * accel;
        ay += dy * accel;
      }

      if (stop) break;

      // Rift repulsion in simulation (reflective rifts exert no force — see below)
      for (const rift of rifts) {
        if (rift.reflective) continue;
        for (const v of rift.vertices) {
          const rdx = px - v.x, rdy = py - v.y;
          const d   = Math.sqrt(rdx * rdx + rdy * rdy);
          if (d < 0.01 || d >= rift.influenceRadius) continue;
          const F = RIFT_REPULSION_STRENGTH * (rift.strengthMultiplier ?? 1) * (1 - d / rift.influenceRadius);
          ax += (rdx / d) * F;
          ay += (rdy / d) * F;
        }
      }

      vx += ax * dt; vy += ay * dt;
      const ppx = px, ppy = py;
      px += vx * dt; py += vy * dt;

      // Reflective rift bounce — mirror the velocity if the step crossed a segment
      const bounce = PhysicsEngine._reflectOffRifts(ppx, ppy, px, py, vx, vy, rifts);
      if (bounce) { px = bounce.x; py = bounce.y; vx = bounce.vx; vy = bounce.vy; }

      if (px < -this.gw || px > 2 * this.gw || py < -this.gw || py > this.gh + this.gw) break;

      const d = (px - tx) ** 2 + (py - ty) ** 2;
      if (d < minDist) minDist = d;
    }

    return minDist >= 1e9 ? 1e5 : Math.sqrt(minDist);
  }

  // ─── planet impact handler ────────────────────────────────────────────────

  _handlePlanetImpact(bullet, planet, dx, dy, planets) {
    // Quantum Torpedo: pass through solid non-hazard bodies
    if (bullet.quantumTorpedo) {
      const isHazard   = planet.type === PlanetType.BLACK_HOLE ||
                         planet.type === PlanetType.WHITE_HOLE;
      const isWormhole = planet.type === PlanetType.WORMHOLE_PAIRED  ||
                         planet.type === PlanetType.WORMHOLE_CYCLIC  ||
                         planet.type === PlanetType.WORMHOLE_RANDOM  ||
                         planet.type === PlanetType.WORMHOLE_PLANET  ||
                         planet.type === PlanetType.WORMHOLE_SELF    ||
                         planet.type === PlanetType.WORMHOLE_NETWORK;
      if (!isHazard && !isWormhole) {
        bullet._qtTeleportPlanet = planet;
        // Comets take two hits to destroy; asteroids and crystals pass through intact
        if (planet.type === PlanetType.COMET) {
          planet.hitCount = (planet.hitCount ?? 0) + 1;
          if (planet.hitCount >= COMET_HITS_TO_DESTROY) planet.destroyed = true;
        }
        // Moon / giant asteroid: register crack hit without destroying bullet
        if (planet.type === PlanetType.MOON || planet.type === PlanetType.GIANT_ASTEROID) {
          bullet._hitMoon  = planet;
          bullet._hitMoonX = bullet.position.x;
          bullet._hitMoonY = bullet.position.y;
          if (bullet.owner?.stats) bullet.owner.stats.rockHits++; // Rock Breaker award (§21)
        }
        return;
      }
    }

    const sign   = dx < 0 ? -1 : 1;
    const theta  = Math.atan(dy / dx);
    const theta2 = sign < 0 ? theta + Math.PI : theta;

    switch (planet.type) {
      case PlanetType.BLACK_HOLE:
      case PlanetType.WHITE_HOLE:
        // Silent vanish — fast-forward explosionT so trail can catch up
        bullet.status     = BulletStatus.EXPLODING;
        bullet.explosionT = 0.3;
        break;

      case PlanetType.WORMHOLE_PAIRED:
      case PlanetType.WORMHOLE_CYCLIC: {
        if (planet.partner && bullet.teleportCount < MAX_TELEPORTS) {
          const dest = planet.partner;
          bullet.trail.push(null); // break trail at wormhole entry
          bullet.position = new Vec2(
            dest.position.x + Math.cos(theta2) * (dest.impactRadius + 0.5),
            dest.position.y + Math.sin(theta2) * (dest.impactRadius + 0.5),
          );
          bullet.teleportCount++;
        } else {
          bullet.status = BulletStatus.EXPLODING;
        }
        break;
      }

      case PlanetType.WORMHOLE_RANDOM:
        if (bullet.teleportCount < MAX_TELEPORTS) {
          bullet.trail.push(null);
          bullet.position = new Vec2(Math.random() * this.gw, Math.random() * this.gh);
          bullet.teleportCount++;
        } else {
          bullet.status = BulletStatus.EXPLODING;
        }
        break;

      case PlanetType.WORMHOLE_NETWORK: {
        if (bullet.teleportCount < MAX_TELEPORTS) {
          const others = planets.filter(p => p !== planet && p.type === PlanetType.WORMHOLE_NETWORK && !p.destroyed);
          bullet.trail.push(null);
          if (others.length > 0) {
            const dest = others[Math.floor(Math.random() * others.length)];
            const a = Math.random() * Math.PI * 2;
            bullet.position = new Vec2(
              dest.position.x + Math.cos(a) * (dest.impactRadius + 0.5),
              dest.position.y + Math.sin(a) * (dest.impactRadius + 0.5),
            );
          } else {
            bullet.position = new Vec2(Math.random() * this.gw, Math.random() * this.gh);
          }
          bullet.teleportCount++;
        } else {
          bullet.status = BulletStatus.EXPLODING;
        }
        break;
      }

      case PlanetType.WORMHOLE_PLANET: {
        if (bullet.teleportCount < MAX_TELEPORTS) {
          const others = planets.filter(
            p => p !== planet && p.type === PlanetType.WORMHOLE_PLANET && !p.destroyed,
          );
          bullet.trail.push(null);
          if (others.length === 0) {
            // No other grey wormholes — fall back to random position
            bullet.position = new Vec2(Math.random() * this.gw, Math.random() * this.gh);
          } else {
            // Teleport bullet to first exit (same as paired wormhole behaviour)
            const primary = others[0];
            bullet.position = new Vec2(
              primary.position.x + Math.cos(theta2) * (primary.impactRadius + 0.5),
              primary.position.y + Math.sin(theta2) * (primary.impactRadius + 0.5),
            );
            // Store remaining exits so GameLoop can spawn extra copies
            if (others.length > 1) bullet._greySplitExtras = others.slice(1);
          }
          // Halve remaining lifetime on every grey wormhole pass
          const used = bullet.trail.length + (bullet._trailStart ?? 0);
          bullet._trailStart = (bullet._trailStart ?? 0) + Math.floor((BULLET_LIFE - used) / 2);
          bullet.teleportCount++;
        } else {
          bullet.status = BulletStatus.EXPLODING;
        }
        break;
      }

      case PlanetType.WORMHOLE_SELF:
        if (bullet.teleportCount < MAX_TELEPORTS) {
          bullet.trail.push(null);
          bullet.position = new Vec2(
            planet.position.x + Math.cos(theta2) * (planet.impactRadius + 0.5),
            planet.position.y + Math.sin(theta2) * (planet.impactRadius + 0.5),
          );
          bullet.teleportCount++;
        } else {
          bullet.status = BulletStatus.EXPLODING;
        }
        break;

      case PlanetType.ASTEROID:
        planet.destroyed = true;
        if (bullet.owner?.stats) bullet.owner.stats.rockHits++; // Rock Breaker award (§21)
        if (bullet.fragBouncy) {
          this._fragBounce(bullet, dx, dy, planet.impactRadius);
        } else {
          bullet.status = BulletStatus.EXPLODING;
        }
        break;

      case PlanetType.CRYSTAL:
        planet.destroyed = true;
        if (bullet.owner?.stats) bullet.owner.stats.rockHits++; // Rock Breaker award (§21)
        if (bullet.fragBouncy) {
          this._fragBounce(bullet, dx, dy, planet.impactRadius);
        }
        break;

      case PlanetType.COMET:
        // Comets take two bullet hits to destroy: the first hit only chips it.
        // The bullet still detonates on each hit.
        planet.hitCount = (planet.hitCount ?? 0) + 1;
        if (planet.hitCount >= COMET_HITS_TO_DESTROY) planet.destroyed = true;
        bullet.status = BulletStatus.EXPLODING;
        break;

      case PlanetType.MOON:
      case PlanetType.GIANT_ASTEROID:
        // Multi-hit — record the hit; GameLoop handles crack/fragmentation
        bullet._hitMoon  = planet;
        bullet._hitMoonX = bullet.position.x;
        bullet._hitMoonY = bullet.position.y;
        if (bullet.owner?.stats) bullet.owner.stats.rockHits++; // Rock Breaker award (§21)
        if (bullet.fragBouncy) {
          this._fragBounce(bullet, dx, dy, planet.impactRadius);
        } else {
          bullet.status = BulletStatus.EXPLODING;
        }
        break;

      default: {
        // Skim detection applies to stars only (FR-1); all other solid bodies destroy the bullet
        if (planet.type === PlanetType.STAR) {
          const speed = Math.sqrt(bullet.velocity.x ** 2 + bullet.velocity.y ** 2);
          const minSkimSpeed = SKIM_MIN_SPEED_FACTOR * MAX_CANNON_SPEED;

          if (speed >= minSkimSpeed) {
            const r   = Math.sqrt(dx * dx + dy * dy) || 1;
            // Outward unit normal: from planet centre toward bullet
            const nx  = -dx / r;
            const ny  = -dy / r;
            // sin(angle from tangent) = |v̂ · n̂|; skim when ≤ sin(threshold)
            const sinIncident = Math.abs((bullet.velocity.x * nx + bullet.velocity.y * ny) / speed);

            if (sinIncident <= Math.sin(SKIM_ANGLE_THRESHOLD * Math.PI / 180)) {
              // Reflect velocity about the outward normal, then shed SKIM_SPEED_REDUCTION (FR-2)
              const dot    = bullet.velocity.x * nx + bullet.velocity.y * ny;
              const factor = 1 - SKIM_SPEED_REDUCTION;
              bullet.velocity = new Vec2(
                (bullet.velocity.x - 2 * dot * nx) * factor,
                (bullet.velocity.y - 2 * dot * ny) * factor,
              );
              // Push bullet just outside the surface to prevent immediate re-entry
              bullet.position = new Vec2(
                planet.position.x + nx * (planet.impactRadius + INIT_DIST),
                planet.position.y + ny * (planet.impactRadius + INIT_DIST),
              );
              bullet.skimCount++;
              // Signal to GameLoop for stat tracking + particle effect (FR-6, FR-8)
              bullet._skimEvent = { x: bullet.position.x, y: bullet.position.y, nx, ny, planet };
              return; // bullet stays ACTIVE — no explosion
            }
          }
        }

        // Frag shot bounces off solid rocky planets; stars and white dwarfs still destroy it (FR-5)
        // Bounce cannon (bouncePlanetOnly) also bounces off stars and white dwarfs
        if (bullet.fragBouncy &&
            (bullet.bouncePlanetOnly ||
             (planet.type !== PlanetType.STAR && planet.type !== PlanetType.WHITE_DWARF))) {
          this._fragBounce(bullet, dx, dy, planet.impactRadius);
          return;
        }

        bullet.status = BulletStatus.EXPLODING;
        break;
      }
    }
  }

  // ─── Fragmentation shot inelastic bounce off a surface ───────────────────
  // dx/dy = planet.position - bullet.position; surfaceRadius = planet.impactRadius
  _fragBounce(bullet, dx, dy, surfaceRadius) {
    const r  = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dx / r;  // outward normal: from planet toward bullet
    const ny = -dy / r;
    const dot       = bullet.velocity.x * nx + bullet.velocity.y * ny;
    const retention = bullet.bounceRetention ?? FRAG_BOUNCE_RETENTION;
    bullet.velocity = new Vec2(
      (bullet.velocity.x - 2 * dot * nx) * retention,
      (bullet.velocity.y - 2 * dot * ny) * retention,
    );
    bullet.position = new Vec2(
      bullet.position.x + dx + nx * (surfaceRadius + INIT_DIST),
      bullet.position.y + dy + ny * (surfaceRadius + INIT_DIST),
    );
    bullet.bounceCount = (bullet.bounceCount ?? 0) + 1; // for Trick Shot award (§21)
  }

  // ─── Reflective rift bounce (mirror) ─────────────────────────────────────
  // If the path p0→p1 crosses a reflective rift segment, returns the reflected
  // state { x, y, vx, vy } at the first crossing; otherwise null. Pure geometry,
  // shared by the AI trajectory sim and (via GameLoop) live bullets and lasers.
  static _reflectOffRifts(p0x, p0y, p1x, p1y, vx, vy, rifts) {
    let bestT = Infinity, bestNx = 0, bestNy = 0;
    for (const rift of rifts) {
      if (!rift.reflective) continue;
      const verts = rift.vertices;
      for (let i = 0; i < verts.length - 1; i++) {
        const ax = verts[i].x, ay = verts[i].y;
        const bx = verts[i + 1].x, by = verts[i + 1].y;
        const t = PhysicsEngine._segIntersectT(p0x, p0y, p1x, p1y, ax, ay, bx, by);
        if (t === null || t >= bestT) continue;
        const sdx = bx - ax, sdy = by - ay;
        const len = Math.hypot(sdx, sdy);
        if (len < 1e-10) continue;
        let nx = -sdy / len, ny = sdx / len;
        // Orient the normal toward the incoming side
        if (nx * (p0x - ax) + ny * (p0y - ay) < 0) { nx = -nx; ny = -ny; }
        bestT = t; bestNx = nx; bestNy = ny;
      }
    }
    if (bestT === Infinity) return null;
    const dot = vx * bestNx + vy * bestNy;
    // Bounce point on the segment, nudged back onto the incoming side
    const ix = p0x + (p1x - p0x) * bestT + bestNx * 0.5;
    const iy = p0y + (p1y - p0y) * bestT + bestNy * 0.5;
    return { x: ix, y: iy, vx: vx - 2 * dot * bestNx, vy: vy - 2 * dot * bestNy };
  }

  // Intersection parameter t∈[0,1] of segment AB where it crosses CD, else null.
  static _segIntersectT(ax, ay, bx, by, cx, cy, dx, dy) {
    const d1x = bx - ax, d1y = by - ay;
    const d2x = dx - cx, d2y = dy - cy;
    const cross = d1x * d2y - d1y * d2x;
    if (Math.abs(cross) < 1e-10) return null;
    const t = ((cx - ax) * d2y - (cy - ay) * d2x) / cross;
    const u = ((cx - ax) * d1y - (cy - ay) * d1x) / cross;
    return (t >= 0 && t <= 1 && u >= 0 && u <= 1) ? t : null;
  }

  // ─── Exact point-in-polygon test (world-space rotated verts) ─────────────
  // Ray-casting (even-odd) test: counts how many polygon edges a ray cast to
  // +x from the bullet crosses; an odd count means the point is inside. Unlike
  // SAT this is exact for *concave* polygons, so the deep valleys between an
  // asteroid's spikes correctly register as empty space rather than as hull.
  static _pointInPolygon(point, verts) {
    const px = point.x, py = point.y;
    const n  = verts.length;
    let inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = verts[i].x, yi = verts[i].y;
      const xj = verts[j].x, yj = verts[j].y;
      if (((yi > py) !== (yj > py)) &&
          (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    return inside;
  }
}
