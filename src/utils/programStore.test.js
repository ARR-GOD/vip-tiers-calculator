import { describe, it, expect } from 'vitest';
import { migrateProgramState, STATE_VERSION } from './programStore';
import { normalizeProgram, buildProgramDefaults } from '../data/programDefaults';
import { missionPoints } from './pointsModel';
import { rewardPointsCost } from './rewardModel';

const v1 = (overrides = {}) => ({
  config: { tierBasis: 'spend', hasMissions: true },
  settings: { aov: 80, grossMargin: 60, cashbackRate: 15, pointsPerEuro: 7 },
  tiers: [
    { name: 'Bronze', spendThreshold: 0, pointsThreshold: 0, pointsMultiplier: 1, threshold: 100, perks: [] },
    { name: 'Argent', spendThreshold: 400, pointsThreshold: 1000, pointsMultiplier: 1.5 },
    { name: 'Or', spendThreshold: 1600, pointsThreshold: 3000, pointsMultiplier: 2 },
  ],
  missions: [
    { id: 'purchase', isPurchaseMission: true, points: 1, frequency: 4, enabled: true, engagementByTier: [100, 100, 100] },
    { id: 'review', points: 100, frequency: 3, enabled: true, engagementByTier: [10, 25, 45] },
  ],
  customMissions: [{ id: 'quiz', points: 50, frequency: 4, enabled: true, completionRate: 30 }],
  rewards: [
    { id: 'r1', type: 'promo_percent', nameFr: '-10%', rewardUsage: 'burn', pointsCost: 500, realCost: 8, minPurchase: 90, assignedTiers: [true, true, true], utilizationByTier: [20, 35, 50] },
    { id: 'r2', type: 'free_product', rewardUsage: 'perk', pointsCost: 0, realCost: 15, minPurchase: 0, assignedTiers: [false, false, true], utilizationByTier: [0, 0, 60] },
  ],
  burnRate: 40,
  ...overrides,
});

const load = state => normalizeProgram(migrateProgramState(state));

describe('migrateProgramState', () => {
  it('keeps the figures a program displayed before (Config step visited)', () => {
    const p = load(v1());
    expect(p.settings.earnRate).toBe(1); // 15% × 7 = 1.05 pt/€ → 1
    expect(p.settings.earnRateManual).toBe(true);
    expect(missionPoints(p.missions[1], p.settings)).toBe(100);
    expect(missionPoints(p.customMissions[0], p.settings)).toBe(50);
    expect(rewardPointsCost(p.rewards[0], p.settings)).toBe(500);
    expect(p.missions[1].completionRate).toBe(27);
    expect(p.tiers.map(t => t.avgUtilization)).toEqual([20, 35, 55]);
    expect(p.burnRate).toBe(40);
  });

  it('pins an unusual earn rate instead of snapping it (Config step never visited)', () => {
    const p = load(v1({ settings: { aov: 80, cashbackRate: 3, pointsPerEuro: 100 } }));
    expect(p.settings.earnRate).toBe(3);
    expect(missionPoints(p.missions[1], p.settings)).toBe(100);
    expect(rewardPointsCost(p.rewards[0], p.settings)).toBe(500);
  });

  it('handles a luxury program without cashback', () => {
    const p = load(v1({ settings: { aov: 300, cashbackRate: 0, pointsPerEuro: 100 } }));
    expect(p.settings.earnRate).toBe(1);
    expect(p.rewards[0].pointsValueEur).toBe(5);
  });

  it('gives a 4th tier without rewards its default utilization', () => {
    const state = v1();
    state.tiers.push({ name: 'Platine', spendThreshold: 5000, pointsMultiplier: 2.5 });
    state.rewards.forEach(r => r.assignedTiers.push(false));
    expect(load(state).tiers[3].avgUtilization).toBe(20);
  });

  it('is idempotent and produces no NaN', () => {
    const once = migrateProgramState(v1());
    expect(once.v).toBe(STATE_VERSION);
    expect(migrateProgramState(once)).toEqual(once);
    expect(JSON.stringify(normalizeProgram(once))).not.toMatch(/NaN/);
  });
});

describe('program defaults', () => {
  it('builds a luxury program without points', () => {
    const p = buildProgramDefaults({ programType: 'luxury', aov: 300, grossMargin: 65 });
    expect(p.config.hasMissions).toBe(false);
    expect(p.settings.cashbackRate).toBe(0);
    expect(p.missions.every(m => m.isPurchaseMission)).toBe(true);
    expect(p.burnRate).toBe(0);
  });

  it('gives tiers the default utilization 5 / 10 / 15 %', () => {
    const p = buildProgramDefaults({ aov: 80, grossMargin: 55 });
    expect(p.tiers.map(t => t.avgUtilization)).toEqual([5, 10, 15]);
    expect(p.tiers.map(t => t.spendThreshold)).toEqual([0, 400, 1600]);
  });

  it('falls back to a spend basis when the program has no points', () => {
    const p = normalizeProgram({ config: { hasMissions: false, tierBasis: 'points' } });
    expect(p.config.tierBasis).toBe('spend');
  });
});
