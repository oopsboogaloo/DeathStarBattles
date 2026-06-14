// Copyright © 2026 Chloe Bolland
// contact chloe@mammoththoughts.com if you wish to use, publish or reproduce this game or any part of it in any way

// Mulberry32 — fast, seedable 32-bit PRNG.
export class RNG {
  constructor(seed) {
    this._state = (seed >>> 0) || 1;
  }

  next() {
    let t = (this._state += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  nextInt(n)              { return Math.floor(this.next() * n); }
  nextInRange(min, max)   { return min + this.next() * (max - min); }

  // Roll n values, return array
  roll(n) { return Array.from({ length: n }, () => this.next()); }

  static randomSeed() { return (Math.random() * 0xFFFFFFFF) >>> 0; }
}
