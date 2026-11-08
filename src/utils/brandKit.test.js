import { describe, it, expect } from 'vitest';
import { buildKit } from './brandKit';
import { STATE_VERSION, migrateProgramState } from './programStore';
import { normalizeProgram } from '../data/programDefaults';
import { isEditableView, hasUnpublishedChanges, buildClientView } from './clientView';

const analysis = {
  brand_name: 'Lune (site)', brand_url: 'https://www.maisonlune.fr', brand_logo: 'https://cdn/lune.png',
  industry: 'beauty', estimated_aov: 40, estimated_margin: 0.6, recommended_program: 'mid', suggested_tier_names: ['Lune', 'Étoile', 'Soleil'],
};

describe('self-serve onboarding kit', () => {
  it('builds the program from the analysis of the site, under the account brand name', () => {
    const { state, view } = buildKit('Maison Lune', analysis);
    expect(state.v).toBe(STATE_VERSION);
    expect(state.brandAnalysis.brand_name).toBe('Maison Lune');
    expect(state.tiers.map(t => t.name)).toEqual(['Lune', 'Étoile', 'Soleil']);
    expect(state.settings.aov).toBe(40);
    expect(view.v).toBe(2);
    expect(view.brand).toEqual({ name: 'Maison Lune', logo: 'https://cdn/lune.png' });
    expect(isEditableView(view)).toBe(true);
    // what the CSM tool loads publishes the same view: no unpublished change
    const loaded = normalizeProgram(migrateProgramState(JSON.parse(JSON.stringify(state))));
    expect(hasUnpublishedChanges(buildClientView(loaded, { clientName: 'Maison Lune', brandLogo: 'https://cdn/lune.png' }), view)).toBe(false);
  });

  it('falls back to the generic program without analysis, never with internal data in the view', () => {
    const { state, view } = buildKit('Maison Lune', null, 'fr');
    expect(state.brandAnalysis).toEqual({ brand_name: 'Maison Lune' });
    expect(view.brand).toEqual({ name: 'Maison Lune', logo: null });
    expect(view.program.missions.length).toBeGreaterThan(0);
    const json = JSON.stringify(view);
    for (const internal of ['grossMargin', 'realCost', 'completionRate', 'avgUtilization']) expect(json).not.toContain(internal);
  });
});
