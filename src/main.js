import { Renderer }                            from './rendering/Renderer.js';
import { ScenarioFactory }                     from './scenarios/ScenarioFactory.js';
import { SCENARIO_NAMES }                      from './scenarios/scenarioData.js';
import { RNG }                                 from './core/RNG.js';
import { GameState, GameMode }                 from './core/GameState.js';
import { Team }                                from './entities/Team.js';
import { Station, StationSize }                from './entities/Station.js';
import { Bullet, BulletStatus }                from './entities/Bullet.js';
import { Vec2 }                                from './core/Vec2.js';
import { PhysicsEngine, PRINT_EVERY, SHOW_EVERY } from './physics/PhysicsEngine.js';

const canvas   = document.getElementById('canvas-main');
const renderer = new Renderer(canvas);

const urlParam = parseInt(new URLSearchParams(location.search).get('s'));
let currentScenario = (urlParam >= 1 && urlParam <= 21) ? urlParam : 9; // default Red Giant

let gameState = null;
let physics   = null;
let stepCount = 0;

// ─── Scene builder ────────────────────────────────────────────────────────────

function buildScene(scenarioId) {
  renderer.resize(window.innerWidth, window.innerHeight);
  renderer.clearTrails();

  const gw   = renderer.gameWidth;
  const gh   = renderer.gameHeight;
  const rng  = new RNG(RNG.randomSeed());
  const size = StationSize.LARGE;

  physics = new PhysicsEngine(gw, gh);

  const nPlanets = rng.nextInt(5) + 3;
  const planets  = ScenarioFactory.create(scenarioId, gw, gh, nPlanets, rng);

  const teams = [0, 1, 2, 3].map(i => new Team({ index: i, isHuman: i === 0 }));
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

  gameState = new GameState({ planets, teams });
  gameState.mode = GameMode.AIMING;

  // Fire a test bullet from the first active station at angle=45, power=400
  const shooter = teams[0].stations[0];
  shooter.angle = 45;
  shooter.power = 400;
  fireBullet(shooter);

  const stars = Renderer.generateStarField(gw, gh);
  renderer.drawBackground(stars, planets);
  updateLabel(scenarioId);
  stepCount = 0;
}

function fireBullet(station) {
  const { position, velocity } = physics.initialState(station.angle, station.power, station);
  const bullet = new Bullet({ owner: station, position, velocity });
  bullet.trail.push(position);   // record spawn position as first trail point
  gameState.activeBullets.push(bullet);
}

// ─── Physics tick ─────────────────────────────────────────────────────────────

const STEPS_PER_FRAME = PRINT_EVERY * SHOW_EVERY; // 100 physics steps per render frame

function tickPhysics() {
  const allStations = gameState.allStations;

  for (let i = 0; i < STEPS_PER_FRAME; i++) {
    for (const bullet of gameState.activeBullets) {
      if (bullet.status !== BulletStatus.ACTIVE) continue;

      physics.step(bullet, gameState.planets);

      // Record trail point every PRINT_EVERY steps
      if (bullet.lifetime % PRINT_EVERY === 0) {
        bullet.trail.push(new Vec2(bullet.position.x, bullet.position.y));
        renderer.appendTrailPoint(bullet);
      }

      // Station collision check
      const hit = physics.checkStationCollisions(bullet, allStations);
      if (hit) {
        bullet.status = BulletStatus.EXPLODING;
        hit.status    = 'exploding';
      }
    }

    // Advance explosion animations
    for (const bullet of gameState.activeBullets) {
      if (bullet.status === BulletStatus.EXPLODING) {
        bullet.explosionT += 0.01;
        if (bullet.explosionT >= 1) bullet.status = BulletStatus.DEAD;
      }
    }
  }

  // Remove fully dead bullets
  gameState.activeBullets = gameState.activeBullets.filter(b => b.status !== BulletStatus.DEAD);
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
  tickPhysics();
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
