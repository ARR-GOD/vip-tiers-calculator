import { describe, it, expect } from 'vitest';
import { buildProgramDefaults } from '../data/programDefaults';
import { buildSetupSheet, setupSheetMarkdown } from './setupSheet';

const date = new Date('2026-10-18T12:00:00Z');
const sheetFor = (program, extra = {}) => buildSetupSheet({ ...program, date, ...extra });
const section = (sheet, title) => sheet.sections.find(s => s.title === title);
// fr-FR numbers use narrow no-break spaces as thousands separators.
const plain = value => JSON.parse(JSON.stringify(value).replace(/[\u202f\u00a0]/g, ' '));

describe('setup sheet', () => {
  const program = buildProgramDefaults({ aov: 80, grossMargin: 60 });
  const sheet = sheetFor(program, { clientName: 'Dynveo', author: 'Thomas' });

  it('names the client, the date and the author', () => {
    expect(sheet.title).toBe('Fiche de setup — Dynveo');
    expect(sheet.subtitle).toBe('18 octobre 2026 · Préparée par Thomas');
    expect(sheet.sections.map(s => s.title)).toEqual([
      'Programme de points', 'Missions', 'Récompenses en points', 'Parrainage', 'Programme VIP',
    ]);
  });

  it('gives the points ratio and their expiration (no points value)', () => {
    expect(section(sheet, 'Programme de points').facts).toEqual([
      ['Points gagnés', '1 pt par € dépensé'],
      ['Expiration des points', '12 mois glissants'],
    ]);
  });

  it('lists the enabled missions with points that follow the earn rate', () => {
    const missions = [...program.missions];
    missions[1] = { ...missions[1], enabled: false };
    const at10 = sheetFor({ ...program, missions, settings: { ...program.settings, earnRate: 10, earnRateManual: true } });
    const rows = section(at10, 'Missions').rows;
    expect(rows).toHaveLength(program.missions.length - 1);
    expect(rows[0]).toEqual(['Réalisez un achat', '10 pts par € dépensé']);
    expect(rows).toContainEqual(['Déposez un avis sur le site', '700 pts']);
    expect(rows.map(r => r[0])).not.toContain('Créez un compte client');
  });

  it('lists the points rewards with points, expiration, minimum purchase and tiers', () => {
    const rows = section(sheet, 'Récompenses en points').rows;
    expect(rows).toContainEqual(['Bon de 10 € (points)', '100 pts', '90 jours', '80 €', 'tous']);
    const rewards = program.rewards.map(r => (r.id === 'pts_voucher_5' ? { ...r, assignedTiers: [false, true, true] } : r));
    expect(section(sheetFor({ ...program, rewards }), 'Récompenses en points').rows)
      .toContainEqual(['Bon de 5 € (points)', '50 pts', '90 jours', '80 €', 'Argent, Or']);
  });

  it('gives the referral rewards resolved from the AOV', () => {
    expect(section(sheet, 'Parrainage').rows).toEqual([
      ['Parrain', '10 €', '80 €', '14 jours'],
      ['Filleul', '10 €', '80 €', '7 jours'],
    ]);
    const disabled = sheetFor({ ...program, referralConfig: { ...program.referralConfig, enabled: false } });
    expect(section(disabled, 'Parrainage')).toBeUndefined();
  });

  it('gives each VIP tier its threshold, multiplier and cumulative perks', () => {
    const vip = plain(section(sheet, 'Programme VIP'));
    expect(vip.facts).toEqual([
      ['Format', 'Montant dépensé (€)'],
      ['Réévaluation des paliers', 'tous les 12 mois glissants'],
    ]);
    expect(vip.rows.map(r => r.slice(0, 3))).toEqual([
      ['Bronze', '0 €', '×1'], ['Argent', '400 €', '×1,5'], ['Or', '1 600 €', '×2'],
    ]);
    expect(vip.rows[0][3]).toEqual([
      'Livraison gratuite (achat minimum : 80 €, expiration : 90 jours)',
      'Anniversaire 5 € (achat minimum : 80 €, expiration : 90 jours)',
    ]);
    expect(vip.rows[2][3]).toContain('Accès ventes privées (sans achat minimum, expiration : 90 jours)');
  });

  it('shows points thresholds at the program earn rate', () => {
    const points = sheetFor({
      ...program,
      config: { ...program.config, tierBasis: 'points' },
      settings: { ...program.settings, earnRate: 10, earnRateManual: true },
    });
    const vip = plain(section(points, 'Programme VIP'));
    expect(vip.facts[0]).toEqual(['Format', 'Points cumulés']);
    expect(vip.rows.map(r => r[1])).toEqual(['0 pts', '4 000 pts', '16 000 pts']);
  });

  it('keeps a no-points program to its referral and VIP status', () => {
    const luxury = sheetFor(buildProgramDefaults({ aov: 300, grossMargin: 70, programType: 'luxury', lang: 'en' }), { lang: 'en' });
    expect(luxury.title).toBe('Setup sheet — Loyoly');
    expect(luxury.sections.map(s => s.title)).toEqual(['Points program', 'Referral', 'VIP program']);
    expect(luxury.sections[0].note).toBe('No-points program: VIP status only.');
    expect(section(luxury, 'VIP program').columns).toEqual(['Tier', 'Threshold', 'Tier rewards']);
  });
});

describe('setup sheet as Markdown', () => {
  const sheet = sheetFor(buildProgramDefaults({ aov: 80, grossMargin: 60 }), { clientName: 'Dynveo' });
  const md = setupSheetMarkdown(sheet);

  it('renders every section as a heading with its facts and table', () => {
    expect(md.startsWith('# Fiche de setup — Dynveo\n\n18 octobre 2026\n')).toBe(true);
    expect(md).toContain('## Missions\n\n| Mission | Points |\n| --- | --- |\n| Réalisez un achat | 1 pt par € dépensé |');
    expect(md).toContain('- **Points gagnés** : 1 pt par € dépensé');
    expect(md).toContain('| Filleul | 10 € | 80 € | 7 jours |');
  });

  it('joins list cells and keeps pipes from breaking the tables', () => {
    const custom = { ...sheet, sections: [{ title: 'T', columns: ['A', 'B'], rows: [['x | y', ['one', 'two']]] }, { title: 'E', columns: ['A'], rows: [] }] };
    expect(setupSheetMarkdown(custom)).toContain('| x / y | one ; two |');
    expect(setupSheetMarkdown(custom)).toContain('## E\n\n—');
  });
});
