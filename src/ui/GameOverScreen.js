// Combined end-of-game stats + tournament standings + awards screen.
// In tournament mode, an awards sub-section is shown every 5 games.

const AWARD_DEFS = {
  bloodlust:  { icon: '★', label: 'BLOODLUST',   stat: 'kills',           unit: 'kills' },
  strategy:   { icon: '▲', label: 'STRATEGY',    stat: 'strategyKills',   unit: 'str'   },
  oppression: { icon: '◆', label: 'OPPRESSION',  stat: 'oppressionKills', unit: 'opp'   },
  tactics:    { icon: '◉', label: 'TACTICS',     stat: 'tacticsKills',    unit: 'tac'   },
  bully:      { icon: '●', label: 'BULLY',       stat: 'bullyKills',      unit: 'bull'  },
  vengeance:  { icon: '⚡', label: 'VENGEANCE',   stat: 'vengeanceKills',  unit: 'veng'  },
  longshot:   { icon: '→', label: 'LONGSHOT',    stat: 'longshotKills',   unit: 'lng'   },
  closeshot:  { icon: '✦', label: 'POINT BLANK', stat: 'closeshotKills',  unit: 'cls'   },
};

export class GameOverScreen {
  constructor() {
    this._onContinueCb = null;
    this._onNewGameCb  = null;
    this.element = this._build();
  }

  onContinue(cb) { this._onContinueCb = cb; }
  onNewGame(cb)  { this._onNewGameCb  = cb; }

  show(gameState, tournament) {
    this._populate(gameState, tournament);
    this.element.style.display = 'flex';
  }

  hide() { this.element.style.display = 'none'; }

  // ── DOM build ──────────────────────────────────────────────────────────────

