import { Vec2 }                                                      from '../core/Vec2.js';
import { Planet, PlanetType, ShadingStyle, GAS_GIANT_COLOUR_PAIRS } from '../entities/Planet.js';
import { weightedRandomId }                                from './scenarioData.js';

// Generate a convex-ish polygon with N=6–10 unit-radius vertices (in angle order)
function asteroidVertices(rng, n) {
  const verts = [];
  for (let i = 0; i < n; i++) {
    const baseAngle = (2 * Math.PI * i) / n;
    const jitter    = (rng.next() - 0.5) * (Math.PI / n) * 1.2;
    const angle     = baseAngle + jitter;
    const r         = 0.55 + rng.next() * 0.45;
    verts.push(new Vec2(r * Math.cos(angle), r * Math.sin(angle)));
  }
  return verts;
}

const ROCKY_COL             = [150, 120,  80];
const ASTEROID_COL          = [120,  80,  10];
const RICH_ASTEROID_COL     = [ 75,  90, 120]; // blue-brown tint for rich asteroids
const CRYSTAL_ASTEROID_COL  = [160, 210, 255]; // icy blue-white for crystal asteroids
const MOON_COL     = [120, 100,  70];
const WHITE_COL    = [255, 255, 255];
const BLACK_COL    = [  0,   0,   0];
const DULL_COL     = [160, 100,  70];

// ─── helpers ────────────────────────────────────────────────────────────────

function rv(rng, A, B, C, dim) {
  return (A * rng.next() + B * rng.next()) * dim + C * dim;
}

function rr(rng, D, E, F) {
  return D * rng.next() + E * rng.next() + F;
}

function starColour(rng) {
  return [
    Math.floor(rng.next() * 30) + 205,
    Math.floor(rng.next() * 30) + 205,
    Math.floor(rng.next() * 190) + 15,
  ];
}

function makePlanet(rng, A, B, C, D, E, F, gw, gh, density, type, colour, shading, extras = {}) {
  return new Planet({
    position: new Vec2(rv(rng, A, B, C, gw), rv(rng, A, B, C, gh)),
    radius:   rr(rng, D, E, F),
    density, type, colour: [...colour], shading,
    ...extras,
  });
}

function makeAsteroid(rng, A, B, C, D, E, F, gw, gh, density, richProb = 0) {
  const n        = 6 + Math.floor(rng.next() * 5); // 6–10 vertices
  const vertices = asteroidVertices(rng, n);
  const speed    = (0.1 + rng.next() * rng.next() * 0.7) * Math.PI / 180; // biased toward slow
  const rotation = rng.next() * Math.PI * 2;
  const isRich   = richProb > 0 && rng.next() < richProb;
  const planet   = new Planet({
    position:      new Vec2(rv(rng, A, B, C, gw), rv(rng, A, B, C, gh)),
    radius:        rr(rng, D, E, F),
    density,
    type:          PlanetType.ASTEROID,
    colour:        isRich ? [...RICH_ASTEROID_COL] : [...ASTEROID_COL],
    shading:       ShadingStyle.ROCKY,
    vertices,
    rotation,
    rotationSpeed: speed,
    rich:          isRich,
  });
  // Pre-compute rotated verts so background rendering has them immediately
  const cos = Math.cos(rotation), sin = Math.sin(rotation);
  const px = planet.position.x, py = planet.position.y, r = planet.radius;
  planet._rotatedVerts = vertices.map(v => new Vec2(
    px + r * (v.x * cos - v.y * sin),
    py + r * (v.x * sin + v.y * cos),
  ));
  return planet;
}

function makeCrystalAsteroid(rng, A, B, C, D, E, F, gw, gh, density) {
  const n        = 6 + Math.floor(rng.next() * 5);
  const vertices = asteroidVertices(rng, n);
  const speed    = (0.1 + rng.next() * rng.next() * 0.7) * Math.PI / 180;
  const rotation = rng.next() * Math.PI * 2;
  const planet   = new Planet({
    position:      new Vec2(rv(rng, A, B, C, gw), rv(rng, A, B, C, gh)),
    radius:        rr(rng, D, E, F),
    density,
    type:          PlanetType.CRYSTAL,
    colour:        [...CRYSTAL_ASTEROID_COL],
    shading:       ShadingStyle.ROCKY,
    vertices,
    rotation,
    rotationSpeed: speed,
  });
  const cos = Math.cos(rotation), sin = Math.sin(rotation);
  const px = planet.position.x, py = planet.position.y, r = planet.radius;
  planet._rotatedVerts = vertices.map(v => new Vec2(
    px + r * (v.x * cos - v.y * sin),
    py + r * (v.x * sin + v.y * cos),
  ));
  return planet;
}

function makeGasGiant(rng, A, B, C, D, E, F, gw, gh, density) {
  const pairIdx = Math.floor(rng.next() * GAS_GIANT_COLOUR_PAIRS.length);
  const [colA, colB] = GAS_GIANT_COLOUR_PAIRS[pairIdx];
  return new Planet({
    position: new Vec2(rv(rng, A, B, C, gw), rv(rng, A, B, C, gh)),
    radius:   rr(rng, D, E, F),
    density,
    type:     PlanetType.GAS_GIANT,
    colour:   [...colA],
    colourB:  [...colB],
    shading:  ShadingStyle.GAS_GIANT,
  });
}

function makeComet(rng, position, velocity) {
  return new Planet({
    position,
    radius:   4 + rng.next() * 5, // 4–9 game units
    density:  0.1,
    type:     PlanetType.COMET,
    colour:   [255, 255, 200],
    shading:  ShadingStyle.GLOWING,
    velocity,
  });
}

function makePulsar(rng, A, B, C, gw, gh) {
  const bigR  = rng.nextInRange(80, 160) + 140.5;
  const dispR = rng.nextInRange(7, 10);
  return new Planet({
    position:     new Vec2(rv(rng, A, B, C, gw), rv(rng, A, B, C, gh)),
    radius:       dispR,
    density:      0.014,
    mass:         bigR * bigR * 0.014, // white-dwarf equivalent mass
    type:         PlanetType.PULSAR,
    colour:       [...WHITE_COL],
    shading:      ShadingStyle.GLOWING,
    pulsarPeriod: 0.1 + rng.next() * 0.9, // 0.1–1 seconds (5× more frequent)
    pulsarPhase:  rng.next() * 4.5,        // random initial phase so they desync
  });
}

