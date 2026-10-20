import { describe, it, expect } from 'vitest';
import { defaultEarnRate, pointsModel, missionPoints, basePointsFromPoints } from './pointsModel';
import { rewardPointsCost, rewardBaseFromPoints, rewardRealCost, rewardMinPurchase } from './rewardModel';

describe('earn rate', () => {
  it('follows the AOV rule: ≥ 50€ → 1 pt/€, below → 10 pts/€', () => {
    expect(defaultEarnRate(49.99)).toBe(10);
    expect(defaultEarnRate(50)).toBe(1);
    expect(defaultEarnRate(undefined)).toBe(10);
  });

  it('uses the chosen rate only once it was picked manually', () => {
    expect(pointsModel({ aov: 80, earnRate: 5, earnRateManual: false }).earnRate).toBe(1);
    expect(pointsModel({ aov: 80, earnRate: 5, earnRateManual: true }).earnRate).toBe(5);
  });

  it('no longer depends on a cashback rate', () => {
    expect(pointsModel({ aov: 80, cashbackRate: 5 })).toEqual({ earnRate: 1 });
  });
});

describe('derived points', () => {
  const mission = { basePoints: 20 };
  const reward = { pointsBase: 200 };
  const at = earnRate => ({ aov: 80, earnRate, earnRateManual: true });

  it('scales mission points and reward prices with the earn rate', () => {
    expect(missionPoints(mission, at(1))).toBe(20);
    expect(missionPoints(mission, at(5))).toBe(100);
    expect(missionPoints(mission, at(10))).toBe(200);
    expect(rewardPointsCost(reward, at(1))).toBe(200);
    expect(rewardPointsCost(reward, at(10))).toBe(2000);
  });

  it('switching 1 → 10 → 1 pt/€ leaves stored values untouched', () => {
    const before = JSON.stringify({ mission, reward });
    [1, 10, 1].forEach(rate => {
      missionPoints(mission, at(rate));
      rewardPointsCost(reward, at(rate));
    });
    expect(JSON.stringify({ mission, reward })).toBe(before);
    expect(missionPoints(mission, at(1))).toBe(20);
  });

  it('converts typed points back to reference values', () => {
    expect(basePointsFromPoints(350, at(5))).toBe(70);
    expect(rewardBaseFromPoints(2000, at(10))).toBe(200);
  });
});

describe('reward values', () => {
  const settings = { aov: 90, grossMargin: 60 };

  it('derives the cost of a % promo from the margin while auto', () => {
    const promo = { type: 'promo_percent', nameFr: '-10% sur la commande', minPurchase: 100, realCost: 99 };
    expect(rewardRealCost(promo, settings)).toBe(4);
    expect(rewardRealCost({ ...promo, realCostAuto: false }, settings)).toBe(99);
  });

  it('uses the AOV as minimum purchase while auto', () => {
    expect(rewardMinPurchase({ minPurchase: 40, minPurchaseAuto: true }, settings)).toBe(90);
    expect(rewardMinPurchase({ minPurchase: 40, minPurchaseAuto: false }, settings)).toBe(40);
  });
});
