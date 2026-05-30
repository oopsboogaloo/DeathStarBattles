export const StationSize = Object.freeze({
  MICRO:  { name: 'Micro',  radius: 5,  bulletRadius: 1.0 },
  TINY:   { name: 'Tiny',   radius: 8,  bulletRadius: 1.2 },
  SMALL:  { name: 'Small',  radius: 10, bulletRadius: 1.5 },
  MEDIUM: { name: 'Medium', radius: 12, bulletRadius: 2.0 },
  LARGE:  { name: 'Large',  radius: 16, bulletRadius: 2.6 },
  GIANT:  { name: 'Giant',  radius: 24, bulletRadius: 3.4 },
});

export const StationStatus = Object.freeze({
  ACTIVE:    'active',
  EXPLODING: 'exploding',
  DEAD:      'dead',
});

export class StationStats {
  constructor() {
    this.turns          = 0;
    this.shots          = 0;
    this.kills          = 0;
    this.ownGoals       = 0;
    this.suicides       = 0;
    this.survived       = 0;
    this.killedBy       = null;   // Station | null
    this.strategyKills  = 0;
    this.oppressionKills = 0;
    this.tacticsKills   = 0;
    this.bullyKills     = 0;
    this.longshotKills  = 0;
    this.closeshotKills = 0;
    this.vengeanceKills = 0;
    this.totalPower     = 0;
  }
}

export class Station {
  constructor({ id, team, position, size = StationSize.LARGE }) {
    this.id              = id;
    this.team            = team;          // Team reference
    this.position        = position;      // Vec2, game units
    this.size            = size;          // StationSize
    this.angle           = 180;           // 0-359, default pointing down
    this.power           = 1;             // 1-800
    this.hyperspaceQueued = false;
    this.status          = StationStatus.ACTIVE;
    this.explosionT      = 0;            // 0→1 animation progress
    this.hyperspaceFlash = null;         // {t, oldPos, newPos} | null — hyperspace anim
    this.lastTrail       = null;         // Vec2[] | null — ghost trail from previous shot
    this.stats           = new StationStats();
  }

  get radius()  { return this.size.radius; }
  get colour()  { return this.team.colour; }
}
