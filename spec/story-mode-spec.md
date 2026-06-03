# Story Mode — Engineering Spec

> Companion to the design spec in `requirements.md §13`. This document describes the implementation: which files change, which classes are added, and how each mechanic maps to engine code. Resolve open questions in `story-mode-questions.md` before starting.

---

## 1. Scope

Story Mode is accessed via the **Mode** selector in `ConfigPanel` (alongside Single Game and Tournament). Selecting it shows the Story Mode screen in place of the normal game controls. It reuses the core physics engine, `GameLoop`, and `Renderer` without modification, but adds a data-driven setup layer that configures each mission from a static declaration array, new UI screens for mission select / briefing / debrief, an in-game objective panel, a mid-turn event dispatch system, and `localStorage` persistence for unlock state and scores.

**Out of scope for this feature:**
- Save/resume of mid-mission state
- Multiplayer or tournament mode integration

---

## 2. New `GameMode` Values

Add four new modes to the `GameMode` freeze in `src/core/GameState.js`:

```js
STORY_SELECT:    'story_select',    // mission select screen
STORY_BRIEFING:  'story_briefing',  // pre-mission briefing overlay
STORY_DEBRIEF:   'story_debrief',   // post-mission debrief overlay
STORY_DIALOG:    'story_dialog',    // mid-game event dialog popup (pauses the game loop)
```

`STORY_DIALOG` is a transient overlay mode: while active the `GameLoop._advance()` skips all physics processing (same as `GAMEOVER`). Dismissing the dialog restores the previous mode.

---

## 3. File Map

### New files

| File | Purpose |
|---|---|
| `src/story/StoryMissions.js` | `STORY_MISSIONS` constant array — all 20 mission definitions |
| `src/story/StoryModeState.js` | `StoryModeState` class — runtime story state (objectives, progress, events) |
| `src/ui/StoryModeScreen.js` | DOM UI for mission select, briefing overlay, debrief overlay |
| `src/ui/StoryObjectivePanel.js` | In-game HUD overlay panel for objectives + turn counter |
| `src/ui/StoryDialogPopup.js` | Modal dialog for mid-mission event text |

### Modified files

| File | Changes |
|---|---|
| `src/core/GameState.js` | Add 4 new `GameMode` values; add `storyState` field |
| `src/core/GameLoop.js` | Add story mode hooks: event dispatch, objective check, fail check, collectable weapon override, cannon guard |
| `src/entities/Station.js` | Add `role` field (`"human"/"target"/"ai"`), `visualStyle` field (`"station"/"drone"`) |
| `src/entities/Collectable.js` | Add `WEAPON_GRANTS` story override; add `cannonEnabled` guard |
| `src/entities/Team.js` | `addStartingWeapons(weaponMap)` helper method |
| `src/rendering/Renderer.js` | Render `visualStyle: "drone"` stations with angular shape; render objective panel |
| `src/main.js` | Mount `StoryModeScreen`; wire story entry point from main menu |

---

## 4. `StoryMissions.js`

```js
// src/story/StoryMissions.js

export const STORY_MISSIONS = [
  {
    id: 'm1-training',
    title: 'Basic Training',
    story: '...',   // 2-4 sentence string

    layout: {
      planets:     [...],  // PlanetDef[]
      stations:    [...],  // StationDef[]
      collectables:[...],  // CollectableDef[] — only for collectablesSpawn:"fixed"
    },

    settings: {
      stationSize:          'large',    // key of StationSize
      gameSpeed:            'normal',   // key of SPEED_STEPS in GameLoop
      movementSpeed:        'off',      // GameState.movementSpeed value
      collectablesSpawn:    'off',      // 'off' | 'fixed' | 'normal'
      collectableWeapon:    null,       // WeaponId string | null
      cannonEnabled:        true,       // false removes cannon from weapon list
      startingWeapons:      {},         // { [WeaponId]: count } for human team
      enemyStartingWeapons: {},         // { [WeaponId]: count } for all AI teams
    },

    objectives: [
      { type: 'destroy_all' },
      // or: { type: 'destroy_n', params: { count: 5 } }
      // or: { type: 'collect_n',  params: { count: 10 } }
    ],

    failConditions: [
      // { type: 'max_turns', turns: 15 }
    ],

    events: [
      // {
      //   turn: 3,
      //   spawnStations: [{ x: null, y: null, team: 1, role: 'ai', aiLevel: 3,
      //                     visualStyle: 'drone', startingWeapons: { rocket: 99 } }],
      //   dialog: '...',
      //   addObjectives: [{ type: 'destroy_all' }],
      // }
    ],

    scoring: {
      formula:      'target_practice',  // see §13.7
      passingScore: 500,
    },
  },
  // ... missions 2-20
];
```

