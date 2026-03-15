// ── Tier defaults ──
export const DEFAULT_TIER_COLORS = ['#B87333', '#9CA3AF', '#D97706', '#7C3AED'];
export const DEFAULT_TIER_NAMES_FR = ['Bronze', 'Argent', 'Or', 'Platine'];
export const DEFAULT_TIER_NAMES_EN = ['Bronze', 'Silver', 'Gold', 'Platinum'];

export const TIER_COLOR_MAP = {
  Bronze: '#B87333',
  Argent: '#9CA3AF',
  Silver: '#9CA3AF',
  Or: '#D97706',
  Gold: '#D97706',
  Platine: '#7C3AED',
  Platinum: '#7C3AED',
};

// ── Missions ──
// Each mission has per-tier engagement rates (% of tier customers who complete it per year)
// ── Referral config (separate module, not a mission) ──
export const INITIAL_REFERRAL = {
  enabled: true,
  referrerType: 'percent',   // 'percent' | 'fixed'
  referrerValue: 10,          // 10% or 10€
  refereeType: 'fixed',       // 'percent' | 'fixed'
  refereeValue: 5,            // 5€ or 5%
  estimatedReferralsPerMonth: 10,
  conversionRate: 30,         // % of referees who purchase
  avgFirstOrderValue: 80,     // avg first order value of referee
};

// ── Mission catalog (CSM) ──
export const MISSION_CATALOG = {
  social: [
    { id: 'tiktok_follow', icon: '🎵', nameFr: 'Follow TikTok', nameEn: 'Follow on TikTok', points: 75, frequency: 1, defaultEngagement: [15, 25, 40] },
    { id: 'instagram_follow', icon: '📸', nameFr: 'Follow Instagram', nameEn: 'Follow on Instagram', points: 75, frequency: 1, defaultEngagement: [20, 30, 45] },
    { id: 'ugc_content', icon: '📹', nameFr: 'Créer du contenu UGC', nameEn: 'Create UGC content', points: 300, frequency: 2, defaultEngagement: [3, 8, 15] },
    { id: 'share_purchase', icon: '📤', nameFr: 'Partager un achat', nameEn: 'Share a purchase', points: 50, frequency: 4, defaultEngagement: [8, 15, 30] },
  ],
  engagement: [
    { id: 'quiz', icon: '❓', nameFr: 'Compléter un quiz', nameEn: 'Complete a quiz', points: 50, frequency: 4, defaultEngagement: [25, 40, 60] },
    { id: 'poll', icon: '📊', nameFr: 'Répondre à un sondage', nameEn: 'Answer a poll', points: 30, frequency: 6, defaultEngagement: [30, 45, 65] },
    { id: 'profile_complete', icon: '✏️', nameFr: 'Compléter son profil', nameEn: 'Complete profile', points: 100, frequency: 1, defaultEngagement: [40, 60, 80] },
  ],
  purchase: [
    { id: 'min_basket', icon: '🛒', nameFr: 'Panier minimum 100€', nameEn: 'Min basket €100', points: 200, frequency: 3, defaultEngagement: [15, 30, 50] },
    { id: 'subscribe', icon: '🔄', nameFr: 'Souscrire un abonnement', nameEn: 'Subscribe', points: 500, frequency: 1, defaultEngagement: [5, 15, 30] },
    { id: 'cross_sell', icon: '🔀', nameFr: 'Acheter une autre catégorie', nameEn: 'Buy from another category', points: 150, frequency: 2, defaultEngagement: [10, 20, 35] },
  ],
};

