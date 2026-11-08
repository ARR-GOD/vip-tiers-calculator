// ════════════════════════════════════════════════════════════════════
// Launch checklist template — "Checklist lancement & communication"
// ════════════════════════════════════════════════════════════════════
//
// The Loyoly template (Google Sheet "Checklist"), by phase. Each step shows
// only when its setup applies (`setup`, see SETUP_CONDITIONS): the CSM's
// answers in Configuration (CMS, CRM, international, physical store) and the
// program structure (points, VIP tiers, referral). A step's key is stable: the
// progress saved for it (program_checklist.item_key) depends on it.

const HELP = 'https://help.loyoly.io/fr/articles/';

// Help center articles, by the title the template gives them.
export const GUIDES = {
  'Installation de Prestashop': `${HELP}9767706-installation-de-prestashop`,
  'Module PrestaShop 8.4.0 / 9.4.0': `${HELP}16900053-module-prestashop-8-4-0-9-4-0-mise-a-jour-et-parametrage-des-statuts-de-commande`,
  'Personnaliser mon programme': `${HELP}8459320-personnaliser-mon-programme`,
  'Mettre en place la fidélité': `${HELP}8475346-mettre-en-place-la-fidelite`,
  'Types de récompenses': `${HELP}7932197-les-types-de-recompenses-disponibles`,
  'Buy X Get Y': `${HELP}9929560-buy-x-get-y`,
  'Configuration des paliers VIP': `${HELP}8531876-configuration-des-paliers-vip`,
  'Paramètres du programme VIP': `${HELP}8532056-parametres-du-programme-vip`,
  'Mettre en place le parrainage': `${HELP}8475397-mettre-en-place-le-parrainage`,
  'Gestion des traductions': `${HELP}9546919-la-gestion-des-traductions`,
  'Intégration Weglot': `${HELP}11144356-integration-weglot`,
  'Gestion des monnaies': `${HELP}9687457-la-gestion-des-monnaies`,
  'Store Credits': `${HELP}15344597-store-credits-recompenser-vos-clients-en-credit-boutique`,
  'Mise en ligne de votre page': `${HELP}8455483-mise-en-ligne-de-votre-page`,
  'Mise à jour de la page': `${HELP}13158618-important-mise-a-jour-de-votre-page-de-fidelite`,
  'Parrainage PrestaShop : iframe': `${HELP}15010115-parrainage-prestashop-deployer-la-page-via-iframe`,
  'Hub de fidélité (Widget)': `${HELP}14656198-configurer-le-hub-de-fidelite-widget`,
  'Points potentiels - Page produit': `${HELP}9264794-points-de-fidelite-potentiels-page-produit`,
  'Extension : Nouveau compte client': `${HELP}9795003-extension-nouveau-compte-client`,
  'Le module compte client': `${HELP}10007654-le-module-compte-client`,
  'Les extensions de checkout': `${HELP}8926442-les-extensions-de-checkout`,
  'Prestashop Extension Checkout': `${HELP}11196618-prestashop-extension-checkout`,
  'Intégration Klaviyo': `${HELP}8426553-integration-de-loyoly-avec-klaviyo`,
  'Emails Klaviyo': `${HELP}8429404-configurez-vos-emails-avec-klaviyo`,
  'Intégration Brevo': `${HELP}9104660-integration-de-loyoly-avec-brevo`,
  'Emails Brevo': `${HELP}9104873-configurez-vos-emails-avec-brevo`,
  'Intégration Omnisend': `${HELP}14034017-integration-de-loyoly-avec-omnisend`,
  'Emails Omnisend': `${HELP}14034027-configurez-vos-emails-avec-omnisend`,
  'Intégration Braze': `${HELP}12646676-integration-de-loyoly-avec-braze`,
  'Emails Braze': `${HELP}12731317-configurez-vos-emails-avec-braze`,
  'Intégration Splio': `${HELP}12751763-integration-de-loyoly-avec-splio`,
  'Emails Splio': `${HELP}12752319-configurez-vos-emails-avec-splio`,
  'Intégration ActiveCampaign': `${HELP}16971934-integration-de-loyoly-avec-activecampaign`,
  'Emails ActiveCampaign': `${HELP}14495877-configurez-vos-emails-avec-activecampaign`,
  'Intégration HubSpot': `${HELP}10538701-integration-de-loyoly-avec-hubspot`,
  'Emails HubSpot': `${HELP}10551234-configurez-vos-emails-avec-hubspot`,
  'Intégration Insider': `${HELP}11401901-integration-de-loyoly-avec-insider`,
  'Emails Insider': `${HELP}11403360-configurez-vos-emails-dans-insider`,
  'Intégration Connectif': `${HELP}15691706-integration-de-loyoly-avec-connectif`,
  'Emails Connectif': `${HELP}15693130-configurez-vos-emails-avec-connectif`,
  'Mission Newsletter (opt-in)': `${HELP}9503940-newsletter`,
  'Traduire les emails Klaviyo & Brevo': `${HELP}10226457-traduire-les-emails-klaviyo-brevo`,
  'Shopify POS': `${HELP}13927138-shopify-pos`,
  'Intégration de Cegid': `${HELP}13016063-integration-de-cegid`,
  'Récompenses Cegid': `${HELP}13141923-creer-des-recompenses-pour-cegid`,
  'Réaliser un achat en boutique': `${HELP}9507211-realiser-un-achat-en-boutique`,
  'Importer les clients avec leurs points': `${HELP}8618431-importer-et-transferer-les-clients-avec-leurs-points-dans-loyoly`,
  'Procédure de test': `${HELP}10383727-procedure-de-test`,
  'Checklist de lancement': `${HELP}8557412-checklist-de-lancement`,
  'Les ancres': `${HELP}9498259-les-ancres`,
  'Comment diffuser mon programme ?': `${HELP}6014577-comment-diffuser-mon-programme`,
  'Aller plus loin avec Klaviyo': `${HELP}11712455-aller-plus-loin-avec-klaviyo`,
  'Segments Klaviyo': `${HELP}8724605-creez-des-segments-sur-klaviyo`,
  'Envoyer un événement au CRM': `${HELP}12586939-action-envoyer-un-evenement-a-votre-crm`,
  'Paramètres du Wallet': `${HELP}13342771-parametres-du-wallet`,
  'Analyse - Fidélité': `${HELP}10233822-analyse-fidelite`,
};

