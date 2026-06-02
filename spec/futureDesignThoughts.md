# Future Design Thoughts

---

## FEATURE: Config Panel Pagination

**Status:** Spec complete — ready to implement

---

### 1. Problem

The config panel has no `maxHeight`, so when the Advanced section is expanded it can overflow the viewport on short screens (laptops ~650 px tall, phones, tablets in landscape). `minWidth: 460px` also breaks layout on narrow mobile.

---

### 2. Behaviour Summary

| Condition | Layout |
|---|---|
| Panel fits in viewport | Existing layout — 4 primary rows + collapsible Advanced section |
| Panel does not fit | Paged mode — 3 pages, page navigation bar, Start button pinned |

"Fits" = `panel.scrollHeight ≤ window.innerHeight × 0.92` after the DOM has rendered. Checked on every `show()` call and whenever the window is resized via `ResizeObserver`.

---

### 3. Paged Mode — Page Contents

| Page | Label | Rows |
|---|---|---|
| 1 | **Setup** | Players, Human / CPU, Stations / Player, CPU Level |
| 2 | **World** | Station Size, Planets, Scenario, Mode, Game Speed, Movement Speed |
| 3 | **Options** | Performance, Team Clustering, Wildcard Planets, Collectables, Aim Circle Size, Minimal UI |

~6 rows per page, balanced and fits even at 568 px viewport height.

---

### 4. Paged Mode — Layout

```
┌────────────────────────────────────┐
│  ▶ RESUME GAME  (if applicable)    │  ← pinned top, conditional
│  Death Star Battles                │  ← title
├────────────────────────────────────┤
│                                    │
│  [page content — rows for page N]  │  ← scrollable if still needed
│                                    │
├────────────────────────────────────┤
│         ●  ○  ○    (page dots)     │  ← page indicator
│         ◄  NEXT ►                  │  ← prev / next buttons
├────────────────────────────────────┤
│         [ START GAME ]             │  ← pinned, all pages
│   About  Instructions  …           │  ← info links, all pages
└────────────────────────────────────┘
```

- **Page dots**: three filled/hollow dots (`●` / `○`) indicating current page. Clicking a dot jumps directly to that page.
- **Prev / Next**: `◄ PREV` (disabled on page 1) and `NEXT ►` (disabled on page 3). Text labels, not arrows only, so intent is clear on touch.
- **Start button**: always visible, all pages — player does not need to navigate to a specific page to start.
- **Resume button**: pinned above title when `_canResume` is true, same as non-paged mode.
- **Info links**: same row, all pages.
- **Panel height**: capped at `min(92vh, 640px)` in paged mode; content area gets remaining height after header + footer. Content area is `overflow-y: auto` as a safety net if a page still overflows on an extreme screen.
- **Panel minWidth**: reduced from `460px` to `320px` in paged mode to fit narrow mobile.

---

### 5. Non-Paged Mode (Large Screens)

No changes to the existing layout. The Advanced collapsible (`＋ ADVANCED`) remains. Paged mode is never shown on a screen where the panel fits.

If the window is resized while the panel is open and the layout switches mode (fit → no-fit or vice versa), `_applyLayout()` is called again immediately to rebuild the content area.

---

### 6. Page Transitions

Simple instant swap (no animation). The content area's children are toggled `display: block / none`. Instant is appropriate: the panel already has no transitions except the Advanced collapse, and adding a slide/fade would complicate implementation for minimal benefit on a config screen.

---

### 7. Implementation Notes

**One file**: all changes in `src/ui/ConfigPanel.js`.

**New private state:**
```js
this._pagedMode   = false;
this._currentPage = 0;          // 0-indexed
this._pageEls     = [];         // array of 3 DOM div elements (one per page)
this._dotEls      = [];         // array of 3 dot span elements
this._resizeObs   = null;       // ResizeObserver instance
```

**New private methods:**
- `_checkFit()` — measures `panel.scrollHeight` vs `window.innerHeight * 0.92`; calls `_applyLayout(fits)` if mode needs to change.
- `_applyLayout(paged)` — rebuilds the content area: if `paged`, hides the flat section and shows the paged container; if not, hides paged container and shows flat section. Sets `_pagedMode`.
- `_buildPagedContainer()` — builds the 3-page DOM structure with nav bar (dots + prev/next) and wires up interactions; called once in `_build()`, kept hidden until needed.
- `_showPage(n)` — hides all `_pageEls`, shows `_pageEls[n]`, updates dots and button disabled states. Updates `_currentPage`.

