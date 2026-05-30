import { Vec2 }          from '../core/Vec2.js';
import { PlanetType }    from '../entities/Planet.js';
import { BulletStatus }  from '../entities/Bullet.js';

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

export class PhysicsEngine {
  constructor(gameWidth, gameHeight) {
    this.gw = gameWidth;
    this.gh = gameHeight;
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

  step(bullet, planets) {
    if (bullet.status !== BulletStatus.ACTIVE) return;

    let vx = bullet.velocity.x;
    let vy = bullet.velocity.y;

    for (const planet of planets) {
      if (planet.destroyed) continue; // already queued for removal this frame

      const dx  = planet.position.x - bullet.position.x;
      const dy  = planet.position.y - bullet.position.y;
      const rSq = dx * dx + dy * dy;

      // Broad-phase: skip SAT if bullet is outside the bounding circle
      if (rSq >= planet.impactRadius * planet.impactRadius) {
        // gravity only (below)
      } else if (planet.type === PlanetType.ASTEROID && planet._rotatedVerts?.length) {
        if (PhysicsEngine._satCollides(bullet.position, planet._rotatedVerts)) {
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
      vx += Math.cos(theta) * accel * TIMESTEP;
      vy += Math.sin(theta) * accel * TIMESTEP;
    }

    bullet.velocity = new Vec2(vx, vy);
    bullet.position = new Vec2(
      bullet.position.x + vx * TIMESTEP,
      bullet.position.y + vy * TIMESTEP,
    );
    bullet.lifetime++;

    // Boundary — bullet leaves extended play area → DEAD (no explosion)
    const { x, y } = bullet.position;
    if (x < -this.gw || x > 2 * this.gw || y < -this.gw || y > this.gh + this.gw) {
      bullet.status = BulletStatus.DEAD;
    }

    // Lifetime cap — trail full → start explosion
    if (bullet.trail.length >= BULLET_LIFE) {
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

  // ─── fast trajectory simulation for AI ───────────────────────────────────
  // Runs a coarser version of the physics loop and returns the closest-approach
  // distance the bullet achieves to targetStation.position over the simulation.
  // stepSize: number of TIMESTEP units advanced per iteration (larger = faster, less accurate).

  simulate(angle, power, fromStation, targetStation, planets, opts = {}) {
    const { stepSize = 20, simSteps = 400, useWormholes = false } = opts;
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

      vx += ax * dt; vy += ay * dt;
      px += vx * dt; py += vy * dt;

      if (px < -this.gw || px > 2 * this.gw || py < -this.gw || py > this.gh + this.gw) break;

      const d = (px - tx) ** 2 + (py - ty) ** 2;
      if (d < minDist) minDist = d;
    }

    return minDist >= 1e9 ? 1e5 : Math.sqrt(minDist);
  }

  // ─── planet impact handler ────────────────────────────────────────────────

  _handlePlanetImpact(bullet, planet, dx, dy, planets) {
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

      case PlanetType.WORMHOLE_PLANET: {
        if (bullet.teleportCount < MAX_TELEPORTS) {
          const dest = planets[Math.floor(Math.random() * planets.length)];
          const a    = Math.random() * Math.PI * 2;
          bullet.trail.push(null);
          bullet.position = new Vec2(
            dest.position.x + Math.cos(a) * (dest.impactRadius + 0.5),
            dest.position.y + Math.sin(a) * (dest.impactRadius + 0.5),
          );
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
        // Mark for fragmentation — GameLoop processes children after the physics batch
        planet.destroyed = true;
        bullet.status = BulletStatus.EXPLODING;
        break;

      default:
        // ROCKY, STAR, JOVIAN, WHITE_DWARF — normal explosion
        bullet.status = BulletStatus.EXPLODING;
        break;
    }
  }

  // ─── SAT circle-vs-polygon collision (world-space rotated verts) ─────────
  // Tests each polygon edge normal; if any axis separates the bullet point
  // from the polygon, returns false. Also tests the closest-vertex axis.
  static _satCollides(point, verts) {
    const bx = point.x, by = point.y;
    const n  = verts.length;

    for (let i = 0; i < n; i++) {
      const a  = verts[i];
      const b  = verts[(i + 1) % n];
      const ex = b.x - a.x, ey = b.y - a.y;
      const len = Math.sqrt(ex * ex + ey * ey);
      if (len === 0) continue;
      // Edge normal (either direction works for SAT)
      const nx = -ey / len, ny = ex / len;

      let polyMin = Infinity, polyMax = -Infinity;
      for (const v of verts) {
        const proj = v.x * nx + v.y * ny;
        if (proj < polyMin) polyMin = proj;
        if (proj > polyMax) polyMax = proj;
      }
      const bulletProj = bx * nx + by * ny;
      if (bulletProj < polyMin || bulletProj > polyMax) return false;
    }

    // Closest-vertex axis (handles bullet approaching a vertex from outside)
    let closestDistSq = Infinity, closestV = null;
    for (const v of verts) {
      const dsq = (bx - v.x) ** 2 + (by - v.y) ** 2;
      if (dsq < closestDistSq) { closestDistSq = dsq; closestV = v; }
    }
    if (closestV) {
      const vlen = Math.sqrt(closestDistSq);
      if (vlen > 0) {
        const nx = (bx - closestV.x) / vlen, ny = (by - closestV.y) / vlen;
        let polyMin = Infinity, polyMax = -Infinity;
        for (const v of verts) {
          const proj = v.x * nx + v.y * ny;
          if (proj < polyMin) polyMin = proj;
          if (proj > polyMax) polyMax = proj;
        }
        const bulletProj = bx * nx + by * ny;
        if (bulletProj < polyMin || bulletProj > polyMax) return false;
      }
    }

    return true;
  }
}
