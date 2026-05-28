import { useState, useMemo, useEffect } from 'react';
import { Plus, Trash2, Crown, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import Tooltip from './Tooltip';
import { computeCustomerScores, assignTiers, computeTierStats, computeMissionPointsByTier, formatCompact, derivePointsFromCashback } from '../utils/calculations';
import { ENGAGEMENT_SCENARIOS, MISSION_CATALOG } from '../data/defaults';

// Get the effective single completion rate for a mission. Prefers the new
// `completionRate` field; falls back to the average of legacy `engagementByTier`.
function getCompletion(m) {
  if (typeof m.completionRate === 'number') return m.completionRate;
  const arr = m.engagementByTier;
  if (Array.isArray(arr) && arr.length > 0) {
    return Math.round(arr.reduce((s, v) => s + (v || 0), 0) / arr.length);
  }
  return 20;
}

export default function Step2_Missions({ missions, setMissions, customMissions, setCustomMissions, tiers, customers, settings, config, lang, onPrev, onNext }) {
  const t = lang === 'fr';
  const [scenario, setScenario] = useState('medium');
  const [showCatalog, setShowCatalog] = useState(false);
  const scenarioData = ENGAGEMENT_SCENARIOS[scenario];

  const tierStats = useMemo(() => {
    const scored = computeCustomerScores(customers, settings.segmentationType, settings.caWeight);
    const { pointsPerEuro } = derivePointsFromCashback(settings.cashbackRate, settings.pointsPerEuro);
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

  const updateCompletion = (id, value) => {
    const clamped = Math.max(0, Math.min(100, value));
    updateField(id, 'completionRate', clamped);
  };

  const addCustom = () => {
    setCustomMissions(prev => [...prev, {
      id: `custom_${Date.now()}`, icon: '',
      nameFr: 'Nouvelle mission', nameEn: 'New mission',
      points: 100, frequency: 1, enabled: true,
      completionRate: 20,
    }]);
    setShowCatalog(false);
  };

  const addFromCatalog = (catalogItem) => {
    const allIds = [...missions, ...customMissions].map(m => m.id);
    if (allIds.includes(catalogItem.id)) return;
    const defaultEng = catalogItem.defaultEngagement;
    const completionRate = Array.isArray(defaultEng) && defaultEng.length > 0
      ? Math.round(defaultEng.reduce((s, v) => s + (v || 0), 0) / defaultEng.length)
      : 20;
    setCustomMissions(prev => [...prev, {
      id: catalogItem.id,
      icon: catalogItem.icon || '',
      nameFr: catalogItem.nameFr,
      nameEn: catalogItem.nameEn,
      points: catalogItem.points || 100,
      frequency: catalogItem.frequency || 1,
      enabled: true,
      completionRate,
    }]);
    setShowCatalog(false);
  };

  const totalPts = missionsByTier.reduce((s, d) => s + d.totalPoints, 0);

  // ── Pre-compute the average purchase frequency from imported customers ──
  // The 'Réaliser un achat' mission's frequency (orders per customer per year)
  // is naturally derivable from the CSV: totalOrders ÷ activeCustomers.
  const avgPurchaseFrequency = useMemo(() => {
    if (!customers || customers.length === 0) return null;
    const active = customers.filter(c => (c.number_of_orders || 0) > 0);
    if (active.length === 0) return null;
    const totalOrders = active.reduce((s, c) => s + (c.number_of_orders || 0), 0);
    return Math.round((totalOrders / active.length) * 10) / 10;
  }, [customers]);

  // Seed the purchase mission's frequency from data the first time it's
  // available. Respects user edits: only overrides if the value is still the
  // hardcoded default (4).
  useEffect(() => {
    if (avgPurchaseFrequency === null) return;
    setMissions(prev => prev.map(m => {
      if (!m.isPurchaseMission) return m;
      const isDefault = Math.abs((m.frequency || 0) - 4) < 0.01;
      return isDefault ? { ...m, frequency: avgPurchaseFrequency } : m;
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avgPurchaseFrequency]);

  // ── LUXURY PLACEHOLDER ──
  if (!config.hasMissions) {
    return (
      <div className="space-y-3">
        <div>
          <div className="section-subheader">{t ? 'ÉTAPE 4' : 'STEP 4'}</div>
          <h2 className="text-[28px] font-bold text-[#52473C]">{t ? 'Catalogue de missions' : 'Missions Catalog'}</h2>
        </div>
        <div className="card flex flex-col items-center justify-center text-center" style={{ padding: '64px 32px' }}>
          <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: '#FFFBEB' }}>
            <Crown size={28} className="text-[#B8860B]" />
          </div>
          <h3 className="text-[18px] font-bold text-[#52473C] mb-2">
            {t ? 'Programme sans points — pas de missions' : 'No-points program — no missions'}
          </h3>
          <p className="text-[14px] text-[#645648] max-w-md">
            {t
              ? 'Votre programme n\'utilise pas de points. Les missions ne sont pas nécessaires — les clients montent en statut via leurs achats.'
              : 'Your program does not use points. Missions are not needed — customers progress through tiers via their purchases.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="section-subheader">{t ? 'ÉTAPE 4' : 'STEP 4'}</div>
          <h2 className="text-[28px] font-bold text-[#52473C]">{t ? 'Catalogue de missions' : 'Missions Catalog'}</h2>
          <p className="text-[15px] text-[#645648] mt-0.5">{t ? 'Définissez les actions qui génèrent des points au-delà des achats.' : 'Define point-earning actions beyond purchases.'}</p>
        </div>
        <div className="relative">
          <button onClick={() => setShowCatalog(v => !v)} className="btn-primary">
            <Plus size={14} /> {t ? 'Ajouter' : 'Add'} <ChevronDown size={14} />
          </button>
          {showCatalog && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowCatalog(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 bg-[#EEEDE6] rounded-xl shadow-lg border border-[#D9D5CB] w-72 py-2 max-h-[400px] overflow-y-auto">
                {Object.entries(MISSION_CATALOG).map(([cat, items]) => {
                  const allIds = [...missions, ...customMissions].map(m => m.id);
                  const catLabel = { social: t ? 'Social' : 'Social', engagement: 'Engagement', purchase: t ? 'Achats' : 'Purchase' }[cat] || cat;
                  return (
                    <div key={cat}>
                      <div className="px-3 py-1.5 text-[10px] font-bold text-[#8A7D6B] uppercase tracking-wide">{catLabel}</div>
                      {items.map(item => {
                        const alreadyAdded = allIds.includes(item.id);
                        return (
                          <button key={item.id} disabled={alreadyAdded}
                            onClick={() => addFromCatalog(item)}
                            className={`w-full text-left px-3 py-2 flex items-center gap-2 text-[13px] transition-colors ${alreadyAdded ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#EEEDE6]'}`}>
                            <span className="text-base">{item.icon}</span>
                            <span className="text-[#645648]">{t ? item.nameFr : item.nameEn}</span>
                            <span className="ml-auto text-[11px] text-[#8A7D6B]">{item.points} pts</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
                <div className="border-t border-[#D9D5CB] mt-1 pt-1">
                  <button onClick={addCustom}
                    className="w-full text-left px-3 py-2 flex items-center gap-2 text-[13px] hover:bg-[#EEEDE6] text-primary font-medium">
                    <Plus size={14} /> {t ? 'Mission custom' : 'Custom mission'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Scenario */}
      <div className="card flex flex-wrap items-center gap-3" style={{ padding: 16 }}>
        <span className="text-[13px] font-medium text-[#645648]">{t ? 'Scénario' : 'Scenario'}:</span>
        <div className="flex gap-1.5">
          {Object.entries(ENGAGEMENT_SCENARIOS).map(([key, sc]) => (
            <button key={key} onClick={() => setScenario(key)}
              className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all
                ${scenario === key ? 'bg-primary text-white' : 'bg-[#E5E1D8] text-[#645648] hover:bg-[#D9D5CB]'}`}>
              {t ? sc.nameFr : sc.nameEn}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[11px] text-[#8A7D6B]">{t ? scenarioData.descFr : scenarioData.descEn}</span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-[#EEEDE6] border-b border-[#D9D5CB]">
                <th className="text-left px-4 py-2.5 w-8"></th>
                <th className="text-left px-3 py-2.5 font-medium text-[#645648]">{t ? 'Mission' : 'Mission'}</th>
                <th className="text-center px-3 py-2.5 font-medium text-[#645648] w-24">
                  <div className="flex items-center gap-1 justify-center">Pts <Tooltip text={t ? 'Points par complétion.' : 'Points per completion.'} /></div>
                </th>
                <th className="text-center px-3 py-2.5 font-medium text-[#645648] w-20">
                  <div className="flex items-center gap-1 justify-center">{t ? 'Fréq/an' : 'Freq/yr'} <Tooltip text={t ? 'Complétions max par client par an. Cette valeur n\'est pas affectée par le scénario — seul le taux de complétion (% de clients qui font la mission) est ajusté.' : 'Max completions per customer per year. This is not affected by the scenario — only the completion rate (% of customers who do the mission) is scaled.'} /></div>
                </th>
                <th className="text-center px-3 py-2.5 font-medium text-[#645648] w-36">
                  <div className="flex items-center gap-1 justify-center">
                    {t ? 'Complétion' : 'Completion'}
                    <Tooltip text={t ? `% effectif de clients qui complètent la mission sous le scénario actuel. La valeur affichée = base × ${scenarioData.multiplier} (capée à 100%). Éditer ce champ ajuste la base en conséquence.` : `Effective % of customers who complete the mission under the current scenario. Shown value = base × ${scenarioData.multiplier} (capped at 100%). Editing this field adjusts the base accordingly.`} />
                  </div>
                  {scenarioData.multiplier !== 1 && (
                    <div className="text-[9px] text-[#8A7D6B] font-normal mt-0.5">{t ? 'effectif' : 'effective'} (×{scenarioData.multiplier})</div>
                  )}
                </th>
                <th className="text-center px-3 py-2.5 font-medium text-primary w-28">{t ? 'Total pts / an' : 'Total pts / yr'}</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {allMissions.map(m => {
                const isCustom = customMissions.some(c => c.id === m.id);
                const isPurchase = m.isPurchaseMission;
                const totalMissionPts = missionsByTier.reduce((s, td) => {
                  const mb = td.missionBreakdown.find(b => b.missionId === m.id);
                  return s + (mb?.pointsGenerated || 0);
                }, 0);
                const purchasePts = isPurchase ? Math.round(settings.cashbackRate * (settings.aov || 60) * (settings.pointsPerEuro || 100) / 100) : null;
                const completion = getCompletion(m);

                return (
                  <tr key={m.id} className={`border-b border-[#E5E1D8] hover:bg-[#EEEDE6] ${!m.enabled ? 'opacity-40' : ''}`} style={{ transition: 'all 0.15s ease' }}>
                    <td className="px-4 py-2">
                      {isPurchase ? (
                        <span className="w-3.5 h-3.5 rounded bg-primary/20 border border-primary flex items-center justify-center text-[8px] text-primary">✓</span>
                      ) : (
                        <input type="checkbox" checked={m.enabled} onChange={() => toggleMission(m.id)} className="w-3.5 h-3.5 rounded" />
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        {m.icon && <span className="text-[14px]">{m.icon}</span>}
                        {isCustom ? (
                          <input type="text" value={t ? m.nameFr : m.nameEn}
                            onChange={e => updateField(m.id, t ? 'nameFr' : 'nameEn', e.target.value)}
                            className="px-1.5 py-0.5 text-[12px] w-40" />
                        ) : (
                          <span className="font-medium text-[#645648]">{t ? m.nameFr : m.nameEn}</span>
                        )}
                        {isPurchase && (
                          <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-medium">{t ? 'auto' : 'auto'}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {isPurchase ? (() => {
                        const pp = settings.pointsPerEuro || 100;
                        const perEuro = (settings.cashbackRate * pp) / 100;
                        return (
                          <div className="flex flex-col items-center">
                            <span className="text-[12px] font-medium text-[#52473C]" title={`${settings.cashbackRate}% × ${settings.aov}€ × ${pp} pts/€ ÷ 100 = ${purchasePts} pts par achat`}>
                              {purchasePts}
                            </span>
                            <span className="text-[10px] text-[#8A7D6B]">
                              {perEuro >= 1 ? `${perEuro.toFixed(perEuro >= 10 ? 0 : 1)} pts/€` : `${perEuro.toFixed(2)} pt/€`}
                            </span>
                          </div>
                        );
                      })() : (
                        <input type="number" value={m.points} min={0}
                          onChange={e => updateField(m.id, 'points', parseInt(e.target.value) || 0)}
                          className="w-20 px-1.5 py-0.5 text-[12px] text-center" />
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <input type="number" value={m.frequency} min={0} step={0.1}
                          onChange={e => updateField(m.id, 'frequency', parseFloat(e.target.value) || 0)}
                          className="w-16 px-1.5 py-0.5 text-[12px] text-center" />
                        {isPurchase && avgPurchaseFrequency !== null && (
                          <div className="flex items-center gap-1 text-[9px] text-[#8A7D6B]">
                            <span title={t ? 'Calculé : commandes ÷ clients actifs dans le CSV importé' : 'Computed: orders ÷ active customers in the imported CSV'}>
                              ~{avgPurchaseFrequency} {t ? '(import)' : '(import)'}
                            </span>
                            {Math.abs((m.frequency || 0) - avgPurchaseFrequency) > 0.05 && (
                              <button
                                onClick={() => updateField(m.id, 'frequency', avgPurchaseFrequency)}
                                className="text-primary hover:underline">
                                {t ? 'utiliser' : 'use'}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {isPurchase ? (
                        <span className="text-[11px] text-[#8A7D6B]">100%</span>
                      ) : (() => {
                        const mult = scenarioData.multiplier;
                        const effective = Math.min(100, Math.round(completion * mult));
                        const shifted = mult !== 1;
                        return (
                          <div>
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number" min={0} max={100}
                                value={effective}
                                onChange={e => {
                                  const typed = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
                                  if (typed === effective) return; // avoid silent base-rescaling when clamped value is re-entered
                                  const newBase = mult > 0 ? typed / mult : typed;
                                  updateCompletion(m.id, Math.round(Math.max(0, Math.min(100, newBase))));
                                }}
                                className="w-16 px-1.5 py-0.5 text-[12px] text-center"
                                title={shifted ? (t ? `Base : ${completion}% × ${mult} = ${effective}% (capé à 100%)` : `Base: ${completion}% × ${mult} = ${effective}% (capped at 100%)`) : undefined}
                              />
                              <span className="text-[10px] text-[#8A7D6B]">%</span>
                            </div>
                            {shifted && (
                              <div className="text-[10px] text-[#8A7D6B] mt-0.5">
                                {t ? 'base' : 'base'}: {completion}%
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-3 py-2 text-center font-medium text-[#645648]">{formatCompact(totalMissionPts)}</td>
                    <td className="px-2 py-2">
                      {isCustom && (
                        <button onClick={() => setCustomMissions(p => p.filter(c => c.id !== m.id))}
                          className="text-[#8A7D6B] hover:text-red-500 transition-all"><Trash2 size={13} /></button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-[#EEEDE6] border-t border-[#D9D5CB]">
                <td colSpan={5} className="px-4 py-2.5 text-[12px] font-semibold text-[#645648]">{t ? 'Total estimé' : 'Estimated total'}</td>
                <td className="px-3 py-2.5 text-center font-bold text-primary text-[12px]">{formatCompact(totalPts)}</td>
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
