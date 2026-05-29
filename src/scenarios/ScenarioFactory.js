import { Vec2 }                            from '../core/Vec2.js';
import { Planet, PlanetType, ShadingStyle } from '../entities/Planet.js';
import { weightedRandomId }                 from './scenarioData.js';

const ROCKY_COL    = [150, 120,  80];
const ASTEROID_COL = [120,  80,  10];
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
  static create(scenarioId, gw, gh, nPlanets, rng) {
    // Pre-roll sub-choice values (outside retry loop, matches Java's rnumber1-7)
    const rn = rng.roll(7); // rn[0]..rn[6]

    nPlanets = ScenarioFactory._cap(scenarioId, nPlanets);

    let planets = [];
    let attempts = 0;

    do {
      planets = ScenarioFactory._generate(scenarioId, gw, gh, nPlanets, rng, rn);
      attempts++;
      if (attempts > 1000) { nPlanets = Math.max(0, nPlanets - 1); attempts = 0; }
    } while (nPlanets > 0 && !ScenarioFactory._validate(planets, gw, gh));

    // Bonus random feature injection (~10% chance, matches original)
    if (rn[1] < 0.1) {
      ScenarioFactory._addBonus(planets, rng, rn[2], rn[3], gw, gh);
      if (rn[4] < 0.35) {
        ScenarioFactory._addBonus(planets, rng, rn[5], rn[6], gw, gh);
      }
    }

    return planets;
  }

  static randomId(rng) { return weightedRandomId(rng); }

  // ─── station placement ───────────────────────────────────────────────────
  // Called after planets are confirmed. Sets position on each Station object.

  static placeStations(teams, planets, gw, gh, stationSize, rng) {
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
      // Place all stations within the safe inner margin
      for (const s of all) {
        s.position = new Vec2(
          (0.8 * rng.next() + 0.075 * rng.next()) * gw + 0.075 * gw,
          (0.8 * rng.next() + 0.075 * rng.next()) * gh + 0.075 * gh,
        );
      }

      valid = true;

      // Station–station distance check
      outer:
      for (let i = 0; i < all.length; i++) {
        for (let j = i + 1; j < all.length; j++) {
          const distSq  = all[i].position.distanceSqTo(all[j].position);
          const sameTeam = all[i].team === all[j].team;
          // Same-team: must stay ≥ half min-distance apart; different teams: full min-distance
          const limit = sameTeam ? minDist * minDist * 0.25 : minDist * minDist;
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
  }

  static _stationsOutsidePlanets(stations, planets, sr) {
    for (const s of stations) {
      for (const p of planets) {
        if (s.position.distanceSqTo(p.position) < (p.impactRadius + sr) ** 2) return false;
      }
    }
    return true;
  }

  // ─── scenario cap ──────────────────────────────────────────────────────────

  static _cap(id, n) {
    const caps = { 1:10, 6:14, 7:12, 8:13, 10:8, 18:12 };
    return caps[id] !== undefined ? Math.min(n, caps[id]) : n;
  }

  // ─── planet placement ──────────────────────────────────────────────────────

  static _generate(id, gw, gh, nPlanets, rng, rn) {
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
          planets.push(makePlanet(rng, 1,0,0, 20,5,3, gw,gh, 0.05, PlanetType.ASTEROID, ASTEROID_COL, ShadingStyle.ROCKY));
        break;
      }

      // ── 3: Star System ────────────────────────────────────────────────────
      case 3: {
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

      // ── 4: Binary Star ────────────────────────────────────────────────────
      case 4: {
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
          planets.push(makePlanet(rng, 1,0,0, 20,5,4, gw,gh, 0.08, PlanetType.ASTEROID, ASTEROID_COL, ShadingStyle.ROCKY));
        break;
      }

      // ── 5: Jovian ─────────────────────────────────────────────────────────
      case 5: {
        const jCol = [Math.floor(rng.next()*100)+145, Math.floor(rng.next()*125), Math.floor(rng.next()*55)];
        const bigR = rng.nextInRange(80, 160) + 40;
        planets.push(new Planet({
          position: new Vec2(rv(rng,0.1,0.1,0.4,gw), rv(rng,0.1,0.1,0.4,gh)),
          radius: bigR, density: 0.01,
          type: PlanetType.JOVIAN, colour: jCol, shading: ShadingStyle.ROCKY,
        }));
        for (let i = 1; i < nPlanets; i++)
          planets.push(makePlanet(rng, 1,0,0, 6,6,3, gw,gh, 0.04, PlanetType.ROCKY, MOON_COL, ShadingStyle.ROCKY));
        break;
      }

      // ── 6: Super Giant ────────────────────────────────────────────────────
      case 6: {
        const sCol = [Math.floor(rng.next()*10)+245, Math.floor(rng.next()*245)+10, Math.floor(rng.next()*45)];
        const bigR = (rng.next()*0.2 + rng.next()*0.2) * gh + 1.5*gh;
        const bigM = 4000;
        planets.push(new Planet({
          position: new Vec2(rv(rng,3,0,-1,gw), rv(rng,3,0,-1,gh)),
          radius: bigR, density: bigM/(bigR*bigR), mass: bigM,
          type: PlanetType.STAR, colour: sCol, shading: ShadingStyle.GLOWING,
        }));
        for (let i = 1; i < nPlanets; i++)
          planets.push(makePlanet(rng, 1,0,0, 30,5,9, gw,gh, 0.05, PlanetType.ASTEROID, ASTEROID_COL, ShadingStyle.ROCKY));
        break;
      }

      // ── 7: Super Giant Binary ─────────────────────────────────────────────
      case 7: {
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
          planets.push(makePlanet(rng, 1,0,0, 10,10,9, gw,gh, 0.05, PlanetType.ASTEROID, ASTEROID_COL, ShadingStyle.ROCKY));
        break;
      }

      // ── 8: Uneven Binary ──────────────────────────────────────────────────
      case 8: {
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
          planets.push(makePlanet(rng, 1,0,0, 10,10,9, gw,gh, 0.05, PlanetType.ASTEROID, ASTEROID_COL, ShadingStyle.ROCKY));
        break;
      }

      // ── 9: Red Giant ──────────────────────────────────────────────────────
      case 9: {
        const rgCol = [Math.floor(rng.next()*10)+245, Math.floor(rng.next()*115), Math.floor(rng.next()*25)];
        const rgR   = rng.nextInRange(80, 160) + 140;
        planets.push(new Planet({
          position: new Vec2(rv(rng,0.1,0.1,0.4,gw), rv(rng,0.1,0.1,0.4,gh)),
          radius: rgR, density: 0.015,
          type: PlanetType.STAR, colour: rgCol, shading: ShadingStyle.GLOWING,
        }));
        for (let i = 1; i < nPlanets; i++)
          planets.push(makePlanet(rng, 1,0,0, 20,5,4, gw,gh, 0.065, PlanetType.ASTEROID, ASTEROID_COL, ShadingStyle.ROCKY));
        break;
      }

      // ── 10: Star Cluster ──────────────────────────────────────────────────
      case 10: {
        for (let i = 0; i < nPlanets; i++) {
          const col = [Math.floor(rng.next()*30)+215, Math.floor(rng.next()*30)+205, Math.floor(rng.next()*190)+15];
          planets.push(makePlanet(rng, 1.2,0,-0.1, 70,70,30, gw,gh, 0.015, PlanetType.STAR, col, ShadingStyle.GLOWING));
        }
        break;
      }

      // ── 11: Mixture ───────────────────────────────────────────────────────
      case 11: {
        let initial = Math.floor(nPlanets * (0.6*rng.next() + 0.6*rng.next()));
        initial = Math.max(1, Math.min(7, initial));
        for (let i = 0; i < initial; i++) {
          const col = [Math.floor(rng.next()*30)+215, Math.floor(rng.next()*30)+205, Math.floor(rng.next()*190)+15];
          planets.push(makePlanet(rng, 1.2,0,-0.1, 70,70,30, gw,gh, 0.015, PlanetType.STAR, col, ShadingStyle.GLOWING));
        }
        for (let i = initial; i < nPlanets; i++)
          planets.push(makePlanet(rng, 1,0,0, 20,5,4, gw,gh, 0.1, PlanetType.ASTEROID, ASTEROID_COL, ShadingStyle.ROCKY));
        break;
      }

      // ── 12: White Dwarf ───────────────────────────────────────────────────
      case 12: {
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

      // ── 13: Wormhole (single scenario, one wormhole type) ─────────────────
      case 13: {
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
        } else if (wType < 0.96) {
          // Green random teleport
          planets.push(makeWormhole(rng, gw,gh, [55,255,55], PlanetType.WORMHOLE_RANDOM));
          for (let i = 1; i < nPlanets; i++)
            planets.push(makePlanet(rng, 1,0,0, 20,20,3, gw,gh, 0.03, PlanetType.ROCKY, ROCKY_COL, ShadingStyle.ROCKY));
        } else {
          // Yellow self-teleport
          planets.push(makeWormhole(rng, gw,gh, [255,255,55], PlanetType.WORMHOLE_SELF));
          for (let i = 1; i < nPlanets; i++)
            planets.push(makePlanet(rng, 1,0,0, 18,18,3, gw,gh, 0.03, PlanetType.ASTEROID, ASTEROID_COL, ShadingStyle.ROCKY));
        }
        break;
      }

      // ── 14: White Dwarfs ──────────────────────────────────────────────────
      case 14: {
        for (let i = 0; i < nPlanets; i++)
          planets.push(makePlanet(rng, 0.9,0,0.1, 3,3,4, gw,gh, 3, PlanetType.WHITE_DWARF, WHITE_COL, ShadingStyle.GLOWING));
        break;
      }

      // ── 15: Black Hole ────────────────────────────────────────────────────
      case 15: {
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

      // ── 16: Black Holes ───────────────────────────────────────────────────
      case 16: {
        for (let i = 0; i < nPlanets; i++)
          planets.push(makePlanet(rng, 0.9,0,0.1, 0,0,3, gw,gh, 50, PlanetType.BLACK_HOLE, BLACK_COL, ShadingStyle.NONE));
        break;
      }

      // ── 17: Wormholes (all wormholes) ─────────────────────────────────────
      case 17: {
        const wt = rn[0];
        if (wt < 0.40) {
          // Paired purple — ensure even count
          const count = nPlanets % 2 === 0 ? nPlanets : nPlanets - 1;
          for (let i = 0; i < count; i += 2) {
            const wa = makeWormhole(rng, gw,gh, [255,55,255], PlanetType.WORMHOLE_PAIRED);
            const wb = makeWormhole(rng, gw,gh, [255,55,255], PlanetType.WORMHOLE_PAIRED);
            wa.partner = wb; wb.partner = wa;
            planets.push(wa, wb);
          }
        } else if (wt < 0.70) {
          // Cyclic blue — all chain to next, last chains to first
          const all = Array.from({length: nPlanets}, () =>
            makeWormhole(rng, gw,gh, [55,55,255], PlanetType.WORMHOLE_CYCLIC));
          for (let i = 0; i < all.length; i++)
            all[i].partner = all[(i + 1) % all.length];
          planets.push(...all);
        } else if (wt < 0.85) {
          // Random destination red
          for (let i = 0; i < nPlanets; i++)
            planets.push(makeWormhole(rng, gw,gh, [255,55,55], PlanetType.WORMHOLE_RANDOM));
        } else if (wt < 0.90) {
          // Random location green
          for (let i = 0; i < nPlanets; i++)
            planets.push(makeWormhole(rng, gw,gh, [55,255,55], PlanetType.WORMHOLE_RANDOM));
        } else if (wt < 0.95) {
          // Changing random destination grey
          for (let i = 0; i < nPlanets; i++)
            planets.push(makeWormhole(rng, gw,gh, [155,155,155], PlanetType.WORMHOLE_PLANET));
        } else {
          // Self yellow
          for (let i = 0; i < nPlanets; i++)
            planets.push(makeWormhole(rng, gw,gh, [255,255,55], PlanetType.WORMHOLE_SELF));
        }
        break;
      }

      // ── 18: Big Wormhole Pair ─────────────────────────────────────────────
      case 18: {
        const wt18 = rn[0];
        if (wt18 < 0.1 || nPlanets <= 1) {
          // Single green random wormhole
          const w = makeWormhole(rng, gw,gh, [55,255,55], PlanetType.WORMHOLE_RANDOM);
          w.radius = 50; planets.push(w);
          for (let i = 1; i < nPlanets; i++)
            planets.push(makePlanet(rng, 1,0,0, 20,20,9, gw,gh, 0.07, PlanetType.ROCKY, ASTEROID_COL, ShadingStyle.ROCKY));
        } else if (wt18 < 0.2) {
          // Two green random wormholes
          for (let s = 0; s < 2; s++) {
            const w = makeWormhole(rng, gw,gh, [55,255,55], PlanetType.WORMHOLE_RANDOM);
            w.radius = 50; planets.push(w);
          }
          for (let i = 2; i < nPlanets; i++)
            planets.push(makePlanet(rng, 1,0,0, 20,20,9, gw,gh, 0.07, PlanetType.ROCKY, ASTEROID_COL, ShadingStyle.ROCKY));
        } else {
          // Two paired purple huge wormholes (off-screen centres)
          const bigR = (rng.next()*0.2 + rng.next()*0.2)*gh + 1.5*gh;
          const cx0 = rv(rng,3,0,-1,gw), cy0 = rv(rng,3,0,-1,gh);
          const w0 = new Planet({
            position: new Vec2(cx0, cy0), radius: bigR,
            density: 4000/(bigR*bigR), mass: 4000,
            type: PlanetType.WORMHOLE_PAIRED, colour: [255,55,255],
            shading: ShadingStyle.WORMHOLE,
            impactRadius: 50,
          });
          const w1 = new Planet({
            position: new Vec2(gw - cx0, gh - cy0), radius: bigR,
            density: 4000/(bigR*bigR), mass: 4000,
            type: PlanetType.WORMHOLE_PAIRED, colour: [255,55,255],
            shading: ShadingStyle.WORMHOLE,
            impactRadius: 50,
          });
          w0.partner = w1; w1.partner = w0;
          planets.push(w0, w1);
          for (let i = 2; i < nPlanets; i++)
            planets.push(makePlanet(rng, 1,0,0, 20,20,9, gw,gh, 0.07, PlanetType.ROCKY, ASTEROID_COL, ShadingStyle.ROCKY));
        }
        break;
      }

      // ── 19: White Hole ────────────────────────────────────────────────────
      case 19: {
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

      // ── 20: White Holes ───────────────────────────────────────────────────
      case 20: {
        for (let i = 0; i < nPlanets; i++) {
          const p = makePlanet(rng, 0.9,0,0.1, 3,3,4, gw,gh, -0.2, PlanetType.WHITE_HOLE, WHITE_COL, ShadingStyle.GLOWING);
          p.halo = 15.0;
          planets.push(p);
        }
        break;
      }

      // ── 21: Hyperspace ────────────────────────────────────────────────────
      case 21: {
        const useWormholeShading = rn[0] >= 0.8;
        for (let i = 0; i < nPlanets; i++) {
          const density  = rng.next() < 0.5 ?  6 * rng.next() : -5 * rng.next();
          const positive = density >= 0;
          const colour   = positive
            ? [Math.floor(255 - 40*density), 255, 0]
            : [255, Math.min(255, Math.floor(255 + 50*density)), 0];
          const type    = rng.next() < 0.8 ? PlanetType.BLACK_HOLE : PlanetType.WORMHOLE_PLANET;
          const shading = useWormholeShading ? ShadingStyle.WORMHOLE : ShadingStyle.GLOWING;
          planets.push(makePlanet(rng, 0.9,0,0.1, 0,0,5, gw,gh, density, type, colour, shading));
        }
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

    // No planet-planet overlap
    for (let i = 0; i < planets.length; i++) {
      for (let j = i + 1; j < planets.length; j++) {
        const pi = planets[i], pj = planets[j];
        const dist = pi.position.distanceTo(pj.position);
        if (dist < minGap + pi.radius + pj.radius) return false;
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
          if (p.position.distanceSqTo(new Vec2(px, py)) < p.radius * p.radius) {
            free = false;
            break;
          }
        }
        if (free) freeCount++;
      }
    }
    return freeCount >= 80;
  }

  // ─── bonus random feature injection ─────────────────────────────────────

  static _addBonus(planets, rng, ra, rb, gw, gh) {
    if (planets.length < 2) return;
    const idx = Math.floor(ra * (planets.length - 1)) + 1;

    if (rb < 0.25 && planets.length > 2) {
      // Wormhole pair
      const w0 = makeWormhole(rng, gw,gh, [255,55,255], PlanetType.WORMHOLE_PAIRED);
      const w1 = makeWormhole(rng, gw,gh, [255,55,255], PlanetType.WORMHOLE_PAIRED);
      w0.partner = w1; w1.partner = w0;
      planets.push(w0, w1);
    } else if (rb < 0.5 && planets.length > 3) {
      // Wormhole triple
      const wc = [0,1,2].map(() => makeWormhole(rng, gw,gh, [55,55,255], PlanetType.WORMHOLE_CYCLIC));
      wc[0].partner = wc[1]; wc[1].partner = wc[2]; wc[2].partner = wc[0];
      planets.push(...wc);
    } else if (rb < 0.6) {
      // Random wormhole
      planets.push(makeWormhole(rng, gw,gh, [55,255,55], PlanetType.WORMHOLE_RANDOM));
    } else if (rb < 0.90) {
      // White dwarf
      const bigR = rng.nextInRange(3, 6) + 4;
      planets.push(new Planet({
        position: new Vec2(rv(rng,0.4,0.4,0.1,gw), rv(rng,0.4,0.4,0.1,gh)),
        radius: bigR, density: 3,
        type: PlanetType.WHITE_DWARF, colour: WHITE_COL, shading: ShadingStyle.GLOWING,
      }));
    } else {
      // Black hole
      planets.push(new Planet({
        position: new Vec2(rv(rng,0.4,0.4,0.1,gw), rv(rng,0.4,0.4,0.1,gh)),
        radius: 3, density: 50,
        type: PlanetType.BLACK_HOLE, colour: BLACK_COL, shading: ShadingStyle.NONE,
      }));
    }
  }
}
