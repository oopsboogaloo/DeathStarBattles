# Target Practice Mode — Implementation Plan

Phases are ordered by dependency. Complete each phase before starting the next.

---

## Phase 1 — Foundation

1. Add `TP_SETUP`, `TP_AIMING`, `TP_FIRING`, `TP_RESULTS` to `GameMode` in `GameState.js`; add `tpGame = null` field
2. Create `src/entities/PracticeTarget.js`
3. Create `src/core/TargetPracticeGame.js` (`StationTPData`, hit/accuracy tracking, `hitRate()`, `meanAccuracy()`)
4. Export `TARGET_PRACTICE_SCENARIOS` from `scenarioData.js`

---

## Phase 2 — Setup Pipeline

5. Create `src/core/TargetPracticeSetup.js` — `placeStations()` (edge placement + planet avoidance)
6. Add `placeTargets()` to same file (grid placement, planet avoidance, returns `null` on failure)
7. Add `runFeasibility()` — shared 200-trace budget; verify SimBot duck-typing here
8. Wire scenario re-roll loop in `main.js` (up to 6 attempts, fallback to scenario 1 with N halved)

---

## Phase 3 — Physics

9. Add `stepTargetPractice()` to `PhysicsEngine` — pass-through hit detection, accuracy calculation, skip already-destroyed targets

---

## Phase 4 — Game Loop

10. Add `_advanceTPAiming()` to `GameLoop` — sequential single-station turns, AI mock-target shim, cannon-only override
11. Add `_advanceTPFiring()` — drive `stepTargetPractice`, record hits, advance station → round → results

---

## Phase 5 — Rendering

12. Add `Renderer.drawTarget()` — five concentric bullseye rings (white/red alternating)
13. Add glitter VFX type to `vfxList` handling
14. Add visibility filtering — `_tpVisibleStationId` guard in `drawStations()` and `drawTrails()`
15. Add round counter to HUD (`Round Z / R` alongside team/station name)

---

## Phase 6 — UI

16. `ConfigPanel` — add `'target-practice'` to mode cycle; add Page 5 with 4 rows; handle page-index clamping when mode changes *(confirmed risk — see design doc §9 item 4)*
17. Create `src/ui/TargetPracticeResultsScreen.js` — hit rate + accuracy table, Play Again / Main Menu buttons

---

## Phase 7 — Wiring

18. Wire full TP start flow in `main.js` (setup → `GameLoop` → results screen callbacks)
19. Smoke test: 1 human station, 1 target, 1 round, end to end

---

## Phase 8 — Edge Cases & Polish

20. Test AI path (Include AI = On — verify mock-target shim, cannon-only override)
21. Stress test max config (6 stations, 20 targets, 10 rounds — check feasibility budget and perf)
22. Stress test `ConfigPanel` page 5 toggling — mode switching must not leave user on a hidden page