**PlanetDef schema:**
```js
{ type: PlanetType, x: float, y: float, radius: float, density: float }
```
`x` and `y` are normalised 0–1 canvas positions. `PhysicsEngine` width/height multiply out to game units at setup time.

**StationDef schema:**
```js
{
  x: float,           // normalised 0–1; or null for event-spawned stations
  y: float,
  team: number,       // 0 = human, 1+ = enemy
  role: 'human' | 'target' | 'ai',
  aiLevel: number,    // 1-5; only for role:'ai'
  visualStyle: 'station' | 'drone',
}
```

**CollectableDef schema:**
```js
{ x: float, y: float }   // normalised 0–1
```

**Missions with `scenario`-based planet layout** (M5–M11, M14–M20): instead of `layout.planets`, these missions may specify `{ scenarioId: number }` inside `layout`. The setup builder calls `ScenarioFactory.build(scenarioId, rng, physics)` and uses the returned planet array. Both forms must be supported by the setup builder.

---

## 5. `StoryModeState` Class

```js
// src/story/StoryModeState.js

export class StoryModeState {
  constructor(mission) {
    this.mission        = mission;           // the STORY_MISSIONS entry
    this.objectives     = [...mission.objectives]; // active objective list (may grow via events)
    this.objectiveMet   = new Array(mission.objectives.length).fill(false);
    this.firedEvents    = new Set();         // event turn numbers already fired
    this.collectCount   = 0;                 // total collectables collected this mission
    this.passed         = false;             // set true when debrief shows COMPLETE
    this.failed         = false;
    this.score          = 0;
  }

  get allObjectivesMet() {
    return this.objectiveMet.every(Boolean);
  }

  // Called by GameLoop when a new objective is added mid-game (events)
  addObjective(obj) {
    this.objectives.push(obj);
    this.objectiveMet.push(false);
  }

  // Called by GameLoop after each resolution phase to re-evaluate all objectives
  evaluate(gs) {
    for (let i = 0; i < this.objectives.length; i++) {
      const obj = this.objectives[i];
      switch (obj.type) {
        case 'destroy_all':
          this.objectiveMet[i] = gs.teams
            .filter((_, ti) => ti !== 0)
            .every(t => !t.isAlive);
          break;
        case 'destroy_n':
          this.objectiveMet[i] = gs.teams[0].stats.kills >= obj.params.count;
          break;
        case 'collect_n':
          this.objectiveMet[i] = this.collectCount >= obj.params.count;
          break;
      }
    }
  }

  // Compute final score based on the mission's scoring formula
  computeScore(gs, turnsUsed) {
    const f = this.mission.scoring.formula;
    const humanTeam = gs.teams[0];
    const kills     = humanTeam.stats.kills;
    const survived  = humanTeam.stations.filter(s => s.status === 'active').length;

    switch (f) {
      case 'target_practice':
        // Delegates to TargetPractice scoring — see TargetPracticeResultsScreen for formula
        return this._tpScore(gs);
      case 'turns_remaining': {
        const maxTurns = this.mission.failConditions.find(f => f.type === 'max_turns')?.turns ?? 20;
        return Math.max(0, (maxTurns - turnsUsed) * 100);
      }
      case 'collectables_score':
        return Math.max(0, this.collectCount * 200 - turnsUsed * 10);
      case 'combat_efficiency':
        return kills * 200 + survived * 100 - turnsUsed * 5;
      default:
        return 0;
    }
  }

  _tpScore(gs) {
    // Mirror the target_practice formula used in TargetPracticeResultsScreen.
    // Human team stations sum their hits and shots, then apply the TP scoring function.
    const humanStations = gs.teams[0].stations;
    let totalHits  = 0;
    let totalShots = 0;
    for (const s of humanStations) {
      totalHits  += s.stats.kills;   // kills = targets destroyed in story missions
      totalShots += s.stats.shots;
    }
    if (totalShots === 0) return 0;
    const hitRate = totalHits / (totalShots || 1);
    return Math.round(hitRate * 2000 - totalShots * 5);
  }
}
```

