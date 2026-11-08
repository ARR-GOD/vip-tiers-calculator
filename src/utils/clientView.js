// ════════════════════════════════════════════════════════════════════
// Client view — what a client sees of a published program
// ════════════════════════════════════════════════════════════════════
//
// The client portal shows the setup sheet (utils/setupSheet.js) split into
// pages: the program structure only — never the imported customers, margins,
// real costs or utilization rates. The CSM publishes a frozen copy of the
// program cleared of those (sanitizeProgram); the brand can then edit it
// (utils/programOps.js) and the pages are rebuilt from it.

import { buildSetupSheet } from './setupSheet';
import { stableStringify } from './programStore';

export const CLIENT_VIEW_VERSION = 2;

export const CLIENT_PAGES = [
  { key: 'missions', sections: ['points', 'missions'], labelFr: 'Missions', labelEn: 'Missions' },
  { key: 'rewards', sections: ['rewards'], labelFr: 'Récompenses', labelEn: 'Rewards' },
  { key: 'referral', sections: ['referral'], labelFr: 'Parrainage', labelEn: 'Referral' },
  { key: 'tiers', sections: ['vip'], labelFr: 'Paliers VIP', labelEn: 'VIP tiers' },
];

// Wizard step → client page, for the CSM comments panel.
export const PAGE_OF_STEP = { 3: 'missions', 4: 'referral', 5: 'rewards', 6: 'tiers' };
export const STEP_OF_PAGE = Object.fromEntries(Object.entries(PAGE_OF_STEP).map(([step, page]) => [page, Number(step)]));

export const pageLabel = (pageKey, lang) => {
  const page = CLIENT_PAGES.find(p => p.key === pageKey);
  return page ? (lang === 'fr' ? page.labelFr : page.labelEn) : pageKey;
};

// Only the sections of the client pages are shown (not the setup information).
const CLIENT_SECTION_KEYS = CLIENT_PAGES.flatMap(p => p.sections);

const pick = (obj, keys) => Object.fromEntries(keys.filter(k => obj?.[k] !== undefined).map(k => [k, obj[k]]));

// What the brand may see (and edit) of a program: its structure, without the
// setup information, margins, real costs, completion and utilization rates.
export function sanitizeProgram(program) {
  const mission = m => pick(m, ['id', 'icon', 'nameFr', 'nameEn', 'category', 'basePoints', 'enabled', 'isPurchaseMission']);
  return {
    config: pick(program.config, ['hasMissions', 'hasTiers', 'tierBasis', 'pointsExpire', 'expirationMonths', 'expirationType', 'tiersExpire', 'tierExpirationMonths', 'tierExpirationType']),
    settings: pick(program.settings, ['aov', 'earnRate', 'earnRateManual']),
    tiers: (program.tiers || []).map(t => pick(t, ['name', 'color', 'spendThreshold', 'orderThreshold', 'pointsMultiplier'])),
    rewards: (program.rewards || []).map(r => pick(r, ['id', 'type', 'nameFr', 'nameEn', 'rewardUsage', 'pointsBase', 'expirationDays', 'minPurchase', 'minPurchaseAuto', 'assignedTiers'])),
    missions: (program.missions || []).map(mission),
    customMissions: (program.customMissions || []).map(mission),
    referralConfig: pick(program.referralConfig, ['enabled', 'rewardsAuto', 'referrerType', 'referrerValue', 'refereeType', 'refereeValue', 'expirationsAuto', 'referrerExpirationDays', 'refereeExpirationDays', 'referrerMinPurchaseAuto', 'referrerMinPurchase', 'refereeMinPurchaseAuto', 'refereeMinPurchase']),
  };
}

export function buildClientView(program, { clientName = null, brandLogo = null } = {}) {
  return { v: CLIENT_VIEW_VERSION, brand: { name: clientName, logo: brandLogo }, program: sanitizeProgram(program) };
}

// Views published before v2 hold ready-made sheets and cannot be edited.
export const isEditableView = view => !!view?.program;

export const hasUnpublishedChanges = (view, published) =>
  !published || stableStringify(view) !== stableStringify(published);

export function viewSections(view, lang) {
  if (view?.program) {
    return buildSetupSheet({ ...view.program, lang }).sections.filter(s => CLIENT_SECTION_KEYS.includes(s.key));
  }
  return (view?.[lang] || view?.fr)?.sections || [];
}

export function pageSections(view, lang, pageKey) {
  const page = CLIENT_PAGES.find(p => p.key === pageKey);
  return page ? viewSections(view, lang).filter(s => page.sections.includes(s.key)) : [];
}

// Rows a comment can be about on a page: [{ ref, label }].
export const pageItems = (view, lang, pageKey) => pageSections(view, lang, pageKey)
  .flatMap(s => (s.refs || []).map((ref, i) => ({ ref, label: String(s.rows[i][0]) })));
