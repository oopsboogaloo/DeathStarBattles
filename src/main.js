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
// Side-effect imports register each bot with AIController
import './ai/RandBot.js';
import './ai/AimBot.js';
import './ai/CleverBot.js';
import './ai/SuperBot.js';
import './ai/MegaBot.js';

// ─── Canvas + renderer ────────────────────────────────────────────────────────

const canvas   = document.getElementById('canvas-main');
const renderer = new Renderer(canvas);

// ─── Bottom UI buttons (End Turn / Hyperspace) ────────────────────────────────

const btnBar = document.createElement('div');
btnBar.id    = 'btn-bar';
Object.assign(btnBar.style, {
  position: 'fixed', bottom: '14px', left: '50%',
  transform: 'translateX(-50%)',
  display: 'flex', gap: '14px', zIndex: '10',
});

function makeBtn(label) {
  const btn = document.createElement('button');
  btn.textContent = label;
  Object.assign(btn.style, {
    background: 'rgba(10,10,25,0.85)', color: '#fff',
    border: '1px solid rgba(255,255,255,0.35)',
    padding: '9px 26px', borderRadius: '5px',
    fontFamily: 'monospace', fontSize: '15px',
    cursor: 'pointer', letterSpacing: '0.04em',
  });
  btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(40,40,80,0.95)');
  btn.addEventListener('mouseleave', () => btn.style.background = 'rgba(10,10,25,0.85)');
  return btn;
}

const endTurnBtn    = makeBtn('End Turn');
const hyperspaceBtn = makeBtn('Hyperspace');
btnBar.append(endTurnBtn, hyperspaceBtn);
document.body.appendChild(btnBar);

// Prevent canvas click-to-restart from firing when buttons are clicked
endTurnBtn.addEventListener('click',    e => { e.stopPropagation(); if (loop) loop.humanFire();       });
hyperspaceBtn.addEventListener('click', e => { e.stopPropagation(); if (loop) loop.humanHyperspace(); });

// ─── Show/hide buttons based on whether it's the human's turn ────────────────

function updateButtons(gs) {
  const show = gs && gs.waitingForInput && gs.mode === GameMode.AIMING;
  btnBar.style.display = show ? 'flex' : 'none';
}

// ─── Game factory ─────────────────────────────────────────────────────────────

let loop    = null;
let handler = null;

function startGame(sid) {
  if (loop) loop.stop();

  renderer.resize(window.innerWidth, window.innerHeight);
  renderer.clearTrails();

  const gw  = renderer.gameWidth;
  const gh  = renderer.gameHeight;
  const rng = new RNG(RNG.randomSeed());
  const size = StationSize.LARGE;

  const scenarioId = sid ?? getUrlScenario() ?? weightedRandomId(rng);

  // Planets
  const nPlanets = rng.nextInt(6) + 3;
  const planets  = ScenarioFactory.create(scenarioId, gw, gh, nPlanets, rng);

  // Teams — team 0 is human, rest are AI
  const teams = [0, 1, 2, 3].map(i => new Team({ index: i, isHuman: i === 0 }));
  let stationId = 0;
  for (const team of teams) {
    for (let s = 0; s < 2; s++) {
      team.stations.push(new Station({ id: stationId++, team, position: new Vec2(0, 0), size }));
    }
  }
  ScenarioFactory.placeStations(teams, planets, gw, gh, size, rng);

  const stars = Renderer.generateStarField(gw, gh);
  renderer.drawBackground(stars, planets);

  const gameState = new GameState({ planets, teams });
  const physics   = new PhysicsEngine(gw, gh);

  // Assign real AI controllers to non-human teams (levels: AimBot, CleverBot, SuperBot)
  const aiLevels = [2, 3, 4];
  for (let i = 1; i < teams.length; i++) {
    teams[i].controller = AIController.create(aiLevels[i - 1] ?? 1, physics);
  }

  loop = new GameLoop({ gameState, physics, renderer, rng });

  // Wrap the loop's rAF tick to keep buttons in sync
  const origDraw = renderer.drawFrame.bind(renderer);
  renderer.drawFrame = gs => { origDraw(gs); updateButtons(gs); };

  handler = new InputHandler({ canvas, loop, renderer });
  loop.start();

  updateLabel(scenarioId);
  updateButtons(gameState);
}

// ─── URL param ────────────────────────────────────────────────────────────────

function getUrlScenario() {
  const s = parseInt(new URLSearchParams(location.search).get('s'));
  return (s >= 1 && s <= 21) ? s : null;
}

// ─── Scenario label ───────────────────────────────────────────────────────────

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

// ─── Input ────────────────────────────────────────────────────────────────────

// Canvas click: restart only on GAMEOVER; during play, mouse aiming is handled
// by InputHandler's mousedown listener
canvas.addEventListener('click', () => {
  if (!loop) { startGame(null); return; }
  if (loop.gs.mode === GameMode.GAMEOVER) startGame(null);
});

window.addEventListener('keydown', e => {
  if (!loop) return;
  if (e.key === 'p' || e.key === 'P') loop.togglePause();
  if (e.key === 'o' || e.key === 'O') loop.stepOne();
});

window.addEventListener('resize', () => {
  if (loop) startGame(getUrlScenario());
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

startGame(null);
