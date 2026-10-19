// ════════════════════════════════════════════════════════════════════
// Reward values derived from the program settings
// ════════════════════════════════════════════════════════════════════
//
// Rewards keep the values the CSM typed; anything that depends on another
// setting (margin, AOV, points value) is computed here when read, unless the
// CSM overrode it (realCostAuto / minPurchaseAuto set to false).

import { pointsModel } from './pointsModel';

// Points value used when the program gives nothing back (no cashback).
const FALLBACK_PTS_PER_EUR = 100;

// Parse the discount percentage out of a promo name, e.g. "-20% sur la commande" → 20.
export function parseDiscountPct(name) {
  if (!name) return null;
  const m = String(name).match(/-?\s*(\d+(?:[.,]\d+)?)\s*%/);
  if (!m) return null;
  return parseFloat(m[1].replace(',', '.'));
}

export function rewardMinPurchase(reward, settings) {
  if (reward.minPurchaseAuto) return Number(settings?.aov) || 0;
  return reward.minPurchase || 0;
}

// COGS cost of a percentage coupon: discount% × minPurchase × (1 − margin%).
// Null when the discount can't be parsed or there is no minimum purchase.
export function derivePromoRealCost(reward, settings) {
  if (reward?.type !== 'promo_percent') return null;
  const pct = parseDiscountPct(reward.nameFr) ?? parseDiscountPct(reward.nameEn);
  const minP = rewardMinPurchase(reward, settings);
  if (!pct || pct <= 0 || minP <= 0) return null;
  const cogsRatio = Math.max(0, 1 - (settings?.grossMargin || 0) / 100);
  return Math.round(pct / 100 * minP * cogsRatio * 100) / 100;
}

export function rewardBonusPoints(reward, settings) {
  return Math.round((reward.bonusBasePoints ?? 0) * pointsModel(settings).earnRate);
}

// Price of a reward in points.
export function rewardPointsCost(reward, settings) {
  const ptsPerEur = pointsModel(settings).ptsPerRewardEur ?? FALLBACK_PTS_PER_EUR;
  return Math.round((reward.pointsValueEur ?? 0) * ptsPerEur);
}

export function rewardValueFromPoints(points, settings) {
  const ptsPerEur = pointsModel(settings).ptsPerRewardEur ?? FALLBACK_PTS_PER_EUR;
  return points / ptsPerEur;
}

// What the brand pays each time the reward is used.
export function rewardRealCost(reward, settings) {
  if (reward.realCostAuto !== false) {
    if (reward.type === 'promo_percent') {
      const derived = derivePromoRealCost(reward, settings);
      if (derived !== null) return derived;
    }
    if (reward.type === 'bonus_points') {
      const ptsPerEur = pointsModel(settings).ptsPerRewardEur;
      if (ptsPerEur) return Math.round(rewardBonusPoints(reward, settings) / ptsPerEur * 100) / 100;
    }
  }
  return reward.realCost || 0;
}

export function isRealCostDerived(reward) {
  return reward.realCostAuto !== false && (reward.type === 'promo_percent' || reward.type === 'bonus_points');
}

export const isBurnReward = reward => reward.rewardUsage === 'burn' || reward.rewardUsage === 'both';

// VIP tier perks: rewards given by a tier (points-only rewards are spent, not given).
export const isPerkReward = reward => reward.rewardUsage !== 'burn';

// Moves `fromId` to the place of `toId` among `ids` (a subset of the rewards,
// in display order) and writes that order back into the subset's slots of
// the full list. The rewards' order is the one shown everywhere (tier cards,
// setup sheet, client portal).
export function moveRewardWithin(rewards, ids, fromId, toId) {
  const order = [...ids];
  const from = order.indexOf(fromId);
  const to = order.indexOf(toId);
  if (from < 0 || to < 0 || from === to) return rewards;
  order.splice(to, 0, order.splice(from, 1)[0]);
  const byId = Object.fromEntries(rewards.map(r => [r.id, r]));
  const slots = rewards.map((r, i) => (ids.includes(r.id) ? i : -1)).filter(i => i >= 0);
  const next = [...rewards];
  slots.forEach((slot, k) => { next[slot] = byId[order[k]]; });
  return next;
}
