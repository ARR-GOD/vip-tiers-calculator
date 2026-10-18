// ════════════════════════════════════════════════════════════════════
// Program defaults — one builder for every entry point, one normalizer
// ════════════════════════════════════════════════════════════════════
//
// buildProgramDefaults() is used by the three presets (onboarding answers,
// brand analysis, HubSpot client). normalizeProgram() completes any program —
// freshly built or loaded from the database — with the fields the app expects.

import {
  DEFAULT_MISSIONS, DEFAULT_REWARDS, INITIAL_REFERRAL,
  DEFAULT_TIER_COLORS, DEFAULT_TIER_NAMES_FR, DEFAULT_TIER_NAMES_EN,
} from './defaults';

export const INITIAL_CONFIG = {
  tierBasis: 'spend',
  hasMissions: true,    // "Programme à points" — Oui/Non
  hasTiers: true,       // "Paliers VIP" — Oui/Non
  rewardType: 'both',
  // Points expiration (only meaningful when hasMissions)
  pointsExpire: true,
  expirationMonths: 12,
  expirationType: 'rolling',
  // Tier expiration / reassessment (independent of points — applies when hasTiers)
  tiersExpire: true,
  tierExpirationMonths: 12,
  tierExpirationType: 'rolling',
};

export const INITIAL_SETTINGS = {
  segmentationType: 'revenue',
  caWeight: 0.5,
  aov: 60,
  grossMargin: 60,
  cashbackRate: 5,
  earnRate: 1,            // pts per € spent — follows the AOV rule until earnRateManual
  earnRateManual: false,
  scenario: 'medium',     // engagement scenario shared by Missions and Dashboard
  participationRate: 40,  // % of the customer base active in the program (Dashboard)
};

export const INITIAL_TIERS = [
  { name: 'Bronze', color: '#B87333', spendThreshold: 0, orderThreshold: 0, pointsMultiplier: 1 },
  { name: 'Argent', color: '#9CA3AF', spendThreshold: 500, orderThreshold: 3, pointsMultiplier: 1.5 },
  { name: 'Or', color: '#D97706', spendThreshold: 2000, orderThreshold: 10, pointsMultiplier: 2 },
];

// Share of a tier's members who use each of its rewards in a year.
export const defaultTierUtilization = tierIndex => 5 + tierIndex * 5;

// Cashback suggestion from the gross margin:
// margin < 40 → 5%; < 60 → 10%; < 80 → 15%; else → 20%.
export function suggestedCashback(margin) {
  if (!margin || margin < 40) return 5;
  if (margin < 60) return 10;
  if (margin < 80) return 15;
  return 20;
}

// ── Builder ──────────────────────────────────────────────────────────
// rewardTemplates: rewards without tier assignment — burn rewards go to every
// tier, perks to every tier but the first.
export function buildProgramDefaults({
  lang = 'fr',
  aov = 60,
  grossMargin = 50,
  programType = 'mid',
  tierNames,
  multipliers = [1, 1.5, 2],
  rewardTemplates = DEFAULT_REWARDS,
  burnRate = 40,
}) {
  const luxury = programType === 'luxury';
  const names = tierNames?.length === 3
    ? tierNames
    : (lang === 'fr' ? DEFAULT_TIER_NAMES_FR : DEFAULT_TIER_NAMES_EN).slice(0, 3);
  const roundedAov = Math.round(aov) || 60;
  const spendThresholds = [0, roundedAov * 5, roundedAov * 20];
  const orderThresholds = [0, 5, 20];

  const tiers = names.map((name, i) => ({
    name,
    color: DEFAULT_TIER_COLORS[i],
    spendThreshold: spendThresholds[i],
    orderThreshold: orderThresholds[i],
    pointsMultiplier: multipliers[i] ?? 1,
  }));

  const rewards = rewardTemplates.map(r => ({
    ...r,
    assignedTiers: tiers.map((_, i) => r.rewardUsage === 'perk' ? i >= 1 : true),
  }));

  return normalizeProgram({
    config: {
      ...INITIAL_CONFIG,
      hasMissions: !luxury,
      rewardType: luxury ? 'perks' : 'both',
    },
    settings: {
      ...INITIAL_SETTINGS,
      aov: roundedAov,
      grossMargin,
      cashbackRate: luxury ? 0 : suggestedCashback(grossMargin),
    },
    tiers,
    rewards,
    missions: luxury ? DEFAULT_MISSIONS.filter(m => m.isPurchaseMission) : DEFAULT_MISSIONS,
    customMissions: [],
    burnRate: luxury ? 0 : burnRate,
    referralConfig: INITIAL_REFERRAL,
  });
}

