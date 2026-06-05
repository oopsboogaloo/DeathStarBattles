# Map Seed UX Redesign Spec

## Problem

The single map seed field served two purposes — showing the generated seed and accepting user overrides. To get a random map after having typed a seed the user had to manually clear the field, which was unintuitive.

---

## Solution

Split into two fields with distinct roles.

### Current Map Seed (read-only)

- `<input readonly>` — selectable but not editable
- Always populated with the seed actually used when the last game started
- Selectable so you can copy it and paste it into Override to replay that map
- Starts empty (no game has run yet)
- Updated by `setGeneratedSeed()` after each game starts; the game never writes to the Override field

### Override Seed (editable)

- `<input>` — editable, blank by default
- If blank → game generates a random seed, which is shown in Current Map Seed
- If filled → game uses that exact seed, which is shown in Current Map Seed
- Never auto-cleared or auto-filled by the game

---

## Sub-row visibility

The Planets and Scenario sub-rows (which allow locking specific values when a seed is pinned) remain hidden while Override is blank and visible when non-empty — keying off the Override field exactly as the old combined field did.

---

## Data model

`cfg.mapSeed` renamed to `cfg.overrideSeed`. No other config fields change.

---

## Flow examples

| Scenario | Override field | Result |
|---|---|---|
| Normal play | blank | Fresh random map each start; Current Seed updates |
| Replay a map | paste seed from Current Seed | Exact same map reproduced |
| Back to random | clear Override | Next start is random again |
| Share a map | read Current Seed, give to friend | Friend pastes into their Override |

---

## Files changed

| File | Change |
|---|---|
| `src/ui/ConfigPanel.js` | Replace single `_seedRow()` with `_currentSeedRow()` + `_overrideSeedRow()`; rename `_d.mapSeed` → `_d.overrideSeed`; update `setGeneratedSeed()` to write only to the read-only display |
| `src/main.js` | `cfg.mapSeed` → `cfg.overrideSeed` |
