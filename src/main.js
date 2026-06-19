// Copyright © 2026 Chloe Bolland
// contact chloe@mammoththoughts.com if you wish to use, publish or reproduce this game or any part of it in any way

import { Renderer }             from './rendering/Renderer.js';
import { ScenarioFactory }      from './scenarios/ScenarioFactory.js';
import { weightedRandomId, hashString, SCENARIO_COUNT } from './scenarios/scenarioData.js';
import { RNG }                  from './core/RNG.js';
import { GameState, GameMode }  from './core/GameState.js';
import { GameLoop }             from './core/GameLoop.js';
import { PhysicsEngine }        from './physics/PhysicsEngine.js';
import { InputHandler }         from './input/InputHandler.js';
import { CameraControls }       from './input/CameraControls.js';
import { Team }                 from './entities/Team.js';
import { Station, StationSize } from './entities/Station.js';
import { Vec2 }                 from './core/Vec2.js';
import { AIController }         from './ai/AIController.js';
import { ConfigPanel }          from './ui/ConfigPanel.js';
import { Leaderboard }          from './ui/Leaderboard.js';
import { GameOverScreen }       from './ui/GameOverScreen.js';
import { TournamentState }      from './core/TournamentState.js';
import { AimControls }          from './ui/AimControls.js';
import { WeaponSelector }       from './ui/WeaponSelector.js';
import { StoryObjectivePanel }  from './ui/StoryObjectivePanel.js';
import { StoryDialogPopup }     from './ui/StoryDialogPopup.js';
import { StoryModeScreen }      from './ui/StoryModeScreen.js';
import { buildStoryMission, resetStoryStationId } from './story/StorySetup.js';
import { StoryPersistence }     from './story/StoryPersistence.js';
import { Collectable, WeaponId, WEAPON_GRANTS } from './entities/Collectable.js';
import { AboutModal, InstructionsModal, EducationModal, ScoreModal, OptionsHelpModal } from './ui/InfoModals.js';
import { SoundManager, SOUND_VOL_GAIN } from './audio/SoundManager.js';
import { TargetPracticeSetup }        from './core/TargetPracticeSetup.js';
import { TargetPracticeGame }          from './core/TargetPracticeGame.js';
import { TargetPracticeResultsScreen } from './ui/TargetPracticeResultsScreen.js';
import { TARGET_PRACTICE_SCENARIOS }   from './scenarios/scenarioData.js';
// Side-effect imports register each bot with AIController
import './ai/RandBot.js';
import './ai/AimBot.js';
import './ai/CleverBot.js';
import './ai/SuperBot.js';
import './ai/MegaBot.js';

// ─── Mobile / orientation utilities ──────────────────────────────────────────

function _isPhone() {
  return navigator.maxTouchPoints > 0 &&
    Math.min(window.screen.width, window.screen.height) <= 500;
}

async function applyOrientationSetting(setting) {
  if (!('orientation' in screen)) return;
  try {
    if (_isPhone()) {
      // On a phone: Auto → landscape, Landscape → landscape, Portrait → portrait
      if (setting === 'portrait') {
        await screen.orientation.lock('portrait');
      } else {
        await screen.orientation.lock('landscape');
      }
    } else if (setting === 'landscape') {
      await screen.orientation.lock('landscape');
    } else if (setting === 'portrait') {
      await screen.orientation.lock('portrait');
    } else {
      screen.orientation.unlock();
    }
  } catch (_) { /* requires fullscreen on some browsers */ }
}

// SVG icons for minimal UI buttons (monotone, currentColor)
const _MOVE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" style="display:block;pointer-events:none"><line x1="3" y1="12" x2="17" y2="12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><polyline points="11,6 18,12 11,18" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;
const _ENDTURN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" style="display:block;pointer-events:none"><polyline points="4,12 9,17 20,6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;

// ─── Canvas + renderer ────────────────────────────────────────────────────────

const canvas   = document.getElementById('canvas-main');
const renderer = new Renderer(canvas);
// Capture original before any monkey-patching in startGame
const _baseDrawFrame = renderer.drawFrame.bind(renderer);

// Camera zoom/pan gestures. Created once; it reads the live InputHandler (which
// is recreated per game) lazily so it never leaks canvas listeners.
const cameraControls = new CameraControls({
  canvas, renderer, getInputHandler: () => handler,
});

// ─── Config panel ─────────────────────────────────────────────────────────────

const panel = new ConfigPanel();
document.body.appendChild(panel.element);

let activeConfig      = panel.config; // last config used to start a real game

// Apply campaign completion reward immediately on load
{ const _d = StoryPersistence.load(); if (StoryPersistence.isCampaignComplete(_d)) panel.setCampaignComplete(true); }
let isDemo            = false;
let tournament        = null;          // TournamentState | null
let lastGameState     = null;          // game state from most recently completed game (for Scores modal)
let _prevWeaponStocks = null;          // Map<teamIndex, Map<weaponId, count>> — carries over between tournament games
let _menuPausedLoop   = false;         // true when ⚙ paused a running game (resume can unpause it)

// ─── Leaderboard & game-over screen ──────────────────────────────────────────

const aimControls    = new AimControls();
document.body.appendChild(aimControls.element);

// ── Info modals ───────────────────────────────────────────────────────────────

const aboutModal        = new AboutModal();
aboutModal.onDevMode(() => _toggleDevMode());
const instructionsModal = new InstructionsModal();
const educationModal    = new EducationModal();
const scoreModal        = new ScoreModal();
const optionsHelpModal  = new OptionsHelpModal();
document.body.appendChild(aboutModal.element);
document.body.appendChild(instructionsModal.element);
document.body.appendChild(educationModal.element);
document.body.appendChild(scoreModal.element);
document.body.appendChild(optionsHelpModal.element);

