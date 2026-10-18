import { buildProgramDefaults } from './programDefaults';

const PROGRAM_TYPE_CONFIG = {
  luxury: {
    burnRate: 0,
    multipliers: [1, 1.5, 2.5],
    rewards: (aov) => [
      { id: 'r1', type: 'experience', nameFr: 'Accès ventes privées', nameEn: 'Private sales access', rewardUsage: 'perk', pointsCost: 0, realCost: Math.round(aov * 0.03), minPurchase: 0 },
      { id: 'r2', type: 'free_delivery', nameFr: 'Livraison premium', nameEn: 'Premium delivery', rewardUsage: 'perk', pointsCost: 0, realCost: 12, minPurchase: 0 },
      { id: 'r3', type: 'experience', nameFr: 'Expérience VIP', nameEn: 'VIP experience', rewardUsage: 'perk', pointsCost: 0, realCost: Math.round(aov * 0.1), minPurchase: 0 },
      { id: 'r4', type: 'free_product', nameFr: 'Cadeau exclusif', nameEn: 'Exclusive gift', rewardUsage: 'perk', pointsCost: 0, realCost: Math.round(aov * 0.15), minPurchase: 0 },
    ],
  },
  mid: {
    burnRate: 40,
    multipliers: [1, 1.5, 2],
    rewards: (aov) => [
      { id: 'r1', type: 'free_delivery', nameFr: 'Livraison gratuite', nameEn: 'Free delivery', rewardUsage: 'burn', pointsCost: 200, realCost: 5, minPurchase: 0 },
      { id: 'r2', type: 'promo_percent', nameFr: '-10% sur la commande', nameEn: '-10% off order', rewardUsage: 'burn', pointsCost: 500, realCost: Math.round(aov * 0.1), minPurchase: Math.round(aov * 1.5) },
      { id: 'r3', type: 'gift_voucher', nameFr: `Bon de ${Math.round(aov * 0.15)}€`, nameEn: `${Math.round(aov * 0.15)}€ voucher`, rewardUsage: 'burn', pointsCost: 1000, realCost: Math.round(aov * 0.15), minPurchase: Math.round(aov * 1.5) },
      { id: 'r4', type: 'experience', nameFr: 'Accès avant-première', nameEn: 'Early access', rewardUsage: 'perk', pointsCost: 0, realCost: 2, minPurchase: 0 },
    ],
  },
  mass: {
    burnRate: 50,
    multipliers: [1, 1.25, 1.75],
    rewards: (aov) => [
      { id: 'r1', type: 'free_delivery', nameFr: 'Livraison gratuite', nameEn: 'Free delivery', rewardUsage: 'burn', pointsCost: 150, realCost: 4, minPurchase: 0 },
      { id: 'r2', type: 'promo_percent', nameFr: '-5% sur la commande', nameEn: '-5% off order', rewardUsage: 'burn', pointsCost: 300, realCost: Math.round(aov * 0.05), minPurchase: Math.round(aov * 1.5) },
      { id: 'r3', type: 'gift_voucher', nameFr: `Bon de ${Math.round(aov * 0.12)}€`, nameEn: `${Math.round(aov * 0.12)}€ voucher`, rewardUsage: 'burn', pointsCost: 800, realCost: Math.round(aov * 0.12), minPurchase: Math.round(aov * 1.5) },
      { id: 'r4', type: 'free_product', nameFr: 'Produit offert', nameEn: 'Free product', rewardUsage: 'perk', pointsCost: 0, realCost: Math.round(aov * 0.2), minPurchase: 0 },
    ],
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
  const programType = recommended_program === 'cashback' ? 'mass' : recommended_program;
  const programCfg = PROGRAM_TYPE_CONFIG[programType] || PROGRAM_TYPE_CONFIG.mid;
  const aov = estimated_aov || 60;

  return buildProgramDefaults({
    lang,
    aov,
    grossMargin: Math.round((estimated_margin || 0.5) * 100),
    programType: PROGRAM_TYPE_CONFIG[programType] ? programType : 'mid',
    tierNames: suggested_tier_names,
    multipliers: programCfg.multipliers,
    rewardTemplates: programCfg.rewards(aov),
    burnRate: programCfg.burnRate,
  });
}
