# Story Mode — Implementation Plan

> Companion to [story-mode-spec.md](story-mode-spec.md). Phases are ordered by dependency — each phase produces something runnable and verifiable. Spec references are in brackets.

---

## Phase SM1 — Data Layer & Core State

No rendering, no UI. Build the mission definitions and the state objects that hold story progress. Produces: mission data importable in browser console; `StoryModeState` constructable from any mission.

- [ ] **SM1.1** Create `src/story/` directory; add placeholder `index.js` if needed for module resolution
- [ ] **SM1.2** `src/story/StoryMissions.js` — define `STORY_MISSIONS` constant array with all 20 mission objects following the schema in `story-mode-spec.md §4`. Missions M1–M4, M10 (explicit asteroid belt), M12, M13 use `layout.planets[]` with normalised coordinates; remaining missions set `layout.scenarioId`. All 20 `id`, `title`, `story`, `objectives`, `failConditions`, `scoring`, and `settings` fields must be populated.
- [ ] **SM1.3** `src/entities/Station.js` — add `this.role = 'human'` and `this.visualStyle = 'station'` to the `Station` constructor (additive, no existing behaviour changes)
- [ ] **SM1.4** `src/entities/Team.js` — add `addStartingWeapons(weaponMap)` method: iterates `Object.entries(weaponMap)` and calls `this.addStock(id, count)` for each entry
- [ ] **SM1.5** `src/core/GameState.js` — add `STORY_SELECT`, `STORY_BRIEFING`, `STORY_DEBRIEF`, `STORY_DIALOG` to `GameMode` freeze; add `this.storyState = null`, `this.storyDialogText = null`, `this._storyPrevMode = null` to constructor
- [ ] **SM1.6** `src/story/StoryModeState.js` — `StoryModeState` class: constructor takes a mission object, initialises `objectives`, `objectiveMet[]`, `firedEvents` (Set), `collectCount`, `passed`, `failed`, `score`; implement `addObjective(obj)`, `evaluate(gs)` (all three objective types), `computeScore(gs, turnsUsed)` (all four formulae), `get allObjectivesMet()`
- [ ] **SM1.7** `src/story/StoryPersistence.js` — `load()`, `save(data)`, `isUnlocked(missionId, data)`, `getBestScore(missionId, data)`, `recordPass(missionId, score, data)` (sets `campaignComplete` when all 20 are in `unlocked`), `isCampaignComplete(data)`. Wrap `localStorage` calls in try/catch.
- [ ] **SM1.8** Verify: in browser console, import `STORY_MISSIONS` and confirm all 20 entries have the required fields; construct `new StoryModeState(STORY_MISSIONS[0])`, call `evaluate()` with a mock `gs` object, confirm `allObjectivesMet` responds correctly

---

## Phase SM2 — Mission Setup Builder

Wire mission data into the game engine. Produces: calling `buildStoryMission(STORY_MISSIONS[0])` returns a `GameState` that can be passed directly to a standard `GameLoop` and runs a playable (if visually unfinished) game.

- [ ] **SM2.1** `src/story/StorySetup.js` — `buildStoryMission(mission, physics, rng)` function: branch on `mission.layout.scenarioId` vs `mission.layout.planets[]`; call `ScenarioFactory.build()` for scenario-based missions; call `buildPlanet()` for explicit layouts
- [ ] **SM2.2** `buildPlanet(def, gw, gh)` — converts `def.x`, `def.y` (normalised 0–1) to game units; constructs and returns a `Planet` with correct `type`, `radius`, `density`, and appropriate `colour`/`shading` defaults per planet type
- [ ] **SM2.3** Team and station construction in `buildStoryMission`: gather unique team indices from `mission.layout.stations`; create one `Team` per index; call `addStartingWeapons` (human team uses `settings.startingWeapons`, AI teams use `settings.enemyStartingWeapons`); attach `AIController.create(aiLevel)` to AI teams
- [ ] **SM2.4** Station construction in `buildStoryMission`: for each station def, construct a `Station` at `(def.x * gw, def.y * gh)`, set `role` and `visualStyle`, push into team
- [ ] **SM2.5** `GameState` construction in `buildStoryMission`: pass planets, teams, `movementSpeed`; set `gs.storyState = new StoryModeState(mission)`; set `gs.config.collectables` based on `settings.collectablesSpawn`
- [ ] **SM2.6** Fixed collectable placement: when `collectablesSpawn === 'fixed'`, iterate `mission.layout.collectables[]`, construct `Collectable` at normalised coords × game size, push to `gs.collectables`
- [ ] **SM2.7** Verify: `buildStoryMission(STORY_MISSIONS[0], physics, rng)` → pass resulting `gs` to a `GameLoop` → game runs; targets hyperspace each turn (they select Hyperspace as their action — they will "fire" but do nothing); no crashes

