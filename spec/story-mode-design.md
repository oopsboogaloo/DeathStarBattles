# Story Mode — Design Document

> This document covers the *why* and *what* of Story Mode. For the data schema and mission definitions see `requirements.md §13`. For implementation detail see `story-mode-spec.md`.

---

## 1. What Is Story Mode?

Story Mode is a structured single-player campaign of 20 pre-designed missions that teach the game progressively. Each mission is a complete game round with a fixed layout, defined objectives, and a short narrative framing it as a military training exercise or combat operation.

It exists to solve a core onboarding problem: DeathStarBattles has deep mechanics (gravity physics, 9 weapons, 5 AI levels, 28 scenarios, collectables, movement) but no guided path through them. A new player who jumps into a standard game against Megabots in a wormhole field has no idea what they're doing or why. Story Mode is the answer — a campaign that introduces mechanics one at a time and gives players a reason to keep going.

---

## 2. Design Goals

1. **Teach by doing** — every mission introduces or emphasises exactly one mechanic. The player learns by playing, not by reading.
2. **Always feel achievable** — early missions are winnable on the first or second attempt. Later missions are hard but fair.
3. **Build tension** — the campaign arc escalates from a quiet firing range to a 32-station war across wormhole space.
4. **Reward mastery** — completing the full campaign unlocks a hidden game feature. Score-chasing keeps replayable missions interesting.
5. **Get out of the way** — no lengthy tutorials, no dialog boxes between turns. The briefing is 3 sentences. Then you play.

---

## 3. Player Experience Flow

```
Main Menu
  └─ Mode: Story Mode
       └─ Mission Select Screen
            ├─ Locked missions (visible, greyed out)
            └─ Unlocked mission card → click
                 └─ Mission Briefing Overlay
                      └─ "Start Mission"
                           └─ Game (standard engine, story layout)
                                ├─ In-game Objective Panel (top-right HUD)
                                ├─ [optional] Mid-mission Dialog Popup (pauses game)
                                └─ Mission ends → Debrief Screen
                                     ├─ MISSION COMPLETE → score + best score badge
                                     │    ├─ Retry (improve score)
                                     │    └─ Next Mission → Mission Select
                                     └─ MISSION FAILED
                                          ├─ Retry
                                          └─ Next Mission (greyed if still locked)
```

**What stays out of the way:** no config panel during story missions. All settings are locked to the mission definition. The player can't accidentally set themselves to Micro stations against Megabots.

**What persists:** mission unlock state and best scores, stored in `localStorage`. Progress survives browser restarts. Completing all 20 missions reveals a hidden config option (Starting Weapons) in both the main game and Target Practice mode.

---

## 4. Campaign Arc

The 20 missions form four distinct phases:

### Phase 1 — Basic Training (M1–M4)
*No enemies. Learn the physics.*

The player is a raw recruit on a firing range. Targets don't shoot back. Each mission introduces one core concept:
- **M1** — Crystal asteroids don't block bullets (pass-through mechanic)
- **M2** — Multi-station coordination (control two ships yourself)
- **M3** — Hyperspace as a tactical tool (escape a gravity well to take the shot)
- **M4** — Collectables give weapons (always Blasters; collection chains through multiple in one shot)

These missions are low-stakes and forgiving. The player should complete each one on their first or second attempt.

### Phase 2 — Live Fire (M5–M11)
*Enemies fight back. Learn to fight.*

The player steps out of training and into combat. Each mission adds a new layer of complexity:
- **M5** — Binary Star, 1v1, first live opponent
- **M6** — Gas Giants, 1v1, harder gravity
- **M7** — 2v2, coordination vs AI
- **M8** — 4v4, squads, Cleverbot
- **M9** — 6v6, platoons, Superbot, wormholes
- **M10** — 8v8, line of battle, one Minigun each (when do you use it?)
- **M11** — Rockets only, no cannon, map opens up as asteroids are destroyed

Difficulty escalates steadily. By M11 the player has used every major weapon type in a combat context.

### Phase 3 — Field Operations (M12–M16)
*The war gets complicated.*

Missions shift from pure combat training to scenarios with story complications:
- **M12** — Mining duty: collect 10 crystals in 20 turns, no enemies (calm before the storm)
- **M13** — Ambush: same field, but enemies warp in at turn 3 and the mission pivots entirely to combat
- **M14** — Patrol: 2 ships, then 4 triple-cannon Cleverbots arrive on turn 2 (player has Blasters + Blunderbusses)
- **M15** — Outnumbered: 3 vs 6, same weapons both sides
- **M16** — Three-way: two enemy factions, rich asteroid field, rockets — letting them fight each other is valid strategy

