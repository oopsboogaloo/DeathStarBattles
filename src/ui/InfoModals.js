// About, Instructions, Education, and Score modal overlays.
// Each has show() / hide() and responds to ESC to close.

const EDUCATION_PAGES = [
  {
    title: 'Gravity',
    body: `Gravity is the invisible force that pulls all objects with mass toward each other. Every object in the universe — from a grain of sand to a galaxy — exerts a gravitational pull on every other object.

The more massive an object, the stronger its gravitational pull. The Sun holds the solar system together because its mass dwarfs everything else nearby.

In this game, every planet, star, and asteroid exerts gravity on your projectiles — and on each other.`,
  },
  {
    title: 'Isaac Newton',
    body: `Isaac Newton (1643–1727) formulated the laws of motion and universal gravitation that explained why apples fall and why planets orbit.

His three laws of motion describe how forces change an object's velocity:
  F = ma  (Force = mass × acceleration)

Before Newton, people thought the heavens obeyed different laws than the Earth. Newton unified them — the same gravity that pulls a cannonball down also keeps the Moon in orbit.`,
  },
  {
    title: 'The Inverse Square Law',
    body: `Gravity weakens rapidly with distance. Specifically, it weakens with the square of the distance between two objects.

Double the distance → one quarter the force.
Triple the distance → one ninth the force.

The formula:  F = G m₁ m₂ / r²

G is the gravitational constant, m₁ and m₂ are the masses, and r is the distance between them.

This is why objects very close to a massive body are flung violently, while objects far away drift gently. In this game, passing near a star is very different from grazing it from a distance.`,
  },
  {
    title: 'Orbits',
    body: `Planets don't fall into the Sun because they are also moving sideways — fast enough that as they fall toward the Sun, they keep missing it.

An orbit is the balance between gravitational pull (curving the path inward) and tangential velocity (pushing the object forward).

Johannes Kepler described planetary orbits with three laws:
  1. Orbits are ellipses, not circles.
  2. A planet moves faster when closer to the Sun.
  3. The orbital period depends on the orbit's size.

In this game, a well-aimed shot can enter a stable orbit and loop around indefinitely before hitting something.`,
  },
  {
    title: 'The Three-Body Problem',
    body: `With two bodies (e.g. a star and a planet), gravity produces a perfectly predictable, repeating orbit. The equations have an exact solution.

Add a third body and everything changes. Three interacting gravitational fields produce trajectories so complex they cannot be solved analytically — only approximated step by step.

This is why this game cannot be solved by formula. Every shot through a multi-planet field is a fresh numerical computation, and small changes in aim produce wildly different results.`,
  },
  {
    title: 'Chaos Theory',
    body: `Chaotic systems are not random — they are deterministic, but impossibly sensitive to starting conditions.

Edward Lorenz discovered in the 1960s that tiny differences in weather data produced completely different forecasts after only a few days. He called this the "butterfly effect."

Gravitational trajectories are chaotic in the same way. An angle difference of 0.1° can mean the difference between a direct hit and a shot that disappears off screen. This is why the sub-degree angle control in this game matters, and why experienced players learn the map rather than calculating.`,
  },
  {
    title: 'Astronomical Bodies',
    body: `This game features several real types of astronomical body:

Stars — fuse hydrogen into helium; enormous gravity and radiation.
Red Giants — stars that have expanded as they age; larger, cooler.
White Dwarfs — the collapsed remnant of a dead star; tiny but very dense.
Neutron Stars — even denser collapsed stars; a teaspoon weighs a billion tonnes.
Black Holes — so dense that not even light can escape; infinite density at the core.
White Holes — the theoretical time-reverse of a black hole; repels everything.
Wormholes — hypothetical tunnels through space-time connecting distant points.

Each has different mass and therefore different gravitational influence on your shots.`,
  },
  {
    title: 'How This Game Models Physics',
    body: `Real gravitational simulation runs this game's physics.

Euler Integration: each timestep, the gravitational force from every body is computed and added to the projectile's velocity, then the position is updated. Simple but fast.

N-body gravity: every planet contributes to the force on every projectile every step. With many planets this is expensive, so the timestep is coarse enough to run in real time.

Simplifications: stations do not exert gravity on each other. Planets do not move. There is no air resistance or relativistic effects.

The result is physically plausible but not astronomically accurate — which is exactly what makes it a game.`,
  },
];

