import { useState } from 'react';
import { Plus, X, Flame, Trophy } from 'lucide-react';
import { REWARD_USAGE_OPTIONS } from '../data/defaults';
import { formatCurrency } from '../utils/calculations';

export default function RewardEconomicsTable({ rewards, setRewards, tiers, tierStats, burnRate, lang }) {
  const t = lang === 'fr' ? FR : EN;

  const [newReward, setNewReward] = useState({
    name: '', rewardUsage: 'burn', pointsCost: 500, realCost: 5,
  });

  const updateReward = (id, key, value) => {
    setRewards(prev => prev.map(r => r.id === id ? { ...r, [key]: value } : r));
  };

  const toggleTierAssignment = (rewardId, tierIndex) => {
    setRewards(prev => prev.map(r => {
      if (r.id !== rewardId) return r;
      const newAssigned = [...(r.assignedTiers || [])];
      newAssigned[tierIndex] = !newAssigned[tierIndex];
      return { ...r, assignedTiers: newAssigned };
    }));
  };

  const removeReward = (id) => setRewards(prev => prev.filter(r => r.id !== id));

  const addReward = () => {
    if (!newReward.name.trim()) return;
    setRewards(prev => [...prev, {
      id: `r_${Date.now()}`,
      type: 'custom',
      nameFr: newReward.name,
      nameEn: newReward.name,
      rewardUsage: newReward.rewardUsage,
      pointsCost: newReward.rewardUsage === 'perk' ? 0 : newReward.pointsCost,
      realCost: newReward.realCost,
      assignedTiers: tiers.map(() => true),
    }]);
    setNewReward({ name: '', rewardUsage: 'burn', pointsCost: 500, realCost: 5 });
  };

  // Estimate annual cost per reward
  const estimateAnnualCost = (reward) => {
    let cost = 0;
    tierStats.forEach((stat, tierIndex) => {
      if (!reward.assignedTiers?.[tierIndex]) return;
      if (reward.rewardUsage === 'perk' || reward.rewardUsage === 'both') {
        cost += stat.count * reward.realCost;
      }
      if (reward.rewardUsage === 'burn' || reward.rewardUsage === 'both') {
        cost += stat.count * reward.realCost * (burnRate / 100);
      }
    });
    return cost;
  };

  const usageIcon = (usage) => {
    if (usage === 'burn') return <Flame size={10} className="text-orange-500" />;
    if (usage === 'perk') return <Trophy size={10} className="text-primary" />;
    return <span className="text-[10px]">🔀</span>;
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
      <h3 className="font-semibold text-gray-800 text-sm mb-4">{t.title}</h3>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left py-2 px-2 text-gray-400 font-medium">{t.name}</th>
              <th className="text-center py-2 px-2 text-gray-400 font-medium">{t.usage}</th>
              <th className="text-center py-2 px-2 text-gray-400 font-medium">{t.pointsCost}</th>
              <th className="text-center py-2 px-2 text-gray-400 font-medium">{t.realCost}</th>
              {tiers.map((tier, i) => (
                <th key={i} className="text-center py-2 px-1 font-medium" style={{ color: tier.color === '#FFD700' ? '#8B6914' : tier.color }}>
                  {tier.name}
                </th>
              ))}
              <th className="text-right py-2 px-2 text-gray-400 font-medium">{t.annualCost}</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rewards.map(r => (
              <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                <td className="py-2 px-2">
                  <input
                    type="text"
                    value={lang === 'fr' ? r.nameFr : r.nameEn}
                    onChange={e => updateReward(r.id, lang === 'fr' ? 'nameFr' : 'nameEn', e.target.value)}
                    className="w-full px-1.5 py-1 border border-transparent hover:border-gray-200 focus:border-primary rounded text-xs bg-transparent min-w-[120px]"
                  />
                </td>
                <td className="py-2 px-2 text-center">
                  <select
                    value={r.rewardUsage || 'burn'}
                    onChange={e => {
                      const usage = e.target.value;
                      updateReward(r.id, 'rewardUsage', usage);
                      if (usage === 'perk') updateReward(r.id, 'pointsCost', 0);
                    }}
                    className="px-1.5 py-1 border border-gray-200 rounded text-[10px] bg-white"
                  >
                    {REWARD_USAGE_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.emoji} {lang === 'fr' ? opt.labelFr : opt.labelEn}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 px-2 text-center">
                  {(r.rewardUsage === 'burn' || r.rewardUsage === 'both') ? (
                    <input
                      type="number" min={0} step={50}
                      value={r.pointsCost}
                      onChange={e => updateReward(r.id, 'pointsCost', parseInt(e.target.value) || 0)}
                      className="w-16 px-1.5 py-1 border border-gray-200 rounded text-[10px] text-center"
                    />
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
                <td className="py-2 px-2 text-center">
                  <div className="inline-flex items-center">
                    <input
                      type="number" min={0} step={0.5}
                      value={r.realCost}
                      onChange={e => updateReward(r.id, 'realCost', parseFloat(e.target.value) || 0)}
                      className="w-14 px-1.5 py-1 border border-gray-200 rounded text-[10px] text-center"
                    />
                    <span className="text-[10px] text-gray-400 ml-0.5">€</span>
                  </div>
                </td>
                {tiers.map((tier, i) => (
                  <td key={i} className="py-2 px-1 text-center">
                    <button
                      onClick={() => toggleTierAssignment(r.id, i)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center text-[8px] mx-auto transition-colors
                        ${r.assignedTiers?.[i]
                          ? 'border-primary bg-primary text-white'
                          : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      {r.assignedTiers?.[i] && '✓'}
                    </button>
                  </td>
                ))}
                <td className="py-2 px-2 text-right">
                  <div className="flex items-center justify-end gap-1">
                    {usageIcon(r.rewardUsage)}
                    <span className="font-medium text-gray-700">{formatCurrency(estimateAnnualCost(r))}</span>
                  </div>
                </td>
                <td className="py-2 px-1">
                  <button onClick={() => removeReward(r.id)} className="text-gray-300 hover:text-danger transition-colors">
                    <X size={12} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-100">
              <td colSpan={4 + tiers.length} className="py-2 px-2 text-right font-semibold text-gray-600">
                {t.total}
              </td>
              <td className="py-2 px-2 text-right font-bold text-primary">
                {formatCurrency(rewards.reduce((sum, r) => sum + estimateAnnualCost(r), 0))}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Add reward row */}
      <div className="flex gap-2 items-end mt-4 pt-3 border-t border-gray-100">
        <input
          type="text" value={newReward.name}
          onChange={e => setNewReward(p => ({ ...p, name: e.target.value }))}
          placeholder={t.placeholder}
          className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs"
        />
        <select
          value={newReward.rewardUsage}
          onChange={e => setNewReward(p => ({ ...p, rewardUsage: e.target.value }))}
          className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs"
        >
          {REWARD_USAGE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.emoji} {lang === 'fr' ? opt.labelFr : opt.labelEn}
            </option>
          ))}
        </select>
        {newReward.rewardUsage !== 'perk' && (
          <input
            type="number" value={newReward.pointsCost}
            onChange={e => setNewReward(p => ({ ...p, pointsCost: parseInt(e.target.value) || 0 }))}
            className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-center"
            placeholder="pts"
          />
        )}
        <input
          type="number" value={newReward.realCost}
          onChange={e => setNewReward(p => ({ ...p, realCost: parseFloat(e.target.value) || 0 }))}
          className="w-14 px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-center"
          placeholder="€"
        />
        <button
          onClick={addReward} disabled={!newReward.name.trim()}
          className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium disabled:opacity-40 flex items-center gap-1"
        >
          <Plus size={12} /> {t.add}
        </button>
      </div>
    </div>
  );
}

const FR = {
  title: 'Catalogue de récompenses',
  name: 'Nom', usage: 'Type', pointsCost: 'Points', realCost: 'Coût réel',
  annualCost: 'Coût ann. est.', total: 'Total estimé',
  placeholder: 'Nouvelle récompense...', add: 'Ajouter',
};

const EN = {
  title: 'Rewards catalog',
  name: 'Name', usage: 'Type', pointsCost: 'Points', realCost: 'Real cost',
  annualCost: 'Est. annual cost', total: 'Estimated total',
  placeholder: 'New reward...', add: 'Add',
};
