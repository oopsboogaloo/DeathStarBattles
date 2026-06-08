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
};

// Weapons that use stock (shown with [n] count)
const LIMITED = new Set([
  WeaponId.TRIPLE_CANNON, WeaponId.BLUNDERBUSS, WeaponId.LASER, WeaponId.ROCKET,
  WeaponId.ROCKET_POD, WeaponId.BLASTER, WeaponId.MINIGUN, WeaponId.FORCE_SHIELD,
  WeaponId.SEPTUPLE_CANNON, WeaponId.ANTIMATTER_LASER, WeaponId.FRAGMENTATION_SHOT,
  WeaponId.SHOTGUN, WeaponId.DUAL_BLASTER,
  WeaponId.BOUNCE_CANNON, WeaponId.AUTO_CANNON, WeaponId.STAR_SHOT,
  WeaponId.SCATTER_CANNON, WeaponId.SPIRAL,
]);

export class WeaponSelector {
  constructor() {
    this._onSelect = null;
    this._isOpen   = false;
    this.popup     = this._buildPopup();
    document.body.appendChild(this.popup);
  }

  setOnSelect(cb) { this._onSelect = cb; }
  get isOpen()    { return this._isOpen; }

  updateBtn(btn, station) {
    if (!station) return;
    const w   = station.selectedWeapon;
    const lbl = LABELS[w] ?? w;
    const n   = LIMITED.has(w) ? station.team.getStock(w) : null;
    btn.textContent = n !== null ? `${lbl} [${n}] ▲` : `${lbl} ▲`;
  }

  open(station, anchorEl, gs) {
    this._rebuildRows(station, gs);
    this.popup.style.display = this._twoCol ? 'flex' : 'block';
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
    const rect = anchorEl.getBoundingClientRect();
    this.popup.style.left   = `${rect.left}px`;
    this.popup.style.bottom = `${window.innerHeight - rect.top + 6}px`;
    this.popup.style.top    = 'auto';
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
    ];

    // Build visible rows first so we know the total count
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
      const suffix     = isLimited ? ` [${stock}]` : ' (∞)';

      const row = document.createElement('div');
      row.textContent = (isSelected ? '▶ ' : '   ') + lbl + suffix;
      Object.assign(row.style, {
        padding:    '8px 16px',
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

    const COL_THRESHOLD = 8;
    if (rows.length > COL_THRESHOLD) {
      const mid  = Math.ceil(rows.length / 2);
      const col1 = document.createElement('div');
      const col2 = document.createElement('div');
      Object.assign(col1.style, { display: 'flex', flexDirection: 'column' });
      Object.assign(col2.style, {
        display: 'flex', flexDirection: 'column',
        borderLeft: '1px solid rgba(80,110,255,0.3)',
      });
      rows.slice(0, mid).forEach(r => col1.appendChild(r));
      rows.slice(mid).forEach(r => col2.appendChild(r));
      this.popup.appendChild(col1);
      this.popup.appendChild(col2);
      this._twoCol = true;
    } else {
      rows.forEach(r => this.popup.appendChild(r));
      this._twoCol = false;
    }
  }
}
