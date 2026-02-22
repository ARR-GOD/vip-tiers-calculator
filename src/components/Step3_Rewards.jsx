import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Tooltip from './Tooltip';
import { REWARD_TYPES, REWARD_USAGE_OPTIONS } from '../data/defaults';
import { formatCurrency, formatNumber } from '../utils/calculations';

export default function Step3_Rewards({ rewards, setRewards, settings, config, lang }) {
  const t = lang === 'fr';

  const addReward = () => {
    setRewards(prev => [...prev, {
      id: `r_${Date.now()}`,
      type: 'custom',
      nameFr: t ? 'Nouvelle récompense' : 'New reward',
      nameEn: t ? 'New reward' : 'New reward',
      rewardUsage: 'burn',
      pointsCost: 300,
      realCost: 5,
      minPurchase: 0,
      assignedTiers: [true, true, true],
      utilizationByTier: [20, 30, 40],
    }]);
  };

  const removeReward = (id) => setRewards(prev => prev.filter(r => r.id !== id));

  const updateReward = (id, field, value) => {
    setRewards(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const totalRealCost = rewards.reduce((s, r) => s + r.realCost, 0);
  const totalIncrementalRevenue = rewards.reduce((s, r) => s + (r.minPurchase || 0), 0);
  const avgROI = totalRealCost > 0
    ? ((totalIncrementalRevenue * (settings.grossMargin / 100)) / totalRealCost * 100 - 100).toFixed(0)
    : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="section-subheader">{t ? 'ÉTAPE 4' : 'STEP 4'}</div>
          <h2 className="text-[22px] font-bold text-[#111827]">{t ? 'Catalogue de récompenses' : 'Rewards Catalog'}</h2>
          <p className="text-[15px] text-[#6B7280] mt-0.5">{t ? 'Définissez vos récompenses. L\'attribution par palier se fait à l\'étape suivante.' : 'Define your rewards. Tier assignment happens in the next step.'}</p>
        </div>
        <button onClick={addReward} className="btn-primary"><Plus size={14} /> {t ? 'Ajouter' : 'Add'}</button>
      </div>

      {/* Rewards table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-2.5 font-medium text-[#6B7280]">{t ? 'Récompense' : 'Reward'}</th>
                <th className="text-center px-3 py-2.5 font-medium text-[#6B7280] w-24">
                  <div className="flex items-center gap-1 justify-center">
                    Type
                    <Tooltip text={t ? 'Burn = échangé contre des points. Perk = avantage automatique du palier. Les deux = disponible en burn ET perk.' : 'Burn = redeemed with points. Perk = automatic tier benefit. Both = available as burn AND perk.'} />
                  </div>
                </th>
                <th className="text-center px-3 py-2.5 font-medium text-[#6B7280] w-20">
                  <div className="flex items-center gap-1 justify-center">
                    Points
                    <Tooltip text={t ? 'Nombre de points nécessaires pour obtenir cette récompense (si burn).' : 'Points required to redeem this reward (if burn).'} />
                  </div>
                </th>
                <th className="text-center px-3 py-2.5 font-medium text-[#6B7280] w-20">
                  <div className="flex items-center gap-1 justify-center">
                    {t ? 'Coût réel' : 'Real cost'}
                    <Tooltip text={t ? 'Coût réel pour vous de fournir cette récompense.' : 'Your actual cost to provide this reward.'} />
                  </div>
                </th>
                <th className="text-center px-3 py-2.5 font-medium text-[#6B7280] w-24">
                  <div className="flex items-center gap-1 justify-center">
                    {t ? 'Achat min.' : 'Min purchase'}
                    <Tooltip text={t ? 'Montant minimum d\'achat pour déclencher cette récompense. Génère du revenu incrémental.' : 'Minimum purchase to trigger this reward. Drives incremental revenue.'} />
                  </div>
                </th>
                <th className="text-center px-3 py-2.5 font-medium text-[#6B7280] w-24">
                  <div className="flex items-center gap-1 justify-center">
                    {t ? 'Rev. incr.' : 'Incr. rev.'}
                    <Tooltip text={t ? 'Revenu incrémental estimé = achat minimum.' : 'Estimated incremental revenue = min purchase.'} />
                  </div>
                </th>
                <th className="text-center px-3 py-2.5 font-medium text-[#6B7280] w-20">
                  <div className="flex items-center gap-1 justify-center">
                    {t ? 'Marge' : 'Margin'}
                    <Tooltip text={t ? 'Marge brute sur le revenu incrémental.' : 'Gross margin on incremental revenue.'} />
                  </div>
                </th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {rewards.map(reward => {
                const icon = REWARD_TYPES.find(rt => rt.id === reward.type)?.icon || '';
                const incrRevenue = reward.minPurchase || 0;
                const marginOnIncr = incrRevenue * (settings.grossMargin / 100);

                return (
                  <tr key={reward.id} className="border-b border-gray-50 hover:bg-gray-50" style={{ transition: 'all 0.15s ease' }}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {icon && <span className="text-[14px]">{icon}</span>}
                        <input type="text"
                          value={t ? reward.nameFr : reward.nameEn}
                          onChange={e => updateReward(reward.id, t ? 'nameFr' : 'nameEn', e.target.value)}
                          className="px-2 py-1 text-[12px] w-40 font-medium" />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <select value={reward.rewardUsage}
                        onChange={e => updateReward(reward.id, 'rewardUsage', e.target.value)}
                        className="px-2 py-1 text-[12px] bg-white">
                        {REWARD_USAGE_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{t ? opt.labelFr : opt.labelEn}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {(reward.rewardUsage === 'burn' || reward.rewardUsage === 'both') ? (
                        <input type="number" value={reward.pointsCost} min={0}
                          onChange={e => updateReward(reward.id, 'pointsCost', parseInt(e.target.value) || 0)}
                          className="w-16 px-1.5 py-0.5 text-[12px] text-center" />
                      ) : (
                        <span className="text-[#9CA3AF]">&mdash;</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <input type="number" value={reward.realCost} min={0} step={0.5}
                          onChange={e => updateReward(reward.id, 'realCost', parseFloat(e.target.value) || 0)}
                          className="w-16 px-1.5 py-0.5 text-[12px] text-center" />
                        <span className="text-[10px] text-[#9CA3AF]">€</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <input type="number" value={reward.minPurchase || 0} min={0} step={5}
                          onChange={e => updateReward(reward.id, 'minPurchase', parseFloat(e.target.value) || 0)}
                          className="w-16 px-1.5 py-0.5 text-[12px] text-center" />
                        <span className="text-[10px] text-[#9CA3AF]">€</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center text-[#374151]">
                      {incrRevenue > 0 ? formatCurrency(incrRevenue) : <span className="text-[#9CA3AF]">&mdash;</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {incrRevenue > 0 ? (
                        <span className={`font-medium ${marginOnIncr > reward.realCost ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
                          {formatCurrency(marginOnIncr)}
                        </span>
                      ) : <span className="text-[#9CA3AF]">&mdash;</span>}
                    </td>
                    <td className="px-2 py-2.5">
                      <button onClick={() => removeReward(reward.id)}
                        className="text-gray-300 hover:text-red-500 transition-all"><Trash2 size={13} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200">
                <td colSpan={3} className="px-4 py-2.5 text-[12px] font-semibold text-[#374151]">{t ? 'Total catalogue' : 'Catalog total'}</td>
                <td className="px-3 py-2.5 text-center text-[12px] font-bold text-[#111827]">{formatCurrency(totalRealCost)}</td>
                <td></td>
                <td className="px-3 py-2.5 text-center text-[12px] font-bold text-[#111827]">{formatCurrency(totalIncrementalRevenue)}</td>
                <td className="px-3 py-2.5 text-center text-[12px] font-bold text-primary">
                  {avgROI > 0 ? `+${avgROI}%` : `${avgROI}%`}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Summary KPI cards */}
      <div>
        <div className="section-header">{t ? 'RÉSUMÉ' : 'SUMMARY'}</div>
        <div className="grid grid-cols-3 gap-3">
          <div className="card" style={{ padding: 24 }}>
            <div className="section-subheader">{t ? 'RÉCOMPENSES' : 'REWARDS'}</div>
            <div className="text-[32px] font-bold text-[#111827] text-right">{rewards.length}</div>
            <div className="text-[12px] text-[#6B7280] text-right">{t ? 'dans le catalogue' : 'in catalog'}</div>
          </div>
          <div className="card" style={{ padding: 24 }}>
            <div className="section-subheader">BURN / PERK</div>
            <div className="text-[32px] font-bold text-[#111827] text-right">
              {rewards.filter(r => r.rewardUsage === 'burn' || r.rewardUsage === 'both').length} / {rewards.filter(r => r.rewardUsage === 'perk' || r.rewardUsage === 'both').length}
            </div>
            <div className="text-[12px] text-[#6B7280] text-right">{t ? 'répartition' : 'split'}</div>
          </div>
          <div className="card" style={{ padding: 24 }}>
            <div className="section-subheader">ROI</div>
            <div className={`text-[32px] font-bold text-right ${parseFloat(avgROI) >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
              {avgROI > 0 ? `+${avgROI}%` : `${avgROI}%`}
            </div>
            <div className="text-[12px] text-[#6B7280] text-right">{t ? 'ROI moyen' : 'avg ROI'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
