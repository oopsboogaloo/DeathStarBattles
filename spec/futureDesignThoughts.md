# Future Design Thoughts

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
