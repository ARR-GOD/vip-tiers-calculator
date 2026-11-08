// ════════════════════════════════════════════════════════════════════
// Launch checklist — the template's steps for one program's setup
// ════════════════════════════════════════════════════════════════════
//
// The steps come from data/checklistTemplate.js; their progress (status,
// owner, due date, notes) and the tasks the CSM or the brand add are rows of
// program_checklist (supabase/migrations/20261110000000_program_checklist.sql).

import { CHECKLIST_PHASES, CHECKLIST_STEPS, SETUP_CONDITIONS, GUIDES } from '../data/checklistTemplate';

export const CHECKLIST_STATUSES = ['todo', 'in_progress', 'done', 'na'];
export const CHECKLIST_OWNERS = ['loyoly', 'brand', 'both'];
export const CUSTOM_PREFIX = 'custom_';
export const isCustomKey = key => key.startsWith(CUSTOM_PREFIX);

// The setup answers the checklist depends on, from a program (wizard values,
// saved state, or the `setup` the client portal returns as is).
export function checklistSetup({ config = {}, referralConfig } = {}) {
  return {
    cms: config.cms ?? null,
    crm: config.crm ?? null,
    international: config.international ?? null,
    multiLanguage: config.multiLanguage ?? null,
    multiCurrency: config.multiCurrency ?? null,
    physicalStore: config.physicalStore ?? null,
    posSystem: config.posSystem ?? null,
    hasMissions: !!config.hasMissions,
    hasTiers: !!config.hasTiers,
    referral: !!referralConfig?.enabled,
  };
}

// Facts the step conditions test: true, false, or null (not answered yet).
export function checklistFacts(setup) {
  const is = (value, ...ids) => (value == null ? null : ids.includes(value));
  const sub = (parent, value) => (parent == null ? null : parent === false ? false : value ?? null);
  return {
    shopify: is(setup.cms, 'shopify', 'shopify_plus'),
    shopifyPlus: is(setup.cms, 'shopify_plus'),
    prestashop: is(setup.cms, 'prestashop'),
    crmIs: id => is(setup.crm, id),
    anyCrm: setup.crm == null ? null : setup.crm !== 'none',
    noCrm: is(setup.crm, 'none'),
    multiLanguage: sub(setup.international, setup.multiLanguage),
    multiCurrency: sub(setup.international, setup.multiCurrency),
    store: setup.physicalStore ?? null,
    shopifyPos: sub(setup.physicalStore, is(setup.posSystem, 'shopify_pos')),
    otherPos: sub(setup.physicalStore, is(setup.posSystem, 'cegid', 'other')),
    points: setup.hasMissions,
    tiers: setup.hasTiers,
    referral: setup.referral,
  };
}

// Setup questions still unanswered that some steps wait for.
export function missingSetup(setup) {
  const missing = [];
  if (setup.cms == null) missing.push('cms');
  if (setup.crm == null) missing.push('crm');
  if (setup.international == null) missing.push('international');
  else if (setup.international && (setup.multiLanguage == null || setup.multiCurrency == null)) missing.push('languagesCurrencies');
  if (setup.physicalStore == null) missing.push('physicalStore');
  else if (setup.physicalStore && setup.posSystem == null) missing.push('posSystem');
  return missing;
}

// A saved row in one shape for both sides (table rows and portal rows alike).
export function normalizeChecklistRow(row) {
  return {
    key: row.item_key,
    label: row.label ?? null,
    phase: row.phase ?? null,
    status: row.status || 'todo',
    owner: row.owner ?? null,
    dueDate: row.due_date ?? null,
    note: row.note ?? '',
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    updatedByType: row.updated_by_type ?? null,
    updatedByName: row.updated_by_name ?? null,
  };
}