**`_build()` changes:**
1. Build the existing primary rows + Advanced section into a `_flatSection` div (unchanged).
2. Also build the paged container div (`_pagedContainer`) — initially hidden.
3. Both live inside the panel; `_applyLayout()` switches which is visible.
4. Attach `ResizeObserver` on the panel; call `_checkFit()` on observe.

**`show()` change:**
After `this.element.style.display = 'flex'`, call `this._checkFit()` (one rAF delay to let layout settle: `requestAnimationFrame(() => this._checkFit())`).

**Row sharing**: The actual row DOM nodes (the `_cycle` and `_row` elements) are created once and moved into either the flat section or the appropriate page div. They are not duplicated — the same DOM node appears in one place at a time. This keeps `_d` state and `_refresh()` references working unchanged.

---

### 8. Files Changed

| File | Change |
|---|---|
| `src/ui/ConfigPanel.js` | All changes — pagination logic, paged container, `_checkFit`, `_applyLayout`, `_showPage`, ResizeObserver |

---

### 9. Resolved Decisions

| Question | Decision |
|---|---|
| Page count | 3 (Setup / World / Options) |
| Start button in paged mode | Always visible — pinned on all pages |
| Large screen behaviour | Keep existing collapsible Advanced — no change |
| Page transition animation | None — instant swap |
| Dot indicator | 3 dots, clickable, filled = current page |
| Panel min-width in paged mode | 320px (reduced from 460px) |
| Fit detection threshold | `scrollHeight > innerHeight × 0.92` |
| Resize handling | ResizeObserver re-checks on every panel resize |

---

## FEATURE: Special Weapons & Collectables

**Status:** Implemented ✅

---

### 1. Overview

Replace the single Hyperspace button with a **weapon selector**. During the aiming phase each station picks a weapon. Two default weapons exist with infinite uses; collectable weapons have limited uses and are acquired by destroying collectables scattered around the map.

---

### 2. Weapon Selector UI

The current "Hyperspace" button becomes the **active weapon button**:

- The button label always shows the currently selected weapon (e.g. "CANNON", "HYPERSPACE", "TRIPLE CANNON [3]")
- Clicking the button (or pressing **H**) opens a **vertical popup list** appearing above the button (like a context menu)
- The selector lists every available weapon. Limited-use weapons show remaining uses in brackets. Example:

  ```
  ┌──────────────────────┐
  │  TRIPLE CANNON  [3]  │
  │  HYPERSPACE     (∞)  │
  │  CANNON         (∞)  │  ← popup
  └──────────────────────┘
    [ CANNON          ▲ ]  ← button
  ```

- Selecting a weapon closes the popup and updates the button label
- The selected weapon applies to this station's turn only; it does not persist to the next turn (resets to Cannon)
- If only Cannon and Hyperspace are available (no collectables), H toggles directly between them as before — no popup needed

---

### 3. Default Weapons (always available, infinite uses)

| Weapon | Behaviour |
|---|---|
| **Cannon** | Standard single bullet. Existing fire behaviour unchanged. |
| **Hyperspace** | Teleport station to random valid location. Existing hyperspace behaviour unchanged. |

---

### 4. Special Weapon: Triple Cannon

- Fires **3 bullets simultaneously**, each on the same power but at angles: `[selected − 5°, selected, selected + 5°]`
- Each bullet is an independent physics entity with its own trail in the team colour
- All three obey standard gravity; each can independently hit stations, planets, or exit bounds
- One use is consumed per firing (not per bullet)
- Usually only available as a collectable (not in the default loadout)
- All AI levels use collectables they happen to possess (RandBot fires randomly; SimBots treat it as three independent shots)
- **SuperBot and MegaBot** will opportunistically aim for collectables: when selecting a target, they factor in proximity to a collectable and may choose a shot that passes near one

---

### 5. Collectables

> **Naming note:** In code and all docs, these entities are called `Collectable` / `collectables`. The name `Crystal` / `crystal` is **reserved** for a separate future entity type.

#### 5.1 Entity

- New entity: `Collectable`
- Stationary — not affected by gravity, does not move
- Does **not** stop bullets — a bullet passes straight through and the collectable is destroyed
- Persists on the map until destroyed; does not expire naturally
- Belongs to no team

