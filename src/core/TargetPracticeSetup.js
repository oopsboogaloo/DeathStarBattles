import { Vec2 }           from './Vec2.js';
import { PracticeTarget } from '../entities/PracticeTarget.js';
import { MegaBot }        from '../ai/MegaBot.js';

export class TargetPracticeSetup {
  // Place all stations along one edge of the map.
  // Modifies station.position in-place. Returns the edge ('left'|'right'|'top'|'bottom').
  static placeStations(teams, planets, gw, gh, rng) {
    const stations = teams.flatMap(t => t.stations);
    const landscape = gw >= gh;
    const side = rng.next() < 0.5
      ? (landscape ? 'left'   : 'top')
      : (landscape ? 'right'  : 'bottom');

    const n   = stations.length;
    const pad = Math.max(stations[0]?.radius ?? 10, 12) * 3;

    if (landscape) {
      // Vertical line: fixed x, varying y
      const baseX = side === 'left' ? (stations[0]?.radius ?? 10) * 2.5 : gw - (stations[0]?.radius ?? 10) * 2.5;
      const yMin  = pad;
      const yMax  = gh - pad;
      const step  = n > 1 ? (yMax - yMin) / (n - 1) : 0;

      for (let i = 0; i < n; i++) {
        const y = n === 1 ? gh / 2 : yMin + i * step;
        let   x = baseX;
        // Nudge away from edge until clear of planets
        const dir = side === 'left' ? 1 : -1;
        for (let attempt = 0; attempt < 200; attempt++) {
          const r = stations[i].radius;
          const inside = planets.some(p => !p.destroyed &&
            Math.hypot(x - p.position.x, y - p.position.y) < p.impactRadius + r + 2);
          if (!inside) break;
          x += dir;
        }
        stations[i].position = new Vec2(Math.max(stations[i].radius, Math.min(gw - stations[i].radius, x)), y);
      }
    } else {
      // Horizontal line: fixed y, varying x
      const baseY = side === 'top' ? (stations[0]?.radius ?? 10) * 2.5 : gh - (stations[0]?.radius ?? 10) * 2.5;
      const xMin  = pad;
      const xMax  = gw - pad;
      const step  = n > 1 ? (xMax - xMin) / (n - 1) : 0;

      for (let i = 0; i < n; i++) {
        const x = n === 1 ? gw / 2 : xMin + i * step;
        let   y = baseY;
        const dir = side === 'top' ? 1 : -1;
        for (let attempt = 0; attempt < 200; attempt++) {
          const r = stations[i].radius;
          const inside = planets.some(p => !p.destroyed &&
            Math.hypot(x - p.position.x, y - p.position.y) < p.impactRadius + r + 2);
          if (!inside) break;
          y += dir;
        }
        stations[i].position = new Vec2(x, Math.max(stations[i].radius, Math.min(gh - stations[i].radius, y)));
      }
    }

    return side;
  }

  // Attempt to place 2N practice targets in unoccupied map positions.
  // Returns PracticeTarget[] on success, null if placement fails.
  static placeTargets(N, radius, planets, gw, gh, side, rng) {
    const count    = N * 2;
    const cellSize = radius * 5;
    const margin   = radius * 1.5;

    // Determine the exclusion strip: 28% of the map nearest to the station edge
    const exclusion = 0.28;
    let xMin = margin, xMax = gw - margin;
    let yMin = margin, yMax = gh - margin;

    if (side === 'left')   xMin = Math.max(margin, gw * exclusion);
    if (side === 'right')  xMax = Math.min(gw - margin, gw * (1 - exclusion));
    if (side === 'top')    yMin = Math.max(margin, gh * exclusion);
    if (side === 'bottom') yMax = Math.min(gh - margin, gh * (1 - exclusion));

    // Build a grid of candidate cell centres
    const cols  = Math.floor((xMax - xMin) / cellSize);
    const rows  = Math.floor((yMax - yMin) / cellSize);
    if (cols < 1 || rows < 1) return null;

    const cells = [];
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const cx = xMin + (c + 0.5) * cellSize;
        const cy = yMin + (r + 0.5) * cellSize;
        cells.push({ cx, cy });
      }
    }

    // Fisher-Yates shuffle
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }

    const placed = [];
    let   nextId = 0;

    for (const { cx, cy } of cells) {
      if (placed.length >= count) break;

      // Reject if overlaps a planet
      const hitsPlanet = planets.some(p => !p.destroyed &&
        Math.hypot(cx - p.position.x, cy - p.position.y) < p.impactRadius + radius * 0.5);
      if (hitsPlanet) continue;

      // Reject if too close to an already-placed target
      const tooClose = placed.some(t =>
        Math.hypot(cx - t.position.x, cy - t.position.y) < radius * 3);
      if (tooClose) continue;

      placed.push(new PracticeTarget({ id: nextId++, position: new Vec2(cx, cy), radius }));
    }

    return placed.length >= count ? placed : null;
  }

  // Run feasibility simulation.
  // Returns the N best targets from candidates (those reachable by the most stations).
  static runFeasibility(stations, candidates, planets, physics) {
    const megabot   = new MegaBot(physics);
    const mockGS    = { planets, turn: 20 }; // turn 20 → max trial count in _numTrials
    const pairs     = [];

    for (let si = 0; si < stations.length; si++) {
      for (let ti = 0; ti < candidates.length; ti++) {
        pairs.push({ si, ti });
      }
    }

    const tracesPerPair = Math.max(1, Math.floor(200 / pairs.length));
    const hitCount = new Array(candidates.length).fill(0);

    for (const { si, ti } of pairs) {
      const { closestDist } = megabot._findBestShot(
        stations[si], candidates[ti], mockGS, tracesPerPair,
      );
      if (closestDist <= candidates[ti].radius) hitCount[ti]++;
    }

    // Sort candidates: most-stations-hit first, break ties randomly
    const sorted = candidates
      .map((t, i) => ({ t, hits: hitCount[i] }))
      .sort((a, b) => b.hits - a.hits || Math.random() - 0.5);

    return sorted.map(x => x.t);
  }
}
