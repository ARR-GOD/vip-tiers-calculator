import { buildProgramDefaults } from './programDefaults';

const PROGRAM_TYPE_CONFIG = {
  luxury: {
    multipliers: [1, 1.5, 2.5],
  },
  mid: {
    multipliers: [1, 1.5, 2],
  },
  mass: {
    multipliers: [1, 1.25, 1.75],
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

  return buildProgramDefaults({
    lang,
    aov: estimated_aov || 60,
    grossMargin: Math.round((estimated_margin || 0.5) * 100),
    programType: PROGRAM_TYPE_CONFIG[programType] ? programType : 'mid',
    tierNames: suggested_tier_names,
    multipliers: programCfg.multipliers,
  });
}