**`GameState` additions** (`src/core/GameState.js`):
```js
this.storyState = null;   // StoryModeState | null — non-null during a story mission
this.storyDialogText = null;  // string | null — pending dialog text to display
this._storyPrevMode  = null;  // GameMode to restore after dialog is dismissed
```

---

## 6. Station Changes (`src/entities/Station.js`)

Add two fields to the `Station` constructor:

```js
this.role        = 'human';    // 'human' | 'target' | 'ai'
this.visualStyle = 'station';  // 'station' | 'drone'
```

**Target station behaviour** (`role: 'target'`):
- Never enters the aiming phase turn order
- `team.isHuman` remains false; controller is `null`
- AI action in `GameLoop._advanceAiming()`: when `role === 'target'`, skip action computation and set `selectedWeapon = WeaponId.HYPERSPACE` (effectively does nothing — Hyperspace is ignored in the firing phase per existing logic, so the station sits still)

Add a guard in `GameLoop._advanceAiming()`:
```js
if (station.role === 'target') {
  station.selectedWeapon = WeaponId.HYPERSPACE;
  this._turnIdx++;
  continue;
}
```

**Drone visual style** — handled by `Renderer`; no behaviour change.

---

## 7. `GameLoop` Changes

### 7.1 Event Dispatch — `_processStoryEvents()`

Called at the start of `_startTurn()` (before the aiming phase begins), so events fire at the turn boundary:

```js
_processStoryEvents() {
  const ss = this.gs.storyState;
  if (!ss) return;

  for (const event of ss.mission.events ?? []) {
    if (ss.firedEvents.has(event.turn)) continue;
    if (this.gs.turn !== event.turn) continue;

    ss.firedEvents.add(event.turn);

    // Spawn stations
    for (const def of event.spawnStations ?? []) {
      const station = this._buildStoryStation(def, this.gs);
      const team    = this.gs.teams[def.team];
      if (!team) continue;
      team.stations.push(station);
      if (def.startingWeapons) team.addStartingWeapons(def.startingWeapons);
      // Hyperspace-style materialise animation
      station.hyperspaceFlash = { t: 0, oldPos: station.position, newPos: station.position };
    }

    // Add objectives
    for (const obj of event.addObjectives ?? []) {
      ss.addObjective(obj);
    }

    // Queue dialog popup (pauses the loop until dismissed)
    if (event.dialog) {
      this.gs.storyDialogText  = event.dialog;
      this.gs._storyPrevMode   = this.gs.mode;
      this.gs.mode             = GameMode.STORY_DIALOG;
    }
  }
}
```

`_buildStoryStation(def, gs)` constructs a `Station` instance from a `StationDef`, placing at `(def.x ?? random, def.y ?? random) × (gw, gh)`. For `null` positions, uses the same random-valid-placement loop as `_processHyperspace()`.

### 7.2 Objective Checking — `_checkStoryObjectives()`

Called at the end of `_advanceResults()` after `_checkWin()`:

```js
_checkStoryObjectives() {
  const ss = this.gs.storyState;
  if (!ss || ss.passed || ss.failed) return;

  ss.evaluate(this.gs);

  // Check combat implicit fail: human team wiped out, enemies remain
  const humanAlive = this.gs.teams[0]?.isAlive;
  const enemiesExist = this.gs.teams.slice(1).some(t => t.isAlive);
  if (!humanAlive && enemiesExist) {
    ss.failed = true;
    this.gs.mode = GameMode.STORY_DEBRIEF;
    return;
  }

  if (ss.allObjectivesMet) {
    // Objectives met = pass. Score is a leaderboard grade only, not a gate.
    const score = ss.computeScore(this.gs, this.gs.turn);
    ss.score  = score;
    ss.passed = true;
    this.gs.mode = GameMode.STORY_DEBRIEF;
  }
}
```

### 7.3 Fail Condition Checking — `_checkStoryFail()`

Called in `_advanceResults()` before `_checkStoryObjectives()`:

