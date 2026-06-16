// Copyright © 2026 Chloe Bolland
// contact chloe@mammoththoughts.com if you wish to use, publish or reproduce this game or any part of it in any way

import { WeaponId } from '../entities/Collectable.js';

const LABELS = {
  [WeaponId.CANNON]:        'CANNON',
  [WeaponId.HYPERSPACE]:    'HYPERSPACE',
  [WeaponId.TRIPLE_CANNON]: 'TRIPLE CANNON',
  [WeaponId.BLUNDERBUSS]:   'BLUNDERBUSS',
  [WeaponId.LASER]:         'LASER',
  [WeaponId.ROCKET]:        'ROCKET',
  [WeaponId.ROCKET_POD]:    'ROCKET POD',
  [WeaponId.BLASTER]:       'BLASTER',
  [WeaponId.MINIGUN]:            'MINIGUN',
  [WeaponId.FORCE_SHIELD]:       'FORCE SHIELD',
  [WeaponId.SEPTUPLE_CANNON]:    'SEPT. CANNON',
  [WeaponId.ANTIMATTER_LASER]:   'ANTIMATTER LASER',
  [WeaponId.FRAGMENTATION_SHOT]: 'FRAG SHOT',
  [WeaponId.SHOTGUN]:            'SHOTGUN',
  [WeaponId.DUAL_BLASTER]:      'DUAL BLASTER',
  [WeaponId.BOUNCE_CANNON]:     'BOUNCE CANNON',
  [WeaponId.AUTO_CANNON]:       'AUTO CANNON',
  [WeaponId.STAR_SHOT]:         'STAR SHOT',
  [WeaponId.SCATTER_CANNON]:    'SCATTER CANNON',
  [WeaponId.SPIRAL]:            'SPIRAL',
  [WeaponId.RESUPPLY]:          'RESUPPLY',
  [WeaponId.HEDGEHOG]:          'HEDGEHOG',
  [WeaponId.TEAM_SHIELD]:       'TEAM SHIELD',
  [WeaponId.ARMOUR]:            'ARMOUR',
  [WeaponId.REPULSOR_FIELD]:    'REPULSOR FIELD',
  [WeaponId.MAMMOTH_CANNON]:    'MAMMOTH CANNON',
  [WeaponId.QUANTUM_TORPEDO]:        'QUANTUM TORPEDO',
  [WeaponId.TRIPLE_QUANTUM_TORPEDO]: 'TRIPLE Q. TORP.',
  [WeaponId.QUANTUM_AUTO_CANNON]:    'QUANTUM AUTO-C.',
  [WeaponId.GRAVITY_CANNON]:         'GRAVITY CANNON',
  [WeaponId.ELECTRO_STUN]:           'ELECTRO STUN',
  [WeaponId.TELEPORT]:               'TELEPORT',
  [WeaponId.SUPER_LASER]:            'SUPER LASER',
  [WeaponId.REINFORCEMENT_SIGNAL]:   'REINF. SIGNAL',
  [WeaponId.MIND_CONTROL_BEAM]:      'MIND CONTROL',
};

// Weapons that use stock (shown with [n] count)
const LIMITED = new Set([
  WeaponId.TRIPLE_CANNON, WeaponId.BLUNDERBUSS, WeaponId.LASER, WeaponId.ROCKET,
  WeaponId.ROCKET_POD, WeaponId.BLASTER, WeaponId.MINIGUN, WeaponId.FORCE_SHIELD,
  WeaponId.SEPTUPLE_CANNON, WeaponId.ANTIMATTER_LASER, WeaponId.FRAGMENTATION_SHOT,
  WeaponId.SHOTGUN, WeaponId.DUAL_BLASTER,
  WeaponId.BOUNCE_CANNON, WeaponId.AUTO_CANNON, WeaponId.STAR_SHOT,
  WeaponId.SCATTER_CANNON, WeaponId.SPIRAL,
  WeaponId.RESUPPLY, WeaponId.HEDGEHOG, WeaponId.TEAM_SHIELD,
  WeaponId.ARMOUR, WeaponId.REPULSOR_FIELD, WeaponId.MAMMOTH_CANNON,
  WeaponId.QUANTUM_TORPEDO, WeaponId.TRIPLE_QUANTUM_TORPEDO,
  WeaponId.QUANTUM_AUTO_CANNON, WeaponId.GRAVITY_CANNON,
  WeaponId.ELECTRO_STUN, WeaponId.TELEPORT, WeaponId.SUPER_LASER,
  WeaponId.REINFORCEMENT_SIGNAL, WeaponId.MIND_CONTROL_BEAM,
]);