// ── shared helpers ────────────────────────────────────────────────────────────

function overlay() {
  const d = el('div', {
    position: 'fixed', inset: '0', zIndex: '200',
    display: 'none',
    alignItems: 'center', justifyContent: 'center',
    background: 'rgba(0,0,8,0.88)',
  });
  return d;
}

function panel(minW = '520px') {
  return el('div', {
    background:   'rgba(3,3,20,0.98)',
    border:       '1px solid rgba(80,110,255,0.4)',
    borderRadius: '8px',
    padding:      '32px 40px 36px',
    minWidth:     minW,
    maxWidth:     '90vw',
    maxHeight:    '85vh',
    overflowY:    'auto',
    color:        '#ccd',
    fontFamily:   'monospace',
    boxShadow:    '0 0 50px rgba(50,70,200,0.25)',
    position:     'relative',
  });
}

function closeBtn(onClose) {
  const btn = el('button', {
    position:     'absolute', top: '14px', right: '18px',
    background:   'transparent',
    border:       '1px solid rgba(100,120,255,0.3)',
    borderRadius: '4px',
    color:        'rgba(170,185,255,0.75)',
    fontFamily:   'monospace',
    fontSize:     '14px',
    padding:      '3px 10px',
    cursor:       'pointer',
  });
  btn.textContent = '✕  Close';
  btn.addEventListener('click', onClose);
  btn.addEventListener('mouseenter', () => { btn.style.borderColor = 'rgba(150,170,255,0.7)'; });
  btn.addEventListener('mouseleave', () => { btn.style.borderColor = 'rgba(100,120,255,0.3)'; });
  return btn;
}

function heading(text, size = '15px') {
  const h = el('div', {
    fontSize: size, letterSpacing: '0.18em',
    color: '#aac', marginBottom: '18px',
    textShadow: '0 0 18px rgba(110,130,255,0.55)',
  });
  h.textContent = text;
  return h;
}

function bodyText(text) {
  const p = el('pre', {
    margin: '0', fontFamily: 'monospace', fontSize: '13px',
    lineHeight: '1.7', color: '#bbc', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  });
  p.textContent = text;
  return p;
}

function el(tag, styles) {
  const node = document.createElement(tag);
  Object.assign(node.style, styles);
  return node;
}

