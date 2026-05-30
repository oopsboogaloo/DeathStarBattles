import { Renderer }             from './rendering/Renderer.js';
import { ScenarioFactory }      from './scenarios/ScenarioFactory.js';
import { SCENARIO_NAMES, weightedRandomId } from './scenarios/scenarioData.js';
import { RNG }                  from './core/RNG.js';
import { GameState, GameMode }  from './core/GameState.js';
import { GameLoop }             from './core/GameLoop.js';
import { PhysicsEngine }        from './physics/PhysicsEngine.js';
import { InputHandler }         from './input/InputHandler.js';
import { Team }                 from './entities/Team.js';
import { Station, StationSize } from './entities/Station.js';
import { Vec2 }                 from './core/Vec2.js';
import { AIController }         from './ai/AIController.js';
import { ConfigPanel }          from './ui/ConfigPanel.js';
// Side-effect imports register each bot with AIController
import './ai/RandBot.js';
import './ai/AimBot.js';
import './ai/CleverBot.js';
import './ai/SuperBot.js';
import './ai/MegaBot.js';

// ─── Canvas + renderer ────────────────────────────────────────────────────────

const canvas   = document.getElementById('canvas-main');
const renderer = new Renderer(canvas);
// Capture original before any monkey-patching in startGame
const _baseDrawFrame = renderer.drawFrame.bind(renderer);

// ─── Config panel ─────────────────────────────────────────────────────────────

const panel = new ConfigPanel();
document.body.appendChild(panel.element);

let activeConfig = panel.config; // last config used to start a real game
let isDemo       = false;

panel.onStart(cfg => {
  isDemo = false;
  activeConfig = cfg;
  startGame(cfg);
});

// ─── Bottom UI buttons (End Turn / Hyperspace) ────────────────────────────────

const btnBar = document.createElement('div');
btnBar.id    = 'btn-bar';
Object.assign(btnBar.style, {
  position: 'fixed', bottom: '14px', left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex', gap: '14px', zIndex: '10',
});

function makeBtn(label, accent = 'rgba(10,10,25,0.85)') {
  const btn = document.createElement('button');
  btn.textContent = label;
  Object.assign(btn.style, {
    background: accent, color: '#fff',
    border: '1px solid rgba(255,255,255,0.35)',
    padding: '9px 26px', borderRadius: '5px',
    fontFamily: 'monospace', fontSize: '15px',
    cursor: 'pointer', letterSpacing: '0.04em',
  });
  btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(40,40,80,0.95)');
  btn.addEventListener('mouseleave', () => btn.style.background = accent);
  return btn;
}

const endTurnBtn    = makeBtn('End Turn');
const hyperspaceBtn = makeBtn('Hyperspace');
btnBar.append(endTurnBtn, hyperspaceBtn);
document.body.appendChild(btnBar);

endTurnBtn.addEventListener('click',    e => { e.stopPropagation(); if (loop) loop.humanFire(); });
hyperspaceBtn.addEventListener('click', e => { e.stopPropagation(); if (loop) loop.humanHyperspace(); });

// ─── Game-over overlay ────────────────────────────────────────────────────────

const gameOverBar = document.createElement('div');
Object.assign(gameOverBar.style, {
  position: 'fixed', bottom: '18px', left: '50%',
  transform: 'translateX(-50%)',
  display: 'none', gap: '14px', zIndex: '10',
});
document.body.appendChild(gameOverBar);

const playAgainBtn = makeBtn('Play Again');
const newGameBtn   = makeBtn('New Game');
gameOverBar.append(playAgainBtn, newGameBtn);

playAgainBtn.addEventListener('click', e => {
  e.stopPropagation();
  gameOverBar.style.display = 'none';
  startGame(activeConfig);
});
newGameBtn.addEventListener('click', e => {
  e.stopPropagation();
  gameOverBar.style.display = 'none';
  if (loop) { loop.stop(); loop = null; }
  panel.show();
});

// ─── Menu icon (⚙) — always visible, re-opens config ─────────────────────────

const menuBtn = document.createElement('button');
menuBtn.textContent = '⚙';
Object.assign(menuBtn.style, {
  position: 'fixed', top: '10px', left: '10px',
  background: 'rgba(10,10,25,0.6)', color: 'rgba(255,255,255,0.55)',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: '4px', padding: '4px 8px',
  fontFamily: 'monospace', fontSize: '16px',
  cursor: 'pointer', zIndex: '10',
});
menuBtn.title = 'Settings';
menuBtn.addEventListener('click', e => {
  e.stopPropagation();
  isDemo = false;
  if (loop) { loop.stop(); loop = null; }
  gameOverBar.style.display = 'none';
  panel.show();
});
document.body.appendChild(menuBtn);

// ─── Button visibility sync ───────────────────────────────────────────────────

