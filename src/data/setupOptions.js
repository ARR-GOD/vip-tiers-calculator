// ════════════════════════════════════════════════════════════════════
// Setup information — the brand's stack, set by the CSM in Configuration
// ════════════════════════════════════════════════════════════════════
//
// CMS and CRM integrations documented on the Loyoly help center, with their
// guide. These answers will drive the setup checklist.

const HELP = 'https://help.loyoly.io/fr/articles/';

export const CMS_OPTIONS = [
  { id: 'shopify', label: 'Shopify', guide: `${HELP}8455483-mise-en-ligne-de-votre-page` },
  { id: 'shopify_plus', label: 'Shopify Plus', guide: `${HELP}8926442-les-extensions-de-checkout` },
  { id: 'prestashop', label: 'Prestashop', guide: `${HELP}9767706-installation-de-prestashop` },
];

export const CRM_OPTIONS = [
  { id: 'klaviyo', label: 'Klaviyo', guide: `${HELP}8426553-integration-de-loyoly-avec-klaviyo` },
  { id: 'brevo', label: 'Brevo', guide: `${HELP}9104660-integration-de-loyoly-avec-brevo` },
  { id: 'omnisend', label: 'Omnisend', guide: `${HELP}14034017-integration-de-loyoly-avec-omnisend` },
  { id: 'braze', label: 'Braze', guide: `${HELP}12646676-integration-de-loyoly-avec-braze` },
  { id: 'splio', label: 'Splio', guide: `${HELP}12751763-integration-de-loyoly-avec-splio` },
  { id: 'hubspot', label: 'Hubspot', guide: `${HELP}10538701-integration-de-loyoly-avec-hubspot` },
  { id: 'insider', label: 'Insider', guide: `${HELP}11401901-integration-de-loyoly-avec-insider` },
  { id: 'connectif', label: 'Connectif', guide: `${HELP}15691706-integration-de-loyoly-avec-connectif` },
  { id: 'activecampaign', label: 'ActiveCampaign', guide: `${HELP}16971934-integration-de-loyoly-avec-activecampaign` },
];

// Answers that are not an integration.
export const CRM_NONE = 'none';
export const CRM_OTHER = 'other';

export const INTERNATIONAL_GUIDE = `${HELP}9546919-la-gestion-des-traductions`;
export const STORE_GUIDE = `${HELP}9507211-realiser-un-achat-en-boutique`;

export const cmsLabel = id => CMS_OPTIONS.find(o => o.id === id)?.label ?? null;

export function crmLabel(id, lang = 'fr') {
  if (id === CRM_NONE) return lang === 'fr' ? 'Aucun' : 'None';
  if (id === CRM_OTHER) return lang === 'fr' ? 'Autre' : 'Other';
  return CRM_OPTIONS.find(o => o.id === id)?.label ?? null;
}

export const guideOf = (options, id) => options.find(o => o.id === id)?.guide ?? null;
