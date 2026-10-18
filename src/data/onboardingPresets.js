import { buildProgramDefaults } from './programDefaults';

const INDUSTRY_PRESETS = {
  fashion: {
    burnRate: 40, aov: 85, grossMargin: 55,
    multipliers: [1, 1.5, 2],
    tierNamesFr: ['Bronze', 'Argent', 'Or'], tierNamesEn: ['Bronze', 'Silver', 'Gold'],
    rewards: [
      { id: 'r1', type: 'free_delivery', nameFr: 'Livraison gratuite', nameEn: 'Free delivery', rewardUsage: 'burn', pointsCost: 200, realCost: 5, minPurchase: 0 },
      { id: 'r2', type: 'promo_percent', nameFr: '-10% sur la commande', nameEn: '-10% off order', rewardUsage: 'burn', pointsCost: 500, realCost: 8.5, minPurchase: 128 },
      { id: 'r3', type: 'gift_voucher', nameFr: 'Bon de 15€', nameEn: '15€ voucher', rewardUsage: 'burn', pointsCost: 1000, realCost: 15, minPurchase: 128 },
      { id: 'r4', type: 'experience', nameFr: 'Accès ventes privées', nameEn: 'Private sales access', rewardUsage: 'perk', pointsCost: 0, realCost: 2, minPurchase: 0 },
    ],
  },
  beauty: {
    burnRate: 45, aov: 55, grossMargin: 65,
    multipliers: [1, 1.5, 2.5],
    tierNamesFr: ['Essentiel', 'Premium', 'Prestige'], tierNamesEn: ['Essential', 'Premium', 'Prestige'],
    rewards: [
      { id: 'r1', type: 'free_delivery', nameFr: 'Livraison gratuite', nameEn: 'Free delivery', rewardUsage: 'burn', pointsCost: 150, realCost: 4, minPurchase: 0 },
      { id: 'r2', type: 'free_product', nameFr: 'Échantillons gratuits', nameEn: 'Free samples', rewardUsage: 'perk', pointsCost: 0, realCost: 3, minPurchase: 0 },
      { id: 'r3', type: 'promo_percent', nameFr: '-15% sur la commande', nameEn: '-15% off order', rewardUsage: 'burn', pointsCost: 600, realCost: 8, minPurchase: 83 },
      { id: 'r4', type: 'experience', nameFr: 'Accès avant-première', nameEn: 'Early access', rewardUsage: 'perk', pointsCost: 0, realCost: 1, minPurchase: 0 },
    ],
  },
  food: {
    burnRate: 50, aov: 45, grossMargin: 40,
    multipliers: [1, 1.25, 1.75],
    tierNamesFr: ['Découverte', 'Gourmet', 'Chef'], tierNamesEn: ['Discovery', 'Gourmet', 'Chef'],
    rewards: [
      { id: 'r1', type: 'free_delivery', nameFr: 'Livraison gratuite', nameEn: 'Free delivery', rewardUsage: 'burn', pointsCost: 150, realCost: 5, minPurchase: 0 },
      { id: 'r2', type: 'promo_percent', nameFr: '-5% sur la commande', nameEn: '-5% off order', rewardUsage: 'burn', pointsCost: 300, realCost: 2.25, minPurchase: 68 },
      { id: 'r3', type: 'free_product', nameFr: 'Produit surprise', nameEn: 'Surprise product', rewardUsage: 'perk', pointsCost: 0, realCost: 5, minPurchase: 0 },
      { id: 'r4', type: 'gift_voucher', nameFr: 'Bon de 10€', nameEn: '10€ voucher', rewardUsage: 'burn', pointsCost: 800, realCost: 10, minPurchase: 68 },
    ],
  },
  health: {
    burnRate: 45, aov: 60, grossMargin: 60,
    multipliers: [1, 1.5, 2],
    tierNamesFr: ['Bien-être', 'Vitalité', 'Élite'], tierNamesEn: ['Wellness', 'Vitality', 'Elite'],
    rewards: [
      { id: 'r1', type: 'free_delivery', nameFr: 'Livraison gratuite', nameEn: 'Free delivery', rewardUsage: 'burn', pointsCost: 200, realCost: 5, minPurchase: 0 },
      { id: 'r2', type: 'promo_percent', nameFr: '-10% sur la commande', nameEn: '-10% off order', rewardUsage: 'burn', pointsCost: 500, realCost: 6, minPurchase: 90 },
      { id: 'r3', type: 'free_product', nameFr: 'Cure découverte offerte', nameEn: 'Free trial cure', rewardUsage: 'perk', pointsCost: 0, realCost: 12, minPurchase: 0 },
      { id: 'r4', type: 'experience', nameFr: 'Consultation nutrition', nameEn: 'Nutrition consultation', rewardUsage: 'perk', pointsCost: 0, realCost: 8, minPurchase: 0 },
    ],
  },
  electronics: {
    burnRate: 35, aov: 150, grossMargin: 30,
    multipliers: [1, 1.5, 2],
    tierNamesFr: ['Standard', 'Pro', 'Elite'], tierNamesEn: ['Standard', 'Pro', 'Elite'],
    rewards: [
      { id: 'r1', type: 'free_delivery', nameFr: 'Livraison express', nameEn: 'Express delivery', rewardUsage: 'perk', pointsCost: 0, realCost: 8, minPurchase: 0 },
      { id: 'r2', type: 'promo_percent', nameFr: '-5% sur accessoires', nameEn: '-5% on accessories', rewardUsage: 'burn', pointsCost: 500, realCost: 7.5, minPurchase: 225 },
      { id: 'r3', type: 'experience', nameFr: 'Extension garantie', nameEn: 'Extended warranty', rewardUsage: 'perk', pointsCost: 0, realCost: 10, minPurchase: 0 },
      { id: 'r4', type: 'gift_voucher', nameFr: 'Bon de 20€', nameEn: '20€ voucher', rewardUsage: 'burn', pointsCost: 1500, realCost: 20, minPurchase: 225 },
    ],
  },
  sports: {
    burnRate: 40, aov: 95, grossMargin: 45,
    multipliers: [1, 1.5, 2],
    tierNamesFr: ['Rookie', 'Athlète', 'Champion'], tierNamesEn: ['Rookie', 'Athlete', 'Champion'],
    rewards: [
      { id: 'r1', type: 'free_delivery', nameFr: 'Livraison gratuite', nameEn: 'Free delivery', rewardUsage: 'burn', pointsCost: 200, realCost: 5, minPurchase: 0 },
      { id: 'r2', type: 'promo_percent', nameFr: '-10% sur la commande', nameEn: '-10% off order', rewardUsage: 'burn', pointsCost: 500, realCost: 9.5, minPurchase: 143 },
      { id: 'r3', type: 'experience', nameFr: 'Coaching offert', nameEn: 'Free coaching session', rewardUsage: 'perk', pointsCost: 0, realCost: 15, minPurchase: 0 },
      { id: 'r4', type: 'free_product', nameFr: 'Produit offert', nameEn: 'Free product', rewardUsage: 'perk', pointsCost: 0, realCost: 20, minPurchase: 0 },
    ],
  },
  home: {
    burnRate: 35, aov: 120, grossMargin: 45,
    multipliers: [1, 1.25, 1.75],
    tierNamesFr: ['Cocon', 'Intérieur', 'Maison'], tierNamesEn: ['Cozy', 'Interior', 'Home'],
    rewards: [
      { id: 'r1', type: 'free_delivery', nameFr: 'Livraison gratuite', nameEn: 'Free delivery', rewardUsage: 'burn', pointsCost: 250, realCost: 8, minPurchase: 0 },
      { id: 'r2', type: 'promo_percent', nameFr: '-10% sur la commande', nameEn: '-10% off order', rewardUsage: 'burn', pointsCost: 600, realCost: 12, minPurchase: 180 },
      { id: 'r3', type: 'experience', nameFr: 'Conseil déco personnalisé', nameEn: 'Personal deco advice', rewardUsage: 'perk', pointsCost: 0, realCost: 5, minPurchase: 0 },
      { id: 'r4', type: 'gift_voucher', nameFr: 'Bon de 20€', nameEn: '20€ voucher', rewardUsage: 'burn', pointsCost: 1200, realCost: 20, minPurchase: 180 },
    ],
  },
  other: {
    burnRate: 40, aov: 80, grossMargin: 50,
    multipliers: [1, 1.5, 2],
    tierNamesFr: ['Bronze', 'Argent', 'Or'], tierNamesEn: ['Bronze', 'Silver', 'Gold'],
    rewards: [
      { id: 'r1', type: 'free_delivery', nameFr: 'Livraison gratuite', nameEn: 'Free delivery', rewardUsage: 'burn', pointsCost: 200, realCost: 5, minPurchase: 0 },
      { id: 'r2', type: 'promo_percent', nameFr: '-10% sur la commande', nameEn: '-10% off order', rewardUsage: 'burn', pointsCost: 500, realCost: 8, minPurchase: 120 },
      { id: 'r3', type: 'gift_voucher', nameFr: 'Bon de 10€', nameEn: '10€ voucher', rewardUsage: 'burn', pointsCost: 1000, realCost: 10, minPurchase: 120 },
      { id: 'r4', type: 'free_product', nameFr: 'Produit mystère', nameEn: 'Mystery product', rewardUsage: 'perk', pointsCost: 0, realCost: 15, minPurchase: 0 },
    ],
  },
};

