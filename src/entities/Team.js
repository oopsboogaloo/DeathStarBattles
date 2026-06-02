import { WeaponId } from './Crystal.js';

export const TEAM_COLOURS = [
  [  0, 220,   0],  // 0  green
  [  0, 195, 195],  // 1  cyan
  [255, 255,   0],  // 2  yellow
  [255,  10,  10],  // 3  red
  [225,   0, 225],  // 4  purple
  [  0,   0, 250],  // 5  blue
  [255, 162,   0],  // 6  orange
  [155, 155, 155],  // 7  grey
  [242, 242, 242],  // 8  white
  [ 88,  88,  88],  // 9  dark grey
  [255, 155, 155],  // 10 pink
  [205,  95,   0],  // 11 brown
];

export class TeamStats {
  constructor() {
    this.wins     = 0;
    this.score    = 0;
    this.kills    = 0;
    this.ownGoals = 0;
    this.suicides = 0;
    this.shots    = 0;
    this.survived = 0;
    this.turns    = 0;
    this.killedBy = null; // last Station that killed any member of this team (for vengeance)
  }
}

export class Team {
  constructor({ index, isHuman = false }) {
    this.index      = index;
    this.colour     = TEAM_COLOURS[index % TEAM_COLOURS.length];
    this.stations   = [];
    this.isHuman    = isHuman;
    this.controller = null;   // AIController — wired in Phase 7
    this.stats      = new TeamStats();
    this.weaponStock = new Map();  // WeaponId → int (tournament-persistent)
  }

  get cssColour() { return `rgb(${this.colour[0]},${this.colour[1]},${this.colour[2]})`; }
  get isAlive()   { return this.stations.some(s => s.status === 'active'); }

  getStock(weaponId) {
    return this.weaponStock.get(weaponId) ?? 0;
  }

  addStock(weaponId, n) {
    this.weaponStock.set(weaponId, (this.weaponStock.get(weaponId) ?? 0) + n);
  }

  spendStock(weaponId) {
    const cur = this.weaponStock.get(weaponId) ?? 0;
    if (cur <= 0) return false;
    this.weaponStock.set(weaponId, cur - 1);
    return true;
  }
}
