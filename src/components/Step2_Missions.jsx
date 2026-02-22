import { useState, useMemo } from 'react';
import { Plus, Trash2, Crown } from 'lucide-react';
import Tooltip from './Tooltip';
import { computeCustomerScores, assignTiers, computeTierStats, computeMissionPointsByTier, formatNumber, formatCompact, derivePointsFromCashback, getCashbackRecommendation } from '../utils/calculations';
import { ENGAGEMENT_SCENARIOS } from '../data/defaults';

export default function Step2_Missions({ missions, setMissions, customMissions, setCustomMissions, tiers, customers, settings, config, lang, burnRate }) {
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

  const cashbackReco = getCashbackRecommendation(settings.grossMargin);
  const { pointsPerEuro } = derivePointsFromCashback(settings.cashbackRate);

  // Per-tier point circulation data
  const tierPointsData = useMemo(() => {
    return tiers.map((tier, i) => {
      const ts = tierStats[i] || {};
      const missionPts = missionsByTier[i]?.totalPoints || 0;
      const purchasePts = Math.round((ts.revenue || 0) * (settings.cashbackRate / 100) * pointsPerEuro * (tier.pointsMultiplier || 1));
      const totalTierPts = missionPts + purchasePts;
      const burnPotential = Math.round(totalTierPts * ((burnRate || 30) / 100));
      return { tier, clients: ts.count || 0, missionPts, purchasePts, totalTierPts, burnPotential };
    });
  }, [tiers, tierStats, missionsByTier, settings.cashbackRate, pointsPerEuro, burnRate]);

  // ── LUXURY PLACEHOLDER ──
  if (!config.hasMissions) {
    return (
      <div className="space-y-3">
        <div>
          <div className="section-subheader">{t ? 'ÉTAPE 3' : 'STEP 3'}</div>
          <h2 className="text-[28px] font-bold text-[#111827]">{t ? 'Catalogue de missions' : 'Missions Catalog'}</h2>
        </div>
        <div className="card flex flex-col items-center justify-center text-center" style={{ padding: '64px 32px' }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: '#FFFBEB' }}>
            <Crown size={28} className="text-[#B8860B]" />
          </div>
          <h3 className="text-[18px] font-bold text-[#111827] mb-2">
            {t ? 'Programme premium — pas de missions' : 'Premium program — no missions'}
          </h3>
          <p className="text-[14px] text-[#6B7280] max-w-md">
            {t
              ? 'Votre programme est basé sur les dépenses et les avantages exclusifs par palier. Les missions ne sont pas nécessaires — vos clients montent en statut naturellement par leurs achats.'
              : 'Your program is based on spending and exclusive tier perks. Missions are not needed — your customers progress through tiers naturally via their purchases.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="section-subheader">{t ? 'ÉTAPE 3' : 'STEP 3'}</div>
          <h2 className="text-[28px] font-bold text-[#111827]">{t ? 'Catalogue de missions' : 'Missions Catalog'}</h2>
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
          <div className="card">
            <div className="section-subheader">{t ? 'POINTS / AN' : 'POINTS / YR'}</div>
            <div className="text-[28px] font-bold text-primary text-right">{formatCompact(totalPts)}</div>
            <div className="text-[12px] text-[#6B7280] text-right">{t ? 'points générés' : 'points generated'}</div>
          </div>
          <div className="card">
            <div className="section-subheader">{t ? 'COMPLÉTIONS' : 'COMPLETIONS'}</div>
            <div className="text-[28px] font-bold text-[#111827] text-right">{formatNumber(totalCompletions)}</div>
            <div className="text-[12px] text-[#6B7280] text-right">{t ? 'par an' : 'per year'}</div>
          </div>
          <div className="card">
            <div className="section-subheader">{t ? 'MISSIONS ACTIVES' : 'ACTIVE MISSIONS'}</div>
            <div className="text-[28px] font-bold text-[#111827] text-right">{allMissions.filter(m => m.enabled).length}</div>
            <div className="text-[12px] text-[#6B7280] text-right">{t ? 'missions' : 'missions'}</div>
          </div>
        </div>
      </div>

      {/* Per-tier point circulation table */}
      <div>
        <div className="section-header">{t ? 'POINTS EN CIRCULATION PAR PALIER' : 'POINTS IN CIRCULATION BY TIER'}</div>
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 font-medium text-[#6B7280]">{t ? 'Palier' : 'Tier'}</th>
                  <th className="text-right px-3 py-2.5 font-medium text-[#6B7280]">{t ? 'Clients' : 'Clients'}</th>
                  <th className="text-right px-3 py-2.5 font-medium text-[#6B7280]">
                    <div className="flex items-center gap-1 justify-end">{t ? 'Pts missions' : 'Mission pts'} <Tooltip text={t ? 'Points générés par les missions.' : 'Points generated from missions.'} /></div>
                  </th>
                  <th className="text-right px-3 py-2.5 font-medium text-[#6B7280]">
                    <div className="flex items-center gap-1 justify-end">{t ? 'Pts achats' : 'Purchase pts'} <Tooltip text={t ? 'Points générés par les achats (cashback).' : 'Points generated from purchases (cashback).'} /></div>
                  </th>
                  <th className="text-right px-3 py-2.5 font-medium text-primary">{t ? 'Total pts' : 'Total pts'}</th>
                  <th className="text-right px-3 py-2.5 font-medium text-[#6B7280]">
                    <div className="flex items-center gap-1 justify-end">{t ? 'Potentiel burn' : 'Burn potential'} <Tooltip text={t ? `Points susceptibles d'être brûlés (taux: ${burnRate || 30}%).` : `Points likely to be burned (rate: ${burnRate || 30}%).`} /></div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {tierPointsData.map((row, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-[#374151]">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: row.tier.color || '#6B4EFF' }} />
                        {row.tier.name}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right text-[#374151]">{formatNumber(row.clients)}</td>
                    <td className="px-3 py-2.5 text-right text-[#374151]">{formatCompact(row.missionPts)}</td>
                    <td className="px-3 py-2.5 text-right text-[#374151]">{formatCompact(row.purchasePts)}</td>
                    <td className="px-3 py-2.5 text-right font-bold text-primary">{formatCompact(row.totalTierPts)}</td>
                    <td className="px-3 py-2.5 text-right text-[#374151]">{formatCompact(row.burnPotential)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td className="px-4 py-2.5 text-[12px] font-semibold text-[#374151]">Total</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-[#374151]">{formatNumber(tierPointsData.reduce((s, r) => s + r.clients, 0))}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-[#374151]">{formatCompact(tierPointsData.reduce((s, r) => s + r.missionPts, 0))}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-[#374151]">{formatCompact(tierPointsData.reduce((s, r) => s + r.purchasePts, 0))}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-primary">{formatCompact(tierPointsData.reduce((s, r) => s + r.totalTierPts, 0))}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-[#374151]">{formatCompact(tierPointsData.reduce((s, r) => s + r.burnPotential, 0))}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {/* Recommendation */}
      {cashbackReco && (
        <div className="card" style={{ padding: 16, backgroundColor: '#FFFBEB', border: '1px solid #FCD34D' }}>
          <div className="text-[13px] text-[#92400E]">
            <span className="font-semibold">💡 {t ? 'Recommandation' : 'Recommendation'}:</span>{' '}
            <span>
              {t
                ? `Avec ${settings.grossMargin}% de marge, le cashback recommandé est ${cashbackReco.minRate}–${cashbackReco.maxRate}%. Actuel : ${settings.cashbackRate}%.`
                : `With ${settings.grossMargin}% margin, recommended cashback is ${cashbackReco.minRate}–${cashbackReco.maxRate}%. Current: ${settings.cashbackRate}%.`}
            </span>
            {cashbackReco.bracket === 'low' && (
              <span className="block mt-1 font-bold">⚠️ {t ? cashbackReco.warningFr : cashbackReco.warningEn}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
