import { describe, it, expect } from 'vitest';
import { migrateProgramState, STATE_VERSION, buildProgramSnapshot, newProgramRow, copyProgramRow, programClientFields, DEFAULT_PROGRAM_NAME } from './programStore';
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
    expect(rewardPointsCost(p.rewards[0], p.settings)).toBe(500);
  });

  it('v2 → v3: reward prices are typed in points, the cashback is gone, prices unchanged', () => {
    const v2 = {
      v: 2,
      settings: { aov: 80, grossMargin: 60, cashbackRate: 15, earnRate: 5, earnRateManual: true },
      rewards: [
        { id: 'voucher', type: 'gift_voucher', rewardUsage: 'burn', pointsValueEur: 10, realCost: 10 },
        { id: 'bonus', type: 'bonus_points', rewardUsage: 'perk', pointsValueEur: 0, bonusBasePoints: 100, realCost: 0 },
        { id: 'perk', type: 'free_delivery', rewardUsage: 'perk', pointsValueEur: 0, realCost: 5, realCostAuto: false },
      ],
    };
    // Before: 15 % cashback at 5 pts/€ → 33.3 pts per € → a 10 € voucher cost 333 pts;
    // 500 bonus points were worth 15 €.
    const p = load(v2);
    expect(p.settings.cashbackRate).toBeUndefined();
    expect(p.rewards.some(r => 'pointsValueEur' in r)).toBe(false);
    expect(rewardPointsCost(p.rewards[0], p.settings)).toBe(333);
    expect(p.rewards[1]).toMatchObject({ realCost: 15, realCostAuto: false });
    expect(p.rewards[2].realCost).toBe(5);
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
    expect(p.settings.cashbackRate).toBeUndefined();
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

describe('default rewards (Loyoly recommendations)', () => {
  const p = buildProgramDefaults({ aov: 80, grossMargin: 55 });
  const perksOf = i => p.rewards.filter(r => r.rewardUsage === 'perk' && r.assignedTiers[i]).map(r => r.nameFr);

  it('gives cumulative perks per tier', () => {
    expect(perksOf(0)).toEqual(['Livraison gratuite', 'Anniversaire 5 €']);
    expect(perksOf(1)).toEqual(['Livraison gratuite', 'Bon 10 €', 'Anniversaire 10 €', 'Accès ventes privées', 'Accès collection en avant-première']);
    expect(perksOf(2)).toEqual(['Livraison gratuite', 'Bon 15 €', 'Anniversaire 15 €', 'Accès ventes privées', 'Accès collection en avant-première']);
  });

  it('defaults to a 90-day expiration, the AOV as minimum purchase and a 6% points utilization', () => {
    expect(p.rewards.every(r => r.expirationDays === 90)).toBe(true);
    expect(p.rewards.find(r => r.id === 'perk_voucher_10').minPurchaseAuto).toBe(true);
    expect(p.burnRate).toBe(6);
  });
});

describe('program rows (client folders)', () => {
  const snapshot = buildProgramSnapshot({ id: null, hubspotCompanyId: '42' }, {
    ...buildProgramDefaults({ aov: 80 }),
    selectedClient: { id: '42', name: 'Brand A', domain: 'branda.com', plan: 'Premium' },
    customers: [],
  });

  it('names a program on its first save', () => {
    expect(newProgramRow({ id: null, hubspotCompanyId: '42', name: 'Proposition B' }, snapshot.row, []))
      .toMatchObject({ hubspot_company_id: '42', folder_key: 'hs:42', program_name: 'Proposition B', client_name: 'Brand A', customers: [] });
    expect(newProgramRow({ id: null }, snapshot.row, []))
      .toMatchObject({ hubspot_company_id: null, program_name: DEFAULT_PROGRAM_NAME });
  });

  it('files a brand-analysis program under the analyzed site', () => {
    expect(programClientFields({ brandAnalysis: { brand_name: 'Maison Lune', brand_url: 'https://www.maisonlune.fr/' } }))
      .toEqual({ client_name: 'Maison Lune', client_domain: 'maisonlune.fr', client_plan: null });
    expect(programClientFields({}).client_name).toBe('Configuration manuelle');
  });

  it('copies a program into the same folder under a new name', () => {
    const source = { id: 'p1', ...newProgramRow({ hubspotCompanyId: '42' }, snapshot.row, [{ customer_id: 'c1' }]), created_by: 'ana@loyoly.io' };
    const copy = copyProgramRow(source, 'Programme principal (copie)');
    expect(copy).toEqual({
      hubspot_company_id: '42', folder_key: 'hs:42', client_name: 'Brand A', client_domain: 'branda.com', client_plan: 'Premium',
      program_name: 'Programme principal (copie)', step: snapshot.row.step,
      state: snapshot.row.state, customers: [{ customer_id: 'c1' }],
    });
  });
});
