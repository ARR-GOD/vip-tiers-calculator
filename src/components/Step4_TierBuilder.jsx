import { useMemo, useRef, useState, useEffect, useCallback } from 'react';
import { Plus, Minus, ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import Tooltip from './Tooltip';
import BenchmarkBadge from './BenchmarkBadge';
import { computeCustomerScores, assignTiers, computeTierStats, computeTierFinancials, computePointsEconomy, derivePointsFromCashback, formatCurrency, formatNumber, formatPercent, formatCompact, getSortedByMetric, metricForBasis, thresholdForTierPct, thresholdKeyForBasis } from '../utils/calculations';
import { DEFAULT_TIER_NAMES_FR, DEFAULT_TIER_NAMES_EN, REWARD_TYPES } from '../data/defaults';

const FIXED_COLORS = ['#B87333', '#9CA3AF', '#D97706', '#7C3AED'];

// Per-tier badge styling: bg + text color for the header badge
const TIER_BADGE_STYLES = [
  { bg: '#FDF3E7', text: '#B87333' }, // Bronze
  { bg: '#E5E1D8', text: '#8A7D6B' }, // Silver
  { bg: '#FFFBEB', text: '#D97706' }, // Gold
  { bg: '#E8EFFE', text: '#7C3AED' }, // Platinum
];

function getPillColor(value, max) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  if (pct >= 100) return { bg: 'rgba(16,185,129,0.12)', text: '#059669', bar: '#10B981' };
  if (pct >= 50) return { bg: 'rgba(245,158,11,0.12)', text: '#D97706', bar: '#F59E0B' };
  return { bg: 'rgba(239,68,68,0.12)', text: '#DC2626', bar: '#EF4444' };
}

