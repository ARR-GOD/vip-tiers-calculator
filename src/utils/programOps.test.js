import { describe, it, expect } from 'vitest';
import { applyProgramOp, applyMissionOp } from './programOps';

const program = {
  missions: [{ id: 'purchase', basePoints: 1, enabled: true, isPurchaseMission: true }, { id: 'review_site', basePoints: 70, enabled: true }],
  customMissions: [{ id: 'quiz', basePoints: 20, enabled: true }],
  rewards: [
    { id: 'pts_voucher_10', rewardUsage: 'burn', pointsBase: 100, expirationDays: 90, minPurchase: 0, minPurchaseAuto: true, assignedTiers: [true, true, true] },
    { id: 'perk_voucher_15', rewardUsage: 'perk', assignedTiers: [false, false, true] },
  ],
  tiers: [{ name: 'Bronze', spendThreshold: 0 }, { name: 'Argent', spendThreshold: 400 }, { name: 'Or', spendThreshold: 1600, pointsMultiplier: 2 }],
  referralConfig: { enabled: true, rewardsAuto: true, referrerType: 'fixed', referrerValue: 10 },
};

describe('program ops (brand edits)', () => {
  it('sets mission fields, in the catalog missions or the custom ones', () => {
    let p = applyProgramOp(program, { kind: 'mission', id: 'review_site', field: 'basePoints', value: 100 });
    p = applyProgramOp(p, { kind: 'mission', id: 'quiz', field: 'enabled', value: false });
    expect(p.missions[1].basePoints).toBe(100);
    expect(p.customMissions[0].enabled).toBe(false);
    expect(program.missions[1].basePoints).toBe(70); // the input is not mutated
    expect(applyMissionOp(program.missions, { id: 'quiz', field: 'enabled', value: false })).toBe(program.missions);
  });

  it('sets a reward price, expiration and minimum purchase (no longer auto)', () => {
    let p = applyProgramOp(program, { kind: 'reward', id: 'pts_voucher_10', field: 'pointsBase', value: 160 });
    p = applyProgramOp(p, { kind: 'reward', id: 'pts_voucher_10', field: 'minPurchase', value: 50 });
    p = applyProgramOp(p, { kind: 'reward', id: 'pts_voucher_10', field: 'expirationDays', value: 30 });
    expect(p.rewards[0]).toMatchObject({ pointsBase: 160, minPurchase: 50, minPurchaseAuto: false, expirationDays: 30 });
  });

  it('turns a perk on or off in one tier', () => {
    const p = applyProgramOp(program, { kind: 'perk', id: 'perk_voucher_15', index: 1, field: 'assigned', value: true });
    expect(p.rewards[1].assignedTiers).toEqual([false, true, true]);
  });

  it('sets a tier threshold or multiplier', () => {
    let p = applyProgramOp(program, { kind: 'tier', index: 2, field: 'spendThreshold', value: 1500 });
    p = applyProgramOp(p, { kind: 'tier', index: 2, field: 'pointsMultiplier', value: 2.5 });
    expect(p.tiers[2]).toMatchObject({ spendThreshold: 1500, pointsMultiplier: 2.5 });
  });

  it('patches the referral with whitelisted fields only', () => {
    const p = applyProgramOp(program, { kind: 'referral', field: 'patch', value: { rewardsAuto: false, referrerType: 'fixed', referrerValue: 15, refereeType: 'percent', refereeValue: 10 } });
    expect(p.referralConfig).toEqual({ enabled: true, rewardsAuto: false, referrerType: 'fixed', referrerValue: 15, refereeType: 'percent', refereeValue: 10 });
    expect(() => applyProgramOp(program, { kind: 'referral', field: 'patch', value: { enabled: false } })).toThrow('invalid_op');
    expect(() => applyProgramOp(program, { kind: 'referral', field: 'patch', value: { referrerType: 'gift' } })).toThrow('invalid_value');
  });

  it('refuses anything else', () => {
    const bad = [
      [{ kind: 'mission', id: 'review_site', field: 'completionRate', value: 50 }, 'invalid_op'],
      [{ kind: 'mission', id: 'nope', field: 'enabled', value: true }, 'unknown_item'],
      [{ kind: 'mission', id: 'review_site', field: 'basePoints', value: -1 }, 'invalid_value'],
      [{ kind: 'mission', id: 'review_site', field: 'basePoints', value: '100' }, 'invalid_value'],
      [{ kind: 'reward', id: 'pts_voucher_10', field: 'realCost', value: 1 }, 'invalid_op'],
      [{ kind: 'perk', id: 'perk_voucher_15', index: 1, field: 'assigned', value: 1 }, 'invalid_value'],
      [{ kind: 'tier', index: 3, field: 'spendThreshold', value: 10 }, 'unknown_item'],
      [{ kind: 'tier', index: 0, field: 'avgUtilization', value: 10 }, 'invalid_op'],
      [{ kind: 'tier', index: 0, field: 'pointsMultiplier', value: 0.5 }, 'invalid_value'],
      [{ kind: 'settings', field: 'grossMargin', value: 10 }, 'invalid_op'],
    ];
    bad.forEach(([op, error]) => expect(() => applyProgramOp(program, op)).toThrow(error));
  });
});
