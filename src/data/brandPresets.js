import { DEFAULT_MISSIONS } from './defaults';

const DEFAULT_TIER_COLORS = ['#B87333', '#9CA3AF', '#D97706'];

const PROGRAM_TYPE_CONFIG = {
  luxury: {
    tierBasis: 'spend',
    hasMissions: false,
    rewardType: 'perks',
    cashbackRate: 0,
    burnRate: 0,
    thresholds: [100, 40, 10],
    multipliers: [1, 1.5, 2.5],
    rewards: (aov) => [
      { id: 'r1', type: 'experience', nameFr: 'Accès ventes privées', nameEn: 'Private sales access', rewardUsage: 'perk', pointsCost: 0, realCost: Math.round(aov * 0.03), minPurchase: 0 },
      { id: 'r2', type: 'free_delivery', nameFr: 'Livraison premium', nameEn: 'Premium delivery', rewardUsage: 'perk', pointsCost: 0, realCost: 12, minPurchase: 0 },
      { id: 'r3', type: 'experience', nameFr: 'Expérience VIP', nameEn: 'VIP experience', rewardUsage: 'perk', pointsCost: 0, realCost: Math.round(aov * 0.1), minPurchase: 0 },
      { id: 'r4', type: 'free_product', nameFr: 'Cadeau exclusif', nameEn: 'Exclusive gift', rewardUsage: 'perk', pointsCost: 0, realCost: Math.round(aov * 0.15), minPurchase: 0 },
    ],
    missionFilter: () => false,
  },
  mid: {
    tierBasis: 'spend',
    hasMissions: true,
    rewardType: 'both',
    cashbackRate: 3,
    burnRate: 40,
    thresholds: [100, 50, 15],
    multipliers: [1, 1.5, 2],
    rewards: (aov) => [
      { id: 'r1', type: 'free_delivery', nameFr: 'Livraison gratuite', nameEn: 'Free delivery', rewardUsage: 'burn', pointsCost: 200, realCost: 5, minPurchase: 0 },
      { id: 'r2', type: 'promo_percent', nameFr: '-10% sur la commande', nameEn: '-10% off order', rewardUsage: 'burn', pointsCost: 500, realCost: Math.round(aov * 0.1), minPurchase: Math.round(aov * 1.5) },
      { id: 'r3', type: 'gift_voucher', nameFr: `Bon de ${Math.round(aov * 0.15)}€`, nameEn: `${Math.round(aov * 0.15)}€ voucher`, rewardUsage: 'burn', pointsCost: 1000, realCost: Math.round(aov * 0.15), minPurchase: Math.round(aov * 1.5) },
      { id: 'r4', type: 'experience', nameFr: 'Accès avant-première', nameEn: 'Early access', rewardUsage: 'perk', pointsCost: 0, realCost: 2, minPurchase: 0 },
    ],
    missionFilter: (m) => ['referral', 'review', 'birthday', 'first_purchase', 'account_creation'].includes(m.id),
  },
  mass: {
    tierBasis: 'spend',
    hasMissions: true,
    rewardType: 'both',
    cashbackRate: 4,
    burnRate: 50,
    thresholds: [100, 55, 20],
    multipliers: [1, 1.25, 1.75],
    rewards: (aov) => [
      { id: 'r1', type: 'free_delivery', nameFr: 'Livraison gratuite', nameEn: 'Free delivery', rewardUsage: 'burn', pointsCost: 150, realCost: 4, minPurchase: 0 },
      { id: 'r2', type: 'promo_percent', nameFr: '-5% sur la commande', nameEn: '-5% off order', rewardUsage: 'burn', pointsCost: 300, realCost: Math.round(aov * 0.05), minPurchase: Math.round(aov * 1.5) },
      { id: 'r3', type: 'gift_voucher', nameFr: `Bon de ${Math.round(aov * 0.12)}€`, nameEn: `${Math.round(aov * 0.12)}€ voucher`, rewardUsage: 'burn', pointsCost: 800, realCost: Math.round(aov * 0.12), minPurchase: Math.round(aov * 1.5) },
      { id: 'r4', type: 'free_product', nameFr: 'Produit offert', nameEn: 'Free product', rewardUsage: 'perk', pointsCost: 0, realCost: Math.round(aov * 0.2), minPurchase: 0 },
    ],
    missionFilter: () => true,
  },
};

export function applyBrandDefaults(brandAnalysis, lang) {
  const {
    estimated_aov,
    estimated_margin,
    recommended_program,
    suggested_tier_names,
  } = brandAnalysis;

  // Remap cashback → mass (cashback program type removed)
  const effectiveProgram = recommended_program === 'cashback' ? 'mass' : recommended_program;
  const programCfg = PROGRAM_TYPE_CONFIG[effectiveProgram] || PROGRAM_TYPE_CONFIG.mid;
  const aov = estimated_aov || 60;
  const margin = Math.round((estimated_margin || 0.5) * 100);

  const tierNames = (suggested_tier_names?.length === 3)
    ? suggested_tier_names
    : (lang === 'fr' ? ['Bronze', 'Argent', 'Or'] : ['Bronze', 'Silver', 'Gold']);

  const tiers = tierNames.map((name, i) => ({
    name,
    color: DEFAULT_TIER_COLORS[i] || '#8B74FF',
    threshold: programCfg.thresholds[i],
    pointsThreshold: i * 1000,
    pointsMultiplier: programCfg.multipliers[i],
    perks: [],
  }));

  const rawRewards = programCfg.rewards(aov);
  const rewards = rawRewards.map(r => ({
    ...r,
    assignedTiers: tiers.map((_, i) => {
      if (r.rewardUsage === 'perk') return i >= 1;
      return true;
    }),
    utilizationByTier: tiers.map((_, i) => {
      if (r.rewardUsage === 'perk') return i >= 1 ? 30 + i * 10 : 0;
      return 20 + i * 10;
    }),
  }));

  const config = {
    tierBasis: programCfg.tierBasis,
    hasMissions: programCfg.hasMissions,
    rewardType: programCfg.rewardType,
    pointsExpire: true,
    expirationMonths: 12,
    expirationType: 'rolling',
  };

  const settings = {
    segmentationType: 'revenue',
    caWeight: 0.5,
    aov: Math.round(aov),
    grossMargin: margin,
    cashbackRate: programCfg.cashbackRate,
    pointsPerEuro: 100,
  };

  const missions = DEFAULT_MISSIONS
    .filter(m => m.isPurchaseMission || programCfg.missionFilter(m))
    .map(m => ({
      ...m,
      enabled: true,
      engagementByTier: [...(m.engagementByTier || [20, 30, 50])],
    }));

  return { config, settings, tiers, rewards, missions, burnRate: programCfg.burnRate };
}
