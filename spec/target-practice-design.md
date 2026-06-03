# Target Practice Mode — Design Document

> Companion to `target-practice.md` (EARS requirements). This document describes **how** the feature is built; consult the EARS spec for **what** it must do.

---

## 1. New Files

| File | Purpose |
|---|---|
| `src/entities/PracticeTarget.js` | Target entity class |
| `src/core/TargetPracticeSetup.js` | Station placement, target placement, feasibility simulation |
| `src/core/TargetPracticeGame.js` | Per-game state: target sets, round tracking, per-station scoring |
| `src/ui/TargetPracticeResultsScreen.js` | DOM results overlay (mirrors `GameOverScreen`) |

---

## 2. Modified Files

| File | What changes |
|---|---|
| `src/core/GameState.js` | New `GameMode` constants; new `tpGame` field |
| `src/core/GameLoop.js` | New `_advanceTargetPractice()` branch; sequential (not simultaneous) turn model |
| `src/physics/PhysicsEngine.js` | `stepTargetPractice()` — pass-through target hit detection + accuracy capture |
| `src/rendering/Renderer.js` | `drawTarget()`, glitter VFX, visibility filtering during TP turns |
| `src/ui/ConfigPanel.js` | Mode value `'target-practice'`; Page 5 "TARGET PRACTICE" |
| `src/main.js` | Wire `TargetPracticeResultsScreen`; call `TargetPracticeSetup` on game start |
| `src/scenarios/scenarioData.js` | Export `TARGET_PRACTICE_SCENARIOS` subset |

---

## 3. New Classes

### 3.1 `PracticeTarget`

```
src/entities/PracticeTarget.js
```

```js
class PracticeTarget {
  id       // number — unique per map generation
  position // Vec2 — canonical position shared by all per-station copies
  radius   // number — derived from Target Size config (same px values as Station sizes)
}
```

No gravity, no bullet blocking. The target is purely a detection zone + a sprite.

---

### 3.2 `TargetPracticeSetup`

```
src/core/TargetPracticeSetup.js
```

Stateless helper — all methods are static. Called once per game from `main.js` after scenario generation.

**`TargetPracticeSetup.placeStations(config, planets, gameW, gameH)`**

Returns an array of `{x, y}` positions for all stations.

Algorithm:
1. Determine orientation: landscape (`gameW >= gameH`) → vertical line; portrait → horizontal line.
2. Randomly choose which edge (left/right or top/bottom).
3. Compute evenly-spaced positions along the edge with padding equal to 2× station radius at each end.
4. For each candidate position: if it overlaps any planet, step inward by 1px until clear or until 200 steps exhausted (last-resort: accept overlap and log a warning — same spirit as §6.3 tier 3).

---

**`TargetPracticeSetup.placeTargets(config, planets, stations, gameW, gameH)`**

Returns an array of `2N` `PracticeTarget` instances, or `null` on failure (triggers scenario re-roll).

Algorithm:
1. Divide the map into a grid of cells (cell side ≈ 4× target radius). Exclude the station-edge strip.
2. Shuffle grid cells. For each cell, attempt to place a target at the cell centre; reject if it overlaps a planet by more than `0.5 × target radius`.
3. Accept targets until `2N` placed. If fewer than `2N` accepted after the full grid is exhausted, return `null`.

---

**`TargetPracticeSetup.runFeasibility(stations, candidates, planets, physics, gameW, gameH)`**

Returns `{hitMatrix, selectedTargets}`.

- `hitMatrix[stationIdx][targetIdx]` → `boolean` (true if at least one trace hit).
- `selectedTargets` → N `PracticeTarget` instances chosen by the priority rules in TPM-06.

**Shared trace budget:** total traces across all pairs is capped at **200**. Traces are shared rather than assigned per-pair, so a large grid of candidates with many stations doesn't blow out.

Algorithm:
1. Enumerate all `(station, candidate)` pairs.
2. Compute `tracesPerPair = max(1, floor(200 / pairs.length))`.
3. For each pair, construct a mock target `{ position, radius, id, team: null }` and call:
   ```js
   SimBot._findBestShot(station, mockTarget, mockGS, tracesPerPair)
   ```
   using MegaBot parameters (`stepSize=5`, `simSteps=2000`). Treat `closestDist ≤ candidate.radius` as a hit.

   > **Note:** Because `SimBot._findBestShot` aims at the *closest approach* to a target and does not require an enemy `Team`, it works without modification if given a duck-typed target with `.position` and `.radius`. Verify this assumption when implementing — if `team`-checks exist in the path, pass `team: null`.