```js
_checkStoryFail() {
  const ss = this.gs.storyState;
  if (!ss || ss.passed || ss.failed) return;

  for (const fc of ss.mission.failConditions ?? []) {
    if (fc.type === 'max_turns' && this.gs.turn >= fc.turns) {
      ss.failed = true;
      ss.score  = ss.computeScore(this.gs, this.gs.turn);
      this.gs.mode = GameMode.STORY_DEBRIEF;
      return;
    }
  }
}
```

### 7.4 Collectable Weapon Override

In `_advanceFiring()`, the collectable collection block currently does:
```js
const grant = WEAPON_GRANTS[Math.floor(this.rng.next() * WEAPON_GRANTS.length)];
```

Add story mode override before this line:
```js
const overrideWeapon = this.gs.storyState?.mission.settings.collectableWeapon ?? null;
const grantPool = overrideWeapon
  ? WEAPON_GRANTS.filter(g => g.id === overrideWeapon)
  : WEAPON_GRANTS;
const grant = grantPool.length > 0
  ? grantPool[Math.floor(this.rng.next() * grantPool.length)]
  : WEAPON_GRANTS[Math.floor(this.rng.next() * WEAPON_GRANTS.length)];
```

Same override applies to the rocket blast collectable collection block (two locations total in `_advanceFiring()`).

Also increment the collect counter for objectives:
```js
if (hitCollectable && bullet.owner.team === this.gs.teams[0]) {
  if (this.gs.storyState) this.gs.storyState.collectCount++;
}
```

### 7.5 Cannon Guard (`cannonEnabled: false`)

Cannon does **not** appear in `WEAPON_GRANTS` (it is the default weapon, not a collectable reward), so collectables require no special handling when cannon is disabled.

Two places to guard:

**`GameLoop._fireAll()`** — the fallback `else` branch that fires the Cannon:
```js
} else {
  const cannonOk = this.gs.storyState?.mission.settings.cannonEnabled !== false;
  if (cannonOk) {
    this.gs.activeBullets.push(this._makeBullet(station, station.angle, station.power));
  }
  // if cannon disabled and no other weapon selected, station skips its turn silently
}
```

**`WeaponSelector.js`** — filter `WeaponId.CANNON` from the rendered weapon list when `gs.storyState?.mission.settings.cannonEnabled === false`. Also filter it in `GameLoop.humanSelectWeapon()` validation.

### 7.6 `_startTurn()` modification

Call `_processStoryEvents()` at the top of `_startTurn()` (before `_advanceAiming()`):

```js
_startTurn() {
  this._processStoryEvents();   // story mode only; no-op if storyState is null
  // ... rest of existing _startTurn
}
```

### 7.7 `_advanceResults()` modification

After the existing `_checkWin()` call, add:
```js
if (this.gs.storyState) {
  this._checkStoryFail();
  this._checkStoryObjectives();
  if (this.gs.mode === GameMode.STORY_DEBRIEF) return; // skip next-turn logic
}
```

The `--this._resultsTimer <= 0` block already gates the next turn, so the debrief transition happens cleanly.

### 7.8 `_advance()` modification

Add `STORY_DIALOG` to the no-advance cases:
```js
case GameMode.STORY_DIALOG:
case GameMode.GAMEOVER:
case GameMode.TP_RESULTS:
  // no physics advance
  break;
```

---

## 8. Team Changes (`src/entities/Team.js`)

Add:
```js
addStartingWeapons(weaponMap) {
  for (const [id, count] of Object.entries(weaponMap)) {
    this.addStock(id, count);
  }
}
```

---

## 9. Story Mission Setup Builder

Add `buildStoryMission(missionDef, physics, rng)` to a new `src/story/StorySetup.js` file. This function returns a fully-configured `{ planets, teams, gameState }` tuple ready to pass to `GameLoop`.

