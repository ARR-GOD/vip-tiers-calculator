import { buildProgramDefaults } from './programDefaults';

const INDUSTRY_PRESETS = {
  fashion: {
    aov: 85, grossMargin: 55,
    multipliers: [1, 1.5, 2],
    tierNamesFr: ['Bronze', 'Argent', 'Or'], tierNamesEn: ['Bronze', 'Silver', 'Gold'],
  },
  beauty: {
    aov: 55, grossMargin: 65,
    multipliers: [1, 1.5, 2.5],
    tierNamesFr: ['Essentiel', 'Premium', 'Prestige'], tierNamesEn: ['Essential', 'Premium', 'Prestige'],
  },
  food: {
    aov: 45, grossMargin: 40,
    multipliers: [1, 1.25, 1.75],
    tierNamesFr: ['Découverte', 'Gourmet', 'Chef'], tierNamesEn: ['Discovery', 'Gourmet', 'Chef'],
  },
  health: {
    aov: 60, grossMargin: 60,
    multipliers: [1, 1.5, 2],
    tierNamesFr: ['Bien-être', 'Vitalité', 'Élite'], tierNamesEn: ['Wellness', 'Vitality', 'Elite'],
  },
  electronics: {
    aov: 150, grossMargin: 30,
    multipliers: [1, 1.5, 2],
    tierNamesFr: ['Standard', 'Pro', 'Elite'], tierNamesEn: ['Standard', 'Pro', 'Elite'],
  },
  sports: {
    aov: 95, grossMargin: 45,
    multipliers: [1, 1.5, 2],
    tierNamesFr: ['Rookie', 'Athlète', 'Champion'], tierNamesEn: ['Rookie', 'Athlete', 'Champion'],
  },
  home: {
    aov: 120, grossMargin: 45,
    multipliers: [1, 1.25, 1.75],
    tierNamesFr: ['Cocon', 'Intérieur', 'Maison'], tierNamesEn: ['Cozy', 'Interior', 'Home'],
  },
  other: {
    aov: 80, grossMargin: 50,
    multipliers: [1, 1.5, 2],
    tierNamesFr: ['Bronze', 'Argent', 'Or'], tierNamesEn: ['Bronze', 'Silver', 'Gold'],
  },
};

const PRICE_ADJUSTMENTS = {
  low: { aovMult: 0.5 },
  medium: { aovMult: 1 },
  high: { aovMult: 1.5 },
  premium: { aovMult: 3 },
};

const GOAL_ADJUSTMENTS = {
  aov: { multiplierAdd: 0.25 },
};

export function applyOnboardingDefaults(answers, lang) {
  const preset = INDUSTRY_PRESETS[answers.industry] || INDUSTRY_PRESETS.other;
  const priceAdj = PRICE_ADJUSTMENTS[answers.priceRange] || PRICE_ADJUSTMENTS.medium;

  let multiplierBoost = 0;
  (answers.goals || []).forEach(goal => {
    multiplierBoost += GOAL_ADJUSTMENTS[goal]?.multiplierAdd || 0;
  });

  return buildProgramDefaults({
    lang,
    aov: preset.aov * priceAdj.aovMult,
    grossMargin: preset.grossMargin,
    programType: 'mid',
    tierNames: lang === 'fr' ? preset.tierNamesFr : preset.tierNamesEn,
    multipliers: preset.multipliers.map(m => Math.round((m + multiplierBoost) * 100) / 100),
  });
}

export { INDUSTRY_PRESETS };