function makeWormhole(rng, gw, gh, colour, type, extras = {}) {
  const radius = rng.nextInRange(10, 30) + 10;
  return new Planet({
    position: new Vec2(
      rv(rng, 0.4, 0.4, 0.1, gw),
      rv(rng, 0.4, 0.4, 0.1, gh),
    ),
    radius, density: 0.08,
    type, colour: [...colour], shading: ShadingStyle.WORMHOLE,
    ...extras,
  });
}

// ─── main API ───────────────────────────────────────────────────────────────

export class ScenarioFactory {
  static create(scenarioId, gw, gh, nPlanets, rng, wildcardFrequency = 'rare', performance = 'full', collectables = 'off', richAsteroids = 'normal') {
    const richProb = collectables === 'off' ? 0 : (
      { off: 0, rare: 0.01, normal: 0.05, common: 0.10, abundant: 0.25, overwhelming: 1.0 }[richAsteroids] ?? 0.05
    );
    // Pre-roll sub-choice values (outside retry loop, matches Java's rnumber1-7)
    const rn = rng.roll(7); // rn[0]..rn[6]

    nPlanets = ScenarioFactory._cap(scenarioId, nPlanets);

    let planets = [];
    let attempts = 0;

    do {
      planets = ScenarioFactory._generate(scenarioId, gw, gh, nPlanets, rng, rn, performance, richProb);
      attempts++;
      if (attempts > 1000) { nPlanets = Math.max(0, nPlanets - 1); attempts = 0; }
    } while (nPlanets > 0 && !ScenarioFactory._validate(planets, gw, gh));

    // Wildcard bonus injection — frequency controlled by wildcardFrequency setting
    const WILDCARD_THRESHOLDS = {
      off: 0, veryRare: 0.03, rare: 0.1, occasional: 0.25, common: 0.55, always: 2,
    };
    const threshold = WILDCARD_THRESHOLDS[wildcardFrequency] ?? 0.1;
    if (threshold > 0 && rn[1] < threshold) {
      ScenarioFactory._addBonus(planets, rng, rn[2], rn[3], gw, gh, performance);
      if (rn[4] < 0.35) {
        ScenarioFactory._addBonus(planets, rng, rn[5], rn[6], gw, gh, performance);
      }
    }

    return planets;
  }

  static randomId(rng) { return weightedRandomId(rng); }

  // ─── station placement ───────────────────────────────────────────────────
  // Called after planets are confirmed. Sets position on each Station object.

  static placeStations(teams, planets, gw, gh, stationSize, rng, teamClustering = 'off') {
    const all = teams.flatMap(t => t.stations);
    const n   = all.length;
    const sr  = stationSize.radius;

    // Min inter-station distance and retry reduction (matches original Java table)
    const minDistTable  = [0, 0, 450, 450, 300, 250, 200, 200, 200, 150, 150, 120];
    const reductionTable = [0, 0, 0.17, 0.10, 0.0625, 0.05, 0.0375, 0.0375, 0.0375, 0.025, 0.025, 0.0175];
    let minDist  = n < minDistTable.length  ? minDistTable[n]   : 100;
    const reduction = n < reductionTable.length ? reductionTable[n] : 0.0125;

    let attempts = 0;
    let valid    = false;

    while (!valid && attempts < 4000) {
      // Place all stations; clustered teams bias non-first stations toward their anchor
      const teamAnchors = new Map();
      for (const s of all) {
        const hasAnchor = teamAnchors.has(s.team.index);
        const clustered = teamClustering !== 'off' && hasAnchor && s.team.stations.length > 1;
        if (clustered) {
          s.position = ScenarioFactory._clusteredPos(teamAnchors.get(s.team.index), gw, gh, sr, teamClustering, rng);
        } else {
          s.position = new Vec2(
            (0.8 * rng.next() + 0.075 * rng.next()) * gw + 0.075 * gw,
            (0.8 * rng.next() + 0.075 * rng.next()) * gh + 0.075 * gh,
          );
          if (!hasAnchor) teamAnchors.set(s.team.index, s.position);
        }
      }

      valid = true;

      // Station–station distance check
      outer:
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          const distSq   = all[i].position.distanceSqTo(all[j].position);
          const sameTeam = all[i].team === all[j].team;
          // When clustering is active, same-team stations can be arbitrarily close — skip that check.
          // Different-team stations always require the full min-distance separation.
          const limit = (sameTeam && teamClustering !== 'off') ? 0 : (sameTeam ? minDist * minDist * 0.25 : minDist * minDist);
          if (distSq < limit) {
            valid = false;
            minDist = Math.max(60, minDist - reduction);
            break outer;
          }
        }
      }

      // Station–planet distance check
      if (valid) {
        for (const s of all) {
          for (const p of planets) {
            if (s.position.distanceSqTo(p.position) < (p.impactRadius + sr) ** 2) {
              valid = false;
              break;
            }
          }
          if (!valid) break;
        }
      }

