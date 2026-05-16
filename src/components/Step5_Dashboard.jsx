import { useMemo, useRef, useState } from 'react';
import { Download, Image, RotateCcw, ChevronLeft } from 'lucide-react';
import { saveAs } from 'file-saver';
import { toPng } from 'html-to-image';
import Tooltip from './Tooltip';
import {
  computeCustomerScores, assignTiers, computeTierStats, computeNonMemberStats,
  computeProgramFunnel, computeReferralEconomics, computePointsEconomy,
  derivePointsFromCashback,
  formatCurrency, formatNumber, formatPercent, formatCompact,
} from '../utils/calculations';

const SCENARIOS = [
  { key: 'conservative', mult: 0.6, defaultIncrementality: 40, labelFr: 'Conservateur', labelEn: 'Conservative' },
  { key: 'base',          mult: 1.0, defaultIncrementality: 55, labelFr: 'Base',          labelEn: 'Base' },
  { key: 'optimistic',    mult: 1.4, defaultIncrementality: 70, labelFr: 'Optimiste',     labelEn: 'Optimistic' },
];

export default function Step5_Dashboard({
  tiers, customers, settings, config,
  missions, customMissions, rewards, burnRate,
  lang, referralConfig, onPrev,
}) {
  const t = lang === 'fr';
  const dashRef = useRef(null);

  // ── Editable incrementality rates per scenario ──
  const [incrementality, setIncrementality] = useState(() =>
    Object.fromEntries(SCENARIOS.map(s => [s.key, s.defaultIncrementality]))
  );
  const resetIncrementality = () =>
    setIncrementality(Object.fromEntries(SCENARIOS.map(s => [s.key, s.defaultIncrementality])));

  const { tierStats, nonMembers, assignedAll } = useMemo(() => {
    const scored = computeCustomerScores(customers, settings.segmentationType, settings.caWeight);
    const { pointsPerEuro } = derivePointsFromCashback(settings.cashbackRate, settings.pointsPerEuro);
    const assigned = assignTiers(scored, tiers, config.tierBasis, { pointsPerEuro });
    return {
      tierStats: computeTierStats(assigned, tiers),
      nonMembers: computeNonMemberStats(assigned),
      assignedAll: assigned,
    };
  }, [customers, settings, tiers, config]);

  // Total customer revenue includes non-members so percentages of the imported
  // base are honest, regardless of where tier 0's threshold sits.
  const totalCustomerRevenue = useMemo(
    () => customers.reduce((s, c) => s + (c.total_ordered_TTC || 0), 0),
    [customers]
  );
  const totalCustomerCount = customers.length;

  const referralEcon = useMemo(
    () => computeReferralEconomics(referralConfig, settings.aov),
    [referralConfig, settings.aov]
  );

  // One funnel per scenario → drives rewards cost (mission engagement scales with multiplier).
  // CA loyalty no longer comes from funnel.incrementalRevenue; it's an explicit assumption:
  //   CA loyalty = totalCustomerRevenue × incrementality%
  const scenarioRows = useMemo(() => {
    return SCENARIOS.map(s => {
      const f = computeProgramFunnel(tierStats, missions, customMissions, rewards, settings, tiers, s.mult);
      const incr = (incrementality[s.key] ?? s.defaultIncrementality) / 100;
      const caLoyalty   = totalCustomerRevenue * incr;
      const caReferral  = referralEcon.revenuePerYear;
      const caTotal     = caLoyalty + caReferral;
      const margin      = caTotal * (settings.grossMargin / 100);
      const rewardsCost = f.rewardsCost + referralEcon.totalCostPerYear;
      const netProfit   = margin - rewardsCost;
      return { ...s, incrementality: incrementality[s.key] ?? s.defaultIncrementality,
        caLoyalty, caReferral, caTotal, margin, rewardsCost, netProfit,
        burnCost: f.burnCost, perkCost: f.perkCost };
    });
  }, [tierStats, missions, customMissions, rewards, settings, tiers, referralEcon, totalCustomerRevenue, incrementality]);

  const pointsEconomy = useMemo(
    () => computePointsEconomy(tierStats, tiers, missions, customMissions, rewards, settings, burnRate),
    [tierStats, tiers, missions, customMissions, rewards, settings, burnRate]
  );

  // ── Real cost per burned point, derived from modeled reward utilization ──
  // computeProgramFunnel at base scenario gives the modeled burn cost.
  const baseFunnel = useMemo(
    () => computeProgramFunnel(tierStats, missions, customMissions, rewards, settings, tiers, 1),
    [tierStats, missions, customMissions, rewards, settings, tiers]
  );
  const realCostPerBurnedPoint = pointsEconomy.totalBurned > 0
    ? baseFunnel.burnCost / pointsEconomy.totalBurned
    : 0;

  // Two ways to value the dormant points (the outstanding liability):
  //   - faceValue: 1 pt = 1 / pointsPerEuro € (what the customer can redeem in face value)
  //   - realCost:  burnCost / totalBurned (what the company actually pays per point burned)
  const pointFaceValue = 1 / (settings.pointsPerEuro || 100);
  const provisionFace = pointsEconomy.totalDormant * pointFaceValue;
  const provisionReal = pointsEconomy.totalDormant * realCostPerBurnedPoint;

  // Tier breakdown totals — totals include non-members so percentages reflect
  // the imported base, not just the program members.
  const totals = useMemo(() => ({
    customersCount: totalCustomerCount,
    totalRev: totalCustomerRevenue,
  }), [totalCustomerCount, totalCustomerRevenue]);

  const updateIncrementality = (key, val) => {
    const v = Math.max(0, Math.min(100, parseFloat(val) || 0));
    setIncrementality(prev => ({ ...prev, [key]: v }));
  };

  const exportCSV = () => {
    const lines = [];
    lines.push([t ? 'Indicateur' : 'Metric', ...SCENARIOS.map(s => `${t ? s.labelFr : s.labelEn} (${incrementality[s.key]}%)`)].join(','));
    const labelMap = [
      [t ? 'CA loyalty (incrémental)' : 'Loyalty revenue (incremental)', 'caLoyalty'],
      [t ? 'CA referral'              : 'Referral revenue',              'caReferral'],
      [t ? 'CA total'                 : 'Total revenue',                 'caTotal'],
      [`${t ? 'Marge brute' : 'Gross margin'} (${settings.grossMargin}%)`, 'margin'],
      [t ? 'Coût des rewards'         : 'Rewards cost',                  'rewardsCost'],
      [t ? 'Profit net'               : 'Net profit',                    'netProfit'],
    ];
    for (const [lbl, key] of labelMap) {
      lines.push([lbl, ...scenarioRows.map(r => Math.round(r[key]))].join(','));
    }
    lines.push('');
    lines.push([t ? 'Palier' : 'Tier', t ? 'Clients' : 'Customers', '% clients', t ? 'CA' : 'Revenue', '% CA', 'LTV'].join(','));
    tierStats.forEach(st => {
      lines.push([
        st.name, st.count, st.percentage.toFixed(1),
        Math.round(st.revenue),
        totals.totalRev > 0 ? (st.revenue / totals.totalRev * 100).toFixed(1) : '0',
        Math.round(st.avgLTV),
      ].join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'vip-tiers-dashboard.csv');
  };

  const exportPNG = async () => {
    if (!dashRef.current) return;
    try {
      const dataUrl = await toPng(dashRef.current, { backgroundColor: '#F0F0F0', pixelRatio: 2 });
      saveAs(dataUrl, 'vip-tiers-dashboard.png');
    } catch (err) { console.error(err); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="section-subheader">{t ? 'ÉTAPE 8' : 'STEP 8'}</div>
          <h2 className="text-[28px] font-bold text-[#52473C]">{t ? 'Dashboard' : 'Dashboard'}</h2>
          <p className="text-[15px] text-[#645648] mt-0.5">{t ? 'Vue financière essentielle, sans graphiques.' : 'Essential financial view, no charts.'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="btn-secondary"><Download size={13} /> CSV</button>
          <button onClick={exportPNG} className="btn-secondary"><Image size={13} /> PNG</button>
        </div>
      </div>

      <div ref={dashRef} className="space-y-6">

        {/* ─── 1. SCENARIO P&L ─── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="section-header" style={{ marginBottom: 0 }}>{t ? 'P&L PAR SCÉNARIO (PAR AN)' : 'P&L BY SCENARIO (PER YEAR)'}</div>
            <button onClick={resetIncrementality} className="btn-secondary text-[11px] px-2 py-1 inline-flex items-center gap-1">
              <RotateCcw size={11} /> {t ? 'Réinitialiser taux' : 'Reset rates'}
            </button>
          </div>
          <div className="card overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#EEEDE6] border-b border-[#D9D5CB]">
                  <th className="text-left px-4 py-3 font-medium text-[#645648] w-72">
                    <div className="flex items-center gap-1">
                      {t ? 'Indicateur' : 'Metric'}
                      <Tooltip text={t ? "Taux d'incrémentalité : part du CA des membres réellement attribuable au programme (uplift, pas baseline). Éditable par scénario." : 'Incrementality rate: share of member revenue genuinely attributable to the program (uplift, not baseline). Editable per scenario.'} />
                    </div>
                  </th>
                  {scenarioRows.map(s => (
                    <th key={s.key} className="px-4 py-3 font-medium text-[#645648]">
                      <div className="text-[12px] text-right">{t ? s.labelFr : s.labelEn}</div>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <span className="text-[10px] text-[#8A7D6B] font-normal">{t ? 'Incrémentalité' : 'Incrementality'}:</span>
                        <input
                          type="number" min={0} max={100} step={5}
                          value={s.incrementality}
                          onChange={e => updateIncrementality(s.key, e.target.value)}
                          className="w-14 px-1.5 py-0.5 text-[12px] text-right font-medium"
                        />
                        <span className="text-[10px] text-[#8A7D6B]">%</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <PnlRow label={t ? 'CA loyalty (incrémental)' : 'Loyalty revenue (incremental)'}
                  values={scenarioRows.map(r => r.caLoyalty)}
                  hint={t ? `${formatCurrency(totalCustomerRevenue)} × taux` : `${formatCurrency(totalCustomerRevenue)} × rate`} />
                <PnlRow label={t ? 'CA referral' : 'Referral revenue'}
                  values={scenarioRows.map(r => r.caReferral)}
                  hint={t ? 'Fixe — voir étape Parrainage' : 'Fixed — see Referral step'} />
                <PnlRow label={t ? 'CA total' : 'Total revenue'}
                  values={scenarioRows.map(r => r.caTotal)} bold />
                <PnlRow label={`${t ? 'Marge brute' : 'Gross margin'} (×${settings.grossMargin}%)`}
                  values={scenarioRows.map(r => r.margin)} />
                <PnlRow label={t ? 'Coût des rewards' : 'Rewards cost'}
                  values={scenarioRows.map(r => -r.rewardsCost)} negative
                  hint={t ? 'Modélisé via utilisation rewards × paliers' : 'Modeled via reward utilization × tiers'} />
                <PnlRow label={t ? 'Profit net' : 'Net profit'}
                  values={scenarioRows.map(r => r.netProfit)} bold profit />
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-[#8A7D6B] mt-2">
            {t
              ? "« CA loyalty (incrémental) » = CA total des membres × taux d'incrémentalité. Le taux varie typiquement de 40% (conservateur) à 70% (optimiste) selon la maturité du programme. Le coût des rewards est calculé à partir de l'utilisation modélisée (perks × paliers × taux d'utilisation), avec une légère sensibilité au scénario via l'engagement missions."
              : '"Loyalty revenue (incremental)" = total member revenue × incrementality rate. The rate typically ranges from 40% (conservative) to 70% (optimistic) depending on program maturity. Rewards cost is computed from modeled utilization (perks × tiers × utilization rates), with light sensitivity to the scenario via mission engagement.'}
          </p>
        </div>

        {/* ─── 2. TIER BREAKDOWN ─── */}
        <div>
          <div className="section-header">{t ? 'RÉPARTITION PAR PALIER' : 'TIER BREAKDOWN'}</div>
          <div className="card overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#EEEDE6] border-b border-[#D9D5CB]">
                  <th className="text-left px-4 py-3 font-medium text-[#645648]">{t ? 'Palier' : 'Tier'}</th>
                  <th className="text-right px-4 py-3 font-medium text-[#645648]">{t ? 'Clients' : 'Customers'}</th>
                  <th className="text-right px-4 py-3 font-medium text-[#645648]">% clients</th>
                  <th className="text-right px-4 py-3 font-medium text-[#645648]">{t ? 'CA / an' : 'Revenue / yr'}</th>
                  <th className="text-right px-4 py-3 font-medium text-[#645648]">% CA</th>
                  <th className="text-right px-4 py-3 font-medium text-[#645648]">LTV {t ? 'moyen' : 'avg'}</th>
                  <th className="text-right px-4 py-3 font-medium text-[#645648]">AOV {t ? 'moyen' : 'avg'}</th>
                </tr>
              </thead>
              <tbody>
                {tierStats.map((stat, i) => {
                  const revPct = totals.totalRev > 0 ? (stat.revenue / totals.totalRev) * 100 : 0;
                  return (
                    <tr key={i} className="border-b border-[#E5E1D8] hover:bg-[#EEEDE6]">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stat.color }} />
                          <span className="font-medium text-[#645648]">{stat.name}</span>
                        </div>
                      </td>
                      <td className="text-right px-4 py-2.5 text-[#645648] tabular-nums">{formatNumber(stat.count)}</td>
                      <td className="text-right px-4 py-2.5 text-[#645648] tabular-nums">{formatPercent(stat.percentage)}</td>
                      <td className="text-right px-4 py-2.5 text-[#645648] tabular-nums">{formatCurrency(stat.revenue)}</td>
                      <td className="text-right px-4 py-2.5 text-[#645648] tabular-nums">{formatPercent(revPct)}</td>
                      <td className="text-right px-4 py-2.5 text-[#52473C] font-medium tabular-nums">{formatCurrency(stat.avgLTV)}</td>
                      <td className="text-right px-4 py-2.5 text-[#645648] tabular-nums">{formatCurrency(stat.avgAOV)}</td>
                    </tr>
                  );
                })}
                {nonMembers.count > 0 && (
                  <tr className="border-b border-[#E5E1D8] hover:bg-[#EEEDE6]" style={{ backgroundColor: '#FAFAF7' }}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#D9D5CB' }} />
                        <span className="font-medium text-[#8A7D6B] italic">{t ? 'Non-membres' : 'Non-members'}</span>
                      </div>
                    </td>
                    <td className="text-right px-4 py-2.5 text-[#8A7D6B] tabular-nums italic">{formatNumber(nonMembers.count)}</td>
                    <td className="text-right px-4 py-2.5 text-[#8A7D6B] tabular-nums italic">
                      {formatPercent(totalCustomerCount > 0 ? (nonMembers.count / totalCustomerCount) * 100 : 0)}
                    </td>
                    <td className="text-right px-4 py-2.5 text-[#8A7D6B] tabular-nums italic">{formatCurrency(nonMembers.revenue)}</td>
                    <td className="text-right px-4 py-2.5 text-[#8A7D6B] tabular-nums italic">
                      {formatPercent(totals.totalRev > 0 ? (nonMembers.revenue / totals.totalRev) * 100 : 0)}
                    </td>
                    <td className="text-right px-4 py-2.5 text-[#8A7D6B] tabular-nums italic">{formatCurrency(nonMembers.avgLTV)}</td>
                    <td className="text-right px-4 py-2.5 text-[#8A7D6B] tabular-nums italic">{formatCurrency(nonMembers.avgAOV)}</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-[#EEEDE6] border-t border-[#D9D5CB] font-semibold">
                  <td className="px-4 py-3 text-[#645648]">Total</td>
                  <td className="text-right px-4 py-3 text-[#52473C] tabular-nums">{formatNumber(totals.customersCount)}</td>
                  <td className="text-right px-4 py-3 text-[#52473C] tabular-nums">100.0%</td>
                  <td className="text-right px-4 py-3 text-[#52473C] tabular-nums">{formatCurrency(totals.totalRev)}</td>
                  <td className="text-right px-4 py-3 text-[#52473C] tabular-nums">100.0%</td>
                  <td className="text-right px-4 py-3 text-[#52473C] tabular-nums">
                    {totals.customersCount > 0 ? formatCurrency(totals.totalRev / totals.customersCount) : '—'}
                  </td>
                  <td className="text-right px-4 py-3 text-[#52473C] tabular-nums">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-[11px] text-[#8A7D6B] mt-2">
            {nonMembers.count > 0 && (
              <span className="block mb-1">
                {t
                  ? `Seuil d'adhésion au programme : ${formatNumber(nonMembers.count)} client(s) (${formatPercent(totalCustomerCount > 0 ? (nonMembers.count / totalCustomerCount) * 100 : 0)}) sous le seuil du premier palier — exclus du programme.`
                  : `Program entry threshold: ${formatNumber(nonMembers.count)} customer(s) (${formatPercent(totalCustomerCount > 0 ? (nonMembers.count / totalCustomerCount) * 100 : 0)}) below the first tier's threshold — excluded from the program.`}
              </span>
            )}
            {config.tiersExpire
              ? (t
                  ? `Réévaluation des paliers : tous les ${config.tierExpirationMonths} mois ${config.tierExpirationType === 'rolling' ? 'glissants' : 'fixes'} — un client peut redescendre d'un palier s'il ne maintient pas le seuil sur la fenêtre.`
                  : `Tier reassessment: every ${config.tierExpirationMonths} months ${config.tierExpirationType} — a customer can drop a tier if they don't maintain the threshold over the window.`)
              : (t
                  ? "Pas de réévaluation des paliers — un client garde son statut une fois acquis."
                  : 'No tier reassessment — once a tier is earned, the customer keeps the status.')}
          </p>
        </div>

        {/* ─── 3. POINTS ECONOMY (CFO VIEW) ─── */}
        {config.hasMissions && (
          <div>
            <div className="section-header">{t ? 'MASSE MONÉTAIRE DES POINTS (VUE CFO)' : 'POINTS MONETARY MASS (CFO VIEW)'}</div>
            <div className="card overflow-hidden">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-[#EEEDE6] border-b border-[#D9D5CB]">
                    <th className="text-left px-4 py-3 font-medium text-[#645648]">{t ? 'Flux' : 'Flow'}</th>
                    <th className="text-right px-4 py-3 font-medium text-[#645648]">{t ? 'Volume (pts)' : 'Volume (pts)'}</th>
                    <th className="text-right px-4 py-3 font-medium text-[#645648]">
                      <div className="flex items-center gap-1 justify-end">
                        {t ? 'Valeur faciale €' : 'Face value €'}
                        <Tooltip text={t ? `1 pt = ${formatCurrency(pointFaceValue)} (1/${settings.pointsPerEuro})` : `1 pt = ${formatCurrency(pointFaceValue)} (1/${settings.pointsPerEuro})`} />
                      </div>
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-[#645648]">
                      <div className="flex items-center gap-1 justify-end">
                        {t ? 'Coût réel €' : 'Real cost €'}
                        <Tooltip text={t ? `Coût réel par point brûlé = coût burn modélisé / pts brûlés = ${formatCurrency(realCostPerBurnedPoint)}/pt. Reflète l'utilisation modélisée (utilization × paliers × rewards).` : `Real cost per burned point = modeled burn cost / pts burned = ${formatCurrency(realCostPerBurnedPoint)}/pt. Reflects modeled utilization (utilization × tiers × rewards).`} />
                      </div>
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-[#645648]">{t ? 'Commentaire' : 'Comment'}</th>
                  </tr>
                </thead>
                <tbody>
                  <PointsRow
                    label={t ? 'Points émis / an' : 'Points emitted / yr'}
                    volume={pointsEconomy.totalEmitted}
                    face={pointsEconomy.totalEmitted * pointFaceValue}
                    real={pointsEconomy.totalEmitted * realCostPerBurnedPoint}
                    comment={t ? 'Émission brute (achats + missions)' : 'Gross emission (purchases + missions)'}
                  />
                  <PointsRow
                    label={t ? 'Points brûlés / an' : 'Points burned / yr'}
                    volume={pointsEconomy.totalBurned}
                    face={pointsEconomy.totalBurned * pointFaceValue}
                    real={pointsEconomy.totalBurned * realCostPerBurnedPoint}
                    comment={`${t ? 'Cible burn' : 'Burn target'} ${burnRate}% × ${t ? 'utilisation modélisée' : 'modeled utilization'}`}
                    color="green"
                  />
                  <PointsRow
                    label={t ? 'Points dormants (en circulation)' : 'Dormant points (in circulation)'}
                    volume={pointsEconomy.totalDormant}
                    face={provisionFace}
                    real={provisionReal}
                    comment={t ? 'Non encore utilisés — passif latent' : 'Not yet redeemed — outstanding liability'}
                    color="orange"
                  />
                </tbody>
                <tfoot>
                  <tr className="bg-[#EEEDE6] border-t border-[#D9D5CB] font-semibold">
                    <td className="px-4 py-3 text-[#645648]">{t ? 'Provision recommandée' : 'Recommended provision'}</td>
                    <td className="text-right px-4 py-3 text-[#52473C] tabular-nums">—</td>
                    <td className="text-right px-4 py-3 text-[#DC2626] font-bold tabular-nums">{formatCurrency(provisionFace)}</td>
                    <td className="text-right px-4 py-3 text-[#059669] font-bold tabular-nums">{formatCurrency(provisionReal)}</td>
                    <td className="px-4 py-3 text-[11px] text-[#8A7D6B]">
                      {t ? 'Le coût réel est plus représentatif (utilisation modélisée)' : 'Real cost is more representative (modeled utilization)'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* CFO impact block */}
            <div className="card mt-3" style={{ borderLeft: '3px solid #F59E0B', backgroundColor: '#FFFBEB' }}>
              <div className="section-subheader" style={{ color: '#92400E' }}>
                {t ? 'IMPACT POUR LE CFO' : 'CFO IMPACT'}
              </div>
              <ul className="space-y-1.5 text-[13px] text-[#52473C] mt-2">
                <li>
                  <strong>{t ? 'Taux d\'utilisation actuel' : 'Current utilization rate'} :</strong>{' '}
                  {formatPercent(pointsEconomy.utilizationRate)}
                  <span className="text-[12px] text-[#8A7D6B] ml-2">
                    {t ? '(part des points émis qui sont effectivement brûlés)' : '(share of emitted points actually burned)'}
                  </span>
                </li>
                <li>
                  <strong>{t ? 'Cash flow effectif' : 'Effective cash impact'} :</strong>{' '}
                  {formatCurrency(baseFunnel.burnCost)} {t ? 'de coût burn modélisé par an' : 'in modeled burn cost per year'}{' '}
                  ({formatCompact(pointsEconomy.totalBurned)} pts × {formatCurrency(realCostPerBurnedPoint)}/pt).
                </li>
                <li>
                  <strong>{t ? 'Provision recommandée' : 'Recommended provision'} :</strong>{' '}
                  <span className="text-[#059669] font-semibold">{formatCurrency(provisionReal)}</span> {t ? '(coût réel)' : '(real cost)'}
                  {' '}vs <span className="text-[#DC2626] font-semibold">{formatCurrency(provisionFace)}</span> {t ? '(valeur faciale, vue prudente)' : '(face value, prudent view)'}.
                </li>
                <li>
                  <strong>{t ? 'Risque marge' : 'Margin risk'} :</strong>{' '}
                  {t ? 'si 100% des points dormants sont brûlés simultanément (coût réel)' : 'if 100% of dormant points were burned at once (real cost)'} →{' '}
                  <span className="text-[#DC2626] font-semibold">−{formatCurrency(provisionReal)}</span>{' '}
                  {t ? 'de coût additionnel ponctuel' : 'one-off additional cost'}.
                </li>
                <li>
                  <strong>{t ? 'Expiration des points' : 'Points expiration'} :</strong>{' '}
                  {config.pointsExpire
                    ? (t
                        ? `activée (${config.expirationMonths} mois ${config.expirationType === 'rolling' ? 'glissants' : 'fixes'}) — réduit le passif latent.`
                        : `enabled (${config.expirationMonths} months ${config.expirationType}) — reduces outstanding liability.`)
                    : (t
                        ? 'aucune — le passif s\'accumule année après année.'
                        : 'none — liability accumulates year over year.')}
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Inline nav (last step — Prev only) */}
      <div className="flex justify-between pt-6">
        {onPrev ? (
          <button onClick={onPrev} className="btn-secondary">
            <ChevronLeft size={16} /> {t ? 'Précédent' : 'Previous'}
          </button>
        ) : <span />}
        <span />
      </div>
    </div>
  );
}

// ─── Row helpers ───
function PnlRow({ label, values, bold, negative, profit, hint }) {
  const baseTextClass = bold ? 'font-bold text-[#52473C]' : 'text-[#645648]';
  return (
    <tr className={`border-b border-[#E5E1D8] ${bold ? 'bg-[#FAFAF7]' : ''}`}>
      <td className={`px-4 py-2.5 ${baseTextClass}`}>
        {label}
        {hint && <div className="text-[10px] text-[#8A7D6B] font-normal mt-0.5">{hint}</div>}
      </td>
      {values.map((v, i) => {
        let cls = `tabular-nums ${baseTextClass}`;
        if (negative) cls = `tabular-nums font-medium text-[#DC2626]`;
        if (profit) cls = `tabular-nums font-bold ${v >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`;
        const prefix = profit && v >= 0 ? '+' : '';
        return (
          <td key={i} className={`text-right px-4 py-2.5 ${cls}`}>
            {prefix}{formatCurrency(Math.round(v))}
          </td>
        );
      })}
    </tr>
  );
}

function PointsRow({ label, volume, face, real, comment, color }) {
  const volColor = color === 'green' ? 'text-[#059669]' : color === 'orange' ? 'text-[#D97706]' : 'text-[#52473C]';
  return (
    <tr className="border-b border-[#E5E1D8] hover:bg-[#EEEDE6]">
      <td className="px-4 py-2.5 text-[#645648]">{label}</td>
      <td className={`text-right px-4 py-2.5 font-medium tabular-nums ${volColor}`}>{formatCompact(volume)}</td>
      <td className="text-right px-4 py-2.5 tabular-nums text-[#645648]">{formatCurrency(face)}</td>
      <td className={`text-right px-4 py-2.5 font-medium tabular-nums ${volColor}`}>{formatCurrency(real)}</td>
      <td className="px-4 py-2.5 text-[12px] text-[#8A7D6B]">{comment}</td>
    </tr>
  );
}