export default function Step4_TierBuilder({ tiers, setTiers, rewards, setRewards, burnRate, setBurnRate, customers, settings, config, missions, customMissions, lang, brandAnalysis, clientName, onNext }) {
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
    if (tierIdx === 0) return; // bottom tier is always entry-free
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
      color: FIXED_COLORS[idx] || '#5A8AFF',
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
    setRewards(prev => prev.map(r => {
      if (r.id !== rewardId) return r;
      const assigned = [...(r.assignedTiers || [])];
      assigned[tierIdx] = !assigned[tierIdx];
      return { ...r, assignedTiers: assigned };
    }));
  };

  const updateUtilization = (rewardId, tierIdx, value) => {
    setRewards(prev => prev.map(r => {
      if (r.id !== rewardId) return r;
      const util = [...(r.utilizationByTier || [])];
      util[tierIdx] = Math.max(0, Math.min(100, value));
      return { ...r, utilizationByTier: util };
    }));
  };

  const totalFinancials = tierFinancials.reduce((acc, tf) => ({
    rewardsCost: acc.rewardsCost + tf.rewardsCost,
    incrementalRevenue: acc.incrementalRevenue + tf.incrementalRevenue,
    grossProfit: acc.grossProfit + tf.grossProfit,
    netProfit: acc.netProfit + tf.netProfit,
  }), { rewardsCost: 0, incrementalRevenue: 0, grossProfit: 0, netProfit: 0 });

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
    const cardW = 320 + 12; // min-width + gap
    el.scrollBy({ left: dir === 'right' ? cardW : -cardW, behavior: 'smooth' });
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const cardW = 320 + 12;
    const idx = Math.round(el.scrollLeft / cardW);
    setActiveIdx(Math.max(0, Math.min(idx, tiers.length - 1)));
  };

  const scrollToIdx = (idx) => {
    const el = scrollRef.current;
    if (!el) return;
    const cardW = 320 + 12;
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
          <button onClick={addTier} disabled={tiers.length >= 4} className="btn-secondary px-2 py-1.5 disabled:opacity-30">
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
              const badgeStyle = TIER_BADGE_STYLES[tierIdx] || TIER_BADGE_STYLES[0];
              const tierColor = tier.color || FIXED_COLORS[tierIdx] || '#2965FE';

              return (
                <div
                  key={tierIdx}
                  className="card overflow-hidden flex-shrink-0"
                  style={{
                    minWidth: 320,
                    borderLeft: `3px solid ${tierColor}`,
                    scrollSnapAlign: 'start',
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
                        <div className="text-[28px] font-bold text-[#52473C]">{stat?.count || 0}</div>
                        <div className="text-[12px] text-[#645648]">{t ? 'clients' : 'customers'}</div>
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

                    {/* Tier config inputs — bidirectional threshold ↔ % */}
                    {(() => {
                      const basis = config.tierBasis;
                      const thrKey = basis === 'orders' ? 'orderThreshold' : basis === 'points' ? 'pointsThreshold' : 'spendThreshold';
                      const thrValue = tier[thrKey] ?? 0;
                      const unit = basis === 'orders' ? (t ? 'cmd' : 'orders') : basis === 'points' ? 'pts' : '€';
                      const thrLabel = t
                        ? (basis === 'orders' ? "Seuil (commandes)" : basis === 'points' ? 'Seuil (points)' : "Seuil d'entrée (€)")
                        : (basis === 'orders' ? 'Threshold (orders)' : basis === 'points' ? 'Threshold (points)' : 'Entry threshold (€)');
                      const isBottom = tierIdx === 0;
                      const qualifying = (() => {
                        if (!customers || customers.length === 0) return 0;
                        let count = 0;
                        for (const c of customers) {
                          if (metricForBasis(c, basis, pointsPerEuro) >= thrValue) count++;
                        }
                        return count;
                      })();
                      const pctValue = stat?.percentage || 0;
                      return (
                        <div className="mt-4 pt-4 border-t border-[#D9D5CB] grid grid-cols-3 gap-3">
                          <div>
                            <label className="text-[11px] text-[#8A7D6B] mb-1 block">{thrLabel}</label>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={thrValue}
                                min={0}
                                step={basis === 'orders' ? 1 : basis === 'points' ? 100 : 50}
                                onChange={e => updateTier(tierIdx, thrKey, basis === 'orders' ? Math.max(0, parseInt(e.target.value) || 0) : parseFloat(e.target.value) || 0)}
                                disabled={isBottom}
                                className="w-20 px-2 py-1 text-[13px] text-center disabled:opacity-50"
                              />
                              <span className="text-[11px] text-[#8A7D6B]">{unit}</span>
                            </div>
                            <div className="text-[10px] text-[#8A7D6B] mt-1">
                              {t ? `${formatNumber(qualifying)} qualifiés` : `${formatNumber(qualifying)} qualifying`}
                            </div>
                          </div>
                          <div>
                            <label className="text-[11px] text-[#8A7D6B] mb-1 block">
                              {t ? '% de clients' : '% of customers'}
                              {isBottom && (
                                <span className="ml-1 text-[#A89C8D]" title={t ? 'Calculé automatiquement' : 'Auto-computed'}>·</span>
                              )}
                            </label>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                step={1}
                                value={Math.round(pctValue * 10) / 10}
                                onChange={e => {
                                  const v = parseFloat(e.target.value);
                                  if (!isNaN(v)) updateTierByPct(tierIdx, Math.max(0, Math.min(100, v)));
                                }}
                                disabled={isBottom}
                                className="w-16 px-2 py-1 text-[13px] text-center disabled:opacity-50"
                              />
                              <span className="text-[11px] text-[#8A7D6B]">%</span>
                            </div>
                            <div className="text-[10px] text-[#8A7D6B] mt-1">
                              {isBottom ? (t ? 'auto' : 'auto') : (t ? '↔ seuil' : '↔ threshold')}
                            </div>
                          </div>
                          <div>
                            <label className="text-[11px] text-[#8A7D6B] mb-1 block">{t ? 'Multiplicateur' : 'Multiplier'}</label>
                            <div className="flex items-center gap-1">
                              <input type="number" value={tier.pointsMultiplier} min={1} max={5} step={0.25}
                                onChange={e => updateTier(tierIdx, 'pointsMultiplier', parseFloat(e.target.value) || 1)}
                                className="w-16 px-2 py-1 text-[13px] text-center" />
                              <span className="text-[11px] text-[#8A7D6B]">&times;</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Tier stats grid */}
                    <div className="mt-3 pt-3 border-t border-[#D9D5CB] grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-[15px] font-bold text-[#52473C]">{formatCurrency(stat?.revenue || 0)}</div>
                        <div className="text-[11px] text-[#8A7D6B]">{t ? 'CA' : 'Revenue'}</div>
                      </div>
                      <div>
                        <div className="text-[15px] font-bold text-[#52473C]">{formatCurrency(stat?.avgLTV || 0)}</div>
                        <div className="text-[11px] text-[#8A7D6B]">LTV</div>
                      </div>
                      <div>
                        <div className="text-[15px] font-bold text-[#52473C]">{formatCurrency(stat?.avgAOV || 0)}</div>
                        <div className="text-[11px] text-[#8A7D6B]">AOV</div>
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

                  {/* Rewards assignment */}
                  <div style={{ padding: '12px 24px', backgroundColor: '#EEEDE6', borderTop: '1px solid #D9D5CB', margin: '16px -24px -20px -24px' }}>
                    <div className="section-header" style={{ marginBottom: 8, fontSize: 11 }}>
                      {t ? 'RÉCOMPENSES' : 'REWARDS'}
                    </div>
                    {rewards.map(reward => {
                      const isAssigned = reward.assignedTiers?.[tierIdx] || false;
                      return (
                        <div key={reward.id} className="flex items-center gap-1.5 mb-1.5">
                          <input type="checkbox" checked={isAssigned}
                            onChange={() => toggleRewardForTier(reward.id, tierIdx)}
                            className="w-3 h-3 rounded" />
                          <span className="text-[11px] flex-1 truncate text-[#645648]" title={t ? reward.nameFr : reward.nameEn}>
                            {t ? reward.nameFr : reward.nameEn}
                          </span>
                          {isAssigned && (
                            <div className="flex items-center gap-0.5">
                              <input type="number" min={0} max={100}
                                value={reward.utilizationByTier?.[tierIdx] ?? 30}
                                onChange={e => updateUtilization(reward.id, tierIdx, parseInt(e.target.value) || 0)}
                                className="w-10 px-0.5 py-0 text-[10px] text-center" />
                              <span className="text-[9px] text-[#8A7D6B]">%</span>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Per-tier financials */}
                    <div className="mt-3 pt-3 border-t border-[#D9D5CB]">
                      <div className="section-header" style={{ marginBottom: 8, fontSize: 11 }}>
                        {t ? 'FINANCES / AN' : 'FINANCIALS / YR'}
                      </div>
                      <div className="space-y-1 text-[12px]">
                        <div className="flex justify-between">
                          <span className="text-[#8A7D6B]">{t ? 'Coût récompenses' : 'Rewards cost'}</span>
                          <span className="font-medium text-[#DC2626]">-{formatCurrency(fin.rewardsCost)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#8A7D6B]">{t ? 'Rev. incrémental' : 'Incr. revenue'}</span>
                          <span className="font-medium text-[#645648]">{formatCurrency(fin.incrementalRevenue)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#8A7D6B]">{t ? 'Marge brute' : 'Gross profit'}</span>
                          <span className="font-medium text-[#645648]">{formatCurrency(fin.grossProfit)}</span>
                        </div>
                        <div className="flex justify-between pt-1.5 border-t border-[#D9D5CB]">
                          <span className="font-medium text-[#645648]">{t ? 'Profit net' : 'Net profit'}</span>
                          <span className={`font-bold ${fin.netProfit >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
                            {fin.netProfit >= 0 ? '+' : ''}{formatCurrency(fin.netProfit)}
                          </span>
                        </div>
                      </div>
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

      {/* Total row */}
      <div>
        <div className="section-header">{t ? 'TOTAL PROGRAMME / AN' : 'PROGRAM TOTAL / YR'}</div>
        <div className="card">
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center">
              <div className="section-subheader">{t ? 'COÛT TOTAL' : 'TOTAL COST'}</div>
              <div className="text-[28px] font-bold text-[#DC2626]">-{formatCurrency(totalFinancials.rewardsCost)}</div>
              <div className="text-[12px] text-[#645648]">{t ? 'récompenses' : 'rewards'}</div>
            </div>
            <div className="text-center">
              <div className="section-subheader">{t ? 'REV. INCRÉMENTAL' : 'INCR. REVENUE'}</div>
              <div className="text-[28px] font-bold text-[#52473C]">{formatCurrency(totalFinancials.incrementalRevenue)}</div>
              <div className="text-[12px] text-[#645648]">{t ? 'généré' : 'generated'}</div>
            </div>
            <div className="text-center">
              <div className="section-subheader">{t ? 'MARGE BRUTE' : 'GROSS PROFIT'}</div>
              <div className="text-[28px] font-bold text-[#52473C]">{formatCurrency(totalFinancials.grossProfit)}</div>
              <div className="text-[12px] text-[#645648]">{t ? 'sur rev. incr.' : 'on incr. rev.'}</div>
            </div>
            <div className="text-center">
              <div className="section-subheader">{t ? 'PROFIT NET' : 'NET PROFIT'}</div>
              <div className={`text-[28px] font-bold ${totalFinancials.netProfit >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
                {totalFinancials.netProfit >= 0 ? '+' : ''}{formatCurrency(totalFinancials.netProfit)}
              </div>
              <div className="text-[12px] text-[#645648]">{t ? 'par an' : 'per year'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Inline next */}
      {onNext && (
        <div className="flex justify-end pt-6">
          <button onClick={onNext} className="btn-primary">
            {t ? 'Voir le Dashboard' : 'View Dashboard'} <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
