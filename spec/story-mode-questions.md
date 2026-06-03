# Story Mode — Open Questions

Questions that need a decision before or during implementation. Grouped by priority.

---

## Critical — Must Resolve Before Starting

**Q1: Score as pass condition**
The current spec says "a player who meets all objectives but scores below `passingScore` receives MISSION FAILED." This means completing Mission 3 in 14 of 15 allowed turns (score = 100) fails if `passingScore` is 200. Is this intended? The alternative is: meeting all objectives = pass; score is a grade/rank for the leaderboard only. Which is correct?

Answer: meeting all objectives = pass; score is a grade/rank for the leaderboard only.

**Q2: Mission 2 — station control model**
The human player has 2 stations. Do they fire simultaneously (both aim circles shown at once, fire button commits both), or sequentially (aim Station 1, press fire; then aim Station 2, press fire — same as the existing multi-station turn order)? The sequential model already works with the engine; simultaneous would need new UI work.

A: same as existing multi station games

**Q3: Mission 5 — which scenario?**
No scenario is named for Mission 5 ("Contact"). Planetary (scenario 1) is assumed. Confirm, or specify a different scenario.

A: binary star
---

## High — Resolve Before Building That Mission

**Q4: Mission 13 scoring**
The mission requires collecting 10 collectables AND killing 2 enemy ships. The spec uses `combat_efficiency` which scores kills but not collectables. Should the formula reward both, e.g. `score = (collectCount × 100) + (kills × 200) − (turnsUsed × 5)`? Or is `combat_efficiency` correct and collecting 10 is purely a pass/fail gate? 

A: once the ships beam in the mission changes, score combat efficiency. PAss is winning  the fight, nobody cares about collect6ing when the fighting starts

**Q5: Mission 14 — human starting weapons**
The human patrol starts with 2 ships and 4 triple-cannon Cleverbots arrive on turn 2. Do the human ships start with cannon + hyperspace only, or should they have a small weapon loadout to level the field? If so, what? give the humans 2 blasters and 2 blunderbusses

**Q6: Debrief — "Next Mission" flow**
After clicking "Next Mission" in the debrief screen, does the game go directly to the next mission's briefing, or return to the mission select screen first? Direct-to-briefing is faster; back-to-select gives the player a sense of campaign progress.

A: return to mission selection screen

**Q7: Turn limit visibility before ambush (M13)**
Mission 13 has a 20-turn limit that starts immediately, but the enemy doesn't arrive until turn 3. Should the turn countdown be visible in the objective panel from turn 1 (showing "Turn 1 / 20" while there's no combat), or should it be hidden until the event fires?

A: show it straight away

---

## Medium — Can Defer to Implementation

**Q8: Multi-team win condition (M16–M20)**
When two AI factions eliminate each other and the human team survives without firing a shot, does the human still win and get a score? If `destroy_all` requires the human to personally kill everyone, that's a different implementation to "last team alive wins." Which is the intended objective?

A: hiding at letting them fight is a valid strategy, yes thats a win. likely a low scoring win.

**Q9: Enemy team colours in story missions**
With team 0 = human (green), team 1 = cyan, team 2 = yellow, team 3 = red... the flavour text references enemies by colour (e.g. "those cyans"). Should the flavour text strings in `StoryMissions.js` dynamically substitute the actual team colour name, or are the colour references hardcoded into the story text (which would require knowing which team index maps to which colour)?

A: yes substitute actual team colours

**Q10: Mission 11 — collectable re-roll edge case**
The spec says collectables re-roll if they would grant Cannon when `cannonEnabled: false`. Looking at the current `WEAPON_GRANTS` array in `Collectable.js` — does Cannon appear in that list? If not, the re-roll is a no-op and this can be skipped. Verify before implementing.

A: i didnt think cannon was a collectable, lets talk about this.

**Q11: M19 "small stations" — applies to enemies too?**
Mission 19 specifies "small station size." Does this apply to all 32 stations (human and all 7 AI teams), or only the human team? Applying to all is simplest and makes the game harder for everyone equally.

A: yes for all

