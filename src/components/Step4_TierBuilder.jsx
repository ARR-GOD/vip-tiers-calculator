import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Plus, Minus, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import Tooltip from './Tooltip';
import BenchmarkBadge from './BenchmarkBadge';
import { computeCustomerScores, assignTiers, computeTierStats, computeTierFinancials, computePointsEconomy, derivePointsFromCashback, formatCurrency, formatNumber, formatPercent, formatCompact, getSortedByMetric, metricForBasis, thresholdForTierPct, thresholdKeyForBasis } from '../utils/calculations';
import { DEFAULT_TIER_NAMES_FR, DEFAULT_TIER_NAMES_EN, REWARD_TYPES } from '../data/defaults';

const FIXED_COLORS = ['#B87333', '#9CA3AF', '#D97706', '#7C3AED', '#0EA5E9', '#10B981', '#F43F5E', '#F59E0B'];

// Per-tier badge styling: bg + text color for the header badge
const TIER_BADGE_STYLES = [
  { bg: '#FDF3E7', text: '#B87333' }, // Bronze
  { bg: '#E5E1D8', text: '#8A7D6B' }, // Silver
  { bg: '#FFFBEB', text: '#D97706' }, // Gold
  { bg: '#E8EFFE', text: '#7C3AED' }, // Platinum
  { bg: '#E0F2FE', text: '#0369A1' }, // Sky
  { bg: '#D1FAE5', text: '#047857' }, // Emerald
  { bg: '#FEE2E2', text: '#B91C1C' }, // Rose
  { bg: '#FEF3C7', text: '#B45309' }, // Amber
];

function getPillColor(value, max) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  if (pct >= 100) return { bg: 'rgba(16,185,129,0.12)', text: '#059669', bar: '#10B981' };
  if (pct >= 50) return { bg: 'rgba(245,158,11,0.12)', text: '#D97706', bar: '#F59E0B' };
  return { bg: 'rgba(239,68,68,0.12)', text: '#DC2626', bar: '#EF4444' };
}

