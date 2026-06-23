// Copyright © 2026 Chloe Bolland
// contact chloe@mammoththoughts.com if you wish to use, publish or reproduce this game or any part of it in any way

// Ejecta — a single particle thrown out by an unstable planet eruption
// (Pyro / Cryo / Electro). Beam planets do not spawn ejecta; they fire a laser
// instead. See spec/unstable-planets-spec.md §4.

export const EjectaKind = Object.freeze({
  PYRO:    'pyro',     // ballistic, gravity-affected, destroys stations
  CRYO:    'cryo',     // ballistic, gravity-affected, applies Frozen
  ELECTRO: 'electro',  // straight lightning, ignores gravity, applies Electrified
});

export class Ejecta {
  constructor({ position, velocity, kind, owner, sourcePlanet, launchDelay = 0, maxLifetime = 220 }) {
    this.position     = position;      // Vec2
    this.velocity     = velocity;      // Vec2 (game units per TIMESTEP)
    this.kind         = kind;          // EjectaKind
    this.owner        = owner;         // Station — instigator, credited for kills/conditions
    this.sourcePlanet = sourcePlanet;  // Planet — may never re-trigger its own source
    this.launchDelay  = launchDelay;   // physics steps to wait before launching (eruption stagger)
    this.lifetime     = 0;
    this.maxLifetime  = maxLifetime;
    this.dead         = false;
    this.trail        = [];            // Vec2[] — short trail for rendering
  }
}
