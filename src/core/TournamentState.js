// Copyright © 2026 Chloe Bolland
// contact chloe@mammoththoughts.com if you wish to use, publish or reproduce this game or any part of it in any way

import { WEAPON_GRANTS } from '../entities/Collectable.js';

const ALL_AWARD_STATS = [
  { key: 'bloodlust',    stat: 'kills'            },
  { key: 'strategy',     stat: 'strategyKills'    },
  { key: 'oppression',   stat: 'oppressionKills'  },
  { key: 'tactics',      stat: 'tacticsKills'      },
  { key: 'bully',        stat: 'bullyKills'        },
  { key: 'vengeance',    stat: 'vengeanceKills'    },
  { key: 'longshot',     stat: 'longshotKills'     },
  { key: 'closeshot',    stat: 'closeshotKills'    },
  { key: 'wormhole',     stat: 'wormholeKills'     },
  { key: 'trickshot',    stat: 'trickShotKills'    },
  { key: 'nearmiss',     stat: 'nearMisses'        },
  { key: 'hyperactive',  stat: 'hyperspaceCount'   },
  { key: 'selfdestruct', stat: 'suicides'          },
  { key: 'friendly',     stat: 'ownGoals'          },
];

export class TournamentState {
  constructor() {
    this.gameIndex       = 0;          // games completed so far
    this._data           = new Map();  // teamIndex → cumulative data
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

    return ++this.gameIndex;
  }

  get sorted() {
    return [...this._data.values()].sort((a, b) => b.score - a.score);
  }

  // Returns array of { key, winner } for the 4 selected awards, or null if no data.
  // Prefers awards not recently shown; records selection in _awardHistory.
  // Memoised per game index — safe to call multiple times per game.
  awards() {
    if (this._cachedAwardsIndex === this.gameIndex) return this._cachedAwards;

    const teams = [...this._data.values()];
    if (!teams.length) { this._cachedAwards = null; this._cachedAwardsIndex = this.gameIndex; return null; }

    const totalKills = teams.reduce((s, t) => s + t.kills, 0) || 1;
    const shownLast   = new Set(this._awardHistory.at(-1) ?? []);
    const shownBefore = new Set(this._awardHistory.at(-2) ?? []);

    const candidates = ALL_AWARD_STATS
      .map(({ key, stat }) => {
        const winner = [...teams].sort((a, b) => b[stat] - a[stat])[0];
        if (!winner || winner[stat] === 0) return null;
        const weight = shownLast.has(key) ? 0.3 : shownBefore.has(key) ? 0.7 : 1.0;
        return { key, winner, score: (winner[stat] / totalKills) * weight };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    const selected = candidates.slice(0, 4);
    this._awardHistory.push(selected.map(c => c.key));
    this._cachedAwards = selected.map(({ key, winner }) => ({ key, winner }));
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
