# DeathStarBattles — Issues & TODO List

Issues and improvements to address. Add new items below with a short description.

---

## Bugs

- [x] **Wormhole trail continuity** — fixed.
- [x] **Star corona draws over other planets** — fixed via two-pass rendering.
- [x] **Explosions too fast** — fixed (moved out of inner loop; slowed rates; resultsTimer 240).
- [x] **Ghost trails from previous turn not showing** — fixed: trail now saved inside inner loop at the moment bullet transitions from ACTIVE, rather than relying on a post-loop condition check.
- [x] **Wormholes spawning inside stars/planets** — fixed: `_addBonus` now checks each candidate against existing planets and retries position up to 20 times before placing.

## Improvements

- [x] **Ghost trail of previous shot** — implemented and fixed.
- [x] **Aiming indicator line length reflects power** — fixed.
- [x] **Off-screen bullet indicator** — implemented; triangle at canvas edge, distance number inset.
- [x] **Off-screen indicator layout swap** — done: triangle at very edge, number inset ~30px.
- [x] **Reduce station sizes by 60%** — all StationSize radii × 0.4; dome/trench thresholds lowered.
- [x] **Game speed control** — Slow (30 steps/frame) / Normal (60) / Fast (120) cycle in config panel; passed to GameLoop as `speed` param.
- [x] **Hold-down angle/power HUD buttons** — AimControls DOM component with ◄/► buttons, hover + depress states, acceleration from 1→10 units/tick over ~1 s of holding.
- [x] **Improved star field background** — layered value noise density map (two octaves); 3500 small transparent stars (0.4–1.4px mostly); RGBA blending builds up colour in dense regions; composited through 1.2px blur for nebula texture.

## Polish

<!-- e.g. [ ] Sound effects -->
