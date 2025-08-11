import { Admin, Settings } from './constants.js';

export const State = {
  money: Admin.startMoney,
  lives: Admin.startLives,
  currentWave: 0,
  waveInProgress: false,
  enemies: [],
  towers: [],
  projectiles: [],
  spawnQueue: [],
  spawnTimer: 0,
  // Ensure end-of-wave payouts (banks, rewards, SP drip) only apply once per wave
  lastPayoutWave: 0,
  // Mutators
  nextWaveMutator: null,
  activeWaveMutator: null,
  // Wave tracking and totals
  waveStartTime: 0,
  waveStartMoney: 0,
  waveBountyEarned: 0,
  stats: { totalDamage: 0, totalWaves: 0, totalWaveTime: 0, totalBankIncome: 0, totalBounty: 0 },
  // Temporary cadence bonuses
  bountyBoostNext: 0,      // number of upcoming waves with bounty boost
  bountyBoostActive: false // true during an active boosted wave
};

export function resetGame(){
  State.money = Admin.startMoney;
  State.lives = Admin.startLives;
  State.currentWave = 0;
  State.waveInProgress = false;
  State.enemies.length=0; State.towers.length=0; State.projectiles.length=0; State.spawnQueue.length=0; State.spawnTimer=0;
  State.lastPayoutWave = 0;
  State.nextWaveMutator = null; State.activeWaveMutator = null;
  State.waveStartTime = 0; State.waveStartMoney = 0; State.waveBountyEarned = 0;
  State.stats = { totalDamage: 0, totalWaves: 0, totalWaveTime: 0, totalBankIncome: 0, totalBounty: 0 };
  // Determinism & replay
  State.seed = Math.floor(Math.random()*1e9)>>>0;
  State.rng = { random: Math.random };
  State.gameTime = 0;
  Settings.gameSpeed = Math.min(Settings.gameSpeed, Settings.maxSpeed);
}
