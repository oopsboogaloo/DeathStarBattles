// Copyright © 2026 Chloe Bolland
// contact chloe@mammoththoughts.com if you wish to use, publish or reproduce this game or any part of it in any way

// Compact live leaderboard overlay — shown during play, hidden during demo/gameover.
// Toggle with L key or programmatically.

export class Leaderboard {
  constructor() {
    this._open = true;
    this.element = this._build();
  }

  show()   { this.element.style.display = 'block'; }
  hide()   { this.element.style.display = 'none'; }
  toggle() { this._open = !this._open; this._applyOpen(); }

  // Call each frame (or each time game state changes)
  update(gameState) {
    if (!gameState) { this.element.style.display = 'none'; return; }
    this.element.style.display = 'block';
    this._render(gameState);
  }

  _build() {
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'fixed', bottom: '60px', right: '12px',
      zIndex: '9',
      fontFamily: 'monospace', fontSize: '12px',
      color: '#ccd',
      background: 'rgba(3,3,18,0.82)',
      border: '1px solid rgba(80,100,220,0.3)',
      borderRadius: '5px',
      minWidth: '160px',
      userSelect: 'none',
    });

    // Header / toggle
    this._header = document.createElement('div');
    Object.assign(this._header.style, {
      padding: '4px 8px',
      borderBottom: '1px solid rgba(80,100,220,0.25)',
      cursor: 'pointer',
      color: 'rgba(160,175,240,0.7)',
      fontSize: '10px',
      letterSpacing: '0.08em',
      display: 'flex',
      justifyContent: 'space-between',
    });
    this._header.innerHTML = '<span>SCORE</span><span id="lb-arrow">▲</span>';
    this._header.addEventListener('click', () => this.toggle());
    el.appendChild(this._header);

    this._body = document.createElement('div');
    this._body.style.padding = '4px 0';
    el.appendChild(this._body);

    return el;
  }

  _applyOpen() {
    this._body.style.display = this._open ? 'block' : 'none';
    const arrow = this._header.querySelector('#lb-arrow');
    if (arrow) arrow.textContent = this._open ? '▲' : '▼';
  }

  _render(gameState) {
    const teams = [...gameState.teams].sort((a, b) => b.stats.score - a.stats.score);
    const rows  = teams.map(t => {
      const alive = t.stations.filter(s => s.status === 'active').length;
      const total = t.stations.length;
      const dead  = !t.isAlive;
      const [r, g, b] = t.colour;

      const swatch = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:rgb(${r},${g},${b});margin-right:5px;vertical-align:middle;opacity:${dead ? 0.35 : 1}"></span>`;
      const label  = `T${t.index + 1}`;
      const score  = String(t.stats.score).padStart(3);
      const kills  = String(t.stats.kills).padStart(2) + 'k';
      const sta    = '▪'.repeat(alive) + '▫'.repeat(total - alive);

      return `<div style="padding:2px 8px;opacity:${dead ? 0.4 : 1};white-space:nowrap">` +
        `${swatch}<span style="color:rgb(${r},${g},${b})">${label}</span>` +
        `<span style="color:#aab;margin-left:6px">${score}</span>` +
        `<span style="color:rgba(180,200,180,0.7);margin-left:5px">${kills}</span>` +
        `<span style="margin-left:6px;letter-spacing:1px;font-size:10px">${sta}</span>` +
        `</div>`;
    });

    this._body.innerHTML = rows.join('');
  }
}