const OPTIONS_PAGES = [
  {
    title: 'Players',
    body: `How many teams participate in the game. Range: 2–12.

More players means more targets, more chaos, and longer matches. With many players it can be hard to finish first, but the spectacle is impressive.

With 2 players the game is a direct duel. With 12 players it becomes a free-for-all melee.`,
  },
  {
    title: 'Human / CPU',
    body: `How many of the teams you control yourself. The remainder are computer-controlled.

0 Human — fully automated CPU match (like the demo mode).
1 Human — you versus all CPU teams.
All Human — pass-the-keyboard local multiplayer.

Human players aim and fire manually using the mouse or keyboard. CPU players aim automatically according to their CPU Level setting.`,
  },
  {
    title: 'Stations / Player',
    body: `How many Death Stars each team starts with. Range: 1–8.

A team is eliminated when all its stations are destroyed. More stations means teams are harder to finish off and matches last longer.

With 1 station per player the game is decided by a single hit. With 8 stations per player, teams can absorb many blows and strategy around target selection matters more.`,
  },
  {
    title: 'CPU Level',
    body: `How intelligent the computer-controlled teams are.

RandBot   — fires at a completely random angle and power.
AimBot    — aims roughly toward a target with some noise.
CleverBot — simulates trajectories to find a good shot.
SuperBot  — smarter targeting; wormhole-aware simulation.
MegaBot   — leaderboard-aware; coordinates with teammates to avoid hitting the same enemy twice.

Higher levels dramatically increase the kill rate. MegaBot can be genuinely difficult to beat.`,
  },
  {
    title: 'Station Size',
    body: `The physical size of each Death Star. Options: Micro, Tiny, Small, Medium, Large, Giant, Mammoth.

Larger stations:
  — Are easier to hit (bigger collision target)
  — Have a larger aiming circle, giving more power range
  — Show more visual detail (dome, aperture)

Smaller stations are harder to hit but also harder to aim well with. Mammoth stations dominate the screen; Micro stations are nearly invisible.`,
  },
  {
    title: 'Planets',
    body: `How many planets, stars, asteroids, or other bodies appear in the scenario. Options: Random (3–8) or a specific number from 3 to 50.

More planets = more gravitational obstacles for projectiles to navigate around, and more chaotic trajectories.

Very high counts (30+) make the map extremely dense. Very low counts (3–4) leave open space for long clean shots.

The actual bodies that appear depend on the Scenario setting.`,
  },
  {
    title: 'Scenario',
    body: `Which map layout to generate. Options: Lucky Dip or any numbered scenario (1–28).

Lucky Dip picks a weighted random scenario — common ones (Planetary, Asteroids, Star System) appear more often.

Notable scenarios:
  Planetary (1)           — rocky planets, mild gravity
  Crystal Asteroids (3)   — bullets pass through asteroids; Bounce Cannon reflects off and smashes them
  Star System (4)         — one large star dominates
  Black Hole (22)         — strong invisible attractor
  Wormholes (20)          — teleporting hazards
  Asteroid Ring (16)      — ring of asteroids around a gas giant
  Comet (15)              — a moving comet that reacts to gravity
  Oort Cloud (18)         — orbiting comets around a white dwarf`,
  },
  {
    title: 'Mode',
    body: `Single Game plays one match, then shows the result.

Tournament accumulates scores across multiple games and tracks a running leaderboard. After each game the score updates and the next game starts automatically (click or press a key to advance).

Tournament scoring: +1 per win, +1 per kill, +1 per surviving station, −1 per own-team kill.

Every 5 games an awards screen highlights standout performers — four categories are chosen each time from a rotating pool including Bloodlust, Long Shot, Vengeance, Bully, and others.`,
  },
  {
    title: 'Game Speed',
    body: `How fast projectiles are simulated each frame. Options: ¼× Very Slow, ½× Slow, 1× Normal, 2× Fast, 4× Very Fast.

Slower speeds make trajectories easier to follow and give more time to read the physics. Very Fast compresses the simulation so matches conclude quickly — useful for automated tournaments.

You can also pause (P) and slow-motion step-through (O while paused) regardless of this setting.`,
  },
  {
    title: 'Station Movement',
    body: `When On, stations are given a velocity at the start of each firing phase and drift slowly across the map.

Human players can set a movement target by clicking Move, then clicking a destination. AI stations move away from gravitational hazards automatically.

Stations bounce off map boundaries and are destroyed if they collide with a planet. They also teleport through wormholes.

When Off (default), stations stay fixed where they were placed.`,
  },
  {
    title: 'Performance',
    body: `Full — all visual effects enabled: star blur, planet coronas, bullet glow traces, particle explosions. Best visual quality.

Simplified — effects reduced for smoother performance on slower machines. Caps at 20 planets and 4 players automatically.

If the game feels sluggish (especially with many planets and stations), switch to Simplified.`,
  },
  {
    title: 'Team Clustering',
    body: `Controls how close stations on the same team start relative to each other. Has no effect on teams with only one station.

Off      — stations placed randomly anywhere (default).
Tight    — teammates start within a few station diameters.
Moderate — teammates start within roughly ¼ of the map width.
Loose    — teammates start in the same map quadrant.

Enemy teams are never constrained relative to each other or to friendly clusters. All existing placement rules (planet clearance, map boundary margin) still apply.`,
  },
  {
    title: 'Wildcard Planets',
    body: `How often a surprise bonus body appears on top of the normal scenario. Options: Off, Very Rare, Rare, Occasional, Common, Always.

Wildcards can be: paired wormholes, cyclic wormholes, a random wormhole, a white dwarf, a pulsar, a black hole, or a comet.

Rare is the default (roughly 10% chance per game). Always guarantees at least one wildcard in every scenario that supports them. Off disables wildcards entirely.

Wildcards can dramatically change the flow of play — a surprise black hole or wormhole pair can redirect shots that would otherwise miss.`,
  },
  {
    title: 'Aim Circle Size',
    body: `The radius of the white targeting circle drawn around your station while aiming. Options: 0.5× Smaller, 1× Regular, 2× Larger, 3× Mammoth.

The circle defines your power range: the line from your station to the circle edge represents maximum power; a shorter line is lower power.

A larger circle gives finer control at high power values — more canvas distance means more precision per degree of mouse movement. A smaller circle keeps the aiming UI compact on small screens.`,
  },
  {
    title: 'Bullet Paths',
    body: `Shows a preview of your shot's trajectory before firing. The path fades out at the selected distance. Options: Off, Full (1 screen), Half, Quarter, Eighth.

The preview is computed using the same physics as the real shot — gravity from every planet is included. It is a genuine prediction, not an approximation.

Useful for learning trajectories. Experienced players may prefer Off to keep the game challenging. Short paths (Eighth) hint at the initial direction without revealing the full arc.`,
  },
  {
    title: 'Minimal UI',
    body: `When On, shrinks the weapon selector, end-turn button, and other controls to leave more screen space for the game.

The game itself is unchanged — only the size of interface elements is affected. Useful on smaller screens or when you want less visual clutter during play.`,
  },
  {
    title: 'Number of Games',
    body: `Only available in Tournament mode (Tournament page). How many games to play before the tournament ends.

  Keep Going  — tournament runs indefinitely (default). Use New Game to end manually.
  5 / 10 / 15 / 20 / 30 / 50  — tournament ends automatically after that many games.

When the final game ends, the results screen shows the complete standings marked ★ FINAL, and the End Tournament button returns to the menu.`,
  },
  {
    title: 'Tournament Prize',
    body: `Only available in Tournament mode (Tournament page). Awards random weapons to a team after each game.

  None            — no reward.
  Minor           — game winner receives 1 random weapon.
  Medium          — game winner receives 2 random weapons.
  Major           — game winner receives 3 random weapons.
  Mammoth         — game winner receives 5 random weapons.
  Minor Handicap  — last-place team (standings) receives 1 weapon.
  Med. Handicap   — last-place team receives 2 weapons.
  Maj. Handicap   — last-place team receives 3 weapons.

Weapons are selected using the same tier weighting as pickups: Common (80%), Uncommon (16%), Rare (4%). Awarded weapons are applied immediately and carry into the next game. The results screen names each weapon received.`,
  },
  {
    title: 'Map Seed',
    body: `Two fields control map seeding:

Current Seed — read-only. Always shows the seed that was used to generate the current map. Click to select and copy it.

Override Seed — leave blank for a fresh random map each game. Type a seed here to pin the layout; that exact map will be generated every time until you clear the field.

The seed determines the scenario, planet positions, and planet types. Giving someone else your current seed lets them play the exact same map.`,
  },
  {
    title: 'Collectables',
    body: `Power-ups scattered across the map that can be collected by hitting them with your own projectile. Options: Off, Rare, Normal, Common, Continuous.

Collectables grant bonuses: extra weapons, shields, and more. The owning station receives the reward automatically on hit.

Continuous respawns new collectables throughout the match as old ones are taken. Off removes them entirely. Normal is a good starting point.`,
  },
  {
    title: 'Rich Asteroids',
    body: `How often asteroids contain a hidden collectable (requires Collectables to be enabled). Options: Off, Rare (1%), Normal (5%), Common (10%), Abundant (25%), Overwhelming.

When a rich asteroid is destroyed, it drops its collectable for any station to collect. The percentage is the chance per asteroid.

Overwhelming gives most asteroids a reward, effectively turning asteroid fields into loot fields.`,
  },
  {
    title: 'Collectable Size',
    body: `The physical size of collectable power-ups on the map. Options: Tiny (½×), Medium, Large (1.5×), Huge (2×), Mammoth (3×), Varied.

Larger collectables are easier to hit. Tiny collectables require a near-direct hit and add a skill element to collecting.

Varied gives each collectable a random size from the full range, so some are easy and some are not.`,
  },
  {
    title: 'Targets  (Target Practice)',
    body: `How many target stations appear per round in Target Practice mode. Options: 1, 3, 5, 7, 10, 20.

Each target must be destroyed to score. The round ends when all targets are eliminated or the maximum turn count is reached.

Fewer targets with careful placement can be more demanding than many spread-out ones.`,
  },
  {
    title: 'Target Size  (Target Practice)',
    body: `The physical size of target stations in Target Practice mode. Uses the same size scale as the Station Size option: Micro, Tiny, Small, Medium, Large, Giant, Mammoth.

Smaller targets are harder to hit and reward precise aim. Larger targets suit players who are still learning to read trajectories.`,
  },
  {
    title: 'Rounds  (Target Practice)',
    body: `How many rounds make up a Target Practice session. Options: 1, 3, 5, 7, 10.

Each round gives players a fresh set of targets on the same map. Scores accumulate across all rounds; the player with the highest total at the end wins.`,
  },
  {
    title: 'Include AI  (Target Practice)',
    body: `When On, computer-controlled stations compete alongside human players in Target Practice mode, using the CPU Level set in Setup.

AI stations aim for the same targets using their standard trajectory simulation. Useful for benchmarking your performance against a known baseline, or for filling out a session when playing alone.`,
  },
];