      attempts++;
    }

    // Tier-2 fallback: drop station–station requirement, keep planet avoidance.
    // Handles extreme scenarios (e.g. large binary stars) where spacing is impossible.
    if (!valid) {
      let emergency = 0;
      do {
        for (const s of all) {
          s.position = new Vec2(rng.next() * gw, rng.next() * gh);
        }
        valid = ScenarioFactory._stationsOutsidePlanets(all, planets, sr);
        emergency++;
      } while (!valid && emergency < 2000);
    }

    // Tier-3 last resort: push any station that's still inside a planet to its surface.
    for (const s of all) {
      for (const p of planets) {
        const dist    = s.position.distanceTo(p.position);
        const minR    = p.impactRadius + sr + 5;
        if (dist < minR) {
          const dir = dist < 0.001
            ? new Vec2(1, 0)
            : s.position.sub(p.position).normalised();
          s.position = p.position.add(dir.scale(minR));
        }
      }
    }

    // Final pass: iteratively push overlapping stations apart so no two stations
    // ever share the same position, even after tier-2/3 fallback.
    const minSep = sr * 2 + 4;
    for (let iter = 0; iter < 30; iter++) {
      let anyOverlap = false;
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          const a  = all[i], b = all[j];
          const dx = b.position.x - a.position.x;
          const dy = b.position.y - a.position.y;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (d < minSep) {
            anyOverlap = true;
            const push = (minSep - d) / 2 + 1;
            const nx   = d < 0.001 ? 1 : dx / d;
            const ny   = d < 0.001 ? 0 : dy / d;
            a.position = new Vec2(
              Math.max(sr, Math.min(gw - sr, a.position.x - nx * push)),
              Math.max(sr, Math.min(gh - sr, a.position.y - ny * push)),
            );
            b.position = new Vec2(
              Math.max(sr, Math.min(gw - sr, b.position.x + nx * push)),
              Math.max(sr, Math.min(gh - sr, b.position.y + ny * push)),
            );
          }
        }
      }
      if (!anyOverlap) break;
    }
  }

  static _stationsOutsidePlanets(stations, planets, sr) {
    for (const s of stations) {
      for (const p of planets) {
        if (s.position.distanceSqTo(p.position) < (p.impactRadius + sr) ** 2) return false;
      }
    }
    return true;
  }

  // Generate a position near anchor respecting the clustering mode.
  static _clusteredPos(anchor, gw, gh, sr, clustering, rng) {
    const margin = Math.max(sr + 5, 0.075 * gw);
    const clamp  = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    if (clustering === 'tight') {
      const radius = sr * 8;
      const angle  = rng.next() * Math.PI * 2;
      const dist   = rng.next() * radius;
      return new Vec2(
        clamp(anchor.x + Math.cos(angle) * dist, margin, gw - margin),
        clamp(anchor.y + Math.sin(angle) * dist, margin, gh - margin),
      );
    } else if (clustering === 'moderate') {
      const radius = gw * 0.25;
      const angle  = rng.next() * Math.PI * 2;
      const dist   = rng.next() * radius;
      return new Vec2(
        clamp(anchor.x + Math.cos(angle) * dist, margin, gw - margin),
        clamp(anchor.y + Math.sin(angle) * dist, margin, gh - margin),
      );
    } else { // loose — same quadrant
      const qx = anchor.x < gw / 2
        ? [margin, gw / 2 - margin]
        : [gw / 2 + margin, gw - margin];
      const qy = anchor.y < gh / 2
        ? [margin, gh / 2 - margin]
        : [gh / 2 + margin, gh - margin];
      return new Vec2(
        qx[0] + rng.next() * (qx[1] - qx[0]),
        qy[0] + rng.next() * (qy[1] - qy[0]),
      );
    }
  }

  // ─── scenario cap ──────────────────────────────────────────────────────────

  static _cap(id, n) {
    const caps = { 1:10, 6:14, 7:12, 8:13, 10:8, 18:12 };
    return caps[id] !== undefined ? Math.min(n, caps[id]) : n;
  }

  // ─── planet placement ──────────────────────────────────────────────────────

  static _generate(id, gw, gh, nPlanets, rng, rn, performance = 'full', richProb = 0) {
    const simplified = performance === 'simplified';
    const planets = [];

    switch (id) {

      // ── 1: Planetary ──────────────────────────────────────────────────────
      case 1: {
        for (let i = 0; i < nPlanets; i++)
          planets.push(makePlanet(rng, 0.4,0.4,0.1, 30,30,10, gw,gh, 0.03, PlanetType.ROCKY, ROCKY_COL, ShadingStyle.ROCKY));
        break;
      }

      // ── 2: Asteroids ──────────────────────────────────────────────────────
      case 2: {
        for (let i = 0; i < nPlanets; i++)
          planets.push(makeAsteroid(rng, 1,0,0, 20,5,3, gw,gh, 0.05, richProb));
        break;
      }

      // ── 4: Star System ────────────────────────────────────────────────────
      case 4: {
        const col = starColour(rng);
        const bigR = rng.nextInRange(80, 160) + 80;
        planets.push(new Planet({
          position: new Vec2(rv(rng,0.1,0.1,0.4,gw), rv(rng,0.1,0.1,0.4,gh)),
          radius: bigR, density: 0.015,
          type: PlanetType.STAR, colour: col, shading: ShadingStyle.GLOWING,
        }));
        for (let i = 1; i < nPlanets; i++)
          planets.push(makePlanet(rng, 1,0,0, 20,5,4, gw,gh, 0.08, PlanetType.ROCKY, ROCKY_COL, ShadingStyle.ROCKY));
        break;
      }

      // ── 5: Binary Star ────────────────────────────────────────────────────
      case 5: {
        for (let s = 0; s < 2; s++) {
          const col = starColour(rng);
          const bigR = rng.nextInRange(80, 160) + 40;
          planets.push(new Planet({
            position: new Vec2(rv(rng,0.3,0.3,0.2,gw), rv(rng,0.3,0.3,0.2,gh)),
            radius: bigR, density: 0.01,
            type: PlanetType.STAR, colour: col, shading: ShadingStyle.GLOWING,
          }));
        }
        for (let i = 2; i < nPlanets; i++)
          planets.push(makeAsteroid(rng, 1,0,0, 20,5,4, gw,gh, 0.08, richProb));
        break;
      }

      // ── 6: Jovian ─────────────────────────────────────────────────────────
      case 6: {
        const bigR = rng.nextInRange(80, 160) + 40;
        // Central body is now a gas giant of equivalent Jovian mass
        const pairIdx = Math.floor(rng.next() * GAS_GIANT_COLOUR_PAIRS.length);
        const [colA, colB] = GAS_GIANT_COLOUR_PAIRS[pairIdx];
        planets.push(new Planet({
          position: new Vec2(rv(rng,0.1,0.1,0.4,gw), rv(rng,0.1,0.1,0.4,gh)),
          radius: bigR, density: 0.01,
          type: PlanetType.GAS_GIANT, colour: [...colA], colourB: [...colB],
          shading: ShadingStyle.GAS_GIANT,
        }));
        for (let i = 1; i < nPlanets; i++)
          planets.push(makePlanet(rng, 1,0,0, 6,6,3, gw,gh, 0.04, PlanetType.ROCKY, MOON_COL, ShadingStyle.ROCKY));
        break;
      }

      // ── 7: Super Giant ────────────────────────────────────────────────────
      case 7: {
        const sCol = [Math.floor(rng.next()*10)+245, Math.floor(rng.next()*245)+10, Math.floor(rng.next()*45)];
        const bigR = (rng.next()*0.2 + rng.next()*0.2) * gh + 1.5*gh;
        const bigM = 4000;
        planets.push(new Planet({
          position: new Vec2(rv(rng,3,0,-1,gw), rv(rng,3,0,-1,gh)),
          radius: bigR, density: bigM/(bigR*bigR), mass: bigM,
          type: PlanetType.STAR, colour: sCol, shading: ShadingStyle.GLOWING,
        }));
        for (let i = 1; i < nPlanets; i++)
          planets.push(makeAsteroid(rng, 1,0,0, 30,5,9, gw,gh, 0.05, richProb));
        break;
      }

      // ── 8: Super Giant Binary ─────────────────────────────────────────────
      case 8: {
        for (let s = 0; s < 2; s++) {
          const sCol = [Math.floor(rng.next()*10)+245, Math.floor(rng.next()*245), Math.floor(rng.next()*45)];
          const bigR = (rng.next()*0.2 + rng.next()*0.2) * gh + 1.5*gh;
          planets.push(new Planet({
            position: new Vec2(rv(rng,3,0,-1,gw), rv(rng,3,0,-1,gh)),
            radius: bigR, density: 4000/(bigR*bigR), mass: 4000,
            type: PlanetType.STAR, colour: sCol, shading: ShadingStyle.GLOWING,
          }));
        }
        for (let i = 2; i < nPlanets; i++)
          planets.push(makeAsteroid(rng, 1,0,0, 10,10,9, gw,gh, 0.05, richProb));
        break;
      }

      // ── 9: Uneven Binary ──────────────────────────────────────────────────
      case 9: {
        // Supergiant (off-screen)
        const sg1R = (rng.next()*0.2 + rng.next()*0.2) * gh + 1.5*gh;
        const sg1Col = [Math.floor(rng.next()*10)+245, Math.floor(rng.next()*245), Math.floor(rng.next()*45)];
        planets.push(new Planet({
          position: new Vec2(rv(rng,3,0,-1,gw), rv(rng,3,0,-1,gh)),
          radius: sg1R, density: 4000/(sg1R*sg1R), mass: 4000,
          type: PlanetType.STAR, colour: sg1Col, shading: ShadingStyle.GLOWING,
        }));
        // Regular star (on-screen)
        const s2Col = starColour(rng);
        const s2R   = rng.nextInRange(80, 160) + 50;
        planets.push(new Planet({
          position: new Vec2(rv(rng,0.4,0.4,0.1,gw), rv(rng,0.4,0.4,0.1,gh)),
          radius: s2R, density: 0.02,
          type: PlanetType.STAR, colour: s2Col, shading: ShadingStyle.GLOWING,
        }));
        for (let i = 2; i < nPlanets; i++)
          planets.push(makeAsteroid(rng, 1,0,0, 10,10,9, gw,gh, 0.05, richProb));
        break;
      }

      // ── 10: Red Giant ──────────────────────────────────────────────────────
      case 10: {
        const rgCol = [Math.floor(rng.next()*10)+245, Math.floor(rng.next()*115), Math.floor(rng.next()*25)];
        const rgR   = rng.nextInRange(80, 160) + 140;
        planets.push(new Planet({
          position: new Vec2(rv(rng,0.1,0.1,0.4,gw), rv(rng,0.1,0.1,0.4,gh)),
          radius: rgR, density: 0.015,
          type: PlanetType.STAR, colour: rgCol, shading: ShadingStyle.GLOWING,
        }));
        for (let i = 1; i < nPlanets; i++)
          planets.push(makeAsteroid(rng, 1,0,0, 20,5,4, gw,gh, 0.065, richProb));
        break;
      }

      // ── 11: Star Cluster ──────────────────────────────────────────────────
      case 11: {
        for (let i = 0; i < nPlanets; i++) {
          const col = [Math.floor(rng.next()*30)+215, Math.floor(rng.next()*30)+205, Math.floor(rng.next()*190)+15];
          planets.push(makePlanet(rng, 1.2,0,-0.1, 70,70,30, gw,gh, 0.015, PlanetType.STAR, col, ShadingStyle.GLOWING));
        }
        break;
      }

      // ── 13: Mixture ───────────────────────────────────────────────────────
      case 13: {
        let initial = Math.floor(nPlanets * (0.6*rng.next() + 0.6*rng.next()));
        initial = Math.max(1, Math.min(7, initial));
        for (let i = 0; i < initial; i++) {
          const col = [Math.floor(rng.next()*30)+215, Math.floor(rng.next()*30)+205, Math.floor(rng.next()*190)+15];
          planets.push(makePlanet(rng, 1.2,0,-0.1, 70,70,30, gw,gh, 0.015, PlanetType.STAR, col, ShadingStyle.GLOWING));
        }
        for (let i = initial; i < nPlanets; i++)
          planets.push(makeAsteroid(rng, 1,0,0, 20,5,4, gw,gh, 0.1, richProb));
        break;
      }

      // ── 14: White Dwarf ───────────────────────────────────────────────────
      case 14: {
        const bigR  = rng.nextInRange(80, 160) + 140.5;
        const dispR = rng.nextInRange(7, 10);   // game units (originally pixel-sized)
        planets.push(new Planet({
          position:     new Vec2(rv(rng,0.1,0.1,0.4,gw), rv(rng,0.1,0.1,0.4,gh)),
          radius:       dispR,
          density:      0.014,
          mass:         bigR * bigR * 0.014,
          type:         PlanetType.WHITE_DWARF,
          colour:       WHITE_COL,
          shading:      ShadingStyle.GLOWING,
        }));
        for (let i = 1; i < nPlanets; i++)
          planets.push(makePlanet(rng, 1,0,0, 5,5,3, gw,gh, 0.5, PlanetType.ROCKY, DULL_COL, ShadingStyle.ROCKY));
        break;
      }

      // ── 19: Wormhole (single scenario, one wormhole type) ─────────────────
      case 19: {
        const wType = rn[0];
        if (wType < 0.75 && nPlanets > 1) {
          // Purple paired
          const w0 = makeWormhole(rng, gw,gh, [255,55,255], PlanetType.WORMHOLE_PAIRED);
          const w1 = makeWormhole(rng, gw,gh, [255,55,255], PlanetType.WORMHOLE_PAIRED);
          w0.partner = w1; w1.partner = w0;
          planets.push(w0, w1);
          for (let i = 2; i < nPlanets; i++)
            planets.push(makePlanet(rng, 1,0,0, 20,20,3, gw,gh, 0.03, PlanetType.ROCKY, ROCKY_COL, ShadingStyle.ROCKY));
        } else if (wType < 0.9 && nPlanets > 2) {
          // Blue cyclic A→B→C→A
          const wc = [0,1,2].map(() => makeWormhole(rng, gw,gh, [55,55,255], PlanetType.WORMHOLE_CYCLIC));
          wc[0].partner = wc[1]; wc[1].partner = wc[2]; wc[2].partner = wc[0];
          planets.push(...wc);
          for (let i = 3; i < nPlanets; i++)
            planets.push(makePlanet(rng, 1,0,0, 20,20,3, gw,gh, 0.03, PlanetType.ROCKY, ROCKY_COL, ShadingStyle.ROCKY));
        } else {
          // Yellow self-teleport
          planets.push(makeWormhole(rng, gw,gh, [255,255,55], PlanetType.WORMHOLE_SELF));
          for (let i = 1; i < nPlanets; i++)
            planets.push(makeAsteroid(rng, 1,0,0, 18,18,3, gw,gh, 0.03, richProb));
        }
        break;
      }

      // ── 21: White Dwarfs ──────────────────────────────────────────────────
      case 21: {
        for (let i = 0; i < nPlanets; i++)
          planets.push(makePlanet(rng, 0.9,0,0.1, 3,3,4, gw,gh, 3, PlanetType.WHITE_DWARF, WHITE_COL, ShadingStyle.GLOWING));
        break;
      }

      // ── 22: Black Hole ────────────────────────────────────────────────────
      case 22: {
        const bhBigR = rng.nextInRange(80, 160) + 140;
        const bhDispR = 3; // game units (tiny)
        planets.push(new Planet({
          position:    new Vec2(rv(rng,0.1,0.1,0.4,gw), rv(rng,0.1,0.1,0.4,gh)),
          radius:      bhDispR,
          density:     0.02,
          mass:        bhBigR * bhBigR * 0.02,
          type:        PlanetType.BLACK_HOLE,
          colour:      BLACK_COL,
          shading:     ShadingStyle.NONE,
        }));
        for (let i = 1; i < nPlanets; i++)
          planets.push(makePlanet(rng, 1,0,0, 6,6,1, gw,gh, 0.5, PlanetType.ROCKY, DULL_COL, ShadingStyle.ROCKY));
        break;
      }

      // ── 27: Black Holes ───────────────────────────────────────────────────
      case 27: {
        for (let i = 0; i < nPlanets; i++)
          planets.push(makePlanet(rng, 0.9,0,0.1, 0,0,3, gw,gh, 50, PlanetType.BLACK_HOLE, BLACK_COL, ShadingStyle.NONE));
        break;
      }

      // ── 20: Wormholes (all wormholes) ─────────────────────────────────────
      case 20: {
        const wt = rn[0];
        if (wt < 0.25) {
          // Paired purple — ensure even count
          const count = nPlanets % 2 === 0 ? nPlanets : nPlanets - 1;
          for (let i = 0; i < count; i += 2) {
            const wa = makeWormhole(rng, gw,gh, [255,55,255], PlanetType.WORMHOLE_PAIRED);
            const wb = makeWormhole(rng, gw,gh, [255,55,255], PlanetType.WORMHOLE_PAIRED);
            wa.partner = wb; wb.partner = wa;
            planets.push(wa, wb);
          }
        } else if (wt < 0.45) {
          // Cyclic blue — all chain to next, last chains to first
          const all = Array.from({length: nPlanets}, () =>
            makeWormhole(rng, gw,gh, [55,55,255], PlanetType.WORMHOLE_CYCLIC));
          for (let i = 0; i < all.length; i++)
            all[i].partner = all[(i + 1) % all.length];
          planets.push(...all);
        } else if (wt < 0.70) {
          // Network red — each exits via another red wormhole on the map
          for (let i = 0; i < nPlanets; i++)
            planets.push(makeWormhole(rng, gw,gh, [255,55,55], PlanetType.WORMHOLE_NETWORK));
        } else if (wt < 0.90) {
          // Grey — splits into one copy per grey wormhole (red network in simplified)
          for (let i = 0; i < nPlanets; i++)
            planets.push(simplified
              ? makeWormhole(rng, gw,gh, [255,55,55], PlanetType.WORMHOLE_NETWORK)
              : makeWormhole(rng, gw,gh, [155,155,155], PlanetType.WORMHOLE_PLANET));
        } else {
          // Self yellow
          for (let i = 0; i < nPlanets; i++)
            planets.push(makeWormhole(rng, gw,gh, [255,255,55], PlanetType.WORMHOLE_SELF));
        }
        break;
      }

      // ── 28: Big Wormhole Pair ─────────────────────────────────────────────
      case 28: {
        {
          // Two paired purple huge wormholes — centres fixed just outside opposite
          // screen corners so the impact zone always clips into the playfield.
          const bigR = (rng.next()*0.2 + rng.next()*0.2)*gh + 1.5*gh;
          const margin = 10 + rng.next() * 25; // 10–35 units outside the corner
          const cx0 = rng.next() < 0.5 ? -margin : gw + margin;
          const cy0 = rng.next() < 0.5 ? -margin : gh + margin;
          const w0 = new Planet({
            position: new Vec2(cx0, cy0), radius: bigR,
            density: 1000/(bigR*bigR), mass: 100,
            type: PlanetType.WORMHOLE_PAIRED, colour: [255,55,255],
            shading: ShadingStyle.WORMHOLE,
            impactRadius: 80,
          });
          const w1 = new Planet({
            position: new Vec2(gw - cx0, gh - cy0), radius: bigR,
            density: 1200/(bigR*bigR), mass: 1200,
            type: PlanetType.WORMHOLE_PAIRED, colour: [255,55,255],
            shading: ShadingStyle.WORMHOLE,
            impactRadius: 80,
          });
          w0.partner = w1; w1.partner = w0;
          planets.push(w0, w1);
          for (let i = 2; i < nPlanets; i++)
            planets.push(makePlanet(rng, 1,0,0, 20,20,9, gw,gh, 0.07, PlanetType.ROCKY, ASTEROID_COL, ShadingStyle.ROCKY));
        }
        break;
      }

      // ── 24: White Hole ────────────────────────────────────────────────────
      case 24: {
        const whDispR = 6; // game units
        const whBigR  = rng.nextInRange(80, 160) + 140;
        planets.push(new Planet({
          position:    new Vec2(rv(rng,0.1,0.1,0.4,gw), rv(rng,0.1,0.1,0.4,gh)),
          radius:      whDispR,
          density:     0.02,
          mass:        -20,
          type:        PlanetType.WHITE_HOLE,
          colour:      WHITE_COL,
          shading:     ShadingStyle.GLOWING,
          halo:        15.0,
        }));
        for (let i = 1; i < nPlanets; i++)
          planets.push(makePlanet(rng, 1,0,0, 16,16,1, gw,gh, 0.06, PlanetType.ROCKY, DULL_COL, ShadingStyle.ROCKY));
        break;
      }

      // ── 25: White Holes ───────────────────────────────────────────────────
      case 25: {
        for (let i = 0; i < nPlanets; i++) {
          const p = makePlanet(rng, 0.9,0,0.1, 3,3,4, gw,gh, -0.2, PlanetType.WHITE_HOLE, WHITE_COL, ShadingStyle.GLOWING);
          p.halo = 15.0;
          planets.push(p);
        }
        break;
      }

      // ── 26: Hyperspace ────────────────────────────────────────────────────
      case 26: {
        const useWormholeShading = rn[0] >= 0.8;
        for (let i = 0; i < nPlanets; i++) {
          const density  = rng.next() < 0.5 ?  6 * rng.next() : -5 * rng.next();
          const positive = density >= 0;
          const colour   = positive
            ? [Math.floor(255 - 40*density), 255, 0]
            : [255, Math.min(255, Math.floor(255 + 50*density)), 0];
          const type    = rng.next() < 0.8 ? PlanetType.BLACK_HOLE
                        : (simplified ? PlanetType.WORMHOLE_NETWORK : PlanetType.WORMHOLE_PLANET);
          const shading = useWormholeShading ? ShadingStyle.WORMHOLE : ShadingStyle.GLOWING;
          planets.push(makePlanet(rng, 0.9,0,0.1, 0,0,5, gw,gh, density, type, colour, shading));
        }
        break;
      }

      // ── 12: Gas Giants ────────────────────────────────────────────────────
      case 12: {
        for (let i = 0; i < nPlanets; i++)
          planets.push(makeGasGiant(rng, 0.4,0.4,0.1, 30,30,10, gw,gh, 0.03));
        break;
      }

      // ── 23: Neutron Star (one pulsar + mix of rocky planets and asteroids) ──
      case 23: {
        planets.push(makePulsar(rng, 0.1, 0.1, 0.4, gw, gh));
        for (let i = 1; i < nPlanets; i++) {
          if (i % 3 === 1)
            planets.push(makeAsteroid(rng, 1, 0, 0, 20, 5, 4, gw, gh, 0.065, richProb));
          else
            planets.push(makePlanet(rng, 1, 0, 0, 5, 5, 3, gw, gh, 0.5, PlanetType.ROCKY, DULL_COL, ShadingStyle.ROCKY));
        }
        break;
      }

      // ── 16: Asteroid Ring ────────────────────────────────────────────────────
      case 16: {
        // Central gas giant: 80% centred, 20% offset so ≥25% of diameter is visible
        let cx, cy;
        const pairIdx = Math.floor(rng.next() * GAS_GIANT_COLOUR_PAIRS.length);
        const [colA, colB] = GAS_GIANT_COLOUR_PAIRS[pairIdx];
        const gasR = 45 + Math.floor(rng.next() * 40); // 45–84
        if (rng.next() < 0.8) {
          cx = gw * (0.3 + rng.next() * 0.4);
          cy = gh * (0.3 + rng.next() * 0.4);
        } else {
          // Offset: gas giant near an edge, at least 25% diameter on screen
          const minVis = gasR * 0.5; // half radius must be visible
          const side   = Math.floor(rng.next() * 4);
          if      (side === 0) { cx = -gasR * 0.75 + minVis; cy = gh * (0.15 + rng.next() * 0.7); }
          else if (side === 1) { cx = gw + gasR * 0.75 - minVis; cy = gh * (0.15 + rng.next() * 0.7); }
          else if (side === 2) { cx = gw * (0.15 + rng.next() * 0.7); cy = -gasR * 0.75 + minVis; }
          else                 { cx = gw * (0.15 + rng.next() * 0.7); cy = gh + gasR * 0.75 - minVis; }
        }
        planets.push(new Planet({
          position: new Vec2(cx, cy), radius: gasR, density: 0.01,
          type: PlanetType.GAS_GIANT, colour: [...colA], colourB: [...colB],
          shading: ShadingStyle.GAS_GIANT,
        }));

        // 1 ring (70%), 2 rings (22%), 3 rings (8%)
        const numRings = rng.next() < 0.70 ? 1 : rng.next() < 0.73 ? 2 : 3;
        const ringBands = [];
        let nextMinR = gasR * 1.9 + 15;
        for (let ri = 0; ri < numRings; ri++) {
          const ringR    = nextMinR + 20 + rng.next() * 40;
          const halfBand = 10 + rng.next() * 30;
          const innerR   = ringR - halfBand;
          const outerR   = ringR + halfBand;
          ringBands.push({ innerR, outerR, ringR });
          nextMinR = outerR + 15;

          // Distribute asteroids proportionally by circumference; double normal density
          const totalAsteroids = Math.max(8, nPlanets * 2);
          const totalCircum    = ringBands.reduce((s, b) => s + b.ringR, 0);
          const count = Math.round(totalAsteroids * ringR / totalCircum);

          for (let i = 0; i < count; i++) {
            const angle = rng.next() * Math.PI * 2;
            const r     = innerR + rng.next() * (outerR - innerR);
            const ax    = cx + Math.cos(angle) * r;
            const ay    = cy + Math.sin(angle) * r;
            // Skip asteroids fully off screen (offset scenarios)
            if (ax < -30 || ax > gw + 30 || ay < -30 || ay > gh + 30) continue;
            ScenarioFactory._placeRingAsteroid(rng, ax, ay, planets, richProb);
          }
        }
        // Optional wildcard: one non-gas-giant body (~15%)
        if (rng.next() < 0.15) ScenarioFactory._addBonus(planets, rng, rng.next(), rng.next(), gw, gh, performance);
        break;
      }

      // ── 17: Asteroid Belt ────────────────────────────────────────────────────
      case 17: {
        // Belt centre: 75% off-screen, 25% near map centre
        const scx = gw / 2, scy = gh / 2;
        let bx, by;
        const offScreen = rng.next() < 0.75;
        if (offScreen) {
          const offAngle = rng.next() * Math.PI * 2;
          const offDist  = Math.max(gw, gh) * (1.3 + rng.next() * 0.8);
          bx = scx + Math.cos(offAngle) * offDist;
          by = scy + Math.sin(offAngle) * offDist;
        } else {
          bx = gw * (0.3 + rng.next() * 0.4);
          by = gh * (0.3 + rng.next() * 0.4);
        }

        // When off-screen, the belt radius must ≈ distance-to-map so the arc crosses the viewport.
        const distToCenter = Math.sqrt((bx - scx) ** 2 + (by - scy) ** 2);
        const baseR = offScreen
          ? distToCenter * (0.70 + rng.next() * 0.20) // arc sweeps through map
          : Math.max(gw, gh) * (0.20 + rng.next() * 0.20); // on-screen: moderate ring

        // 1 belt (70%), 2 belts (22%), 3 belts (8%)
        const numBelts = rng.next() < 0.70 ? 1 : rng.next() < 0.73 ? 2 : 3;
        const beltBands = [];
        let nextMinR = baseR;

        for (let bi = 0; bi < numBelts; bi++) {
          const beltR    = nextMinR + (offScreen ? distToCenter * 0.08 : 20) + rng.next() * 40;
          const halfBand = 10 + rng.next() * 30;
          const innerR   = beltR - halfBand;
          const outerR   = beltR + halfBand;
          beltBands.push({ innerR, outerR, beltR });
          nextMinR = outerR + (offScreen ? distToCenter * 0.12 : 20);

          // Pre-compute which angles produce on-screen positions, then sample from those.
          // This guarantees asteroids appear even when only a small arc is visible.
          const ANG_STEPS = 720;
          const midR = (innerR + outerR) / 2;
          const visAngles = [];
          for (let ai = 0; ai < ANG_STEPS; ai++) {
            const a  = (ai / ANG_STEPS) * Math.PI * 2;
            const px = bx + Math.cos(a) * midR;
            const py = by + Math.sin(a) * midR;
            if (px >= -10 && px <= gw + 10 && py >= -10 && py <= gh + 10) visAngles.push(a);
          }
          if (visAngles.length === 0) continue; // arc misses the map — skip this belt

          const totalAsteroids = Math.max(10, nPlanets * 2);
          const totalCircum    = beltBands.reduce((s, b) => s + b.beltR, 0);
          const count          = Math.round(totalAsteroids * beltR / totalCircum);
          const angStep        = (2 * Math.PI / ANG_STEPS) * 3; // jitter width

          for (let i = 0; i < count; i++) {
            const baseA = visAngles[Math.floor(rng.next() * visAngles.length)];
            const angle = baseA + (rng.next() - 0.5) * angStep;
            const r     = innerR + rng.next() * (outerR - innerR);
            const ax    = bx + Math.cos(angle) * r;
            const ay    = by + Math.sin(angle) * r;
            if (ax < -20 || ax > gw + 20 || ay < -20 || ay > gh + 20) continue;
            ScenarioFactory._placeRingAsteroid(rng, ax, ay, planets, richProb);
          }
        }
        if (rng.next() < 0.15) ScenarioFactory._addBonus(planets, rng, rng.next(), rng.next(), gw, gh, performance);
        break;
      }

      // ── 15: Comet ────────────────────────────────────────────────────────────
      case 15: {
        // Small star near centre
        const sCol = starColour(rng);
        const sR   = 30 + Math.floor(rng.next() * 30);
        planets.push(new Planet({
          position: new Vec2(rv(rng,0.1,0.1,0.4,gw), rv(rng,0.1,0.1,0.4,gh)),
          radius: sR, density: 0.015,
          type: PlanetType.STAR, colour: sCol, shading: ShadingStyle.GLOWING,
        }));
        const numRocks = 2 + Math.floor(rng.next() * 3); // 2–4 asteroids
        for (let i = 0; i < numRocks; i++)
          planets.push(makeAsteroid(rng, 1,0,0, 12,4,3, gw,gh, 0.05, richProb));
        // Single comet with a random initial velocity
        const vAngle = rng.next() * Math.PI * 2;
        const vSpeed = 0.03 + rng.next() * 0.07;
        const comet = makeComet(rng,
          new Vec2(gw * (0.1 + rng.next() * 0.8), gh * (0.1 + rng.next() * 0.8)),
          new Vec2(Math.cos(vAngle) * vSpeed, Math.sin(vAngle) * vSpeed),
        );
        planets.push(comet);
        break;
      }

      // ── 18: Oort Cloud ───────────────────────────────────────────────────────
      case 18: {
        // White dwarf near centre
        const wdBigR  = 100 + Math.floor(rng.next() * 60);
        const wdDispR = 6 + Math.floor(rng.next() * 4);
        const wdMass  = wdBigR * wdBigR * 0.014;
        const wd = new Planet({
          position: new Vec2(rv(rng,0.1,0.1,0.4,gw), rv(rng,0.1,0.1,0.4,gh)),
          radius: wdDispR, density: 0.014, mass: wdMass,
          type: PlanetType.WHITE_DWARF, colour: WHITE_COL, shading: ShadingStyle.GLOWING,
        });
        planets.push(wd);
        // Comets with approximate circular orbital velocities + variance
        const numComets = 4 + Math.floor(rng.next() * 7); // 4–10
        const G_REDUCED = 0.2 * 0.05; // must match GameLoop.COMET_G_FACTOR
        for (let i = 0; i < numComets; i++) {
          const orbitR = 80 + rng.next() * 230;
          const angle  = rng.next() * Math.PI * 2;
          const px = wd.position.x + Math.cos(angle) * orbitR;
          const py = wd.position.y + Math.sin(angle) * orbitR;
          if (px < -80 || px > gw + 80 || py < -80 || py > gh + 80) continue;
          const vCirc    = Math.sqrt(G_REDUCED * wdMass / orbitR);
          const variance = 0.6 + rng.next() * 0.8; // 0.6–1.4× for elliptical orbits
          const vMag     = vCirc * variance;
          const perpAngle = angle + Math.PI / 2;
          const comet = makeComet(rng,
            new Vec2(px, py),
            new Vec2(Math.cos(perpAngle) * vMag, Math.sin(perpAngle) * vMag),
          );
          planets.push(comet);
        }
        break;
      }

      // ── 3: Crystal Asteroids ─────────────────────────────────────────────
      case 3: {
        for (let i = 0; i < nPlanets; i++)
          planets.push(makeCrystalAsteroid(rng, 1,0,0, 20,5,3, gw,gh, 0.05));
        break;
      }

      default:
        // Fallback to Planetary
        for (let i = 0; i < nPlanets; i++)
          planets.push(makePlanet(rng, 0.4,0.4,0.1, 30,30,10, gw,gh, 0.03, PlanetType.ROCKY, ROCKY_COL, ShadingStyle.ROCKY));
    }

    return planets;
  }

  // ─── validation ─────────────────────────────────────────────────────────

  static _validate(planets, gw, gh) {
    if (!planets.length) return true;
    const minGap = 10;

    // No planet-planet overlap — use impactRadius for gameplay-relevant size,
    // falling back to radius. This prevents huge-physics/small-capture planets
    // (e.g. big wormholes) from failing validation due to their physics radius.
    for (let i = 0; i < planets.length; i++) {
      for (let j = i + 1; j < planets.length; j++) {
        const pi = planets[i], pj = planets[j];
        const ri = pi.impactRadius ?? pi.radius;
        const rj = pj.impactRadius ?? pj.radius;
        const dist = pi.position.distanceTo(pj.position);
        if (dist < minGap + ri + rj) return false;
      }
    }

    // ≥80 of 400 grid points free (≥20% of play area)
    let freeCount = 0;
    for (let i = 0; i < 20; i++) {
      for (let j = 0; j < 20; j++) {
        const px = (i / 20) * gw;
        const py = (j / 20) * gh;
        let free = true;
        for (const p of planets) {
          const pr = p.impactRadius ?? p.radius;
          if (p.position.distanceSqTo(new Vec2(px, py)) < pr * pr) {
            free = false;
            break;
          }
        }
        if (free) freeCount++;
      }
    }
    return freeCount >= 80;
  }

  // Try to place a ring/belt asteroid at (ax, ay). Returns false without mutating
  // `planets` if it would overlap an existing body.
  static _placeRingAsteroid(rng, ax, ay, planets, richProb = false) {
    const a = ScenarioFactory._makeRingAsteroid(rng, ax, ay, richProb);
    const minGap = 10;
    for (const p of planets) {
      if (p.position.distanceTo(a.position) < p.impactRadius + a.impactRadius + minGap) return false;
    }
    planets.push(a);
    return true;
  }

  // Create a single asteroid at world position (ax, ay) for ring/belt scenarios.
  static _makeRingAsteroid(rng, ax, ay, richProb = false) {
    const n        = 6 + Math.floor(rng.next() * 5);
    const vertices = [];
    for (let i = 0; i < n; i++) {
      const base  = (2 * Math.PI * i) / n;
      const angle = base + (rng.next() - 0.5) * (Math.PI / n) * 1.2;
      const r     = 0.55 + rng.next() * 0.45;
      vertices.push(new Vec2(r * Math.cos(angle), r * Math.sin(angle)));
    }
    const speed    = (0.1 + rng.next() * rng.next() * 0.7) * Math.PI / 180;
    const rotation = rng.next() * Math.PI * 2;
    const radius   = rr(rng, 6, 3, 3); // slightly larger than regular asteroids
    const isRich   = richProb && rng.next() < 0.05;
    const planet   = new Planet({
      position: new Vec2(ax, ay), radius, density: 0.05,
      type: PlanetType.ASTEROID, colour: isRich ? [...RICH_ASTEROID_COL] : [...ASTEROID_COL],
      shading: ShadingStyle.ROCKY, vertices, rotation, rotationSpeed: speed, rich: isRich,
    });
    const cos = Math.cos(rotation), sin = Math.sin(rotation);
    planet._rotatedVerts = vertices.map(v => new Vec2(
      ax + radius * (v.x * cos - v.y * sin),
      ay + radius * (v.x * sin + v.y * cos),
    ));
    return planet;
  }

  // ─── bonus random feature injection ─────────────────────────────────────

  static _addBonus(planets, rng, ra, rb, gw, gh, performance = 'full') {
    const simplified = performance === 'simplified';
    if (planets.length < 2) return;

    let candidates;
    if (rb < 0.25 && planets.length > 2) {
      const w0 = makeWormhole(rng, gw,gh, [255,55,255], PlanetType.WORMHOLE_PAIRED);
      const w1 = makeWormhole(rng, gw,gh, [255,55,255], PlanetType.WORMHOLE_PAIRED);
      w0.partner = w1; w1.partner = w0;
      candidates = [w0, w1];
    } else if (rb < 0.5 && planets.length > 3) {
      const wc = [0,1,2].map(() => makeWormhole(rng, gw,gh, [55,55,255], PlanetType.WORMHOLE_CYCLIC));
      wc[0].partner = wc[1]; wc[1].partner = wc[2]; wc[2].partner = wc[0];
      candidates = wc;
    } else if (rb < 0.6) {
      candidates = [makeWormhole(rng, gw,gh, [255,55,55], PlanetType.WORMHOLE_NETWORK)];
    } else if (rb < 0.70) {
      // Grey triple — bullet enters one, copies emerge from the other two
      // Simplified: use red network wormholes instead
      candidates = simplified
        ? [0,1,2].map(() => makeWormhole(rng, gw,gh, [255,55,55], PlanetType.WORMHOLE_NETWORK))
        : [0,1,2].map(() => makeWormhole(rng, gw,gh, [155,155,155], PlanetType.WORMHOLE_PLANET));
    } else if (rb < 0.85) {
      const bigR = rng.nextInRange(3, 6) + 4;
      candidates = [new Planet({
        position: new Vec2(rv(rng,0.4,0.4,0.1,gw), rv(rng,0.4,0.4,0.1,gh)),
        radius: bigR, density: 3,
        type: PlanetType.WHITE_DWARF, colour: WHITE_COL, shading: ShadingStyle.GLOWING,
      })];
    } else if (rb < 0.90) {
      const bigR = rng.nextInRange(3, 6) + 4;
      candidates = [new Planet({
        position:     new Vec2(rv(rng,0.4,0.4,0.1,gw), rv(rng,0.4,0.4,0.1,gh)),
        radius:       bigR, density: 3,
        type:         PlanetType.PULSAR,
        colour:       [...WHITE_COL],
        shading:      ShadingStyle.GLOWING,
        pulsarPeriod: 0.1 + rng.next() * 0.9,
        pulsarPhase:  rng.next() * 0.9,
      })];
    } else if (rb < 0.95) {
      candidates = [new Planet({
        position: new Vec2(rv(rng,0.4,0.4,0.1,gw), rv(rng,0.4,0.4,0.1,gh)),
        radius: 3, density: 50,
        type: PlanetType.BLACK_HOLE, colour: BLACK_COL, shading: ShadingStyle.NONE,
      })];
    } else {
      // Wildcard comet with a random initial velocity
      const vAngle = rng.next() * Math.PI * 2;
      const vSpeed = 0.03 + rng.next() * 0.07;
      candidates = [makeComet(rng,
        new Vec2(rv(rng,0.4,0.4,0.1,gw), rv(rng,0.4,0.4,0.1,gh)),
        new Vec2(Math.cos(vAngle) * vSpeed, Math.sin(vAngle) * vSpeed),
      )];
    }

    // Reject any candidate that overlaps an existing planet; retry position up to 20 times
    const allSoFar = [...planets];
    for (const c of candidates) {
      let placed = false;
      for (let attempt = 0; attempt < 20; attempt++) {
        const overlaps = allSoFar.some(p =>
          c.position.distanceTo(p.position) < c.impactRadius + p.impactRadius + 10,
        );
        if (!overlaps) { placed = true; break; }
        // Reroll position
        c.position = new Vec2(rv(rng,0.4,0.4,0.1,gw), rv(rng,0.4,0.4,0.1,gh));
      }
      if (placed) { allSoFar.push(c); planets.push(c); }
    }
  }
}
