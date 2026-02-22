import { DEFAULT_MISSIONS } from './defaults';

const INDUSTRY_PRESETS = {
  fashion: {
    cashbackRate: 3, burnRate: 40, aov: 85, grossMargin: 55,
    tierThresholds: [100, 50, 15], multipliers: [1, 1.5, 2],
    tierNamesFr: ['Bronze', 'Argent', 'Or'], tierNamesEn: ['Bronze', 'Silver', 'Gold'],
    rewards: [
      { id: 'r1', type: 'free_delivery', nameFr: 'Livraison gratuite', nameEn: 'Free delivery', rewardUsage: 'burn', pointsCost: 200, realCost: 5, minPurchase: 0 },
      { id: 'r2', type: 'promo_percent', nameFr: '-10% sur la commande', nameEn: '-10% off order', rewardUsage: 'burn', pointsCost: 500, realCost: 8.5, minPurchase: 128 },
      { id: 'r3', type: 'gift_voucher', nameFr: 'Bon de 15€', nameEn: '15€ voucher', rewardUsage: 'burn', pointsCost: 1000, realCost: 15, minPurchase: 128 },
      { id: 'r4', type: 'experience', nameFr: 'Accès ventes privées', nameEn: 'Private sales access', rewardUsage: 'perk', pointsCost: 0, realCost: 2, minPurchase: 0 },
    ],
  },
  beauty: {
    cashbackRate: 4, burnRate: 45, aov: 55, grossMargin: 65,
    tierThresholds: [100, 50, 15], multipliers: [1, 1.5, 2.5],
    tierNamesFr: ['Essentiel', 'Premium', 'Prestige'], tierNamesEn: ['Essential', 'Premium', 'Prestige'],
    rewards: [
      { id: 'r1', type: 'free_delivery', nameFr: 'Livraison gratuite', nameEn: 'Free delivery', rewardUsage: 'burn', pointsCost: 150, realCost: 4, minPurchase: 0 },
      { id: 'r2', type: 'free_product', nameFr: 'Échantillons gratuits', nameEn: 'Free samples', rewardUsage: 'perk', pointsCost: 0, realCost: 3, minPurchase: 0 },
      { id: 'r3', type: 'promo_percent', nameFr: '-15% sur la commande', nameEn: '-15% off order', rewardUsage: 'burn', pointsCost: 600, realCost: 8, minPurchase: 83 },
      { id: 'r4', type: 'experience', nameFr: 'Accès avant-première', nameEn: 'Early access', rewardUsage: 'perk', pointsCost: 0, realCost: 1, minPurchase: 0 },
    ],
  },
  food: {
    cashbackRate: 2, burnRate: 50, aov: 45, grossMargin: 40,
    tierThresholds: [100, 50, 15], multipliers: [1, 1.25, 1.75],
    tierNamesFr: ['Découverte', 'Gourmet', 'Chef'], tierNamesEn: ['Discovery', 'Gourmet', 'Chef'],
    rewards: [
      { id: 'r1', type: 'free_delivery', nameFr: 'Livraison gratuite', nameEn: 'Free delivery', rewardUsage: 'burn', pointsCost: 150, realCost: 5, minPurchase: 0 },
      { id: 'r2', type: 'promo_percent', nameFr: '-5% sur la commande', nameEn: '-5% off order', rewardUsage: 'burn', pointsCost: 300, realCost: 2.25, minPurchase: 68 },
      { id: 'r3', type: 'free_product', nameFr: 'Produit surprise', nameEn: 'Surprise product', rewardUsage: 'perk', pointsCost: 0, realCost: 5, minPurchase: 0 },
      { id: 'r4', type: 'gift_voucher', nameFr: 'Bon de 10€', nameEn: '10€ voucher', rewardUsage: 'burn', pointsCost: 800, realCost: 10, minPurchase: 68 },
    ],
  },
  health: {
    cashbackRate: 3, burnRate: 45, aov: 60, grossMargin: 60,
    tierThresholds: [100, 50, 15], multipliers: [1, 1.5, 2],
    tierNamesFr: ['Bien-être', 'Vitalité', 'Élite'], tierNamesEn: ['Wellness', 'Vitality', 'Elite'],
    rewards: [
      { id: 'r1', type: 'free_delivery', nameFr: 'Livraison gratuite', nameEn: 'Free delivery', rewardUsage: 'burn', pointsCost: 200, realCost: 5, minPurchase: 0 },
      { id: 'r2', type: 'promo_percent', nameFr: '-10% sur la commande', nameEn: '-10% off order', rewardUsage: 'burn', pointsCost: 500, realCost: 6, minPurchase: 90 },
      { id: 'r3', type: 'free_product', nameFr: 'Cure découverte offerte', nameEn: 'Free trial cure', rewardUsage: 'perk', pointsCost: 0, realCost: 12, minPurchase: 0 },
      { id: 'r4', type: 'experience', nameFr: 'Consultation nutrition', nameEn: 'Nutrition consultation', rewardUsage: 'perk', pointsCost: 0, realCost: 8, minPurchase: 0 },
    ],
  },
  electronics: {
    cashbackRate: 2, burnRate: 35, aov: 150, grossMargin: 30,
    tierThresholds: [100, 50, 10], multipliers: [1, 1.5, 2],
    tierNamesFr: ['Standard', 'Pro', 'Elite'], tierNamesEn: ['Standard', 'Pro', 'Elite'],
    rewards: [
      { id: 'r1', type: 'free_delivery', nameFr: 'Livraison express', nameEn: 'Express delivery', rewardUsage: 'perk', pointsCost: 0, realCost: 8, minPurchase: 0 },
      { id: 'r2', type: 'promo_percent', nameFr: '-5% sur accessoires', nameEn: '-5% on accessories', rewardUsage: 'burn', pointsCost: 500, realCost: 7.5, minPurchase: 225 },
      { id: 'r3', type: 'experience', nameFr: 'Extension garantie', nameEn: 'Extended warranty', rewardUsage: 'perk', pointsCost: 0, realCost: 10, minPurchase: 0 },
      { id: 'r4', type: 'gift_voucher', nameFr: 'Bon de 20€', nameEn: '20€ voucher', rewardUsage: 'burn', pointsCost: 1500, realCost: 20, minPurchase: 225 },
    ],
  },
  sports: {
    cashbackRate: 3, burnRate: 40, aov: 95, grossMargin: 45,
    tierThresholds: [100, 50, 15], multipliers: [1, 1.5, 2],
    tierNamesFr: ['Rookie', 'Athlète', 'Champion'], tierNamesEn: ['Rookie', 'Athlete', 'Champion'],
    rewards: [
      { id: 'r1', type: 'free_delivery', nameFr: 'Livraison gratuite', nameEn: 'Free delivery', rewardUsage: 'burn', pointsCost: 200, realCost: 5, minPurchase: 0 },
      { id: 'r2', type: 'promo_percent', nameFr: '-10% sur la commande', nameEn: '-10% off order', rewardUsage: 'burn', pointsCost: 500, realCost: 9.5, minPurchase: 143 },
      { id: 'r3', type: 'experience', nameFr: 'Coaching offert', nameEn: 'Free coaching session', rewardUsage: 'perk', pointsCost: 0, realCost: 15, minPurchase: 0 },
      { id: 'r4', type: 'free_product', nameFr: 'Produit offert', nameEn: 'Free product', rewardUsage: 'perk', pointsCost: 0, realCost: 20, minPurchase: 0 },
    ],
  },
  home: {
    cashbackRate: 2, burnRate: 35, aov: 120, grossMargin: 45,
    tierThresholds: [100, 50, 15], multipliers: [1, 1.25, 1.75],
    tierNamesFr: ['Cocon', 'Intérieur', 'Maison'], tierNamesEn: ['Cozy', 'Interior', 'Home'],
    rewards: [
      { id: 'r1', type: 'free_delivery', nameFr: 'Livraison gratuite', nameEn: 'Free delivery', rewardUsage: 'burn', pointsCost: 250, realCost: 8, minPurchase: 0 },
      { id: 'r2', type: 'promo_percent', nameFr: '-10% sur la commande', nameEn: '-10% off order', rewardUsage: 'burn', pointsCost: 600, realCost: 12, minPurchase: 180 },
      { id: 'r3', type: 'experience', nameFr: 'Conseil déco personnalisé', nameEn: 'Personal deco advice', rewardUsage: 'perk', pointsCost: 0, realCost: 5, minPurchase: 0 },
      { id: 'r4', type: 'gift_voucher', nameFr: 'Bon de 20€', nameEn: '20€ voucher', rewardUsage: 'burn', pointsCost: 1200, realCost: 20, minPurchase: 180 },
    ],
  },
  other: {
    cashbackRate: 3, burnRate: 40, aov: 80, grossMargin: 50,
    tierThresholds: [100, 50, 15], multipliers: [1, 1.5, 2],
    tierNamesFr: ['Bronze', 'Argent', 'Or'], tierNamesEn: ['Bronze', 'Silver', 'Gold'],
    rewards: [
      { id: 'r1', type: 'free_delivery', nameFr: 'Livraison gratuite', nameEn: 'Free delivery', rewardUsage: 'burn', pointsCost: 200, realCost: 5, minPurchase: 0 },
      { id: 'r2', type: 'promo_percent', nameFr: '-10% sur la commande', nameEn: '-10% off order', rewardUsage: 'burn', pointsCost: 500, realCost: 8, minPurchase: 120 },
      { id: 'r3', type: 'gift_voucher', nameFr: 'Bon de 10€', nameEn: '10€ voucher', rewardUsage: 'burn', pointsCost: 1000, realCost: 10, minPurchase: 120 },
      { id: 'r4', type: 'free_product', nameFr: 'Produit mystère', nameEn: 'Mystery product', rewardUsage: 'perk', pointsCost: 0, realCost: 15, minPurchase: 0 },
    ],
  },
};