// ── OptionsHelpModal ──────────────────────────────────────────────────────────

export class OptionsHelpModal {
  constructor() {
    this._page    = 0;
    this._visible = false;
    this._wrap    = overlay();
    const p       = panel('580px');
    this._wrap.appendChild(p);

    const close = () => this.hide();
    p.appendChild(closeBtn(close));

    this._titleEl = heading('', '15px');
    p.appendChild(this._titleEl);

    this._bodyEl = bodyText('');
    p.appendChild(this._bodyEl);

    const nav = el('div', {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginTop: '24px',
    });
    this._prevBtn    = this._navBtn('◄  Previous', () => this._go(-1));
    this._indicator  = el('span', { fontSize: '12px', color: '#778', letterSpacing: '0.06em' });
    this._nextBtn    = this._navBtn('Next  ►',     () => this._go(+1));
    nav.appendChild(this._prevBtn);
    nav.appendChild(this._indicator);
    nav.appendChild(this._nextBtn);
    p.appendChild(nav);

    this._wrap.addEventListener('click', e => { if (e.target === this._wrap) close(); });
    document.addEventListener('keydown', e => {
      if (!this._visible) return;
      if (e.key === 'Escape')     close();
      if (e.key === 'ArrowLeft')  this._go(-1);
      if (e.key === 'ArrowRight') this._go(+1);
    });
  }

