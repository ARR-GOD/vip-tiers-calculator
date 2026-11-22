import { describe, it, expect } from 'vitest';
import { CHECKLIST_PHASES, CHECKLIST_STEPS, SETUP_CONDITIONS, GUIDES } from '../data/checklistTemplate';
import { buildChecklist, checklistSetup, missingSetup, checklistRowPatch, patchChecklistRows, addChecklistRow, removeChecklistRow, checklistProgressByProgram, folderChecklist } from './checklist';

const keysOf = checklist => checklist.phases.flatMap(p => [...p.groups.flatMap(g => g.items), ...p.custom]).map(i => i.key);

const setupOf = (config, referral = true) => checklistSetup({
  config: { hasMissions: true, hasTiers: true, ...config },
  referralConfig: { enabled: referral },
});

describe('checklist template', () => {
  it('has unique keys, known conditions, sections and guides', () => {
    const ids = CHECKLIST_STEPS.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach(id => expect(id).toMatch(/^[a-z0-9_]{1,64}$/));
    CHECKLIST_STEPS.forEach(step => {
      expect(SETUP_CONDITIONS[step.setup], step.id).toBeTruthy();
      const phase = CHECKLIST_PHASES.find(p => p.key === step.phase);
      expect(phase, step.id).toBeTruthy();
      if (phase.sections) expect(phase.sections.some(s => s.key === step.section), step.id).toBe(true);
      step.guides.forEach(title => expect(GUIDES[title], `${step.id}: ${title}`).toMatch(/^https:\/\/help\.loyoly\.io\/fr\/articles\/\d+-/));
    });
  });
});

