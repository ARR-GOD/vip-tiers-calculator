import { describe, it, expect } from 'vitest';
import {
  assignTiers, computeTierStats, computePointsEconomy, rewardCostByTier, sumRewardCosts,
  thresholdForTierPct, realCostPerPoint,
} from './calculations';

const settings = { aov: 80, grossMargin: 60, cashbackRate: 5, earnRate: 10, earnRateManual: true };
const tiers = [
  { name: 'A', spendThreshold: 0, orderThreshold: 0, pointsMultiplier: 1, avgUtilization: 10 },
  { name: 'B', spendThreshold: 250, orderThreshold: 3, pointsMultiplier: 2, avgUtilization: 20 },
];
const customers = [400, 300, 200, 100].map((rev, i) => ({ customer_id: `c${i}`, total_ordered_TTC: rev, number_of_orders: 2 }));
const statsFor = basis => computeTierStats(assignTiers(customers, tiers, basis, { earnRate: 10 }), tiers);

describe('tier thresholds', () => {
  it('assigns the same tiers on the points basis as on the spend basis', () => {
    expect(statsFor('points').map(s => s.count)).toEqual(statsFor('spend').map(s => s.count));
  });

  it('turns a % of customers on the points basis into a € threshold', () => {
    const threshold = thresholdForTierPct({ customers, tiers, tierIndex: 1, desiredPct: 50, basis: 'points' });
    expect(threshold).toBe(300);
  });
});

describe('reward cost per tier', () => {
  const stats = statsFor('spend'); // A: 2 customers, B: 2 customers
  const both = { rewardUsage: 'both', realCost: 5, assignedTiers: [true, false] };

  it('counts a reward available with points and as a perk once', () => {
    const [a] = rewardCostByTier({ rewards: [both], tiers, tierStats: stats, settings });
    expect(a.totalCost).toBeCloseTo(2 * 5 * 0.10);
  });

  it('applies scenario and participation on top of the tier utilization', () => {
    const rows = rewardCostByTier({ rewards: [both], tiers, tierStats: stats, settings }, { scenarioMultiplier: 1.4, participation: 0.4 });
    expect(sumRewardCosts(rows).totalCost).toBeCloseTo(2 * 5 * 0.14 * 0.4);
  });

  it('gives the tier view and the dashboard the same cost at base scenario and full participation', () => {
    const tierView = rewardCostByTier({ rewards: [both], tiers, tierStats: stats, settings });
    const dashboard = rewardCostByTier({ rewards: [both], tiers, tierStats: stats, settings }, { scenarioMultiplier: 1, participation: 1 });
    expect(dashboard).toEqual(tierView);
  });
});

describe('points economy', () => {
  it('emits revenue × earn rate × tier multiplier, plus missions, and burns the burn rate', () => {
    const stats = statsFor('spend'); // A: 300€, B: 700€
    const missions = [
      { id: 'purchase', isPurchaseMission: true, enabled: true, basePoints: 1, completionRate: 100, frequency: 4 },
      { id: 'review', enabled: true, basePoints: 10, completionRate: 50, frequency: 1 },
    ];
    const eco = computePointsEconomy(stats, tiers, missions, [], settings, 6);
    // purchases: 300×10×1 + 700×10×2 = 17 000 ; review: 4 customers × 50% × 100 pts = 200
    expect(eco.totalEmitted).toBe(17200);
    expect(eco.totalBurned).toBe(Math.round(3100 * 0.06) + Math.round(14100 * 0.06));
  });

  it('values a redeemed point at the catalog real cost', () => {
    const rewards = [{ rewardUsage: 'burn', pointsBase: 200, realCost: 10, assignedTiers: [true, true] }];
    // 10€ reward priced 10 × 200 pts/€ = 2000 pts → 0.005 €/pt
    expect(realCostPerPoint(rewards, settings)).toBeCloseTo(0.005);
    expect(realCostPerPoint([], settings)).toBeNull();
  });
});
