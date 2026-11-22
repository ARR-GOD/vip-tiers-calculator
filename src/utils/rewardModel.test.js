import { describe, it, expect } from 'vitest';
import { moveRewardWithin, isPerkReward } from './rewardModel';

const rewards = ['pts_a', 'perk_a', 'pts_b', 'perk_b', 'perk_c', 'perk_d'].map(id => ({ id, rewardUsage: id.startsWith('pts') ? 'burn' : 'perk' }));
const ids = list => list.map(r => r.id);

describe('reordering tier perks', () => {
  it('keeps points rewards out of the tier perks', () => {
    expect(rewards.filter(isPerkReward).map(r => r.id)).toEqual(['perk_a', 'perk_b', 'perk_c', 'perk_d']);
    expect(isPerkReward({ rewardUsage: 'both' })).toBe(true);
  });

  it('moves a perk up or down among the shown ones, other rewards stay in place', () => {
    const shown = ['perk_a', 'perk_c', 'perk_d']; // perk_b is not in this tier
    expect(ids(moveRewardWithin(rewards, shown, 'perk_d', 'perk_c'))).toEqual(['pts_a', 'perk_a', 'pts_b', 'perk_b', 'perk_d', 'perk_c']);
    expect(ids(moveRewardWithin(rewards, shown, 'perk_a', 'perk_c'))).toEqual(['pts_a', 'perk_c', 'pts_b', 'perk_b', 'perk_a', 'perk_d']);
  });

  it('drops a perk at the place of another (drag and drop)', () => {
    const shown = ['perk_a', 'perk_b', 'perk_c', 'perk_d'];
    expect(ids(moveRewardWithin(rewards, shown, 'perk_d', 'perk_a'))).toEqual(['pts_a', 'perk_d', 'pts_b', 'perk_a', 'perk_b', 'perk_c']);
    expect(ids(moveRewardWithin(rewards, shown, 'perk_a', 'perk_d'))).toEqual(['pts_a', 'perk_b', 'pts_b', 'perk_c', 'perk_d', 'perk_a']);
  });

  it('ignores unknown ids and moves onto itself', () => {
    expect(moveRewardWithin(rewards, ['perk_a'], 'perk_a', 'perk_a')).toBe(rewards);
    expect(moveRewardWithin(rewards, ['perk_a'], 'perk_a', 'nope')).toBe(rewards);
  });
});
