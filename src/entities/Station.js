export const StationSize = Object.freeze({
  MICRO:  { name: 'Micro',  radius: 2,   bulletRadius: 0.4  },
  TINY:   { name: 'Tiny',   radius: 3.2, bulletRadius: 0.48 },
  SMALL:  { name: 'Small',  radius: 4,   bulletRadius: 0.6  },
  MEDIUM: { name: 'Medium', radius: 4.8, bulletRadius: 0.8  },
  LARGE:  { name: 'Large',  radius: 6.4, bulletRadius: 1.04 },
  GIANT:  { name: 'Giant',  radius: 9.6, bulletRadius: 1.36 },
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
    this.velocity         = null;  // Vec2 | null — one-turn movement vector (game units/timestep)
    this.status          = StationStatus.ACTIVE;
    this.explosionT      = 0;            // 0→1 animation progress
    this.shockwave       = null;         // {t: 0, colour} | null — expanding solid disc
    this.particles       = null;         // [{x,y,vx,vy,t,r,g,b}] | null — debris
    this.hyperspaceFlash = null;         // {t, oldPos, newPos} | null — hyperspace anim
    this.lastTrail       = null;         // Vec2[] | null — ghost trail from previous shot
    this.lastAngle       = null;         // int | null — angle fired last turn (for ghost aim line)
    this.lastPower       = null;         // int | null — power fired last turn
    this.stats           = new StationStats();
  }

  get radius()  { return this.size.radius; }
  get colour()  { return this.team.colour; }
}