export default function Step4_TierBuilder({ tiers, setTiers, rewards, setRewards, burnRate, setBurnRate, customers, settings, config, missions, customMissions, lang, brandAnalysis, clientName, onPrev, onNext }) {
  const t = lang === 'fr';

  const { pointsPerEuro } = useMemo(
    () => derivePointsFromCashback(settings.cashbackRate, settings.pointsPerEuro),
    [settings.cashbackRate, settings.pointsPerEuro]
  );

  // Memoised DESC sort by the relevant metric — used both for tier assignment
  // and for bidirectional % ↔ threshold computation. ~50ms on 380k customers.
  const sortedByMetric = useMemo(
    () => getSortedByMetric(customers, config.tierBasis, pointsPerEuro),
    [customers, config.tierBasis, pointsPerEuro]
  );

  const tierStats = useMemo(() => {
    const scored = computeCustomerScores(customers, settings.segmentationType, settings.caWeight);
    const assigned = assignTiers(scored, tiers, config.tierBasis, { pointsPerEuro });
    return computeTierStats(assigned, tiers);
  }, [customers, settings, tiers, config, pointsPerEuro]);

  // Edit-by-percent: when user types a % for tier i, recompute that tier's threshold.
  const updateTierByPct = useCallback((tierIdx, desiredPct) => {
    const newThreshold = thresholdForTierPct({
      sortedCustomers: sortedByMetric,
      tiers,
      tierIndex: tierIdx,
      desiredPct,
      basis: config.tierBasis,
      pointsPerEuro,
    });
    const key = thresholdKeyForBasis(config.tierBasis);
    setTiers(prev => prev.map((t, i) => i === tierIdx ? { ...t, [key]: newThreshold } : t));
  }, [sortedByMetric, tiers, config.tierBasis, pointsPerEuro, setTiers]);

  const tierFinancials = useMemo(() => {
    return tiers.map((_, i) => computeTierFinancials(i, tierStats[i], rewards, settings.grossMargin, burnRate));
  }, [tiers, tierStats, rewards, settings.grossMargin, burnRate]);

  const pointsEconomy = useMemo(() => {
    return computePointsEconomy(tierStats, tiers, missions, customMissions, rewards, settings, burnRate);
  }, [tierStats, tiers, missions, customMissions, rewards, settings, burnRate]);

  const addTier = () => {
    const idx = tiers.length;
    const names = t ? DEFAULT_TIER_NAMES_FR : DEFAULT_TIER_NAMES_EN;
    setTiers(prev => [...prev, {
      name: names[idx] || `Tier ${idx + 1}`,
      color: FIXED_COLORS[idx % FIXED_COLORS.length] || '#5A8AFF',
      threshold: Math.max(5, Math.round(prev[prev.length - 1]?.threshold * 0.5 || 10)),
      spendThreshold: (prev[prev.length - 1]?.spendThreshold || 0) * 2 || 5000,
      pointsThreshold: (idx) * 1500,
      orderThreshold: Math.max(1, Math.round((prev[prev.length - 1]?.orderThreshold || 1) * 2)),
      pointsMultiplier: 1 + idx * 0.5,
      perks: [],
    }]);
  };

  const removeTier = () => {
    if (tiers.length <= 2) return;
    setTiers(prev => prev.slice(0, -1));
  };

  const updateTier = (idx, field, value) => {
    setTiers(prev => prev.map((tier, i) => i === idx ? { ...tier, [field]: value } : tier));
  };

  const toggleRewardForTier = (rewardId, tierIdx) => {
    setRewards(prev => {
      // Snapshot the tier's current average utilization so newly-toggled rewards
      // inherit it instead of the hardcoded 30 default.
      const assignedInTier = prev.filter(r => r.assignedTiers?.[tierIdx]);
      const avgUtil = assignedInTier.length > 0
        ? Math.round(assignedInTier.reduce((s, r) => s + (r.utilizationByTier?.[tierIdx] ?? burnRate), 0) / assignedInTier.length)
        : burnRate;
      return prev.map(r => {
        if (r.id !== rewardId) return r;
        const assigned = [...(r.assignedTiers || [])];
        const nowOn = !assigned[tierIdx];
        assigned[tierIdx] = nowOn;
        const util = [...(r.utilizationByTier || [])];
        // Seed utilization to the tier's current average when turning ON
        if (nowOn && (util[tierIdx] === undefined || util[tierIdx] === 0)) {
          util[tierIdx] = avgUtil;
        }
        return { ...r, assignedTiers: assigned, utilizationByTier: util };
      });
    });
  };

  const updateUtilization = (rewardId, tierIdx, value) => {
    setRewards(prev => prev.map(r => {
      if (r.id !== rewardId) return r;
      const util = [...(r.utilizationByTier || [])];
      util[tierIdx] = Math.max(0, Math.min(100, value));
      return { ...r, utilizationByTier: util };
    }));
  };

  // Sets the utilization rate for ALL rewards assigned to this tier to the same
  // value. Useful for quickly setting a baseline; individual rewards can still
  // be tweaked afterwards via the per-row input.
  const setTierAvgUtilization = (tierIdx, value) => {
    const v = Math.max(0, Math.min(100, parseInt(value) || 0));
    setRewards(prev => prev.map(r => {
      if (!r.assignedTiers?.[tierIdx]) return r;
      const util = [...(r.utilizationByTier || [])];
      util[tierIdx] = v;
      return { ...r, utilizationByTier: util };
    }));
  };

  // Average utilization across rewards assigned to a tier (display value).
  const getTierAvgUtilization = (tierIdx) => {
    const assigned = rewards.filter(r => r.assignedTiers?.[tierIdx]);
    if (assigned.length === 0) return 0;
    const sum = assigned.reduce((s, r) => s + (r.utilizationByTier?.[tierIdx] ?? burnRate), 0);
    return Math.round(sum / assigned.length);
  };

  const maxRevenue = Math.max(...tierStats.map(s => s?.revenue || 0), 1);

  // ── Carousel state ──
  const scrollRef = useRef(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [showArrows, setShowArrows] = useState(false);

  const checkOverflow = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowArrows(el.scrollWidth > el.clientWidth + 4);
  }, []);

  useEffect(() => {
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [tiers.length, checkOverflow]);

  const scrollTo = (dir) => {
    const el = scrollRef.current;
    if (!el) return;
    const cardW = 260 + 12; // min-width + gap
    el.scrollBy({ left: dir === 'right' ? cardW : -cardW, behavior: 'smooth' });
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const cardW = 260 + 12;
    const idx = Math.round(el.scrollLeft / cardW);
    setActiveIdx(Math.max(0, Math.min(idx, tiers.length - 1)));
  };

  const scrollToIdx = (idx) => {
    const el = scrollRef.current;
    if (!el) return;
    const cardW = 260 + 12;
    el.scrollTo({ left: idx * cardW, behavior: 'smooth' });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="section-subheader">{t ? 'ÉTAPE 6' : 'STEP 6'}</div>
          <h2 className="text-[28px] font-bold text-[#52473C]">{t ? 'Constructeur de paliers VIP' : 'VIP Tier Builder'}</h2>
          <p className="text-[15px] text-[#645648] mt-0.5">{t ? 'Définissez vos paliers et attribuez les récompenses.' : 'Define your tiers and assign rewards.'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={removeTier} disabled={tiers.length <= 2} className="btn-secondary px-2 py-1.5 disabled:opacity-30">
            <Minus size={14} />
          </button>
          <span className="text-[13px] font-medium text-[#645648]">{tiers.length} {t ? 'paliers' : 'tiers'}</span>
          <button onClick={addTier} className="btn-secondary px-2 py-1.5">
            <Plus size={14} />
          </button>
          <BenchmarkBadge benchmarkKey="tierCount" value={tiers.length} lang={lang} />
        </div>
      </div>

      {/* Burn rate */}
      <div className="card flex items-center gap-4" style={{ padding: 16 }}>
        <label className="text-[13px] font-medium text-[#645648]">{t ? 'Taux de burn global' : 'Global burn rate'}</label>
        <Tooltip text={t ? '% des clients qui utilisent leurs points pour des récompenses burn.' : '% of customers who redeem points for burn rewards.'} />
        <input type="range" min={10} max={80} step={5} value={burnRate}
          onChange={e => setBurnRate(parseInt(e.target.value))}
          className="flex-1" />
        <span className="text-[15px] font-bold text-primary w-12 text-right">{burnRate}%</span>
        <BenchmarkBadge benchmarkKey="burnRate" value={burnRate} lang={lang} />
      </div>

      {/* Tier cards — horizontal scrollable row */}
      <div>
        <div className="section-header">{t ? 'PALIERS VIP' : 'VIP TIERS'}</div>
        <div className="relative">
          {/* Left arrow */}
          {showArrows && (
            <button
              onClick={() => scrollTo('left')}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 w-10 h-10 rounded-full bg-[#EEEDE6] shadow-md flex items-center justify-center hover:shadow-lg transition-shadow"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
            >
              <ChevronLeft size={18} className="text-[#645648]" />
            </button>
          )}

          {/* Right arrow */}
          {showArrows && (
            <button
              onClick={() => scrollTo('right')}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-20 w-10 h-10 rounded-full bg-[#EEEDE6] shadow-md flex items-center justify-center hover:shadow-lg transition-shadow"
              style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}
            >
              <ChevronRight size={18} className="text-[#645648]" />
            </button>
          )}

          {/* Scrollable container */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex gap-3 overflow-x-auto tier-scroll"
            style={{
              scrollBehavior: 'smooth',
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              maskImage: showArrows ? 'linear-gradient(to right, transparent 0px, black 40px, black calc(100% - 40px), transparent 100%)' : 'none',
              WebkitMaskImage: showArrows ? 'linear-gradient(to right, transparent 0px, black 40px, black calc(100% - 40px), transparent 100%)' : 'none',
            }}
          >
            {tiers.map((tier, tierIdx) => {
              const stat = tierStats[tierIdx];
              const fin = tierFinancials[tierIdx];
              const revPct = stat ? (stat.revenue / maxRevenue) * 100 : 0;
              const pillColors = getPillColor(stat?.revenue || 0, maxRevenue * 0.5);
              const badgeStyle = TIER_BADGE_STYLES[tierIdx % TIER_BADGE_STYLES.length] || TIER_BADGE_STYLES[0];
              const tierColor = tier.color || FIXED_COLORS[tierIdx] || '#2965FE';

              return (
                <div
                  key={tierIdx}
                  className="card overflow-hidden flex-shrink-0"
                  style={{
                    width: 260,
                    minWidth: 260,
                    maxWidth: 260,
                    borderLeft: `3px solid ${tierColor}`,
                    scrollSnapAlign: 'start',
                    padding: 16,
                  }}
                >
                  {/* Card header with badge */}
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <span
                          className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider mb-2"
                          style={{ backgroundColor: badgeStyle.bg, color: badgeStyle.text }}
                        >
                          {tier.name}
                        </span>
                        <input type="text" value={tier.name}
                          onChange={e => updateTier(tierIdx, 'name', e.target.value)}
                          className="text-[20px] font-bold text-[#52473C] bg-transparent border-b border-transparent hover:border-[#D9D5CB] focus:border-primary focus:outline-none w-full max-w-[180px] block" style={{ padding: 0 }} />
                      </div>
                      <div className="text-right">
                        <div className="text-[22px] font-bold text-[#52473C] leading-tight" title={`${stat?.count || 0}`}>{formatCompact(stat?.count || 0)}</div>
                        <div className="text-[11px] text-[#645648]">{t ? 'clients' : 'customers'}</div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="mt-4">
                      <div className="progress-bar-track">
                        <div className="progress-bar-fill" style={{ width: `${Math.min(revPct, 100)}%`, backgroundColor: pillColors.bar }} />
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="pill" style={{ background: pillColors.bg, color: pillColors.text }}>
                          {formatPercent(stat?.percentage || 0)}
                        </span>
                        <span className="text-[12px] text-[#645648]">{t ? 'du total clients' : 'of total customers'}</span>
                      </div>
                    </div>

                    {/* Tier config inputs — bidirectional threshold ↔ % ; spend ↔ orders via AOV */}
                    {(() => {
                      const basis = config.tierBasis;
                      const aov = settings.aov || 60;
                      const spendVal = tier.spendThreshold ?? 0;
                      const ordersVal = tier.orderThreshold ?? 0;
                      const pointsVal = tier.pointsThreshold ?? 0;
                      const activeKey = basis === 'orders' ? 'orderThreshold' : basis === 'points' ? 'pointsThreshold' : 'spendThreshold';
                      const activeValue = tier[activeKey] ?? 0;
                      const qualifying = (() => {
                        if (!customers || customers.length === 0) return 0;
                        let count = 0;
                        for (const c of customers) {
                          if (metricForBasis(c, basis, pointsPerEuro) >= activeValue) count++;
                        }
                        return count;
                      })();
                      const pctValue = stat?.percentage || 0;

                      // Sync helpers — editing one threshold updates the others
                      const setAllThresholds = ({ spend, orders, points }) => {
                        setTiers(prev => prev.map((tt, i) => i === tierIdx ? { ...tt, spendThreshold: spend, orderThreshold: orders, pointsThreshold: points } : tt));
                      };
                      const handleSpendChange = (val) => {
                        const s = Math.max(0, parseFloat(val) || 0);
                        const o = aov > 0 ? Math.max(0, Math.round(s / aov)) : ordersVal;
                        const p = Math.max(0, Math.round(s * pointsPerEuro));
                        setAllThresholds({ spend: s, orders: o, points: p });
                      };
                      const handleOrdersChange = (val) => {
                        const o = Math.max(0, parseInt(val) || 0);
                        const s = aov > 0 ? Math.max(0, Math.round(o * aov)) : spendVal;
                        const p = Math.max(0, Math.round(s * pointsPerEuro));
                        setAllThresholds({ spend: s, orders: o, points: p });
                      };
                      const handlePointsChange = (val) => {
                        const p = Math.max(0, parseFloat(val) || 0);
                        const s = pointsPerEuro > 0 ? Math.max(0, Math.round(p / pointsPerEuro)) : spendVal;
                        const o = aov > 0 ? Math.max(0, Math.round(s / aov)) : ordersVal;
                        setAllThresholds({ spend: s, orders: o, points: p });
                      };

                      // Inline threshold field — sub-component would remount on every
                      // keystroke (defined inside parent render) and steal focus.
                      // Use type="text" + inputMode to avoid React's known cursor-
                      // jumping bug with type="number" controlled inputs.
                      const renderThresholdField = ({ label, value, onChange, unit, isActive }) => (
                        <div>
                          <label className={`text-[11px] mb-1 block ${isActive ? 'font-semibold text-primary' : 'text-[#8A7D6B]'}`}>
                            {label}{isActive && <span className="ml-1 text-[9px] uppercase">{t ? 'actif' : 'active'}</span>}
                          </label>
                          <div className="flex items-center gap-1">
                            <input
                              type="text" inputMode="numeric" pattern="[0-9]*"
                              value={value}
                              onChange={e => {
                                const cleaned = e.target.value.replace(/[^0-9]/g, '');
                                onChange(cleaned);
                              }}
                              className={`w-20 px-2 py-1 text-[13px] text-center ${isActive ? 'ring-1 ring-primary' : ''}`}
                            />
                            <span className="text-[11px] text-[#8A7D6B]">{unit}</span>
                          </div>
                        </div>
                      );

                      return (
                        <div className="mt-4 pt-4 border-t border-[#D9D5CB] space-y-3">
                          <div className="grid grid-cols-2 gap-x-2 gap-y-2">
                            {renderThresholdField({
                              label: t ? 'Seuil (€)' : 'Spend (€)',
                              value: spendVal, onChange: handleSpendChange, unit: '€',
                              isActive: basis === 'spend',
                            })}
                            {renderThresholdField({
                              label: t ? 'Seuil (cmd)' : 'Orders (#)',
                              value: ordersVal, onChange: handleOrdersChange, unit: t ? 'cmd' : 'orders',
                              isActive: basis === 'orders',
                            })}
                            {config.hasMissions && renderThresholdField({
                              label: t ? 'Seuil (pts)' : 'Points',
                              value: pointsVal, onChange: handlePointsChange, unit: 'pts',
                              isActive: basis === 'points',
                            })}
                            <div>
                              <label className="text-[11px] text-[#8A7D6B] mb-1 block">{t ? '% de clients' : '% of customers'}</label>
                              <div className="flex items-center gap-1">
                                <input type="text" inputMode="numeric" pattern="[0-9]*"
                                  value={Math.round(pctValue * 10) / 10}
                                  onChange={e => {
                                    const cleaned = e.target.value.replace(/[^0-9.]/g, '');
                                    const v = parseFloat(cleaned);
                                    if (!isNaN(v)) updateTierByPct(tierIdx, Math.max(0, Math.min(100, v)));
                                  }}
                                  className="w-16 px-2 py-1 text-[13px] text-center" />
                                <span className="text-[11px] text-[#8A7D6B]">%</span>
                              </div>
                              <div className="text-[10px] text-[#8A7D6B] mt-1">{t ? '↔ seuil actif' : '↔ active threshold'}</div>
                            </div>
                          </div>
                          <div className="text-[10px] text-[#8A7D6B]">
                            {t ? `${formatNumber(qualifying)} clients qualifiés (sur la métrique active "${basis === 'orders' ? 'commandes' : basis === 'points' ? 'points' : 'dépenses'}"). Les seuils sont synchronisés via l'AOV (${aov}€).` : `${formatNumber(qualifying)} qualifying customers (on active metric "${basis}"). Thresholds are synced via AOV (${aov}€).`}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Tier stats grid — compact format so card width stays narrow */}
                    <div className="mt-3 pt-3 border-t border-[#D9D5CB] grid grid-cols-3 gap-2 text-center">
                      <div title={formatCurrency(stat?.revenue || 0)}>
                        <div className="text-[13px] font-bold text-[#52473C]">{formatCompact(stat?.revenue || 0)}€</div>
                        <div className="text-[10px] text-[#8A7D6B]">{t ? 'CA' : 'Revenue'}</div>
                      </div>
                      <div title={formatCurrency(stat?.avgLTV || 0)}>
                        <div className="text-[13px] font-bold text-[#52473C]">{formatCompact(stat?.avgLTV || 0)}€</div>
                        <div className="text-[10px] text-[#8A7D6B]">LTV</div>
                      </div>
                      <div title={formatCurrency(stat?.avgAOV || 0)}>
                        <div className="text-[13px] font-bold text-[#52473C]">{formatCompact(stat?.avgAOV || 0)}€</div>
                        <div className="text-[10px] text-[#8A7D6B]">AOV</div>
                      </div>
                    </div>
                  </div>

                    {/* Per-tier points economy */}
                    {(() => {
                      const pte = pointsEconomy.perTier[tierIdx];
                      if (!pte) return null;
                      return (
                        <div className="mt-2 pt-2 border-t border-[#D9D5CB] grid grid-cols-3 gap-2 text-center">
                          <div>
                            <div className="text-[13px] font-bold text-blue-700">{formatCompact(pte.emitted)}</div>
                            <div className="text-[10px] text-[#8A7D6B]">{t ? 'Pts émis' : 'Emitted'}</div>
                          </div>
                          <div>
                            <div className="text-[13px] font-bold text-green-700">{formatCompact(pte.burned)}</div>
                            <div className="text-[10px] text-[#8A7D6B]">{t ? 'Brûlés' : 'Burned'}</div>
                          </div>
                          <div>
                            <div className="text-[13px] font-bold text-orange-600">{formatCompact(pte.dormant)}</div>
                            <div className="text-[10px] text-[#8A7D6B]">{t ? 'Dormants' : 'Dormant'}</div>
                          </div>
                        </div>
                      );
                    })()}

                  {/* Rewards assignment — toggle pill list */}
                  <div style={{ padding: '12px 16px', backgroundColor: '#FBFAF6', borderTop: '1px solid #E5E1D8', margin: '14px -16px -16px -16px' }}>
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="section-header" style={{ marginBottom: 0, fontSize: 11 }}>
                        {t ? 'RÉCOMPENSES' : 'REWARDS'}
                      </div>
                      {rewards.some(r => r.assignedTiers?.[tierIdx]) && (
                        <div className="flex items-center gap-1">
                          <label className="text-[10px] text-[#8A7D6B]">{t ? 'Util. moyenne' : 'Avg util.'}</label>
                          <input type="text" inputMode="numeric" pattern="[0-9]*"
                            value={getTierAvgUtilization(tierIdx)}
                            onChange={e => setTierAvgUtilization(tierIdx, e.target.value.replace(/[^0-9]/g, ''))}
                            className="w-12 px-1 py-0.5 text-[10px] text-center"
                            title={t ? 'Applique cette valeur à toutes les récompenses du palier' : 'Apply this value to all rewards in this tier'}
                          />
                          <span className="text-[9px] text-[#8A7D6B]">%</span>
                        </div>
                      )}
                    </div>
                    {/* Points multiplier — a tier-level perk that boosts points earning */}
                    {config.hasMissions && (
                      <div className="flex items-center justify-between mb-2 px-2 py-1.5 rounded-lg bg-white border border-primary/30 shadow-[0_1px_2px_rgba(15,15,15,0.04)]">
                        <span className="text-[11px] font-medium text-[#2B251F]" title={t ? 'Tous les achats des clients de ce palier rapportent X fois plus de points.' : 'All purchases in this tier earn X times more points.'}>
                          {t ? '✨ Multiplicateur de points' : '✨ Points multiplier'}
                        </span>
                        <div className="flex items-center gap-0.5 shrink-0">
                          <input type="number" value={tier.pointsMultiplier} min={1} max={5} step={0.25}
                            onChange={e => updateTier(tierIdx, 'pointsMultiplier', parseFloat(e.target.value) || 1)}
                            className="w-12 px-1 py-0 text-[11px] text-center" />
                          <span className="text-[10px] text-[#8A7D6B]">×</span>
                        </div>
                      </div>
                    )}
                    <div className="space-y-1">
                      {rewards.map(reward => {
                        const isAssigned = reward.assignedTiers?.[tierIdx] || false;
                        return (
                          <button
                            key={reward.id}
                            type="button"
                            onClick={() => toggleRewardForTier(reward.id, tierIdx)}
                            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${
                              isAssigned ? 'bg-white border border-primary/30 shadow-[0_1px_2px_rgba(15,15,15,0.04)]' : 'bg-transparent border border-transparent hover:bg-white'
                            }`}
                          >
                            <span
                              role="switch"
                              aria-checked={isAssigned}
                              className={`relative inline-block w-7 h-4 rounded-full transition-colors shrink-0 ${
                                isAssigned ? 'bg-primary' : 'bg-[#D9D5CB]'
                              }`}
                            >
                              <span
                                className="absolute top-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform"
                                style={{ transform: isAssigned ? 'translateX(14px)' : 'translateX(2px)' }}
                              />
                            </span>
                            <span className={`text-[11px] flex-1 truncate ${isAssigned ? 'text-[#2B251F] font-medium' : 'text-[#645648]'}`}
                              title={t ? reward.nameFr : reward.nameEn}>
                              {t ? reward.nameFr : reward.nameEn}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Per-tier financials */}
                    <div className="mt-3 pt-3 border-t border-[#D9D5CB]">
                      <div className="section-header" style={{ marginBottom: 8, fontSize: 11 }}>
                        {t ? 'FINANCES / AN' : 'FINANCIALS / YR'}
                      </div>
                      {fin.hasRewards ? (
                        <div className="space-y-1 text-[12px]">
                          <div className="flex justify-between">
                            <span className="text-[#8A7D6B]">{t ? 'Coût rewards' : 'Rewards cost'}</span>
                            <span className="font-medium text-[#DC2626] tabular-nums" title={formatCurrency(fin.rewardsCost)}>-{formatCompact(fin.rewardsCost)}€</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[#8A7D6B]">{t ? 'Marge brute' : 'Gross profit'}</span>
                            <span className="font-medium text-[#645648] tabular-nums" title={formatCurrency(fin.grossProfit)}>{formatCompact(fin.grossProfit)}€</span>
                          </div>
                          <div className="flex justify-between pt-1.5 border-t border-[#D9D5CB]">
                            <span className="font-medium text-[#645648]">{t ? 'Profit net' : 'Net profit'}</span>
                            <span className={`font-bold tabular-nums ${fin.netProfit >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`}
                              title={formatCurrency(fin.netProfit)}>
                              {fin.netProfit >= 0 ? '+' : ''}{formatCompact(fin.netProfit)}€
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[11px] text-[#8A7D6B] italic">
                          {t ? 'Aucune récompense assignée — assigne-en au moins une pour voir le P&L du palier.' : 'No reward assigned — assign at least one to see the tier P&L.'}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Scroll indicator dots */}
          {showArrows && tiers.length > 1 && (
            <div className="flex items-center justify-center gap-2 mt-3">
              {tiers.map((_, i) => (
                <button
                  key={i}
                  onClick={() => scrollToIdx(i)}
                  className="rounded-full transition-all"
                  style={{
                    width: activeIdx === i ? 20 : 8,
                    height: 8,
                    backgroundColor: activeIdx === i ? '#2965FE' : '#D9D5CB',
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Inline nav */}
      <div className="flex justify-between pt-6">
        {onPrev ? (
          <button onClick={onPrev} className="btn-secondary">
            <ChevronLeft size={16} /> {t ? 'Précédent' : 'Previous'}
          </button>
        ) : <span />}
        {onNext && (
          <button onClick={onNext} className="btn-primary">
            {t ? 'Voir le Dashboard' : 'View Dashboard'} <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