```js
// src/story/StorySetup.js

export function buildStoryMission(mission, physics, rng) {
  const { gw, gh } = physics;

  // ── Planets ──────────────────────────────────────────────────────────────
  let planets;
  if (mission.layout.scenarioId != null) {
    planets = ScenarioFactory.build(mission.layout.scenarioId, rng, physics);
  } else {
    planets = (mission.layout.planets ?? []).map(def =>
      buildPlanet(def, gw, gh)   // converts normalised coords to game units
    );
  }

  // ── Teams and Stations ────────────────────────────────────────────────────
  // Gather unique team indices from station defs
  const teamIndices = [...new Set(mission.layout.stations.map(s => s.team))].sort();
  const teams = teamIndices.map(ti => {
    const isHuman = ti === 0;
    const team = new Team({ index: ti, isHuman, colour: TEAM_COLOURS[ti] });
    if (isHuman) {
      team.addStartingWeapons(mission.settings.startingWeapons ?? {});
    } else {
      team.addStartingWeapons(mission.settings.enemyStartingWeapons ?? {});
      const aiLevel = mission.layout.stations.find(s => s.team === ti && s.role === 'ai')?.aiLevel ?? 2;
      team.controller = AIController.create(aiLevel);
    }
    return team;
  });

  for (const def of mission.layout.stations) {
    const team    = teams.find(t => t.index === def.team);
    const size    = StationSize[mission.settings.stationSize?.toUpperCase()] ?? StationSize.LARGE;
    const pos     = new Vec2(def.x * gw, def.y * gh);
    const station = new Station({ id: nextId(), team, position: pos, size });
    station.role        = def.role;
    station.visualStyle = def.visualStyle ?? 'station';
    team.stations.push(station);
  }

  // ── GameState ─────────────────────────────────────────────────────────────
  const gs = new GameState({
    planets, teams,
    movementSpeed: mission.settings.movementSpeed ?? 'off',
    config: {
      collectables:    mission.settings.collectablesSpawn === 'normal' ? 'normal' : 'off',
      richAsteroids:   mission.settings.richAsteroids ?? 'normal',
      collectableSize: 'medium',
      scenarioId:      mission.layout.scenarioId ?? null,
    },
  });

  gs.storyState = new StoryModeState(mission);

  // ── Fixed Collectables ────────────────────────────────────────────────────
  if (mission.settings.collectablesSpawn === 'fixed') {
    for (const def of mission.layout.collectables ?? []) {
      const c = new Collectable(new Vec2(def.x * gw, def.y * gh));
      c.radius = 5;
      gs.collectables.push(c);
    }
  }

  return { gs, teams };
}
```

---

## 10. UI Components

### 10.0 Story Text Colour Substitution

Story text strings use `{enemy1}`, `{enemy2}`, `{enemy3}` placeholders that are substituted at render time with the actual team colour name for that enemy team. Substitution runs in `StoryModeScreen` before displaying any story text:

```js
const TEAM_COLOUR_NAMES = [
  'green', 'cyan', 'yellow', 'red', 'purple', 'blue', 'orange', 'grey',
  'white', 'black', 'pink', 'brown',
];

function substituteColours(text, gs) {
  return text.replace(/\{enemy(\d+)\}/g, (_, n) => {
    const teamIdx = parseInt(n, 10);  // {enemy1} = team index 1
    return TEAM_COLOUR_NAMES[teamIdx] ?? `team ${teamIdx}`;
  });
}
```

This runs against `mission.story` and event `dialog` strings. The same substitution applies to dialog popups shown mid-mission.

---

### 10.1 `StoryModeScreen.js`

A full-viewport overlay (replaces the `ConfigPanel` during story mode). Manages three sub-views:
- **Mission Select** — shown when `gs.mode === STORY_SELECT`
- **Briefing** — shown when `gs.mode === STORY_BRIEFING`
- **Debrief** — shown when `gs.mode === STORY_DEBRIEF`

```js
export class StoryModeScreen {
  constructor({ missions, persistence, onStart, onBack }) { ... }

  showSelect()            // render mission grid, read persistence for lock states
  showBriefing(mission)   // render story text + objectives + Start button
  showDebrief(result)     // { mission, passed, score, bestScore } → render outcome
  hide()
}
```

**Mission Select layout:**
- Vertical scrollable list of mission cards
- Card: mission number (bold, team-colour accent) | title | lock icon or best score chip
- Locked cards: reduced opacity, `pointer-events: none`
- Active card highlights on hover; click → `showBriefing(mission)`
- "Back to Menu" button returns to `ConfigPanel` view

**Briefing layout:**
- Full-screen overlay on canvas
- Title bar: `MISSION N — TITLE`
- Body: story text paragraph
- Objectives list (bulleted): each `objective.type` rendered as a sentence
- Fail conditions (if any): `"Fail if not completed within N turns"` in amber
- "Start Mission" button → calls `onStart(mission)`

