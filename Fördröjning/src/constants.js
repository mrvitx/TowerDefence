// Global constants and shared settings
export const TILE = 40;
export const PATH_WIDTH = 24; // legacy; not used for dynamic updates
export const PATH_RADIUS = PATH_WIDTH / 2; // legacy

// Visual settings (mutable)
export const Visuals = {
  pathWidth: 24,
  showGrid: true,
  showDamageNumbers: true,
  showDps: false,
  showHeatmap: false,
  dayNight: false,
  fogEnabled: false,
  showAllRanges: false,
  reducedFX: false,     // fewer particles/flashes
  cbMode: 'none',       // 'none' | 'deutan' | 'protan' | 'tritan'
  fontScale: 1.0,       // UI scale multiplier
  // Theme/UI
  theme: 'dim',         // 'dim' | 'light' | 'neon'
  _accent: undefined,   // CSS color override for --accent
  _radius: 10,          // border radius px
  _scale: 1.0,          // overall UI scale multiplier (applied to #app)
  _compact: false,      // compact HUD (hide toolbar labels)
};

// Game settings (mutable)
export const Settings = {
  gameSpeed: 1,
  maxSpeed: 5,
  buildMode: 'paint', // 'paint' | 'single'
};

export const Admin = {
  startMoney: 100,
  startLives: 10,
  upgCost: { dmg: 30, range: 25, rate: 35 },
};

export const MapSettings = {
  preset: 'ring', // 'ring' | 'maze' | 'figure8'
  difficulty: 1,  // multiplier applied to waves
  endless: false,
  // Wave pacing and limits
  roundSeconds: 25,    // target duration per wave in seconds (approx)
  maxWaves: 25,        // maximum waves before victory (ignored if endless)
  // Link generator target difficulty to gameplay difficulty (1..5)
  linkBuildDifficulty: true,
  // Advanced generation controls
  seed: 0,             // optional seed for deterministic generation (0 => random at reset)
  complexity: 2,       // 1..5 overall complexity/meander/branching
  smoothness: 0.5,     // 0..1 how strongly the path is smoothed (Catmull-Rom tension proxy)
  // Economy soft caps
  bankIncomeCap: 200,      // soft cap per wave for total bank income
  bankCapSoftness: 0.5,    // fraction applied beyond cap (0..1)
  // Acts thresholds
  act1End: 10,
  act2End: 20,
};

export const Audio = {
  muted: true,
  sfxVolume: 0.5,
};

// Simple map modifiers demo: tile coordinates (grid based) and fog rectangles in pixels
// You can expose these in Admin later if you want full control.
export const MapModifiers = {
  boostPads: [ {c:6,r:6}, {c:12,r:5} ],
  cursedTiles: [ {c:4,r:8}, {c:10,r:9} ],
  fogRects: [ {x: 360, y: 200, w: 240, h: 160} ],
  boost: { rangeMul: 1.15, rofMul: 0.85 }, // rofMul < 1 means faster
  cursed: { sellMul: 0.5 },
};

// Skill tree (global modifiers). Points are spent to increase multipliers.
export const Skills = {
  points: 0,
  dmgMul: 1.0,     // global damage multiplier
  rangeMul: 1.0,   // global range multiplier
  critAdd: 0.0,    // flat crit chance added to towers
  rofMul: 1.0,     // global fire-rate multiplier (seconds) — <1 is faster
  bankMul: 1.0,    // income tower multiplier
  bountyMul: 1.0,  // enemy worth multiplier
  tree: { lv: {} }, // skill tree levels: { [nodeId]: level }
};