#### 5.2 Appearance

- Rotating geometric gem shape (multi-pointed, faceted — like a gemstone or snowflake outline)
- **Colour: icy blue-white** — cold crystalline look, high contrast against the dark star field
- Subtly glows or pulses to remain visible against the star field
- Rotation is continuous and purely visual (no gameplay effect)
- Size: small — roughly comparable to a Tiny station icon

#### 5.3 Spawn Rules

- Spawn timing: **end of each turn**, after all bullets have resolved and explosions are complete
- Spawn probability: controlled by the Collectables config option (see §6)
- Spawn location: random valid position — not inside any planet radius, not within ~2× station hit radius of any station
- **Maximum 3 collectables on the map simultaneously** — if already at the cap, no new collectable spawns that turn
- Collectables **do not** spawn in the Hyperspace scenario (no planets but also chaos enough)

#### 5.4 Destruction & Reward

When a bullet destroys a collectable:

1. **Collectable shatter VFX**: particle/shard burst from the collectable position (shards fly outward, fade quickly)
2. **Collectable grant text**: the name of the collectable (e.g. "TRIPLE CANNON") fades in then out at the collectable position, drawn in the **team colour of the bullet's owner**. Text rises slightly while fading.
3. The **bullet continues** on its original trajectory — unaffected
4. The bullet owner's team gains **3 uses** of Triple Cannon
5. Special weapon stocks are **shared across all stations on a team** — any station can spend them
6. Stocks **carry over between tournament games** — a team can accumulate a stockpile across the tournament

---

### 6. Collectables Config Option

New entry in the Environment config panel:

| Label | Spawn probability per turn end |
|---|---|
| Off *(default)* | 0% — collectables disabled entirely |
| Rare | 20% |
| Normal | 40% |
| Common | 75% |
| Continuous | 100% — one collectable always spawns each turn |

"Probability" means: at end of turn, roll once; on success, spawn one collectable at a random valid location.

---

### 7. New / Modified Files

| File | Change |
|---|---|
| `src/entities/Collectable.js` | New entity: position, rotation angle, alive flag |
| `src/rendering/Renderer.js` | Collectable rotation animation, shatter VFX, collectable grant text (integrated into main renderer) |
| `src/ui/WeaponSelector.js` | Popup selector UI; manages selected weapon per station turn |
| `src/core/GameState.js` | Track active collectables array; team weapon stocks |
| `src/entities/Team.js` | `weaponStock: Map<WeaponId, number>` — team-shared collectable counts |
| `src/physics/PhysicsEngine.js` | Bullet–collectable collision: destroy collectable, award team, bullet continues |
| `src/scenarios/ScenarioFactory.js` | No collectables at game start; spawn logic called from GameLoop turn-end |
| `src/ui/ConfigPanel.js` | Add Collectables option |
| `src/input/InputHandler.js` | H key: toggle or open selector based on weapon count |

---

### 8. Resolved Decisions

| Question | Decision |
|---|---|
| Collectable colour | Icy blue-white |
| Uses per collectable | 3 Triple Cannon shots |
| Max collectables on map | 3 simultaneously |
| Weapon selector popup style | Vertical list above button (DOM context menu) |
| AI and collectables | SuperBot + MegaBot aim opportunistically; lower bots use passively |
| Triple Cannon muzzle VFX | Brief triple-arc flash on station before bullets launch |
| Tournament persistence | Weapon stocks **carry over** between tournament games |
| Excluded scenarios | Hyperspace scenario only — no collectable spawns |

---

## TODO: AI Code Audit Findings

**Status:** Analysis complete — fixes pending

**Bugs fixed this session:**
- MegaBot always targeted human player (Team 1) when scores were tied at 0 — stable sort bias. Fixed with random tiebreaker.
- MegaBot movement broken — `SimBot` not imported, `SimBot._netGravity` threw ReferenceError 30% of the time. Fixed by using `SuperBot._netGravity`.

**Remaining concerns to revisit:**

1. **SimBot `_mem` map leaks dead station IDs** — entries for dead stations accumulate during a game, never pruned. Minor memory waste in long games. Fix: clear entries when a station dies, or prune the map periodically.

