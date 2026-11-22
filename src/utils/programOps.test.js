import { describe, it, expect } from 'vitest';
import { applyProgramOp, applyMissionOp, replayProgramOps, isLaterThan } from './programOps';

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

  it('adds and removes missions, catalog or custom', () => {
    const add = { kind: 'mission', field: 'add', list: 'missions', value: { id: 'review_google', icon: '⭐', nameFr: 'Déposez un avis Google', nameEn: 'Leave a Google review', category: 'avis', basePoints: 70, enabled: true } };
    let p = applyProgramOp(program, add);
    p = applyProgramOp(p, { kind: 'mission', field: 'add', list: 'customMissions', value: { id: 'm_ab12', nameFr: 'Venez au salon', basePoints: 50, enabled: true } });
    expect(p.missions.at(-1)).toEqual(add.value);
    expect(p.customMissions.map(m => m.id)).toEqual(['quiz', 'm_ab12']);
    expect(() => applyProgramOp(p, add)).toThrow('duplicate_item');
    p = applyProgramOp(p, { kind: 'mission', id: 'quiz', field: 'remove' });
    p = applyProgramOp(p, { kind: 'mission', id: 'review_site', field: 'remove' });
    expect(p.missions.map(m => m.id)).toEqual(['purchase', 'review_google']);
    expect(p.customMissions.map(m => m.id)).toEqual(['m_ab12']);
    expect(() => applyProgramOp(p, { kind: 'mission', id: 'quiz', field: 'remove' })).toThrow('unknown_item');
  });

  it('adds a points reward or a perk, sized to the tiers, and removes rewards', () => {
    let p = applyProgramOp(program, { kind: 'reward', field: 'add', value: { id: 'r_1', type: 'gift_voucher', nameFr: 'Bon de 20 €', rewardUsage: 'burn', pointsBase: 200, expirationDays: 90, minPurchase: 0, minPurchaseAuto: true, assignedTiers: [true, true, true, true] } });
    p = applyProgramOp(p, { kind: 'reward', field: 'add', value: { id: 'r_2', type: 'experience', nameFr: 'Atelier VIP', rewardUsage: 'perk', pointsBase: 0, assignedTiers: [false, true] } });
    expect(p.rewards.find(r => r.id === 'r_1').assignedTiers).toEqual([true, true, true]);
    expect(p.rewards.find(r => r.id === 'r_2').assignedTiers).toEqual([false, true, false]);
    p = applyProgramOp(p, { kind: 'reward', id: 'pts_voucher_10', field: 'remove' });
    expect(p.rewards.map(r => r.id)).toEqual(['perk_voucher_15', 'r_1', 'r_2']);
  });

  it('adds a top tier keeping the perks of the tier below, removes a tier with its column', () => {
    let p = applyProgramOp(program, { kind: 'tier', index: 3, field: 'add', value: { name: 'Platine', color: '#7C3AED', spendThreshold: 3000, pointsMultiplier: 3 } });
    expect(p.tiers.map(t => t.name)).toEqual(['Bronze', 'Argent', 'Or', 'Platine']);
    expect(p.rewards.map(r => r.assignedTiers)).toEqual([[true, true, true, true], [false, false, true, true]]);
    expect(() => applyProgramOp(p, { kind: 'tier', index: 3, field: 'add', value: { name: 'X' } })).toThrow('conflict');
    p = applyProgramOp(p, { kind: 'tier', index: 1, name: 'Argent', field: 'remove' });
    expect(p.tiers.map(t => t.name)).toEqual(['Bronze', 'Or', 'Platine']);
    expect(p.rewards.map(r => r.assignedTiers)).toEqual([[true, true, true], [false, true, true]]);
    expect(() => applyProgramOp(p, { kind: 'tier', index: 1, name: 'Argent', field: 'remove' })).toThrow('unknown_item');
    p = applyProgramOp(p, { kind: 'tier', index: 2, name: 'Platine', field: 'remove' });
    expect(() => applyProgramOp(p, { kind: 'tier', index: 0, name: 'Bronze', field: 'remove' })).toThrow('invalid_op');
  });

  it('replays ops in order, skipping those that no longer apply', () => {
    const p = replayProgramOps(program, [
      { kind: 'mission', id: 'quiz', field: 'remove' },
      { kind: 'mission', id: 'quiz', field: 'enabled', value: false },
      { kind: 'mission', id: 'review_site', field: 'basePoints', value: 90 },
    ]);
    expect(p.customMissions).toEqual([]);
    expect(p.missions[1].basePoints).toBe(90);
  });

  it('compares activity times to the microsecond', () => {
    expect(isLaterThan('2026-11-08T10:00:00.000002+00:00', '2026-11-08T10:00:00.000001+00:00')).toBe(true);
    expect(isLaterThan('2026-11-08T10:00:00.000001+00:00', '2026-11-08T10:00:00.000001+00:00')).toBe(false);
    expect(isLaterThan('2026-11-08T11:00:00+01:00', '2026-11-08T09:59:59.9+00:00')).toBe(true);
    expect(isLaterThan('2026-11-08T10:00:00Z', null)).toBe(true);
  });

  it('sets the configuration: setup answers, points and tier settings, earn rate', () => {
    let p = applyProgramOp({ ...program, config: { hasMissions: true, tierBasis: 'spend' }, settings: { aov: 40, earnRate: 1 } },
      { kind: 'config', field: 'cms', value: 'prestashop' });
    p = applyProgramOp(p, { kind: 'config', field: 'international', value: true });
    p = applyProgramOp(p, { kind: 'config', field: 'expirationMonths', value: 24 });
    p = applyProgramOp(p, { kind: 'config', field: 'tierBasis', value: 'points' });
    p = applyProgramOp(p, { kind: 'settings', field: 'earnRate', value: 5 });
    expect(p.config).toEqual({ hasMissions: true, tierBasis: 'points', cms: 'prestashop', international: true, expirationMonths: 24 });
    expect(p.settings).toEqual({ aov: 40, earnRate: 5, earnRateManual: true });
    expect(applyProgramOp(p, { kind: 'settings', field: 'earnRate', value: null }).settings).toEqual({ aov: 40, earnRate: 5, earnRateManual: false });
    expect(() => applyProgramOp({ config: { hasMissions: false } }, { kind: 'config', field: 'tierBasis', value: 'points' })).toThrow('invalid_value');
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
      [{ kind: 'mission', field: 'add', list: 'tiers', value: { id: 'x', nameFr: 'X', basePoints: 1, enabled: true } }, 'invalid_op'],
      [{ kind: 'mission', field: 'add', list: 'missions', value: { id: 'x', nameFr: 'X', basePoints: 1, enabled: true, completionRate: 90 } }, 'invalid_op'],
      [{ kind: 'mission', field: 'add', list: 'missions', value: { id: 'x', nameFr: 'X', enabled: true } }, 'invalid_op'],
      [{ kind: 'mission', field: 'add', list: 'missions', value: { id: 'x y', nameFr: 'X', basePoints: 1, enabled: true } }, 'invalid_value'],
      [{ kind: 'mission', field: 'add', list: 'missions', value: { id: 'x', nameFr: '', basePoints: 1, enabled: true } }, 'invalid_value'],
      [{ kind: 'reward', field: 'add', value: { id: 'r', type: 'gift_voucher', nameFr: 'X', rewardUsage: 'burn', pointsBase: 1, assignedTiers: [true], realCost: 0 } }, 'invalid_op'],
      [{ kind: 'reward', field: 'add', value: { id: 'r', type: 'cash', nameFr: 'X', rewardUsage: 'burn', pointsBase: 1, assignedTiers: [true] } }, 'invalid_value'],
      [{ kind: 'reward', field: 'add', value: { id: 'r', type: 'gift_voucher', nameFr: 'X', rewardUsage: 'burn', pointsBase: 1, assignedTiers: [1] } }, 'invalid_value'],
      [{ kind: 'reward', id: 'nope', field: 'remove' }, 'unknown_item'],
      [{ kind: 'tier', index: 2, field: 'add', value: { name: 'X' } }, 'conflict'],
      [{ kind: 'tier', index: 3, field: 'add', value: { name: 'X', pointsMultiplier: 20 } }, 'invalid_value'],
      [{ kind: 'tier', index: 3, field: 'add', value: { name: 'X', avgUtilization: 5 } }, 'invalid_op'],
      [{ kind: 'tier', index: 0, name: 'Or', field: 'remove' }, 'unknown_item'],
      [{ kind: 'config', field: 'grossMargin', value: 10 }, 'invalid_op'],
      [{ kind: 'config', field: 'hasMissions', value: false }, 'invalid_op'],
      [{ kind: 'config', field: 'toString', value: 'x' }, 'invalid_op'],
      [{ kind: 'config', field: 'cms', value: 'wix' }, 'invalid_value'],
      [{ kind: 'config', field: 'cms', value: null }, 'invalid_value'],
      [{ kind: 'config', field: 'international', value: 'yes' }, 'invalid_value'],
      [{ kind: 'config', field: 'expirationMonths', value: 6.5 }, 'invalid_value'],
      [{ kind: 'config', field: 'expirationMonths', value: 0 }, 'invalid_value'],
      [{ kind: 'settings', field: 'earnRate', value: 3 }, 'invalid_value'],
      [{ kind: 'settings', field: 'aov', value: 80 }, 'invalid_op'],
    ];
    bad.forEach(([op, error]) => expect(() => applyProgramOp(program, op)).toThrow(error));
  });
});
