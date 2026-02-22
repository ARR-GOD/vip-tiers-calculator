import { useState, useMemo } from 'react';
import { Plus, X } from 'lucide-react';
import Tooltip from './Tooltip';
import BenchmarkBadge, { BenchmarkBar } from './BenchmarkBadge';
import TierColumns from './TierColumns';
import RewardEconomicsTable from './RewardEconomicsTable';
import { computeCustomerScores, assignTiers, computeTierStats, derivePointsFromCashback } from '../utils/calculations';

export default function TabConfig({ tiers, setTiers, missions, setMissions, customMissions, setCustomMissions, rewards, setRewards, burnRate, setBurnRate, customers, settings, config, lang }) {
  const t = lang === 'fr' ? FR : EN;

  // Computed stats
  const sorted = useMemo(() => computeCustomerScores(customers, settings.segmentationType, settings.caWeight), [customers, settings]);
  const { pointsPerEuro } = derivePointsFromCashback(settings.cashbackRate);
  const assigned = useMemo(() => assignTiers(sorted, tiers, config.tierBasis, { pointsPerEuro }), [sorted, tiers, config.tierBasis, pointsPerEuro]);
  const tierStats = useMemo(() => computeTierStats(assigned, tiers), [assigned, tiers]);

  // Mission management
  const toggleMission = (id) => setMissions(prev => prev.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m));
  const updateMission = (id, key, value) => setMissions(prev => prev.map(m => m.id === id ? { ...m, [key]: value } : m));
  const updateCustomMission = (id, key, value) => setCustomMissions(prev => prev.map(m => m.id === id ? { ...m, [key]: value } : m));
  const removeCustomMission = (id) => setCustomMissions(prev => prev.filter(m => m.id !== id));

  const [newMission, setNewMission] = useState({ name: '', pts: 100, freq: 1 });
  const addCustomMission = () => {
    if (!newMission.name.trim()) return;
    setCustomMissions(prev => [...prev, {
      id: `custom_${Date.now()}`, nameFr: newMission.name, nameEn: newMission.name,
      points: newMission.pts, frequency: newMission.freq, enabled: true,
    }]);
    setNewMission({ name: '', pts: 100, freq: 1 });
  };

  return (
    <div className="space-y-5">
      {/* ── TIER COLUMNS (vertical) ── */}
      <TierColumns
        tiers={tiers} setTiers={setTiers}
        rewards={rewards} setRewards={setRewards}
        tierStats={tierStats} config={config} settings={settings}
        lang={lang}
      />

      {/* ── MISSIONS ── */}
      {config.hasMissions && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 text-sm mb-3">{t.missionsTitle}</h3>
          <div className="space-y-1.5">
            {missions.map(m => (
              <div key={m.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${m.enabled ? 'bg-white' : 'bg-gray-50 opacity-50'}`}>
                <button onClick={() => toggleMission(m.id)}
                  className={`w-4 h-4 rounded border-2 flex items-center justify-center text-[8px] transition-colors
                    ${m.enabled ? 'bg-primary border-primary text-white' : 'border-gray-300'}`}>
                  {m.enabled && '✓'}
                </button>
                <span className="flex-1 text-xs font-medium text-gray-700">{lang === 'fr' ? m.nameFr : m.nameEn}</span>
                <input type="number" value={m.points} onChange={e => updateMission(m.id, 'points', parseInt(e.target.value) || 0)}
                  className="w-16 px-1.5 py-0.5 border border-gray-200 rounded text-[10px] text-center" />
                <span className="text-[10px] text-gray-400">pts</span>
                <input type="number" value={m.frequency} onChange={e => updateMission(m.id, 'frequency', parseFloat(e.target.value) || 0)}
                  className="w-12 px-1.5 py-0.5 border border-gray-200 rounded text-[10px] text-center" step={0.5} />
                <span className="text-[10px] text-gray-400">/{t.yr}</span>
              </div>
            ))}
            {customMissions.map(m => (
              <div key={m.id} className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg">
                <span className="flex-1 text-xs font-medium">{lang === 'fr' ? m.nameFr : m.nameEn}</span>
                <input type="number" value={m.points} onChange={e => updateCustomMission(m.id, 'points', parseInt(e.target.value) || 0)}
                  className="w-16 px-1.5 py-0.5 border border-gray-200 rounded text-[10px] text-center" />
                <span className="text-[10px] text-gray-400">pts</span>
                <input type="number" value={m.frequency} onChange={e => updateCustomMission(m.id, 'frequency', parseFloat(e.target.value) || 0)}
                  className="w-12 px-1.5 py-0.5 border border-gray-200 rounded text-[10px] text-center" step={0.5} />
                <span className="text-[10px] text-gray-400">/{t.yr}</span>
                <button onClick={() => removeCustomMission(m.id)} className="text-gray-400 hover:text-danger"><X size={12} /></button>
              </div>
            ))}
          </div>
          {/* Add mission */}
          <div className="flex gap-2 items-end mt-3 pt-3 border-t border-gray-100">
            <input type="text" value={newMission.name} onChange={e => setNewMission(p => ({ ...p, name: e.target.value }))}
              placeholder={t.missionPlaceholder} className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-xs" />
            <input type="number" value={newMission.pts} onChange={e => setNewMission(p => ({ ...p, pts: parseInt(e.target.value) || 0 }))}
              className="w-16 px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-center" />
            <input type="number" value={newMission.freq} onChange={e => setNewMission(p => ({ ...p, freq: parseFloat(e.target.value) || 0 }))}
              className="w-12 px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-center" step={0.5} />
            <button onClick={addCustomMission} disabled={!newMission.name.trim()}
              className="px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium disabled:opacity-40 flex items-center gap-1">
              <Plus size={12} /> {t.add}
            </button>
          </div>
        </div>
      )}

      {/* ── REWARDS ECONOMICS TABLE ── */}
      <RewardEconomicsTable
        rewards={rewards} setRewards={setRewards}
        tiers={tiers} tierStats={tierStats}
        burnRate={burnRate}
        lang={lang}
      />

      {/* ── BURN RATE ── */}
      {config.rewardType !== 'perks' && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-medium text-gray-600">{t.burnRate}</label>
              <Tooltip text={t.burnTooltip} />
            </div>
            <span className="text-sm font-bold text-primary">{burnRate}%</span>
          </div>
          <input type="range" min={0} max={100} value={burnRate} onChange={e => setBurnRate(parseInt(e.target.value))} />
          <BenchmarkBar benchmarkKey="burnRate" value={burnRate} />
          <div className="mt-1.5">
            <BenchmarkBadge benchmarkKey="burnRate" value={burnRate} lang={lang} />
          </div>
        </div>
      )}
    </div>
  );
}

const FR = {
  missionsTitle: 'Missions', missionPlaceholder: 'Nouvelle mission...',
  yr: 'an', add: 'Ajouter',
  burnRate: 'Taux de burn', burnTooltip: '% de points réellement dépensés. 40% = 60% des points expirent/non utilisés.',
};

const EN = {
  missionsTitle: 'Missions', missionPlaceholder: 'New mission...',
  yr: 'yr', add: 'Add',
  burnRate: 'Burn rate', burnTooltip: '% of points actually redeemed. 40% = 60% of points expire/unused.',
};