panel.onResume(() => {
  if (_menuPausedLoop && loop?.isPaused) { loop.togglePause(); }
  _menuPausedLoop = false;
});

panel.onOrientChange(setting => applyOrientationSetting(setting));

panel.onResign(() => {
  if (!loop) return;
  const gs   = loop.gs;
  const team = gs.teams[gs.currentTeamIdx];
  if (!team) return;
  // Only allow resign during aiming when it is a human player's turn
  const isHumanAimTurn = (gs.mode === GameMode.AIMING || gs.mode === GameMode.TP_AIMING)
    && gs.waitingForInput && team.isHuman;
  if (!isHumanAimTurn) return;
  if (_menuPausedLoop && loop.isPaused) { loop.togglePause(); _menuPausedLoop = false; }
  loop.resignTeam(team);
});

panel.onInfo(which => {
  if (which === 'about')        aboutModal.show();
  if (which === 'instructions') instructionsModal.show();
  if (which === 'education')    educationModal.show();
  if (which === 'scores')       scoreModal.show(lastGameState);
  if (which === 'options')      optionsHelpModal.show();
});

const leaderboard    = new Leaderboard();
document.body.appendChild(leaderboard.element);
leaderboard.hide();

const gameOverScreen = new GameOverScreen();
document.body.appendChild(gameOverScreen.element);

const tpResultsScreen = new TargetPracticeResultsScreen();
document.body.appendChild(tpResultsScreen.element);
tpResultsScreen.onPlayAgain(() => startTPGame(activeConfig));
tpResultsScreen.onMainMenu(() => {
  tournament = null;
  if (loop) { loop.stop(); loop = null; }
  renderer.setGameAspect(null, null);
  SoundManager.stopAmbient();
  panel.show();
});

gameOverScreen.onContinue(() => {
  if (tournament) {
    const limit   = activeConfig.tournamentGames;
    const isFinal = limit !== 'keepGoing' && tournament.gameIndex >= limit;
    if (isFinal) {
      tournament        = null;
      _prevWeaponStocks = null;
      if (loop) { loop.stop(); loop = null; }
      renderer.setGameAspect(null, null);
      SoundManager.stopAmbient();
      panel.show();
    } else {
      startGame(activeConfig);    // next tournament game
    }
  } else {
    startGame(activeConfig);      // single game: play again
  }
});
gameOverScreen.onNewGame(() => {
  tournament = null;
  if (loop) { loop.stop(); loop = null; }
  renderer.setGameAspect(null, null); // unlock aspect ratio while on menu
  SoundManager.stopAmbient();
  panel.show();
});

panel.onStart(cfg => {
  SoundManager.init();
  isDemo       = false;
  activeConfig = cfg;
  tournament        = null;
  _prevWeaponStocks = null;
  if (cfg.mode === 'target-practice') {
    startTPGame(cfg);
  } else if (cfg.mode === 'story') {
    panel.hide();
    storyScreen.showSelect();
  } else {
    startGame(cfg);
  }
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

const endTurnBtn = makeBtn('End Turn');
const weaponBtn  = makeBtn('CANNON ▲');
const moveBtn    = makeBtn('Move');
btnBar.append(moveBtn, weaponBtn, endTurnBtn);
document.body.appendChild(btnBar);

const weaponSelector = new WeaponSelector();
weaponSelector.setOnSelect(weaponId => { if (loop) loop.humanSelectWeapon(weaponId); });

const storyObjectivePanel = new StoryObjectivePanel();
const storyDialogPopup    = new StoryDialogPopup();
storyDialogPopup.setOnDismiss(() => { if (loop) loop.humanDismissDialog(); });
const storyScreen = new StoryModeScreen();
storyScreen.setOnStartMission(mission => startStoryMission(mission));
storyScreen.setOnClose(() => panel.show());

endTurnBtn.addEventListener('click', e => { e.stopPropagation(); SoundManager.play('uiClick'); if (loop) loop.humanFire(); });
weaponBtn.addEventListener('click',  e => {
  e.stopPropagation();
  if (!loop) return;
  SoundManager.play('uiClick');
  const gs = loop.gs;
  if (gs.mode === 'aiming' && gs.waitingForInput && gs.activeStation) {
    weaponSelector.toggle(gs.activeStation, weaponBtn, gs);
  }
});
moveBtn.addEventListener('click', e => { e.stopPropagation(); SoundManager.play('uiClick'); if (loop) loop.humanStartMove(); });
document.addEventListener('click', () => weaponSelector.close());

// ─── All-humans-eliminated overlay (Fast FWD + Skip) ─────────────────────────

const humanEliminatedBar = document.createElement('div');
Object.assign(humanEliminatedBar.style, {
  position: 'fixed', bottom: '14px', left: '50%',
  transform: 'translateX(-50%)',
  display: 'none', gap: '14px', zIndex: '10',
});
document.body.appendChild(humanEliminatedBar);

const fastFwdBtn = makeBtn('Fast FWD', 'rgba(60,40,10,0.85)');
const skipBtn    = makeBtn('Skip Round', 'rgba(60,10,10,0.85)');
humanEliminatedBar.append(fastFwdBtn, skipBtn);

fastFwdBtn.addEventListener('click', e => {
  e.stopPropagation();
  if (loop) { loop.humanFastFwd(); fastFwdBtn.style.opacity = '0.4'; fastFwdBtn.disabled = true; }
});
skipBtn.addEventListener('click', e => {
  e.stopPropagation();
  if (loop) loop.humanSkip(activeConfig.aiLevel ?? 3);
});

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
  const wasDemo = isDemo;
  isDemo = false;
  _hideDemoHint();
  if (wasDemo && loop) {
    // Demo: stop completely, never resume
    loop.stop(); loop = null;
    panel.setCanResume(false);
  } else if (loop) {
    // Real game: just pause so Resume can return to it
    if (!loop.isPaused) { loop.togglePause(); _menuPausedLoop = true; }
    panel.setCanResume(loop.gs.mode !== 'gameover');
  } else {
    panel.setCanResume(false);
  }
  gameOverBar.style.display = 'none';
  panel.show();
});
document.body.appendChild(menuBtn);