---

## Phase SM3 — Engine Hooks

Add story-mode logic to the `GameLoop` without breaking existing game modes. Every hook is guarded by `if (!this.gs.storyState) return`. Produces: objectives evaluate correctly, fail conditions trigger, events fire, cannon and collectable overrides work.

- [ ] **SM3.1** `GameLoop._processStoryEvents()` — iterate `mission.events`; skip if `firedEvents.has(event.turn)` or `gs.turn !== event.turn`; spawn stations via `_buildStoryStation()` (random valid position when `x/y` are null, using the same placement loop as `_processHyperspace()`); apply `event.startingWeapons` to spawned team via `addStartingWeapons`; apply hyperspace materialise animation (`station.hyperspaceFlash`); call `ss.addObjective()` for each entry in `addObjectives`; queue dialog by setting `gs.storyDialogText`, `gs._storyPrevMode`, `gs.mode = STORY_DIALOG`
- [ ] **SM3.2** `GameLoop._checkStoryFail()` — check `max_turns` fail condition: if `gs.turn >= fc.turns`, set `ss.failed = true`, `ss.score = ss.computeScore(...)`, `gs.mode = STORY_DEBRIEF`
- [ ] **SM3.3** `GameLoop._checkStoryObjectives()` — call `ss.evaluate(gs)`; check combat implicit fail (human team not alive, enemies remain) → `ss.failed = true`; check `ss.allObjectivesMet` → `ss.score = computeScore(...)`, `ss.passed = true`, `gs.mode = STORY_DEBRIEF`
- [ ] **SM3.4** `GameLoop._advanceResults()` modification — after the existing `_checkWin()` call, add: `if (this.gs.storyState) { this._checkStoryFail(); this._checkStoryObjectives(); if (this.gs.mode === GameMode.STORY_DEBRIEF) return; }`
- [ ] **SM3.5** `GameLoop._startTurn()` modification — call `this._processStoryEvents()` at the top of the method (before `_advanceAiming()`)
- [ ] **SM3.6** `GameLoop._advance()` modification — add `case GameMode.STORY_DIALOG:` to the no-physics block alongside `GAMEOVER` and `TP_RESULTS`
- [ ] **SM3.7** Target station guard in `GameLoop._advanceAiming()` — in the AI action block, add: if `station.role === 'target'`, set `station.selectedWeapon = WeaponId.HYPERSPACE`, increment `_turnIdx`, continue
- [ ] **SM3.8** Collectable weapon override in `_advanceFiring()` — in both the bullet collection block and the rocket blast collection block, replace `WEAPON_GRANTS[random]` with a filtered pool when `gs.storyState?.mission.settings.collectableWeapon` is set; also increment `gs.storyState.collectCount` when the collecting bullet's team is `gs.teams[0]`
- [ ] **SM3.9** Cannon guard in `GameLoop._fireAll()` — in the fallback `else` branch (cannon fire), add `const cannonOk = this.gs.storyState?.mission.settings.cannonEnabled !== false;` and only push the bullet if `cannonOk`
- [ ] **SM3.10** Cannon guard in `WeaponSelector.js` — filter `WeaponId.CANNON` from the available weapon list when `gs.storyState?.mission.settings.cannonEnabled === false`
- [ ] **SM3.11** Verify: run M1 — targets never fire, `destroy_all` evaluates correctly, `STORY_DEBRIEF` mode is set on completion; run M4 — `collectCount` increments, `collect_n` objective evaluates; run M13 — `_processStoryEvents()` fires at turn 3, dialog queued, `destroy_all` added to objectives; run M11 — cannon unavailable in weapon selector

---

## Phase SM4 — Visual Variants

Drone and target stations need distinct rendering. Produces: drones look mechanical/angular; targets have a pulsing ring.