function updateButtons(gs) {
  if (!gs || isDemo) {
    btnBar.style.display     = 'none';
    gameOverBar.style.display = 'none';
    return;
  }
  btnBar.style.display      = (gs.mode === GameMode.AIMING && gs.waitingForInput) ? 'flex' : 'none';
  gameOverBar.style.display = gs.mode === GameMode.GAMEOVER ? 'flex' : 'none';
}

// ─── Game factory ─────────────────────────────────────────────────────────────

let loop    = null;
let handler = null;

function startGame(cfg) {
  if (loop) loop.stop();

  renderer.resize(window.innerWidth, window.innerHeight);
  renderer.clearTrails();

  const gw  = renderer.gameWidth;
  const gh  = renderer.gameHeight;
  const rng = new RNG(RNG.randomSeed());

  const size       = StationSize[cfg.stationSize] ?? StationSize.LARGE;
  const scenarioId = cfg.scenarioId > 0 ? cfg.scenarioId : (getUrlScenario() ?? weightedRandomId(rng));
  const nPlanets   = cfg.numPlanets  > 0 ? cfg.numPlanets  : (rng.nextInt(6) + 3);

  const planets  = ScenarioFactory.create(scenarioId, gw, gh, nPlanets, rng);

  const nP = cfg.numPlayers;
  const nH = Math.min(cfg.numHuman ?? 1, nP);

  const teams = [];
  for (let i = 0; i < nP; i++) {
    teams.push(new Team({ index: i, isHuman: i < nH }));
  }

  let stationId = 0;
  for (const team of teams) {
    for (let s = 0; s < cfg.stationsPerPlayer; s++) {
      team.stations.push(new Station({ id: stationId++, team, position: new Vec2(0, 0), size }));
    }
  }
  ScenarioFactory.placeStations(teams, planets, gw, gh, size, rng);

  const stars = Renderer.generateStarField(gw, gh);
  renderer.drawBackground(stars, planets);

  const gameState = new GameState({ planets, teams });
  const physics   = new PhysicsEngine(gw, gh);

  for (const team of teams.filter(t => !t.isHuman)) {
    team.controller = AIController.create(cfg.aiLevel ?? 3, physics);
  }

  loop = new GameLoop({ gameState, physics, renderer, rng });

  renderer.drawFrame = gs => { _baseDrawFrame(gs); updateButtons(gs); };

  handler = new InputHandler({ canvas, loop, renderer });
  loop.start();

  if (!isDemo) updateLabel(scenarioId);
  updateButtons(gameState);
}

// ─── Demo mode ────────────────────────────────────────────────────────────────

const DEMO_CONFIG = {
  numPlayers: 5, numHuman: 0, stationsPerPlayer: 2,
  aiLevel: 3, stationSize: 'LARGE', numPlanets: -1, scenarioId: 9,
};

function startDemo() {
  isDemo = true;
  startGame(DEMO_CONFIG);

  function onFirstInteraction(e) {
    // Ignore clicks on the game buttons (shouldn't be visible, but just in case)
    if (e.target?.closest?.('#btn-bar')) return;
    if (!isDemo) return;
    isDemo = false;
    if (loop) { loop.stop(); loop = null; }
    updateButtons(null);
    panel.show();
  }
  document.addEventListener('click',   onFirstInteraction, { once: true });
  document.addEventListener('keydown', onFirstInteraction, { once: true });
}

// ─── URL param ────────────────────────────────────────────────────────────────

function getUrlScenario() {
  const s = parseInt(new URLSearchParams(location.search).get('s'));
  return (s >= 1 && s <= 21) ? s : null;
}

// ─── Scenario label (top-right) ───────────────────────────────────────────────

function updateLabel(id) {
  let label = document.getElementById('scenario-label');
  if (!label) {
    label = document.createElement('div');
    label.id = 'scenario-label';
    Object.assign(label.style, {
      position: 'fixed', top: '10px', right: '10px',
      color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace', fontSize: '13px',
      pointerEvents: 'none', userSelect: 'none',
    });
    document.body.appendChild(label);
  }
  label.textContent = `${id}. ${SCENARIO_NAMES[id]}`;
}

// Canvas click on game-over → Play Again shortcut (same as the DOM button)
canvas.addEventListener('click', e => {
  if (!loop || isDemo) return;
  if (loop.gs.mode === GameMode.GAMEOVER) {
    gameOverBar.style.display = 'none';
    startGame(activeConfig);
  }
});

// ─── Global keyboard shortcuts ────────────────────────────────────────────────

window.addEventListener('keydown', e => {
  if (!loop || isDemo) return;
  if (e.key === 'p' || e.key === 'P') loop.togglePause();
  if (e.key === 'o' || e.key === 'O') loop.stepOne();
});

window.addEventListener('resize', () => {
  if (loop && !isDemo) startGame(activeConfig);
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

startDemo();