4. After all pairs, sort candidates by number-of-stations-that-hit descending. Take the top N, breaking ties randomly.

Worked examples of trace distribution:

| Stations | N | Pairs (S × 2N) | tracesPerPair |
|---|---|---|---|
| 2 | 5 | 20 | 10 |
| 4 | 10 | 80 | 2 |
| 6 | 20 | 240 | 1 |

---

### 3.3 `TargetPracticeGame`

```
src/core/TargetPracticeGame.js
```

Holds all per-game mutable state. Attached to `GameState` as `gs.tpGame`.

```js
class TargetPracticeGame {
  targets      // PracticeTarget[N] — canonical positions (same for all teams)
  totalRounds  // number — from config
  currentRound // number — 1-indexed
  stationList  // Station[] — all stations in turn order
  teamData     // Map<teamIndex, TeamTPData>
}

class TeamTPData {
  targetDestroyed  // boolean[N] — shared by all stations on the team
  hits             // { stationId, targetIdx, accuracy }[] — ordered log of hits
  finishedRound    // number | null — round when all N cleared; null if not yet done
}
```

`finishedRound` is written at the end of the firing phase in which the last target is destroyed. A team whose `finishedRound !== null` is excluded from `_turnOrder` in all subsequent rounds. The game ends when every team has either a non-null `finishedRound` or the round counter exceeds `totalRounds`.

---

### 3.4 `TargetPracticeResultsScreen`

```
src/ui/TargetPracticeResultsScreen.js
```

Follows the exact same DOM pattern as `GameOverScreen` — a fixed overlay `div` with a centred card, populated by `show(gs)`.

Table columns:
```
TEAM | STATION | TARGETS HIT | HIT RATE | MEAN ACCURACY
```

Team summary rows (bold, team colour) aggregate across all stations on that team.

Mean Accuracy shows `—` for stations with zero hits.

Buttons: **Play Again** (re-run setup with same config, new scenario) · **Main Menu** (show config panel).

---

## 4. Modified Classes

### 4.1 `GameState` — new fields and modes

New `GameMode` constants:
```js
TP_SETUP:   'tp_setup',   // feasibility sim running (no user interaction)
TP_AIMING:  'tp_aiming',  // active station is aiming
TP_FIRING:  'tp_firing',  // active station's bullet in flight
TP_RESULTS: 'tp_results', // results screen shown
```

New field on `GameState`:
```js
this.tpGame = null; // TargetPracticeGame | null — non-null only in TP mode
```

`TP_SETUP` is a transient mode used so the `GameLoop` tick can drive the feasibility simulation asynchronously across frames (avoids blocking the browser for large N or many stations). Alternatively, if performance allows, run it synchronously before constructing `GameLoop`.

---

### 4.2 `GameLoop` — TP turn model (simultaneous fire)

Target Practice uses **simultaneous** fire — all stations on all teams aim, then all bullets fly at once — exactly like normal mode but with target hit detection instead of station killing.

Dispatch from `_advance()`:

```js
case GameMode.TP_AIMING:  this._advanceTPAiming();  break;
case GameMode.TP_FIRING:  this._advanceTPFiring();  break;
case GameMode.TP_RESULTS: /* no-op — overlay handles it */ break;
```

**`_startTPTurn()`**  
Sets `_turnOrder` to all active stations in `tpGame.stationList`, resets weapons to `CANNON`, transitions to `TP_AIMING`, calls `_advanceTPAiming()`.

**`_advanceTPAiming()`**  
Mirrors `_advanceAiming()`:
- AI stations call `_tpAIAim(station)` immediately and advance `_turnIdx`.
- Human stations set `waitingForInput = true` and return; `humanFire()` increments `_turnIdx` and re-enters.
- When `_turnIdx >= _turnOrder.length`, call `_tpFireAll()`.

**`_tpAIAim(station)`**  
Picks a random surviving target index for the station's team. If the team controller has `_findBestShot`, calls it with the target as a mock target and a minimal mock gameState `{ planets, turn: 20 }`. Otherwise aims directly at the target centre.

**`_tpFireAll()`**  
Creates one `Bullet` per station (using `_makeBullet`), stores them all in `gs.activeBullets`, sets `gs.mode = TP_FIRING`.

**`_advanceTPFiring()`**  
Runs `physics.step()` for every bullet each tick. Additionally checks each bullet against surviving team targets (pass-through). On hit: calls `tp.recordHit(stationId, teamIndex, targetIdx, accuracy)`, pushes glitter VFX. When `activeBullets` is empty: increments `tp.currentRound`; if past `totalRounds`, transitions to `TP_RESULTS`; otherwise calls `_startTPTurn()`.

