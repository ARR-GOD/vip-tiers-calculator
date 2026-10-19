// ════════════════════════════════════════════════════════════════════
// Client view — what a client sees of a published program
// ════════════════════════════════════════════════════════════════════
//
// The client portal shows the setup sheet (utils/setupSheet.js) split into
// pages: the program structure only — never the imported customers, margins,
// real costs or utilization rates. The CSM publishes a frozen copy of it.

import { buildSetupSheet } from './setupSheet';
import { stableStringify } from './programStore';

export const CLIENT_VIEW_VERSION = 1;

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

// Both languages are published so the client can switch. The sheet's title and
// date are left out: the view only changes when the program does.
export function buildClientView(program, { clientName = null, brandLogo = null } = {}) {
  const sections = lang => buildSetupSheet({ ...program, lang }).sections;
  return {
    v: CLIENT_VIEW_VERSION,
    brand: { name: clientName, logo: brandLogo },
    fr: { sections: sections('fr') },
    en: { sections: sections('en') },
  };
}

export const hasUnpublishedChanges = (view, published) =>
  !published || stableStringify(view) !== stableStringify(published);

export function pageSections(view, lang, pageKey) {
  const page = CLIENT_PAGES.find(p => p.key === pageKey);
  const sections = (view?.[lang] || view?.fr)?.sections || [];
  return page ? sections.filter(s => page.sections.includes(s.key)) : [];
}

// Rows a comment can be about on a page: [{ ref, label }].
export const pageItems = (view, lang, pageKey) => pageSections(view, lang, pageKey)
  .flatMap(s => (s.refs || []).map((ref, i) => ({ ref, label: String(s.rows[i][0]) })));