  _navBtn(label, onClick) {
    const btn = el('button', {
      background: 'transparent',
      border: '1px solid rgba(100,120,255,0.3)',
      borderRadius: '4px',
      color: 'rgba(170,185,255,0.75)',
      fontFamily: 'monospace', fontSize: '13px',
      padding: '4px 14px', cursor: 'pointer',
    });
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    btn.addEventListener('mouseenter', () => { btn.style.borderColor = 'rgba(150,170,255,0.7)'; });
    btn.addEventListener('mouseleave', () => { btn.style.borderColor = 'rgba(100,120,255,0.3)'; });
    return btn;
  }

  _go(delta) {
    this._page = Math.max(0, Math.min(OPTIONS_PAGES.length - 1, this._page + delta));
    this._render();
  }

  _render() {
    const pg = OPTIONS_PAGES[this._page];
    this._titleEl.textContent = `✦  ${pg.title.toUpperCase()}`;
    this._bodyEl.textContent  = pg.body;
    this._indicator.textContent = `${this._page + 1} / ${OPTIONS_PAGES.length}`;
    this._prevBtn.style.visibility = this._page === 0 ? 'hidden' : 'visible';
    this._nextBtn.style.visibility = this._page === OPTIONS_PAGES.length - 1 ? 'hidden' : 'visible';
  }

  show(page = 0) {
    this._visible = true;
    this._page    = Math.max(0, Math.min(OPTIONS_PAGES.length - 1, page));
    this._render();
    this._wrap.style.display = 'flex';
  }

  hide() {
    this._visible = false;
    this._wrap.style.display = 'none';
  }

  get element() { return this._wrap; }
}

// ── ScoreModal ────────────────────────────────────────────────────────────────