// ── Normalizer ───────────────────────────────────────────────────────
function resize(arr, length, fill) {
  return Array.from({ length }, (_, i) => (arr && arr[i] !== undefined ? arr[i] : fill));
}

export function normalizeTier(tier, index) {
  return {
    name: tier.name,
    color: tier.color || DEFAULT_TIER_COLORS[index % DEFAULT_TIER_COLORS.length],
    spendThreshold: tier.spendThreshold ?? 0,
    orderThreshold: tier.orderThreshold ?? 0,
    pointsMultiplier: tier.pointsMultiplier ?? 1,
    avgUtilization: tier.avgUtilization ?? defaultTierUtilization(index),
  };
}

// Legacy fields replaced by derived values are dropped.
function without(obj, keys) {
  const copy = { ...obj };
  keys.forEach(k => delete copy[k]);
  return copy;
}

export function normalizeMission(mission) {
  const engagement = mission.engagementByTier;
  let completionRate = mission.completionRate;
  if (typeof completionRate !== 'number') {
    completionRate = Array.isArray(engagement) && engagement.length > 0
      ? Math.round(engagement.reduce((s, v) => s + (v || 0), 0) / engagement.length)
      : 20;
  }
  return {
    ...without(mission, ['points', 'engagementByTier']),
    basePoints: mission.basePoints ?? mission.points ?? 0,
    frequency: mission.frequency ?? 1,
    enabled: mission.enabled ?? true,
    completionRate,
  };
}

export function normalizeReward(reward, tierCount) {
  const assignedTiers = reward.assignedTiers
    ? resize(reward.assignedTiers, tierCount, false)
    : Array.from({ length: tierCount }, (_, i) => i >= (reward.minTier || 0));
  const derivable = reward.type === 'promo_percent' || reward.type === 'bonus_points';
  return {
    ...without(reward, ['pointsCost', 'pointsBonus', 'utilizationByTier', 'minTier']),
    rewardUsage: reward.rewardUsage || 'burn',
    pointsValueEur: reward.pointsValueEur ?? (reward.pointsCost ?? 0) / 100,
    bonusBasePoints: reward.bonusBasePoints ?? reward.pointsBonus ?? 0,
    realCost: reward.realCost ?? 0,
    realCostAuto: reward.realCostAuto ?? derivable,
    minPurchase: reward.minPurchase ?? 0,
    minPurchaseAuto: reward.minPurchaseAuto ?? false,
    expirationDays: reward.expirationDays ?? 90,
    assignedTiers,
  };
}

export function normalizeProgram(program = {}) {
  const config = { ...INITIAL_CONFIG, ...(program.config || {}) };
  // A points threshold needs a points program.
  if (!config.hasMissions && config.tierBasis === 'points') config.tierBasis = 'spend';

  const tiers = (program.tiers?.length ? program.tiers : INITIAL_TIERS).map(normalizeTier);
  return {
    config,
    settings: { ...INITIAL_SETTINGS, ...(program.settings || {}) },
    tiers,
    rewards: (program.rewards ?? DEFAULT_REWARDS).map(r => normalizeReward(r, tiers.length)),
    missions: (program.missions ?? DEFAULT_MISSIONS).map(normalizeMission),
    customMissions: (program.customMissions ?? []).map(normalizeMission),
    burnRate: program.burnRate ?? 40,
    referralConfig: { ...INITIAL_REFERRAL, ...(program.referralConfig || {}) },
    onboardingAnswers: program.onboardingAnswers ?? null,
    brandAnalysis: program.brandAnalysis ?? null,
  };
}
