// Scenario IDs (from scenarioData.js)
// 3=Crystal Asteroids, 4=Star System, 5=Binary Star, 8=Super Giant Binary,
// 10=Red Giant, 11=Star Cluster, 12=Gas Giants, 17=Asteroid Belt,
// 19=Wormhole, 22=Black Hole

export const STORY_MISSIONS = [

  // ── Phase 1: Basic Training (M1–M4) ────────────────────────────────────────

  {
    id:    'm1-training',
    title: 'Basic Training',
    story: 'You are a new recruit. Welcome to the Academy. Pass basic target practice and we\'ll talk about putting you in a real cockpit.',

    layout: {
      planets: [
        { type: 'crystal', x: 0.50, y: 0.40, radius: 14, density: 0.05 },
        { type: 'crystal', x: 0.48, y: 0.55, radius: 12, density: 0.05 },
        { type: 'crystal', x: 0.53, y: 0.62, radius: 10, density: 0.05 },
      ],
      stations: [
        { x: 0.20, y: 0.50, team: 0, role: 'human',  visualStyle: 'station' },
        { x: 0.78, y: 0.22, team: 1, role: 'target',  visualStyle: 'station', aiLevel: 1 },
        { x: 0.82, y: 0.50, team: 1, role: 'target',  visualStyle: 'station', aiLevel: 1 },
        { x: 0.78, y: 0.78, team: 1, role: 'target',  visualStyle: 'station', aiLevel: 1 },
      ],
    },

    settings: {
      stationSize:          'large',
      gameSpeed:            'normal',
      movementSpeed:        'off',
      collectablesSpawn:    'off',
      collectableWeapon:    null,
      cannonEnabled:        true,
      startingWeapons:      {},
      enemyStartingWeapons: {},
    },

    objectives:     [{ type: 'destroy_all' }],
    failConditions: [],

    scoring: { formula: 'target_practice', passingScore: 500 },
  },

  {
    id:    'm2-wing',
    title: 'Wing Formation',
    story: 'Good shooting, recruit. But out there you won\'t be alone. Learn to coordinate with your wingman — two ships, one objective.',

    layout: {
      planets: [
        { type: 'asteroid', x: 0.35, y: 0.35, radius: 14, density: 0.08 },
        { type: 'asteroid', x: 0.50, y: 0.60, radius: 12, density: 0.08 },
        { type: 'asteroid', x: 0.65, y: 0.35, radius: 10, density: 0.08 },
      ],
      stations: [
        { x: 0.18, y: 0.35, team: 0, role: 'human',  visualStyle: 'station' },
        { x: 0.18, y: 0.65, team: 0, role: 'human',  visualStyle: 'station' },
        { x: 0.72, y: 0.18, team: 1, role: 'target',  visualStyle: 'station', aiLevel: 1 },
        { x: 0.82, y: 0.32, team: 1, role: 'target',  visualStyle: 'station', aiLevel: 1 },
        { x: 0.85, y: 0.50, team: 1, role: 'target',  visualStyle: 'station', aiLevel: 1 },
        { x: 0.82, y: 0.68, team: 1, role: 'target',  visualStyle: 'station', aiLevel: 1 },
        { x: 0.72, y: 0.82, team: 1, role: 'target',  visualStyle: 'station', aiLevel: 1 },
      ],
    },

    settings: {
      stationSize:          'large',
      gameSpeed:            'normal',
      movementSpeed:        'off',
      collectablesSpawn:    'off',
      collectableWeapon:    null,
      cannonEnabled:        true,
      startingWeapons:      {},
      enemyStartingWeapons: {},
    },

    objectives:     [{ type: 'destroy_all' }],
    failConditions: [],

    scoring: { formula: 'target_practice', passingScore: 800 },
  },

  {
    id:    'm3-dead-zone',
    title: 'Dead Zone',
    story: 'Position is everything in combat. Your current position is a death sentence — the star\'s gravity will drag every shot you fire right back down. Figure it out, recruit.',

    layout: {
      planets: [
        // Supergiant star just off the bottom edge — gravitationally dominates lower half
        { type: 'star', x: 0.50, y: 1.08, radius: 80, density: 0.0625 },
      ],
      stations: [
        { x: 0.50, y: 0.82, team: 0, role: 'human',  visualStyle: 'station' },
        { x: 0.50, y: 0.10, team: 1, role: 'target',  visualStyle: 'station', aiLevel: 1 },
      ],
    },

    settings: {
      stationSize:          'large',
      gameSpeed:            'normal',
      movementSpeed:        'off',
      collectablesSpawn:    'off',
      collectableWeapon:    null,
      cannonEnabled:        true,
      startingWeapons:      {},
      enemyStartingWeapons: {},
    },

    objectives:     [{ type: 'destroy_all' }],
    failConditions: [{ type: 'max_turns', turns: 15 }],

    scoring: { formula: 'turns_remaining', passingScore: 200 },
  },

  {
    id:    'm4-collection',
    title: 'Field Collection',
    story: 'Special equipment doesn\'t get handed out for free — you earn it in the field. Those collectables out there? Each one gives you a Blaster charge. Get five of them. Go.',

    layout: {
      planets: [
        { type: 'asteroid', x: 0.40, y: 0.30, radius: 14, density: 0.08 },
        { type: 'asteroid', x: 0.55, y: 0.35, radius: 12, density: 0.08 },
        { type: 'asteroid', x: 0.75, y: 0.40, radius: 10, density: 0.08 },
        { type: 'asteroid', x: 0.50, y: 0.60, radius: 14, density: 0.08 },
        { type: 'asteroid', x: 0.70, y: 0.65, radius: 12, density: 0.08 },
        { type: 'asteroid', x: 0.85, y: 0.55, radius: 10, density: 0.08 },
      ],
      stations: [
        { x: 0.15, y: 0.50, team: 0, role: 'human', visualStyle: 'station' },
      ],
      collectables: [
        { x: 0.35, y: 0.20 }, { x: 0.50, y: 0.15 }, { x: 0.65, y: 0.25 },
        { x: 0.80, y: 0.20 }, { x: 0.45, y: 0.45 }, { x: 0.70, y: 0.50 },
        { x: 0.90, y: 0.45 }, { x: 0.40, y: 0.75 }, { x: 0.60, y: 0.80 },
        { x: 0.85, y: 0.75 },
      ],
    },

    settings: {
      stationSize:          'large',
      gameSpeed:            'normal',
      movementSpeed:        'off',
      collectablesSpawn:    'fixed',
      collectableWeapon:    'blaster',
      cannonEnabled:        true,
      startingWeapons:      {},
      enemyStartingWeapons: {},
    },

    objectives:     [{ type: 'collect_n', params: { count: 5 } }],
    failConditions: [{ type: 'max_turns', turns: 15 }],

    scoring: { formula: 'collectables_score', passingScore: 600 },
  },

  // ── Phase 2: Live Fire (M5–M11) ────────────────────────────────────────────

  {
    id:    'm5-contact',
    title: 'Contact',
    story: 'Target practice is over, recruit. Those {enemy1}s shoot back now. One of them, one of you. Show us you can hold your own against a live opponent.',

    layout: {
      scenarioId: 5,
      stations: [
        { x: 0.18, y: 0.50, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.82, y: 0.50, team: 1, role: 'ai',    visualStyle: 'drone',   aiLevel: 2 },
      ],
    },

    settings: {
      stationSize:          'large',
      gameSpeed:            'normal',
      movementSpeed:        'slow',
      collectablesSpawn:    'off',
      collectableWeapon:    null,
      cannonEnabled:        true,
      startingWeapons:      {},
      enemyStartingWeapons: {},
    },

    objectives:     [{ type: 'destroy_all' }],
    failConditions: [],

    scoring: { formula: 'combat_efficiency', passingScore: 200 },
  },

  {
    id:    'm6-solo-combat',
    title: 'Solo Combat',
    story: 'One on one. Gas giant territory. Those {enemy1}s picked this turf — they like the gravity curves. Outthink them.',

    layout: {
      scenarioId: 12,
      stations: [
        { x: 0.15, y: 0.50, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.85, y: 0.50, team: 1, role: 'ai',    visualStyle: 'drone',   aiLevel: 2 },
      ],
    },

    settings: {
      stationSize:          'large',
      gameSpeed:            'normal',
      movementSpeed:        'slow',
      collectablesSpawn:    'off',
      collectableWeapon:    null,
      cannonEnabled:        true,
      startingWeapons:      {},
      enemyStartingWeapons: {},
    },

    objectives:     [{ type: 'destroy_all' }],
    failConditions: [],

    scoring: { formula: 'combat_efficiency', passingScore: 200 },
  },

  {
    id:    'm7-two-vs-two',
    title: 'Two vs Two',
    story: 'Two of you, two of theirs. Gas Giants again — same field, different problem. Watch your wingman and pick your targets. Don\'t cross their shots.',

    layout: {
      scenarioId: 12,
      stations: [
        { x: 0.15, y: 0.38, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.15, y: 0.62, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.85, y: 0.38, team: 1, role: 'ai',    visualStyle: 'drone',   aiLevel: 2 },
        { x: 0.85, y: 0.62, team: 1, role: 'ai',    visualStyle: 'drone',   aiLevel: 2 },
      ],
    },

    settings: {
      stationSize:          'large',
      gameSpeed:            'normal',
      movementSpeed:        'slow',
      collectablesSpawn:    'off',
      collectableWeapon:    null,
      cannonEnabled:        true,
      startingWeapons:      {},
      enemyStartingWeapons: {},
    },

    objectives:     [{ type: 'destroy_all' }],
    failConditions: [],

    scoring: { formula: 'combat_efficiency', passingScore: 350 },
  },

  {
    id:    'm8-squad',
    title: 'Squad',
    story: 'Four on four. Tight formations. Star system — that gravity will bite you if you don\'t respect it. Those {enemy1}s think their numbers make them safe. Show them different.',

    layout: {
      scenarioId: 4,
      stations: [
        { x: 0.12, y: 0.25, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.12, y: 0.42, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.12, y: 0.58, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.12, y: 0.75, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.88, y: 0.25, team: 1, role: 'ai',    visualStyle: 'drone',   aiLevel: 3 },
        { x: 0.88, y: 0.42, team: 1, role: 'ai',    visualStyle: 'drone',   aiLevel: 3 },
        { x: 0.88, y: 0.58, team: 1, role: 'ai',    visualStyle: 'drone',   aiLevel: 3 },
        { x: 0.88, y: 0.75, team: 1, role: 'ai',    visualStyle: 'drone',   aiLevel: 3 },
      ],
    },

    settings: {
      stationSize:          'large',
      gameSpeed:            'normal',
      movementSpeed:        'slow',
      collectablesSpawn:    'off',
      collectableWeapon:    null,
      cannonEnabled:        true,
      startingWeapons:      {},
      enemyStartingWeapons: {},
    },

    objectives:     [{ type: 'destroy_all' }],
    failConditions: [],

    scoring: { formula: 'combat_efficiency', passingScore: 500 },
  },

  {
    id:    'm9-platoon',
    title: 'Platoon',
    story: 'Six on six. Wormhole space — unpredictable. Those {enemy1}s are veterans. They will adapt to you. Adapt faster.',

    layout: {
      scenarioId: 19,
      stations: [
        { x: 0.12, y: 0.18, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.12, y: 0.32, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.12, y: 0.46, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.12, y: 0.60, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.12, y: 0.74, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.12, y: 0.88, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.88, y: 0.18, team: 1, role: 'ai',    visualStyle: 'drone',   aiLevel: 4 },
        { x: 0.88, y: 0.32, team: 1, role: 'ai',    visualStyle: 'drone',   aiLevel: 4 },
        { x: 0.88, y: 0.46, team: 1, role: 'ai',    visualStyle: 'drone',   aiLevel: 4 },
        { x: 0.88, y: 0.60, team: 1, role: 'ai',    visualStyle: 'drone',   aiLevel: 4 },
        { x: 0.88, y: 0.74, team: 1, role: 'ai',    visualStyle: 'drone',   aiLevel: 4 },
        { x: 0.88, y: 0.88, team: 1, role: 'ai',    visualStyle: 'drone',   aiLevel: 4 },
      ],
    },

    settings: {
      stationSize:          'large',
      gameSpeed:            'normal',
      movementSpeed:        'slow',
      collectablesSpawn:    'off',
      collectableWeapon:    null,
      cannonEnabled:        true,
      startingWeapons:      {},
      enemyStartingWeapons: {},
    },

    objectives:     [{ type: 'destroy_all' }],
    failConditions: [],

    scoring: { formula: 'combat_efficiency', passingScore: 600 },
  },

  {
    id:    'm10-line-of-battle',
    title: 'Line of Battle',
    story: 'Eight versus eight. Asteroid belt between you and those {enemy1}s. You have one minigun — so do they. Whoever uses it better wins. Don\'t waste it.',

    layout: {
      planets: [
        // Dense horizontal asteroid belt across the centre (y ~0.40–0.60)
        { type: 'asteroid', x: 0.28, y: 0.40, radius: 10, density: 0.08 },
        { type: 'asteroid', x: 0.36, y: 0.44, radius: 12, density: 0.08 },
        { type: 'asteroid', x: 0.44, y: 0.40, radius: 10, density: 0.08 },
        { type: 'asteroid', x: 0.50, y: 0.46, radius: 14, density: 0.08 },
        { type: 'asteroid', x: 0.56, y: 0.40, radius: 10, density: 0.08 },
        { type: 'asteroid', x: 0.64, y: 0.44, radius: 12, density: 0.08 },
        { type: 'asteroid', x: 0.72, y: 0.40, radius: 10, density: 0.08 },
        { type: 'asteroid', x: 0.30, y: 0.52, radius: 12, density: 0.08 },
        { type: 'asteroid', x: 0.38, y: 0.56, radius: 10, density: 0.08 },
        { type: 'asteroid', x: 0.46, y: 0.52, radius: 14, density: 0.08 },
        { type: 'asteroid', x: 0.52, y: 0.58, radius: 10, density: 0.08 },
        { type: 'asteroid', x: 0.58, y: 0.52, radius: 12, density: 0.08 },
        { type: 'asteroid', x: 0.66, y: 0.56, radius: 10, density: 0.08 },
        { type: 'asteroid', x: 0.74, y: 0.52, radius: 12, density: 0.08 },
        { type: 'asteroid', x: 0.42, y: 0.60, radius: 10, density: 0.08 },
        { type: 'asteroid', x: 0.60, y: 0.60, radius: 10, density: 0.08 },
      ],
      stations: [
        { x: 0.10, y: 0.10, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.10, y: 0.23, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.10, y: 0.36, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.10, y: 0.49, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.10, y: 0.62, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.10, y: 0.75, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.10, y: 0.88, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.10, y: 1.00, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.90, y: 0.10, team: 1, role: 'ai',    visualStyle: 'drone',   aiLevel: 3 },
        { x: 0.90, y: 0.23, team: 1, role: 'ai',    visualStyle: 'drone',   aiLevel: 3 },
        { x: 0.90, y: 0.36, team: 1, role: 'ai',    visualStyle: 'drone',   aiLevel: 3 },
        { x: 0.90, y: 0.49, team: 1, role: 'ai',    visualStyle: 'drone',   aiLevel: 3 },
        { x: 0.90, y: 0.62, team: 1, role: 'ai',    visualStyle: 'drone',   aiLevel: 3 },
        { x: 0.90, y: 0.75, team: 1, role: 'ai',    visualStyle: 'drone',   aiLevel: 3 },
        { x: 0.90, y: 0.88, team: 1, role: 'ai',    visualStyle: 'drone',   aiLevel: 3 },
        { x: 0.90, y: 1.00, team: 1, role: 'ai',    visualStyle: 'drone',   aiLevel: 3 },
      ],
    },

    settings: {
      stationSize:          'large',
      gameSpeed:            'normal',
      movementSpeed:        'fast',
      collectablesSpawn:    'off',
      collectableWeapon:    null,
      cannonEnabled:        true,
      startingWeapons:      { minigun: 1 },
      enemyStartingWeapons: { minigun: 1 },
    },

    objectives:     [{ type: 'destroy_all' }],
    failConditions: [],

    scoring: { formula: 'combat_efficiency', passingScore: 700 },
  },

  {
    id:    'm11-rocket-corps',
    title: 'Rocket Corps',
    story: 'No cannons today, recruit. Rockets only. Dense field around a star — everything curves. Four on four. Welcome to the Rocket Corps.',

    layout: {
      planets: [
        // Central star
        { type: 'star', x: 0.50, y: 0.50, radius: 22, density: 1.0 },
        // Asteroid ring at roughly 25–35% of map radius from centre
        { type: 'asteroid', x: 0.50, y: 0.20, radius: 9, density: 0.08 },
        { type: 'asteroid', x: 0.60, y: 0.22, radius: 8, density: 0.08 },
        { type: 'asteroid', x: 0.69, y: 0.28, radius: 9, density: 0.08 },
        { type: 'asteroid', x: 0.76, y: 0.36, radius: 8, density: 0.08 },
        { type: 'asteroid', x: 0.78, y: 0.47, radius: 9, density: 0.08 },
        { type: 'asteroid', x: 0.75, y: 0.58, radius: 8, density: 0.08 },
        { type: 'asteroid', x: 0.68, y: 0.67, radius: 9, density: 0.08 },
        { type: 'asteroid', x: 0.59, y: 0.73, radius: 8, density: 0.08 },
        { type: 'asteroid', x: 0.49, y: 0.76, radius: 9, density: 0.08 },
        { type: 'asteroid', x: 0.39, y: 0.73, radius: 8, density: 0.08 },
        { type: 'asteroid', x: 0.30, y: 0.67, radius: 9, density: 0.08 },
        { type: 'asteroid', x: 0.23, y: 0.58, radius: 8, density: 0.08 },
        { type: 'asteroid', x: 0.20, y: 0.47, radius: 9, density: 0.08 },
        { type: 'asteroid', x: 0.23, y: 0.36, radius: 8, density: 0.08 },
        { type: 'asteroid', x: 0.30, y: 0.28, radius: 9, density: 0.08 },
        { type: 'asteroid', x: 0.39, y: 0.22, radius: 8, density: 0.08 },
        { type: 'asteroid', x: 0.55, y: 0.24, radius: 7, density: 0.08 },
        { type: 'asteroid', x: 0.64, y: 0.32, radius: 7, density: 0.08 },
        { type: 'asteroid', x: 0.70, y: 0.42, radius: 7, density: 0.08 },
        { type: 'asteroid', x: 0.67, y: 0.62, radius: 7, density: 0.08 },
        { type: 'asteroid', x: 0.44, y: 0.26, radius: 7, density: 0.08 },
        { type: 'asteroid', x: 0.27, y: 0.44, radius: 7, density: 0.08 },
      ],
      stations: [
        { x: 0.10, y: 0.38, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.10, y: 0.45, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.10, y: 0.52, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.10, y: 0.59, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.90, y: 0.38, team: 1, role: 'ai',    visualStyle: 'drone',   aiLevel: 3 },
        { x: 0.90, y: 0.45, team: 1, role: 'ai',    visualStyle: 'drone',   aiLevel: 3 },
        { x: 0.90, y: 0.52, team: 1, role: 'ai',    visualStyle: 'drone',   aiLevel: 3 },
        { x: 0.90, y: 0.59, team: 1, role: 'ai',    visualStyle: 'drone',   aiLevel: 3 },
      ],
    },

    settings: {
      stationSize:          'large',
      gameSpeed:            'normal',
      movementSpeed:        'slow',
      collectablesSpawn:    'normal',
      collectableWeapon:    null,
      cannonEnabled:        false,
      startingWeapons:      { rocket: 99 },
      enemyStartingWeapons: { rocket: 99 },
    },

    objectives:     [{ type: 'destroy_all' }],
    failConditions: [],

    scoring: { formula: 'combat_efficiency', passingScore: 500 },
  },

  // ── Phase 3: Field Operations (M12–M16) ────────────────────────────────────

  {
    id:    'm12-mining',
    title: 'Mining Duty',
    story: 'Basic training is done, recruit. Now you pull your weight. That asteroid field is full of raw crystals — every rock out there is rich. Two ships, twenty turns. Get eight of them.',

    layout: {
      planets: [
        { type: 'gasGiant', x: 0.50, y: 0.50, radius: 48, density: 0.02 },
        { type: 'asteroid', x: 0.28, y: 0.30, radius: 28, density: 0.08, rich: true },
        { type: 'asteroid', x: 0.42, y: 0.22, radius: 24, density: 0.08, rich: true },
        { type: 'asteroid', x: 0.60, y: 0.20, radius: 20, density: 0.08, rich: true },
        { type: 'asteroid', x: 0.74, y: 0.32, radius: 28, density: 0.08, rich: true },
        { type: 'asteroid', x: 0.80, y: 0.48, radius: 24, density: 0.08, rich: true },
        { type: 'asteroid', x: 0.78, y: 0.65, radius: 20, density: 0.08, rich: true },
        { type: 'asteroid', x: 0.64, y: 0.76, radius: 28, density: 0.08, rich: true },
        { type: 'asteroid', x: 0.46, y: 0.80, radius: 24, density: 0.08, rich: true },
        { type: 'asteroid', x: 0.28, y: 0.70, radius: 20, density: 0.08, rich: true },
        { type: 'asteroid', x: 0.22, y: 0.54, radius: 28, density: 0.08, rich: true },
        { type: 'asteroid', x: 0.35, y: 0.62, radius: 24, density: 0.08, rich: true },
        { type: 'asteroid', x: 0.68, y: 0.36, radius: 20, density: 0.08, rich: true },
      ],
      stations: [
        { x: 0.12, y: 0.40, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.12, y: 0.60, team: 0, role: 'human', visualStyle: 'station' },
      ],
    },

    settings: {
      stationSize:          'large',
      gameSpeed:            'normal',
      movementSpeed:        'off',
      collectablesSpawn:    'normal',
      collectableWeapon:    null,
      cannonEnabled:        true,
      richAsteroids:        'common',
      startingWeapons:      {},
      enemyStartingWeapons: {},
    },

    objectives:     [{ type: 'collect_n', params: { count: 8 } }],
    failConditions: [{ type: 'max_turns', turns: 20 }],

    scoring: { formula: 'collectables_score', passingScore: 1500 },
  },

  {
    id:    'm13-ambush',
    title: 'Ambush',
    story: 'Same sector. Intel says collect crystals — sensors are picking up something on the edge of the system. Stay sharp.',

    layout: {
      planets: [
        { type: 'gasGiant', x: 0.48, y: 0.52, radius: 42, density: 0.02 },
        { type: 'asteroid', x: 0.24, y: 0.28, radius: 24, density: 0.08 },
        { type: 'asteroid', x: 0.38, y: 0.18, radius: 28, density: 0.08, rich: true },
        { type: 'asteroid', x: 0.56, y: 0.22, radius: 20, density: 0.08 },
        { type: 'asteroid', x: 0.72, y: 0.30, radius: 24, density: 0.08, rich: true },
        { type: 'asteroid', x: 0.82, y: 0.44, radius: 28, density: 0.08 },
        { type: 'asteroid', x: 0.80, y: 0.62, radius: 20, density: 0.08, rich: true },
        { type: 'asteroid', x: 0.70, y: 0.76, radius: 24, density: 0.08 },
        { type: 'asteroid', x: 0.52, y: 0.82, radius: 28, density: 0.08, rich: true },
        { type: 'asteroid', x: 0.34, y: 0.76, radius: 20, density: 0.08 },
        { type: 'asteroid', x: 0.22, y: 0.62, radius: 24, density: 0.08, rich: true },
        { type: 'asteroid', x: 0.20, y: 0.44, radius: 28, density: 0.08 },
        { type: 'asteroid', x: 0.62, y: 0.38, radius: 20, density: 0.08, rich: true },
      ],
      stations: [
        { x: 0.12, y: 0.42, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.12, y: 0.58, team: 0, role: 'human', visualStyle: 'station' },
      ],
    },

    settings: {
      stationSize:          'large',
      gameSpeed:            'normal',
      movementSpeed:        'off',
      collectablesSpawn:    'normal',
      collectableWeapon:    null,
      cannonEnabled:        true,
      richAsteroids:        'common',
      startingWeapons:      {},
      enemyStartingWeapons: {},
    },

    objectives:     [],
    failConditions: [{ type: 'max_turns', turns: 20 }],

    events: [
      {
        turn: 3,
        spawnStations: [
          { x: null, y: null, team: 1, role: 'ai', visualStyle: 'station', aiLevel: 3, startingWeapons: { rocket: 99 } },
          { x: null, y: null, team: 1, role: 'ai', visualStyle: 'station', aiLevel: 3, startingWeapons: { rocket: 99 } },
        ],
        dialog: 'Contact. Two {enemy1} ships have warped in. New objective: take them out.',
        addObjectives: [{ type: 'destroy_all' }],
      },
    ],

    scoring: { formula: 'combat_efficiency', passingScore: 400 },
  },

  {
    id:    'm14-patrol',
    title: 'Patrol',
    story: 'We are at war, recruit. You are on patrol. Supergiant binary — dangerous territory. Keep your eyes open.',

    layout: {
      scenarioId: 8,
      stations: [
        { x: 0.15, y: 0.42, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.15, y: 0.58, team: 0, role: 'human', visualStyle: 'station' },
      ],
    },

    settings: {
      stationSize:          'large',
      gameSpeed:            'normal',
      movementSpeed:        'slow',
      collectablesSpawn:    'off',
      collectableWeapon:    null,
      cannonEnabled:        true,
      startingWeapons:      { blaster: 2, blunderbuss: 2 },
      enemyStartingWeapons: {},
    },

    objectives:     [],
    failConditions: [],

    events: [
      {
        turn: 2,
        spawnStations: [
          { x: null, y: null, team: 1, role: 'ai', visualStyle: 'station', aiLevel: 3, startingWeapons: { tripleCannon: 4 } },
          { x: null, y: null, team: 1, role: 'ai', visualStyle: 'station', aiLevel: 3, startingWeapons: { tripleCannon: 4 } },
          { x: null, y: null, team: 1, role: 'ai', visualStyle: 'station', aiLevel: 3, startingWeapons: { tripleCannon: 4 } },
          { x: null, y: null, team: 1, role: 'ai', visualStyle: 'station', aiLevel: 3, startingWeapons: { tripleCannon: 4 } },
        ],
        dialog: 'Bogeys inbound. Four {enemy1}s, armed. Don\'t let them pick you apart.',
        addObjectives: [{ type: 'destroy_all' }],
      },
    ],

    scoring: { formula: 'combat_efficiency', passingScore: 400 },
  },

  {
    id:    'm15-outnumbered',
    title: 'Outnumbered',
    story: 'Three of you. Six of them. Same weapons. Different odds. Figure it out.',

    layout: {
      scenarioId: 11,
      stations: [
        { x: 0.12, y: 0.35, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.12, y: 0.50, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.12, y: 0.65, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.88, y: 0.25, team: 1, role: 'ai',    visualStyle: 'station',   aiLevel: 3 },
        { x: 0.88, y: 0.35, team: 1, role: 'ai',    visualStyle: 'station',   aiLevel: 3 },
        { x: 0.88, y: 0.45, team: 1, role: 'ai',    visualStyle: 'station',   aiLevel: 3 },
        { x: 0.88, y: 0.55, team: 1, role: 'ai',    visualStyle: 'station',   aiLevel: 3 },
        { x: 0.88, y: 0.65, team: 1, role: 'ai',    visualStyle: 'station',   aiLevel: 3 },
        { x: 0.88, y: 0.75, team: 1, role: 'ai',    visualStyle: 'station',   aiLevel: 3 },
      ],
    },

    settings: {
      stationSize:          'large',
      gameSpeed:            'normal',
      movementSpeed:        'slow',
      collectablesSpawn:    'off',
      collectableWeapon:    null,
      cannonEnabled:        true,
      startingWeapons:      { tripleCannon: 3, minigun: 1 },
      enemyStartingWeapons: { tripleCannon: 3, minigun: 1 },
    },

    objectives:     [{ type: 'destroy_all' }],
    failConditions: [],

    scoring: { formula: 'combat_efficiency', passingScore: 500 },
  },

  {
    id:    'm16-three-way',
    title: 'Three-Way',
    story: 'Another faction has entered the field. The {enemy1}s and the {enemy2}s both want those resources. So do we. There\'s only room for one team in this asteroid field.',

    layout: {
      scenarioId: 3,
      stations: [
        { x: 0.12, y: 0.35, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.12, y: 0.50, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.12, y: 0.65, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.78, y: 0.20, team: 1, role: 'ai',    visualStyle: 'station',   aiLevel: 3 },
        { x: 0.85, y: 0.32, team: 1, role: 'ai',    visualStyle: 'station',   aiLevel: 3 },
        { x: 0.80, y: 0.44, team: 1, role: 'ai',    visualStyle: 'station',   aiLevel: 3 },
        { x: 0.80, y: 0.58, team: 2, role: 'ai',    visualStyle: 'station',   aiLevel: 3 },
        { x: 0.85, y: 0.70, team: 2, role: 'ai',    visualStyle: 'station',   aiLevel: 3 },
        { x: 0.78, y: 0.82, team: 2, role: 'ai',    visualStyle: 'station',   aiLevel: 3 },
      ],
    },

    settings: {
      stationSize:          'large',
      gameSpeed:            'normal',
      movementSpeed:        'slow',
      collectablesSpawn:    'normal',
      collectableWeapon:    null,
      cannonEnabled:        true,
      richAsteroids:        'normal',
      startingWeapons:      { rocket: 2 },
      enemyStartingWeapons: { rocket: 2 },
    },

    objectives:     [{ type: 'destroy_all' }],
    failConditions: [],

    scoring: { formula: 'combat_efficiency', passingScore: 400 },
  },

  // ── Phase 4: Total War (M17–M20) ───────────────────────────────────────────

  {
    id:    'm17-four-factions',
    title: 'Four Factions',
    story: 'Four factions. Two stations each. Red Giant territory. Everyone\'s armed. Show them who belongs in this sector.',

    layout: {
      scenarioId: 10,
      starRadiusScale: 0.8,
      stations: [
        { x: 0.15, y: 0.42, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.15, y: 0.58, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.85, y: 0.42, team: 1, role: 'ai',    visualStyle: 'station',   aiLevel: 4 },
        { x: 0.85, y: 0.58, team: 1, role: 'ai',    visualStyle: 'station',   aiLevel: 4 },
        { x: 0.42, y: 0.12, team: 2, role: 'ai',    visualStyle: 'station',   aiLevel: 4 },
        { x: 0.58, y: 0.12, team: 2, role: 'ai',    visualStyle: 'station',   aiLevel: 4 },
        { x: 0.42, y: 0.88, team: 3, role: 'ai',    visualStyle: 'station',   aiLevel: 4 },
        { x: 0.58, y: 0.88, team: 3, role: 'ai',    visualStyle: 'station',   aiLevel: 4 },
      ],
    },

    settings: {
      stationSize:          'large',
      gameSpeed:            'normal',
      movementSpeed:        'slow',
      collectablesSpawn:    'off',
      collectableWeapon:    null,
      cannonEnabled:        true,
      startingWeapons:      { rocket: 2, blaster: 4, blunderbuss: 3 },
      enemyStartingWeapons: { rocket: 2, blaster: 4, blunderbuss: 3 },
    },

    objectives:     [{ type: 'destroy_all' }],
    failConditions: [],

    scoring: { formula: 'combat_efficiency', passingScore: 500 },
  },

  {
    id:    'm18-laser',
    title: 'Laser Squad',
    story: 'Six factions. Three ships each. Asteroid field around a white dwarf — shots bend hard near the centre. Everyone has lasers. First team through wins.',

    layout: {
      scenarioId: 17,
      // White dwarf substituted at map centre — dense gravity bends all laser paths near centre
      extraPlanets: [
        { type: 'whiteDwarf', x: 0.50, y: 0.50, radius: 8, density: 0.014, mass: 900 },
      ],
      stations: [
        { x: 0.10, y: 0.38, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.12, y: 0.50, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.10, y: 0.62, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.90, y: 0.38, team: 1, role: 'ai',    visualStyle: 'station',   aiLevel: 4 },
        { x: 0.88, y: 0.50, team: 1, role: 'ai',    visualStyle: 'station',   aiLevel: 4 },
        { x: 0.90, y: 0.62, team: 1, role: 'ai',    visualStyle: 'station',   aiLevel: 4 },
        { x: 0.38, y: 0.10, team: 2, role: 'ai',    visualStyle: 'station',   aiLevel: 4 },
        { x: 0.50, y: 0.12, team: 2, role: 'ai',    visualStyle: 'station',   aiLevel: 4 },
        { x: 0.62, y: 0.10, team: 2, role: 'ai',    visualStyle: 'station',   aiLevel: 4 },
        { x: 0.38, y: 0.90, team: 3, role: 'ai',    visualStyle: 'station',   aiLevel: 4 },
        { x: 0.50, y: 0.88, team: 3, role: 'ai',    visualStyle: 'station',   aiLevel: 4 },
        { x: 0.62, y: 0.90, team: 3, role: 'ai',    visualStyle: 'station',   aiLevel: 4 },
        { x: 0.22, y: 0.32, team: 4, role: 'ai',    visualStyle: 'station',   aiLevel: 4 },
        { x: 0.28, y: 0.42, team: 4, role: 'ai',    visualStyle: 'station',   aiLevel: 4 },
        { x: 0.22, y: 0.52, team: 4, role: 'ai',    visualStyle: 'station',   aiLevel: 4 },
        { x: 0.78, y: 0.48, team: 5, role: 'ai',    visualStyle: 'station',   aiLevel: 4 },
        { x: 0.72, y: 0.58, team: 5, role: 'ai',    visualStyle: 'station',   aiLevel: 4 },
        { x: 0.78, y: 0.68, team: 5, role: 'ai',    visualStyle: 'station',   aiLevel: 4 },
      ],
    },

    settings: {
      stationSize:          'large',
      gameSpeed:            'normal',
      movementSpeed:        'slow',
      collectablesSpawn:    'off',
      collectableWeapon:    null,
      cannonEnabled:        true,
      startingWeapons:      { laser: 3 },
      enemyStartingWeapons: { laser: 3 },
    },

    objectives:     [{ type: 'destroy_all' }],
    failConditions: [],

    scoring: { formula: 'combat_efficiency', passingScore: 600 },
  },

  {
    id:    'm19-total-war',
    title: 'Total War',
    story: 'All factions. Maximum engagement. Wormhole space. Small stations. Everyone is in the fight now, recruit. Do not let them outmanoeuvre you.',

    layout: {
      scenarioId: 19,
      stations: [
        { x: 0.08, y: 0.30, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.10, y: 0.42, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.08, y: 0.58, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.10, y: 0.70, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.92, y: 0.30, team: 1, role: 'ai',    visualStyle: 'station',   aiLevel: 5 },
        { x: 0.90, y: 0.42, team: 1, role: 'ai',    visualStyle: 'station',   aiLevel: 5 },
        { x: 0.92, y: 0.58, team: 1, role: 'ai',    visualStyle: 'station',   aiLevel: 5 },
        { x: 0.90, y: 0.70, team: 1, role: 'ai',    visualStyle: 'station',   aiLevel: 5 },
        { x: 0.30, y: 0.08, team: 2, role: 'ai',    visualStyle: 'station',   aiLevel: 5 },
        { x: 0.42, y: 0.10, team: 2, role: 'ai',    visualStyle: 'station',   aiLevel: 5 },
        { x: 0.58, y: 0.08, team: 2, role: 'ai',    visualStyle: 'station',   aiLevel: 5 },
        { x: 0.70, y: 0.10, team: 2, role: 'ai',    visualStyle: 'station',   aiLevel: 5 },
        { x: 0.30, y: 0.92, team: 3, role: 'ai',    visualStyle: 'station',   aiLevel: 5 },
        { x: 0.42, y: 0.90, team: 3, role: 'ai',    visualStyle: 'station',   aiLevel: 5 },
        { x: 0.58, y: 0.92, team: 3, role: 'ai',    visualStyle: 'station',   aiLevel: 5 },
        { x: 0.70, y: 0.90, team: 3, role: 'ai',    visualStyle: 'station',   aiLevel: 5 },
        { x: 0.18, y: 0.18, team: 4, role: 'ai',    visualStyle: 'station',   aiLevel: 5 },
        { x: 0.24, y: 0.26, team: 4, role: 'ai',    visualStyle: 'station',   aiLevel: 5 },
        { x: 0.20, y: 0.34, team: 4, role: 'ai',    visualStyle: 'station',   aiLevel: 5 },
        { x: 0.28, y: 0.22, team: 4, role: 'ai',    visualStyle: 'station',   aiLevel: 5 },
        { x: 0.82, y: 0.18, team: 5, role: 'ai',    visualStyle: 'station',   aiLevel: 5 },
        { x: 0.76, y: 0.26, team: 5, role: 'ai',    visualStyle: 'station',   aiLevel: 5 },
        { x: 0.80, y: 0.34, team: 5, role: 'ai',    visualStyle: 'station',   aiLevel: 5 },
        { x: 0.72, y: 0.22, team: 5, role: 'ai',    visualStyle: 'station',   aiLevel: 5 },
        { x: 0.18, y: 0.82, team: 6, role: 'ai',    visualStyle: 'station',   aiLevel: 5 },
        { x: 0.24, y: 0.74, team: 6, role: 'ai',    visualStyle: 'station',   aiLevel: 5 },
        { x: 0.20, y: 0.66, team: 6, role: 'ai',    visualStyle: 'station',   aiLevel: 5 },
        { x: 0.28, y: 0.78, team: 6, role: 'ai',    visualStyle: 'station',   aiLevel: 5 },
        { x: 0.82, y: 0.82, team: 7, role: 'ai',    visualStyle: 'station',   aiLevel: 5 },
        { x: 0.76, y: 0.74, team: 7, role: 'ai',    visualStyle: 'station',   aiLevel: 5 },
        { x: 0.80, y: 0.66, team: 7, role: 'ai',    visualStyle: 'station',   aiLevel: 5 },
        { x: 0.72, y: 0.78, team: 7, role: 'ai',    visualStyle: 'station',   aiLevel: 5 },
      ],
    },

    settings: {
      stationSize:          'small',
      gameSpeed:            'normal',
      movementSpeed:        'slow',
      collectablesSpawn:    'off',
      collectableWeapon:    null,
      cannonEnabled:        true,
      startingWeapons:      {},
      enemyStartingWeapons: {},
    },

    objectives:     [{ type: 'destroy_all' }],
    failConditions: [],

    scoring: { formula: 'combat_efficiency', passingScore: 700 },
  },

  {
    id:    'm20-duel',
    title: 'The Duel',
    story: 'One final confrontation. Micro stations. A black hole between you and them. This is what all the training was for. Do not miss.',

    layout: {
      scenarioId: 22,
      blackHoleMassScale: 0.7,
      // 3 comets added — moving gravitational bodies that vary the field each turn
      extraPlanets: [
        { type: 'comet', x: 0.25, y: 0.25, radius: 6, density: 30 },
        { type: 'comet', x: 0.75, y: 0.30, radius: 6, density: 30 },
        { type: 'comet', x: 0.50, y: 0.80, radius: 6, density: 30 },
      ],
      stations: [
        { x: 0.12, y: 0.28, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.12, y: 0.42, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.12, y: 0.58, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.12, y: 0.72, team: 0, role: 'human', visualStyle: 'station' },
        { x: 0.88, y: 0.28, team: 1, role: 'ai',    visualStyle: 'station',   aiLevel: 5 },
        { x: 0.88, y: 0.42, team: 1, role: 'ai',    visualStyle: 'station',   aiLevel: 5 },
        { x: 0.88, y: 0.58, team: 1, role: 'ai',    visualStyle: 'station',   aiLevel: 5 },
        { x: 0.88, y: 0.72, team: 1, role: 'ai',    visualStyle: 'station',   aiLevel: 5 },
      ],
    },

    settings: {
      stationSize:          'micro',
      gameSpeed:            'normal',
      movementSpeed:        'slow',
      collectablesSpawn:    'off',
      collectableWeapon:    null,
      cannonEnabled:        true,
      startingWeapons:      {},
      enemyStartingWeapons: {},
    },

    objectives:     [{ type: 'destroy_all' }],
    failConditions: [],

    scoring: { formula: 'combat_efficiency', passingScore: 800 },
  },

];
