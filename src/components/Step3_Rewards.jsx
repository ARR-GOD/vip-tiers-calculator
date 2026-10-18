import { useState } from 'react';
import { Plus, Trash2, ChevronLeft, ChevronRight, ChevronDown, RotateCcw } from 'lucide-react';
import Tooltip from './Tooltip';
import BenchmarkBadge from './BenchmarkBadge';
import { REWARD_TYPES, REWARD_USAGE_OPTIONS, REWARD_CATALOG } from '../data/defaults';
import { formatCurrency } from '../utils/calculations';
import {
  parseDiscountPct, rewardMinPurchase, rewardRealCost, rewardPointsCost,
  rewardValueFromPoints, isRealCostDerived, isBurnReward,
} from '../utils/rewardModel';

export default function Step3_Rewards({ rewards, setRewards, tiers, settings, burnRate, setBurnRate, lang, onPrev, onNext }) {
  const t = lang === 'fr';

  const [showCatalog, setShowCatalog] = useState(false);

  const addReward = () => {
    setRewards(prev => [...prev, {
      id: `r_${Date.now()}`,
      type: 'custom',
      nameFr: t ? 'Nouvelle récompense' : 'New reward',
      nameEn: t ? 'New reward' : 'New reward',
      rewardUsage: 'burn',
      pointsValueEur: 3,
      realCost: 5,
      realCostAuto: false,
      minPurchase: 0,
      minPurchaseAuto: true,
      expirationDays: 90,
      assignedTiers: tiers.map(() => true),
    }]);
    setShowCatalog(false);
  };

  // Catalog prices are expressed for 100 pts = 1€.
  const addFromCatalog = (item) => {
    setRewards(prev => [...prev, {
      id: `r_${Date.now()}`,
      type: item.type,
      nameFr: item.nameFr,
      nameEn: item.nameEn,
      rewardUsage: item.rewardUsage,
      pointsValueEur: (item.pointsCost || 0) / 100,
      bonusBasePoints: item.pointsBonus || 0,
      realCost: item.realCost,
      realCostAuto: item.type === 'promo_percent' || item.type === 'bonus_points',
      minPurchase: item.minPurchase,
      minPurchaseAuto: item.type !== 'early_access',
      expirationDays: 90,
      assignedTiers: tiers.map((_, i) => item.rewardUsage === 'perk' ? i >= 1 : true),
    }]);
    setShowCatalog(false);
  };

  const removeReward = (id) => setRewards(prev => prev.filter(r => r.id !== id));

  const updateReward = (id, patch) => {
    setRewards(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  };

  const totalRealCost = rewards.reduce((s, r) => s + rewardRealCost(r, settings), 0);
  const totalIncrementalRevenue = rewards.reduce((s, r) => s + rewardMinPurchase(r, settings), 0);
  const avgROI = totalRealCost > 0
    ? ((totalIncrementalRevenue * (settings.grossMargin / 100)) / totalRealCost * 100 - 100).toFixed(0)
    : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="section-subheader">{t ? 'ÉTAPE 5' : 'STEP 5'}</div>
          <h2 className="text-[28px] font-bold text-[#52473C]">{t ? 'Catalogue de récompenses' : 'Rewards Catalog'}</h2>
          <p className="text-[15px] text-[#645648] mt-0.5">{t ? 'Définissez vos récompenses. L\'attribution par palier se fait à l\'étape suivante.' : 'Define your rewards. Tier assignment happens in the next step.'}</p>
        </div>
        <div className="relative">
          <button onClick={() => setShowCatalog(v => !v)} className="btn-primary">
            <Plus size={14} /> {t ? 'Ajouter' : 'Add'} <ChevronDown size={14} />
          </button>
          {showCatalog && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowCatalog(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 bg-[#EEEDE6] rounded-xl shadow-lg border border-[#D9D5CB] w-72 py-2 max-h-[400px] overflow-y-auto">
                {Object.entries(REWARD_CATALOG).map(([cat, items]) => {
                  const catLabel = {
                    monetary: t ? 'Monétaire' : 'Monetary',
                    experiential: t ? 'Expérientiel' : 'Experiential',
                    bonus_points: t ? 'Bonus points' : 'Bonus points',
                  }[cat] || cat;
                  return (
                    <div key={cat}>
                      <div className="px-3 py-1.5 text-[10px] font-bold text-[#8A7D6B] uppercase tracking-wide">{catLabel}</div>
                      {items.map((item, idx) => (
                        <button key={idx}
                          onClick={() => addFromCatalog(item)}
                          className="w-full text-left px-3 py-2 flex items-center gap-2 text-[13px] hover:bg-[#EEEDE6] transition-colors">
                          <span className="text-[#645648]">{t ? item.nameFr : item.nameEn}</span>
                          <span className="ml-auto text-[11px] text-[#8A7D6B]">
                            {item.rewardUsage === 'perk' ? 'Perk' : `${rewardPointsCost({ pointsValueEur: (item.pointsCost || 0) / 100 }, settings)} pts`}
                          </span>
                        </button>
                      ))}
                    </div>
                  );
                })}
                <div className="border-t border-[#D9D5CB] mt-1 pt-1">
                  <button onClick={addReward}
                    className="w-full text-left px-3 py-2 flex items-center gap-2 text-[13px] hover:bg-[#EEEDE6] text-primary font-medium">
                    <Plus size={14} /> {t ? 'Récompense custom' : 'Custom reward'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Points utilization rate — share of emitted points that get redeemed */}
      <div className="card flex flex-wrap items-center gap-4" style={{ padding: 16 }}>
        <div className="flex items-center gap-1.5">
          <label className="text-[13px] font-medium text-[#645648]">{t ? 'Taux d\'utilisation des points' : 'Points utilization rate'}</label>
          <Tooltip text={t ? 'Part des points émis qui sont échangés contre une récompense dans l\'année. Observé chez Loyoly : 5 à 7 %. Pilote les points utilisés et dormants (vue CFO du Dashboard).' : 'Share of emitted points redeemed for a reward within a year. Observed at Loyoly: 5 to 7%. Drives redeemed and dormant points (Dashboard CFO view).'} />
        </div>
        <input type="range" min={0} max={50} step={0.5} value={burnRate}
          onChange={e => setBurnRate(parseFloat(e.target.value))}
          className="flex-1 min-w-[160px]" />
        <div className="flex items-center gap-1">
          <input type="number" min={0} max={100} step={0.5} value={burnRate}
            onChange={e => setBurnRate(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)))}
            className="w-16 px-1.5 py-1 text-[14px] font-bold text-primary text-center" />
          <span className="text-[13px] font-bold text-primary">%</span>
        </div>
        <BenchmarkBadge benchmarkKey="burnRate" value={burnRate} lang={lang} />
      </div>

      {/* Rewards table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-[#EEEDE6] border-b border-[#D9D5CB]">
                <th className="text-left px-4 py-2.5 font-medium text-[#645648]">{t ? 'Récompense' : 'Reward'}</th>
                <th className="text-center px-3 py-2.5 font-medium text-[#645648] w-24">
                  <div className="flex items-center gap-1 justify-center">
                    Type
                    <Tooltip text={t ? 'Burn = échangé contre des points. Perk = avantage automatique du palier. Les deux = disponible en burn ET perk.' : 'Burn = redeemed with points. Perk = automatic tier benefit. Both = available as burn AND perk.'} />
                  </div>
                </th>
                <th className="text-center px-3 py-2.5 font-medium text-[#645648] w-20">
                  <div className="flex items-center gap-1 justify-center">
                    Points
                    <Tooltip text={t ? 'Nombre de points nécessaires pour obtenir cette récompense (si burn).' : 'Points required to redeem this reward (if burn).'} />
                  </div>
                </th>
                <th className="text-center px-3 py-2.5 font-medium text-[#645648] w-20">
                  <div className="flex items-center gap-1 justify-center">
                    {t ? 'Coût réel' : 'Real cost'}
                    <Tooltip text={t ? 'Coût réel pour vous de fournir cette récompense.' : 'Your actual cost to provide this reward.'} />
                  </div>
                </th>
                <th className="text-center px-3 py-2.5 font-medium text-[#645648] w-24">
                  <div className="flex items-center gap-1 justify-center">
                    {t ? 'Achat min.' : 'Min purchase'}
                    <Tooltip text={t ? 'Montant minimum d\'achat pour utiliser la récompense. Par défaut : le panier moyen (suit sa valeur tant qu\'il n\'est pas modifié).' : 'Minimum purchase to use the reward. Default: the AOV (follows it until edited).'} />
                  </div>
                </th>
                <th className="text-center px-3 py-2.5 font-medium text-[#645648] w-24">
                  <div className="flex items-center gap-1 justify-center">
                    {t ? 'Expiration' : 'Expiry'}
                    <Tooltip text={t ? 'Durée de validité de la récompense une fois obtenue (90 jours par défaut).' : 'How long the reward stays valid once obtained (90 days by default).'} />
                  </div>
                </th>
                <th className="text-center px-3 py-2.5 font-medium text-[#645648] w-24">
                  <div className="flex items-center gap-1 justify-center">
                    {t ? 'Rev. incr.' : 'Incr. rev.'}
                    <Tooltip text={t ? 'Revenu incrémental estimé = achat minimum.' : 'Estimated incremental revenue = min purchase.'} />
                  </div>
                </th>
                <th className="text-center px-3 py-2.5 font-medium text-[#645648] w-20">
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
                const realCost = rewardRealCost(reward, settings);
                const incrRevenue = rewardMinPurchase(reward, settings);
                const marginOnIncr = incrRevenue * (settings.grossMargin / 100);
                const canDeriveCost = reward.type === 'promo_percent' || reward.type === 'bonus_points';

                return (
                  <tr key={reward.id} className="border-b border-[#E5E1D8] hover:bg-[#EEEDE6]" style={{ transition: 'all 0.15s ease' }}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        {icon && <span className="text-[14px]">{icon}</span>}
                        <input type="text"
                          value={t ? reward.nameFr : reward.nameEn}
                          onChange={e => updateReward(reward.id, { [t ? 'nameFr' : 'nameEn']: e.target.value })}
                          className="px-2 py-1 text-[12px] w-40 font-medium" />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <select value={reward.rewardUsage}
                        onChange={e => updateReward(reward.id, { rewardUsage: e.target.value })}
                        className="px-2 py-1 text-[12px] bg-[#EEEDE6]">
                        {REWARD_USAGE_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>{t ? opt.labelFr : opt.labelEn}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {isBurnReward(reward) ? (
                        <input type="number" value={rewardPointsCost(reward, settings)} min={0}
                          onChange={e => updateReward(reward.id, { pointsValueEur: rewardValueFromPoints(parseInt(e.target.value) || 0, settings) })}
                          className="w-16 px-1.5 py-0.5 text-[12px] text-center" />
                      ) : (
                        <span className="text-[#8A7D6B]">&mdash;</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <input type="number" value={realCost} min={0} step={0.5}
                          onChange={e => updateReward(reward.id, { realCost: parseFloat(e.target.value) || 0, realCostAuto: false })}
                          className="w-16 px-1.5 py-0.5 text-[12px] text-center"
                          title={reward.type === 'promo_percent' && isRealCostDerived(reward)
                            ? (t ? `Auto-calculé : ${parseDiscountPct(reward.nameFr) || 0}% × ${incrRevenue}€ × (1 − ${settings.grossMargin}%). Modifiable manuellement.` : `Auto-computed: ${parseDiscountPct(reward.nameEn) || 0}% × ${incrRevenue}€ × (1 − ${settings.grossMargin}%). Editable manually.`)
                            : undefined}
                        />
                        <span className="text-[10px] text-[#8A7D6B]">€</span>
                        {isRealCostDerived(reward) && (
                          <span className="text-[8px] text-primary font-medium ml-0.5" title={t ? 'Recalculé depuis la marge brute, l\'achat minimum ou la valeur des points' : 'Recomputed from gross margin, min purchase or points value'}>auto</span>
                        )}
                        {canDeriveCost && !isRealCostDerived(reward) && (
                          <button onClick={() => updateReward(reward.id, { realCostAuto: true })}
                            className="text-[#8A7D6B] hover:text-primary ml-0.5"
                            title={t ? 'Revenir au calcul automatique' : 'Back to automatic cost'}>
                            <RotateCcw size={10} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <input type="number" value={incrRevenue} min={0} step={5}
                          onChange={e => updateReward(reward.id, { minPurchase: parseFloat(e.target.value) || 0, minPurchaseAuto: false })}
                          className="w-16 px-1.5 py-0.5 text-[12px] text-center" />
                        <span className="text-[10px] text-[#8A7D6B]">€</span>
                        {reward.minPurchaseAuto ? (
                          <span className="text-[8px] text-primary font-medium ml-0.5" title={t ? 'Panier moyen' : 'Average order value'}>AOV</span>
                        ) : (
                          <button onClick={() => updateReward(reward.id, { minPurchaseAuto: true })}
                            className="text-[#8A7D6B] hover:text-primary ml-0.5"
                            title={t ? 'Revenir au panier moyen' : 'Back to the AOV'}>
                            <RotateCcw size={10} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex items-center justify-center gap-0.5">
                        <input type="number" value={reward.expirationDays ?? 90} min={0} step={1}
                          onChange={e => updateReward(reward.id, { expirationDays: parseInt(e.target.value) || 0 })}
                          className="w-14 px-1.5 py-0.5 text-[12px] text-center" />
                        <span className="text-[10px] text-[#8A7D6B]">{t ? 'j' : 'd'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-center text-[#645648]">
                      {incrRevenue > 0 ? formatCurrency(incrRevenue) : <span className="text-[#8A7D6B]">&mdash;</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {incrRevenue > 0 ? (
                        <span className={`font-medium ${marginOnIncr > realCost ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
                          {formatCurrency(marginOnIncr)}
                        </span>
                      ) : <span className="text-[#8A7D6B]">&mdash;</span>}
                    </td>
                    <td className="px-2 py-2.5">
                      <button onClick={() => removeReward(reward.id)}
                        className="text-[#8A7D6B] hover:text-red-500 transition-all"><Trash2 size={13} /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-[#EEEDE6] border-t border-[#D9D5CB]">
                <td colSpan={3} className="px-4 py-2.5 text-[12px] font-semibold text-[#645648]">{t ? 'Total catalogue' : 'Catalog total'}</td>
                <td className="px-3 py-2.5 text-center text-[12px] font-bold text-[#52473C]">{formatCurrency(totalRealCost)}</td>
                <td></td>
                <td></td>
                <td className="px-3 py-2.5 text-center text-[12px] font-bold text-[#52473C]">{formatCurrency(totalIncrementalRevenue)}</td>
                <td className="px-3 py-2.5 text-center text-[12px] font-bold text-primary">
                  {avgROI > 0 ? `+${avgROI}%` : `${avgROI}%`}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
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
            {t ? 'Suivant' : 'Next'} <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