// Max items in each column before adding another column
const COL_SIZE = 8;

export class WeaponSelector {
  constructor() {
    this._onSelect = null;
    this._isOpen   = false;
    this._minimal  = false;
    this._colMode  = 1; // 1 | 2 | 3 | 'scroll'
    this.popup     = this._buildPopup();
    document.body.appendChild(this.popup);
  }

  setOnSelect(cb) { this._onSelect = cb; }
  get isOpen()    { return this._isOpen; }

  setMinimal(minimal) {
    this._minimal = minimal;
    this.popup.style.fontSize = minimal ? '12px' : '14px';
  }

  updateBtn(btn, station) {
    if (!station) return;
    const w   = station.selectedWeapon;
    const lbl = LABELS[w] ?? w;
    const n   = LIMITED.has(w) ? station.team.getStock(w) : null;
    btn.textContent = n !== null ? `${lbl} [${n === Infinity ? '∞' : n}] ▲` : `${lbl} ▲`;
  }

  open(station, anchorEl, gs) {
    this._rebuildRows(station, gs);
    this.popup.style.display = this._colMode > 1 ? 'flex' : 'block';
    this._isOpen = true;
    this._position(anchorEl);
  }

  close() {
    this.popup.style.display = 'none';
    this._isOpen = false;
  }

  toggle(station, anchorEl, gs) {
    this._isOpen ? this.close() : this.open(station, anchorEl, gs);
  }

  _position(anchorEl) {
    const rect   = anchorEl.getBoundingClientRect();
    const bottom = window.innerHeight - rect.top + 6;

    // Reset scroll state
    this.popup.style.overflowY = this._colMode === 'scroll' ? 'auto' : 'hidden';
    this.popup.style.WebkitOverflowScrolling = this._colMode === 'scroll' ? 'touch' : '';
    this.popup.style.maxHeight = this._colMode === 'scroll'
      ? `${Math.round(window.innerHeight * 0.65)}px` : '';

    this.popup.style.left   = `${rect.left}px`;
    this.popup.style.bottom = `${bottom}px`;
    this.popup.style.top    = 'auto';

    // Clamp to screen bounds after layout
    requestAnimationFrame(() => {
      if (!this._isOpen) return;
      const pr = this.popup.getBoundingClientRect();
      if (pr.right > window.innerWidth - 4) {
        this.popup.style.left = `${Math.max(4, window.innerWidth - pr.width - 4)}px`;
      }
      if (pr.top < 4) {
        this.popup.style.bottom = 'auto';
        this.popup.style.top    = '4px';
      }
    });
  }

  _buildPopup() {
    const popup = document.createElement('div');
    Object.assign(popup.style, {
      position:     'fixed',
      display:      'none',
      background:   'rgba(3,3,18,0.97)',
      border:       '1px solid rgba(80,110,255,0.4)',
      borderRadius: '6px',
      padding:      '6px 0',
      fontFamily:   'monospace',
      fontSize:     '14px',
      zIndex:       '20',
      boxShadow:    '0 0 20px rgba(50,70,200,0.3)',
      minWidth:     '190px',
    });
    return popup;
  }

  _makeCol() {
    const col = document.createElement('div');
    Object.assign(col.style, { display: 'flex', flexDirection: 'column' });
    return col;
  }