  _build() {
    const overlay = el('div', {
      position: 'fixed', inset: '0', zIndex: '50',
      display: 'none',
      alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,8,0.78)',
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

  _populate(gameState, tournament) {
    this._card.innerHTML = '';

    // Winner heading
    const winner = gameState.winner;
    const winnerColour = winner ? `rgb(${winner.colour.join(',')})` : '#aaa';
    const winText = winner ? `Team ${winner.index + 1} wins!` : 'Draw';

    const heading = el('div', { marginBottom: '20px', textAlign: 'center' });
    heading.innerHTML =
      `<div style="font-size:14px;letter-spacing:0.15em;color:rgba(160,175,240,0.6)">GAME OVER</div>` +
      `<div style="font-size:26px;font-weight:bold;color:${winnerColour};` +
             `text-shadow:0 0 20px ${winnerColour};margin-top:6px">${winText}</div>`;
    this._card.appendChild(heading);

    // Per-station stats table
    this._card.appendChild(this._statsTable(gameState));

    // Tournament section
    if (tournament) {
      const shouldAwards = tournament.shouldShowAwards();
      if (shouldAwards) this._card.appendChild(this._awardsSection(tournament));
      this._card.appendChild(this._standingsSection(tournament));
    }

    // Buttons
    this._card.appendChild(this._buttons(tournament));
  }

  _statsTable(gameState) {
    const wrap = el('div', { marginBottom: '18px' });

    const title = el('div', {
      fontSize: '11px', letterSpacing: '0.1em',
      color: 'rgba(150,165,230,0.6)', marginBottom: '8px',
    });
    title.textContent = 'GAME STATS';
    wrap.appendChild(title);

    const table = el('table', {
      width: '100%', borderCollapse: 'collapse', fontSize: '12px',
    });

    const thead = document.createElement('thead');
    thead.innerHTML =
      `<tr style="color:rgba(150,165,230,0.5);text-align:right;font-size:10px">` +
      `<td style="text-align:left;padding:2px 4px">TEAM</td>` +
      `<td style="padding:2px 8px">SHOTS</td>` +
      `<td style="padding:2px 8px">KILLS</td>` +
      `<td style="padding:2px 8px">ACCURACY</td>` +
      `<td style="padding:2px 8px">FRIENDLY FIRE</td>` +
      `<td style="padding:2px 4px"></td>` +
      `</tr>`;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (const team of gameState.teams) {
      const [r, g, b] = team.colour;
      const colour = `rgb(${r},${g},${b})`;

      const shots = team.stations.reduce((n, s) => n + s.stats.shots, 0);
      const kills = team.stations.reduce((n, s) => n + s.stats.kills, 0);
      const ff    = team.stations.reduce((n, s) => n + s.stats.suicides + s.stats.ownGoals, 0);
      const acc   = shots > 0 ? Math.round(kills / shots * 100) + '%' : '—';
      const alive = team.stations.filter(s => s.status === 'active').length;
      const total = team.stations.length;
      const survived = alive > 0 ? (total > 1 ? `✓ ${alive}/${total}` : '✓') : '';

      tbody.innerHTML +=
        `<tr style="border-top:1px solid rgba(80,100,200,0.12)">` +
        `<td style="padding:4px 4px;color:${colour}">Team ${team.index + 1}</td>` +
        `<td style="text-align:right;padding:4px 8px;color:#aab">${shots}</td>` +
        `<td style="text-align:right;padding:4px 8px;color:#aab">${kills}</td>` +
        `<td style="text-align:right;padding:4px 8px;color:#9ab">${acc}</td>` +
        `<td style="text-align:right;padding:4px 8px;color:#a88">${ff || '—'}</td>` +
        `<td style="text-align:right;padding:4px 4px;color:${colour}">${survived}</td>` +
        `</tr>`;
    }
    table.appendChild(tbody);
    wrap.appendChild(table);
    return wrap;
  }

  _awardsSection(tournament) {
    const wrap = el('div', {
      margin: '16px 0', padding: '14px 16px',
      background: 'rgba(60,70,180,0.1)',
      border: '1px solid rgba(80,110,255,0.25)',
      borderRadius: '5px',
    });

    const title = el('div', {
      fontSize: '13px', letterSpacing: '0.12em',
      color: 'rgba(200,210,255,0.8)', marginBottom: '10px',
      textShadow: '0 0 12px rgba(120,140,255,0.5)',
    });
    title.textContent = `✦  TOURNAMENT AWARDS — GAME ${tournament.gameIndex}`;
    wrap.appendChild(title);

    const aw = tournament.awards();
    if (!aw) return wrap;

    for (const { key, winner } of aw) {
      const def = AWARD_DEFS[key];
      if (!def || !winner) continue;
      const [r, g, b] = winner.colour;
      const row = el('div', { display: 'flex', alignItems: 'center', marginBottom: '5px' });
      row.innerHTML =
        `<span style="color:rgba(180,190,255,0.55);min-width:110px;font-size:11px;letter-spacing:0.06em">${def.icon} ${def.label}</span>` +
        `<span style="color:rgb(${r},${g},${b});font-weight:bold">${winner.label}</span>` +
        `<span style="color:rgba(150,165,210,0.55);margin-left:8px;font-size:11px">(${winner[def.stat]} ${def.unit})</span>`;
      wrap.appendChild(row);
    }
    return wrap;
  }

  _standingsSection(tournament) {
    const wrap = el('div', { marginBottom: '16px' });

    const title = el('div', {
      fontSize: '11px', letterSpacing: '0.1em',
      color: 'rgba(150,165,230,0.6)', marginBottom: '6px',
    });
    title.textContent = `TOURNAMENT STANDINGS  (${tournament.gameIndex} games)`;
    wrap.appendChild(title);

    const rows = tournament.sorted;
    for (let i = 0; i < rows.length; i++) {
      const d = rows[i];
      const [r, g, b] = d.colour;
      const row = el('div', {
        display: 'flex', alignItems: 'center', padding: '2px 0',
        fontSize: '12px',
      });
      row.innerHTML =
        `<span style="color:rgba(150,165,230,0.5);min-width:20px">${i + 1}.</span>` +
        `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:rgb(${r},${g},${b});margin:0 6px;vertical-align:middle"></span>` +
        `<span style="color:rgb(${r},${g},${b});min-width:70px">${d.label}</span>` +
        `<span style="color:#eef;font-weight:bold;min-width:36px;text-align:right">${d.score}</span>` +
        `<span style="color:rgba(150,165,210,0.5);margin-left:8px;font-size:11px">${d.wins}W · ${d.kills}K</span>`;
      wrap.appendChild(row);
    }
    return wrap;
  }

  _buttons(tournament) {
    const bar = el('div', { display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '8px' });

    const continueBtn = btn(tournament ? 'Next Game' : 'Play Again', true);
    continueBtn.addEventListener('click', () => {
      this.hide();
      this._onContinueCb?.();
    });
    bar.appendChild(continueBtn);

    const newBtn = btn('New Game', false);
    newBtn.addEventListener('click', () => {
      this.hide();
      this._onNewGameCb?.();
    });
    bar.appendChild(newBtn);

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
