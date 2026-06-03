export const GameMode = Object.freeze({
  CONFIG:     'config',
  DEMO:       'demo',
  AIMING:     'aiming',
  FIRING:     'firing',
  RESULTS:    'results',
  GAMEOVER:   'gameover',
  AWARDS:     'awards',
  TP_AIMING:  'tp_aiming',
  TP_FIRING:  'tp_firing',
  TP_RESULTS: 'tp_results',
});

export class GameState {
  constructor({ planets = [], teams = [], config = {}, movementSpeed = 'off' } = {}) {
    this.planets          = planets;
    this.teams            = teams;
    this.config           = config;
    this.movementSpeed    = movementSpeed;
    this.mode             = GameMode.AIMING;
    this.turn             = 0;
    this.gameIndex        = 0;
    this.currentTeamIdx   = 0;
    this.currentStatIdx   = 0;
    this.winner           = undefined;  // undefined=ongoing, null=draw, Team=winner
    this.activeBullets    = [];
    this.activeExplosions = [];         // asteroid/debris explosions: [{x,y,t,radius,colour,particles}]
    this.collectables     = [];         // Collectable[] — collectables on the map
    this.vfxList          = [];         // VFX objects (collectable shatter, collectable grant, muzzle)
    this.rockets          = [];         // Rocket[]
    this.rocketBlasts     = [];         // {x,y,maxRadius,currentRadius,owner,hitSet}[]
    this.rocketSmoke      = [];         // {x,y,maxR,t,r,g,b}[] — smoke puff particles
    this.cometSmoke       = [];         // {x,y,maxR,t}[] — white comet tail puffs — active rockets in flight
    this.shields          = [];         // {station, radius, alive}[] — active Force Shields
    this.burstQueue       = [];         // burst-fire entries: {station,weapon,shotsRemaining,intervalSteps,nextFireStep,angle,power}
    this.pendingLasers    = [];         // {station, angle, delaySteps}[] — lasers waiting to fire
    this.firingStep       = 0;          // physics step counter within the current firing phase
    this.waitingForInput  = false;      // true when a human station is aiming
    this.waitingForMove   = false;      // true when human clicked Move, awaiting target click
    this.tpGame           = null;       // TargetPracticeGame | null
  }

  get stationMovement() { return this.movementSpeed !== 'off'; }

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
