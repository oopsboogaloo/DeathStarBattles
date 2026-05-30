export class TournamentState {
  constructor() {
    this.gameIndex = 0;          // games completed so far
    this._data     = new Map();  // teamIndex → cumulative data
  }

  // Ensure entries exist for all teams in the current game
  _ensure(teams) {
    for (const t of teams) {
      if (!this._data.has(t.index)) {
        this._data.set(t.index, {
          index: t.index, colour: t.colour, label: `Team ${t.index + 1}`,
          wins: 0, kills: 0, ownGoals: 0, suicides: 0, score: 0, shots: 0,
          strategyKills: 0, oppressionKills: 0, bullyKills: 0, vengeanceKills: 0,
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
        d.bullyKills      += sta.stats.bullyKills;
        d.vengeanceKills  += sta.stats.vengeanceKills;
      }
    }

    return ++this.gameIndex;
  }

  get sorted() {
    return [...this._data.values()].sort((a, b) => b.score - a.score);
  }

  // Returns awards object; null if no data
  awards() {
    const teams = [...this._data.values()];
    if (!teams.length) return null;
    const top = key => [...teams].sort((a, b) => b[key] - a[key])[0];
    return {
      bloodlust:  top('kills'),
      oppression: top('oppressionKills'),
      bully:      top('bullyKills'),
      vengeance:  top('vengeanceKills'),
    };
  }

  // True if an awards screen should be shown after this game
  shouldShowAwards() {
    return this.gameIndex > 0 && this.gameIndex % 5 === 0;
  }
}