// ── Reward catalog (CSM) ──
export const REWARD_CATALOG = {
  monetary: [
    { type: 'promo_percent', nameFr: '-5% sur la commande', nameEn: '-5% off order', rewardUsage: 'burn', pointsCost: 250, realCost: 4, minPurchase: 50 },
    { type: 'promo_percent', nameFr: '-10% sur la commande', nameEn: '-10% off order', rewardUsage: 'burn', pointsCost: 500, realCost: 8, minPurchase: 80 },
    { type: 'promo_percent', nameFr: '-15% sur la commande', nameEn: '-15% off order', rewardUsage: 'burn', pointsCost: 750, realCost: 12, minPurchase: 100 },
    { type: 'gift_voucher', nameFr: 'Bon de 5€', nameEn: '€5 voucher', rewardUsage: 'burn', pointsCost: 500, realCost: 5, minPurchase: 40 },
    { type: 'gift_voucher', nameFr: 'Bon de 10€', nameEn: '€10 voucher', rewardUsage: 'burn', pointsCost: 1000, realCost: 10, minPurchase: 80 },
    { type: 'gift_voucher', nameFr: 'Bon de 20€', nameEn: '€20 voucher', rewardUsage: 'burn', pointsCost: 2000, realCost: 20, minPurchase: 120 },
  ],
  experiential: [
    { type: 'free_delivery', nameFr: 'Livraison offerte', nameEn: 'Free delivery', rewardUsage: 'burn', pointsCost: 200, realCost: 5, minPurchase: 0 },
    { type: 'free_product', nameFr: 'Échantillon gratuit', nameEn: 'Free sample', rewardUsage: 'perk', pointsCost: 0, realCost: 3, minPurchase: 0 },
    { type: 'free_product', nameFr: 'Produit mystère', nameEn: 'Mystery product', rewardUsage: 'perk', pointsCost: 0, realCost: 15, minPurchase: 0 },
    { type: 'early_access', nameFr: 'Accès anticipé ventes', nameEn: 'Early access to sales', rewardUsage: 'perk', pointsCost: 0, realCost: 0, minPurchase: 0 },
    { type: 'experience', nameFr: 'Invitation événement VIP', nameEn: 'VIP event invitation', rewardUsage: 'perk', pointsCost: 0, realCost: 50, minPurchase: 0 },
    { type: 'experience', nameFr: 'Personal shopper', nameEn: 'Personal shopper', rewardUsage: 'perk', pointsCost: 0, realCost: 30, minPurchase: 0 },
  ],
};

export const DEFAULT_MISSIONS = [
  {
    id: 'purchase', icon: '🛒',
    nameFr: 'Réaliser un achat', nameEn: 'Make a purchase',
    points: 1, frequency: 4, enabled: true, isPurchaseMission: true,
    engagementByTier: [100, 100, 100],
  },
  {
    id: 'review', icon: '⭐',
    nameFr: 'Avis produit', nameEn: 'Product review',
    points: 100, frequency: 3, enabled: true,
    engagementByTier: [10, 25, 45],
  },
  {
    id: 'birthday', icon: '🎂',
    nameFr: 'Anniversaire', nameEn: 'Birthday',
    points: 200, frequency: 1, enabled: true,
    engagementByTier: [30, 50, 70],
  },
  {
    id: 'social_share', icon: '📱',
    nameFr: 'Partage social', nameEn: 'Social share',
    points: 50, frequency: 4, enabled: true,
    engagementByTier: [8, 15, 30],
  },
  {
    id: 'first_purchase', icon: '🛍️',
    nameFr: 'Premier achat', nameEn: 'First purchase',
    points: 150, frequency: 1, enabled: true,
    engagementByTier: [100, 100, 100],
  },
  {
    id: 'newsletter', icon: '📧',
    nameFr: 'Inscription newsletter', nameEn: 'Newsletter signup',
    points: 75, frequency: 1, enabled: true,
    engagementByTier: [40, 55, 70],
  },
  {
    id: 'account_creation', icon: '👤',
    nameFr: 'Création de compte', nameEn: 'Account creation',
    points: 100, frequency: 1, enabled: true,
    engagementByTier: [100, 100, 100],
  },
];

// ── Engagement scenarios (scale engagement rates globally) ──
export const ENGAGEMENT_SCENARIOS = {
  low: {
    nameFr: 'Conservateur', nameEn: 'Conservative',
    multiplier: 0.6,
    descFr: 'Engagement faible — seuls les clients les plus motivés participent.',
    descEn: 'Low engagement — only the most motivated customers participate.',
  },
  medium: {
    nameFr: 'Base', nameEn: 'Base',
    multiplier: 1.0,
    descFr: 'Engagement moyen — estimation réaliste.',
    descEn: 'Average engagement — realistic estimate.',
  },
  high: {
    nameFr: 'Optimiste', nameEn: 'Optimistic',
    multiplier: 1.4,
    descFr: 'Engagement élevé — programme très actif.',
    descEn: 'High engagement — very active program.',
  },
};

