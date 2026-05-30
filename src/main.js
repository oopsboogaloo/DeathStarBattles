import { Renderer }          from './rendering/Renderer.js';
import { ScenarioFactory }   from './scenarios/ScenarioFactory.js';
import { SCENARIO_NAMES, weightedRandomId } from './scenarios/scenarioData.js';
import { RNG }               from './core/RNG.js';
import { GameState }         from './core/GameState.js';
import { GameLoop }          from './core/GameLoop.js';
import { PhysicsEngine }     from './physics/PhysicsEngine.js';
import { Team }              from './entities/Team.js';
import { Station, StationSize } from './entities/Station.js';
import { Vec2 }              from './core/Vec2.js';

// ─── Canvas + renderer ────────────────────────────────────────────────────────

const canvas   = document.getElementById('canvas-main');
const renderer = new Renderer(canvas);

// ─── URL param: optional fixed scenario ──────────────────────────────────────

function getUrlScenario() {
  const s = parseInt(new URLSearchParams(location.search).get('s'));
  return (s >= 1 && s <= 21) ? s : null;
}

// ─── Game factory ─────────────────────────────────────────────────────────────

let loop = null;

function startGame(scenarioId) {
  if (loop) loop.stop();

  renderer.resize(window.innerWidth, window.innerHeight);
  renderer.clearTrails();

  const gw   = renderer.gameWidth;
  const gh   = renderer.gameHeight;
  const rng  = new RNG(RNG.randomSeed());
  const size = StationSize.LARGE;

  // Pick scenario
  const sid = scenarioId ?? getUrlScenario() ?? weightedRandomId(rng);

  // Planets
  const nPlanets = rng.nextInt(6) + 3;  // 3–8
  const planets  = ScenarioFactory.create(sid, gw, gh, nPlanets, rng);

  // Teams — 4 teams, all AI for Phase 5 verification
  // (Phase 6 wires up team 0 as human with keyboard/mouse input)
  const teams = [0, 1, 2, 3].map(i => new Team({ index: i, isHuman: false }));
  let stationId = 0;
  for (const team of teams) {
    for (let s = 0; s < 2; s++) {
      team.stations.push(new Station({
        id: stationId++, team,
        position: new Vec2(0, 0), size,
      }));
    }
  }
  ScenarioFactory.placeStations(teams, planets, gw, gh, size, rng);

  // Stars (background — after layout is known)
  const stars = Renderer.generateStarField(gw, gh);
  renderer.drawBackground(stars, planets);

  // Game state + loop
  const gameState = new GameState({ planets, teams });
  const physics   = new PhysicsEngine(gw, gh);

  loop = new GameLoop({ gameState, physics, renderer, rng });
  loop.start();

  updateLabel(sid);
}

// ─── Label ────────────────────────────────────────────────────────────────────

function updateLabel(id) {
  let label = document.getElementById('scenario-label');
  if (!label) {
    label = document.createElement('div');
    label.id = 'scenario-label';
    Object.assign(label.style, {
      position: 'fixed', bottom: '16px', left: '50%',
      transform: 'translateX(-50%)',
      color: '#fff', fontFamily: 'monospace', fontSize: '16px',
      background: 'rgba(0,0,0,0.55)', padding: '5px 16px',
      borderRadius: '6px', pointerEvents: 'none', userSelect: 'none',
    });
    document.body.appendChild(label);
  }
  label.textContent = `${id}. ${SCENARIO_NAMES[id]}`;
}

// ─── Input ────────────────────────────────────────────────────────────────────

canvas.addEventListener('click', () => startGame(null));

window.addEventListener('keydown', e => {
  if (!loop) return;
  switch (e.key) {
    case 'p': case 'P': loop.togglePause();  break;
    case 'o': case 'O': loop.stepOne();       break;
  }
});

window.addEventListener('resize', () => {
  if (loop) startGame(getUrlScenario());
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

startGame(null);