// ─── Fullscreen button (phones only) ─────────────────────────────────────────

const _FS_ENTER_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" style="display:block;pointer-events:none"><polyline points="3,9 3,3 9,3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><polyline points="15,3 21,3 21,9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><polyline points="21,15 21,21 15,21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><polyline points="9,21 3,21 3,15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;
const _FS_EXIT_SVG  = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" style="display:block;pointer-events:none"><polyline points="9,3 9,9 3,9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><polyline points="15,9 21,9 21,3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><polyline points="21,15 15,15 15,21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><polyline points="3,15 9,15 9,21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;

const fullscreenBtn = document.createElement('button');
Object.assign(fullscreenBtn.style, {
  position: 'fixed', top: '10px', right: '10px',
  display: 'none', // shown only when _isPhone() && supported
  background: 'rgba(10,10,25,0.6)', color: 'rgba(255,255,255,0.55)',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: '4px', padding: '6px 8px',
  cursor: 'pointer', zIndex: '10', lineHeight: '1',
});
document.body.appendChild(fullscreenBtn);

function _updateFsBtn() {
  const inFS = !!document.fullscreenElement;
  fullscreenBtn.innerHTML = inFS ? _FS_EXIT_SVG : _FS_ENTER_SVG;
  fullscreenBtn.title     = inFS ? 'Exit fullscreen' : 'Enter fullscreen (landscape)';
}

// Only show the button on phones that support the Fullscreen API
if (_isPhone() && document.fullscreenEnabled) {
  fullscreenBtn.style.display = 'block';
  _updateFsBtn();
}

fullscreenBtn.addEventListener('click', async e => {
  e.stopPropagation();
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      // Orientation lock is applied inside the fullscreenchange handler below
    } else {
      await document.exitFullscreen();
    }
  } catch (_) {}
});

document.addEventListener('fullscreenchange', () => {
  _updateFsBtn();
  if (document.fullscreenElement) {
    // Re-apply orientation lock every time we (re-)enter fullscreen
    applyOrientationSetting(panel.config.screenOrientation ?? 'auto').catch(() => {});
  }
});

// ─── Button visibility sync ───────────────────────────────────────────────────

let _prevMode  = null;
let _minimalUI = false;

function updateButtons(gs) {
  if (panel.isVisible) {
    storyObjectivePanel.hide();
    storyDialogPopup.update(null);
    return; // panel is open — don't show game UI on top of it
  }
  storyObjectivePanel.update(gs);
  storyDialogPopup.update(gs);
  if (!gs || isDemo) {
    btnBar.style.display             = 'none';
    gameOverBar.style.display        = 'none';
    humanEliminatedBar.style.display = 'none';
    aimControls.hide();
    return;
  }

  const isAiming   = (gs.mode === GameMode.AIMING || gs.mode === GameMode.TP_AIMING) && gs.waitingForInput;
  const isGameOver = gs.mode === GameMode.GAMEOVER;

  // All-humans-eliminated bar: show when game is ongoing but all human stations are gone
  const allHumansGone = (gs.mode === GameMode.AIMING || gs.mode === GameMode.FIRING) &&
    gs.teams.filter(t => t.isHuman).every(t => t.stations.every(s => s.status !== 'active')) &&
    gs.aliveTeams.length > 1;
  humanEliminatedBar.style.display = allHumansGone ? 'flex' : 'none';

  const isTP = gs.tpGame != null;
  // Frozen/electrified stations cannot be controlled — only End Turn stays active
  const conditionLocked     = (gs.activeStation?.frozen ?? 0) > 0 ||
                              (gs.activeStation?.electrified ?? 0) > 0;
  btnBar.style.display      = isAiming ? 'flex' : 'none';
  moveBtn.style.display     = (isAiming && gs.stationMovement && !isTP && !conditionLocked) ? 'inline-block' : 'none';
  weaponBtn.style.display   = (isTP || conditionLocked) ? 'none' : 'inline-block';
  if (gs.waitingForMove) {
    moveBtn.textContent       = 'Cancel Move';
    moveBtn.style.background  = 'rgba(80,40,170,0.85)';
  } else if (_minimalUI) {
    moveBtn.innerHTML         = _MOVE_SVG;
    moveBtn.style.background  = 'rgba(10,10,25,0.85)';
  } else {
    moveBtn.textContent       = 'Move';
    moveBtn.style.background  = 'rgba(10,10,25,0.85)';
  }
  gameOverBar.style.display = 'none';

  // AimControls: shown when aiming, not during move selection, not during hyperspace,
  // not when frozen/electrified
  const hyperspaceQueued = gs.activeStation?.hyperspaceQueued;
  if (isAiming && !gs.waitingForMove && !hyperspaceQueued && !conditionLocked) {
    aimControls.show();
    aimControls.update(gs.activeStation);
  } else {
    aimControls.hide();
  }

  // Weapon button label: refresh each frame so stock counts stay current
  if (isAiming && gs.activeStation) {
    weaponSelector.updateBtn(weaponBtn, gs.activeStation);
  } else {
    weaponBtn.textContent = 'CANNON ▲';
    weaponSelector.close();
  }

  // On first frame of STORY_DEBRIEF, save progress and show debrief screen
  if (gs.mode === GameMode.STORY_DEBRIEF && _prevMode !== GameMode.STORY_DEBRIEF) {
    humanEliminatedBar.style.display = 'none';
    if (loop) { loop.stop(); }
    const ss = gs.storyState;
    if (ss.passed) {
      let data = StoryPersistence.load();
      data = StoryPersistence.recordPass(ss.mission.id, ss.score, data, gs.config?.bulletPaths ?? 'off');
      StoryPersistence.save(data);
      if (StoryPersistence.isCampaignComplete(data)) panel.setCampaignComplete(true);
    }
    storyScreen.showDebrief(gs);
  }

  // On first frame of GAMEOVER, trigger end-of-game flow
  if (isGameOver && _prevMode !== GameMode.GAMEOVER) {
    humanEliminatedBar.style.display = 'none';
    _onGameOver(gs);
  }
  _prevMode = gs.mode;
}

