import { describe, it, expect } from 'vitest';
import { buildProgramDefaults } from '../data/programDefaults';
import { buildClientView, hasUnpublishedChanges, pageSections, pageItems, CLIENT_PAGES } from './clientView';

const program = { ...buildProgramDefaults({ aov: 80, grossMargin: 61.7 }), customers: [{ customer_id: 'secret-customer', total_ordered_TTC: 999 }] };
const view = buildClientView(program, { clientName: 'Brand A', brandLogo: 'https://cdn/logo.png' });

describe('client view', () => {
  it('splits the setup sheet into the four client pages, in both languages', () => {
    expect(CLIENT_PAGES.map(p => p.key)).toEqual(['missions', 'rewards', 'referral', 'tiers']);
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

  it('leaves pages empty when the program has no referral or tiers', () => {
    const bare = buildClientView({ ...program, referralConfig: { ...program.referralConfig, enabled: false }, config: { ...program.config, hasTiers: false } });
    expect(pageSections(bare, 'fr', 'referral')).toEqual([]);
    expect(pageSections(bare, 'fr', 'tiers')).toEqual([]);
    expect(pageItems(bare, 'fr', 'tiers')).toEqual([]);
  });
});
