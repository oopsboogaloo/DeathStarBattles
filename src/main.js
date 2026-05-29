import { Renderer }                         from './rendering/Renderer.js';
import { ScenarioFactory }                   from './scenarios/ScenarioFactory.js';
import { SCENARIO_NAMES }                    from './scenarios/scenarioData.js';
import { RNG }                               from './core/RNG.js';

const canvas   = document.getElementById('canvas-main');
const renderer = new Renderer(canvas);

const urlParam = parseInt(new URLSearchParams(location.search).get('s'));
let currentScenario = (urlParam >= 1 && urlParam <= 21) ? urlParam : 1;
let stars   = [];

function buildScene(scenarioId) {
  renderer.resize(window.innerWidth, window.innerHeight);
  const gw  = renderer.gameWidth;
  const gh  = renderer.gameHeight;
  const rng = new RNG(RNG.randomSeed());

  stars           = Renderer.generateStarField(gw, gh);
  const nPlanets  = Math.floor(rng.nextInRange(3, 8));
  const planets   = ScenarioFactory.create(scenarioId, gw, gh, nPlanets, rng);

  renderer.drawBackground(stars, planets);
  updateLabel(scenarioId);
}

function updateLabel(id) {
  let label = document.getElementById('scenario-label');
  if (!label) {
    label = document.createElement('div');
    label.id = 'scenario-label';
    Object.assign(label.style, {
      position: 'fixed', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
      color: '#fff', fontFamily: 'monospace', fontSize: '18px',
      background: 'rgba(0,0,0,0.6)', padding: '6px 18px', borderRadius: '6px',
      pointerEvents: 'none', userSelect: 'none',
    });
    document.body.appendChild(label);
  }
  label.textContent = `${id}. ${SCENARIO_NAMES[id]}  —  click for next`;
}

function init() {
  buildScene(currentScenario);
}

function loop() {
  renderer.drawFrame(null);
  requestAnimationFrame(loop);
}

canvas.addEventListener('click', () => {
  currentScenario = (currentScenario % 21) + 1;
  buildScene(currentScenario);
});

window.addEventListener('resize', () => {
  renderer.resize(window.innerWidth, window.innerHeight);
});

init();
loop();