describe('checklist for a setup', () => {
  it('Shopify Plus, Klaviyo, several languages, Shopify POS', () => {
    const keys = keysOf(buildChecklist(setupOf({
      cms: 'shopify_plus', crm: 'klaviyo', international: true, multiLanguage: true, multiCurrency: false,
      physicalStore: true, posSystem: 'shopify_pos',
    })));
    ['shopify_app', 'shopify_page', 'potential_points', 'checkout_extensions', 'checkout_translations', 'checkout_mobile',
      'translations', 'weglot', 'check_locales', 'crm_klaviyo', 'crm_properties', 'crm_optin', 'crm_email_translations',
      'native_emails_off', 'pos_tile', 'store_mission', 'retail_training', 'store_go_live', 'com_store_material',
      'vip_tiers', 'referral', 'post_referral_campaigns'].forEach(key => expect(keys, key).toContain(key));
    ['ps_module', 'ps_page', 'ps_checkout', 'post_ps_updates', 'crm_brevo', 'native_emails_on', 'currency_points',
      'intl_app_embed', 'pos_connect'].forEach(key => expect(keys, key).not.toContain(key));
  });

  it('PrestaShop without CRM, international or store, nor referral', () => {
    const keys = keysOf(buildChecklist(setupOf({ cms: 'prestashop', crm: 'none', international: false, physicalStore: false, hasTiers: false }, false)));
    ['ps_module', 'ps_order_statuses', 'ps_page', 'ps_account', 'ps_checkout', 'post_ps_updates', 'native_emails_on', 'branding']
      .forEach(key => expect(keys, key).toContain(key));
    ['shopify_app', 'checkout_extensions', 'native_emails_off', 'crm_properties', 'translations', 'check_locales',
      'pos_tile', 'retail_training', 'vip_tiers', 'referral', 'post_referral_campaigns'].forEach(key => expect(keys, key).not.toContain(key));
  });

  it('Shopify, several currencies, Cegid: currency steps and the POS connection', () => {
    const keys = keysOf(buildChecklist(setupOf({
      cms: 'shopify', crm: 'brevo', international: true, multiLanguage: false, multiCurrency: true, physicalStore: true, posSystem: 'cegid',
    })));
    ['intl_app_embed', 'currency_points', 'currency_variables', 'currency_amounts', 'check_locales', 'pos_connect', 'crm_brevo', 'crm_optin']
      .forEach(key => expect(keys, key).toContain(key));
    ['translations', 'crm_email_translations', 'checkout_extensions', 'pos_tile'].forEach(key => expect(keys, key).not.toContain(key));
  });

  it('waits for the missing setup answers', () => {
    const blank = buildChecklist(setupOf({}));
    expect(blank.missing).toEqual(['cms', 'crm', 'international', 'physicalStore']);
    expect(blank.pending).toBeGreaterThan(20);
    const keys = keysOf(blank);
    expect(keys).toContain('branding');
    expect(keys).not.toContain('shopify_app');
    expect(missingSetup(setupOf({ international: true, multiLanguage: true, physicalStore: true }).valueOf()))
      .toEqual(['cms', 'crm', 'languagesCurrencies', 'posSystem']);
  });

  it('applies the saved progress, adds the custom tasks and counts the progress', () => {
    const rows = [
      { item_key: 'branding', status: 'done', owner: 'brand', due_date: '2026-12-01', note: 'Logo reçu', updated_by_type: 'client', updated_by_name: 'Marie' },
      { item_key: 'widget_hub', status: 'na' },
      { item_key: 'custom_1', label: 'Valider les visuels avec l\'agence', phase: 'communication', status: 'in_progress', created_at: '2026-11-09T10:00:00Z' },
    ];
    const checklist = buildChecklist(setupOf({ cms: 'shopify', crm: 'none', international: false, physicalStore: false }), rows);
    const branding = checklist.phases[0].groups.find(g => g.key === 'program').items.find(i => i.key === 'branding');
    expect(branding).toMatchObject({ status: 'done', owner: 'brand', dueDate: '2026-12-01', note: 'Logo reçu', updatedByName: 'Marie', label: 'Valider le branding (logo, couleurs, visuels)' });
    expect(branding.guides[0].title).toBe('Personnaliser mon programme');
    const custom = checklist.phases.find(p => p.key === 'communication').custom;
    expect(custom).toEqual([expect.objectContaining({ key: 'custom_1', custom: true, label: 'Valider les visuels avec l\'agence', status: 'in_progress' })]);
    const total = keysOf(checklist).length - 1; // the step marked not concerned
    expect(checklist.progress).toEqual({ done: 1, total });
  });

  it('changes the saved rows at once: patch, add, remove', () => {
    const marie = { type: 'client', name: 'Marie' };
    expect(checklistRowPatch({ status: 'done', owner: '', dueDate: '', note: '  ' })).toEqual({ status: 'done', owner: null, due_date: null, note: null });
    let rows = patchChecklistRows([], 'go_live', { status: 'in_progress' }, marie);
    expect(rows).toEqual([expect.objectContaining({ item_key: 'go_live', status: 'in_progress', updated_by_name: 'Marie', updated_by_type: 'client' })]);
    rows = patchChecklistRows(rows, 'go_live', { due_date: '2026-12-15' }, { type: 'csm', name: 'Ana' });
    expect(rows[0]).toMatchObject({ status: 'in_progress', due_date: '2026-12-15', updated_by_name: 'Ana' });
    rows = addChecklistRow(rows, 'custom_x', 'Brief vendeurs', 'launch', marie);
    expect(rows[1]).toMatchObject({ item_key: 'custom_x', label: 'Brief vendeurs', phase: 'launch', status: 'todo' });
    expect(removeChecklistRow(rows, 'custom_x')).toHaveLength(1);
  });

  it('sums up each started checklist for the client space, and a folder by its last moved one', () => {
    const config = { hasMissions: true, hasTiers: true, cms: 'shopify', crm: 'none', international: false, physicalStore: false };
    const rows = [
      { program_id: 'p1', item_key: 'branding', status: 'done', updated_at: '2026-11-08T10:00:00Z', updated_by_type: 'csm', updated_by_name: 'Ana' },
      { program_id: 'p1', item_key: 'go_live', status: 'in_progress', updated_at: '2026-11-08T12:00:00Z', updated_by_type: 'client', updated_by_name: 'Marie' },
      { program_id: 'p2', item_key: 'branding', status: 'done', updated_at: '2026-11-07T09:00:00Z', updated_by_type: 'csm', updated_by_name: 'Ana' },
    ];
    const byProgram = checklistProgressByProgram([{ id: 'p1', config, referralConfig: { enabled: true } }, { id: 'p2', config }, { id: 'p3', config }], rows);
    const total = buildChecklist(checklistSetup({ config, referralConfig: { enabled: true } })).progress.total;
    expect(byProgram.p1).toEqual({ done: 1, total, updatedAt: '2026-11-08T12:00:00Z', updatedByType: 'client', updatedByName: 'Marie' });
    expect(byProgram.p3).toBeUndefined();
    const folder = { programs: [{ id: 'p2', program_name: 'Proposition B' }, { id: 'p1', program_name: 'Programme principal' }, { id: 'p3', program_name: 'Brouillon' }] };
    expect(folderChecklist(folder, byProgram)).toMatchObject({ programName: 'Programme principal', done: 1, updatedByName: 'Marie' });
    expect(folderChecklist({ programs: [{ id: 'p3' }] }, byProgram)).toBe(null);
  });

  it('speaks English', () => {
    const checklist = buildChecklist(setupOf({ cms: 'shopify_plus' }), [], 'en');
    expect(checklist.phases[0].label).toBe('Pre-launch — Technical activation');
    const install = checklist.phases[0].groups[0];
    expect(install.label).toBe('1 · Installation on the e-commerce platform');
    expect(install.items[0]).toMatchObject({ label: 'Install the Loyoly app from the Shopify App Store', tag: 'Shopify (all plans)' });
  });
});
