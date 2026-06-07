export class TargetPracticeResultsScreen {
  constructor() {
    this._onPlayAgainCb = null;
    this._onMainMenuCb  = null;
    this.element = this._build();
  }

  onPlayAgain(cb)  { this._onPlayAgainCb = cb; }
  onMainMenu(cb)   { this._onMainMenuCb  = cb; }

  show(gameState) {
    this._populate(gameState);
    this.element.style.display = 'flex';
  }

  hide() { this.element.style.display = 'none'; }

  // ── DOM build ──────────────────────────────────────────────────────────────

  _build() {
    const overlay = el('div', {
      position: 'fixed', inset: '0', zIndex: '50',
      display: 'none',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,8,0.82)',
    });

    const card = el('div', {
      background:   'rgba(3,3,18,0.97)',
      border:       '1px solid rgba(80,110,255,0.35)',
      borderRadius: '8px',
      padding:      '24px 32px 28px',
      maxWidth:     '680px',
      width:        '95vw',
      maxHeight:    '90vh',
      overflowY:    'auto',
      color:        '#ccd',
      fontFamily:   'monospace',
      boxShadow:    '0 0 50px rgba(50,70,200,0.2)',
    });
    overlay.appendChild(card);
    this._card = card;
    return overlay;
  }

  // ── Populate ───────────────────────────────────────────────────────────────

  _populate(gameState) {
    this._card.innerHTML = '';

    // Heading
    const heading = el('div', { marginBottom: '20px', textAlign: 'center' });
    heading.innerHTML =
      `<div style="font-size:13px;letter-spacing:0.15em;color:rgba(160,175,240,0.6)">TARGET PRACTICE</div>` +
      `<div style="font-size:24px;font-weight:bold;color:#eef;` +
           `text-shadow:0 0 18px rgba(120,140,255,0.5);margin-top:6px">RESULTS</div>`;
    this._card.appendChild(heading);

    this._card.appendChild(this._statsTable(gameState));

    const bp = gameState.config?.bulletPaths;
    if (bp && bp !== 'off') {
      const label = { eighth: 'Minor', quarter: 'Major', half: 'Extreme', full: 'Cheating' }[bp] ?? bp;
      const note = el('div', { fontSize: '11px', color: 'rgba(255,200,80,0.6)', textAlign: 'center', marginBottom: '14px', fontStyle: 'italic' });
      note.textContent = `Assistance level... ${label}`;
      this._card.appendChild(note);
    }

    this._card.appendChild(this._buttons());
  }

  _statsTable(gameState) {
    const tp   = gameState.tpGame;
    const wrap = el('div', { marginBottom: '18px' });

    const title = el('div', {
      fontSize: '11px', letterSpacing: '0.1em',
      color: 'rgba(150,165,230,0.6)', marginBottom: '8px',
    });
    title.textContent = `${tp.N} TARGETS  ·  UP TO ${tp.totalRounds} ROUNDS`;
    wrap.appendChild(title);

    const table = document.createElement('table');
    Object.assign(table.style, { width: '100%', borderCollapse: 'collapse', fontSize: '12px' });

    const thead = document.createElement('thead');
    thead.innerHTML =
      `<tr style="color:rgba(150,165,230,0.5);text-align:right;font-size:10px">` +
      `<td style="text-align:left;padding:2px 4px">TEAM / STATION</td>` +
      `<td style="padding:2px 8px">HITS</td>` +
      `<td style="padding:2px 8px">HIT RATE</td>` +
      `<td style="padding:2px 8px">ACCURACY</td>` +
      `<td style="padding:2px 4px">CLEARED</td>` +
      `</tr>`;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    for (const team of gameState.teams) {
      const [r, g, b] = team.colour;
      const colour  = `rgb(${r},${g},${b})`;
      const data    = tp.teamData.get(team.index);
      if (!data) continue;

      const hits      = data.hits.length;
      const hitRate   = Math.round(hits / tp.N * 100);
      const meanAcc   = data.meanAccuracy();
      const accStr    = meanAcc !== null ? Math.round(meanAcc * 100) + '%' : '—';
      const clearedStr = data.finishedRound !== null
        ? `Round ${data.finishedRound} / ${tp.totalRounds}`
        : '—';
      const clearedColour = data.finishedRound !== null ? '#88ee88' : 'rgba(200,200,200,0.5)';

      tbody.innerHTML +=
        `<tr style="border-top:1px solid rgba(80,100,200,0.18)">` +
        `<td style="padding:4px 4px;color:${colour};font-weight:bold">Team ${team.index + 1}</td>` +
        `<td style="text-align:right;padding:4px 8px;color:#eef">${hits} / ${tp.N}</td>` +
        `<td style="text-align:right;padding:4px 8px;color:#eef">${hitRate}%</td>` +
        `<td style="text-align:right;padding:4px 8px;color:#cde">${accStr}</td>` +
        `<td style="text-align:right;padding:4px 4px;color:${clearedColour};font-size:11px">${clearedStr}</td>` +
        `</tr>`;

      // Per-station contribution (indented, only if the team has multiple stations)
      if (team.stations.length > 1) {
        for (const station of team.stations) {
          const sHits   = data.hits.filter(h => h.stationId === station.id);
          const sAcc    = sHits.length ? Math.round(sHits.reduce((s, h) => s + h.accuracy, 0) / sHits.length * 100) + '%' : '—';
          const statIdx = team.stations.indexOf(station) + 1;

          tbody.innerHTML +=
            `<tr style="border-top:1px solid rgba(80,100,200,0.07)">` +
            `<td style="padding:3px 4px;color:${colour};opacity:0.7;padding-left:16px;font-size:11px">Station ${statIdx}</td>` +
            `<td style="text-align:right;padding:3px 8px;color:#aab;font-size:11px">${sHits.length}</td>` +
            `<td style="text-align:right;padding:3px 8px;color:#aab;font-size:11px">${sHits.length > 0 ? Math.round(sHits.length / tp.N * 100) + '%' : '—'}</td>` +
            `<td style="text-align:right;padding:3px 8px;color:#9ab;font-size:11px">${sAcc}</td>` +
            `<td></td>` +
            `</tr>`;
        }
      }
    }

    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  _buttons() {
    const bar = el('div', { display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '8px' });

    const playAgainBtn = btn('Play Again', true);
    playAgainBtn.addEventListener('click', () => { this.hide(); this._onPlayAgainCb?.(); });
    bar.appendChild(playAgainBtn);

    const menuBtn = btn('Main Menu', false);
    menuBtn.addEventListener('click', () => { this.hide(); this._onMainMenuCb?.(); });
    bar.appendChild(menuBtn);

    return bar;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function el(tag, styles) {
  const node = document.createElement(tag);
  Object.assign(node.style, styles);
  return node;
}

function btn(label, primary) {
  const b = el('button', {
    padding:       '10px 32px',
    background:    primary ? 'rgba(35,55,175,0.7)' : 'rgba(10,10,25,0.8)',
    border:        primary ? '1px solid rgba(110,140,255,0.55)' : '1px solid rgba(255,255,255,0.25)',
    borderRadius:  '5px',
    color:         '#eef',
    fontFamily:    'monospace',
    fontSize:      '14px',
    letterSpacing: '0.08em',
    cursor:        'pointer',
    boxShadow:     primary ? '0 0 16px rgba(70,95,255,0.3)' : 'none',
  });
  b.textContent = label;
  b.addEventListener('mouseenter', () => b.style.opacity = '0.85');
  b.addEventListener('mouseleave', () => b.style.opacity = '1');
  return b;
}