- [ ] **SM4.1** Refactor existing station draw code in `Renderer` — extract death-star draw logic into `_drawDeathStarStation(ctx, station, cx, cy, r)` private method (no behaviour change)
- [ ] **SM4.2** `Renderer._drawDroneStation(ctx, station, cx, cy, r)` — draw an angular 6-sided polygon in team colour; flat-black fill with sharp angular notches cut into the perimeter; thin outer ring in a darker shade; no equatorial band
- [ ] **SM4.3** Station draw branch — in the station rendering call site, add: `station.visualStyle === 'drone' ? this._drawDroneStation(...) : this._drawDeathStarStation(...)`
- [ ] **SM4.4** `Renderer._drawTargetRing(ctx, station, cx, cy, r, frameTime)` — dashed circle at `r * 1.8`; opacity pulses between 0.3 and 0.7 using `Math.sin(frameTime * Math.PI)` where `frameTime` advances ~0.5/second; colour `rgba(180, 30, 30, alpha)`
- [ ] **SM4.5** Target ring call — after drawing the station, add: `if (station.role === 'target') this._drawTargetRing(...)`; pass a wall-clock `frameTime` counter maintained in `Renderer`
- [ ] **SM4.6** Verify: start M1 in-game; confirm 3 targets have a pulsing red ring; start M5; confirm the enemy drone uses the angular shape

---

## Phase SM5 — In-Game Story UI

The player needs to see objectives and receive event dialogs during play. Produces: objective panel visible and updating; event dialog pauses the game and is dismissible.

- [ ] **SM5.1** `src/ui/StoryObjectivePanel.js` — DOM overlay fixed to top-right of canvas; `update(storyState, currentTurn)` re-renders: list of objectives with ✓/☐ checkboxes + human-readable label (`destroy_all` → "Destroy all enemies", `collect_n` → "Collect N collectables (X / N)"); turn counter below; amber "Turn N / MAX" when a `max_turns` fail condition exists; hide entirely when `storyState` is null
- [ ] **SM5.2** `src/ui/StoryDialogPopup.js` — semi-transparent centred modal; `show(text, onDismiss)` renders text with "Understood" button; `hide()` removes it; button click calls `onDismiss()` which restores `gs.mode = gs._storyPrevMode` and clears `gs.storyDialogText`
- [ ] **SM5.3** Mount both in `main.js` when a story game starts: `StoryObjectivePanel.update()` called once per rAF frame after `renderer.drawFrame(gs)`; `StoryDialogPopup.show()` called when `gs.mode === STORY_DIALOG` and `gs.storyDialogText` is non-null
- [ ] **SM5.4** Verify: play M4 — panel shows "Collect 0 / 5 collectables", ticks up with each collection, shows ✓ when done; play M13 — dialog with event text appears at turn 3, dismissing it resumes the game and objective panel now shows "Destroy all enemies"

---

## Phase SM6 — Story Navigation UI

Mission select, briefing, and debrief screens. Produces: full navigation flow from config panel to mission complete and back.

- [ ] **SM6.1** `substituteColours(text, mission)` helper in `StoryModeScreen.js` — replace `{enemy1}`, `{enemy2}` etc. with `TEAM_COLOUR_NAMES[teamIndex]` where `TEAM_COLOUR_NAMES = ['green', 'cyan', 'yellow', 'red', 'purple', 'blue', 'orange', 'grey', ...]`
- [ ] **SM6.2** `src/ui/StoryModeScreen.js` — class managing three sub-views: `showSelect()`, `showBriefing(mission)`, `showDebrief(result)`; `result = { mission, passed, score, previousBest }`
- [ ] **SM6.3** Mission select view — scrollable vertical list of mission cards; each card: mission number + title + lock icon or best score chip; locked cards at reduced opacity with `pointer-events: none`; click on unlocked card → `showBriefing(mission)`; "Back" button returns to config panel
- [ ] **SM6.4** Briefing view — mission number + title header; story text paragraph (colour substituted); bulleted objectives list; fail conditions in amber if any; "Start Mission" button calls `onStart(mission)` callback
- [ ] **SM6.5** Debrief view — MISSION COMPLETE (green) or MISSION FAILED (red) banner; score breakdown lines (formula-specific); total score in large text; "New Best!" badge when score beats `previousBest`; campaign completion message if `campaignComplete` just became true; two buttons: Retry (always active) and Next Mission (greyed when `!passed && nextMission.locked`)
- [ ] **SM6.6** `ConfigPanel.js` modification — add "Story" to the Mode cycle button (between Single Game and Tournament); emit `onModeChange('story')` when selected
- [ ] **SM6.7** `main.js` wiring — on `mode === 'story'`: show `StoryModeScreen` in select view; on `onStart(mission)`: call `buildStoryMission`, instantiate `GameLoop`, show objective panel; monitor for `gs.mode === STORY_DEBRIEF` each rAF frame; on debrief: call `StoryPersistence.recordPass()`, save, show debrief view; Retry → `buildStoryMission` again; Next Mission → `storyScreen.showSelect()`
- [ ] **SM6.8** Verify: full flow — config panel → Story mode → select M1 → briefing shows correct text → Start → game runs → mission completes → debrief shows score → select screen shows M2 card unlocked

