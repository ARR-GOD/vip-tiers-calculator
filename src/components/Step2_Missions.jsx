import { useState, useMemo } from 'react';
import { Plus, Trash2, Crown, ChevronLeft, ChevronRight, ChevronDown, Sparkles } from 'lucide-react';
import Tooltip from './Tooltip';
import { computeCustomerScores, assignTiers, computeTierStats, computeMissionPointsByTier, computePurchasePoints, formatCompact } from '../utils/calculations';
import { pointsModel, missionPoints, basePointsFromPoints } from '../utils/pointsModel';
import { ENGAGEMENT_SCENARIOS } from '../data/defaults';
import { MISSION_CATALOG, MISSION_CATEGORIES, ENGAGEMENT_LEVELS, RECOMMENDED_MISSION_IDS, recommendedMissions } from '../data/missionCatalog';

const formatRate = rate => `${String(rate).replace('.', ',')}%`;

export default function Step2_Missions({ missions, setMissions, customMissions, setCustomMissions, tiers, customers, settings, setSettings, config, lang, onPrev, onNext }) {
  const t = lang === 'fr';
  const [showCatalog, setShowCatalog] = useState(false);
  // The scenario is saved with the program and shared with the Dashboard.
  const scenario = ENGAGEMENT_SCENARIOS[settings.scenario] ? settings.scenario : 'medium';
  const setScenario = key => setSettings(p => ({ ...p, scenario: key }));
  const scenarioData = ENGAGEMENT_SCENARIOS[scenario];
  const { earnRate } = pointsModel(settings);

  const tierStats = useMemo(() => {
    const scored = computeCustomerScores(customers, settings.segmentationType, settings.caWeight);
    const assigned = assignTiers(scored, tiers, config.tierBasis, { earnRate });
    return computeTierStats(assigned, tiers);
  }, [customers, settings, tiers, config, earnRate]);

  const missionsByTier = useMemo(() => {
    return computeMissionPointsByTier(missions, customMissions, tiers, tierStats, settings, scenarioData.multiplier);
  }, [missions, customMissions, tiers, tierStats, settings, scenarioData]);

  const purchasePointsTotal = useMemo(
    () => tiers.reduce((s, tier, i) => s + computePurchasePoints(tierStats[i], tier, settings), 0),
    [tiers, tierStats, settings]
  );

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
      basePoints: 20, frequency: 1, enabled: true,
      completionRate: 2,
    }]);
    setShowCatalog(false);
  };

  const addFromCatalog = (catalogItem) => {
    if (allMissions.some(m => m.id === catalogItem.id)) return;
    setMissions(prev => [...prev, { ...catalogItem, enabled: true }]);
    setShowCatalog(false);
  };

  const applyRecommendedPreset = () => {
    const msg = t
      ? `Remplacer les missions actuelles par les ${RECOMMENDED_MISSION_IDS.length} missions recommandées par Loyoly ?`
      : `Replace the current missions with the ${RECOMMENDED_MISSION_IDS.length} missions recommended by Loyoly?`;
    if (!confirm(msg)) return;
    setMissions(recommendedMissions());
    setCustomMissions([]);
  };

  const removeMission = (id) => {
    setMissions(prev => prev.filter(m => m.id !== id));
    setCustomMissions(prev => prev.filter(m => m.id !== id));
  };

  const totalPts = missionsByTier.reduce((s, d) => s + d.totalPoints, 0) + purchasePointsTotal;

  // Orders per active customer in the imported file — informs the purchase row.
  const avgPurchaseFrequency = useMemo(() => {
    if (!customers || customers.length === 0) return null;
    const active = customers.filter(c => (c.number_of_orders || 0) > 0);
    if (active.length === 0) return null;
    const totalOrders = active.reduce((s, c) => s + (c.number_of_orders || 0), 0);
    return Math.round((totalOrders / active.length) * 10) / 10;
  }, [customers]);

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
        <div className="relative flex items-center gap-2">
          <button onClick={applyRecommendedPreset} className="btn-secondary"
            title={t ? 'Les 11 missions recommandées par Loyoly' : 'The 11 missions recommended by Loyoly'}>
            <Sparkles size={14} /> {t ? 'Preset recommandé' : 'Recommended preset'}
          </button>
          <button onClick={() => setShowCatalog(v => !v)} className="btn-primary">
            <Plus size={14} /> {t ? 'Ajouter' : 'Add'} <ChevronDown size={14} />
          </button>
          {showCatalog && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowCatalog(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 bg-[#FBFAF6] rounded-xl shadow-lg border border-[#D9D5CB] w-[420px] py-2 max-h-[480px] overflow-y-auto">
                {MISSION_CATEGORIES.map(cat => {
                  const items = MISSION_CATALOG.filter(item => item.category === cat.id);
                  return (
                    <div key={cat.id}>
                      <div className="px-3 py-1.5 text-[10px] font-bold text-[#8A7D6B] uppercase tracking-wide">{t ? cat.labelFr : cat.labelEn}</div>
                      {items.map(item => {
                        const alreadyAdded = allMissions.some(m => m.id === item.id);
                        return (
                          <button key={item.id} disabled={alreadyAdded}
                            onClick={() => addFromCatalog(item)}
                            className={`w-full text-left px-3 py-1.5 flex items-center gap-2 text-[12px] transition-colors ${alreadyAdded ? 'opacity-40 cursor-not-allowed' : 'hover:bg-[#EEEDE6]'}`}>
                            <span className="text-[14px] w-5 text-center">{item.icon}</span>
                            <span className="text-[#52473C] flex-1">{t ? item.nameFr : item.nameEn}{item.caution && ' ⚠️'}</span>
                            <span className="text-[10px] text-[#8A7D6B] w-12 text-right">{item.isPurchaseMission ? '—' : formatRate(item.completionRate)}</span>
                            <span className="text-[11px] font-medium text-[#645648] w-20 text-right">
                              {item.isPurchaseMission ? `${earnRate} pt${earnRate > 1 ? 's' : ''}/€` : `${missionPoints(item, settings)} pts`}
                            </span>
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
                const totalMissionPts = isPurchase ? (m.id === 'purchase' ? purchasePointsTotal : 0) : missionsByTier.reduce((s, td) => {
                  const mb = td.missionBreakdown.find(b => b.missionId === m.id);
                  return s + (mb?.pointsGenerated || 0);
                }, 0);
                const completion = m.completionRate ?? 0;
                const category = MISSION_CATEGORIES.find(c => c.id === m.category);
                const categoryLabel = category ? (t ? category.labelFr : category.labelEn) : null;
                const engagementLabel = ENGAGEMENT_LEVELS[m.engagement] ? (t ? ENGAGEMENT_LEVELS[m.engagement].labelFr : ENGAGEMENT_LEVELS[m.engagement].labelEn) : null;
                const isMainPurchase = m.id === 'purchase';

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
                          <div>
                            <span className="font-medium text-[#645648]">{t ? m.nameFr : m.nameEn}</span>
                            {m.caution && (
                              <Tooltip text={t ? 'Signalée ⚠️ dans la grille Loyoly : vérifier la faisabilité avec la marque.' : 'Flagged ⚠️ in the Loyoly grid: check feasibility with the brand.'}>
                                <span className="ml-1 cursor-help">⚠️</span>
                              </Tooltip>
                            )}
                            {(categoryLabel || engagementLabel) && (
                              <div className="text-[10px] text-[#8A7D6B]">{[categoryLabel, engagementLabel].filter(Boolean).join(' · ')}</div>
                            )}
                          </div>
                        )}
                        {isPurchase && (
                          <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-medium">{t ? 'auto' : 'auto'}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      {isPurchase ? (
                        <div className="flex flex-col items-center">
                          <span className="text-[12px] font-medium text-[#52473C]">
                            {earnRate} {earnRate > 1 ? 'pts' : 'pt'} / €
                          </span>
                          <span className="text-[10px] text-[#8A7D6B]">
                            ≈ {Math.round(earnRate * (settings.aov || 0))} pts / {t ? 'commande' : 'order'}
                          </span>
                        </div>
                      ) : (
                        <input type="number" value={missionPoints(m, settings)} min={0}
                          onChange={e => updateField(m.id, 'basePoints', basePointsFromPoints(parseInt(e.target.value) || 0, settings))}
                          className="w-20 px-1.5 py-0.5 text-[12px] text-center" />
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {isPurchase ? (
                        <span className="text-[11px] text-[#8A7D6B]"
                          title={t ? 'Commandes ÷ clients actifs dans le fichier importé' : 'Orders ÷ active customers in the imported file'}>
                          {avgPurchaseFrequency !== null ? `~${avgPurchaseFrequency} ${t ? 'cmd/client' : 'orders/cust.'}` : '—'}
                        </span>
                      ) : (
                        <input type="number" value={m.frequency} min={0} step={0.1}
                          onChange={e => updateField(m.id, 'frequency', parseFloat(e.target.value) || 0)}
                          className="w-16 px-1.5 py-0.5 text-[12px] text-center" />
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {isPurchase ? (
                        <span className="text-[11px] text-[#8A7D6B]">{t ? 'tous les achats' : 'every purchase'}</span>
                      ) : (() => {
                        const mult = scenarioData.multiplier;
                        // Grid rates go down to 0.1%: keep one decimal.
                        const effective = Math.min(100, Math.round(completion * mult * 10) / 10);
                        const shifted = mult !== 1;
                        return (
                          <div>
                            <div className="flex items-center justify-center gap-1">
                              <input
                                type="number" min={0} max={100} step={0.1}
                                value={effective}
                                onChange={e => {
                                  const typed = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0));
                                  if (typed === effective) return; // avoid silent base-rescaling when clamped value is re-entered
                                  const newBase = mult > 0 ? typed / mult : typed;
                                  updateCompletion(m.id, Math.round(Math.max(0, Math.min(100, newBase)) * 100) / 100);
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
                    <td className="px-3 py-2 text-center font-medium text-[#645648]">
                      {isPurchase && !isMainPurchase ? (
                        <span className="text-[#8A7D6B]" title={t ? 'Points comptés avec le CA importé (même ratio de points par €)' : 'Points counted with the imported revenue (same earn rate)'}>—</span>
                      ) : formatCompact(totalMissionPts)}
                    </td>
                    <td className="px-2 py-2">
                      {!isMainPurchase && (
                        <button onClick={() => removeMission(m.id)}
                          title={t ? 'Retirer la mission' : 'Remove mission'}
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
