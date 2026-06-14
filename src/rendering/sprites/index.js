// Copyright © 2026 Chloe Bolland
// contact chloe@mammoththoughts.com if you wish to use, publish or reproduce this game or any part of it in any way

// Sprite registry — maps sprite names to generated sprite modules.
// To add a new sprite: drop the .svg in assets/sprites/, run
// `node scripts/build-sprites.mjs`, import the module and register it here.

import { initSprite } from './SpriteRenderer.js';
import { ufoSprite } from './ufo.sprite.js';
import { saucer1Sprite } from './saucer1.sprite.js';
import { saucer2Sprite } from './saucer2.sprite.js';
import { mine1Sprite } from './mine1.sprite.js';
import { minespikeSprite } from './minespike.sprite.js';

const REGISTRY = new Map([
  ['ufo', ufoSprite],
  ['saucer1', saucer1Sprite],
  ['saucer2', saucer2Sprite],
  ['mine1', mine1Sprite],
  ['minespike', minespikeSprite],
]);

export function getSprite(name) {
  const sprite = REGISTRY.get(name);
  if (sprite && !sprite._initialised) initSprite(sprite);
  return sprite;
}

export { drawSprite } from './SpriteRenderer.js';