The mid-mission event mechanic (M13, M14) teaches the player that situations change. A mission that starts as one thing can become something else entirely.

### Phase 4 — Total War (M17–M20)
*Everything at once.*

Large-scale chaotic battles with the hardest AI and unique constraints:
- **M17** — 4 factions of 2, heavy loadout, Superbots, Red Giant
- **M18** — 6 factions of 3, lasers only, white dwarf bends every shot
- **M19** — 8 factions of 4, Megabots, wormhole space, small stations — 32 ships total
- **M20** — 4v4, Megabots, micro stations, black hole + comets. The finale.

M19 and M20 are genuinely hard. The player who reaches them will have earned all the skills needed to survive.

---

## 5. Key Design Decisions

### Pass on objectives, score for pride
Meeting all mission objectives = MISSION COMPLETE, regardless of score. Score is a leaderboard grade displayed on the debrief screen. This removes the frustrating situation where a player completes a hard mission on the last possible turn and gets FAILED because they scored 0 on a time-bonus formula. A pass is a pass. Score only matters for replay.

### Linear unlock, free replay
Missions unlock in sequence. Once unlocked, any mission can be replayed any number of times for a better score. This keeps the campaign directed (you can't skip ahead to M20) while letting players revisit missions they want to master.

### Narrative as a thin wrapper, not a game
Story text is 2–4 sentences in a military boot camp voice. No cutscenes, no extended dialogue, no named characters. The narrative exists to give each mission a reason and a mood — nothing more. Players can skim it and hit Start immediately.

### Enemies referenced by colour, not name
Enemy faction names are their team colour: "those cyans", "the reds". This is both IP-neutral and consistent — the colour is something the player can see on screen, so it anchors the briefing text to the actual game state. Story text uses `{enemy1}` placeholders that resolve to the real team colour name at render time.

### Mid-mission events for story beats
Missions 13 and 14 use the event system to introduce enemies partway through, completely changing the nature of the mission. M13 starts as a quiet collection run and becomes a firefight. M14 starts as a patrol and becomes a 4-on-2 ambush. These missions teach the player to stay adaptable. The event system is general-purpose and reusable for future missions.

### Target stations as non-firing dummies
Training missions use `role: "target"` stations — they look different (dark red with a pulsing ring) and never fire. This lets the game engine run normally (same physics, same bullet resolution) without needing a separate "target practice" code path for story missions. The distinction between a live opponent and a dummy is purely in the station's role field.

### Drone visual for combat AI
AI opponents in story missions use `visualStyle: "drone"` — an angular, mechanical station shape instead of the standard death star sphere. This signals visually that these enemies fight back, differentiating them from non-firing targets. It has no gameplay effect.

### Campaign completion unlocks Starting Weapons
Completing all 20 missions reveals the Starting Weapons config option, which is otherwise hidden. This is a deliberate reward for players who finish the campaign — it gives them a new toy to experiment with in regular games and Target Practice. Only Starting Weapons is unlocked; no other hidden options are exposed.

### Data-driven mission definitions
Every mission is a plain JavaScript object in `STORY_MISSIONS[]`. The game engine reads it and configures itself — no mission-specific branching logic in the engine code. Adding a new mission or changing an existing one is a data edit, not a code change. This makes iteration fast and keeps the engine clean.

---

## 6. What Story Mode Is Not

- **Not a tutorial with pop-up instructions.** Mechanics are introduced through scenario design, not text boxes.
- **Not a narrative game.** The story is flavour, not the point.
- **Not a separate code path for physics.** The standard `GameLoop`, `PhysicsEngine`, and `Renderer` run unmodified. Story mode is a setup layer, not a fork.
- **Not synced across devices.** `localStorage` means progress is per-browser. No accounts, no server.
- **Not resumable mid-mission.** Retrying a mission always restarts from the beginning.

---

## 7. Relationship to Other Docs

| Doc | Purpose |
|---|---|
| `requirements.md §13` | Complete design spec: mission definitions, schema, all 20 mission layouts |
| `story-mode-spec.md` | Engineering spec: file map, class definitions, engine hooks, implementation order |
| `story-mode-questions.md` | All open questions and resolved decisions |
| This doc | Motivation, player experience, campaign arc, design rationale |