// ─── Game-over handler ────────────────────────────────────────────────────────

function _onGameOver(gs) {
  if (isDemo) { startGame(DEMO_CONFIG); return; }
  lastGameState = gs;
  _menuPausedLoop = false;
  panel.setCanResume(false);

  const isTournament = activeConfig.mode === 'tournament';
  if (isTournament) {
    if (!tournament) tournament = new TournamentState();
    tournament.recordGame(gs);
    tournament.generateRewards(activeConfig, gs);
    // Snapshot weapon stocks so they carry into the next game. Any leftover
    // collectables (claim collectables setting) were already granted in-game at
    // the end of the round, so they are reflected in each team's weaponStock.
    _prevWeaponStocks = new Map(gs.teams.map(t => [t.index, new Map(t.weaponStock)]));
    // Apply per-game prize weapons into carry-over stocks
    if (tournament.lastRewards) {
      for (const { teamIndex, grants } of tournament.lastRewards) {
        const stocks = _prevWeaponStocks.get(teamIndex);
        if (stocks) {
          for (const g of grants) stocks.set(g.id, (stocks.get(g.id) ?? 0) + g.charges);
        }
      }
    }
    // Apply award ceremony prizes (every 5 games)
    if (tournament.shouldShowAwards()) {
      tournament.generateAwardPrizes(activeConfig);
      if (tournament.lastAwardPrizes) {
        for (const { teamIndex, grants } of tournament.lastAwardPrizes) {
          const stocks = _prevWeaponStocks.get(teamIndex);
          if (stocks) {
            for (const g of grants) stocks.set(g.id, (stocks.get(g.id) ?? 0) + g.charges);
          }
        }
      }
    }
    const limit   = activeConfig.tournamentGames;
    const isFinal = limit !== 'keepGoing' && tournament.gameIndex >= limit;
    gameOverScreen.show(gs, tournament, isFinal);
  } else {
    gameOverScreen.show(gs, null);
  }
}

// ─── Game factory ─────────────────────────────────────────────────────────────

let loop    = null;
let handler = null;