// ── Setup conditions ─────────────────────────────────────────────────
// Answers are three-valued: true, false, or null when not answered yet.
const and = (...xs) => (xs.includes(false) ? false : xs.includes(null) ? null : true);
const or = (...xs) => (xs.includes(true) ? true : xs.includes(null) ? null : false);

// "Setup concerné": the label shown on the step and the test of the facts
// (utils/checklist.js, checklistFacts).
export const SETUP_CONDITIONS = {
  all: { fr: 'Tous', en: 'All', test: () => true },
  points: { fr: 'Programme à points', en: 'Points program', test: f => f.points },
  tiers: { fr: 'Paliers VIP', en: 'VIP tiers', test: f => f.tiers },
  referral: { fr: 'Parrainage', en: 'Referral', test: f => f.referral },
  shopify: { fr: 'Shopify (tous plans)', en: 'Shopify (all plans)', test: f => f.shopify },
  shopify_points: { fr: 'Shopify (tous plans)', en: 'Shopify (all plans)', test: f => and(f.shopify, f.points) },
  shopify_plus: { fr: 'Shopify Plus uniquement', en: 'Shopify Plus only', test: f => f.shopifyPlus },
  prestashop: { fr: 'PrestaShop', en: 'PrestaShop', test: f => f.prestashop },
  multi_language: { fr: 'Multilingue', en: 'Several languages', test: f => f.multiLanguage },
  multi_currency: { fr: 'Multi-devise', en: 'Several currencies', test: f => f.multiCurrency },
  multi_currency_shopify: { fr: 'Multi-devise + Shopify', en: 'Several currencies + Shopify', test: f => and(f.multiCurrency, f.shopify) },
  multi_language_shopify_plus: { fr: 'Multilingue + Shopify Plus', en: 'Several languages + Shopify Plus', test: f => and(f.multiLanguage, f.shopifyPlus) },
  multi_any: { fr: 'Multilingue / Multi-devise', en: 'Several languages / currencies', test: f => or(f.multiLanguage, f.multiCurrency) },
  crm_klaviyo: { fr: 'CRM Klaviyo', en: 'Klaviyo CRM', test: f => f.crmIs('klaviyo') },
  crm_brevo: { fr: 'CRM Brevo', en: 'Brevo CRM', test: f => f.crmIs('brevo') },
  crm_omnisend: { fr: 'CRM Omnisend', en: 'Omnisend CRM', test: f => f.crmIs('omnisend') },
  crm_braze: { fr: 'CRM Braze', en: 'Braze CRM', test: f => f.crmIs('braze') },
  crm_splio: { fr: 'CRM Splio', en: 'Splio CRM', test: f => f.crmIs('splio') },
  crm_activecampaign: { fr: 'CRM ActiveCampaign', en: 'ActiveCampaign CRM', test: f => f.crmIs('activecampaign') },
  crm_hubspot: { fr: 'CRM HubSpot', en: 'HubSpot CRM', test: f => f.crmIs('hubspot') },
  crm_insider: { fr: 'CRM Insider', en: 'Insider CRM', test: f => f.crmIs('insider') },
  crm_connectif: { fr: 'CRM Connectif', en: 'Connectif CRM', test: f => f.crmIs('connectif') },
  any_crm: { fr: 'Tous CRM', en: 'Any CRM', test: f => f.anyCrm },
  no_crm: { fr: 'Sans CRM', en: 'No CRM', test: f => f.noCrm },
  klaviyo_brevo: { fr: 'CRM Klaviyo / Brevo', en: 'Klaviyo / Brevo CRM', test: f => or(f.crmIs('klaviyo'), f.crmIs('brevo')) },
  multi_language_klaviyo_brevo: { fr: 'Multilingue + CRM Klaviyo / Brevo', en: 'Several languages + Klaviyo / Brevo', test: f => and(f.multiLanguage, or(f.crmIs('klaviyo'), f.crmIs('brevo'))) },
  referral_crm: { fr: 'Parrainage + CRM', en: 'Referral + CRM', test: f => and(f.referral, f.anyCrm) },
  store: { fr: 'Boutiques physiques', en: 'Physical stores', test: f => f.store },
  store_points: { fr: 'Boutiques physiques', en: 'Physical stores', test: f => and(f.store, f.points) },
  shopify_pos: { fr: 'Boutiques – Shopify POS', en: 'Stores – Shopify POS', test: f => f.shopifyPos },
  other_pos: { fr: 'Boutiques – Cegid / autre caisse', en: 'Stores – Cegid / other POS', test: f => f.otherPos },
};

