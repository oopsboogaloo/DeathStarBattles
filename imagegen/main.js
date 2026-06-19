// main.js — procedural starfield + nebula renderer.
//
// Pipeline (all seeded, so images are reproducible):
//   1. Nebula  : domain-warped fBm density, multi-colour palette mapping,
//                a separate dust-noise field for dark patches, a low-frequency
//                composition envelope, and a tone curve. Drawn per-pixel.
//   2. Stars   : seeded scatter with a power-law brightness distribution,
//                blackbody colours, glow + diffraction spikes on bright stars,
//                and attenuation inside thick dust so dark lanes read as nearer.

const { hashSeed, ValueNoise, smoothstep, lerp } = window.ImageGenNoise;

const canvas = document.getElementById('scene');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const W = canvas.width;
const H = canvas.height;

// ---------------------------------------------------------------------------
// Palettes: [c1..c4] emission colours mixed by the warp fields, plus a faint
// background tint. Colours are [r, g, b] 0-255.
// ---------------------------------------------------------------------------
const PALETTES = [
  {
    name: 'Hubble (Hα / OIII)',
    bg: [3, 4, 9],
    colors: [[18, 26, 80], [196, 44, 92], [38, 178, 170], [232, 184, 120]],
  },
  {
    name: 'Crimson Veil',
    bg: [8, 3, 5],
    colors: [[60, 10, 30], [180, 30, 44], [232, 120, 60], [255, 224, 150]],
  },
  {
    name: 'Emerald Drift',
    bg: [3, 8, 7],
    colors: [[10, 40, 42], [28, 140, 120], [120, 202, 150], [206, 255, 214]],
  },
  {
    name: 'Royal Nebula',
    bg: [6, 5, 12],
    colors: [[16, 16, 62], [62, 40, 160], [150, 80, 222], [232, 202, 255]],
  },
  {
    name: 'Ember & Ice',
    bg: [4, 5, 10],
    colors: [[14, 30, 86], [40, 120, 210], [220, 90, 60], [255, 210, 140]],
  },
];

// ---------------------------------------------------------------------------
// Controls
// ---------------------------------------------------------------------------
const el = {
  seed: document.getElementById('seed'),
  reroll: document.getElementById('reroll'),
  palette: document.getElementById('palette'),
  octaves: document.getElementById('octaves'),
  octavesVal: document.getElementById('octavesVal'),
  warp: document.getElementById('warp'),
  warpVal: document.getElementById('warpVal'),
  dust: document.getElementById('dust'),
  dustVal: document.getElementById('dustVal'),
  stars: document.getElementById('stars'),
  starsVal: document.getElementById('starsVal'),
  render: document.getElementById('render'),
  save: document.getElementById('save'),
  status: document.getElementById('status'),
};

PALETTES.forEach((p, i) => {
  const opt = document.createElement('option');
  opt.value = String(i);
  opt.textContent = p.name;
  el.palette.appendChild(opt);
});

// Defaults
el.seed.value = String((Math.random() * 1e9) | 0);
el.octaves.value = '6';
el.warp.value = '4';
el.dust.value = '0.5';
el.stars.value = '900';

function syncLabels() {
  el.octavesVal.textContent = el.octaves.value;
  el.warpVal.textContent = Number(el.warp.value).toFixed(1);
  el.dustVal.textContent = Number(el.dust.value).toFixed(2);
  el.starsVal.textContent = el.stars.value;
}
syncLabels();

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------
function mix(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}
function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

// Blackbody-ish star tint: t=0 hot blue-white .. t=1 cool red.
const STAR_STOPS = [
  [155, 176, 255],
  [202, 215, 255],
  [255, 255, 255],
  [255, 244, 214],
  [255, 210, 161],
  [255, 178, 140],
];
function starColor(t) {
  const x = clamp01(t) * (STAR_STOPS.length - 1);
  const i = Math.min(STAR_STOPS.length - 2, Math.floor(x));
  return mix(STAR_STOPS[i], STAR_STOPS[i + 1], x - i);
}

// ---------------------------------------------------------------------------
// Render state
// ---------------------------------------------------------------------------
let rendering = false;