// UI patch ({ status, owner, dueDate, note }) → row columns.
export function checklistRowPatch(patch) {
  const row = {};
  if ('status' in patch) row.status = patch.status;
  if ('owner' in patch) row.owner = patch.owner || null;
  if ('dueDate' in patch) row.due_date = patch.dueDate || null;
  if ('note' in patch) row.note = patch.note?.trim() ? patch.note.trim() : null;
  return row;
}

// Saved rows changed at once, before the save (both sides keep raw rows).
export function patchChecklistRows(rows, key, rowPatch, author) {
  const stamp = { updated_at: new Date().toISOString(), updated_by_type: author.type, updated_by_name: author.name };
  return rows.some(r => r.item_key === key)
    ? rows.map(r => (r.item_key === key ? { ...r, ...rowPatch, ...stamp } : r))
    : [...rows, { item_key: key, status: 'todo', created_at: stamp.updated_at, ...rowPatch, ...stamp }];
}

export function addChecklistRow(rows, key, label, phase, author) {
  const at = new Date().toISOString();
  return [...rows, { item_key: key, label, phase, status: 'todo', created_at: at, updated_at: at, updated_by_type: author.type, updated_by_name: author.name }];
}

export const removeChecklistRow = (rows, key) => rows.filter(r => r.item_key !== key);

const EMPTY_STATE = { status: 'todo', owner: null, dueDate: null, note: '', updatedAt: null, updatedByType: null, updatedByName: null };
const stateOf = row => ({
  status: row.status, owner: row.owner, dueDate: row.dueDate, note: row.note,
  updatedAt: row.updatedAt, updatedByType: row.updatedByType, updatedByName: row.updatedByName,
});

// The checklist of one program: phases → groups → items, the steps waiting
// for setup answers, and the progress (steps marked "not concerned" are left
// out of it). An item's `hint` is the template's note, `note` the team's.
// `savedRows` are program_checklist rows, as saved.
export function buildChecklist(setup, savedRows = [], lang = 'fr') {
  const fr = lang === 'fr';
  const facts = checklistFacts(setup);
  const rows = savedRows.map(normalizeChecklistRow);
  const byKey = new Map(rows.map(r => [r.key, r]));
  let pending = 0;

  const templateItem = step => {
    const condition = SETUP_CONDITIONS[step.setup];
    const saved = byKey.get(step.id);
    return {
      key: step.id,
      custom: false,
      label: fr ? step.fr : step.en,
      tag: step.setup === 'all' ? null : (fr ? condition.fr : condition.en),
      hint: (fr ? step.noteFr : step.noteEn) || null,
      guides: step.guides.map(title => ({ title, url: GUIDES[title] })).filter(g => g.url),
      ...EMPTY_STATE,
      ...(saved ? stateOf(saved) : {}),
    };
  };

  const phases = CHECKLIST_PHASES.map(phase => {
    const groups = (phase.sections || [{ key: null }]).map(group => ({
      key: group.key,
      label: group.key ? (fr ? group.fr : group.en) : null,
      items: CHECKLIST_STEPS
        .filter(step => step.phase === phase.key && step.section === group.key)
        .filter(step => {
          const applies = SETUP_CONDITIONS[step.setup].test(facts);
          if (applies === null) pending++;
          return applies === true;
        })
        .map(templateItem),
    }));
    const custom = rows
      .filter(r => isCustomKey(r.key) && r.phase === phase.key)
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)))
      .map(r => ({ key: r.key, custom: true, label: r.label, tag: null, hint: null, guides: [], ...EMPTY_STATE, ...stateOf(r) }));
    return {
      key: phase.key,
      icon: phase.icon,
      label: fr ? phase.fr : phase.en,
      groups: groups.filter(g => g.items.length > 0),
      custom,
    };
  });

  const all = phases.flatMap(p => [...p.groups.flatMap(g => g.items), ...p.custom]);
  const counted = all.filter(i => i.status !== 'na');
  return {
    phases,
    pending,
    missing: missingSetup(setup),
    progress: { done: counted.filter(i => i.status === 'done').length, total: counted.length },
  };
}