**`humanFire()` change**  
```js
if (gs.mode === TP_AIMING && gs.waitingForInput) {
  gs.waitingForInput = false;
  _turnIdx++;
  _advanceTPAiming();
  return;
}
```

---

### 4.3 `PhysicsEngine` — pass-through target hit detection

Add `stepTargetPractice(bullet, planets, targets)`:

- Identical to `step()` for gravity and planet collision.
- Additionally, after position update, check each surviving target in `targets`:
  ```
  dx = target.position.x - bullet.position.x
  dy = target.position.y - bullet.position.y
  dist = sqrt(dx² + dy²)
  if dist <= target.radius → register hit, do NOT destroy bullet
  ```
- Return value includes `hits: [{ targetIdx, accuracy }]` for any targets entered this step.

**Accuracy calculation** (called inside `stepTargetPractice` on hit):
```
toCenter = target.position − bullet.position       (at moment of entry)
θ = angleBetween(bullet.velocity, toCenter)        (in degrees, via acos of dot product)
accuracy = max(0, 1 − θ / 90)
```

Since a bullet passes through, it may re-enter the same target after exiting. Only the first hit counts — re-entries are ignored. This requires no separate flag: `stepTargetPractice` simply skips any target already marked destroyed in the active station's `StationTPData.targetDestroyed[i]`. The destroyed state is the gate.

---

### 4.4 `Renderer` — targets and visibility filtering

**`drawTarget(ctx, target)`**  
Draws a bullseye at `target.position` with radius `target.radius`.

Ring layout (from outside in): white → red → white → red → white bullseye dot.
Five rings, each ring width = `radius / 5`.

```js
for (let i = 5; i >= 1; i--) {
  ctx.fillStyle = i % 2 === 0 ? '#cc1111' : '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, radius * i / 5, 0, TWO_PI);
  ctx.fill();
}
```

**Glitter VFX**  
On target destruction: spawn 24 particles at the target position.

```js
class GlitterParticle {
  x, y          // spawn = target centre
  vx, vy        // random direction, speed 1–4 px/frame
  life          // 0.0–1.0, decrements by 0.04/frame
  colour        // randomly from: '#fff', '#ff4444', '#ffcc00', '#ffaaaa'
  size          // 2–5px
}
```

Particles are stored in `gs.vfxList` (existing list) with `type: 'glitter'`.
`Renderer` already iterates `vfxList` — add a `'glitter'` case.

**Visibility filtering**  
In the main `drawFrame` path, when `gs.mode` is one of the TP modes:
- Retrieve `activeStation = gs.activeStation`.
- Pass only `activeStation` (not `gs.allStations`) to station-drawing routines.
- Pass only `gs.tpGame.stationData.get(activeStation.id)` targets to target-drawing routines.
- Skip trails from all other stations.

This requires `drawFrame` (or its called sub-methods) to accept an optional `visibleStation` parameter. The simplest approach: add a `_tpVisibleStationId` field on `Renderer`, set it before drawing, check it in `drawStations()` and `drawTrails()`.

---

### 4.5 `ConfigPanel` — mode and Page 5

**Mode row (Page 2 — World)**  
Add `'target-practice'` to the mode cycle: `single → tournament → target-practice → single`.  
Label: `Target Practice`.

**Page 5 — TARGET PRACTICE**  
Only rendered and navigable when `_d.mode === 'target-practice'`. Otherwise the nav dots skip it.

New `_d` fields and defaults:
```js
tpTargets:  5,         // 1 | 3 | 5 | 7 | 10 | 20
tpSize:    'MEDIUM',   // same keys as stationSize
tpRounds:   5,         // 1 | 3 | 5 | 7 | 10
tpIncludeAI: false,    // false | true
```

Page 5 rows (4 rows — fits within the 6–7 row compact budget):

| Label | Values |
|---|---|
| Targets | 1 / 3 / **5** / 7 / 10 / 20 |
| Target Size | Micro / Tiny / Small / **Medium** / Large / Giant / Mammoth |
| Rounds | 1 / 3 / **5** / 7 / 10 |
| Include AI | **Off** / On |

When mode changes away from `'target-practice'`, ensure the current page index is clamped back to 0–3 so the user is not left on a now-hidden page.

---

### 4.6 `scenarioData.js`

Add and export:

```js
export const TARGET_PRACTICE_SCENARIOS = [1, 2, 3, 6, 4, 19];
// Planetary, Asteroids, Crystal Asteroids, Jovian, Star System, Wormhole
// (using 1-based scenario IDs matching the existing SCENARIO_NAMES array)
```