function render() {
  if (rendering) return;
  rendering = true;
  el.render.disabled = true;

  const seed = hashSeed(el.seed.value || '0');
  const octaves = parseInt(el.octaves.value, 10);
  const warp = parseFloat(el.warp.value);
  const dustAmount = parseFloat(el.dust.value);
  const starCount = parseInt(el.stars.value, 10);
  const palette = PALETTES[parseInt(el.palette.value, 10)];

  // Decorrelated noise fields for warp, dust and composition.
  const nMain = new ValueNoise(seed);
  const nDust = new ValueNoise((seed ^ 0x9e3779b9) >>> 0);
  const nComp = new ValueNoise((seed ^ 0x85ebca6b) >>> 0);

  const img = ctx.createImageData(W, H);
  const data = img.data;

  // Feature scale: a handful of large structures across the frame.
  const F = 3.0;
  const aspect = W / H;
  const bg = palette.bg;
  const [c1, c2, c3, c4] = palette.colors;

  // Random offsets so each seed frames the nebula differently.
  const ox = (nComp.value2(seed & 255, 11) - 0.5) * 20;
  const oy = (nComp.value2(7, seed & 255) - 0.5) * 20;

  // Nebula sample at normalized canvas pixel -> {r,g,b, dust occlusion}.
  function sampleNebula(px, py) {
    const x = (px / W) * F * aspect + ox;
    const y = (py / H) * F + oy;

    // Domain warp (Inigo Quilez style): noise into noise into noise.
    const qx = nMain.fbm(x, y, octaves);
    const qy = nMain.fbm(x + 5.2, y + 1.3, octaves);

    const rx = nMain.fbm(x + warp * qx + 1.7, y + warp * qy + 9.2, octaves);
    const ry = nMain.fbm(x + warp * qx + 8.3, y + warp * qy + 2.8, octaves);

    const f = nMain.fbm(x + warp * rx, y + warp * ry, octaves);

    // Colour mix driven by the intermediate fields.
    const qLen = clamp01(Math.hypot(qx - 0.5, qy - 0.5) * 1.8);
    const rLen = clamp01(Math.hypot(rx - 0.5, ry - 0.5) * 1.8);
    let col = mix(c1, c2, smoothstep(clamp01(f * 1.3)));
    col = mix(col, c3, qLen);
    col = mix(col, c4, rLen * 0.8);

    // Tone curve: bright cores, falling to black.
    let intensity = Math.pow(clamp01(f * 1.5 - 0.25), 1.7);

    // Composition envelope: keep the nebula concentrated, not a flat haze.
    const env = smoothstep(
      clamp01((nComp.fbm(x * 0.45 + 3.1, y * 0.45 + 6.7, 4) - 0.34) * 2.4)
    );
    intensity *= env;

    // Dust / dark patches: a separate field carves voids and lanes.
    const d = nDust.fbm(x * 1.35 + 21.0, y * 1.35 + 4.0, octaves);
    const occl = smoothstep(clamp01((d - (0.62 - dustAmount * 0.32)) * 4.0));
    intensity *= 1 - occl * (0.7 + dustAmount * 0.3);

    return {
      r: bg[0] + col[0] * intensity,
      g: bg[1] + col[1] * intensity,
      b: bg[2] + col[2] * intensity,
    };
  }

  // Sample dust occlusion alone (for attenuating stars behind dust).
  function dustOcclusion(px, py) {
    const x = (px / W) * F * aspect + ox;
    const y = (py / H) * F + oy;
    const d = nDust.fbm(x * 1.35 + 21.0, y * 1.35 + 4.0, octaves);
    return smoothstep(clamp01((d - (0.62 - dustAmount * 0.32)) * 4.0));
  }

  // ---- Chunked nebula pass (keeps the UI responsive + shows progress) ----
  const BAND = 18;
  let row = 0;

  function step() {
    const end = Math.min(H, row + BAND);
    for (let y = row; y < end; y++) {
      for (let x = 0; x < W; x++) {
        const s = sampleNebula(x, y);
        const i = (y * W + x) * 4;
        data[i] = s.r > 255 ? 255 : s.r;
        data[i + 1] = s.g > 255 ? 255 : s.g;
        data[i + 2] = s.b > 255 ? 255 : s.b;
        data[i + 3] = 255;
      }
    }
    row = end;
    el.status.textContent = `Rendering nebula… ${Math.round((row / H) * 100)}%`;

    if (row < H) {
      requestAnimationFrame(step);
    } else {
      ctx.putImageData(img, 0, 0);
      drawStars(seed, starCount, dustOcclusion);
      el.status.textContent = `Done — seed ${el.seed.value}`;
      rendering = false;
      el.render.disabled = false;
    }
  }
  requestAnimationFrame(step);
}

// ---------------------------------------------------------------------------
// Starfield (drawn additively over the nebula)
// ---------------------------------------------------------------------------
function drawStars(seed, count, dustOcclusion) {
  const rand = window.ImageGenNoise.mulberry32((seed ^ 0x1b873593) >>> 0);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  for (let i = 0; i < count; i++) {
    const x = rand() * W;
    const y = rand() * H;

    // Power-law brightness: most stars faint, a few brilliant.
    const u = rand();
    const mag = Math.pow(u, 4);
    const col = starColor(rand());

    // Dust in front dims/hides stars.
    const occl = dustOcclusion(x, y);
    let alpha = (0.25 + mag * 0.75) * (1 - occl * 0.85);
    if (alpha <= 0.02) continue;

    const c = `rgb(${col[0] | 0}, ${col[1] | 0}, ${col[2] | 0})`;

    if (mag > 0.7) {
      // Bright star: glow halo + diffraction spikes.
      const radius = 2 + mag * 5;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
      grad.addColorStop(0, `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${alpha})`);
      grad.addColorStop(0.4, `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${alpha * 0.35})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();

      const spike = radius * (1.6 + mag);
      ctx.strokeStyle = `rgba(${col[0] | 0},${col[1] | 0},${col[2] | 0},${alpha * 0.5})`;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(x - spike, y); ctx.lineTo(x + spike, y);
      ctx.moveTo(x, y - spike); ctx.lineTo(x, y + spike);
      ctx.stroke();

      ctx.fillStyle = c;
      ctx.globalAlpha = Math.min(1, alpha + 0.2);
      ctx.beginPath();
      ctx.arc(x, y, 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      // Faint star: a single soft point.
      ctx.fillStyle = c;
      ctx.globalAlpha = alpha;
      ctx.fillRect(x, y, mag > 0.45 ? 1.4 : 1, mag > 0.45 ? 1.4 : 1);
      ctx.globalAlpha = 1;
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------
[el.octaves, el.warp, el.dust, el.stars].forEach((c) =>
  c.addEventListener('input', syncLabels)
);
el.render.addEventListener('click', render);
el.reroll.addEventListener('click', () => {
  el.seed.value = String((Math.random() * 1e9) | 0);
  render();
});
el.save.addEventListener('click', () => {
  const a = document.createElement('a');
  a.download = `nebula-${el.seed.value}.png`;
  a.href = canvas.toDataURL('image/png');
  a.click();
});

// First render.
render();
