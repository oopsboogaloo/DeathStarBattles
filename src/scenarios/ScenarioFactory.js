import { Vec2 }                                                      from '../core/Vec2.js';
import { Planet, PlanetType, ShadingStyle, GAS_GIANT_COLOUR_PAIRS } from '../entities/Planet.js';
import { weightedRandomId }                                from './scenarioData.js';
import { SpaceRift, RIFT_SEGMENT_LENGTH }                  from '../entities/SpaceRift.js';

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

const ROCKY_COLS = [
  [150, 120,  80],  // warm brown
  [180, 160, 140],  // dusty tan
  [140, 160, 130],  // sage green
  [160, 150, 180],  // lavender grey
  [180, 170, 140],  // sandy beige
  [140, 165, 170],  // dusty teal
  [175, 145, 145],  // muted terracotta
  [155, 170, 190],  // steel blue
];
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

// Returns [x, y] biased toward one screen edge — picks a side then roams freely along it.
function sideEdgePos(rng, gw, gh) {
  const side = rng.nextInt(4);
  const near = 0.05 + rng.next() * 0.15; // 5–20% from the chosen edge
  const free = 0.15 + rng.next() * 0.70; // 15–85% along the side
  if (side === 0) return [near * gw,         free * gh       ]; // left
  if (side === 1) return [(1 - near) * gw,   free * gh       ]; // right
  if (side === 2) return [free * gw,          near * gh      ]; // top
  return               [free * gw,          (1 - near) * gh ]; // bottom
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

// Giant asteroid: diameter ≈ half the shorter screen dimension; 3 hits to shatter
function makeGiantAsteroid(rng, gw, gh, richProb) {
  const radius = Math.floor(Math.min(gw, gh) / 4); // radius = ¼ of shorter dimension
  const cx     = radius + rng.next() * (gw - 2 * radius);
  const cy     = radius + rng.next() * (gh - 2 * radius);
  // 24–30 vertices with free radius variation — the high count creates natural
  // complexity without needing an explicit pattern.
  const n = 24 + Math.floor(rng.next() * 7);
  const vertices = [];
  for (let i = 0; i < n; i++) {
    const baseAngle = (2 * Math.PI * i) / n;
    const jitter    = (rng.next() - 0.5) * (Math.PI / n) * 1.0;
    const angle     = baseAngle + jitter;
    const vr        = 0.30 + rng.next() * 0.70;
    vertices.push(new Vec2(vr * Math.cos(angle), vr * Math.sin(angle)));
  }
  const rotation      = rng.next() * Math.PI * 2;
  const rotationSpeed = (0.02 + rng.next() * 0.08) * Math.PI / 180; // very slow rotation
  const isRich        = richProb > 0 && rng.next() < richProb;
  const planet = new Planet({
    position: new Vec2(cx, cy),
    radius,
    density:       0.04,
    type:          PlanetType.GIANT_ASTEROID,
    colour:        isRich ? [...RICH_ASTEROID_COL] : [...ASTEROID_COL],
    shading:       ShadingStyle.ROCKY,
    vertices,
    rotation,
    rotationSpeed,
    rich:          isRich,
    hitCount:      0,
  });
  // Pre-compute rotated verts so the renderer has them from frame 0
  const cos = Math.cos(rotation), sin = Math.sin(rotation);
  const px = planet.position.x, py = planet.position.y, r = planet.radius;
  planet._rotatedVerts = vertices.map(v => new Vec2(
    px + r * (v.x * cos - v.y * sin),
    py + r * (v.x * sin + v.y * cos),
  ));
  return planet;
}

// Moon body radius: 12–20 game units; generates 3–6 crater positions
function makeMoon(rng, A, B, C, gw, gh) {
  const radius = 12 + rng.next() * 8; // 12–20
  const cx     = rv(rng, A, B, C, gw);
  const cy     = rv(rng, A, B, C, gh);
  const nCraters = 3 + Math.floor(rng.next() * 4); // 3–6
  const craterData = [];
  for (let i = 0; i < nCraters; i++) {
    const angle = rng.next() * Math.PI * 2;
    const dist  = rng.next() * radius * 0.7;
    const cr    = 2 + rng.next() * (radius * 0.22); // crater radius 2 – ~22% of moon radius
    craterData.push({ dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, cr });
  }
  return new Planet({
    position:   new Vec2(cx, cy),
    radius,
    density:    0.04,
    type:       PlanetType.MOON,
    colour:     [200, 207, 228],
    shading:    ShadingStyle.ROCKY,
    craterData,
    hitCount:   0,
    crackLines: [],
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
    pulsarPeriod: 0.1 + rng.next() * 0.9, // 0.1–1.0 seconds
    pulsarPhase:  rng.next() * 4.5,       // random initial phase so they desync
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
  static create(scenarioId, gw, gh, nPlanets, rng, wildcardFrequency = 'rare', performance = 'full', collectables = 'off', richAsteroids = 'normal', forceExtreme = false) {
    const richProb = collectables === 'off' ? 0 : (
      { off: 0, rare: 0.01, normal: 0.05, common: 0.10, abundant: 0.25, overwhelming: 1.0 }[richAsteroids] ?? 0.05
    );
    // Pre-roll sub-choice values (outside retry loop, matches Java's rnumber1-7)
    const rn = rng.roll(7); // rn[0]..rn[6]

    nPlanets = ScenarioFactory._cap(scenarioId, nPlanets);

    let planets   = [];
    let isExtreme = false;
    let attempts  = 0;

    do {
      ({ planets, isExtreme } = ScenarioFactory._generate(scenarioId, gw, gh, nPlanets, rng, rn, performance, richProb, forceExtreme));
      attempts++;
      if (attempts > 1000) { nPlanets = Math.max(0, nPlanets - 1); attempts = 0; }
    } while (nPlanets > 0 && !ScenarioFactory._validate(planets, gw, gh));

    // Scenario-specific rifts (generated after planets are placed)
    const rifts = [];
    if (scenarioId === 26) { // Hyperspace: 2–4 rifts per SR-06
      const nRifts = rng.nextInt(3) + 2;
      for (let i = 0; i < nRifts; i++) rifts.push(ScenarioFactory.generateRift(gw, gh, rng, planets));
    } else if (scenarioId === 29) { // Rift: 1 rift, 1–3× segment length, 5–20 segments
      rifts.push(ScenarioFactory.generateRift(gw, gh, rng, planets, 1 + rng.next() * 2, 5 + rng.nextInt(16)));
    } else if (scenarioId === 30) { // Rifts: 2–6 rifts
      const nRifts = rng.nextInt(5) + 2;
      for (let i = 0; i < nRifts; i++) rifts.push(ScenarioFactory.generateRift(gw, gh, rng, planets));
    } else if (scenarioId === 34) { // Wormhole Tunnel: oval boundary rift + 0–1 interior rifts
      rifts.push(ScenarioFactory._generateWormholeBoundary(rng, gw, gh));
      if (rng.next() < 0.4) rifts.push(ScenarioFactory.generateRift(gw, gh, rng, planets));
    }

    // Wildcard bonus injection — frequency controlled by wildcardFrequency setting
    // 10% chance wildcard becomes a rift (SR-07) instead of a planet bonus
    const WILDCARD_THRESHOLDS = {
      off: 0, veryRare: 0.03, rare: 0.1, occasional: 0.25, common: 0.55, always: 2,
    };
    const threshold = WILDCARD_THRESHOLDS[wildcardFrequency] ?? 0.1;
    const prePlanetCount = planets.length;
    const preRiftCount   = rifts.length;
    const collectablesOn = collectables !== 'off';
    const wcCollectablePositions = [];
    if (threshold > 0 && rn[1] < threshold) {
      const noGrey = scenarioId === 26;
      if (rn[2] < 0.10) {
        rifts.push(ScenarioFactory.generateRift(gw, gh, rng, planets));
      } else {
        ScenarioFactory._addBonus(planets, rng, rn[2], rn[3], gw, gh, performance, noGrey, collectablesOn, wcCollectablePositions);
      }
      if (rn[4] < 0.35) {
        if (rn[5] < 0.10) {
          rifts.push(ScenarioFactory.generateRift(gw, gh, rng, planets));
        } else {
          ScenarioFactory._addBonus(planets, rng, rn[5], rn[6], gw, gh, performance, noGrey, collectablesOn, wcCollectablePositions);
        }
      }
    }

    // Wormhole Tunnel: discard any wildcard collectables that landed outside the boundary rift
    if (scenarioId === 34 && wcCollectablePositions.length) {
      const br = rifts.find(r => r.isBoundary);
      if (br) {
        const inside = pos => {
          const verts = br.vertices, n = verts.length;
          let hit = false;
          for (let i = 0, j = n - 1; i < n; j = i++) {
            const xi = verts[i].x, yi = verts[i].y, xj = verts[j].x, yj = verts[j].y;
            if (((yi > pos.y) !== (yj > pos.y)) &&
                (pos.x < (xj - xi) * (pos.y - yi) / (yj - yi) + xi)) hit = !hit;
          }
          return hit;
        };
        const kept = wcCollectablePositions.filter(inside);
        wcCollectablePositions.length = 0;
        wcCollectablePositions.push(...kept);
      }
    }

    // Build a human-readable wildcard summary for dev display
    const wcPlanets = planets.slice(prePlanetCount);
    const wcRifts   = rifts.length - preRiftCount;
    let wildcardDesc = null;
    if (wcPlanets.length || wcRifts || wcCollectablePositions.length) {
      const fmt = t => t.replace(/([A-Z])/g, ' $1').replace(/^[a-z]/, c => c.toUpperCase());
      const counts = {};
      for (const p of wcPlanets) counts[p.type] = (counts[p.type] ?? 0) + 1;
      const parts = Object.entries(counts).map(([t, n]) => n > 1 ? `${fmt(t)} ×${n}` : fmt(t));
      if (wcRifts) parts.push(wcRifts > 1 ? `Rift ×${wcRifts}` : 'Rift');
      if (wcCollectablePositions.length) parts.push(`Collectable ×${wcCollectablePositions.length}`);
      wildcardDesc = parts.join(' + ');
    }

    return { planets, rifts, isExtreme, wildcardDesc, wildcardCollectablePositions: wcCollectablePositions };
  }

  static randomId(rng) { return weightedRandomId(rng); }

  // ─── station placement ───────────────────────────────────────────────────
  // Called after planets are confirmed. Sets position on each Station object.

  static placeStations(teams, planets, gw, gh, stationSize, rng, teamClustering = 'off', rifts = []) {
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

    // Wormhole Tunnel: eject any station that ended up outside the boundary rift polygon
    const boundaryRift = rifts.find(r => r.isBoundary);
    if (boundaryRift) {
      const verts = boundaryRift.vertices;
      const n = verts.length;
      const gcx = gw / 2, gcy = gh / 2;
      for (const s of all) {
        // Point-in-polygon (ray casting)
        let inside = false;
        for (let i = 0, j = n - 1; i < n; j = i++) {
          const xi = verts[i].x, yi = verts[i].y, xj = verts[j].x, yj = verts[j].y;
          if (((yi > s.position.y) !== (yj > s.position.y)) &&
              (s.position.x < (xj - xi) * (s.position.y - yi) / (yj - yi) + xi))
            inside = !inside;
        }
        if (!inside) {
          // Find nearest point on rift polyline then push inward
          let bestDist = Infinity, nearX = 0, nearY = 0;
          for (let i = 0; i < n - 1; i++) {
            const ax = verts[i].x, ay = verts[i].y, bx = verts[i+1].x, by = verts[i+1].y;
            const dx = bx - ax, dy = by - ay, lenSq = dx*dx + dy*dy;
            if (lenSq < 1e-10) continue;
            const t  = Math.max(0, Math.min(1, ((s.position.x-ax)*dx + (s.position.y-ay)*dy) / lenSq));
            const cx = ax + t*dx, cy = ay + t*dy;
            const d  = Math.hypot(s.position.x-cx, s.position.y-cy);
            if (d < bestDist) { bestDist = d; nearX = cx; nearY = cy; }
          }
          const inX = gcx - nearX, inY = gcy - nearY;
          const inLen = Math.hypot(inX, inY);
          const push  = 15 + sr;
          s.position = new Vec2(nearX + (inX / inLen) * push, nearY + (inY / inLen) * push);
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
    const caps = { 1:10, 6:14, 7:12, 8:13, 10:8, 18:12, 34:6 };
    return caps[id] !== undefined ? Math.min(n, caps[id]) : n;
  }

  // ─── planet placement ──────────────────────────────────────────────────────

  static _generate(id, gw, gh, nPlanets, rng, rn, performance = 'full', richProb = 0, forceExtreme = false) {
    const simplified = performance === 'simplified';
    const planets = [];
    let isExtreme = false;

    switch (id) {

      // ── 1: Planetary ──────────────────────────────────────────────────────
      case 1: {
        for (let i = 0; i < nPlanets; i++)
          planets.push(makePlanet(rng, 0.4,0.4,0.1, 20,20,7, gw,gh, 0.03, PlanetType.ROCKY, ROCKY_COLS[rng.nextInt(ROCKY_COLS.length)], ShadingStyle.ROCKY));
        const extreme1 = forceExtreme || rng.next() < 0.10;
        if (extreme1) {
          isExtreme = true;
          const nExtra = 1 + rng.nextInt(10);
          for (let i = 0; i < nExtra; i++) {
            const [ex, ey] = sideEdgePos(rng, gw, gh);
            planets.push(new Planet({
              position: new Vec2(ex, ey),
              radius: 7 + rng.next() * 13, density: 0.03,
              type: PlanetType.ROCKY, colour: ROCKY_COLS[rng.nextInt(ROCKY_COLS.length)], shading: ShadingStyle.ROCKY,
            }));
          }
        }
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
        // Remaining body slots: 50% gas giants, 50% rocky planets, each with 0–3 moons
        for (let i = 1; i < nPlanets; i++) {
          const body = rng.next() < 0.5
            ? makeGasGiant(rng, 1,0,0, 30,15,12, gw,gh, 0.025)
            : makePlanet(rng, 1,0,0, 20,5,4, gw,gh, 0.08, PlanetType.ROCKY, ROCKY_COLS[rng.nextInt(ROCKY_COLS.length)], ShadingStyle.ROCKY);
          planets.push(body);
          const nMoons = rng.nextInt(4); // 0–3
          for (let m = 0; m < nMoons; m++) {
            const angle   = rng.next() * Math.PI * 2;
            const dist    = body.radius + 14 + rng.next() * 30;
            const mx      = Math.max(8, Math.min(gw - 8, body.position.x + Math.cos(angle) * dist));
            const my      = Math.max(8, Math.min(gh - 8, body.position.y + Math.sin(angle) * dist));
            const mRadius = 10 + rng.next() * 7;
            const nCraters = 3 + rng.nextInt(4);
            const craterData = [];
            for (let c = 0; c < nCraters; c++) {
              const ca = rng.next() * Math.PI * 2;
              const cd = rng.next() * mRadius * 0.7;
              const cr = 2 + rng.next() * (mRadius * 0.22);
              craterData.push({ dx: Math.cos(ca) * cd, dy: Math.sin(ca) * cd, cr });
            }
            planets.push(new Planet({
              position: new Vec2(mx, my), radius: mRadius, density: 0.04,
              type: PlanetType.MOON, colour: [200, 207, 228], shading: ShadingStyle.ROCKY,
              craterData, hitCount: 0, crackLines: [],
            }));
          }
        }
        // Scatter 0–8 asteroids across the field
        const nAst = rng.nextInt(9);
        for (let i = 0; i < nAst; i++)
          planets.push(makeAsteroid(rng, 1,0,0, 20,5,4, gw,gh, 0.1, richProb));
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

      // ── 35: Binary Wormhole ───────────────────────────────────────────────
      case 35: {
        // Binary Star layout with the two stars swapped for a paired wormhole.
        // Extreme: a third star-sized wormhole joins and the link becomes a
        // cyclic triple A→B→C→A (blue, per the cyclic colour convention).
        // Rolled from rn[0] so the choice survives _validate retries — three
        // big discs fail placement more often, which would bias a live roll.
        const extreme35 = forceExtreme || rn[0] < 0.10;
        if (extreme35) isExtreme = true;
        const whs = [];
        if (extreme35) {
          // Three discs can't rely on the outer _validate loop for spacing —
          // its give-up path (nPlanets decremented to 0) can return overlapping
          // layouts. Enforce pairwise separation here instead: slightly smaller
          // discs (100–160) spread across 0.1–0.9, shrinking 10% per failed
          // round so cramped fields always terminate without overlap.
          const minGap = 10;
          let radii = Array.from({ length: 3 }, () => rng.nextInRange(60, 120) + 40);
          let centres = null;
          while (!centres) {
            for (let attempt = 0; attempt < 200 && !centres; attempt++) {
              const c = radii.map(() => new Vec2(rv(rng,0.4,0.4,0.1,gw), rv(rng,0.4,0.4,0.1,gh)));
              let ok = true;
              for (let i = 0; i < 3 && ok; i++)
                for (let j = i + 1; j < 3 && ok; j++)
                  if (c[i].distanceTo(c[j]) < radii[i] + radii[j] + minGap) ok = false;
              if (ok) centres = c;
            }
            if (!centres) radii = radii.map(r => r * 0.9);
          }
          for (let s = 0; s < 3; s++) {
            whs.push(new Planet({
              position: centres[s], radius: radii[s], density: 0.01,
              type: PlanetType.WORMHOLE_CYCLIC, colour: [55,55,255],
              shading: ShadingStyle.WORMHOLE,
            }));
          }
        } else {
          for (let s = 0; s < 2; s++) {
            const bigR = rng.nextInRange(80, 160) + 40;
            whs.push(new Planet({
              position: new Vec2(rv(rng,0.3,0.3,0.2,gw), rv(rng,0.3,0.3,0.2,gh)),
              radius: bigR, density: 0.01,
              type: PlanetType.WORMHOLE_PAIRED, colour: [255,55,255],
              shading: ShadingStyle.WORMHOLE,
            }));
          }
        }
        const nWh = whs.length;
        for (let i = 0; i < nWh; i++) whs[i].partner = whs[(i + 1) % nWh];
        planets.push(...whs);
        for (let i = nWh; i < nPlanets; i++)
          planets.push(makeAsteroid(rng, 1,0,0, 20,5,4, gw,gh, 0.08, richProb));
        break;
      }

      // ── 36: Giant Self Wormhole ───────────────────────────────────────────
      case 36: {
        // Red Giant layout with the star swapped for a yellow self wormhole.
        const gsR = rng.nextInRange(80, 160) + 140;
        planets.push(new Planet({
          position: new Vec2(rv(rng,0.1,0.1,0.4,gw), rv(rng,0.1,0.1,0.4,gh)),
          radius: gsR, density: 0.015,
          type: PlanetType.WORMHOLE_SELF, colour: [255,255,55],
          shading: ShadingStyle.WORMHOLE,
        }));
        for (let i = 1; i < nPlanets; i++)
          planets.push(makeAsteroid(rng, 1,0,0, 20,5,4, gw,gh, 0.065, richProb));
        break;
      }

      // ── 37: Giant Wormhole Network ────────────────────────────────────────
      case 37: {
        // Star Cluster layout with every star swapped for a red network
        // wormhole — shots exit via a random other wormhole on the map.
        // Extreme: the network is replaced by a random mix of yellow self
        // wormholes, purple linked pairs and blue cyclic triples. Rolled from
        // rn[0] so the choice survives _validate retries (matches case 35).
        const extreme37 = forceExtreme || rn[0] < 0.10;
        if (extreme37) isExtreme = true;
        // Discs are placed here with pairwise separation enforced — _validate
        // skips pairs whose centres are both off-screen (cluster bodies roam
        // ±10% past the edges) and its give-up path can return overlapping
        // layouts. A disc that won't fit after 150 attempts is dropped, and an
        // area budget (55% of the screen) trims very high body counts, so
        // crowded requests lose a few wormholes instead of overlapping.
        const minGap = 10;
        const areaBudget = 0.55 * gw * gh;
        let usedArea = 0;
        const placed = []; // {x, y, r}
        for (let i = 0; i < nPlanets; i++) {
          const r = rr(rng, 70, 70, 30);
          if (usedArea + Math.PI * r * r > areaBudget) break;
          for (let attempt = 0; attempt < 150; attempt++) {
            const x = rv(rng, 1.2, 0, -0.1, gw), y = rv(rng, 1.2, 0, -0.1, gh);
            if (placed.every(p => Math.hypot(p.x - x, p.y - y) >= p.r + r + minGap)) {
              placed.push({ x, y, r });
              usedArea += Math.PI * r * r;
              break;
            }
          }
        }
        const mkWh = (p, type, colour) => new Planet({
          position: new Vec2(p.x, p.y), radius: p.r, density: 0.015,
          type, colour, shading: ShadingStyle.WORMHOLE,
        });
        if (!extreme37) {
          for (const p of placed)
            planets.push(mkWh(p, PlanetType.WORMHOLE_NETWORK, [255,55,55]));
          break;
        }
        let idx = 0;
        while (idx < placed.length) {
          const size = 1 + rng.nextInt(Math.min(3, placed.length - idx)); // group of 1–3
          if (size === 1) {
            planets.push(mkWh(placed[idx], PlanetType.WORMHOLE_SELF, [255,255,55]));
          } else if (size === 2) {
            const wa = mkWh(placed[idx],     PlanetType.WORMHOLE_PAIRED, [255,55,255]);
            const wb = mkWh(placed[idx + 1], PlanetType.WORMHOLE_PAIRED, [255,55,255]);
            wa.partner = wb; wb.partner = wa;
            planets.push(wa, wb);
          } else {
            const wc = [0,1,2].map(k => mkWh(placed[idx + k], PlanetType.WORMHOLE_CYCLIC, [55,55,255]));
            wc[0].partner = wc[1]; wc[1].partner = wc[2]; wc[2].partner = wc[0];
            planets.push(...wc);
          }
          idx += size;
        }
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
        for (let i = 1; i < nPlanets; i++) {
          if (rng.next() < 0.5)
            planets.push(makeAsteroid(rng, 1,0,0, 20,5,3, gw,gh, 0.05, richProb));
          else
            planets.push(makeMoon(rng, 1,0,0, gw,gh));
        }
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
        // Same free placement as before, but resample the pair until the
        // layout is sound: the discs never overlap (on- or off-screen), each
        // giant peeks onto the screen, and ≥20% of the screen stays free.
        // Angle, side and balance between the giants stay unconstrained.
        // _validate can't enforce any of this — it skips planet pairs whose
        // centres are both off-screen, which these giants almost always are.
        const minVis = 0.06 * gh; // how far each disc must reach on-screen
        const minGap = 10;        // same planet-planet gap as _validate
        const distToScreen = g => Math.hypot(
          Math.max(-g.x, 0, g.x - gw),
          Math.max(-g.y, 0, g.y - gh),
        );
        const screenFree = (a, b) => {
          let free = 0;
          for (let i = 0; i < 20; i++)
            for (let j = 0; j < 20; j++) {
              const px = (i / 20) * gw, py = (j / 20) * gh;
              if (Math.hypot(px - a.x, py - a.y) >= a.r &&
                  Math.hypot(px - b.x, py - b.y) >= b.r) free++;
            }
          return free >= 80; // ≥20% of the 20×20 grid, matching _validate
        };
        // Sample each centre anywhere the disc can sit while still peeking
        // on-screen. (The old fixed rv(3,0,-1) box was shorter than the sum
        // of two star radii, so vertical layouts could never separate.)
        const newGiant = () => {
          const r    = (rng.next()*0.2 + rng.next()*0.2) * gh + 1.5*gh;
          const span = r - minVis;
          return {
            r,
            x: -span + rng.next() * (gw + 2 * span),
            y: -span + rng.next() * (gh + 2 * span),
          };
        };
        let a = newGiant(), b = newGiant(), ok = false;
        for (let attempt = 0; attempt < 500 && !ok; attempt++) {
          ok = Math.hypot(a.x - b.x, a.y - b.y) >= a.r + b.r + minGap
            && distToScreen(a) <= a.r - minVis
            && distToScreen(b) <= b.r - minVis
            && screenFree(a, b);
          if (!ok) { a = newGiant(); b = newGiant(); }
        }
        // Constructive fallback for screens too narrow for free sampling to
        // ever separate two discs this big: put the giants on opposite sides
        // of the screen centre along a random axis, each just reaching in.
        if (!ok) {
          for (let attempt = 0; attempt < 50; attempt++) {
            const th = rng.next() * Math.PI * 2;
            const ux = Math.cos(th), uy = Math.sin(th);
            const e  = Math.min(gw / 2 / Math.max(Math.abs(ux), 1e-6),
                                gh / 2 / Math.max(Math.abs(uy), 1e-6));
            const pen = () => minVis + rng.next() * Math.max(0, e - minGap / 2 - minVis);
            a = newGiant(); b = newGiant();
            const da = e + a.r - pen(), db = e + b.r - pen();
            a.x = gw / 2 + ux * da; a.y = gh / 2 + uy * da;
            b.x = gw / 2 - ux * db; b.y = gh / 2 - uy * db;
            if (screenFree(a, b)) break;
          }
        }
        for (const g of [a, b]) {
          const sCol = [Math.floor(rng.next()*10)+245, Math.floor(rng.next()*245), Math.floor(rng.next()*45)];
          planets.push(new Planet({
            position: new Vec2(g.x, g.y),
            radius: g.r, density: 4000/(g.r*g.r), mass: 4000,
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
        for (let i = 0; i < nPlanets; i++) {
          const roll = i === 0 ? 1 : rng.next();
          if (roll < 0.20)
            planets.push(makeGasGiant(rng, 1,0,0, 35,20,15, gw,gh, 0.02));
          else if (roll < 0.40)
            planets.push(makePlanet(rng, 1,0,0, 28,15,10, gw,gh, 0.03, PlanetType.ROCKY, ROCKY_COLS[rng.nextInt(ROCKY_COLS.length)], ShadingStyle.ROCKY));
          else if (roll < 0.60)
            planets.push(makeMoon(rng, 1,0,0, gw,gh));
          else if (roll < 0.80)
            planets.push(makeCrystalAsteroid(rng, 1,0,0, 20,5,3, gw,gh, 0.05));
          else {
            const col = [Math.floor(rng.next()*30)+215, Math.floor(rng.next()*30)+205, Math.floor(rng.next()*190)+15];
            planets.push(makePlanet(rng, 1.2,0,-0.1, 70,70,30, gw,gh, 0.015, PlanetType.STAR, col, ShadingStyle.GLOWING));
          }
        }
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
          halo:         15.0,
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
            planets.push(makePlanet(rng, 1,0,0, 20,20,3, gw,gh, 0.03, PlanetType.ROCKY, ROCKY_COLS[rng.nextInt(ROCKY_COLS.length)], ShadingStyle.ROCKY));
        } else if (wType < 0.9 && nPlanets > 2) {
          // Blue cyclic A→B→C→A
          const wc = [0,1,2].map(() => makeWormhole(rng, gw,gh, [55,55,255], PlanetType.WORMHOLE_CYCLIC));
          wc[0].partner = wc[1]; wc[1].partner = wc[2]; wc[2].partner = wc[0];
          planets.push(...wc);
          for (let i = 3; i < nPlanets; i++)
            planets.push(makePlanet(rng, 1,0,0, 20,20,3, gw,gh, 0.03, PlanetType.ROCKY, ROCKY_COLS[rng.nextInt(ROCKY_COLS.length)], ShadingStyle.ROCKY));
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
        for (let i = 0; i < nPlanets; i++) {
          const p = makePlanet(rng, 0.9,0,0.1, 3,3,4, gw,gh, 3, PlanetType.WHITE_DWARF, WHITE_COL, ShadingStyle.GLOWING);
          p.halo = 15.0;
          planets.push(p);
        }
        break;
      }

      // ── 22: Black Hole ────────────────────────────────────────────────────
      case 22: {
        const bhBigR = rng.nextInRange(80, 160) + 140;
        const bhDispR = 3; // game units (tiny)
        planets.push(new Planet({
          position:    new Vec2(rv(rng,0.1,0.1,0.4,gw), rv(rng,0.1,0.1,0.4,gh)),
          radius:      bhDispR,
          density:     0.012,
          mass:        bhBigR * bhBigR * 0.012,
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
        const extreme27 = forceExtreme || rng.next() < 0.10;
        if (extreme27) isExtreme = true;
        const nBH      = extreme27 ? rng.nextInt(16) : 2 + rng.nextInt(4); // extreme: 0–15, normal: 2–5
        const bh27Mid  = (nBH > 0 && rng.next() < 0.5) ? rng.nextInt(nBH) : -1;
        for (let i = 0; i < nBH; i++) {
          const bhBigR = rng.nextInRange(80, 160) + 140;
          const [px, py] = i === bh27Mid
            ? [(0.3 + rng.next() * 0.4) * gw, (0.3 + rng.next() * 0.4) * gh]
            : sideEdgePos(rng, gw, gh);
          planets.push(new Planet({
            position: new Vec2(px, py),
            radius: 3, density: 50, mass: bhBigR * bhBigR * 0.014,
            type: PlanetType.BLACK_HOLE, colour: BLACK_COL, shading: ShadingStyle.NONE,
          }));
        }
        if (!extreme27) {
          for (let i = nBH; i < nPlanets; i++) {
            if (i % 3 === 1)
              planets.push(makeAsteroid(rng, 1, 0, 0, 20, 5, 4, gw, gh, 0.065, richProb));
            else
              planets.push(makePlanet(rng, 1, 0, 0, 5, 5, 3, gw, gh, 0.5, PlanetType.ROCKY, DULL_COL, ShadingStyle.ROCKY));
          }
        }
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
          const ir = 480;  // capture / visual ring radius (6× the original 80)

          // The pair must stay point-symmetric through the screen centre so a
          // bullet shot into one ring exits the other on-screen. Within that,
          // the first centre is sampled freely and rejected until the layout
          // is sound — any orientation and separation can occur (§6.2):
          //  • both rings peek on-screen (mirroring preserves this for w1)
          //  • rings never overlap — needs dist(c0, screen centre) ≥ ir
          //  • ≥20% of the screen stays outside both rings
          const minVis = 0.06 * gh; // each ring must reach this far on-screen
          const minGap = 10;
          const span   = ir - minVis;
          let cx0 = 0, cy0 = 0, ok = false;
          for (let attempt = 0; attempt < 500 && !ok; attempt++) {
            cx0 = -span + rng.next() * (gw + 2 * span);
            cy0 = -span + rng.next() * (gh + 2 * span);
            ok = Math.hypot(cx0 - gw / 2, cy0 - gh / 2) >= ir + minGap / 2
              && Math.hypot(Math.max(-cx0, 0, cx0 - gw), Math.max(-cy0, 0, cy0 - gh)) <= span;
            if (ok) {
              let free = 0;
              for (let i = 0; i < 20; i++)
                for (let j = 0; j < 20; j++) {
                  const px = (i / 20) * gw, py = (j / 20) * gh;
                  if (Math.hypot(px - cx0, py - cy0) >= ir &&
                      Math.hypot(px - (gw - cx0), py - (gh - cy0)) >= ir) free++;
                }
              ok = free >= 80; // ≥20% of the 20×20 grid, matching _validate
            }
          }
          // Constructive fallback: a corner placement at depth D can never
          // overlap its mirror at any aspect ratio.
          if (!ok) {
            const D = ir * (0.30 + rng.next() * 0.32);
            cx0 = rng.next() < 0.5 ? -D : gw + D;
            cy0 = rng.next() < 0.5 ? -D : gh + D;
          }

          const bigR = (rng.next()*0.2 + rng.next()*0.2)*gh + 1.5*gh;
          const w0 = new Planet({
            position: new Vec2(cx0, cy0), radius: bigR,
            density: 2400/(bigR*bigR), mass: 2400,
            type: PlanetType.WORMHOLE_PAIRED, colour: [255,55,255],
            shading: ShadingStyle.WORMHOLE,
            impactRadius: ir,
          });
          const w1 = new Planet({
            position: new Vec2(gw - cx0, gh - cy0), radius: bigR,
            density: 2400/(bigR*bigR), mass: 2400,
            type: PlanetType.WORMHOLE_PAIRED, colour: [255,55,255],
            shading: ShadingStyle.WORMHOLE,
            impactRadius: ir,
          });
          w0.partner = w1; w1.partner = w0;
          planets.push(w0, w1);
          const nRocky = 2 + Math.floor(rng.next() * 4);  // 2–5
          for (let i = 0; i < nRocky; i++)
            planets.push(makePlanet(rng, 1,0,0, 8,8,4, gw,gh, 0.07, PlanetType.ROCKY, ASTEROID_COL, ShadingStyle.ROCKY));
          const nAsteroids = Math.floor(rng.next() * 9);  // 0–8
          for (let i = 0; i < nAsteroids; i++)
            planets.push(makeAsteroid(rng, 1,0,0, 6,6,3, gw,gh, 0.07));
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
        const extreme25 = forceExtreme || rng.next() < 0.10;
        if (extreme25) isExtreme = true;
        const nWH     = extreme25 ? rng.nextInt(16) : 2 + rng.nextInt(4); // extreme: 0–15, normal: 2–5
        const wh25Mid = (nWH > 0 && rng.next() < 0.5) ? rng.nextInt(nWH) : -1;
        for (let i = 0; i < nWH; i++) {
          const [px, py] = i === wh25Mid
            ? [(0.3 + rng.next() * 0.4) * gw, (0.3 + rng.next() * 0.4) * gh]
            : sideEdgePos(rng, gw, gh);
          planets.push(new Planet({
            position: new Vec2(px, py),
            radius:   6, density: 0.02, mass: -20,
            type:     PlanetType.WHITE_HOLE, colour: WHITE_COL,
            shading:  ShadingStyle.GLOWING, halo: 15.0,
          }));
        }
        if (!extreme25) {
          for (let i = nWH; i < nPlanets; i++) {
            if (i % 3 === 1)
              planets.push(makeAsteroid(rng, 1, 0, 0, 20, 5, 4, gw, gh, 0.065, richProb));
            else
              planets.push(makePlanet(rng, 1, 0, 0, 5, 5, 3, gw, gh, 0.5, PlanetType.ROCKY, DULL_COL, ShadingStyle.ROCKY));
          }
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
          const type    = rng.next() < 0.8 ? PlanetType.BLACK_HOLE : PlanetType.WORMHOLE_NETWORK;
          const shading = useWormholeShading ? ShadingStyle.WORMHOLE : ShadingStyle.GLOWING;
          const p = makePlanet(rng, 0.9,0,0.1, 0,0,5, gw,gh, density, type, colour, shading);
          p.anomalyRepels = positive;
          planets.push(p);
        }
        break;
      }

      // ── 12: Gas Giants ────────────────────────────────────────────────────
      case 12: {
        for (let i = 0; i < nPlanets; i++)
          planets.push(makeGasGiant(rng, 0.4,0.4,0.1, 30,30,10, gw,gh, 0.03));
        break;
      }

      // ── 23: Pulsar (one pulsar + mix of rocky planets and asteroids) ──
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
          radius: sR, density: 0.03,
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
          halo: 15.0,
        });
        planets.push(wd);
        // Inner comets — mostly on-screen, tighter orbits
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
        // Outer Oort comets — wide orbits, some starting off-screen
        const numOuter = 3 + Math.floor(rng.next() * 4); // 3–6
        for (let i = 0; i < numOuter; i++) {
          const orbitR = 300 + rng.next() * 400; // 300–700 px
          const angle  = rng.next() * Math.PI * 2;
          const px = wd.position.x + Math.cos(angle) * orbitR;
          const py = wd.position.y + Math.sin(angle) * orbitR;
          // Only skip if absurdly far outside the play boundary
          if (px < -gw || px > 2 * gw || py < -gh || py > 2 * gh) continue;
          const vCirc    = Math.sqrt(G_REDUCED * wdMass / orbitR);
          const variance = 0.5 + rng.next() * 1.0; // 0.5–1.5× — more eccentric
          const vMag     = vCirc * variance;
          // Randomise orbit direction (CW or CCW)
          const dir       = rng.next() < 0.5 ? 1 : -1;
          const perpAngle = angle + dir * Math.PI / 2;
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

      // ── 29: Rift — sparse planets + asteroid field (rift injected in create()) ──
      case 29: {
        const nRocky = Math.min(3, Math.max(0, nPlanets - 2));
        const nAst   = Math.max(0, nPlanets - nRocky);
        for (let i = 0; i < nRocky; i++)
          planets.push(makePlanet(rng, 0.7,0.2,0.05, 20,15,8, gw,gh, 0.04, PlanetType.ROCKY, ROCKY_COLS[rng.nextInt(ROCKY_COLS.length)], ShadingStyle.ROCKY));
        for (let i = 0; i < nAst; i++)
          planets.push(makeAsteroid(rng, 1,0,0, 15,5,3, gw,gh, 0.05, richProb));
        break;
      }

      // ── 30: Rifts — moderate planet mix (rifts injected in create()) ──────────
      case 30: {
        for (let i = 0; i < nPlanets; i++)
          planets.push(makeAsteroid(rng, 1,0,0, 20,5,4, gw,gh, 0.05, richProb));
        break;
      }

      // ── 31: Moons — rocky body orbited by destructible moons ─────────────────
      case 31: {
        const extreme31 = forceExtreme || rng.next() < 0.10;
        if (extreme31) isExtreme = true;
        if (extreme31) {
          // Giant moon as the central body
          const bigMoonR = 35 + rng.next() * 20; // 35–55
          const nCraters = 5 + Math.floor(rng.next() * 4);
          const craterData = [];
          for (let i = 0; i < nCraters; i++) {
            const angle = rng.next() * Math.PI * 2;
            const dist  = rng.next() * bigMoonR * 0.7;
            const cr    = 3 + rng.next() * (bigMoonR * 0.18);
            craterData.push({ dx: Math.cos(angle) * dist, dy: Math.sin(angle) * dist, cr });
          }
          planets.push(new Planet({
            position:  new Vec2(rv(rng,0.3,0.3,0.2,gw), rv(rng,0.3,0.3,0.2,gh)),
            radius:    bigMoonR, density: 0.04,
            type:      PlanetType.MOON, colour: [200,207,228], shading: ShadingStyle.ROCKY,
            craterData, hitCount: 0,
          }));
          // All remaining slots are moons
          for (let i = 1; i < nPlanets; i++)
            planets.push(makeMoon(rng, 0.8, 0.1, 0.05, gw, gh));
        } else {
          // Central rocky planet (large, slightly off-centre)
          planets.push(makePlanet(rng, 0.3,0.3,0.2, 35,20,20, gw,gh, 0.05, PlanetType.ROCKY, ROCKY_COLS[rng.nextInt(ROCKY_COLS.length)], ShadingStyle.ROCKY));
          // 2–5 moons scattered around the field
          const nMoons = 2 + Math.floor(rng.next() * 4);
          for (let i = 0; i < nMoons; i++)
            planets.push(makeMoon(rng, 0.8, 0.1, 0.05, gw, gh));
          // Fill remaining slots with asteroids
          const remaining = Math.max(0, nPlanets - 1 - nMoons);
          for (let i = 0; i < remaining; i++)
            planets.push(makeAsteroid(rng, 1,0,0, 15,5,3, gw,gh, 0.05, richProb));
        }
        break;
      }

      // ── 32: Giant Asteroid ───────────────────────────────────────────────────
      case 32: {
        // One enormous asteroid (diameter ≈ half screen height) near the centre
        const giant = makeGiantAsteroid(rng, gw, gh, richProb);
        planets.push(giant);
        // Surround it with 10–30 smaller asteroids placed without overlap
        const nSmall  = simplified ? (10 + Math.floor(rng.next() * 11))  // 10-20
                                   : (10 + Math.floor(rng.next() * 21)); // 10-30
        const minGap  = 10;
        let   placed  = 0;
        for (let attempt = 0; placed < nSmall && attempt < nSmall * 20; attempt++) {
          const ast = makeAsteroid(rng, 1, 0, 0, 15, 5, 3, gw, gh, 0.04, richProb);
          if (planets.every(p => ast.position.distanceTo(p.position) >= ast.impactRadius + p.impactRadius + minGap)) {
            planets.push(ast);
            placed++;
          }
        }
        break;
      }

      // ── 33: Pulsars (2–5 pulsars biased to edges + rocky filler) ──
      case 33: {
        const extreme33 = forceExtreme || rng.next() < 0.10;
        if (extreme33) isExtreme = true;
        const nPulsars = extreme33 ? rng.nextInt(16) : 2 + rng.nextInt(4); // extreme: 0–15, normal: 2–5
        const pul33Mid = (nPulsars > 0 && rng.next() < 0.5) ? rng.nextInt(nPulsars) : -1;
        for (let i = 0; i < nPulsars; i++) {
          const bigR  = rng.nextInRange(80, 160) + 140.5;
          const dispR = rng.nextInRange(7, 10);
          const [px, py] = i === pul33Mid
            ? [(0.3 + rng.next() * 0.4) * gw, (0.3 + rng.next() * 0.4) * gh]
            : sideEdgePos(rng, gw, gh);
          planets.push(new Planet({
            position:     new Vec2(px, py),
            radius:       dispR, density: 0.014, mass: bigR * bigR * 0.014,
            type:         PlanetType.PULSAR, colour: [...WHITE_COL],
            shading:      ShadingStyle.GLOWING,
            pulsarPeriod: 0.1 + rng.next() * 0.9,
            pulsarPhase:  rng.next() * 4.5,
          }));
        }
        if (!extreme33) {
          for (let i = nPulsars; i < nPlanets; i++) {
            if (i % 3 === 1)
              planets.push(makeAsteroid(rng, 1, 0, 0, 20, 5, 4, gw, gh, 0.065, richProb));
            else
              planets.push(makePlanet(rng, 1, 0, 0, 5, 5, 3, gw, gh, 0.5, PlanetType.ROCKY, DULL_COL, ShadingStyle.ROCKY));
          }
        }
        break;
      }

      // ── 34: Wormhole Tunnel — 2–6 interior bodies inside an oval boundary rift ──
      case 34: {
        const bodyCount = 2 + rng.nextInt(5); // 2–6 interior bodies
        let placed = 0;
        while (placed < bodyCount) {
          const w = rng.nextInt(15);
          if (w < 3) {
            planets.push(makePlanet(rng, 0.5,0.2,0.15, 30,15,8, gw,gh, 0.04, PlanetType.ROCKY, ROCKY_COLS[rng.nextInt(ROCKY_COLS.length)], ShadingStyle.ROCKY));
            placed++;
          } else if (w < 6) {
            planets.push(makeAsteroid(rng, 0.5,0.2,0.15, 15,5,3, gw,gh, 0.05, richProb));
            placed++;
          } else if (w < 8) {
            planets.push(makeGasGiant(rng, 0.5,0.2,0.15, 50,20,15, gw,gh, 0.01));
            placed++;
          } else if (w < 10 && bodyCount - placed >= 2) {
            const wc = [255, 55, 255];
            const wp = makeWormhole(rng, gw, gh, wc, PlanetType.WORMHOLE_PAIRED);
            const wq = makeWormhole(rng, gw, gh, wc, PlanetType.WORMHOLE_PAIRED);
            wp.partner = wq; wq.partner = wp;
            planets.push(wp, wq);
            placed += 2;
          } else if (w < 11 && bodyCount - placed >= 3) {
            const wc = [55, 55, 255];
            const ws = [0, 1, 2].map(() => makeWormhole(rng, gw, gh, wc, PlanetType.WORMHOLE_CYCLIC));
            ws[0].partner = ws[1]; ws[1].partner = ws[2]; ws[2].partner = ws[0];
            planets.push(...ws);
            placed += 3;
          } else if (w < 12) {
            planets.push(new Planet({
              position: new Vec2(rv(rng, 0.5,0.2,0.15, gw), rv(rng, 0.5,0.2,0.15, gh)),
              radius: 8 + rng.next() * 6, density: 0.02, mass: -20,
              type: PlanetType.WHITE_HOLE, colour: [...WHITE_COL], shading: ShadingStyle.GLOWING, halo: 15.0,
            }));
            placed++;
          } else if (w < 14) {
            planets.push(makeMoon(rng, 0.5,0.2,0.15, gw, gh));
            placed++;
          } else {
            planets.push(makePlanet(rng, 0.5,0.2,0.15, 40,20,15, gw,gh, 0.015, PlanetType.STAR, starColour(rng), ShadingStyle.GLOWING));
            placed++;
          }
        }
        break;
      }

      default:
        // Fallback to Planetary
        for (let i = 0; i < nPlanets; i++)
          planets.push(makePlanet(rng, 0.4,0.4,0.1, 30,30,10, gw,gh, 0.03, PlanetType.ROCKY, ROCKY_COLS[rng.nextInt(ROCKY_COLS.length)], ShadingStyle.ROCKY));
    }

    return { planets, isExtreme };
  }

  // ─── validation ─────────────────────────────────────────────────────────

  static _validate(planets, gw, gh) {
    if (!planets.length) return true;
    const minGap = 10;

    // No planet-planet overlap — use impactRadius for gameplay-relevant size,
    // falling back to radius. This prevents huge-physics/small-capture planets
    // (e.g. big wormholes) from failing validation due to their physics radius.
    // Skip pairs where both planets are outside the screen — those are intentional
    // designs (e.g. screen-edge giant wormholes) that don't need gap enforcement.
    for (let i = 0; i < planets.length; i++) {
      for (let j = i + 1; j < planets.length; j++) {
        const pi = planets[i], pj = planets[j];
        const piOff = pi.position.x < 0 || pi.position.x > gw || pi.position.y < 0 || pi.position.y > gh;
        const pjOff = pj.position.x < 0 || pj.position.x > gw || pj.position.y < 0 || pj.position.y > gh;
        if (piOff && pjOff) continue;
        const ri = pi.impactRadius ?? pi.radius;
        const rj = pj.impactRadius ?? pj.radius;
        const dist = pi.position.distanceTo(pj.position);
        if (dist < minGap + ri + rj) return false;
      }
    }

    // ≥80 of 400 grid points free (≥20% of play area).
    // Off-screen planets are excluded — their in-screen coverage is intentional design.
    const inScreen = planets.filter(p =>
      p.position.x >= 0 && p.position.x <= gw && p.position.y >= 0 && p.position.y <= gh
    );
    let freeCount = 0;
    for (let i = 0; i < 20; i++) {
      for (let j = 0; j < 20; j++) {
        const px = (i / 20) * gw;
        const py = (j / 20) * gh;
        let free = true;
        for (const p of inScreen) {
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

  // ─── space rift generation (SR-02) ───────────────────────────────────────

  // Generate the oval boundary rift for the Wormhole Tunnel scenario (id 34).
  static _generateWormholeBoundary(rng, gw, gh) {
    const nVerts = 44 + rng.nextInt(17); // 44–60 vertices — dense enough to look smooth
    const cx = gw / 2, cy = gh / 2;
    const ra = gw * 0.43, rb = gh * 0.43; // semi-axes keep verts ≥7% from each edge
    const verts = [];

    for (let i = 0; i < nVerts; i++) {
      const angle = (2 * Math.PI * i) / nVerts;
      const disp  = 1 + (rng.next() - 0.5) * 0.20; // per-vertex radial ±10%
      verts.push(new Vec2(
        cx + ra * Math.cos(angle) * disp,
        cy + rb * Math.sin(angle) * disp,
      ));
    }

    // Group displacement: 2–4 clusters of 2–3 adjacent vertices shifted together
    const nGroups = 2 + rng.nextInt(3);
    for (let g = 0; g < nGroups; g++) {
      const start = rng.nextInt(nVerts);
      const len   = 2 + rng.nextInt(2);
      const gd    = (rng.next() - 0.5) * 0.12; // ±6% group shift
      for (let j = 0; j < len; j++) {
        const idx = (start + j) % nVerts;
        const v   = verts[idx];
        verts[idx] = new Vec2(cx + (v.x - cx) * (1 + gd), cy + (v.y - cy) * (1 + gd));
      }
    }

    // Close the loop exactly — last vertex sits on the first
    verts.push(new Vec2(verts[0].x, verts[0].y));

    // influenceRadius capped at 40: prevents the boundary nodes from blanketing the whole map
    return new SpaceRift({ vertices: verts, strengthMultiplier: 2, isBoundary: true, influenceRadius: 40 });
  }

  static generateRift(gw, gh, rng, existingPlanets = [], segmentLengthMult = 1, nSegments = null) {
    const N      = nSegments ?? (rng.nextInt(9) + 3); // 3–11 segments (overridable)
    const segLen = RIFT_SEGMENT_LENGTH * segmentLengthMult;
    const margin = segLen * (N + 2);

    for (let attempt = 0; attempt < 10; attempt++) {
      let theta = rng.next() * Math.PI * 2;
      const x0  = margin + rng.next() * Math.max(1, gw - 2 * margin);
      const y0  = margin + rng.next() * Math.max(1, gh - 2 * margin);
      const vertices = [new Vec2(x0, y0)];

      for (let i = 1; i <= N; i++) {
        theta += (rng.next() * 2 - 1) * (Math.PI / 6); // ±30°
        const prev = vertices[i - 1];
        vertices.push(new Vec2(
          prev.x + Math.cos(theta) * segLen,
          prev.y + Math.sin(theta) * segLen,
        ));
      }

      const inBounds = vertices.every(v => v.x >= 0 && v.x <= gw && v.y >= 0 && v.y <= gh);
      if (!inBounds && attempt < 9) continue;

      const overlaps = existingPlanets.some(p =>
        vertices.some(v => {
          const dx = v.x - p.position.x, dy = v.y - p.position.y;
          return dx * dx + dy * dy < (p.impactRadius * 0.8) ** 2;
        }),
      );
      if (!overlaps || attempt === 9) return new SpaceRift({ vertices });
    }
    // Fallback: diagonal across map centre
    const cx = gw * 0.5, cy = gh * 0.5;
    return new SpaceRift({ vertices: [new Vec2(cx - 30, cy), new Vec2(cx, cy - 20), new Vec2(cx + 30, cy)] });
  }

  // ─── bonus random feature injection ─────────────────────────────────────

  static _addBonus(planets, rng, ra, rb, gw, gh, performance = 'full', noGrey = false, collectablesOn = false, collectablePositions = null) {
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
      // Red network — 4 wormholes all in the same network
      const wn = [0,1,2,3].map(() => makeWormhole(rng, gw,gh, [255,55,55], PlanetType.WORMHOLE_NETWORK));
      candidates = wn;
    } else if (rb < 0.645) {
      if (noGrey) {
        candidates = [makeCrystalAsteroid(rng, 0.4,0.4,0.1, 20,5,3, gw,gh, 0.05)];
      } else {
        // Grey triple — bullet enters one, copies emerge from the other two
        // Simplified: use red network wormholes instead
        candidates = simplified
          ? [0,1,2].map(() => makeWormhole(rng, gw,gh, [255,55,55], PlanetType.WORMHOLE_NETWORK))
          : [0,1,2].map(() => makeWormhole(rng, gw,gh, [155,155,155], PlanetType.WORMHOLE_PLANET));
      }
    } else if (rb < 0.70) {
      // Collectables wildcard — 3–6 collectables, or crystal asteroids if collectables are off
      if (collectablesOn && collectablePositions) {
        const n = 3 + rng.nextInt(4);
        for (let i = 0; i < n; i++)
          collectablePositions.push(new Vec2(rv(rng,0.6,0.3,0.1,gw), rv(rng,0.6,0.3,0.1,gh)));
        return;
      }
      candidates = Array.from({length: 2 + rng.nextInt(3)}, () => makeCrystalAsteroid(rng, 1,0,0, 20,5,3, gw,gh, 0.05));
    } else if (rb < 0.78) {
      // Yellow self wormhole
      candidates = [makeWormhole(rng, gw,gh, [255,255,55], PlanetType.WORMHOLE_SELF)];
    } else if (rb < 0.85) {
      const bigR = rng.nextInRange(3, 6) + 4;
      candidates = [new Planet({
        position: new Vec2(rv(rng,0.4,0.4,0.1,gw), rv(rng,0.4,0.4,0.1,gh)),
        radius: bigR, density: 3,
        type: PlanetType.WHITE_DWARF, colour: WHITE_COL, shading: ShadingStyle.GLOWING,
        halo: 15.0,
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