async function startGame(cfg) {
  _loadBar.show(0, 'Generating world...');
  await _yieldFrame();

  if (loop) { loop.stop(); loop = null; }
  _menuPausedLoop = false;
  panel.setCanResume(false);
  _prevMode = null;
  leaderboard.hide();

  renderer.setGameAspect(null, null); // unlock old ratio so resize measures the actual window
  renderer.resize(window.innerWidth, window.innerHeight);
  renderer.setPerformance(cfg.performance ?? 'full');
  renderer.clearTrails();

  // Apply per-game UI settings
  const AIM_SCALES = { smaller: 0.5, regular: 1, larger: 2, mammoth: 3 };
  renderer.setAimCircleScale(AIM_SCALES[cfg.aimCircleSize ?? 'regular'] ?? 1);
  renderer.setBulletPathLength(cfg.bulletPaths ?? 'off');

  _minimalUI = cfg.minimalUI ?? false;
  aimControls.setMinimal(_minimalUI);
  weaponSelector.setMinimal(_minimalUI);
  if (_minimalUI) {
    endTurnBtn.innerHTML   = _ENDTURN_SVG;
    endTurnBtn.style.padding = '9px 14px';
    weaponBtn.style.fontSize = '11px';
  } else {
    endTurnBtn.textContent   = 'End Turn';
    endTurnBtn.style.padding = '9px 26px';
    weaponBtn.style.fontSize = '15px';
  }
  weaponBtn.style.padding = _minimalUI ? '9px 12px' : '9px 18px';
  applyOrientationSetting(cfg.screenOrientation ?? 'auto');

  // Reset Fast FWD button state
  fastFwdBtn.disabled      = false;
  fastFwdBtn.style.opacity = '1';

  const gw  = renderer.gameWidth;
  const gh  = renderer.gameHeight;
  renderer.setGameAspect(gw, gh); // lock new ratio for letterboxing on resize
  const rng = new RNG(RNG.randomSeed());

  const size = StationSize[cfg.stationSize] ?? StationSize.LARGE;

  // Every game gets a seed — generate one if the player didn't type one.
  // The seed fully determines scenario + planet layout; typing it back replays the exact map.
  const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const rawSeed   = (cfg.overrideSeed ?? '').trim();
  const activeSeed = rawSeed
    || Array.from({ length: 8 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('');

  if (!rawSeed) panel.setGeneratedSeed(activeSeed);

  const layoutRng = new RNG(hashString(activeSeed.toLowerCase()));
  const scenarioId = getUrlScenario() ?? (cfg.scenarioId > 0 ? cfg.scenarioId : weightedRandomId(layoutRng));
  const isHeavy    = [2, 3, 16, 17].includes(scenarioId);
  const nPlanets   = isHeavy
    ? (cfg.performance === 'simplified' ? 20 : 30)
    : layoutRng.nextInt(18) + 3;

  const { planets, rifts, isExtreme, wildcardDesc, wildcardCollectablePositions } = ScenarioFactory.create(scenarioId, gw, gh, nPlanets, layoutRng, cfg.wildcardFrequency ?? 'rare', cfg.performance ?? 'full', cfg.collectables ?? 'off', cfg.richAsteroids ?? 'normal', cfg.forceExtreme ?? false, cfg.pureRate ?? 'default');

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
  ScenarioFactory.placeStations(teams, planets, gw, gh, size, rng, cfg.teamClustering ?? 'off', rifts);

  // Restore weapon stocks carried over from the previous tournament game
  if (_prevWeaponStocks) {
    for (const team of teams) {
      const prev = _prevWeaponStocks.get(team.index);
      if (prev) {
        for (const [weaponId, count] of prev) {
          if (count > 0) team.addStock(weaponId, count);
        }
      }
    }
  }

  _applyStartingWeapons(teams, cfg, rng);
  _applyStartingArmour(teams, cfg);

  _loadBar.update(45, 'Placing stars...');
  await _yieldFrame();

  const stars = Renderer.generateStarField(gw, gh, cfg.performance === 'simplified' ? 1000 : undefined);

  _loadBar.update(70, 'Rendering...');
  await _yieldFrame();

  renderer.drawBackground(stars, planets, rifts, { noStarField: scenarioId === 26, tunnelBackground: scenarioId === 34 });

  _loadBar.update(82, 'Loading sounds...');
  await SoundManager.preload(pct => _loadBar.update(82 + Math.round(pct * 10), 'Loading sounds...'));

  const gameState = new GameState({ planets, rifts, teams, config: { ...cfg, scenarioId, isExtreme, wildcardDesc }, movementSpeed: cfg.movementSpeed ?? 'off' });
  if (wildcardCollectablePositions?.length) {
    const colSizes = { tiny: 2.5, medium: 5, large: 7.5, huge: 10, mammoth: 15 };
    const colR = colSizes[cfg.collectableSize ?? 'medium'] ?? 5;
    for (const pos of wildcardCollectablePositions) {
      const col = new Collectable(pos);
      col.radius = colR;
      gameState.collectables.push(col);
    }
  }
  const physics   = new PhysicsEngine(gw, gh);
  if (scenarioId === 26) physics.periodicBoundary = true;

  for (const team of teams.filter(t => !t.isHuman)) {
    team.controller = AIController.create(cfg.aiLevel ?? 3, physics);
  }

  _loadBar.update(95, 'Starting...');
  await _yieldFrame();

  const _smCfg = panel.getData();
  SoundManager.setEnabled(_smCfg.soundEnabled ?? true);
  SoundManager.setMasterVolume(SOUND_VOL_GAIN[_smCfg.masterVolume  ?? 'low']);
  SoundManager.setAmbientVolume(SOUND_VOL_GAIN[_smCfg.ambientVolume ?? 'medium']);

  loop = new GameLoop({ gameState, physics, renderer, rng, speed: cfg.speed ?? 'normal', performance: cfg.performance ?? 'full' });
  aimControls.setLoop(loop);

  renderer.drawFrame = gs => {
    if (gs?.tpGame && (gs.mode === 'tp_aiming' || gs.mode === 'tp_firing')) {
      renderer.setTPVisibleTeam(gs.activeStation?.team?.index ?? null);
    } else {
      renderer.setTPVisibleTeam(null);
    }
    _baseDrawFrame(gs);
    updateButtons(gs);
  };

  handler = new InputHandler({ canvas, loop, renderer });
  loop.start();
  SoundManager.startAmbient();
  _loadBar.hide();

  updateButtons(gameState);
}

// ─── Story Mode ──────────────────────────────────────────────────────────────

let _currentStoryMission = null;

async function startStoryMission(mission) {
  _loadBar.show(0, 'Loading mission...');
  await _yieldFrame();

  if (loop) { loop.stop(); loop = null; }
  _menuPausedLoop      = false;
  _prevMode            = null;
  _currentStoryMission = mission;
  panel.setCanResume(false);
  leaderboard.hide();
  storyScreen.hide();

  resetStoryStationId();

  renderer.setGameAspect(null, null);
  renderer.resize(window.innerWidth, window.innerHeight);
  renderer.setPerformance('full');
  renderer.clearTrails();
  renderer.setTPVisibleTeam(null);
  renderer.setAimCircleScale(1);
  renderer.setBulletPathLength(panel.getData().bulletPaths ?? 'off');

  _minimalUI = false;
  aimControls.setMinimal(false);
  endTurnBtn.textContent   = 'End Turn';
  endTurnBtn.style.padding = '9px 26px';
  weaponBtn.style.padding  = '9px 18px';

  fastFwdBtn.disabled      = false;
  fastFwdBtn.style.opacity = '1';

  const gw  = renderer.gameWidth;
  const gh  = renderer.gameHeight;
  renderer.setGameAspect(gw, gh);

  const physics  = new PhysicsEngine(gw, gh);
  const rng      = new RNG(RNG.randomSeed());
  const { gs: gameState, teams } = buildStoryMission(mission, physics, rng);
  gameState.config.bulletPaths = panel.getData().bulletPaths ?? 'off';

  _loadBar.update(45, 'Placing stars...');
  await _yieldFrame();

  const stars = Renderer.generateStarField(gw, gh, panel.getData().performance === 'simplified' ? 1000 : undefined);

  _loadBar.update(70, 'Rendering...');
  await _yieldFrame();

  renderer.drawBackground(stars, gameState.planets);

  _loadBar.update(82, 'Loading sounds...');
  await SoundManager.preload(pct => _loadBar.update(82 + Math.round(pct * 10), 'Loading sounds...'));

  _loadBar.update(95, 'Starting...');
  await _yieldFrame();

  const _smCfg = panel.getData();
  SoundManager.setEnabled(_smCfg.soundEnabled ?? true);
  SoundManager.setMasterVolume(SOUND_VOL_GAIN[_smCfg.masterVolume  ?? 'low']);
  SoundManager.setAmbientVolume(SOUND_VOL_GAIN[_smCfg.ambientVolume ?? 'medium']);

  loop = new GameLoop({ gameState, physics, renderer, rng, speed: mission.settings.gameSpeed ?? 'normal', performance: 'full' });
  aimControls.setLoop(loop);

  renderer.drawFrame = gs => {
    renderer.setTPVisibleTeam(null);
    _baseDrawFrame(gs);
    updateButtons(gs);
  };

  handler = new InputHandler({ canvas, loop, renderer });
  loop.start();
  SoundManager.startAmbient();
  _loadBar.hide();

  updateButtons(gameState);
}

// ─── Target Practice ─────────────────────────────────────────────────────────

const MAX_TP_REROLLS = 6;

async function startTPGame(cfg) {
  _loadBar.show(0, 'Generating world...');
  await _yieldFrame();

  if (loop) { loop.stop(); loop = null; }
  _menuPausedLoop = false;
  panel.setCanResume(false);
  _prevMode = null;
  leaderboard.hide();

  renderer.setGameAspect(null, null);
  renderer.resize(window.innerWidth, window.innerHeight);
  renderer.setPerformance(cfg.performance ?? 'full');
  renderer.clearTrails();
  renderer.setTPVisibleTeam(null);

  const AIM_SCALES = { smaller: 0.5, regular: 1, larger: 2, mammoth: 3 };
  renderer.setAimCircleScale(AIM_SCALES[cfg.aimCircleSize ?? 'regular'] ?? 1);
  renderer.setBulletPathLength(cfg.bulletPaths ?? 'off');
  _minimalUI = cfg.minimalUI ?? false;
  aimControls.setMinimal(_minimalUI);
  endTurnBtn.textContent   = _minimalUI ? 'X' : 'End Turn';
  endTurnBtn.style.padding = _minimalUI ? '9px 14px' : '9px 26px';

  const gw  = renderer.gameWidth;
  const gh  = renderer.gameHeight;
  renderer.setGameAspect(gw, gh);

  const rng        = new RNG(RNG.randomSeed());
  const tpSize     = StationSize[cfg.tpSize ?? 'MEDIUM'] ?? StationSize.MEDIUM;
  const N          = cfg.tpTargets ?? 5;
  const rounds     = cfg.tpRounds  ?? 5;
  const includeAI  = cfg.tpIncludeAI ?? false;

  // Build teams (only human teams if includeAI is off)
  const nP = cfg.numPlayers;
  const nH = Math.min(cfg.numHuman ?? 1, nP);
  const nTeams = includeAI ? nP : Math.max(1, nH);
  const teams = [];
  for (let i = 0; i < nTeams; i++) {
    teams.push(new Team({ index: i, isHuman: includeAI ? i < nH : true }));
  }
  let stationId = 0;
  for (const team of teams) {
    for (let s = 0; s < (cfg.stationsPerPlayer ?? 1); s++) {
      team.stations.push(new Station({ id: stationId++, team, position: new Vec2(0, 0), size: tpSize }));
    }
  }

  // Attach AI controllers for AI teams
  if (includeAI) {
    const physics0 = new PhysicsEngine(gw, gh);
    for (const team of teams.filter(t => !t.isHuman)) {
      team.controller = AIController.create(cfg.aiLevel ?? 3, physics0);
    }
  }

  // Try to build a valid map with rerolls
  const targetRadius = (StationSize[cfg.tpSize ?? 'MEDIUM'] ?? StationSize.MEDIUM).radius * 2.5;
  let planets, side, selectedTargets;
  let rerolls = 0;

  while (rerolls <= MAX_TP_REROLLS) {
    const scenarioPool = TARGET_PRACTICE_SCENARIOS;
    const scenarioId   = scenarioPool[Math.floor(rng.next() * scenarioPool.length)];
    const nPlanets     = rng.nextInt(6) + 3;
    ({ planets } = ScenarioFactory.create(scenarioId, gw, gh, nPlanets, rng,
      cfg.wildcardFrequency ?? 'rare', cfg.performance ?? 'full', 'off', 'off'));

    // Place stations on one edge
    side = TargetPracticeSetup.placeStations(teams, planets, gw, gh, rng);

    // Attempt to place 2N targets
    const effectiveN = rerolls >= MAX_TP_REROLLS ? Math.max(1, Math.floor(N / 2)) : N;
    const candidates = TargetPracticeSetup.placeTargets(effectiveN, targetRadius, planets, gw, gh, side, rng);

    if (candidates) {
      // Run feasibility
      const physicsForSim = new PhysicsEngine(gw, gh);
      const allStations   = teams.flatMap(t => t.stations);
      const ranked        = TargetPracticeSetup.runFeasibility(allStations, candidates, planets, physicsForSim);
      selectedTargets     = ranked.slice(0, effectiveN);
      break;
    }
    rerolls++;
  }

  // Draw background
  _loadBar.update(45, 'Placing stars...');
  await _yieldFrame();

  const stars = Renderer.generateStarField(gw, gh, cfg.performance === 'simplified' ? 1000 : undefined);

  _loadBar.update(70, 'Rendering...');
  await _yieldFrame();

  renderer.drawBackground(stars, planets, []);

  // Build game state
  const gameState = new GameState({ planets, teams, config: { ...cfg }, movementSpeed: 'off' });
  const physics   = new PhysicsEngine(gw, gh);

  // Wire AI controllers into the game state (reuse the ones we built)
  if (includeAI) {
    for (const team of teams.filter(t => !t.isHuman)) {
      team.controller = AIController.create(cfg.aiLevel ?? 3, physics);
    }
  }

  // Build TargetPracticeGame
  const stationList = teams.flatMap(t => t.stations);
  gameState.tpGame  = new TargetPracticeGame({ targets: selectedTargets, totalRounds: rounds, stationList, teams });

  _loadBar.update(95, 'Starting...');
  await _yieldFrame();

  loop = new GameLoop({ gameState, physics, renderer, rng, speed: cfg.speed ?? 'normal', performance: cfg.performance ?? 'full' });
  loop.setTPResultsCallback(() => {
    tpResultsScreen.show(gameState);
  });
  aimControls.setLoop(loop);

  renderer.drawFrame = gs => {
    if (gs?.tpGame && (gs.mode === 'tp_aiming' || gs.mode === 'tp_firing')) {
      renderer.setTPVisibleTeam(gs.activeStation?.team?.index ?? null);
    } else {
      renderer.setTPVisibleTeam(null);
    }
    _baseDrawFrame(gs);
    updateButtons(gs);
  };

  handler = new InputHandler({ canvas, loop, renderer });
  loop.startTP();
  loop.start();
  _loadBar.hide();

  updateButtons(gameState);
}

// ─── Starting weapons ────────────────────────────────────────────────────────

const _ALL_SPECIAL = [
  WeaponId.TRIPLE_CANNON, WeaponId.BLUNDERBUSS, WeaponId.LASER,
  WeaponId.ROCKET, WeaponId.ROCKET_POD, WeaponId.BLASTER, WeaponId.MINIGUN, WeaponId.FORCE_SHIELD,
  WeaponId.SEPTUPLE_CANNON, WeaponId.ANTIMATTER_LASER, WeaponId.FRAGMENTATION_SHOT,
  WeaponId.SHOTGUN, WeaponId.DUAL_BLASTER,
  WeaponId.BOUNCE_CANNON, WeaponId.AUTO_CANNON, WeaponId.STAR_SHOT,
  WeaponId.SCATTER_CANNON, WeaponId.SPIRAL,
  WeaponId.RESUPPLY, WeaponId.HEDGEHOG, WeaponId.TEAM_SHIELD,
  WeaponId.ARMOUR, WeaponId.REPULSOR_FIELD, WeaponId.MAMMOTH_CANNON,
  WeaponId.QUANTUM_TORPEDO, WeaponId.TRIPLE_QUANTUM_TORPEDO,
  WeaponId.QUANTUM_AUTO_CANNON, WeaponId.GRAVITY_CANNON,
  WeaponId.ELECTRO_STUN, WeaponId.TELEPORT, WeaponId.SUPER_LASER,
  WeaponId.REINFORCEMENT_SIGNAL, WeaponId.MIND_CONTROL_BEAM,
];

function _applyStartingWeapons(teams, cfg, rng) {
  const sw = cfg.startingWeapons ?? 'none';
  if (sw === 'none') return;

  // Minimum stock per weapon (null = not specified) — each game tops teams
  // back up to these counts; stock carried over a tournament counts first.
  const minimums =
    // Player-visible loadouts
      sw === 'basic'      ? { [WeaponId.TRIPLE_CANNON]: 1, [WeaponId.FORCE_SHIELD]: 1 }
    : sw === 'marines'    ? { [WeaponId.BLASTER]: 2, [WeaponId.BLUNDERBUSS]: 2 }
    : sw === 'demolition' ? { [WeaponId.ROCKET]: 3, [WeaponId.ROCKET_POD]: 1, [WeaponId.FORCE_SHIELD]: 2 }
    : sw === 'quantum'    ? { [WeaponId.QUANTUM_TORPEDO]: 5, [WeaponId.FORCE_SHIELD]: 2 }
    : sw === 'dambusters' ? { [WeaponId.BOUNCE_CANNON]: Infinity }
    // Dev-only tiers
    : sw === 'minor'      ? { [WeaponId.TRIPLE_CANNON]: 2 }
    : sw === 'oneOfEach'  ? Object.fromEntries(_ALL_SPECIAL.map(w => [w, 1]))
    : sw === 'lots'       ? Object.fromEntries(_ALL_SPECIAL.map(w => [w, 3]))
    : sw === 'tooMany'    ? Object.fromEntries(_ALL_SPECIAL.map(w => [w, 7]))
    : null; // 'luckyDip' / 'one' handled separately

  for (const team of teams) {
    if (sw === 'luckyDip') {
      // One random collectable pickup per game — same tier weighting as map
      // drops (80/16/4) and same charge count as collecting it in play
      const r    = rng.next();
      const tier = r < 0.80 ? 1 : r < 0.96 ? 2 : 3;
      const pool = WEAPON_GRANTS.filter(g => g.tier === tier);
      const g    = pool[Math.floor(rng.next() * pool.length)];
      team.addStock(g.id, g.charges);
    } else if (sw === 'one') {
      // Always add one random weapon regardless of existing stock
      const w = _ALL_SPECIAL[Math.floor(rng.next() * _ALL_SPECIAL.length)];
      team.addStock(w, 1);
    } else if (minimums) {
      // Top up to minimum — if already at or above minimum, add nothing
      for (const [w, min] of Object.entries(minimums)) {
        const have = team.getStock(w);
        if (have < min) team.addStock(w, min - have);
      }
    }
  }
}

const _STARTING_ARMOUR_LAYERS = { none: 0, light: 1, medium: 2, heavy: 3 };

function _applyStartingArmour(teams, cfg) {
  const layers = _STARTING_ARMOUR_LAYERS[cfg.startingArmour ?? 'none'] ?? 0;
  if (layers <= 0) return;
  for (const team of teams) {
    for (const station of team.stations) station.armourLayers = layers;
  }
}

// ─── Loading bar ─────────────────────────────────────────────────────────────

const _loadBar = (() => {
  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.82)',
    display: 'none', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    fontFamily: 'monospace', zIndex: '200',
  });
  const label = document.createElement('div');
  Object.assign(label.style, {
    color: 'rgba(150,170,255,0.7)', fontSize: '12px',
    letterSpacing: '0.12em', marginBottom: '14px',
  });
  const track = document.createElement('div');
  Object.assign(track.style, {
    width: '240px', height: '3px',
    background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden',
  });
  const fill = document.createElement('div');
  Object.assign(fill.style, {
    height: '100%', background: 'rgba(100,140,255,0.85)',
    width: '0%', transition: 'width 0.12s ease',
  });
  track.appendChild(fill);
  overlay.append(label, track);
  document.body.appendChild(overlay);
  return {
    show(pct, text) { label.textContent = text; fill.style.width = `${pct}%`; overlay.style.display = 'flex'; },
    update(pct, text) { if (text) label.textContent = text; fill.style.width = `${pct}%`; },
    hide() { overlay.style.display = 'none'; fill.style.width = '0%'; },
  };
})();

