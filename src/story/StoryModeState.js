// Copyright © 2026 Chloe Bolland
// contact chloe@mammoththoughts.com if you wish to use, publish or reproduce this game or any part of it in any way

export class StoryModeState {
  constructor(mission) {
    this.mission       = mission;
    this.objectives    = [...mission.objectives];
    this.objectiveMet  = new Array(mission.objectives.length).fill(false);
    this.firedEvents   = new Set();
    this.collectCount  = 0;
    this.passed        = false;
    this.failed        = false;
    this.score         = 0;
  }

  get allObjectivesMet() {
    // Missions with no objectives yet (e.g. pre-event M13/M14) cannot pass
    return this.objectives.length > 0 && this.objectiveMet.every(Boolean);
  }

  addObjective(obj) {
    this.objectives.push(obj);
    this.objectiveMet.push(false);
  }

  evaluate(gs) {
    for (let i = 0; i < this.objectives.length; i++) {
      const obj = this.objectives[i];
      switch (obj.type) {
        case 'destroy_all':
          this.objectiveMet[i] = gs.teams
            .filter((_, ti) => ti !== 0)
            .every(t => !t.isAlive);
          break;
        case 'destroy_n':
          this.objectiveMet[i] = gs.teams[0].stats.kills >= obj.params.count;
          break;
        case 'collect_n':
          this.objectiveMet[i] = this.collectCount >= obj.params.count;
          break;
      }
    }
  }

  computeScore(gs, turnsUsed) {
    const formula   = this.mission.scoring.formula;
    const humanTeam = gs.teams[0];
    const kills     = humanTeam.stats.kills;
    const survived  = humanTeam.stations.filter(s => s.status === 'active').length;

    switch (formula) {
      case 'target_practice':
        return this._tpScore(gs);
      case 'turns_remaining': {
        const maxTurns = this.mission.failConditions.find(f => f.type === 'max_turns')?.turns ?? 20;
        return Math.max(0, (maxTurns - turnsUsed) * 100);
      }
      case 'collectables_score':
        return Math.max(0, this.collectCount * 200 - turnsUsed * 10);
      case 'combat_efficiency':
        return kills * 200 + survived * 100 - turnsUsed * 5;
      default:
        return 0;
    }
  }

  _tpScore(gs) {
    const humanStations = gs.teams[0].stations;
    let totalHits  = 0;
    let totalShots = 0;
    for (const s of humanStations) {
      totalHits  += s.stats.kills;
      totalShots += s.stats.shots;
    }
    if (totalShots === 0) return 0;
    const hitRate = totalHits / totalShots;
    return Math.round(hitRate * 2000 - totalShots * 5);
  }
}
