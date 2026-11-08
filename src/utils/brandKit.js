// ════════════════════════════════════════════════════════════════════
// Self-serve onboarding kit — the program a brand gets at /kit
// ════════════════════════════════════════════════════════════════════

import { applyBrandDefaults } from '../data/brandPresets';
import { normalizeProgram } from '../data/programDefaults';
import { buildProgramSnapshot } from './programStore';
import { buildClientView } from './clientView';

// Suggested from the analysis of the brand's site, or the generic Loyoly
// program; saved like the CSM tool saves its programs (`state`), and
// published for the brand's space (`view`).
export function buildKit(brandName, analysis, lang = 'fr') {
  // Without analysis, the brand name still files the program (CSM saves).
  const brandAnalysis = analysis ? { ...analysis, brand_name: brandName } : { brand_name: brandName };
  const program = normalizeProgram(analysis ? applyBrandDefaults(analysis, lang) : {});
  const { row } = buildProgramSnapshot({ id: null, hubspotCompanyId: null }, {
    ...program, brandAnalysis, selectedClient: null, customers: [], step: 1,
  });
  return {
    state: row.state,
    view: buildClientView(program, { clientName: brandName, brandLogo: analysis?.brand_logo || null }),
  };
}
