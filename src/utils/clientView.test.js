import { describe, it, expect } from 'vitest';
import { buildProgramDefaults } from '../data/programDefaults';
import { buildClientView, hasUnpublishedChanges, pageSections, pageItems, CLIENT_PAGES, isEditableView } from './clientView';
import { applyProgramOp } from './programOps';

const program = { ...buildProgramDefaults({ aov: 80, grossMargin: 61.7 }), customers: [{ customer_id: 'secret-customer', total_ordered_TTC: 999 }] };
const view = buildClientView(program, { clientName: 'Brand A', brandLogo: 'https://cdn/logo.png' });

describe('client view', () => {
  it('splits the setup sheet into the client pages, Configuration first, in both languages', () => {
    expect(CLIENT_PAGES.map(p => p.key)).toEqual(['config', 'missions', 'rewards', 'referral', 'tiers']);
    expect(pageSections(view, 'fr', 'config')).toEqual([]);
    expect(pageSections(view, 'fr', 'missions').map(s => s.key)).toEqual(['points', 'missions']);
    expect(pageSections(view, 'fr', 'rewards').map(s => s.key)).toEqual(['rewards']);
    expect(pageSections(view, 'en', 'referral').map(s => s.title)).toEqual(['Referral']);
    expect(pageSections(view, 'fr', 'tiers').map(s => s.key)).toEqual(['vip']);
    expect(view.brand).toEqual({ name: 'Brand A', logo: 'https://cdn/logo.png' });
  });

  it('gives every row a ref so comments can target it', () => {
    const missions = pageSections(view, 'fr', 'missions')[1];
    expect(missions.refs).toHaveLength(missions.rows.length);
    expect(missions.refs[0]).toBe('mission:purchase');
    expect(pageItems(view, 'fr', 'tiers')).toEqual([
      { ref: 'tier:0', label: program.tiers[0].name },
      { ref: 'tier:1', label: program.tiers[1].name },
      { ref: 'tier:2', label: program.tiers[2].name },
    ]);
    expect(pageItems(view, 'fr', 'referral').map(i => i.ref)).toEqual(['referral:referrer', 'referral:referee']);
  });

  it('keeps the setup information out of the client pages', () => {
    const withSetup = buildClientView({ ...program, config: { ...program.config, cms: 'shopify', crm: 'klaviyo' } });
    const shown = CLIENT_PAGES.flatMap(p => pageSections(withSetup, 'fr', p.key)).map(s => s.key);
    expect(shown).not.toContain('setup');
    expect(JSON.stringify(withSetup)).not.toContain('Klaviyo');
  });

  it('publishes no internal data', () => {
    const json = JSON.stringify(view);
    for (const internal of ['secret-customer', 'customers', 'realCost', 'grossMargin', 'avgUtilization', 'burnRate', 'cashbackRate', '61.7', '61,7']) {
      expect(json).not.toContain(internal);
    }
  });

  it('only changes when the program does', () => {
    expect(hasUnpublishedChanges(buildClientView(program, { clientName: 'Brand A', brandLogo: 'https://cdn/logo.png' }), view)).toBe(false);
    expect(hasUnpublishedChanges(view, JSON.parse(JSON.stringify(view)))).toBe(false);
    const raised = { ...program, tiers: program.tiers.map((t, i) => (i === 2 ? { ...t, spendThreshold: t.spendThreshold + 100 } : t)) };
    expect(hasUnpublishedChanges(buildClientView(raised, { clientName: 'Brand A', brandLogo: 'https://cdn/logo.png' }), view)).toBe(true);
    expect(hasUnpublishedChanges(view, null)).toBe(true);
  });

  it('ignores the setup answers a brand edit leaves in the published view', () => {
    const edited = { ...view, program: applyProgramOp(view.program, { kind: 'config', field: 'cms', value: 'shopify_plus' }) };
    expect(edited.program.config.cms).toBe('shopify_plus');
    expect(hasUnpublishedChanges(view, edited)).toBe(false);
    const expiry = { ...view, program: applyProgramOp(view.program, { kind: 'config', field: 'expirationMonths', value: 24 }) };
    expect(hasUnpublishedChanges(view, expiry)).toBe(true);
  });

  it('leaves pages empty when the program has no referral or tiers', () => {
    const bare = buildClientView({ ...program, referralConfig: { ...program.referralConfig, enabled: false }, config: { ...program.config, hasTiers: false } });
    expect(pageSections(bare, 'fr', 'referral')).toEqual([]);
    expect(pageSections(bare, 'fr', 'tiers')).toEqual([]);
    expect(pageItems(bare, 'fr', 'tiers')).toEqual([]);
  });
});

describe('editable client view (v2)', () => {
  it('publishes the program structure the brand may edit, nothing internal', () => {
    expect(view.v).toBe(2);
    expect(Object.keys(view.program)).toEqual(['config', 'settings', 'tiers', 'rewards', 'missions', 'customMissions', 'referralConfig']);
    expect(Object.keys(view.program.settings)).toEqual(['aov', 'earnRate', 'earnRateManual']);
    expect(view.program.tiers[0]).not.toHaveProperty('avgUtilization');
    expect(view.program.rewards[0]).not.toHaveProperty('realCost');
    expect(view.program.missions[1]).not.toHaveProperty('completionRate');
  });

  it('rebuilds the pages from the edited program', () => {
    const edited = { ...view, program: applyProgramOp(view.program, { kind: 'tier', index: 2, field: 'spendThreshold', value: 1234 }) };
    const tiers = pageSections(edited, 'fr', 'tiers')[0];
    expect(tiers.rows[2][1].replace(/[\u202f\u00a0]/g, ' ')).toBe('1 234 €');
  });

  it('still shows the views published before v2, read-only', () => {
    const legacy = { v: 1, fr: { sections: [{ key: 'vip', title: 'Programme VIP', rows: [['Or']], refs: ['tier:0'] }] } };
    expect(isEditableView(legacy)).toBe(false);
    expect(isEditableView(view)).toBe(true);
    expect(pageItems(legacy, 'fr', 'tiers')).toEqual([{ ref: 'tier:0', label: 'Or' }]);
  });
});
