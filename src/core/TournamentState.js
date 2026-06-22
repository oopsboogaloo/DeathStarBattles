// Copyright © 2026 Chloe Bolland
// contact chloe@mammoththoughts.com if you wish to use, publish or reproduce this game or any part of it in any way

import { WEAPON_GRANTS } from '../entities/Collectable.js';

// Awards rework (new-weapons-spec §21). Each award's value() returns a sortable
// number over the 5-game window, or null when the team is ineligible. tie() is a
// secondary sort key (higher wins). Two KILL + one MISC award are shown per
// ceremony, with a preference for distinct winning teams.
const KILL_DEFS = [
  { key: 'bloodlust',  value: t => t.kills          >= 1 ? t.kills          : null },
  { key: 'strategy',   value: t => t.strategyKills   >= 1 ? t.strategyKills   : null },
  { key: 'oppression', value: t => t.oppressionKills >= 1 ? t.oppressionKills : null },
  { key: 'tactics',    value: t => t.tacticsKills    >= 1 ? t.tacticsKills    : null },
  { key: 'bully',      value: t => t.bullyKills      >= 1 ? t.bullyKills      : null },
  { key: 'vengeance',  value: t => t.vengeanceKills  >= 1 ? t.vengeanceKills  : null },
  { key: 'longshot',   value: t => t.longestKillDist >  0 ? t.longestKillDist : null },
  { key: 'pointblank', value: t => t.closestKillDist <  Infinity ? -t.closestKillDist : null },
  { key: 'trickshot',  value: t => t.bestTrickshotEvents >= 1 ? t.bestTrickshotEvents : null,
                       tie:   t => t.bestTrickshotDist },
];
const MISC_DEFS = [
  { key: 'owngoals',    value: t => t.selfHits >= 1 ? t.selfHits : null, tie: t => -(t.selfHitMinDist ?? Infinity) },
  { key: 'greedy',      value: t => t.collectablesGrabbed >= 1 ? t.collectablesGrabbed : null, tie: t => t.collectableTierSum },
  { key: 'worstshot',   value: t => t.shots >= 5 ? -(t.accuracyPct) : null, tie: t => t.shots },
  { key: 'rockbreaker', value: t => t.rockHits >= 1 ? t.rockHits : null },
  { key: 'runner',      value: t => t.distanceMoved > 0 ? t.distanceMoved : null },
  { key: 'spacedout',   value: t => t.hyperspaceCount >= 1 ? t.hyperspaceCount : null },
];

const SUM_FIELDS = ['kills', 'strategyKills', 'oppressionKills', 'tacticsKills', 'bullyKills',
  'vengeanceKills', 'shots', 'hits', 'selfHits', 'collectablesGrabbed', 'collectableTierSum',
  'rockHits', 'distanceMoved', 'hyperspaceCount'];

export class TournamentState {
  constructor() {
    this.gameIndex       = 0;          // games completed so far
    this._data           = new Map();  // teamIndex → cumulative data
    this._gameHistory    = [];         // per-game snapshots: Map<teamIndex, perGameStats>[] (§21)
    this._awardHistory   = [];         // array of string[] — keys shown at each interval
    this.lastRewards     = null;       // { teamIndex, teamLabel, teamColour, grants } | null
    this.lastAwardPrizes = null;       // [{ key, teamIndex, teamLabel, teamColour, grants }] | null
    this._cachedAwards      = null;    // memoised awards() result for current gameIndex
    this._cachedAwardsIndex = -1;
  }

  // Ensure entries exist for all teams in the current game
  _ensure(teams) {
    for (const t of teams) {
      if (!this._data.has(t.index)) {
        this._data.set(t.index, {
          index: t.index, colour: t.colour, label: `Team ${t.index + 1}`,
          wins: 0, kills: 0, ownGoals: 0, suicides: 0, score: 0, shots: 0,
          strategyKills: 0, oppressionKills: 0, tacticsKills: 0,
          bullyKills: 0, vengeanceKills: 0, longshotKills: 0, closeshotKills: 0,
          wormholeKills: 0, trickShotKills: 0, nearMisses: 0, hyperspaceCount: 0,
        });
      }
    }
  }

