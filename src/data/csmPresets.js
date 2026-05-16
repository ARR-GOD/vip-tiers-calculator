import { DEFAULT_MISSIONS } from './defaults';
import { INDUSTRY_PRESETS } from './onboardingPresets';

const DEFAULT_TIER_COLORS = ['#B87333', '#9CA3AF', '#D97706'];

// Map HubSpot industry strings → app industry keys
const HUBSPOT_INDUSTRY_MAP = {
  // French
  'Mode': 'fashion', 'Vêtements': 'fashion', 'Textile': 'fashion', 'Prêt-à-porter': 'fashion',
  'Beauté': 'beauty', 'Cosmétiques': 'beauty', 'Soins': 'beauty',
  'Alimentation': 'food', 'Alimentaire': 'food', 'Boissons': 'food', 'Épicerie': 'food',
  'Santé': 'health', 'Bien-être': 'health', 'Pharma': 'health', 'Compléments': 'health',
  'Électronique': 'electronics', 'Tech': 'electronics', 'Informatique': 'electronics',
  'Sport': 'sports', 'Outdoor': 'sports', 'Fitness': 'sports',
  'Maison': 'home', 'Décoration': 'home', 'Mobilier': 'home', 'Jardin': 'home',
  // English
  'Fashion': 'fashion', 'Apparel': 'fashion', 'Clothing': 'fashion',
  'Beauty': 'beauty', 'Cosmetics': 'beauty', 'Skincare': 'beauty',
  'Food': 'food', 'Food & Beverage': 'food', 'Grocery': 'food', 'F&B': 'food',
  'Health': 'health', 'Wellness': 'health', 'Healthcare': 'health', 'Supplements': 'health',
  'Electronics': 'electronics', 'Technology': 'electronics',
  'Sports': 'sports', 'Sporting Goods': 'sports',
  'Home': 'home', 'Home & Garden': 'home', 'Furniture': 'home',
  // Loyoly-specific
  'CBD': 'health', 'Bijoux': 'fashion', 'Jewelry': 'fashion',
  'Accessoires': 'fashion', 'Accessories': 'fashion',
  'Bébé': 'home', 'Baby': 'home', 'Kids': 'fashion',
  'Animaux': 'other', 'Pets': 'other', 'Pet Care': 'other',
};

function mapHubSpotIndustry(rawIndustry) {
  if (!rawIndustry) return 'other';
  // Try exact match first
  if (HUBSPOT_INDUSTRY_MAP[rawIndustry]) return HUBSPOT_INDUSTRY_MAP[rawIndustry];
  // Try case-insensitive match
  const lower = rawIndustry.toLowerCase();
  for (const [key, val] of Object.entries(HUBSPOT_INDUSTRY_MAP)) {
    if (key.toLowerCase() === lower) return val;
  }
  // Try partial match
  for (const [key, val] of Object.entries(HUBSPOT_INDUSTRY_MAP)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return val;
  }
  return 'other';
}

function deriveProgramType(plan) {
  const p = (plan || '').toLowerCase();
  if (p.includes('enterprise')) return 'luxury';
  if (p.includes('premium') || p.includes('advanced')) return 'mid';
  if (p.includes('lite') || p.includes('starter') || p.includes('basic')) return 'mass';
  return 'mid'; // default
}

function estimatePriceRange(annualRevenue, annualOrders) {
  if (!annualRevenue || !annualOrders) return 'medium';
  const aov = annualRevenue / annualOrders;
  if (aov < 30) return 'low';
  if (aov < 80) return 'medium';
  if (aov < 200) return 'high';
  return 'premium';
}

export function applyCsmDefaults(company, lang) {
  const industryKey = mapHubSpotIndustry(
    company.industry || company.industries || company.vertical || ''
  );
  const preset = INDUSTRY_PRESETS[industryKey] || INDUSTRY_PRESETS.other;
  const programType = deriveProgramType(company.plan);

  // Estimate AOV: use actual data if available, otherwise preset
  const annualRevenue = parseFloat(company.annualrevenue || company.annualRevenue) || 0;
  const annualOrders = parseInt(company.annual_orders || company.annualOrders) || 0;
  const aov = (annualRevenue > 0 && annualOrders > 0)
    ? Math.round(annualRevenue / annualOrders)
    : preset.aov;

  const grossMargin = preset.grossMargin;

  // Program type adjustments
  let cashbackRate = preset.cashbackRate;
  let burnRate = preset.burnRate;
  let hasMissions = true;
  let rewardType = 'both';

  if (programType === 'luxury') {
    hasMissions = false;
    rewardType = 'perks';
    cashbackRate = 0;
    burnRate = 0;
  } else if (programType === 'mass') {
    cashbackRate = Math.min(cashbackRate + 1, 8);
    burnRate = Math.min(burnRate + 10, 60);
  }

  const tierNames = lang === 'fr' ? preset.tierNamesFr : preset.tierNamesEn;
  const spendThresholds = [0, Math.round(aov * 5), Math.round(aov * 20)];

  const tiers = tierNames.map((name, i) => ({
    name,
    color: DEFAULT_TIER_COLORS[i] || '#5A8AFF',
    threshold: preset.tierThresholds[i],
    spendThreshold: spendThresholds[i] || 0,
    pointsThreshold: i * 1000,
    pointsMultiplier: preset.multipliers[i],
    perks: [],
  }));

  const rewards = preset.rewards.map(r => ({
    ...r,
    assignedTiers: tiers.map((_, i) => {
      if (r.rewardUsage === 'perk') return i >= 1;
      return true;
    }),
    utilizationByTier: tiers.map((_, i) => {
      if (r.rewardUsage === 'perk') return i >= 1 ? 30 + i * 10 : 0;
      return 20 + i * 10;
    }),
  }));

  const config = {
    tierBasis: 'spend',
    hasMissions,
    hasTiers: true,
    rewardType,
    pointsExpire: true,
    expirationMonths: 12,
    expirationType: 'rolling',
    tiersExpire: true,
    tierExpirationMonths: 12,
    tierExpirationType: 'rolling',
  };

  const settings = {
    segmentationType: 'revenue',
    caWeight: 0.5,
    aov,
    grossMargin,
    cashbackRate,
    pointsPerEuro: 100,
  };

  const missions = DEFAULT_MISSIONS
    .filter(m => {
      if (m.isPurchaseMission) return true;
      if (!hasMissions) return false;
      return true;
    })
    .map(m => ({
      ...m,
      enabled: true,
      engagementByTier: [...(m.engagementByTier || [20, 30, 50])],
    }));

  return { config, settings, tiers, rewards, missions, burnRate };
}

export function buildCsmOnboardingAnswers(company) {
  const annualRevenue = parseFloat(company.annualrevenue || company.annualRevenue) || 0;
  const annualOrders = parseInt(company.annual_orders || company.annualOrders) || 0;

  return {
    industry: mapHubSpotIndustry(
      company.industry || company.industries || company.vertical || ''
    ),
    priceRange: estimatePriceRange(annualRevenue, annualOrders),
    goals: [],
  };
}
