// Copyright © 2026 Chloe Bolland
// contact chloe@mammoththoughts.com if you wish to use, publish or reproduce this game or any part of it in any way

export const GameMode = Object.freeze({
  CONFIG:          'config',
  DEMO:            'demo',
  AIMING:          'aiming',
  FIRING:          'firing',
  RESULTS:         'results',
  GAMEOVER:        'gameover',
  AWARDS:          'awards',
  TP_AIMING:       'tp_aiming',
  TP_FIRING:       'tp_firing',
  TP_RESULTS:      'tp_results',
  STORY_SELECT:    'story_select',
  STORY_BRIEFING:  'story_briefing',
  STORY_DEBRIEF:   'story_debrief',
  STORY_DIALOG:    'story_dialog',
});

export class GameState {
  constructor({ planets = [], rifts = [], teams = [], config = {}, movementSpeed = 'off' } = {}) {
    this.planets          = planets;
    this.rifts            = rifts;
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
    this.iceRings         = [];         // IceRing[] — Ice Blast expanding ice rings
    this.rocketBlasts     = [];         // {x,y,maxRadius,currentRadius,owner,hitSet}[]
    this.rocketSmoke      = [];         // {x,y,maxR,t,r,g,b}[] — smoke puff particles
    this.cometSmoke       = [];         // {x,y,maxR,t}[] — white comet tail puffs — active rockets in flight
    this.shipExplosionBloom = [];       // {x,y,maxR,t,dt,r,g,b}[] — bitmap bloom particles (experimental)
    this.fireballs          = [];       // {x,y,vx,vy,r,g,b,t,dt,smokeTimer}[] — gravity fireballs (experimental)
    this.fireballSmoke      = [];       // {x,y,maxR,t,r,g,b}[] — fireball trail puffs (experimental)
    this.skimParticles      = [];       // {x,y,vx,vy,t,dt,r,g,b}[] — surface skim rebound particles
    this.shields          = [];         // {station, radius, alive}[] — active Force Shields
    this.burstQueue       = [];         // burst-fire entries: {station,weapon,shotsRemaining,intervalSteps,nextFireStep,angle,power}
    this.pendingLasers    = [];         // {station, angle, delaySteps}[] — lasers waiting to fire
    this.pendingSwaps     = [];         // {firer, target}[] — Quantum Beam position swaps at turn end
    this.firingStep       = 0;          // physics step counter within the current firing phase
    this.waitingForInput  = false;      // true when a human station is aiming
    this.waitingForMove   = false;      // true when human clicked Move, awaiting target click
    this.tpGame           = null;       // TargetPracticeGame | null
    this.storyState       = null;       // StoryModeState | null
    this.storyDialogText  = null;       // string | null — queued dialog text
    this._storyPrevMode   = null;       // GameMode to restore after dialog dismissed
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