// ── Phases and sections ──────────────────────────────────────────────
export const CHECKLIST_PHASES = [
  {
    key: 'pre_launch', icon: '🔧', fr: 'Pré-lancement — Activation technique', en: 'Pre-launch — Technical activation',
    sections: [
      { key: 'install', fr: '1 · Installation sur la plateforme e-commerce', en: '1 · Installation on the e-commerce platform' },
      { key: 'program', fr: '2 · Configuration du programme', en: '2 · Program setup' },
      { key: 'international', fr: '3 · International (langues et devises)', en: '3 · International (languages and currencies)' },
      { key: 'display', fr: '4 · Affichage sur le site', en: '4 · Display on the site' },
      { key: 'crm', fr: '5 · CRM et emails', en: '5 · CRM and emails' },
      { key: 'stores', fr: '6 · Boutiques physiques', en: '6 · Physical stores' },
      { key: 'data', fr: '7 · Données clients, tests et validation', en: '7 · Customer data, tests and validation' },
    ],
  },
  { key: 'launch', icon: '🎉', fr: 'Lancement — Jour J', en: 'Launch — D-day' },
  { key: 'communication', icon: '📣', fr: 'Communication — Annonce du programme', en: 'Communication — Program announcement' },
  { key: 'post_launch', icon: '📅', fr: 'Post-lancement — Animation continue', en: 'Post-launch — Ongoing activation' },
];

// ── Steps ────────────────────────────────────────────────────────────
const step = (phase, section, id, setup, fr, en, extra = {}) => ({ id, phase, section, setup, fr, en, guides: [], ...extra });
const pre = (section, ...args) => step('pre_launch', section, ...args);
const crmStep = (id, name, fr, en, extra = {}) =>
  pre('crm', `crm_${id}`, `crm_${id}`, fr, en, { guides: [`Intégration ${name}`, `Emails ${name}`], ...extra });

