import { Renderer }                            from './rendering/Renderer.js';
import { ScenarioFactory }                     from './scenarios/ScenarioFactory.js';
import { SCENARIO_NAMES }                      from './scenarios/scenarioData.js';
import { RNG }                                 from './core/RNG.js';
import { GameState, GameMode }                 from './core/GameState.js';
import { Team }                                from './entities/Team.js';
import { Station, StationSize, StationStatus } from './entities/Station.js';
import { Vec2 }                                from './core/Vec2.js';

const canvas   = document.getElementById('canvas-main');
const renderer = new Renderer(canvas);

const urlParam = parseInt(new URLSearchParams(location.search).get('s'));
let currentScenario = (urlParam >= 1 && urlParam <= 21) ? urlParam : 1;

let gameState = null;

// ─── Scene builder ────────────────────────────────────────────────────────────

function buildScene(scenarioId) {
  renderer.resize(window.innerWidth, window.innerHeight);
  const gw   = renderer.gameWidth;
  const gh   = renderer.gameHeight;
  const rng  = new RNG(RNG.randomSeed());
  const size = StationSize.LARGE;

  // Planet layout
  const nPlanets = rng.nextInt(5) + 3;  // 3–7
  const planets  = ScenarioFactory.create(scenarioId, gw, gh, nPlanets, rng);

  // Teams: 4 teams, 2 stations each — team 0 is human
  const teams = [0, 1, 2, 3].map(i => new Team({ index: i, isHuman: i === 0 }));
  let stationId = 0;
  for (const team of teams) {
    for (let s = 0; s < 2; s++) {
      team.stations.push(new Station({
        id: stationId++,
        team,
        position: new Vec2(0, 0),   // set by placeStations
        size,
      }));
    }
  }

  ScenarioFactory.placeStations(teams, planets, gw, gh, size, rng);

  // Set a visible angle on station 0 for testing
  teams[0].stations[0].angle = 45;

  const stars = Renderer.generateStarField(gw, gh);

  gameState = new GameState({ planets, teams });
  gameState.mode = GameMode.AIMING;

  renderer.drawBackground(stars, planets);
  updateLabel(scenarioId);
}

function updateLabel(id) {
  let label = document.getElementById('scenario-label');
  if (!label) {
    label = document.createElement('div');
    label.id = 'scenario-label';
    Object.assign(label.style, {
      position: 'fixed', bottom: '16px', left: '50%',
      transform: 'translateX(-50%)',
      color: '#fff', fontFamily: 'monospace', fontSize: '18px',
      background: 'rgba(0,0,0,0.6)', padding: '6px 18px',
      borderRadius: '6px', pointerEvents: 'none', userSelect: 'none',
    });
    document.body.appendChild(label);
  }
  label.textContent = `${id}. ${SCENARIO_NAMES[id]}  —  click for next`;
}

// ─── Loop ─────────────────────────────────────────────────────────────────────

function loop() {
  renderer.drawFrame(gameState);
  requestAnimationFrame(loop);
}

// ─── Input ────────────────────────────────────────────────────────────────────

canvas.addEventListener('click', () => {
  currentScenario = (currentScenario % 21) + 1;
  buildScene(currentScenario);
});

window.addEventListener('resize', () => {
  if (gameState) buildScene(currentScenario);
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

buildScene(currentScenario);
loop();
