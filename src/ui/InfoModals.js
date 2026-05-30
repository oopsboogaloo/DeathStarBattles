// About, Instructions, and Education modal overlays.
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

// ── AboutModal ────────────────────────────────────────────────────────────────

export class AboutModal {
  constructor() {
    this._wrap   = overlay();
    const p      = panel('360px');
    this._wrap.appendChild(p);

    const close = () => this.hide();
    p.appendChild(closeBtn(close));
    p.appendChild(heading('✦  DEATH STAR BATTLES'));

    const content = el('div', { lineHeight: '2', fontSize: '14px', color: '#ccd', textAlign: 'center', marginTop: '18px' });
    content.innerHTML = `<div style="font-size:18px;letter-spacing:0.1em;color:#aac;margin-bottom:12px;">Death Star Battles</div>
<div style="color:#99a;">© Chloe Bolland 2026</div>
<div style="margin-top:14px;color:#889;font-size:12px;">Based on a game I wrote 25 years ago.</div>`;
    p.appendChild(content);

    this._wrap.addEventListener('click', e => { if (e.target === this._wrap) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  }

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
`Each turn, every player sets an angle and power for their station to fire a projectile at their opponents. When all players have chosen, all projectiles fire simultaneously. Projectiles are affected by the gravity of planets and stars. Last station standing wins.


CONTROLS

Mouse:  Click the circle around your station to aim directly.
        The line length shows current power.

Keyboard:
  Z / A               Rotate aim counter-clockwise
  X / S               Rotate aim clockwise
  K / J               Increase power
  M / N               Decrease power
  H                   Toggle hyperspace
  Return              Fire / End turn
  P                   Pause / Unpause
  O                   Slow motion (while paused)


HYPERSPACE

Instead of firing, click Hyperspace then End Turn to teleport your station to a random location. Useful when surrounded by hazards.


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