  _rebuildRows(station, gs) {
    this.popup.innerHTML = '';
    const team = station.team;
    const cannonEnabled = gs?.storyState?.mission.settings.cannonEnabled !== false;

    const allWeapons = [
      ...(cannonEnabled ? [WeaponId.CANNON] : []),
      WeaponId.HYPERSPACE,
      WeaponId.TRIPLE_CANNON,
      WeaponId.BLUNDERBUSS,
      WeaponId.LASER,
      WeaponId.ROCKET,
      WeaponId.ROCKET_POD,
      WeaponId.BLASTER,
      WeaponId.MINIGUN,
      WeaponId.FORCE_SHIELD,
      WeaponId.SEPTUPLE_CANNON,
      WeaponId.ANTIMATTER_LASER,
      WeaponId.FRAGMENTATION_SHOT,
      WeaponId.SHOTGUN,
      WeaponId.DUAL_BLASTER,
      WeaponId.BOUNCE_CANNON,
      WeaponId.AUTO_CANNON,
      WeaponId.STAR_SHOT,
      WeaponId.SCATTER_CANNON,
      WeaponId.SPIRAL,
      WeaponId.RESUPPLY,
      WeaponId.HEDGEHOG,
      // Team Shield only useful when team has multiple stations
      ...(team.stations.filter(s => s.status === 'active').length > 1 ? [WeaponId.TEAM_SHIELD] : []),
      WeaponId.ARMOUR,
      WeaponId.REPULSOR_FIELD,
      WeaponId.MAMMOTH_CANNON,
      WeaponId.QUANTUM_TORPEDO,
      WeaponId.TRIPLE_QUANTUM_TORPEDO,
      WeaponId.QUANTUM_AUTO_CANNON,
      WeaponId.GRAVITY_CANNON,
      WeaponId.ELECTRO_STUN,
      WeaponId.TELEPORT,
      WeaponId.SUPER_LASER,
      WeaponId.REINFORCEMENT_SIGNAL,
      WeaponId.MIND_CONTROL_BEAM,
    ];

    // Build visible rows
    const rowPad = this._minimal ? '5px 10px' : '8px 16px';
    const rows = [];
    for (const weaponId of allWeapons) {
      const isLimited  = LIMITED.has(weaponId);
      const rawStock   = isLimited ? team.getStock(weaponId) : Infinity;
      const reserved   = isLimited ? station.team.stations.filter(
        s => s !== station && s.status === 'active' && s.selectedWeapon === weaponId
      ).length : 0;
      const stock      = isLimited ? Math.max(0, rawStock - reserved) : Infinity;
      if (isLimited && stock <= 0) continue;
      const isSelected = station.selectedWeapon === weaponId;
      const lbl        = LABELS[weaponId];
      const suffix     = isLimited ? (stock === Infinity ? ' [∞]' : ` [${stock}]`) : ' (∞)';

      const row = document.createElement('div');
      row.textContent = (isSelected ? '▶ ' : '   ') + lbl + suffix;
      Object.assign(row.style, {
        padding:    rowPad,
        cursor:     'pointer',
        color:      isSelected ? '#fff' : '#99b',
        background: 'transparent',
        whiteSpace: 'nowrap',
      });
      row.addEventListener('mouseenter', () => { row.style.background = 'rgba(40,40,80,0.8)'; });
      row.addEventListener('mouseleave', () => { row.style.background = 'transparent'; });
      row.addEventListener('click', e => {
        e.stopPropagation();
        this._onSelect?.(weaponId);
        this.close();
      });
      rows.push(row);
    }

    const colBorder = '1px solid rgba(80,110,255,0.3)';

    if (rows.length <= COL_SIZE) {
      // Single column
      rows.forEach(r => this.popup.appendChild(r));
      this._colMode = 1;

    } else if (rows.length <= COL_SIZE * 2) {
      // Two columns: col1 (left) | col2 (right)
      const col1 = this._makeCol();
      const col2 = this._makeCol();
      col2.style.borderLeft = colBorder;
      rows.slice(0, COL_SIZE).forEach(r => col1.appendChild(r));
      rows.slice(COL_SIZE).forEach(r => col2.appendChild(r));
      this.popup.appendChild(col1);
      this.popup.appendChild(col2);
      this._colMode = 2;

    } else if (rows.length <= COL_SIZE * 3) {
      // Three columns: col3 (left) | col1 (center) | col2 (right)
      const col1 = this._makeCol();
      const col2 = this._makeCol();
      const col3 = this._makeCol();
      col1.style.borderLeft = colBorder; // between col3 and col1
      col2.style.borderLeft = colBorder; // between col1 and col2
      rows.slice(0, COL_SIZE).forEach(r => col1.appendChild(r));
      rows.slice(COL_SIZE, COL_SIZE * 2).forEach(r => col2.appendChild(r));
      rows.slice(COL_SIZE * 2).forEach(r => col3.appendChild(r));
      this.popup.appendChild(col3); // leftmost
      this.popup.appendChild(col1); // center
      this.popup.appendChild(col2); // rightmost
      this._colMode = 3;

    } else {
      // Overflow: single scrollable column
      rows.forEach(r => this.popup.appendChild(r));
      this._colMode = 'scroll';
    }
  }
}