---

## Phase SM7 — Persistence & Completion Reward

Progress survives browser restarts. Completing all 20 missions unlocks Starting Weapons. Produces: save/load works correctly; Starting Weapons appears in config after campaign completion.

- [ ] **SM7.1** `main.js` persistence integration — load `StoryPersistence.load()` once at startup; pass `data` to `StoryModeScreen` so it can read lock state and best scores; save via `StoryPersistence.save()` after every `recordPass()` call
- [ ] **SM7.2** `ConfigPanel.js` — read `StoryPersistence.load().campaignComplete` at startup; if true, show the Starting Weapons row in Page 4 (currently always hidden for players); if false, keep it hidden
- [ ] **SM7.3** `TargetPracticeSetup.js` — same `campaignComplete` check: show Starting Weapons option in the TP setup UI if true
- [ ] **SM7.4** Debrief screen — if `StoryPersistence.isCampaignComplete(newData)` is true and was false before this save, display an unlock message at the bottom of the debrief: *"Campaign complete. Starting Weapons is now available in all game modes."*
- [ ] **SM7.5** Verify: complete M1 in story mode; refresh page; confirm M2 is unlocked and M1 best score shows on the card; play M1 again with a better score; confirm best score updates; complete all 20 (or manually set `campaignComplete: true` in localStorage); confirm Starting Weapons appears in ConfigPanel Page 4 and in the TP setup

---

## Phase SM8 — Mission Tuning & Polish

All missions must be playable, balanced, and pass/fail correctly. Produces: a complete, shippable Story Mode.

- [ ] **SM8.1** Complete all explicit planet coordinate sets in `StoryMissions.js` — M1 (crystal asteroids + target positions), M2 (asteroid band + target scatter), M3 (supergiant star off-bottom), M4 (10 collectable positions + 6 asteroids), M10 (asteroid belt band), M12 and M13 (gas giant + rich asteroid field)
- [ ] **SM8.2** M3 gravity tuning — verify that no direct shot from the start position reaches the target; adjust the star's radius and density until this is reliably true across multiple firing angles and powers
- [ ] **SM8.3** M10 asteroid belt tuning — verify the belt is a genuine obstacle (can't trivially shoot through it) without completely blocking all shots (some trajectories still viable)
- [ ] **SM8.4** M14 balance — play M14 several times; confirm that 2 ships with 2 Blasters + 2 Blunderbusses vs 4 triple-cannon Cleverbots is hard but survivable; adjust human starting weapons if consistently unwinnable in under 10 attempts
- [ ] **SM8.5** Tune all `passingScore` values — play each mission optimally and note the resulting score; play each mission poorly and note the resulting score; set `passingScore` to approximately the "played reasonably well" midpoint
- [ ] **SM8.6** Multi-team edge case — verify M16–M20: when all non-human teams are eliminated (by each other or by the player), `destroy_all` evaluates true and mission completes
- [ ] **SM8.7** Event timing edge case — verify that mission events fired during the `RESULTS` phase (turn boundary) do not cause a crash when dialog is queued immediately before the next `_startTurn()` call
- [ ] **SM8.8** Performance check — run M19 (32 stations) at normal speed; confirm game holds 30fps during simulation; if not, profile and optimise
- [ ] **SM8.9** Debrief score display — confirm each formula's output is readable and meaningful on the debrief screen; add unit labels if needed (e.g. "Turn bonus: +700", "Kills: 3 × 200 = 600")
- [ ] **SM8.10** Full playthrough — play all 20 missions in sequence; confirm each passes under the intended winning condition and fails under the intended losing condition; check that unlock progression is correct after each pass

---

## Milestone Summary

| Phase | Deliverable |
|---|---|
| SM1 | Mission data importable; `StoryModeState` constructable and evaluatable |
| SM2 | Any mission builds into a runnable `GameState`; standard `GameLoop` starts from it |
| SM3 | Objectives, fail conditions, events, cannon guard, and collectable override all work in-engine |
| SM4 | Drone and target stations visually distinct |
| SM5 | Objective panel and dialog popup work during play |
| SM6 | Full navigation: config → select → briefing → game → debrief → select |
| SM7 | Progress persists across reloads; campaign completion unlocks Starting Weapons |
| SM8 | All 20 missions playable, balanced, and shippable |
