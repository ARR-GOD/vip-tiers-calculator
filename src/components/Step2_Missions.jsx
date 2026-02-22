import { useState, useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Tooltip from './Tooltip';
import { computeCustomerScores, assignTiers, computeTierStats, computeMissionPointsByTier, formatNumber, formatCompact, derivePointsFromCashback } from '../utils/calculations';
import { ENGAGEMENT_SCENARIOS } from '../data/defaults';

export default function Step2_Missions({ missions, setMissions, customMissions, setCustomMissions, tiers, customers, settings, config, lang }) {
  const t = lang === 'fr';
  const [scenario, setScenario] = useState('medium');
  const scenarioData = ENGAGEMENT_SCENARIOS[scenario];

  const tierStats = useMemo(() => {
    const scored = computeCustomerScores(customers, settings.segmentationType, settings.caWeight);
    const { pointsPerEuro } = derivePointsFromCashback(settings.cashbackRate);
    const assigned = assignTiers(scored, tiers, config.tierBasis, { pointsPerEuro });
    return computeTierStats(assigned, tiers);
  }, [customers, settings, tiers, config]);

  const missionsByTier = useMemo(() => {
    return computeMissionPointsByTier(missions, customMissions, tiers, tierStats, scenarioData.multiplier);
  }, [missions, customMissions, tiers, tierStats, scenarioData]);

  const allMissions = [...missions, ...customMissions];

  const toggleMission = (id) => {
    if (missions.find(m => m.id === id)) {
      setMissions(prev => prev.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m));
    } else {
      setCustomMissions(prev => prev.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m));
    }
  };

  const updateField = (id, field, value) => {
    const updater = (prev) => prev.map(m => m.id === id ? { ...m, [field]: value } : m);
    if (missions.find(m => m.id === id)) setMissions(updater);
    else setCustomMissions(updater);
  };

  const updateEngagement = (id, tierIdx, value) => {
    const updater = (prev) => prev.map(m => {
      if (m.id !== id) return m;
      const rates = [...(m.engagementByTier || [])];
      rates[tierIdx] = Math.max(0, Math.min(100, value));
      return { ...m, engagementByTier: rates };
    });
    if (missions.find(m => m.id === id)) setMissions(updater);
    else setCustomMissions(updater);
  };

  const addCustom = () => {
    setCustomMissions(prev => [...prev, {
      id: `custom_${Date.now()}`, icon: '',
      nameFr: 'Nouvelle mission', nameEn: 'New mission',
      points: 100, frequency: 1, enabled: true,
      engagementByTier: tiers.map(() => 20),
    }]);
  };

  const totalPts = missionsByTier.reduce((s, d) => s + d.totalPoints, 0);
  const totalCompletions = missionsByTier.reduce((s, d) => s + d.totalCompletions, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="section-subheader">{t ? 'ÉTAPE 3' : 'STEP 3'}</div>
          <h2 className="text-[22px] font-bold text-[#111827]">{t ? 'Catalogue de missions' : 'Missions Catalog'}</h2>
          <p className="text-[15px] text-[#6B7280] mt-0.5">{t ? 'Définissez les actions qui génèrent des points au-delà des achats.' : 'Define point-earning actions beyond purchases.'}</p>
        </div>
        <button onClick={addCustom} className="btn-primary"><Plus size={14} /> {t ? 'Ajouter' : 'Add'}</button>
      </div>

      {/* Scenario */}
      <div className="card flex flex-wrap items-center gap-3" style={{ padding: 16 }}>
        <span className="text-[13px] font-medium text-[#374151]">{t ? 'Scénario' : 'Scenario'}:</span>
        <div className="flex gap-1.5">
          {Object.entries(ENGAGEMENT_SCENARIOS).map(([key, sc]) => (
            <button key={key} onClick={() => setScenario(key)}
              className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all
                ${scenario === key ? 'bg-primary text-white' : 'bg-gray-100 text-[#6B7280] hover:bg-gray-200'}`}>
              {t ? sc.nameFr : sc.nameEn}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[11px] text-[#9CA3AF]">{t ? scenarioData.descFr : scenarioData.descEn}</span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-2.5 w-8"></th>
                <th className="text-left px-3 py-2.5 font-medium text-[#6B7280]">{t ? 'Mission' : 'Mission'}</th>
                <th className="text-center px-3 py-2.5 font-medium text-[#6B7280] w-20">
                  <div className="flex items-center gap-1 justify-center">Pts <Tooltip text={t ? 'Points par complétion.' : 'Points per completion.'} /></div>
                </th>
                <th className="text-center px-3 py-2.5 font-medium text-[#6B7280] w-16">
                  <div className="flex items-center gap-1 justify-center">{t ? 'Fréq/an' : 'Freq/yr'} <Tooltip text={t ? 'Complétions max par client par an.' : 'Max completions per customer per year.'} /></div>
                </th>
                {tiers.map((tier, i) => (
                  <th key={i} className="text-center px-2 py-2.5 font-medium text-primary w-20">
                    <div className="flex items-center gap-1 justify-center">
                      {tier.name} <Tooltip text={t ? `% des clients ${tier.name} qui participent.` : `% of ${tier.name} customers participating.`} />
                    </div>
                  </th>
                ))}
                <th className="text-center px-3 py-2.5 font-medium text-[#6B7280] w-24">{t ? 'Total pts' : 'Total pts'}</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {allMissions.map(m => {
                const isCustom = customMissions.some(c => c.id === m.id);
                const totalMissionPts = missionsByTier.reduce((s, td) => {
                  const mb = td.missionBreakdown.find(b => b.missionId === m.id);
                  return s + (mb?.pointsGenerated || 0);
                }, 0);

                return (
                  <tr key={m.id} className={`border-b border-gray-50 hover:bg-gray-50 ${!m.enabled ? 'opacity-40' : ''}`} style={{ transition: 'all 0.15s ease' }}>
                    <td className="px-4 py-2">
                      <input type="checkbox" checked={m.enabled} onChange={() => toggleMission(m.id)} className="w-3.5 h-3.5 rounded" />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {m.icon && <span className="text-[14px]">{m.icon}</span>}
                        {isCustom ? (
                          <input type="text" value={t ? m.nameFr : m.nameEn}
                            onChange={e => updateField(m.id, t ? 'nameFr' : 'nameEn', e.target.value)}
                            className="px-1.5 py-0.5 text-[12px] w-32" />
                        ) : (
                          <span className="font-medium text-[#374151]">{t ? m.nameFr : m.nameEn}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input type="number" value={m.points} min={0}
                        onChange={e => updateField(m.id, 'points', parseInt(e.target.value) || 0)}
                        className="w-16 px-1.5 py-0.5 text-[12px] text-center" />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input type="number" value={m.frequency} min={0} step={0.1}
                        onChange={e => updateField(m.id, 'frequency', parseFloat(e.target.value) || 0)}
                        className="w-14 px-1.5 py-0.5 text-[12px] text-center" />
                    </td>
                    {tiers.map((_, ti) => (
                      <td key={ti} className="px-2 py-2 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          <input type="number" min={0} max={100}
                            value={m.engagementByTier?.[ti] ?? 20}
                            onChange={e => updateEngagement(m.id, ti, parseInt(e.target.value) || 0)}
                            className="w-12 px-1 py-0.5 text-[12px] text-center" />
                          <span className="text-[10px] text-[#9CA3AF]">%</span>
                        </div>
                      </td>
                    ))}
                    <td className="px-3 py-2 text-center font-medium text-[#374151]">{formatCompact(totalMissionPts)}</td>
                    <td className="px-2 py-2">
                      {isCustom && (
                        <button onClick={() => setCustomMissions(p => p.filter(c => c.id !== m.id))}
                          className="text-gray-300 hover:text-red-500 transition-all"><Trash2 size={13} /></button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200">
                <td colSpan={4 + tiers.length} className="px-4 py-2.5 text-[12px] font-semibold text-[#374151]">{t ? 'Total estimé' : 'Estimated total'}</td>
                <td className="px-3 py-2.5 text-center font-bold text-primary text-[12px]">{formatCompact(totalPts)}</td>
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
            <div className="section-subheader">{t ? 'POINTS / AN' : 'POINTS / YR'}</div>
            <div className="text-[32px] font-bold text-primary text-right">{formatCompact(totalPts)}</div>
            <div className="text-[12px] text-[#6B7280] text-right">{t ? 'points générés' : 'points generated'}</div>
          </div>
          <div className="card" style={{ padding: 24 }}>
            <div className="section-subheader">{t ? 'COMPLÉTIONS' : 'COMPLETIONS'}</div>
            <div className="text-[32px] font-bold text-[#111827] text-right">{formatNumber(totalCompletions)}</div>
            <div className="text-[12px] text-[#6B7280] text-right">{t ? 'par an' : 'per year'}</div>
          </div>
          <div className="card" style={{ padding: 24 }}>
            <div className="section-subheader">{t ? 'MISSIONS ACTIVES' : 'ACTIVE MISSIONS'}</div>
            <div className="text-[32px] font-bold text-[#111827] text-right">{allMissions.filter(m => m.enabled).length}</div>
            <div className="text-[12px] text-[#6B7280] text-right">{t ? 'missions' : 'missions'}</div>
          </div>
        </div>
      </div>

      {/* Recommendation */}
      {settings.grossMargin > 0 && (
        <div className="card" style={{ padding: 16, backgroundColor: '#F3F0FF', border: '1px solid #E8E1FF' }}>
          <div className="text-[13px] text-primary">
            <span className="font-semibold">{t ? 'Recommandation' : 'Recommendation'}:</span>{' '}
            <span className="text-[#374151]">
              {t
                ? `Avec ${settings.grossMargin}% de marge, le cashback idéal est entre ${Math.max(1, Math.round(settings.grossMargin * 0.03))}% et ${Math.round(settings.grossMargin * 0.06)}%. Actuel: ${settings.cashbackRate}%.`
                : `With ${settings.grossMargin}% margin, ideal cashback is ${Math.max(1, Math.round(settings.grossMargin * 0.03))}%-${Math.round(settings.grossMargin * 0.06)}%. Current: ${settings.cashbackRate}%.`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
