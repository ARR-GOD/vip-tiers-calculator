// Industry benchmarks for loyalty programs (e-commerce)
// Sources: Bond Brand Loyalty, Antavo, Open Loyalty, Loyoly internal data

export const BENCHMARKS = {
  cashbackRate: {
    low: 1,
    median: 3,
    high: 5,
    max: 10,
    unit: '%',
    labelFr: 'Taux de cashback',
    labelEn: 'Cashback rate',
    recoFr: (v) => v < 1 ? 'Très bas — peu incitatif' : v <= 3 ? 'Standard e-commerce' : v <= 5 ? 'Généreux — fort engagement' : 'Très élevé — vérifiez vos marges',
    recoEn: (v) => v < 1 ? 'Very low — weak incentive' : v <= 3 ? 'E-commerce standard' : v <= 5 ? 'Generous — high engagement' : 'Very high — check your margins',
  },
  burnRate: {
    low: 20,
    median: 40,
    high: 60,
    max: 100,
    unit: '%',
    labelFr: 'Taux de burn',
    labelEn: 'Burn rate',
    recoFr: (v) => v < 20 ? 'Très bas — engagement faible' : v <= 40 ? 'Standard marché' : v <= 60 ? 'Élevé — bon engagement' : 'Très élevé — coût à surveiller',
    recoEn: (v) => v < 20 ? 'Very low — weak engagement' : v <= 40 ? 'Market standard' : v <= 60 ? 'High — good engagement' : 'Very high — watch costs',
  },
  tierCount: {
    low: 2,
    median: 3,
    high: 4,
    labelFr: 'Nombre de paliers',
    labelEn: 'Number of tiers',
    recoFr: (v) => v === 2 ? 'Simple — adapté aux petites bases' : v === 3 ? 'Standard marché — le plus courant' : 'Premium — pour grandes bases',
    recoEn: (v) => v === 2 ? 'Simple — suited for small bases' : v === 3 ? 'Market standard — most common' : 'Premium — for large bases',
  },
  pointsMultiplier: {
    low: 1,
    median: 1.5,
    high: 3,
    max: 5,
    labelFr: 'Multiplicateur points',
    labelEn: 'Points multiplier',
    recoFr: (v) => v <= 1.25 ? 'Faible différenciation' : v <= 2 ? 'Bon équilibre' : v <= 3 ? 'Fort avantage VIP' : 'Très agressif',
    recoEn: (v) => v <= 1.25 ? 'Low differentiation' : v <= 2 ? 'Good balance' : v <= 3 ? 'Strong VIP advantage' : 'Very aggressive',
  },
  grossMargin: {
    low: 30,
    median: 50,
    high: 70,
    labelFr: 'Marge brute',
    labelEn: 'Gross margin',
  },
  expirationMonths: {
    low: 6,
    median: 12,
    high: 24,
    labelFr: 'Expiration des points',
    labelEn: 'Points expiration',
    recoFr: (v) => v <= 6 ? 'Agressif — pousse à l\'usage rapide' : v <= 12 ? 'Standard marché' : v <= 24 ? 'Souple — fidélise long terme' : 'Très long — risque de breakage',
    recoEn: (v) => v <= 6 ? 'Aggressive — pushes quick use' : v <= 12 ? 'Market standard' : v <= 24 ? 'Flexible — long term loyalty' : 'Very long — breakage risk',
  },
  referralPoints: {
    low: 200,
    median: 500,
    high: 1000,
    labelFr: 'Points parrainage',
    labelEn: 'Referral points',
  },
  reviewPoints: {
    low: 50,
    median: 100,
    high: 200,
    labelFr: 'Points avis',
    labelEn: 'Review points',
  },
};

// Return benchmark status: 'low', 'ok', 'high'
export function getBenchmarkStatus(key, value) {
  const b = BENCHMARKS[key];
  if (!b) return 'ok';
  if (value < b.low) return 'low';
  if (value > (b.high || b.max)) return 'high';
  return 'ok';
}

// Return a color for the status
export function getBenchmarkColor(status) {
  if (status === 'low') return { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200' };
  if (status === 'high') return { bg: 'bg-red-50', text: 'text-red-500', border: 'border-red-200' };
  return { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' };
}

// Get recommendation text
export function getBenchmarkReco(key, value, lang) {
  const b = BENCHMARKS[key];
  if (!b || !b.recoFr) return '';
  return lang === 'fr' ? b.recoFr(value) : b.recoEn(value);
}