  // Call once after each game ends; returns the new gameIndex
  recordGame(gameState) {
    this._ensure(gameState.teams);
    const winner = gameState.winner;

    for (const team of gameState.teams) {
      const d = this._data.get(team.index);
      const survivors = team.stations.filter(s => s.status === 'active').length;
      const isWin     = team === winner;

      d.wins     += isWin ? 1 : 0;
      d.kills    += team.stats.kills;
      d.ownGoals += team.stats.ownGoals;
      d.suicides += team.stats.suicides;
      // §9.7 formula: 1pt win + 1pt/kill + 1pt/survivor − 1pt/own-team kill
      d.score += (isWin ? 1 : 0) + team.stats.kills + survivors
               - team.stats.ownGoals - team.stats.suicides;

      for (const sta of team.stations) {
        d.shots           += sta.stats.shots;
        d.strategyKills   += sta.stats.strategyKills;
        d.oppressionKills += sta.stats.oppressionKills;
        d.tacticsKills    += sta.stats.tacticsKills;
        d.bullyKills      += sta.stats.bullyKills;
        d.vengeanceKills  += sta.stats.vengeanceKills;
        d.longshotKills   += sta.stats.longshotKills;
        d.closeshotKills  += sta.stats.closeshotKills;
        d.wormholeKills   += sta.stats.wormholeKills;
        d.trickShotKills  += sta.stats.trickShotKills;
        d.nearMisses      += sta.stats.nearMisses;
        d.hyperspaceCount += sta.stats.hyperspaceCount;
      }
    }

    // Per-game snapshot for the rolling 5-game award window (§21)
    const snap = new Map();
    for (const team of gameState.teams) {
      const a = {
        index: team.index, colour: team.colour, label: `Team ${team.index + 1}`,
        kills: 0, strategyKills: 0, oppressionKills: 0, tacticsKills: 0, bullyKills: 0,
        vengeanceKills: 0, shots: 0, hits: 0, selfHits: 0, selfHitMinDist: Infinity,
        longestKillDist: 0, closestKillDist: Infinity, bestTrickshotEvents: 0, bestTrickshotDist: 0,
        collectablesGrabbed: 0, collectableTierSum: 0, rockHits: 0, distanceMoved: 0, hyperspaceCount: 0,
      };
      for (const sta of team.stations) {
        const s = sta.stats;
        a.kills += s.kills; a.strategyKills += s.strategyKills; a.oppressionKills += s.oppressionKills;
        a.tacticsKills += s.tacticsKills; a.bullyKills += s.bullyKills; a.vengeanceKills += s.vengeanceKills;
        a.shots += s.shots; a.hits += (s.hits ?? 0); a.selfHits += (s.selfHits ?? 0);
        a.selfHitMinDist = Math.min(a.selfHitMinDist, s.selfHitMinDist ?? Infinity);
        a.longestKillDist = Math.max(a.longestKillDist, s.longestKillDist ?? 0);
        a.closestKillDist = Math.min(a.closestKillDist, s.closestKillDist ?? Infinity);
        const ev = s.bestTrickshotEvents ?? 0;
        if (ev > a.bestTrickshotEvents || (ev === a.bestTrickshotEvents && (s.bestTrickshotDist ?? 0) > a.bestTrickshotDist)) {
          a.bestTrickshotEvents = ev; a.bestTrickshotDist = s.bestTrickshotDist ?? 0;
        }
        a.collectablesGrabbed += (s.collectablesGrabbed ?? 0); a.collectableTierSum += (s.collectableTierSum ?? 0);
        a.rockHits += (s.rockHits ?? 0); a.distanceMoved += (s.distanceMoved ?? 0);
        a.hyperspaceCount += s.hyperspaceCount;
      }
      snap.set(team.index, a);
    }
    this._gameHistory.push(snap);

    return ++this.gameIndex;
  }

  // Aggregate the last n games per team: sums for counters, extrema for best-shot
  // stats. Returns Map<teamIndex, aggregated record> with display fields filled in.
  _windowStats(n = 5) {
    const out = new Map();
    for (const snap of this._gameHistory.slice(-n)) {
      for (const [idx, a] of snap) {
        let w = out.get(idx);
        if (!w) {
          w = { index: a.index, colour: a.colour, label: a.label, selfHitMinDist: Infinity,
            longestKillDist: 0, closestKillDist: Infinity, bestTrickshotEvents: 0, bestTrickshotDist: 0 };
          for (const f of SUM_FIELDS) w[f] = 0;
          out.set(idx, w);
        }
        for (const f of SUM_FIELDS) w[f] += a[f];
        w.longestKillDist = Math.max(w.longestKillDist, a.longestKillDist);
        w.closestKillDist = Math.min(w.closestKillDist, a.closestKillDist);
        w.selfHitMinDist  = Math.min(w.selfHitMinDist, a.selfHitMinDist);
        if (a.bestTrickshotEvents > w.bestTrickshotEvents ||
            (a.bestTrickshotEvents === w.bestTrickshotEvents && a.bestTrickshotDist > w.bestTrickshotDist)) {
          w.bestTrickshotEvents = a.bestTrickshotEvents; w.bestTrickshotDist = a.bestTrickshotDist;
        }
      }
    }
    // Derived display fields (winner[stat] is shown verbatim on the awards screen).
    // Note: closestKillDist is left raw (Infinity = ineligible) so ranking works;
    // pointBlankDist holds the rounded value for display.
    for (const w of out.values()) {
      w.longestKillDistDisp = Math.round(w.longestKillDist);
      w.pointBlankDist      = w.closestKillDist < Infinity ? Math.round(w.closestKillDist) : 0;
      w.distanceMovedDisp   = Math.round(w.distanceMoved);
      w.accuracyPct         = w.shots > 0 ? Math.round((w.hits / w.shots) * 100) : 0;
    }
    return out;
  }

  get sorted() {
    return [...this._data.values()].sort((a, b) => b.score - a.score);
  }

