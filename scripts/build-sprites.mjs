#!/usr/bin/env node
// build-sprites.mjs — converts assets/sprites/*.svg into src/rendering/sprites/*.sprite.js
//
// Run after artwork changes:  node scripts/build-sprites.mjs
// Generated modules are committed to the repo; nothing is parsed at game runtime.
//
// Supported authoring subset (see spec/space-mammoth-sprite-spec.md §3–4):
//   - <path>, <circle>, <ellipse> elements with an id become layers
//   - <g id="..."> of circles/ellipses/paths becomes a single combined layer
//     (Inkscape "layer" groups work — the group's fill is inherited from its
//      first child shape when the group itself carries none)
//   - fill is read from a fill="" attribute or a style="fill:..." declaration
//   - fill #ff0000 → "team.primary", #0000ff → "team.secondary"
//   - shade-ramp sentinels (dark→light): #400000→shade1, #800000→shade2,
//                                         #cc0000→shade3, #ff6666→shade4
//   - data-keyframes  (JSON on the element)  → transform keyframes
//   - data-min-radius (px)                   → layer skipped below this screen radius
//   - data-duration   (ms, on <svg>)         → animation loop duration
//   - <g id="<layer>-kfN" data-t="0.3"> groups → morph keyframes for <layer>
//   - element with id "<anything>-clip" + data-clip-layers="a b c" → sprite clip path
//
// Document order = paint order. Nested groups are not supported.

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { basename, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT    = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = join(ROOT, 'assets', 'sprites');
const OUT_DIR = join(ROOT, 'src', 'rendering', 'sprites');

const PRIMARY_FILLS   = new Set(['#ff0000', '#f00', 'red']);
const SECONDARY_FILLS = new Set(['#0000ff', '#00f', 'blue']);

// Team shade ramp: sentinel fills the artist paints from darkest to lightest.
// Each resolves at render time to a tone of the team colour (see §6), letting a
// single artwork carry an interesting range of team-coloured tones.
const SHADE_FILLS = new Map([
  ['#400000', 'team.shade1'],   // darkest
  ['#800000', 'team.shade2'],
  ['#cc0000', 'team.shade3'],   // base
  ['#ff6666', 'team.shade4'],   // lightest
]);

// ---------------------------------------------------------------- helpers

function attr(tag, name) {
  const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`));
  return m ? (m[2] ?? m[3]) : undefined;
}

function num(tag, name, fallback = 0) {
  const v = attr(tag, name);
  return v === undefined ? fallback : parseFloat(v);
}

// Read a CSS property out of a style="...;prop:value;..." attribute
function styleProp(tag, prop) {
  const style = attr(tag, 'style');
  if (style === undefined) return undefined;
  const m = style.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i'));
  return m ? m[1].trim() : undefined;
}

// Effective fill of an element: explicit fill attribute, else style fill.
// Inkscape writes fills into the style attribute, so both must be checked.
function elementFill(tag) {
  return attr(tag, 'fill') ?? styleProp(tag, 'fill');
}

function resolveFill(fill) {
  if (fill === undefined) return '#000000';
  const f = fill.trim().toLowerCase();
  if (PRIMARY_FILLS.has(f))   return 'team.primary';
  if (SECONDARY_FILLS.has(f)) return 'team.secondary';
  if (SHADE_FILLS.has(f))     return SHADE_FILLS.get(f);
  return fill;
}

// Synthesise a path `d` for circles/ellipses (two-arc form)
function ellipseToPath(cx, cy, rx, ry) {
  return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`;
}

function shapeToPath(name, tag) {
  if (name === 'path')    return attr(tag, 'd');
  if (name === 'circle')  return ellipseToPath(num(tag, 'cx'), num(tag, 'cy'), num(tag, 'r'), num(tag, 'r'));
  if (name === 'ellipse') return ellipseToPath(num(tag, 'cx'), num(tag, 'cy'), num(tag, 'rx'), num(tag, 'ry'));
  return undefined;
}

// Natural pivot for rotation/scale keyframes (shape centre where known)
function shapePivot(name, tag) {
  if (name === 'circle' || name === 'ellipse') return [num(tag, 'cx'), num(tag, 'cy')];
  return undefined;
}

// Parse an absolute-command path `d` into the morph command array format.
// Morph keyframes only support absolute M, L, C, Z (spec §3.4: convert to cubics).
function parsePathCommands(d, context) {
  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  const commands = [];
  let i = 0;
  const next = () => parseFloat(tokens[i++]);
  while (i < tokens.length) {
    const cmd = tokens[i++];
    switch (cmd) {
      case 'M': commands.push({ cmd: 'M', x: next(), y: next() }); break;
      case 'L': commands.push({ cmd: 'L', x: next(), y: next() }); break;
      case 'C': commands.push({ cmd: 'C', x1: next(), y1: next(), x2: next(), y2: next(), x: next(), y: next() }); break;
      case 'Z': case 'z': commands.push({ cmd: 'Z' }); break;
      default:
        throw new Error(`${context}: unsupported path command "${cmd}" in morph keyframe — convert to absolute M/L/C/Z before export`);
    }
  }
  return commands;
}

// ---------------------------------------------------------------- per-file build

function buildSprite(svgPath) {
  const svg  = readFileSync(svgPath, 'utf8');
  const name = basename(svgPath, '.svg');

  const svgTag  = svg.match(/<svg\b[^>]*>/)?.[0] ?? '';
  const viewBox = (attr(svgTag, 'viewBox') ?? '0 0 100 100').trim().split(/[\s,]+/).map(Number);
  const duration = num(svgTag, 'data-duration', 2400);

  const sprite = { name, duration, viewBox, layers: [] };
  const morphGroups = new Map(); // layerId → [{n, t, d}]

  // Scan top-level elements in document order
  const ELEM_RE = /<g\b([^>]*)>([\s\S]*?)<\/g>|<(path|circle|ellipse)\b([^>]*?)\/>/g;
  let m;
  while ((m = ELEM_RE.exec(svg)) !== null) {
    const isGroup = m[1] !== undefined;
    const tag     = isGroup ? m[1] : m[4];
    const id      = attr(tag, 'id');
    if (!id) continue;

    // Morph keyframe group: <g id="trunk-kf1" data-t="0.3">
    const kf = id.match(/^(.+)-kf(\d+)$/);
    if (isGroup && kf) {
      const inner = m[2].match(/<path\b[^>]*\/>/)?.[0];
      if (!inner) throw new Error(`${name}.svg: keyframe group "${id}" contains no <path>`);
      if (!morphGroups.has(kf[1])) morphGroups.set(kf[1], []);
      morphGroups.get(kf[1]).push({ n: parseInt(kf[2], 10), t: attr(tag, 'data-t'), d: attr(inner, 'd') });
      continue;
    }

    // Clip path: <path id="dome-clip" data-clip-layers="mammoth-body ...">
    if (id.endsWith('-clip')) {
      sprite.clipPath      = shapeToPath(isGroup ? 'g' : m[3], tag) ?? attr(tag, 'd');
      sprite.clippedLayers = (attr(tag, 'data-clip-layers') ?? '').trim().split(/\s+/).filter(Boolean);
      continue;
    }

    let path, pivot, childFill;
    if (isGroup) {
      // Combine all child shapes into one path; remember the first child's fill
      // so an Inkscape layer group (no fill of its own) still gets a colour.
      const parts = [];
      const SHAPE_RE = /<(path|circle|ellipse)\b([^>]*?)\/>/g;
      let c;
      while ((c = SHAPE_RE.exec(m[2])) !== null) {
        parts.push(shapeToPath(c[1], c[2]));
        if (childFill === undefined) childFill = elementFill(c[2]);
      }
      path = parts.join(' ');
    } else {
      path  = shapeToPath(m[3], tag);
      pivot = shapePivot(m[3], tag);
    }

    const layer = { id, path, fill: resolveFill(elementFill(tag) ?? childFill) };
    if (pivot) layer.pivot = pivot;

    const minRadius = attr(tag, 'data-min-radius');
    if (minRadius !== undefined) layer.minRadius = parseFloat(minRadius);

    const keyframes = attr(tag, 'data-keyframes');
    if (keyframes !== undefined) layer.keyframes = JSON.parse(keyframes.replace(/&quot;/g, '"'));

    sprite.layers.push(layer);
  }

  // Attach morph keyframes (base layer's own path is keyframe 0 unless a -kf0 group exists)
  for (const [layerId, frames] of morphGroups) {
    const layer = sprite.layers.find(l => l.id === layerId);
    if (!layer) throw new Error(`${name}.svg: morph keyframes for unknown layer "${layerId}"`);
    if (layer.keyframes) throw new Error(`${name}.svg: layer "${layerId}" has both transform and morph keyframes`);
    if (!frames.some(f => f.n === 0)) frames.push({ n: 0, t: '0', d: layer.path });
    frames.sort((a, b) => a.n - b.n);
    const maxN = frames[frames.length - 1].n;
    layer.morphKeyframes = frames.map(f => ({
      t: f.t !== undefined ? parseFloat(f.t) : (maxN === 0 ? 0 : f.n / maxN),
      commands: parsePathCommands(f.d, `${name}.svg layer "${layerId}" kf${f.n}`),
    }));
    // Validate: same command count and types across all keyframes
    const ref = layer.morphKeyframes[0].commands;
    for (const fr of layer.morphKeyframes) {
      if (fr.commands.length !== ref.length ||
          fr.commands.some((c, i) => c.cmd !== ref[i].cmd)) {
        throw new Error(`${name}.svg: layer "${layerId}" morph keyframes have mismatched command lists`);
      }
    }
    delete layer.path; // morph layers are drawn via direct canvas commands
  }

  return sprite;
}

// ---------------------------------------------------------------- emit

function camelCase(name) {
  return name.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
}

mkdirSync(OUT_DIR, { recursive: true });
const files = readdirSync(SRC_DIR).filter(f => f.endsWith('.svg'));
if (files.length === 0) {
  console.error(`No .svg files found in ${SRC_DIR}`);
  process.exit(1);
}

for (const file of files) {
  const name   = basename(file, '.svg');
  const sprite = buildSprite(join(SRC_DIR, file));
  const out    = join(OUT_DIR, `${name}.sprite.js`);
  writeFileSync(out,
    `// ${name}.sprite.js — GENERATED by scripts/build-sprites.mjs from assets/sprites/${file}\n` +
    `// Do not edit by hand. Re-run:  node scripts/build-sprites.mjs\n` +
    `export const ${camelCase(name)}Sprite = ${JSON.stringify(sprite, null, 2)};\n`);
  console.log(`${file} → src/rendering/sprites/${name}.sprite.js  (${sprite.layers.length} layers)`);
}
