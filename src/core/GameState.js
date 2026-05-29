export const GameMode = Object.freeze({
  CONFIG:   'config',
  DEMO:     'demo',
  AIMING:   'aiming',
  FIRING:   'firing',
  RESULTS:  'results',
  GAMEOVER: 'gameover',
  AWARDS:   'awards',
});

export class GameState {
  constructor({ planets = [], teams = [], config = {} } = {}) {
    this.planets        = planets;
    this.teams          = teams;
    this.config         = config;
    this.mode           = GameMode.AIMING;
    this.turn           = 0;
    this.gameIndex      = 0;
    this.currentTeamIdx = 0;
    this.currentStatIdx = 0;
    this.winner         = undefined;    // undefined=ongoing, null=draw, Team=winner
    this.activeBullets  = [];
  }

  get activeStation() {
    return this.teams[this.currentTeamIdx]?.stations[this.currentStatIdx] ?? null;
  }

  get allStations() {
    return this.teams.flatMap(t => t.stations);
  }

  get aliveTeams() {
    return this.teams.filter(t => t.isAlive);
  }

  isHumanTurn() {
    return this.teams[this.currentTeamIdx]?.isHuman ?? false;
  }
}