**Debrief layout:**
- Outcome banner: `MISSION COMPLETE` (green) or `MISSION FAILED` (red)
- Score section: formula-specific breakdown + total score in large text
- Best score badge if `score > previousBestScore` (gold star + "New Best!")
- Two buttons: **Retry** (always active) | **Next Mission** (greyed out if failed and next is locked)

### 10.2 `StoryObjectivePanel.js`

Lightweight DOM overlay rendered in-game, top-right corner of the canvas.

```js
export class StoryObjectivePanel {
  constructor(container) { ... }
  update(storyState, currentTurn) { ... }  // called once per rAF frame while gs.mode is active
  hide() { ... }
}
```

**Rendered content:**
- Header: `OBJECTIVES` in small caps
- For each objective in `storyState.objectives`: checkbox (☐ / ☑) + human-readable label
  - `destroy_all` → "Destroy all enemies"
  - `destroy_n`   → "Destroy at least N enemies" (with live count "2 / 5")
  - `collect_n`   → "Collect N collectables" (with live count)
- Turn counter: `Turn: N` — or if fail condition exists: `Turn: N / MAX` in amber when N > MAX × 0.7
- Panel is compact (max 200px wide, auto-height); styled consistent with existing HUD text

### 10.3 `StoryDialogPopup.js`

Modal overlay that pauses the game loop. Displayed when `gs.mode === STORY_DIALOG`.

```js
export class StoryDialogPopup {
  constructor(container, onDismiss) { ... }
  show(text) { ... }
  hide() { ... }
}
```

Renders as a semi-transparent overlay with the dialog text in the same military boot-camp voice. A single **"Understood"** button dismisses the popup: calls `onDismiss()`, which restores `gs.mode = gs._storyPrevMode` and resumes the loop.

---

## 11. Renderer Changes (`src/rendering/Renderer.js`)

### 11.1 Drone visual

In the station drawing code (wherever the death-star sphere is drawn), add a branch on `station.visualStyle`:

```js
if (station.visualStyle === 'drone') {
  this._drawDroneStation(ctx, station, scale);
} else {
  this._drawDeathStarStation(ctx, station, scale);   // existing code
}
```

`_drawDroneStation`: Draw an angular hexagon or diamond shape (4–6 sided polygon) in the station's team colour, with a flat-black interior and sharp angular notches. No equatorial band. A thin outer ring in a darker shade of the team colour.

### 11.2 Target station visual

Target stations (`role: 'target'`) get their existing `visualStyle` (default `'station'`), but additionally render a thin pulsing ring:

```js
if (station.role === 'target') {
  this._drawTargetRing(ctx, station, scale);
}
```

`_drawTargetRing`: A dashed or dotted circle at `radius * 1.8`, pulsing in opacity (0.3 → 0.7 → 0.3, period ≈ 2 s). Colour: dark red `rgba(180, 30, 30, alpha)`.

### 11.3 Story objective panel integration

The `Renderer.drawFrame()` call should include the `StoryObjectivePanel.update()` call. Since the panel is DOM-based (not canvas), the renderer doesn't draw it directly — `main.js` calls `panel.update(gs.storyState, gs.turn)` once per rAF frame after `drawFrame`.

---

## 12. Persistence (`src/story/StoryPersistence.js`)

```js
const STORAGE_KEY = 'dsb_story';

export const StoryPersistence = {
  load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    } catch {
      return {};
    }
  },

  save(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  },

  isUnlocked(missionId, data) {
    if (missionId === STORY_MISSIONS[0].id) return true;  // M1 always unlocked
    return data.unlocked?.includes(missionId) ?? false;
  },

  getBestScore(missionId, data) {
    return data.scores?.[missionId] ?? null;
  },

  recordPass(missionId, score, data) {
    const updated = { ...data };
    if (!updated.unlocked) updated.unlocked = [];
    if (!updated.unlocked.includes(missionId)) updated.unlocked.push(missionId);

    // Unlock the next mission
    const idx = STORY_MISSIONS.findIndex(m => m.id === missionId);
    const next = STORY_MISSIONS[idx + 1];
    if (next && !updated.unlocked.includes(next.id)) updated.unlocked.push(next.id);

    // Best score
    if (!updated.scores) updated.scores = {};
    if (score > (updated.scores[missionId] ?? -Infinity)) updated.scores[missionId] = score;

    // Campaign completion reward: all 20 missions passed
    if (!updated.campaignComplete) {
      const allPassed = STORY_MISSIONS.every(m => updated.unlocked.includes(m.id));
      if (allPassed) updated.campaignComplete = true;
    }

    return updated;
  },

  isCampaignComplete(data) {
    return data.campaignComplete === true;
  },
};
```