**Q12: Passing scores — are the spec values playtested?**
The passing scores in the design spec are estimates (e.g. M3 passing = 200 = succeed within 13 turns). These all need to be tuned once the missions are playable. Should passing scores be defined as a separate config object that can be easily edited, rather than hardcoded into the mission definition?

A: nothing is playtested yet, make best guess and we will adjust

---

## Low — Nice to Know

**Q13: "Retry" in debrief — resume from turn 1 or full reload?**
Pressing "Retry" should always restart from turn 1 with the original layout. Confirm there's no intent to resume from mid-mission.

A: not resume mid mission, retry can do a full reload if that easier

**Q14: Story mode and tournament integration**
Should completing all 20 story missions unlock anything in regular tournament mode (e.g. a special scenario or cosmetic)? Or is story mode fully self-contained?

A: Lets let it unlock the starting weapon options that are hidden to devs currently. Just that starting weapon option not any other dev features we add. Startign weapons should apply to target pracice mode too (on a branch right now)

**Q15: Story mode accessible during demo?**
The first-run demo auto-plays before the player interacts. Should the "Story Mode" button be visible during the demo, or only after the player dismisses it and interacts with the main menu? Only in the menu its an option int he menu - MODE, not a special button

**Q16: Mission 12/13 layout — reuse or copy?**
Missions 12 and 13 use "the same asteroid field." Should the layout data be literally shared (same `layout` reference, or a `layout: 'm12-layout'` pointer), or should each mission have its own copy of the planet/collectable definitions?
A: own copy its a big asteroid field each play is like a differnt part of it, doesnt need to be the same
---

## Answered

**Q1 — Score as pass condition:** Objectives met = pass. Score is a leaderboard grade only; does not gate the unlock or show MISSION FAILED.

**Q2 — Mission 2 station control:** Sequential, same as existing multi-station turn order. No new UI work needed.

**Q3 — Mission 5 scenario:** Binary Star (scenario 5).

**Q4 — Mission 13 scoring:** Once enemies arrive the mission reorients to combat. No initial collect objective is tracked. Pass = destroy all enemies. Score = `combat_efficiency`. Collecting crystals is tactical (gives weapons), not scored.

**Q5 — Mission 14 human starting weapons:** 2 blasters and 2 blunderbusses. `startingWeapons: { blaster: 2, blunderbuss: 2 }`.

**Q6 — Debrief "Next Mission" flow:** Returns to the mission select screen, not directly to the next briefing.

**Q7 — Turn countdown before M13 ambush:** Show the countdown from turn 1. Objective panel shows "Turn 1 / 20" even before enemies arrive.

**Q8 — Multi-team win condition (M16–M20):** Last team alive wins. Letting AI factions eliminate each other is a valid (low-scoring) strategy. `destroy_all` = all non-human teams eliminated, regardless of who dealt the kills.

**Q9 — Enemy colour substitution:** Yes, substitute `{enemy1}`, `{enemy2}` placeholders in story text with the actual team colour name at render time.

**Q10 — Cannon in WEAPON_GRANTS:** Cannon is not in `WEAPON_GRANTS` — it is the default weapon, not a collectable reward. No re-roll logic needed. The `cannonEnabled: false` guard only touches the firing path and weapon selector UI.

**Q11 — M19 small stations:** Applies to all stations (human and all 7 AI teams). `settings.stationSize: 'small'` for the whole mission.

**Q12 — Passing scores:** Best guesses for now; will be tuned after playtesting. Values are in the mission definitions and easy to change.

**Q13 — Retry behaviour:** Full reload from turn 1. No mid-game resume.

**Q14 — Campaign completion reward:** Completing all 20 missions unlocks the Starting Weapons config option (currently hidden). This applies to both the main config panel and Target Practice mode. Flag stored as `campaignComplete: true` in `dsb_story` localStorage.

**Q15 — Story mode entry point:** Story Mode is a MODE option in the config panel (alongside Single Game / Tournament). Not a separate button. Only visible when the config panel is active (not during the demo).

**Q16 — M12/M13 layout:** Each mission has its own copy of the layout data. They use the same field type (Rich asteroid field around a gas giant) but are treated as different parts of the same sector, not the same map.
