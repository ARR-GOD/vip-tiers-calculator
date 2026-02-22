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
export const DEFAULT_MISSIONS = [
  {
    id: 'referral', icon: '🤝',
    nameFr: 'Parrainage', nameEn: 'Referral',
    points: 500, frequency: 1, enabled: true,
    engagementByTier: [5, 10, 20], // % of Bronze, Silver, Gold customers
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
    minPurchase: 50,
    assignedTiers: [true, true, true],
    utilizationByTier: [20, 35, 50],
  },
  {
    id: 'r3', type: 'gift_voucher',
    nameFr: 'Bon de 10€', nameEn: '10€ voucher',
    rewardUsage: 'burn',
    pointsCost: 1000, realCost: 10,
    minPurchase: 60,
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