// Declarative skill tree. Effects are per-level deltas applied cumulatively.
export const SKILL_TREE = [
  {
    tier: 1, group: 'Offensiv', nodes: [
      { id:'dmg1',   name:'Skada I',    max:5, cost:1, req:[],   effects:{ dmgMul: 0.02 } },
      { id:'range1', name:'Räckvidd I', max:5, cost:1, req:[],   effects:{ rangeMul: 0.02 } },
  { id:'crit1',  name:'Crit I',     max:5, cost:1, req:[],   effects:{ critAdd: 0.001 } },
  { id:'rate1',  name:'Eldhast I',  max:5, cost:1, req:[],   effects:{ rofMul: -0.015 } },
    ]
  },
  {
    tier: 1, group: 'Ekonomi', nodes: [
      { id:'bank1',   name:'Bank I',   max:5, cost:1, req:[],   effects:{ bankMul: 0.02 } },
      { id:'bounty1', name:'Bounty I', max:5, cost:1, req:[],   effects:{ bountyMul: 0.02 } },
    ]
  },
  {
    tier: 2, group: 'Offensiv', nodes: [
      { id:'dmg2',   name:'Skada II',    max:3, cost:2, req:[{id:'dmg1', lv:5}],   effects:{ dmgMul: 0.03 } },
      { id:'range2', name:'Räckvidd II', max:3, cost:2, req:[{id:'range1', lv:5}], effects:{ rangeMul: 0.03 } },
  { id:'crit2',  name:'Crit II',     max:3, cost:2, req:[{id:'crit1', lv:5}],  effects:{ critAdd: 0.003 } },
  { id:'rate2',  name:'Eldhast II',  max:3, cost:2, req:[{id:'rate1', lv:5}],  effects:{ rofMul: -0.02 } },
    ]
  },
  {
    tier: 2, group: 'Ekonomi', nodes: [
      { id:'bank2',   name:'Bank II',   max:3, cost:2, req:[{id:'bank1', lv:5}],   effects:{ bankMul: 0.03 } },
      { id:'bounty2', name:'Bounty II', max:3, cost:2, req:[{id:'bounty1', lv:5}], effects:{ bountyMul: 0.03 } },
    ]
  },
  {
    tier: 3, group: 'Nyckel', nodes: [
      { id:'keystone_off', name:'Mästarjägare', max:1, cost:3, req:[{id:'dmg2', lv:3},{id:'crit2', lv:3}], effects:{ dmgMul:0.10, critAdd:0.02 } },
      { id:'keystone_ec',  name:'Finansguru',   max:1, cost:3, req:[{id:'bank2', lv:3},{id:'bounty2', lv:3}], effects:{ bankMul:0.15, bountyMul:0.10 } },
    ]
  },
  {
    tier: 4, group: 'Tempo', nodes: [
      { id:'overclock', name:'Överklockning', max:2, cost:3, req:[{id:'rate2', lv:3}], effects:{ rofMul: -0.05 } },
    ]
  },
];

// Wave mutators: per-wave modifiers with optional rewards
// type 'enemy' affects spawned stats, 'player' affects economy for the wave
export const MUTATORS = [
  { id:'fastFragile',  name:'Snabba men sköra',     desc:'Fienderna är 30% snabbare men har 20% mindre HP. Belöning: +10% bounty denna våg.', enemy:{ speedMul:1.3, hpMul:0.8 }, reward:{ bountyMul:1.10 } },
  { id:'armoredSlow',  name:'Tunga rustningar',     desc:'Fienderna har 35% mer HP men rör sig 20% långsammare. Belöning: +30 pengar när vågen klaras.', enemy:{ hpMul:1.35, speedMul:0.8 }, reward:{ money:30 } },
  { id:'stealthy',     name:'Smygande skuggor',     desc:'Extra 20% chans att vara stealth. Belöning: +1 skill‑poäng vid seger.', enemy:{ stealthAdd:0.2 }, reward:{ sp:1 } },
  { id:'bountiful',    name:'Fet plånbok',          desc:'Fienderna ger 20% mer pengar. Belöning: inga.', enemy:{ worthMul:1.2 }, reward:{} },
  { id:'hasteSpawn',   name:'Hetsig start',         desc:'Spawns sker 35% tätare. Belöning: +10% bankinkomst denna våg.', wave:{ spawnRateMul:0.65 }, reward:{ bankMul:1.10 } },
  { id:'thickFog',     name:'Tjock dimma',          desc:'Alla fiender är delvis dolda (+stealth 10%) och lite långsammare. Belöning: +15 pengar.', enemy:{ stealthAdd:0.1, speedMul:0.9 }, reward:{ money:15 } },
];
