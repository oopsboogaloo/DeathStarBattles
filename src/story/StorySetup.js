import { Vec2 }                                                       from '../core/Vec2.js';
import { Planet, PlanetType, ShadingStyle, GAS_GIANT_COLOUR_PAIRS }  from '../entities/Planet.js';
import { Team }                                                        from '../entities/Team.js';
import { Station, StationSize }                                        from '../entities/Station.js';
import { Collectable }                                                 from '../entities/Collectable.js';
import { GameState }                                                   from '../core/GameState.js';
import { AIController }                                                from '../ai/AIController.js';
import { ScenarioFactory }                                             from '../scenarios/ScenarioFactory.js';
import { StoryModeState }                                              from './StoryModeState.js';

// ─── Colour constants (mirrors ScenarioFactory internals) ─────────────────────
const ASTEROID_COL = [120,  80,  10];
const CRYSTAL_COL  = [160, 210, 255];
const STAR_COL     = [255, 240, 100];
const COMET_COL    = [255, 255, 200];
const WHITE_COL    = [255, 255, 255];
const BLACK_COL    = [  0,   0,   0];

// ─── Shared ID counter for stations created during story setup ────────────────
let _nextId = 0;
export function resetStoryStationId() { _nextId = 0; }

// ─── Asteroid polygon generator (same algorithm as ScenarioFactory) ───────────
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

// Pre-compute and cache rotated vertices (required by Renderer)
function cacheRotatedVerts(p) {
  const { position: { x: px, y: py }, radius: r, vertices, rotation } = p;
  const cos = Math.cos(rotation), sin = Math.sin(rotation);
  p._rotatedVerts = vertices.map(v => new Vec2(
    px + r * (v.x * cos - v.y * sin),
    py + r * (v.x * sin + v.y * cos),
  ));
}

// ─── Planet builder: normalised def → Planet ──────────────────────────────────
function buildPlanet(def, gw, gh, rng) {
  const position = new Vec2(def.x * gw, def.y * gh);
  const { radius, density } = def;

  switch (def.type) {
    case PlanetType.ASTEROID: {
      const n         = 6 + Math.floor(rng.next() * 5);
      const vertices  = asteroidVertices(rng, n);
      const rotation  = rng.next() * Math.PI * 2;
      const rotSpeed  = (0.1 + rng.next() * rng.next() * 0.7) * Math.PI / 180;
      const rich      = def.rich ?? false;
      const p = new Planet({
        position, radius, density,
        type:          PlanetType.ASTEROID,
        colour:        rich ? [75, 90, 120] : [...ASTEROID_COL],
        shading:       ShadingStyle.ROCKY,
        vertices, rotation, rotationSpeed: rotSpeed, rich,
      });
      cacheRotatedVerts(p);
      return p;
    }

    case PlanetType.CRYSTAL: {
      const n         = 6 + Math.floor(rng.next() * 5);
      const vertices  = asteroidVertices(rng, n);
      const rotation  = rng.next() * Math.PI * 2;
      const rotSpeed  = (0.1 + rng.next() * rng.next() * 0.7) * Math.PI / 180;
      const p = new Planet({
        position, radius, density,
        type:          PlanetType.CRYSTAL,
        colour:        [...CRYSTAL_COL],
        shading:       ShadingStyle.ROCKY,
        vertices, rotation, rotationSpeed: rotSpeed,
      });
      cacheRotatedVerts(p);
      return p;
    }

    case PlanetType.STAR:
      return new Planet({
        position, radius, density,
        type:       PlanetType.STAR,
        colour:     [...STAR_COL],
        shading:    ShadingStyle.GLOWING,
        supergiant: def.supergiant ?? false,
      });

    case PlanetType.GAS_GIANT: {
      const pairIdx      = Math.floor(rng.next() * GAS_GIANT_COLOUR_PAIRS.length);
      const [colA, colB] = GAS_GIANT_COLOUR_PAIRS[pairIdx];
      return new Planet({
        position, radius, density,
        type:    PlanetType.GAS_GIANT,
        colour:  [...colA],
        colourB: [...colB],
        shading: ShadingStyle.GAS_GIANT,
      });
    }

    case PlanetType.WHITE_DWARF:
      return new Planet({
        position, radius, density,
        mass:    def.mass ?? null,
        type:    PlanetType.WHITE_DWARF,
        colour:  [...WHITE_COL],
        shading: ShadingStyle.GLOWING,
      });

    case PlanetType.BLACK_HOLE:
      return new Planet({
        position, radius, density,
        type:    PlanetType.BLACK_HOLE,
        colour:  [...BLACK_COL],
        shading: ShadingStyle.NONE,
      });

    case PlanetType.COMET: {
      const angle    = rng.next() * Math.PI * 2;
      const speed    = 0.015;
      const velocity = new Vec2(Math.cos(angle) * speed, Math.sin(angle) * speed);
      return new Planet({
        position, radius, density,
        type:     PlanetType.COMET,
        colour:   [...COMET_COL],
        shading:  ShadingStyle.GLOWING,
        velocity,
      });
    }

    default:
      return new Planet({
        position, radius, density,
        type:    def.type,
        colour:  [150, 120, 80],
        shading: ShadingStyle.ROCKY,
      });
  }
}