---

## 13. `main.js` Wiring

Story Mode is exposed as a **Mode** option in `ConfigPanel` (the existing Mode selector that contains Single Game and Tournament). When the user selects Story Mode:

1. `ConfigPanel` emits a `onModeChange('story')` event
2. `main.js` hides the config controls and shows `StoryModeScreen` in select view
3. User picks mission → `showBriefing(mission)` → user clicks "Start Mission":
   - Call `buildStoryMission(mission, physics, rng)` → get `gs, teams`
   - Instantiate `GameLoop` as normal (with `gs`)
   - Show `StoryObjectivePanel`; mount `StoryDialogPopup`
   - Start loop
4. Loop reaches `STORY_DEBRIEF`:
   - Call `StoryPersistence.recordPass(missionId, score, data)` and save on any pass
   - If `isCampaignComplete(data)` and was not previously complete: show unlock message on debrief
   - Show debrief overlay
   - "Retry" → full reload via `buildStoryMission` (no mid-game resume)
   - "Next Mission" → return to `StoryModeScreen` select view (not directly to briefing)
5. **Starting Weapons unlock:** `ConfigPanel` reads `StoryPersistence.load().campaignComplete` at startup. If true, the Starting Weapons option is shown in Page 4 (Collectables). If false, the option is hidden. The same flag is checked by `TargetPracticeSetup` to conditionally show Starting Weapons.

---

## 14. Implementation Sequence

Build in this order to avoid blocking dependencies:

1. **`StoryMissions.js`** — data only, no code dependencies
2. **`Station.js` fields** — `role`, `visualStyle` (additive, no breakage)
3. **`Team.addStartingWeapons()`** — small helper
4. **`StoryPersistence.js`** — pure localStorage, no game dependencies
5. **`StoryModeState.js`** — depends on missions data
6. **`StorySetup.js`** — depends on all entity classes; wire up and test that a mission can be built and a regular GameLoop started from it
7. **`GameLoop` hooks** — events, objectives, fail conditions, cannon guard, collectable override; test each in isolation with a mock `storyState`
8. **Renderer drone + target ring** — visual only, no logic change
9. **`StoryObjectivePanel.js`** — UI, depends on `StoryModeState`
10. **`StoryDialogPopup.js`** — UI, simple modal
11. **`StoryModeScreen.js`** — full UI, depends on persistence + missions
12. **`main.js` wiring** — final integration; test full flow per mission

---

## 15. Edge Cases & Notes

- **`destroy_all` with events**: The `destroy_all` objective checks if all `teams[1+]` are dead. Event-spawned stations join an existing team (or a new team if `team` index is new). The objective evaluates correctly as long as `teams[1+]` includes event-spawned teams at evaluation time.
- **Multi-team `destroy_all`**: For M16–M20 with 3+ teams, `destroy_all` requires ALL non-human teams to be eliminated. AI teams can kill each other — this counts. The human just needs to be the last team alive.
- **`cannonEnabled: false` + weapon selector**: Filter `WeaponId.CANNON` from the list rendered by `WeaponSelector.js` when `gs.storyState?.mission.settings.cannonEnabled === false`.
- **Score at M3/M4 on exact last turn**: `turns_remaining` yields 0 if the player completes on the very last turn. This is a valid pass (objectives met); the score of 0 is a poor leaderboard result but does not cause failure.
- **`_checkWin()` interaction**: `_checkWin()` sets `gs.winner` when `aliveTeams.length <= 1`. For story missions this still fires, but `_checkStoryObjectives()` intercepts before `GAMEOVER` is set. The mode transition to `STORY_DEBRIEF` takes precedence — ensure `_advanceResults()` checks `gs.mode === STORY_DEBRIEF` and returns before the existing `GAMEOVER` branch.
- **Demo mode**: The first-run demo (`isDemo: true`) must not set `storyState`. Guard all story hooks with `if (!gs.storyState) return`.
