// ════════════════════════════════════════════════════════════════════
// Referral rewards — Loyoly defaults indexed on the AOV
// ════════════════════════════════════════════════════════════════════
//
// Same reward for referrer and referee, chosen from the AOV:
//   < 50€ → 10% · 50–100€ → 10€ · 100–200€ → 15€ · ≥ 200€ → 20€
// Expirations depend on the reward (referee / referrer):
//   10% → 7 / 14 days · 5€ → 14 / 30 · 10€ → 7 / 14 · 15€ → 7 / 14 · 20€ → 14 / 30
// The config keeps "auto" flags: while set, the values are derived here when
// read, so they follow the AOV (or the amount) until the CSM edits them.

export function referralRewardForAov(aov) {
  const v = Number(aov) || 0;
  if (v < 50) return { type: 'percent', value: 10 };
  if (v < 100) return { type: 'fixed', value: 10 };
  if (v < 200) return { type: 'fixed', value: 15 };
  return { type: 'fixed', value: 20 };
}

const FIXED_EXPIRATIONS = [
  { value: 5, referee: 14, referrer: 30 },
  { value: 10, referee: 7, referrer: 14 },
  { value: 15, referee: 7, referrer: 14 },
  { value: 20, referee: 14, referrer: 30 },
];

// Days a referral reward stays valid. Unlisted amounts use the closest one.
export function referralExpirationDays(type, value, side) {
  if (type === 'percent') return side === 'referee' ? 7 : 14;
  const closest = FIXED_EXPIRATIONS.reduce((best, row) =>
    Math.abs(row.value - value) < Math.abs(best.value - value) ? row : best);
  return closest[side];
}

// Referral config with every auto value resolved for the given AOV.
export function resolveReferral(config, aov) {
  const c = { ...config };
  if (c.rewardsAuto) {
    const reward = referralRewardForAov(aov);
    c.referrerType = reward.type;
    c.referrerValue = reward.value;
    c.refereeType = reward.type;
    c.refereeValue = reward.value;
  }
  if (c.expirationsAuto) {
    c.referrerExpirationDays = referralExpirationDays(c.referrerType, c.referrerValue, 'referrer');
    c.refereeExpirationDays = referralExpirationDays(c.refereeType, c.refereeValue, 'referee');
  }
  if (c.referrerMinPurchaseAuto) c.referrerMinPurchase = Number(aov) || 0;
  if (c.refereeMinPurchaseAuto) c.refereeMinPurchase = Number(aov) || 0;
  return c;
}

export function formatReferralReward(type, value) {
  return type === 'percent' ? `${value} %` : `${value} €`;
}
