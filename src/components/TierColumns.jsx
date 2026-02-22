import { useState } from 'react';
import { Plus, Minus, X, Flame, Trophy } from 'lucide-react';
import BenchmarkBadge from './BenchmarkBadge';
import { formatCurrency, formatNumber, formatPercent } from '../utils/calculations';

export default function TierColumns({ tiers, setTiers, rewards, setRewards, tierStats, config, settings, lang }) {
  const t = lang === 'fr' ? FR : EN;
  const tierCount = tiers.length;

  const setTierCount = (count) => {
    const names = lang === 'fr' ? ['Bronze', 'Argent', 'Or', 'Platine'] : ['Bronze', 'Silver', 'Gold', 'Platinum'];
    const colors = ['#CD7F32', '#C0C0C0', '#FFD700', '#E5E4E2'];
    if (count > tiers.length) {
      const newTiers = [...tiers];
      for (let i = tiers.length; i < count; i++) {
        newTiers.push({
          name: names[i] || `Tier ${i + 1}`, color: colors[i] || '#8B74FF',
          threshold: Math.round((100 / count) * (count - i)),
          pointsThreshold: (i + 1) * 1000, pointsMultiplier: 1 + i * 0.5, perks: [],
        });
      }
      setTiers(newTiers);
    } else {
      setTiers(tiers.slice(0, count));
    }
  };

  const updateTier = (index, key, value) => {
    setTiers(prev => prev.map((tier, i) => i === index ? { ...tier, [key]: value } : tier));
  };

  const toggleRewardForTier = (rewardId, tierIndex) => {
    setRewards(prev => prev.map(r => {
      if (r.id !== rewardId) return r;
      const newAssigned = [...(r.assignedTiers || [])];
      newAssigned[tierIndex] = !newAssigned[tierIndex];
      return { ...r, assignedTiers: newAssigned };
    }));
  };

  const addPerk = (index, perk) => {
    if (!perk.trim()) return;
    updateTier(index, 'perks', [...tiers[index].perks, perk.trim()]);
  };

  const removePerk = (tierIndex, perkIndex) => {
    updateTier(tierIndex, 'perks', tiers[tierIndex].perks.filter((_, i) => i !== perkIndex));
  };

  // Split rewards by usage type
  const perkRewards = rewards.filter(r => r.rewardUsage === 'perk' || r.rewardUsage === 'both');
  const burnRewards = rewards.filter(r => r.rewardUsage === 'burn' || r.rewardUsage === 'both');

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      {/* Header with tier count controls */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-800 text-sm">{t.title}</h3>
          <BenchmarkBadge benchmarkKey="tierCount" value={tierCount} lang={lang} />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => tierCount > 2 && setTierCount(tierCount - 1)} disabled={tierCount <= 2}
            className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-30">
            <Minus size={12} />
          </button>
          <span className="w-6 text-center font-bold text-primary">{tierCount}</span>
          <button onClick={() => tierCount < 4 && setTierCount(tierCount + 1)} disabled={tierCount >= 4}
            className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-30">
            <Plus size={12} />
          </button>
        </div>
      </div>

      {/* Vertical Columns */}
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${tierCount}, 1fr)` }}>
        {tiers.map((tier, i) => {
          const stat = tierStats[i] || { count: 0, revenuePercentage: 0, avgLTV: 0 };
          const tierPerkRewards = perkRewards.filter(r => r.assignedTiers?.[i]);
          const tierBurnRewards = burnRewards.filter(r => r.assignedTiers?.[i]);

          return (
            <div key={i} className="border border-gray-100 rounded-xl overflow-hidden flex flex-col">
              {/* Tier color header */}
              <div className="h-2" style={{ backgroundColor: tier.color }} />
              <div className="p-3 flex flex-col gap-3 flex-1">
                {/* Name + Color */}
                <div className="flex items-center gap-2">
                  <input type="color" value={tier.color} onChange={e => updateTier(i, 'color', e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border border-gray-200 flex-shrink-0" />
                  <input type="text" value={tier.name} onChange={e => updateTier(i, 'name', e.target.value)}
                    className="w-full px-2 py-1 border border-gray-200 rounded-lg text-sm font-semibold" />
                </div>

                {/* Threshold */}
                {config.tierBasis === 'spend' ? (
                  <div>
                    <label className="text-[10px] text-gray-400 mb-0.5 block">{t.threshold} (top %)</label>
                    <input type="range" min={0} max={100} value={tier.threshold}
                      onChange={e => updateTier(i, 'threshold', parseInt(e.target.value))} />
                    <div className="text-xs text-primary font-semibold text-center">{tier.threshold}%</div>
                  </div>
                ) : (
                  <div>
                    <label className="text-[10px] text-gray-400 mb-0.5 block">{t.ptsThreshold}</label>
                    <input type="number" min={0} step={100} value={tier.pointsThreshold}
                      onChange={e => updateTier(i, 'pointsThreshold', parseInt(e.target.value) || 0)}
                      className="w-full px-2 py-1 border border-gray-200 rounded-lg text-xs text-center" />
                  </div>
                )}

                {/* Multiplier */}
                <div>
                  <label className="text-[10px] text-gray-400 mb-0.5 block">{t.multiplier}</label>
                  <input type="range" min={1} max={5} step={0.25} value={tier.pointsMultiplier}
                    onChange={e => updateTier(i, 'pointsMultiplier', parseFloat(e.target.value))} />
                  <div className="text-xs text-primary font-semibold text-center">{tier.pointsMultiplier}x</div>
                </div>

                {/* Stats Preview */}
                <div className="bg-gray-50 rounded-lg p-2 space-y-1">
                  <StatRow label={t.clients} value={formatNumber(stat.count)} />
                  <StatRow label="% CA" value={formatPercent(stat.revenuePercentage)} />
                  <StatRow label="LTV" value={formatCurrency(stat.avgLTV)} />
                </div>

                {/* Divider */}
                <div className="border-t border-gray-100" />

                {/* Perk Rewards assigned to this tier */}
                {perkRewards.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <Trophy size={10} className="text-primary" />
                      <span className="text-[10px] font-semibold text-gray-500">{t.perksLabel}</span>
                    </div>
                    <div className="space-y-1">
                      {perkRewards.map(r => (
                        <label key={r.id} className="flex items-center gap-1.5 cursor-pointer group">
                          <button
                            onClick={() => toggleRewardForTier(r.id, i)}
                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[7px] transition-colors flex-shrink-0
                              ${r.assignedTiers?.[i]
                                ? 'bg-primary border-primary text-white'
                                : 'border-gray-200 group-hover:border-gray-300'}`}
                          >
                            {r.assignedTiers?.[i] && '✓'}
                          </button>
                          <span className={`text-[10px] ${r.assignedTiers?.[i] ? 'text-gray-700' : 'text-gray-400'}`}>
                            {lang === 'fr' ? r.nameFr : r.nameEn}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Burn Rewards assigned to this tier */}
                {burnRewards.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1 mb-1.5">
                      <Flame size={10} className="text-orange-500" />
                      <span className="text-[10px] font-semibold text-gray-500">{t.burnLabel}</span>
                    </div>
                    <div className="space-y-1">
                      {burnRewards.map(r => (
                        <label key={r.id} className="flex items-center gap-1.5 cursor-pointer group">
                          <button
                            onClick={() => toggleRewardForTier(r.id, i)}
                            className={`w-3.5 h-3.5 rounded border flex items-center justify-center text-[7px] transition-colors flex-shrink-0
                              ${r.assignedTiers?.[i]
                                ? 'bg-orange-500 border-orange-500 text-white'
                                : 'border-gray-200 group-hover:border-gray-300'}`}
                          >
                            {r.assignedTiers?.[i] && '✓'}
                          </button>
                          <span className={`text-[10px] ${r.assignedTiers?.[i] ? 'text-gray-700' : 'text-gray-400'}`}>
                            {lang === 'fr' ? r.nameFr : r.nameEn}
                            {(r.rewardUsage === 'burn' || r.rewardUsage === 'both') && (
                              <span className="text-gray-300 ml-1">({r.pointsCost} pts)</span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom free-text perks */}
                <div>
                  <span className="text-[10px] text-gray-400 block mb-1">{t.customPerks}</span>
                  <div className="flex flex-wrap gap-1">
                    {tier.perks.map((perk, pi) => (
                      <span key={pi} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-primary-50 text-primary text-[9px] rounded-full">
                        {perk}
                        <button onClick={() => removePerk(i, pi)}><X size={7} /></button>
                      </span>
                    ))}
                    <input type="text" placeholder="+"
                      onKeyDown={e => { if (e.key === 'Enter' && e.target.value.trim()) { addPerk(i, e.target.value); e.target.value = ''; } }}
                      className="px-1.5 py-0.5 border border-dashed border-gray-200 rounded-full text-[9px] w-16 outline-none focus:border-primary"
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StatRow({ label, value }) {
  return (
    <div className="flex justify-between text-[10px]">
      <span className="text-gray-400">{label}</span>
      <span className="font-semibold text-gray-700">{value}</span>
    </div>
  );
}

const FR = {
  title: 'Paliers VIP',
  threshold: 'Seuil', ptsThreshold: 'Seuil points', multiplier: 'Multiplicateur',
  clients: 'Clients',
  perksLabel: 'Perks (débloqués)', burnLabel: 'Burn (points)',
  customPerks: 'Avantages libres',
};

const EN = {
  title: 'VIP Tiers',
  threshold: 'Threshold', ptsThreshold: 'Points threshold', multiplier: 'Multiplier',
  clients: 'Clients',
  perksLabel: 'Perks (unlocked)', burnLabel: 'Burn (points)',
  customPerks: 'Custom perks',
};
