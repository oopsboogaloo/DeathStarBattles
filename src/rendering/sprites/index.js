// Sprite registry — maps sprite names to generated sprite modules.
// To add a new sprite: drop the .svg in assets/sprites/, run
// `node scripts/build-sprites.mjs`, import the module and register it here.

import { initSprite } from './SpriteRenderer.js';
import { ufoSprite } from './ufo.sprite.js';

const REGISTRY = new Map([
  ['ufo', ufoSprite],
]);

export function getSprite(name) {
  const sprite = REGISTRY.get(name);
  if (sprite && !sprite._initialised) initSprite(sprite);
  return sprite;
}

export { drawSprite } from './SpriteRenderer.js';
