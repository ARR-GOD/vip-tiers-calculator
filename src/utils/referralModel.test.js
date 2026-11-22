import { describe, it, expect } from 'vitest';
import { referralRewardForAov, referralExpirationDays, resolveReferral } from './referralModel';
import { normalizeProgram } from '../data/programDefaults';
import { INITIAL_REFERRAL } from '../data/defaults';

describe('referral defaults from the AOV', () => {
  it('picks the reward from the AOV brackets', () => {
    expect(referralRewardForAov(49.99)).toEqual({ type: 'percent', value: 10 });
    expect(referralRewardForAov(50)).toEqual({ type: 'fixed', value: 10 });
    expect(referralRewardForAov(100)).toEqual({ type: 'fixed', value: 15 });
    expect(referralRewardForAov(199)).toEqual({ type: 'fixed', value: 15 });
    expect(referralRewardForAov(200)).toEqual({ type: 'fixed', value: 20 });
  });

  it('sets expirations by reward (referee / referrer)', () => {
    const both = (type, value) => [referralExpirationDays(type, value, 'referee'), referralExpirationDays(type, value, 'referrer')];
    expect(both('percent', 10)).toEqual([7, 14]);
    expect(both('fixed', 5)).toEqual([14, 30]);
    expect(both('fixed', 10)).toEqual([7, 14]);
    expect(both('fixed', 15)).toEqual([7, 14]);
    expect(both('fixed', 20)).toEqual([14, 30]);
  });

  it('follows the AOV while auto, keeps edited values otherwise', () => {
    const auto = resolveReferral(INITIAL_REFERRAL, 120);
    expect([auto.referrerValue, auto.refereeValue, auto.refereeExpirationDays, auto.referrerExpirationDays]).toEqual([15, 15, 7, 14]);
    expect(auto.refereeMinPurchase).toBe(120);
    const edited = resolveReferral({ ...INITIAL_REFERRAL, rewardsAuto: false, referrerValue: 20, refereeValue: 5 }, 120);
    expect([edited.referrerValue, edited.referrerExpirationDays, edited.refereeValue, edited.refereeExpirationDays]).toEqual([20, 30, 5, 14]);
  });

  it('keeps the rewards a CSM chose in programs saved before', () => {
    const p = normalizeProgram({ referralConfig: { enabled: true, referrerType: 'fixed', referrerValue: 25, refereeType: 'percent', refereeValue: 15 } });
    expect(p.referralConfig.rewardsAuto).toBe(false);
    expect(resolveReferral(p.referralConfig, 60).referrerValue).toBe(25);
  });
});