const PRICE_ADJUSTMENTS = {
  low: { aovMult: 0.5 },
  medium: { aovMult: 1 },
  high: { aovMult: 1.5 },
  premium: { aovMult: 3 },
};

const GOAL_ADJUSTMENTS = {
  retention: { burnRateAdd: 5 },
  aov: { multiplierAdd: 0.25 },
  engagement: { burnRateAdd: -5 },
  referral: {},
};

export function applyOnboardingDefaults(answers, lang) {
  const preset = INDUSTRY_PRESETS[answers.industry] || INDUSTRY_PRESETS.other;
  const priceAdj = PRICE_ADJUSTMENTS[answers.priceRange] || PRICE_ADJUSTMENTS.medium;

  let burnRate = preset.burnRate;
  let multiplierBoost = 0;
  (answers.goals || []).forEach(goal => {
    const adj = GOAL_ADJUSTMENTS[goal];
    if (adj?.burnRateAdd) burnRate += adj.burnRateAdd;
    if (adj?.multiplierAdd) multiplierBoost += adj.multiplierAdd;
  });

  return buildProgramDefaults({
    lang,
    aov: preset.aov * priceAdj.aovMult,
    grossMargin: preset.grossMargin,
    programType: 'mid',
    tierNames: lang === 'fr' ? preset.tierNamesFr : preset.tierNamesEn,
    multipliers: preset.multipliers.map(m => Math.round((m + multiplierBoost) * 100) / 100),
    rewardTemplates: preset.rewards,
    burnRate: Math.max(0, Math.min(80, burnRate)),
  });
}

export { INDUSTRY_PRESETS };