`TargetPracticeSetup` picks uniformly at random from this list.

---

## 5. Game Flow (State Transitions)

```
ConfigPanel [mode=target-practice] → Start
  │
  ▼
main.js: generate scenario (from TP_SCENARIOS subset)
         TargetPracticeSetup.placeStations()
         TargetPracticeSetup.placeTargets()  →  null? re-roll scenario
         TargetPracticeSetup.runFeasibility() → selectedTargets
         construct TargetPracticeGame(selectedTargets)
         attach as gs.tpGame
         construct GameLoop → gs.mode = TP_AIMING, stationIdx = 0
  │
  ▼
[TP_AIMING] — show active station + its targets only
  human: wait for End Turn / Enter
  AI:    immediate chooseAction() → cannon only
  │
  ▼
[TP_FIRING] — single bullet in flight, stepTargetPractice each tick
  hits recorded to tpGame.stationData
  targets destroyed + glitter VFX
  bullet terminates (planet / boundary / timeout)
  │
  ├── more stations this round? → advance stationIdx → [TP_AIMING]
  │
  └── all stations fired:
        tpGame.currentRound++
        ├── rounds remain? → stationIdx = 0 → [TP_AIMING]
        └── all rounds done → [TP_RESULTS]
  │
  ▼
[TP_RESULTS] — TargetPracticeResultsScreen.show(gs)
  Play Again → re-run from scenario generation
  Main Menu  → ConfigPanel.show()
```

---

## 6. Scenario Re-roll

If `placeTargets()` returns `null`:
1. Increment a re-roll counter.
2. Pick a new scenario from `TARGET_PRACTICE_SCENARIOS` (excluding the last one tried if counter < 6).
3. Re-run `ScenarioFactory.build()`.
4. Retry `placeTargets()`.
5. After 6 consecutive failures (extremely unlikely), fall back to scenario 1 (Planetary) with N halved, log a console warning.

---

## 7. AI Behaviour in Target Practice

- AI stations call `chooseAction()` as normal, but `GameLoop._advanceTPAiming()` overrides the returned `weapon` to `WeaponId.CANNON` unconditionally.
- `_selectTarget` is called with a duck-typed object array representing the station's surviving targets, not real enemy stations. This requires a thin shim in `_advanceTPAiming()`:

```js
const mockTargets = gs.tpGame.survivingTargets(station.id).map(t => ({
  id:       t.id,
  position: t.position,
  radius:   t.radius,
  team:     null,
  status:  'active',
}));
const mockGS = { ...gs, teams: [{ stations: mockTargets, isAlive: true }] };
const action = aiBot.chooseAction(station, mockGS);
```

Pick a random surviving target from `mockTargets` as the sole target to aim at (avoids the AI wasting all 50 simulation trials across multiple targets).

---

## 8. Layer / Rendering Notes

- **Layer 0 (background)** — unchanged: star field + planets drawn once per game.
- **Layer 1 (trails)** — cleared at the start of each station's new turn (same as normal). Because only one station shoots per turn, only one trail set is visible at a time, which fits the existing clear behaviour exactly.
- **Layer 2 (live)** — active station + its targets + active bullet + glitter VFX + HUD.

HUD in TP mode:
- Top-centre: `"Team X  Station Y  — Round Z / R"` (same font as normal play).
- Bottom-left: Angle (unchanged).
- Bottom-right: Power (unchanged).
- No weapon selector, no hyperspace button.

---

## 9. Open Implementation Questions

These are not spec decisions (those are settled) but implementation risks to verify during development:

1. **`SimBot._findBestShot` duck-typing** — verify at implementation time; fix whatever the call chain needs.
2. ~~**Feasibility sim performance**~~ — **Resolved.** Total traces capped at 200, shared across all (station, candidate) pairs via `tracesPerPair = max(1, floor(200 / pairs.length))`. Worst case (6 stations × 40 candidates = 240 pairs) is still 240 single-trace calls — well within budget. Run synchronously; no async splitting needed.
3. ~~**Bullet re-entry into hit target**~~ — **Resolved.** Only the first hit counts; re-entries are ignored by skipping targets already marked destroyed in `StationTPData.targetDestroyed`. No separate flag needed.
4. **`ConfigPanel` page visibility** — confirmed risk. The existing `_checkFit` / `_applyLayout` runs on `show()`; page 5 must be excluded from nav dot count and page index range when mode ≠ `'target-practice'`, and restored cleanly when mode switches back. Test mode toggling carefully to avoid the user landing on a hidden page.
