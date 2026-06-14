// Copyright © 2026 Chloe Bolland
// contact chloe@mammoththoughts.com if you wish to use, publish or reproduce this game or any part of it in any way

export class TeamTPData {
  constructor(n) {
    this.targetDestroyed = new Array(n).fill(false);
    this.hits            = []; // { stationId, targetIdx, accuracy }[]
    this.finishedRound   = null; // round number when all N cleared; null = not yet done
  }

  hitRate(n) { return this.hits.length / n; }

  meanAccuracy() {
    if (!this.hits.length) return null;
    return this.hits.reduce((s, h) => s + h.accuracy, 0) / this.hits.length;
  }
}

export class TargetPracticeGame {
  constructor({ targets, totalRounds, stationList, teams }) {
    this.targets      = targets;      // PracticeTarget[N]
    this.totalRounds  = totalRounds;
    this.currentRound = 1;
    this.stationList  = stationList;  // Station[] — all stations in turn order
    this.teamData     = new Map();
    for (const team of teams) {
      this.teamData.set(team.index, new TeamTPData(targets.length));
    }
  }

  get N() { return this.targets.length; }

  survivingTargetIndices(teamIndex) {
    const data = this.teamData.get(teamIndex);
    if (!data) return [];
    return this.targets.map((_, i) => i).filter(i => !data.targetDestroyed[i]);
  }

  isTargetDestroyed(teamIndex, targetIdx) {
    return this.teamData.get(teamIndex)?.targetDestroyed[targetIdx] ?? true;
  }

  isTeamDone(teamIndex) {
    return this.teamData.get(teamIndex)?.finishedRound !== null;
  }

  isAllTargetsCleared(teamIndex) {
    const data = this.teamData.get(teamIndex);
    return data ? data.targetDestroyed.every(v => v) : false;
  }

  get allTeamsDone() {
    return [...this.teamData.values()].every(d => d.finishedRound !== null);
  }

  recordHit(stationId, teamIndex, targetIdx, accuracy) {
    const data = this.teamData.get(teamIndex);
    if (!data || data.targetDestroyed[targetIdx]) return false;
    data.targetDestroyed[targetIdx] = true;
    data.hits.push({ stationId, targetIdx, accuracy });
    return true;
  }
}