// ─── Push a position clear of any overlapping planets ────────────────────────
function clearPlanetOverlap(pos, planets, clearance, gw, gh) {
  let x = pos.x, y = pos.y;
  for (let iter = 0; iter < 20; iter++) {
    let moved = false;
    for (const planet of planets) {
      const dx   = x - planet.position.x;
      const dy   = y - planet.position.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minD = planet.radius + clearance;
      if (dist < minD) {
        const scale = minD / (dist || 0.01);
        x = planet.position.x + dx * scale;
        y = planet.position.y + dy * scale;
        moved = true;
      }
    }
    if (!moved) break;
  }
  // Clamp to field bounds with clearance margin
  x = Math.max(clearance, Math.min(gw - clearance, x));
  y = Math.max(clearance, Math.min(gh - clearance, y));
  return new Vec2(x, y);
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export function buildStoryMission(mission, physics, rng) {
  const { gw, gh } = physics;

  // ── Planets ──────────────────────────────────────────────────────────────────
  let planets;
  if (mission.layout.scenarioId != null) {
    // Asteroid-heavy scenarios use more planets (matches main.js logic)
    const nPlanets      = [2, 3, 17].includes(mission.layout.scenarioId) ? 20 : 10;
    const collectables  = mission.settings.collectablesSpawn === 'normal' ? 'normal' : 'off';
    const richAsteroids = mission.settings.richAsteroids ?? 'normal';
    ({ planets } = ScenarioFactory.create(
      mission.layout.scenarioId, gw, gh, nPlanets, rng,
      'off',        // no random wildcard planets — keep story layouts clean
      'full',
      collectables,
      richAsteroids,
    ));
    // Append mission-specific extra planets (e.g. white dwarf in M18, comets in M20)
    for (const def of mission.layout.extraPlanets ?? []) {
      planets.push(buildPlanet(def, gw, gh, rng));
    }
  } else {
    planets = (mission.layout.planets ?? []).map(def => buildPlanet(def, gw, gh, rng));
  }

  // Apply optional star radius scale (e.g. to shrink an oversized red giant)
  if (mission.layout.starRadiusScale != null) {
    for (const p of planets) {
      if (p.type === PlanetType.STAR) p.radius *= mission.layout.starRadiusScale;
    }
  }

  // Apply optional black hole mass scale (e.g. to tone down gravity on final mission)
  if (mission.layout.blackHoleMassScale != null) {
    for (const p of planets) {
      if (p.type === PlanetType.BLACK_HOLE && p._massOverride != null) {
        p._massOverride *= mission.layout.blackHoleMassScale;
      }
    }
  }

  // ── Teams ────────────────────────────────────────────────────────────────────
  const teamIndices = [...new Set(mission.layout.stations.map(s => s.team))].sort((a, b) => a - b);

  const teams = teamIndices.map(ti => {
    const isHuman = ti === 0;
    const team    = new Team({ index: ti, isHuman });

    const teamStationDefs = mission.layout.stations.filter(s => s.team === ti);
    const aiDef           = teamStationDefs.find(s => s.role === 'ai');

    if (isHuman) {
      team.addStartingWeapons(mission.settings.startingWeapons ?? {});
    } else {
      team.addStartingWeapons(mission.settings.enemyStartingWeapons ?? {});
      // Only create a controller if the team has at least one live AI station.
      // Teams where all stations are 'target' stay with controller = null;
      // the GameLoop guard in SM3 handles skipping them in the turn order.
      if (aiDef) {
        team.controller = AIController.create(aiDef.aiLevel ?? 2, physics);
      }
    }

    return team;
  });

  // ── Stations ─────────────────────────────────────────────────────────────────
  const size = StationSize[mission.settings.stationSize?.toUpperCase()] ?? StationSize.LARGE;

  for (const def of mission.layout.stations) {
    const team    = teams.find(t => t.index === def.team);
    const rawPos  = new Vec2(def.x * gw, def.y * gh);
    const pos     = clearPlanetOverlap(rawPos, planets, size.radius + 8, gw, gh);
    const station = new Station({ id: _nextId++, team, position: pos, size });
    station.role        = def.role        ?? 'human';
    station.visualStyle = def.visualStyle ?? 'station';
    team.stations.push(station);
  }

  // ── GameState ─────────────────────────────────────────────────────────────────
  const gs = new GameState({
    planets,
    teams,
    movementSpeed: mission.settings.movementSpeed ?? 'off',
    config: {
      collectables:    mission.settings.collectablesSpawn === 'normal' ? 'normal' : 'off',
      richAsteroids:   mission.settings.richAsteroids ?? 'normal',
      collectableSize: 'medium',
      scenarioId:      mission.layout.scenarioId ?? null,
    },
  });

  gs.storyState = new StoryModeState(mission);

  // ── Fixed Collectables ────────────────────────────────────────────────────────
  if (mission.settings.collectablesSpawn === 'fixed') {
    for (const def of mission.layout.collectables ?? []) {
      gs.collectables.push(new Collectable(new Vec2(def.x * gw, def.y * gh)));
    }
  }

  return { gs, teams };
}