  // Returns array of { key, winner } for the selected awards (2 KILL + 1 MISC),
  // or null if no data. Window-scoped to the last 5 games, prefers awards not
  // recently shown, and prefers distinct winning teams (§21). Memoised per game.
  awards() {
    if (this._cachedAwardsIndex === this.gameIndex) return this._cachedAwards;

    const W = this._windowStats(5);
    const teams = [...W.values()];
    if (!teams.length) { this._cachedAwards = null; this._cachedAwardsIndex = this.gameIndex; return null; }

    const shownLast   = new Set(this._awardHistory.at(-1) ?? []);
    const shownBefore = new Set(this._awardHistory.at(-2) ?? []);
    const recency = key => shownLast.has(key) ? 0.3 : shownBefore.has(key) ? 0.7 : 1.0;

    // Winning team for one award definition (value desc, tie desc, random).
    const winnerOf = (def) => {
      let best = null;
      for (const t of teams) {
        const v = def.value(t);
        if (v === null || v === undefined) continue;
        const tie = def.tie ? def.tie(t) : 0;
        if (!best || v > best.v || (v === best.v && tie > best.tie) ||
            (v === best.v && tie === best.tie && Math.random() < 0.5)) {
          best = { team: t, v, tie };
        }
      }
      return best ? { key: def.key, winner: best.team } : null;
    };

    // Eligible candidates per category, ordered by recency (then a little jitter
    // so awards rotate fairly instead of the leader sweeping every one).
    const build = defs => defs.map(winnerOf).filter(Boolean)
      .map(c => ({ ...c, w: recency(c.key) + Math.random() * 0.05 }))
      .sort((a, b) => b.w - a.w);

    const killCands = build(KILL_DEFS);
    const miscCands = build(MISC_DEFS);

    const chosen = [];
    const usedTeams = new Set();
    const take = (cands, n) => {
      let taken = 0;
      for (const c of cands) { // first pass — distinct winners
        if (taken >= n) break;
        if (chosen.includes(c) || usedTeams.has(c.winner.index)) continue;
        chosen.push(c); usedTeams.add(c.winner.index); taken++;
      }
      for (const c of cands) { // second pass — allow a duplicate winner if needed
        if (taken >= n) break;
        if (chosen.includes(c)) continue;
        chosen.push(c); usedTeams.add(c.winner.index); taken++;
      }
    };
    take(killCands, 2);
    take(miscCands, 1);

    this._awardHistory.push(chosen.map(c => c.key));
    this._cachedAwards = chosen.map(({ key, winner }) => ({ key, winner }));
    this._cachedAwardsIndex = this.gameIndex;
    return this._cachedAwards;
  }

  // Generate award ceremony prizes and store in this.lastAwardPrizes. Call after recordGame().
  generateAwardPrizes(config) {
    this.lastAwardPrizes = null;
    const setting = config?.awardPrizes ?? 'none';
    if (setting === 'none') return null;

    const aw = this.awards();
    if (!aw || !aw.length) return null;

    this.lastAwardPrizes = aw.map(({ key, winner }) => {
      if (!winner) return null;
      return { key, teamIndex: winner.index, teamLabel: winner.label, teamColour: winner.colour, grants: this._pickWeapon(setting) };
    }).filter(Boolean);

    return this.lastAwardPrizes;
  }

  // Pick weapons for a prize setting: 'minor' = 1×T1, 'mid' = 1×random, 'mammoth' = 2×random
  _pickWeapon(setting) {
    if (setting === 'minor') {
      const pool = WEAPON_GRANTS.filter(g => g.tier === 1);
      return [pool[Math.floor(Math.random() * pool.length)]];
    }
    const count = setting === 'mammoth' ? 2 : 1;
    return Array.from({ length: count }, () => {
      const r    = Math.random();
      const tier = r < 0.80 ? 1 : r < 0.96 ? 2 : 3;
      const pool = WEAPON_GRANTS.filter(g => g.tier === tier);
      return pool[Math.floor(Math.random() * pool.length)];
    });
  }

  // Generate per-game prizes (winner + handicap) and store in this.lastRewards. Call after recordGame().
  generateRewards(config, gameState) {
    this.lastRewards = null;
    const results = [];

    const winSetting = config?.winnerPrize ?? 'none';
    if (winSetting !== 'none') {
      const winner = gameState?.winner;
      if (winner) {
        results.push({
          type: 'winner',
          teamIndex:  winner.index,
          teamLabel:  `Team ${winner.index + 1}`,
          teamColour: winner.colour,
          grants: this._pickWeapon(winSetting),
        });
      }
    }

    const hcSetting = config?.handicapPrize ?? 'none';
    if (hcSetting !== 'none') {
      const sorted = this.sorted;
      if (sorted.length) {
        const last = sorted[sorted.length - 1];
        results.push({
          type: 'handicap',
          teamIndex:  last.index,
          teamLabel:  last.label,
          teamColour: last.colour,
          grants: this._pickWeapon(hcSetting),
        });
      }
    }

    if (results.length) this.lastRewards = results;
    return this.lastRewards;
  }

  // True if an awards screen should be shown after this game
  shouldShowAwards() {
    return this.gameIndex > 0 && this.gameIndex % 5 === 0;
  }
}