const _yieldFrame = () => new Promise(r => setTimeout(r, 0));

// ─── Demo title + hint overlay ───────────────────────────────────────────────

function _showDemoHint() {
  // Title block — "DEATH STAR BATTLES" + author
  let titleEl = document.getElementById('demo-title');
  if (!titleEl) {
    titleEl = document.createElement('div');
    titleEl.id = 'demo-title';
    Object.assign(titleEl.style, {
      position: 'fixed', top: '28%', left: '50%',
      transform: 'translateX(-50%)',
      textAlign: 'center',
      pointerEvents: 'none', userSelect: 'none',
      zIndex: '5',
    });

    const titleLine = document.createElement('div');
    titleLine.textContent = 'Death Star Battles';
    Object.assign(titleLine.style, {
      fontFamily: 'monospace',
      fontSize: 'clamp(26px, 5vw, 62px)',
      letterSpacing: '0.22em',
      color: '#000',
      textShadow: [
        '-1px -1px 0 #fff', '1px -1px 0 #fff',
        '-1px  1px 0 #fff', '1px  1px 0 #fff',
        '0 0 12px rgba(255,255,255,0.95)',
        '0 0 35px rgba(220,230,255,0.70)',
        '0 0 70px rgba(180,200,255,0.35)',
      ].join(', '),
      marginBottom: '10px',
    });

    const authorLine = document.createElement('div');
    authorLine.textContent = 'By Chloe Bolland';
    Object.assign(authorLine.style, {
      fontFamily: 'monospace',
      fontSize: 'clamp(12px, 1.4vw, 18px)',
      letterSpacing: '0.18em',
      color: '#000',
      textShadow: '0 0 8px rgba(255,255,255,0.9), 0 0 20px rgba(220,230,255,0.55)',
    });

    titleEl.appendChild(titleLine);
    titleEl.appendChild(authorLine);
    document.body.appendChild(titleEl);
  }
  titleEl.style.display = 'block';

  // "Click to start" hint at the bottom
  let hint = document.getElementById('demo-hint');
  if (!hint) {
    hint = document.createElement('div');
    hint.id = 'demo-hint';
    Object.assign(hint.style, {
      position: 'fixed', bottom: '38px', left: '50%',
      transform: 'translateX(-50%)',
      color: 'rgba(200,210,255,0.55)', fontFamily: 'monospace', fontSize: '13px',
      letterSpacing: '0.1em', pointerEvents: 'none', userSelect: 'none',
      zIndex: '5',
    });
    document.body.appendChild(hint);
  }
  hint.textContent = (_isPhone() && document.fullscreenEnabled)
    ? 'TAP TO PLAY'
    : 'CLICK OR PRESS ANY KEY TO START';
  hint.style.display = 'block';
}