export const CHECKLIST_STEPS = [
  // 1 · Installation
  pre('install', 'shopify_app', 'shopify', "Installer l'app Loyoly depuis le Shopify App Store", 'Install the Loyoly app from the Shopify App Store'),
  pre('install', 'ps_module', 'prestashop', 'Installer le module Loyoly (8.4.0 pour PS 1.7.x / 8.x, 9.4.0 pour PS 9.x)', 'Install the Loyoly module (8.4.0 for PS 1.7.x / 8.x, 9.4.0 for PS 9.x)',
    { noteFr: 'Vider entièrement le cache PrestaShop après installation', noteEn: 'Clear the whole PrestaShop cache after installing', guides: ['Installation de Prestashop'] }),
  pre('install', 'ps_order_statuses', 'prestashop', 'Associer les statuts de commande aux ajustements de points', 'Map the order statuses to points adjustments',
    { noteFr: 'Plusieurs statuts possibles (validée, remboursée, annulée…)', noteEn: 'Several statuses possible (validated, refunded, cancelled…)', guides: ['Module PrestaShop 8.4.0 / 9.4.0'] }),

  // 2 · Program
  pre('program', 'branding', 'all', 'Valider le branding (logo, couleurs, visuels)', 'Validate the branding (logo, colors, visuals)', { guides: ['Personnaliser mon programme'] }),
  pre('program', 'points_earning', 'points', 'Activer la fidélité transactionnelle (points/€)', 'Turn on transactional loyalty (points per €)', { guides: ['Mettre en place la fidélité'] }),
  pre('program', 'missions', 'points', 'Configurer et activer les missions', 'Set up and turn on the missions'),
  pre('program', 'rewards', 'all', 'Configurer les récompenses', 'Set up the rewards',
    { noteFr: 'Buy X Get Y : Shopify uniquement (non dispo sur PrestaShop)', noteEn: 'Buy X Get Y: Shopify only (not available on PrestaShop)', guides: ['Types de récompenses', 'Buy X Get Y'] }),
  pre('program', 'vip_tiers', 'tiers', 'Configurer les paliers VIP', 'Set up the VIP tiers', { guides: ['Configuration des paliers VIP', 'Paramètres du programme VIP'] }),
  pre('program', 'referral', 'referral', 'Configurer le parrainage', 'Set up the referral', { guides: ['Mettre en place le parrainage'] }),

  // 3 · International
  pre('international', 'translations', 'multi_language', 'Ajouter les langues et traduire missions, récompenses et branding', 'Add the languages and translate missions, rewards and branding',
    { noteFr: 'Branding > Traductions ; champ vide = langue par défaut', noteEn: 'Branding > Translations; an empty field uses the default language', guides: ['Gestion des traductions'] }),
  pre('international', 'weglot', 'multi_language', 'Connecter Weglot (si utilisé sur le site)', 'Connect Weglot (if used on the site)', { guides: ['Intégration Weglot'] }),
  pre('international', 'intl_app_embed', 'multi_currency_shopify', "Activer l'app embed « Loyoly - International »", 'Turn on the "Loyoly - International" app embed',
    { noteFr: 'Éditeur de thème > App embeds', noteEn: 'Theme editor > App embeds', guides: ['Gestion des monnaies'] }),
  pre('international', 'currency_points', 'multi_currency', 'Définir les points gagnés par devise (manuel ou conversion auto)', 'Set the points earned per currency (manual or automatic conversion)',
    { noteFr: 'Paramètres avancés de la fidélité', noteEn: 'Advanced loyalty settings', guides: ['Gestion des monnaies'] }),
  pre('international', 'currency_variables', 'multi_currency', "Utiliser les variables de devise dans les bons d'achat et le parrainage", 'Use the currency variables in vouchers and referral',
    { noteFr: '#{{local_currency_reward}}, #{{local_currency_referral_friend}}…', noteEn: '#{{local_currency_reward}}, #{{local_currency_referral_friend}}…', guides: ['Gestion des monnaies'] }),
  pre('international', 'currency_amounts', 'multi_currency', "Renseigner un montant par devise (bons d'achat, store credit)", 'Enter an amount per currency (vouchers, store credit)',
    { noteFr: 'Une devise sans montant ne reçoit rien', noteEn: 'A currency without an amount gets nothing', guides: ['Store Credits'] }),

  // 4 · Display
  pre('display', 'shopify_page', 'shopify', "Déployer la page fidélité sur le site (app block dans l'éditeur de thème)", 'Deploy the loyalty page on the site (app block in the theme editor)',
    { guides: ['Mise en ligne de votre page', 'Mise à jour de la page'] }),
  pre('display', 'ps_page', 'prestashop', 'Déployer la page fidélité / parrainage (module, hook ou iframe)', 'Deploy the loyalty / referral page (module, hook or iframe)',
    { noteFr: 'Iframe paramétrable : langue, client, devise', noteEn: 'Configurable iframe: language, customer, currency', guides: ['Parrainage PrestaShop : iframe'] }),
  pre('display', 'widget_hub', 'all', 'Activer le Hub de fidélité (widget)', 'Turn on the loyalty Hub (widget)', { guides: ['Hub de fidélité (Widget)'] }),
  pre('display', 'potential_points', 'shopify_points', "Installer l'extension points potentiels sur la fiche produit", 'Install the potential points extension on the product page',
    { guides: ['Points potentiels - Page produit'] }),
  pre('display', 'shopify_account', 'shopify', 'Configurer le module compte client (extension nouveaux comptes clients)', 'Set up the customer account module (new customer accounts extension)',
    { guides: ['Extension : Nouveau compte client', 'Le module compte client'] }),
  pre('display', 'ps_account', 'prestashop', 'Configurer le module compte client (bloc « Mon compte »)', 'Set up the customer account module ("My account" block)',
    { noteFr: 'Repositionnable via le back-office PrestaShop', noteEn: 'Can be moved from the PrestaShop back office', guides: ['Le module compte client'] }),
  pre('display', 'checkout_extensions', 'shopify_plus', 'Installer les extensions checkout (Points + Rewards)', 'Install the checkout extensions (Points + Rewards)',
    { noteFr: 'Shopify Plus + fidélité activée obligatoires', noteEn: 'Shopify Plus and loyalty turned on are required', guides: ['Les extensions de checkout'] }),
  pre('display', 'checkout_translations', 'multi_language_shopify_plus', "Traduire les textes de l'extension checkout", 'Translate the checkout extension texts',
    { noteFr: 'À mettre en place avec le CSM', noteEn: 'To set up with the CSM', guides: ['Les extensions de checkout'] }),
  pre('display', 'ps_checkout', 'prestashop', "Installer l'extension checkout PrestaShop", 'Install the PrestaShop checkout extension',
    { noteFr: 'Module 8.4.0 / 9.4.0 minimum', noteEn: 'Module 8.4.0 / 9.4.0 minimum', guides: ['Prestashop Extension Checkout'] }),

  // 5 · CRM and emails
  crmStep('klaviyo', 'Klaviyo', 'Connecter Klaviyo puis personnaliser et activer les flows', 'Connect Klaviyo, then customize and turn on the flows',
    { noteFr: 'Les flows sont copiés dans Klaviyo en brouillon', noteEn: 'The flows are copied into Klaviyo as drafts' }),
  crmStep('brevo', 'Brevo', 'Connecter Brevo puis configurer les automations', 'Connect Brevo, then set up the automations'),
  crmStep('omnisend', 'Omnisend', 'Connecter Omnisend puis configurer les automations', 'Connect Omnisend, then set up the automations',
    { noteFr: 'Connexion OAuth', noteEn: 'OAuth connection' }),
  crmStep('braze', 'Braze', 'Connecter Braze puis configurer les flows', 'Connect Braze, then set up the flows'),
  crmStep('splio', 'Splio', 'Connecter Splio puis configurer les flows', 'Connect Splio, then set up the flows'),
  crmStep('activecampaign', 'ActiveCampaign', 'Connecter ActiveCampaign puis configurer les automations', 'Connect ActiveCampaign, then set up the automations',
    { noteFr: 'Événements Loyoly + custom fields', noteEn: 'Loyoly events + custom fields' }),
  crmStep('hubspot', 'HubSpot', 'Connecter HubSpot puis configurer les workflows', 'Connect HubSpot, then set up the workflows'),
  crmStep('insider', 'Insider', 'Connecter Insider puis configurer les parcours', 'Connect Insider, then set up the journeys'),
  crmStep('connectif', 'Connectif', 'Connecter Connectif puis configurer les automatisations', 'Connect Connectif, then set up the automations',
    { noteFr: "Connexion par clé API ; templates prêts à l'emploi", noteEn: 'API key connection; ready-to-use templates' }),
  pre('crm', 'crm_properties', 'any_crm', 'Vérifier les propriétés Loyoly synchronisées sur les contacts', 'Check the Loyoly properties synced on the contacts',
    { noteFr: 'Solde de points, palier VIP, lien de parrainage…', noteEn: 'Points balance, VIP tier, referral link…' }),
  pre('crm', 'crm_optin', 'klaviyo_brevo', 'Synchroniser les opt-in newsletter / SMS avec le CRM', 'Sync the newsletter / SMS opt-ins with the CRM', { guides: ['Mission Newsletter (opt-in)'] }),
  pre('crm', 'crm_email_translations', 'multi_language_klaviyo_brevo', 'Traduire les emails (variables de traduction)', 'Translate the emails (translation variables)',
    { guides: ['Traduire les emails Klaviyo & Brevo'] }),
  pre('crm', 'native_emails_off', 'any_crm', 'Désactiver les emails natifs Loyoly', 'Turn off the native Loyoly emails',
    { noteFr: 'Évite les doublons avec les flows du CRM', noteEn: 'Avoids duplicates with the CRM flows' }),
  pre('crm', 'native_emails_on', 'no_crm', 'Personnaliser et activer les emails natifs Loyoly', 'Customize and turn on the native Loyoly emails',
    { noteFr: 'Les emails partent directement de Loyoly', noteEn: 'The emails are sent by Loyoly' }),

  // 6 · Physical stores
  pre('stores', 'pos_tile', 'shopify_pos', 'Ajouter la vignette Loyoly sur Shopify POS', 'Add the Loyoly tile on Shopify POS',
    { noteFr: 'Accueil POS > Ajouter une vignette > Applications > Loyoly', noteEn: 'POS home > Add tile > Apps > Loyoly', guides: ['Shopify POS'] }),
  pre('stores', 'pos_connect', 'other_pos', 'Connecter la caisse (intégration Cegid ou autre)', 'Connect the POS (Cegid or other integration)',
    { guides: ['Intégration de Cegid', 'Récompenses Cegid'] }),
  pre('stores', 'store_mission', 'store_points', 'Activer la mission « Achat en boutique »', 'Turn on the "In-store purchase" mission',
    { noteFr: 'Validée automatiquement si la caisse est connectée', noteEn: 'Validated automatically when the POS is connected', guides: ['Réaliser un achat en boutique'] }),
  pre('stores', 'retail_training', 'store', 'Former les équipes retail (identifier un client, échanger et appliquer une récompense)', 'Train the retail teams (identify a customer, redeem and apply a reward)',
    { noteFr: 'Paliers VIP en € non affichés sur Shopify POS', noteEn: 'VIP tiers in € are not shown on Shopify POS', guides: ['Shopify POS'] }),

  // 7 · Customer data, tests and validation
  pre('data', 'customer_import', 'all', 'Importer les clients existants avec leurs points', 'Import the existing customers with their points',
    { guides: ['Importer les clients avec leurs points'] }),
  pre('data', 'full_test', 'all', 'Test complet du parcours client', 'Full customer journey test',
    { noteFr: 'Créer un compte test, gagner des points, échanger. Tester chaque langue, devise et canal concerné', noteEn: 'Create a test account, earn points, redeem. Test each language, currency and channel involved', guides: ['Procédure de test'] }),

  // Launch — D-day
  step('launch', null, 'go_live', 'all', 'Activer le programme sur le site', 'Turn on the program on the site', { guides: ['Checklist de lancement'] }),
  step('launch', null, 'header_link', 'all', 'Ajouter le lien dans le header du site', 'Add the link in the site header', { guides: ['Les ancres'] }),
  step('launch', null, 'footer_link', 'all', 'Ajouter le lien dans le footer du site', 'Add the link in the site footer', { guides: ['Les ancres'] }),
  step('launch', null, 'check_extensions', 'all', 'Vérifier toutes les extensions visibles', 'Check that every extension shows'),
  step('launch', null, 'checkout_mobile', 'shopify_plus', "Vérifier l'emplacement de l'extension checkout sur mobile", 'Check the checkout extension placement on mobile',
    { noteFr: "Choisir un emplacement visible sans action de l'acheteur", noteEn: 'Pick a spot visible without any buyer action', guides: ['Les extensions de checkout'] }),
  step('launch', null, 'check_locales', 'multi_any', 'Vérifier la page fidélité dans chaque langue et chaque devise', 'Check the loyalty page in each language and currency'),
  step('launch', null, 'store_go_live', 'store', 'Activer le programme en caisse et briefer les vendeurs', 'Turn on the program at the POS and brief the sales staff'),

  // Communication — program announcement
  step('communication', null, 'com_newsletter', 'all', "Newsletter d'annonce du programme fidélité", 'Loyalty program announcement newsletter',
    { noteFr: "Email dédié à toute la base (via le CRM s'il y en a un)", noteEn: 'Dedicated email to the whole base (through the CRM if any)' }),
  step('communication', null, 'com_sms', 'all', "SMS d'annonce (si base SMS)", 'Announcement SMS (if SMS base)', { guides: ['Comment diffuser mon programme ?'] }),
  step('communication', null, 'com_banner', 'all', 'Bandeau/pop-up sur le site', 'Banner / pop-up on the site', { noteFr: 'Mettre en avant le programme', noteEn: 'Promote the program' }),
  step('communication', null, 'com_instagram_post', 'all', 'Publication Instagram (annonce)', 'Instagram post (announcement)'),
  step('communication', null, 'com_instagram_story', 'all', 'Story Instagram (annonce)', 'Instagram story (announcement)', { guides: ['Comment diffuser mon programme ?'] }),
  step('communication', null, 'com_tiktok', 'all', 'Publication TikTok (annonce)', 'TikTok post (announcement)'),
  step('communication', null, 'com_store_material', 'store', 'Supports en boutique (PLV, QR code vers la page fidélité)', 'In-store material (displays, QR code to the loyalty page)'),

  // Post-launch — ongoing activation
  step('post_launch', null, 'post_newsletter_banner', 'any_crm', 'Ajouter un bandeau fidélité dans les newsletters généralistes', 'Add a loyalty banner in the general newsletters',
    { noteFr: 'Afficher le solde de points (ex. Loyoly_Point_Balance sur Klaviyo)', noteEn: 'Show the points balance (e.g. Loyoly_Point_Balance on Klaviyo)', guides: ['Aller plus loin avec Klaviyo'] }),
  step('post_launch', null, 'post_crm_segments', 'any_crm', 'Créer des segments fidélité et envoyer les événements Loyoly au CRM', 'Create loyalty segments and send Loyoly events to the CRM',
    { guides: ['Segments Klaviyo', 'Envoyer un événement au CRM'] }),
  step('post_launch', null, 'post_referral_campaigns', 'referral_crm', 'Communications mensuelles ciblées (parrainage)', 'Monthly targeted campaigns (referral)',
    { noteFr: 'Partager le lien de parrainage', noteEn: 'Share the referral link' }),
  step('post_launch', null, 'post_ephemeral_missions', 'points', 'Renouveler les missions éphémères', 'Renew the limited-time missions',
    { noteFr: 'Nouveaux contenus, nouveaux posts à liker…', noteEn: 'New content, new posts to like…' }),
  step('post_launch', null, 'post_new_rewards', 'all', 'Ajouter de nouvelles récompenses', 'Add new rewards', { noteFr: 'Garder le programme attractif', noteEn: 'Keep the program attractive' }),
  step('post_launch', null, 'post_wallet', 'all', 'Configurer le Wallet mobile', 'Set up the mobile Wallet',
    { noteFr: 'Nouveau : carte fidélité dématérialisée', noteEn: 'New: digital loyalty card', guides: ['Paramètres du Wallet'] }),
  step('post_launch', null, 'post_store_tracking', 'store', 'Suivre les achats et récompenses utilisées en boutique', 'Track the in-store purchases and rewards used'),
  step('post_launch', null, 'post_ps_updates', 'prestashop', 'Mettre à jour le module PrestaShop à chaque nouvelle version', 'Update the PrestaShop module at each new version',
    { guides: ['Module PrestaShop 8.4.0 / 9.4.0'] }),
  step('post_launch', null, 'post_analytics', 'all', 'Analyser les performances (dashboard Loyoly)', 'Analyze the performance (Loyoly dashboard)',
    { noteFr: "LTV, taux d'engagement, taux de réachat. En multi-devise : choisir la devise d'affichage", noteEn: 'LTV, engagement rate, repurchase rate. With several currencies: pick the display currency', guides: ['Analyse - Fidélité'] }),
];