2. **SuperBot movement has no friendly-distance check** — MegaBot suppresses movement that would cluster friendly stations, SuperBot doesn't. Stations can accidentally bunch up at level 4. Fix: port MegaBot's friendly-distance guard into SuperBot.

3. **CleverBot only gets 2 simulation trials before turn 8** — `max(2, floor(8/4)) = 2` trials is barely better than guessing. Very weak for the first 8 turns. Consider whether the ramp-up is too steep or whether a floor of 4 would be better.

4. **AimBot `_randomEnemy` duplicates SimBot `_selectTarget`** — identical logic in two places. Minor code smell, could be consolidated.

5. **All movement bots return velocity when station movement is disabled** — unnecessary computation. Low priority.

---

## TODO: Force First Game Simplicity (New Player Onboarding)

**Status:** Not started

**Idea:** On the very first game of a fresh site load, override the Lucky Dip scenario selection to keep things simple. New players dropped straight into Black Holes or Big Wormhole have no chance to learn the basics before the game becomes chaotic.

**Proposed behaviour:**
- Track whether this is the first game of the session (a simple `let firstGame = true` flag in main.js, cleared after the first `startGame` call)
- If `firstGame` and Lucky Dip is selected, restrict `weightedRandomId` to scenarios 1–5 (Planetary, Asteroids, Star System, Binary Star, Jovian) — the common, readable scenarios
- Does not affect manually selected scenarios — only Lucky Dip
- Does not persist across page reloads (session only is fine; a returning player reloading already knows the game)

**Where to implement:**
- `src/main.js` — add `let firstGame = true` flag, pass it into the scenario selection logic at line ~324
- `src/scenarios/scenarioData.js` — optionally add a `simpleRandomId(rng)` export that picks only from 1–5, or just inline the cap in main.js
- Also pass `wildcardFrequency: 'off'` override into `ScenarioFactory.create` when `firstGame` is true — wildcards (wormholes, black holes injected mid-scenario) are an extra layer of chaos a new player doesn't need on their first game

## Known Issue: Canvas Blur Broken on iPad (WebKit)

**Status:** Known platform quirk — not yet fixed

**Symptom:** All blur effects (star coronas, gas giant stripe softening, star body blur, starfield) are silently no-ops on iPad regardless of browser (Chrome, Safari, Firefox all use WebKit on iOS/iPadOS). Visuals still work — just crisper edges.

**Root cause:** We apply `ctx.filter = 'blur(Npx)'` on the main canvas context during `drawImage` calls from offscreen canvases. WebKit has a long-standing bug with this specific pattern — filter during `drawImage` — even on iPadOS 26 where `ctx.filter` is otherwise supported.

**Fix options:**
1. Apply blur on the offscreen canvas *before* blitting (draw blur on `oc` not on `ctx`) — would require restructuring each blur site
2. Use `CanvasRenderingContext2D.filter` only for direct draws, avoid it on `drawImage` paths
3. Detect the broken pattern at startup and auto-enable simplified mode on iPad

**Priority:** Low — game is fully playable without blur.

---

## Star Field — Emissive Halo Bloom

**Status:** Parked — worth revisiting

**Idea:** Give each star a soft glow disc beyond its physical radius to mimic an emissive/bloom look. Instead of the gradient fitting inside the star's own pixel radius, extend it to `pr * N` and let it bleed outward.

**What was tried:**
- Current code (Renderer.js `_drawStarField`, line ~123) already has a radial gradient per star with a white-boosted core and a steep falloff near the edge — this replaced the original flat filled circles + 1.2px blur composite.
- A `pr * 3` halo was tested but caused very large stars (the rare outliers with `gr` up to 3.4 game units) to blow out into huge glowing blobs.

**The problem to solve:** Most stars are 0.5–2px on screen — too small for an internal gradient to read visually. The gradient only becomes apparent on the larger outlier stars, which then overdo it at 3× scale.

**Promising directions:**
1. Separate the glow from the dot — tiny solid dot at `pr`, plus a second soft disc at `pr * 1.8` with a hard cap on max pixel size (e.g. `Math.min(pr * 1.8, 6)`), so outliers don't blow out.
2. Shift the size distribution up — more stars in the 1–3px range so the gradient has room to read, while capping the rare large ones.
3. Combine gradient with a light blur (0.5–0.7px instead of the original 1.2px) to soften hard edges without losing the emissive character.