function _hideDemoHint() {
  const hint  = document.getElementById('demo-hint');
  if (hint)  hint.style.display  = 'none';
  const title = document.getElementById('demo-title');
  if (title) title.style.display = 'none';
}

// ─── Demo mode ────────────────────────────────────────────────────────────────

const DEMO_CONFIG = {
  numPlayers: 5, numHuman: 0, stationsPerPlayer: 2,
  aiLevel: 3, stationSize: 'LARGE', numPlanets: -1, scenarioId: 10,
  teamClustering: 'off', wildcardFrequency: 'rare',
};

function startDemo() {
  isDemo = true;
  leaderboard.hide();
  _showDemoHint();
  startGame(DEMO_CONFIG);

  function onFirstInteraction(e) {
    if (!isDemo) return;
    isDemo = false;
    _hideDemoHint(); // always hide before any early return
    if (e.target?.closest?.('#btn-bar')) return;
    // Request fullscreen immediately while we're still inside the user gesture.
    // Must happen before any await / async gap or browsers will reject it.
    if (_isPhone() && document.fullscreenEnabled && !document.fullscreenElement) {
      document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
    }
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
  return (s >= 1 && s <= SCENARIO_COUNT) ? s : null;
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

let _devMode = false;

function _toggleDevMode() {
  _devMode = !_devMode;
  panel.setDevMode(_devMode);
  storyScreen.setDevMode(_devMode);
  renderer.setDebugMode(_devMode);
}

window.addEventListener('keydown', e => {
  // Ctrl+Shift+D — toggle developer mode (reveals debug options in config panel)
  if (e.ctrlKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
    e.preventDefault();
    _toggleDevMode();
    return;
  }
  if (!loop || isDemo) return;
  if (e.key === 'p' || e.key === 'P') loop.togglePause();
  if (e.key === 'o' || e.key === 'O') loop.stepOne();
});

window.addEventListener('resize', () => {
  renderer.resize(window.innerWidth, window.innerHeight);
  // Re-draw any in-flight bullet trails (canvas was cleared by resize)
  if (loop && loop.gs.activeBullets.length > 0) {
    renderer.redrawTrails(loop.gs.activeBullets);
  }
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

startDemo();