export class ScoreModal {
  constructor() {
    this._visible = false;
    this._wrap    = overlay();
    const p       = panel('420px');
    this._wrap.appendChild(p);

    const close = () => this.hide();
    p.appendChild(closeBtn(close));
    p.appendChild(heading('✦  SCORES'));

    this._body = el('div', { marginTop: '12px' });
    p.appendChild(this._body);

    this._wrap.addEventListener('click', e => { if (e.target === this._wrap) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && this._visible) close(); });
  }

  show(gameState) {
    this._visible = true;
    this._render(gameState);
    this._wrap.style.display = 'flex';
  }

  hide() {
    this._visible = false;
    this._wrap.style.display = 'none';
  }

  get element() { return this._wrap; }

  _render(gameState) {
    if (!gameState) {
      this._body.innerHTML = '<div style="color:#778;font-size:13px;text-align:center;padding:24px 0">No game data — play a game first.</div>';
      return;
    }

    const winner = gameState.winner;
    const teams  = [...gameState.teams].sort((a, b) => b.stats.score - a.stats.score);

    const rows = teams.map(t => {
      const alive  = t.stations.filter(s => s.status === 'active').length;
      const total  = t.stations.length;
      const dead   = !t.isAlive;
      const isWinner = t === winner;
      const [r, g, b] = t.colour;
      const opacity   = dead ? 0.4 : 1;

      const swatch = `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;`
        + `background:rgb(${r},${g},${b});margin-right:7px;vertical-align:middle;opacity:${opacity}"></span>`;

      const winnerBadge = isWinner
        ? `<span style="margin-left:8px;color:#ffd700;font-size:11px;letter-spacing:0.05em">★ WINNER</span>`
        : '';

      const staDots = '▪'.repeat(alive) + '▫'.repeat(total - alive);

      return `<div style="display:flex;align-items:center;justify-content:space-between;`
        + `padding:6px 10px;margin-bottom:4px;border-radius:4px;`
        + `background:rgba(255,255,255,0.04);opacity:${opacity}">`
        + `<div>${swatch}<span style="color:rgb(${r},${g},${b});font-size:13px">Team ${t.index + 1}</span>${winnerBadge}</div>`
        + `<div style="display:flex;gap:18px;font-size:13px">`
        + `<span style="color:#aab">Score <b style="color:#dde">${t.stats.score}</b></span>`
        + `<span style="color:#8a8">Kills <b style="color:#aca">${t.stats.kills}</b></span>`
        + `<span style="letter-spacing:2px;font-size:11px;color:#667">${staDots}</span>`
        + `</div></div>`;
    });

    this._body.innerHTML = rows.join('');
  }
}

// ── AboutModal ────────────────────────────────────────────────────────────────

