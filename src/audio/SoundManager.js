// Copyright © 2026 Chloe Bolland

const SOUND_FILES = {
  uiClick:         'Sounds/sfxclickbleep1.wav',
  uiNav:           'Sounds/sfxclickbleep2.wav',
  cannon:          'Sounds/CannonLaunch.wav',
  blunderbuss:     'Sounds/Blunderbus.wav',
  rocket:          'Sounds/RocketLaunch.wav',
  rocketPod:       'Sounds/FireworksLaunch.wav',
  minigun:         'Sounds/mg1.wav',
  blaster:         'Sounds/pistol1.wav',
  shotgun:         'Sounds/shotgun2.wav',
  laser:           'Sounds/ahmed_abdulaal-laser-312360.mp3',
  laserAlt:        'Sounds/soundreality-attack-laser-128280.mp3',
  laserCharged:    'Sounds/freesound_community-charged-laser-7125.mp3',
  laserBeam:       'Sounds/freesound_community-laser-beam-76426.mp3',
  teleport:        'Sounds/teleport.wav',
  explosionSmall:  'Sounds/Explosion1.wav',
  explosionSmall2: 'Sounds/Explosion2.wav',
  explosionSmall3: 'Sounds/Explosion3.wav',
  explosionMed:    'Sounds/Explosion4.wav',
  explosionMed2:   'Sounds/Explosion5.wav',
  explosionLarge:  'Sounds/ExplosionLarge1.wav',
  explosionLarge2: 'Sounds/ExplosionLarge2.wav',
  glassSmash:      'Sounds/GlassSmash.wav',
  pop:             'Sounds/Pop1.wav',
  pop2:            'Sounds/Pop2.wav',
  fireworkBang:    'Sounds/fireworkBang.wav',
  nova:            'Sounds/NovaEditGain.wav',
  ambientSpace:    'Sounds/SpaceAmbience.mp3',
};

// Pitch variation half-range per sound (applied as ±% of playback rate)
const PITCH_VAR = {
  cannon: 0.06, blunderbuss: 0.08, blaster: 0.08, shotgun: 0.08,
  rocket: 0.05, rocketPod: 0.05, minigun: 0.04,
  laser: 0.03, laserAlt: 0.03, laserCharged: 0.03, laserBeam: 0.03,
  teleport: 0.05,
  explosionSmall: 0.10, explosionSmall2: 0.10, explosionSmall3: 0.10,
  explosionMed: 0.10, explosionMed2: 0.10,
  explosionLarge: 0.10, explosionLarge2: 0.10,
  fireworkBang: 0.08, nova: 0.05, pop: 0.06, pop2: 0.06, glassSmash: 0.08,
};

export const SOUND_VOL_GAIN = { mute: 0, off: 0, low: 0.15, medium: 0.35, high: 0.65 };

let _ctx            = null;
let _masterGain     = null;
let _ambientGain    = null;
let _ambientSource  = null;
let _enabled        = true;
let _masterGainValue = SOUND_VOL_GAIN.low;
let _loaded         = false;
const _buffers      = new Map();

export const SoundManager = {

  init() {
    if (_ctx) {
      if (_ctx.state === 'suspended') _ctx.resume();
      return;
    }
    _ctx = new (window.AudioContext || window.webkitAudioContext)();
    _masterGain = _ctx.createGain();
    _masterGain.gain.value = _enabled ? _masterGainValue : 0;
    _masterGain.connect(_ctx.destination);

    _ambientGain = _ctx.createGain();
    _ambientGain.gain.value = SOUND_VOL_GAIN.medium;
    _ambientGain.connect(_masterGain);
  },

  async preload(onProgress) {
    if (_loaded) { onProgress?.(1); return; }
    if (!_ctx) return;
    const ids = Object.keys(SOUND_FILES);
    let done = 0;
    await Promise.all(ids.map(async id => {
      try {
        const resp = await fetch(SOUND_FILES[id]);
        if (!resp.ok) throw new Error(resp.status);
        const ab  = await resp.arrayBuffer();
        const buf = await _ctx.decodeAudioData(ab);
        _buffers.set(id, buf);
      } catch (_) {
        // silent failure — missing or corrupt audio file
      } finally {
        done++;
        onProgress?.(done / ids.length);
      }
    }));
    _loaded = true;
  },

  play(id, opts = {}) {
    if (!_ctx || !_enabled) return;
    const buf = _buffers.get(id);
    if (!buf) return;

    const src = _ctx.createBufferSource();
    src.buffer = buf;

    const variance = PITCH_VAR[id] ?? 0;
    let rate = 1 + (Math.random() * 2 - 1) * variance;
    if (opts.pitch != null) rate *= (1 + opts.pitch);
    src.playbackRate.value = rate;

    if (opts.volume != null) {
      const vol = _ctx.createGain();
      vol.gain.value = opts.volume;
      src.connect(vol);
      vol.connect(_masterGain);
    } else {
      src.connect(_masterGain);
    }
    src.start();
  },

  playRandom(ids, opts = {}) {
    this.play(ids[Math.floor(Math.random() * ids.length)], opts);
  },

  setMasterVolume(gain) {
    _masterGainValue = gain;
    if (_masterGain) _masterGain.gain.value = _enabled ? gain : 0;
  },

  setAmbientVolume(gain) {
    if (_ambientGain) _ambientGain.gain.value = gain;
  },

  setEnabled(bool) {
    _enabled = bool;
    if (_masterGain) _masterGain.gain.value = bool ? _masterGainValue : 0;
  },

  startAmbient() {
    if (!_ctx) return;
    if (_ambientSource) return;
    const buf = _buffers.get('ambientSpace');
    if (!buf) return;
    const src = _ctx.createBufferSource();
    src.buffer = buf;
    src.loop   = true;
    src.connect(_ambientGain);
    src.start();
    _ambientSource = src;
  },

  stopAmbient() {
    if (_ambientSource) {
      try { _ambientSource.stop(); } catch (_) {}
      _ambientSource = null;
    }
  },
};