const DEFAULT_TIER_COLORS = ['#B87333', '#9CA3AF', '#D97706'];

const PRICE_ADJUSTMENTS = {
  low: { aovMult: 0.5, cashbackAdd: 1 },
  medium: { aovMult: 1, cashbackAdd: 0 },
  high: { aovMult: 1.5, cashbackAdd: -0.5 },
  premium: { aovMult: 3, cashbackAdd: -1 },
};

const GOAL_ADJUSTMENTS = {
  retention: { burnRateAdd: 5, hasMissions: true },
  aov: { cashbackAdd: 0.5, multiplierAdd: 0.25 },
  engagement: { hasMissions: true, burnRateAdd: -5 },
  referral: { hasMissions: true, cashbackAdd: 0.5 },
};

export function applyOnboardingDefaults(answers, lang) {
  const preset = INDUSTRY_PRESETS[answers.industry] || INDUSTRY_PRESETS.other;
  const priceAdj = PRICE_ADJUSTMENTS[answers.priceRange] || PRICE_ADJUSTMENTS.medium;

  let cashbackRate = preset.cashbackRate + (priceAdj.cashbackAdd || 0);
  let burnRate = preset.burnRate;
  let hasMissions = true;
  let multiplierBoost = 0;

  if (answers.goals) {
    answers.goals.forEach(goal => {
      const adj = GOAL_ADJUSTMENTS[goal];
      if (adj) {
        if (adj.burnRateAdd) burnRate += adj.burnRateAdd;
        if (adj.cashbackAdd) cashbackRate += adj.cashbackAdd;
        if (adj.multiplierAdd) multiplierBoost += adj.multiplierAdd;
        if (adj.hasMissions !== undefined) hasMissions = adj.hasMissions;
      }
    });
  }

  cashbackRate = Math.max(0.5, Math.min(10, cashbackRate));
  burnRate = Math.max(10, Math.min(80, burnRate));

  const tierNames = lang === 'fr' ? preset.tierNamesFr : preset.tierNamesEn;
  const tiers = tierNames.map((name, i) => ({
    name,
    color: DEFAULT_TIER_COLORS[i] || '#8B74FF',
    threshold: preset.tierThresholds[i],
    pointsThreshold: i * 1000,
    pointsMultiplier: Math.round((preset.multipliers[i] + multiplierBoost) * 100) / 100,
    perks: [],
  }));

  const rewards = preset.rewards.map(r => ({
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
    tierBasis: 'spend',
    hasMissions,
    rewardType: 'both',
    pointsExpire: true,
    expirationMonths: 12,
    expirationType: 'rolling',
  };

  const settings = {
    segmentationType: 'revenue',
    caWeight: 0.5,
    aov: Math.round(preset.aov * priceAdj.aovMult),
    grossMargin: preset.grossMargin,
    cashbackRate,
    pointsPerEuro: 100,
  };

  const missions = DEFAULT_MISSIONS.map(m => ({
    ...m,
    engagementByTier: [...(m.engagementByTier || [20, 30, 50])],
  }));

  return { config, settings, tiers, rewards, missions, burnRate };
}

export { INDUSTRIES, PRICE_RANGES, GOALS } from './defaults';