export class AboutModal {
  constructor() {
    this._wrap         = overlay();
    this._onDevModeCb  = null;
    const p            = panel('360px');
    this._wrap.appendChild(p);

    const close = () => this.hide();
    p.appendChild(closeBtn(close));

    const content = el('div', { lineHeight: '2', fontSize: '14px', color: '#ccd', textAlign: 'center', marginTop: '18px' });
    content.innerHTML = `<div style="font-size:18px;letter-spacing:0.1em;color:#aac;margin-bottom:12px;">Death Star Battles</div>
<div style="color:#99a;">© Chloe Bolland 2026</div>
<div style="margin-top:14px;color:#889;font-size:12px;">A turn based artillery game of space combat, gravity and chaos.</div>
<div style="margin-top:18px;font-size:12px;color:#778;"><a href="mailto:chloe@mammoththoughts.com" style="color:#99b;text-decoration:none;">chloe@mammoththoughts.com</a></div>`;
    p.appendChild(content);

    // Click-and-hold for 2 s anywhere on the panel activates developer mode.
    // Uses touch/mouse events directly — pointer events are avoided because iOS
    // fires pointercancel on long press, which would kill the timer.
    let _holdTimer = null;
    const _startHold = () => {
      clearTimeout(_holdTimer);
      _holdTimer = setTimeout(() => { _holdTimer = null; this._onDevModeCb?.(); }, 2000);
    };
    const _cancelHold = () => { clearTimeout(_holdTimer); _holdTimer = null; };
    p.addEventListener('touchstart', _startHold);
    p.addEventListener('touchend',    _cancelHold);
    p.addEventListener('touchcancel', _cancelHold);
    p.addEventListener('mousedown',   _startHold);
    p.addEventListener('mouseup',     _cancelHold);
    p.addEventListener('mouseleave',  _cancelHold);

    this._wrap.addEventListener('click', e => { if (e.target === this._wrap) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  }

  onDevMode(cb)  { this._onDevModeCb = cb; }
  show() { this._wrap.style.display = 'flex'; }
  hide() { this._wrap.style.display = 'none'; }
  get element() { return this._wrap; }
}

// ── InstructionsModal ─────────────────────────────────────────────────────────

export class InstructionsModal {
  constructor() {
    this._wrap = overlay();
    const p    = panel('560px');
    this._wrap.appendChild(p);

    const close = () => this.hide();
    p.appendChild(closeBtn(close));
    p.appendChild(heading('✦  HOW TO PLAY'));

    p.appendChild(bodyText(
`Each turn, every player selects a weapon, sets an angle and power, then fires at their opponents. When all players have chosen, all projectiles fire simultaneously. Projectiles are affected by the gravity of planets and stars. Last station standing wins.


CONTROLS

Mouse:  Click the circle around your station to aim directly.
        The line length shows current power.

Keyboard:
  Z / A               Rotate aim counter-clockwise
  X / S               Rotate aim clockwise
  K / J               Increase power
  M / N               Decrease power
  W                   Cycle weapon
  Return              Fire / End turn
  P                   Pause / Unpause
  O                   Slow motion (while paused)


WEAPONS

Use the weapon selector button to cycle through available weapons. Special weapons (triple cannon, laser, rocket, and others) are collected as power-ups during play.

Hyperspace is also a weapon choice — select it instead of firing to teleport your station to a random location. Useful when surrounded by hazards or planets.

Force Shield deploys a protective barrier around your station for the duration of the firing phase.


COLLECTABLES

Collectables appear on the map as glowing gems. Hit one with your own projectile to claim it — you receive the reward automatically. Rewards include extra weapons, shields, and other bonuses.


WINNING

Destroy all enemy stations to win. Stations are destroyed by direct projectile hit. Watch out for gravity wells — your own shots can curve back and hit you.`));

    this._wrap.addEventListener('click', e => { if (e.target === this._wrap) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  }

  show() { this._wrap.style.display = 'flex'; }
  hide() { this._wrap.style.display = 'none'; }
  get element() { return this._wrap; }
}

// ── EducationModal ────────────────────────────────────────────────────────────

export class EducationModal {
  constructor() {
    this._page = 0;
    this._wrap = overlay();
    const p    = panel('580px');
    this._wrap.appendChild(p);

    const close = () => this.hide();
    p.appendChild(closeBtn(close));

    this._titleEl = heading('', '15px');
    p.appendChild(this._titleEl);

    this._bodyEl = bodyText('');
    p.appendChild(this._bodyEl);

    // Navigation bar
    const nav = el('div', {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginTop: '24px',
    });

    this._prevBtn = this._navBtn('◄  Previous', () => this._go(-1));
    this._indicator = el('span', { fontSize: '12px', color: '#778', letterSpacing: '0.06em' });
    this._nextBtn = this._navBtn('Next  ►', () => this._go(+1));

    nav.appendChild(this._prevBtn);
    nav.appendChild(this._indicator);
    nav.appendChild(this._nextBtn);
    p.appendChild(nav);

    this._wrap.addEventListener('click', e => { if (e.target === this._wrap) close(); });
    document.addEventListener('keydown', e => {
      if (!this._visible) return;
      if (e.key === 'Escape')     close();
      if (e.key === 'ArrowLeft')  this._go(-1);
      if (e.key === 'ArrowRight') this._go(+1);
    });
  }

  _navBtn(label, onClick) {
    const btn = el('button', {
      background:   'transparent',
      border:       '1px solid rgba(100,120,255,0.3)',
      borderRadius: '4px',
      color:        'rgba(170,185,255,0.75)',
      fontFamily:   'monospace',
      fontSize:     '13px',
      padding:      '4px 14px',
      cursor:       'pointer',
    });
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    btn.addEventListener('mouseenter', () => { btn.style.borderColor = 'rgba(150,170,255,0.7)'; });
    btn.addEventListener('mouseleave', () => { btn.style.borderColor = 'rgba(100,120,255,0.3)'; });
    return btn;
  }

  _go(delta) {
    this._page = Math.max(0, Math.min(EDUCATION_PAGES.length - 1, this._page + delta));
    this._render();
  }

  _render() {
    const pg = EDUCATION_PAGES[this._page];
    this._titleEl.textContent = `✦  ${pg.title.toUpperCase()}`;
    this._bodyEl.textContent  = pg.body;
    this._indicator.textContent = `${this._page + 1} / ${EDUCATION_PAGES.length}`;
    this._prevBtn.style.visibility = this._page === 0 ? 'hidden' : 'visible';
    this._nextBtn.style.visibility = this._page === EDUCATION_PAGES.length - 1 ? 'hidden' : 'visible';
  }

  show() {
    this._visible = true;
    this._page = 0;
    this._render();
    this._wrap.style.display = 'flex';
  }
  hide() {
    this._visible = false;
    this._wrap.style.display = 'none';
  }
  get element() { return this._wrap; }
}