// ── Reward types ──
export const REWARD_TYPES = [
  { id: 'free_delivery', icon: '🚚', nameFr: 'Livraison gratuite', nameEn: 'Free delivery' },
  { id: 'promo_percent', icon: '🏷️', nameFr: 'Code promo %', nameEn: 'Promo code %' },
  { id: 'gift_voucher', icon: '💳', nameFr: 'Bon cadeau €', nameEn: 'Gift voucher €' },
  { id: 'free_product', icon: '🎁', nameFr: 'Produit offert', nameEn: 'Free product' },
  { id: 'experience', icon: '✨', nameFr: 'Expérience', nameEn: 'Experience' },
  { id: 'early_access', icon: '🔑', nameFr: 'Accès anticipé', nameEn: 'Early access' },
  { id: 'custom', icon: '⚙️', nameFr: 'Personnalisé', nameEn: 'Custom' },
];

export const REWARD_USAGE_OPTIONS = [
  { value: 'burn', labelFr: 'Burn (points)', labelEn: 'Burn (points)' },
  { value: 'perk', labelFr: 'Perk (palier)', labelEn: 'Perk (tier)' },
  { value: 'both', labelFr: 'Les deux', labelEn: 'Both' },
];

// ── Default rewards catalog ──
// Step 3 = catalog only (no tier assignment). Tier assignment happens in Step 4.
export const DEFAULT_REWARDS = [
  {
    id: 'r1', type: 'free_delivery',
    nameFr: 'Livraison gratuite', nameEn: 'Free delivery',
    rewardUsage: 'burn',
    pointsCost: 200, realCost: 5,
    minPurchase: 0,
    assignedTiers: [true, true, true],
    utilizationByTier: [30, 40, 50],
  },
  {
    id: 'r2', type: 'promo_percent',
    nameFr: '-10% sur la commande', nameEn: '-10% off order',
    rewardUsage: 'burn',
    pointsCost: 500, realCost: 8,
    minPurchase: 90,
    assignedTiers: [true, true, true],
    utilizationByTier: [20, 35, 50],
  },
  {
    id: 'r3', type: 'gift_voucher',
    nameFr: 'Bon de 10€', nameEn: '10€ voucher',
    rewardUsage: 'burn',
    pointsCost: 1000, realCost: 10,
    minPurchase: 90,
    assignedTiers: [false, true, true],
    utilizationByTier: [0, 25, 40],
  },
  {
    id: 'r4', type: 'free_product',
    nameFr: 'Produit mystère', nameEn: 'Mystery product',
    rewardUsage: 'perk',
    pointsCost: 0, realCost: 15,
    minPurchase: 0,
    assignedTiers: [false, false, true],
    utilizationByTier: [0, 0, 60],
  },
];

// ── Onboarding industries ──
export const INDUSTRIES = [
  { id: 'fashion', emoji: '👗', nameFr: 'Mode', nameEn: 'Fashion' },
  { id: 'beauty', emoji: '💄', nameFr: 'Beauté', nameEn: 'Beauty' },
  { id: 'food', emoji: '🍽️', nameFr: 'Alimentation', nameEn: 'Food & Beverage' },
  { id: 'health', emoji: '🌿', nameFr: 'Santé / Compléments', nameEn: 'Health / Supplements' },
  { id: 'electronics', emoji: '📱', nameFr: 'Électronique', nameEn: 'Electronics' },
  { id: 'sports', emoji: '⚽', nameFr: 'Sport', nameEn: 'Sports' },
  { id: 'home', emoji: '🏠', nameFr: 'Maison', nameEn: 'Home & Garden' },
  { id: 'other', emoji: '🔹', nameFr: 'Autre', nameEn: 'Other' },
];

export const PRICE_RANGES = [
  { id: 'low', labelFr: '< 30€', labelEn: '< €30', avg: 20 },
  { id: 'medium', labelFr: '30-80€', labelEn: '€30-80', avg: 55 },
  { id: 'high', labelFr: '80-200€', labelEn: '€80-200', avg: 120 },
  { id: 'premium', labelFr: '> 200€', labelEn: '> €200', avg: 300 },
];

export const GOALS = [
  { id: 'retention', emoji: '🔄', labelFr: 'Fidélisation', labelEn: 'Retention' },
  { id: 'aov', emoji: '📈', labelFr: 'Augmenter le panier', labelEn: 'Increase AOV' },
  { id: 'engagement', emoji: '💬', labelFr: 'Engagement', labelEn: 'Engagement' },
  { id: 'referral', emoji: '🤝', labelFr: 'Parrainage', labelEn: 'Referrals' },
];
