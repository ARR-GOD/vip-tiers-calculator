import { useMemo, useRef, useState } from 'react';
import { Download, Image, RotateCcw, ChevronLeft, TrendingUp } from 'lucide-react';
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
  { key: 'conservative', mult: 0.6, defaultParticipation: 20, labelFr: 'Conservateur', labelEn: 'Conservative' },
  { key: 'base',          mult: 1.0, defaultParticipation: 40, labelFr: 'Base',          labelEn: 'Base' },
  { key: 'optimistic',    mult: 1.4, defaultParticipation: 60, labelFr: 'Optimiste',     labelEn: 'Optimistic' },
];

export default function Step5_Dashboard({
  tiers, customers, settings, config,
  missions, customMissions, rewards, burnRate,
  lang, referralConfig, onPrev,
}) {
  const t = lang === 'fr';
  const dashRef = useRef(null);

  // ── Active scenario (selector) + single global participation rate ──
  const [activeKey, setActiveKey] = useState('base');
  const [globalParticipation, setGlobalParticipation] = useState(40);
  const activeScenario = SCENARIOS.find(s => s.key === activeKey) || SCENARIOS[1];
  const activeMult = activeScenario.mult;
  const resetParticipation = () => setGlobalParticipation(40);

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

  // Single global participation rate applied to all scenarios.
  //   CA loyalty   = totalCustomerRevenue × globalParticipation%
  //   Coût rewards = f.rewardsCost × globalParticipation%  (+ referral cost × mult)
  // Referral CA + cost scale with the scenario multiplier since engagement
  // drives how many referrals actually happen.
  const scenarioRows = useMemo(() => {
    const part = globalParticipation / 100;
    return SCENARIOS.map(s => {
      const f = computeProgramFunnel(tierStats, missions, customMissions, rewards, settings, tiers, s.mult);
      const caLoyalty     = totalCustomerRevenue * part;
      const caReferral    = referralEcon.revenuePerYear * s.mult;
      const referralCost  = referralEcon.totalCostPerYear * s.mult;
      const caTotal       = caLoyalty + caReferral;
      const margin        = caTotal * (settings.grossMargin / 100);
      const rewardsCost   = f.rewardsCost * part + referralCost;
      const netProfit     = margin - rewardsCost;
      return { ...s,
        caLoyalty, caReferral, caTotal, margin, rewardsCost, netProfit,
        burnCost: f.burnCost * part, perkCost: f.perkCost * part };
    });
  }, [tierStats, missions, customMissions, rewards, settings, tiers, referralEcon, totalCustomerRevenue, globalParticipation]);

  const pointsEconomy = useMemo(
    () => computePointsEconomy(tierStats, tiers, missions, customMissions, rewards, settings, burnRate, activeMult),
    [tierStats, tiers, missions, customMissions, rewards, settings, burnRate, activeMult]
  );

  // ── Real cost per burned point, derived from modeled reward utilization ──
  // Reflects the burn cost under the ACTIVE scenario so the provision moves with it.
  const activeFunnel = useMemo(
    () => computeProgramFunnel(tierStats, missions, customMissions, rewards, settings, tiers, activeMult),
    [tierStats, missions, customMissions, rewards, settings, tiers, activeMult]
  );

  // Two ways to value the dormant points (the outstanding liability):
  //   - faceValue: 1 pt = 1 / pointsPerEuro € (what the customer can redeem in face value)
  //   - realCost:  burnCost / totalBurned (what the company actually pays per point burned)
  // Fallback: if no burn rewards are modeled (or 0 utilization), the modeled
  // burn cost is 0 — in that case "real cost" is undefined and we fall back to
  // face value so the column doesn't display a misleading 0€.
  const pointFaceValue = 1 / (settings.pointsPerEuro || 100);
  const realCostPerBurnedPoint = (pointsEconomy.totalBurned > 0 && activeFunnel.burnCost > 0)
    ? activeFunnel.burnCost / pointsEconomy.totalBurned
    : pointFaceValue;
  const realCostIsFallback = !(pointsEconomy.totalBurned > 0 && activeFunnel.burnCost > 0);
  const provisionFace = pointsEconomy.totalDormant * pointFaceValue;
  const provisionReal = pointsEconomy.totalDormant * realCostPerBurnedPoint;

  // Tier breakdown totals — totals include non-members so percentages reflect
  // the imported base, not just the program members.
  const totals = useMemo(() => ({
    customersCount: totalCustomerCount,
    totalRev: totalCustomerRevenue,
  }), [totalCustomerCount, totalCustomerRevenue]);

  const exportCSV = () => {
    const lines = [];
    lines.push([t ? `Indicateur (participation ${globalParticipation}%)` : `Metric (participation ${globalParticipation}%)`, ...SCENARIOS.map(s => `${t ? s.labelFr : s.labelEn} (×${s.mult})`)].join(','));
    const labelMap = [
      [t ? 'CA loyalty (membres actifs)' : 'Loyalty revenue (active members)', 'caLoyalty'],
      [t ? 'CA referral'                 : 'Referral revenue',                 'caReferral'],
      [t ? 'CA total'                    : 'Total revenue',                    'caTotal'],
      [`${t ? 'Marge brute' : 'Gross margin'} (${settings.grossMargin}%)`, 'margin'],
      [t ? 'Coût des rewards'            : 'Rewards cost',                     'rewardsCost'],
      [t ? 'Profit net'                  : 'Net profit',                       'netProfit'],
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

      {/* Scenario selector — drives every dashboard number below */}
      <div className="card flex flex-wrap items-center gap-4" style={{ padding: 16 }}>
        <span className="text-[13px] font-medium text-[#52473C]">{t ? 'Scénario actif :' : 'Active scenario:'}</span>
        <div className="flex gap-1.5">
          {SCENARIOS.map(s => {
            const isActive = activeKey === s.key;
            return (
              <button key={s.key} onClick={() => setActiveKey(s.key)}
                className={`px-3.5 py-1.5 rounded-[10px] text-[12px] font-semibold border transition-all ${
                  isActive
                    ? 'bg-primary text-white border-primary'
                    : 'bg-[#FBFAF6] text-[#52473C] border-[#E5E1D8] hover:border-[#D9D5CB]'
                }`}
                style={isActive ? { boxShadow: '0 1px 2px rgba(15,15,15,0.06), inset 0 1px 0 rgba(255,255,255,0.16)' } : undefined}
              >
                {t ? s.labelFr : s.labelEn}
                <span className={`ml-1.5 font-normal ${isActive ? 'opacity-70' : 'text-[#8A7D6B]'}`}>×{s.mult}</span>
              </button>
            );
          })}
        </div>
        <span className="ml-auto text-[11px] text-[#8A7D6B] max-w-[420px]">
          {t
            ? `Pilote la P&L, l'économie des points et la provision CFO. Marge brute : ${settings.grossMargin}% • Participation globale : ${globalParticipation}%.`
            : `Drives the P&L, points economy and CFO provision. Gross margin: ${settings.grossMargin}% • Global participation: ${globalParticipation}%.`}
        </span>
      </div>

      {/* Global participation rate — single input applied to every scenario */}
      <div className="card flex flex-wrap items-center gap-4" style={{ padding: 16 }}>
        <span className="text-[13px] font-medium text-[#52473C]">
          {t ? 'Taux de participation :' : 'Participation rate:'}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-[#E5E1D8]">
          <input
            type="text" inputMode="numeric" pattern="[0-9]*"
            value={globalParticipation}
            onChange={e => {
              const v = Math.max(0, Math.min(100, parseInt(e.target.value.replace(/[^0-9]/g, '')) || 0));
              setGlobalParticipation(v);
            }}
            className="w-12 text-[13px] text-right font-semibold bg-transparent border-0 focus:outline-none focus:ring-0 h-auto p-0"
          />
          <span className="text-[11px] text-[#8A7D6B]">%</span>
        </span>
        <button onClick={resetParticipation} className="text-[11px] text-primary hover:underline font-medium">
          {t ? 'Réinitialiser (40%)' : 'Reset (40%)'}
        </button>
        <span className="ml-auto text-[11px] text-[#8A7D6B] max-w-[540px]">
          {t
            ? `% de la base client réellement inscrit et actif dans le programme. Applique le même taux aux 3 scénarios (CA loyalty + coût rewards scalés proportionnellement). Les scénarios ne diffèrent que par l'engagement missions / rewards / parrainage.`
            : `% of the customer base enrolled and active in the program. Same rate for all 3 scenarios (loyalty CA + rewards cost scaled proportionally). Scenarios only differ via mission / reward / referral engagement.`}
        </span>
      </div>

      <div ref={dashRef} className="space-y-6">

        {/* ─── 1. SCENARIO P&L ─── */}
        <div>
          <div className="section-header">{t ? 'P&L PAR SCÉNARIO (PAR AN)' : 'P&L BY SCENARIO (PER YEAR)'}</div>
          <div className="card overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#FBFAF6] border-b border-[#E5E1D8]">
                  <th className="text-left px-4 py-3 font-medium text-[#52473C] w-72">
                    <div className="flex items-center gap-1">
                      {t ? 'Indicateur' : 'Metric'}
                      <Tooltip text={t ? "Les 3 scénarios diffèrent par leur engagement (×0.6 / ×1 / ×1.4) qui module l'utilisation des rewards et le volume de parrainages. Le taux de participation global est identique aux 3 scénarios." : 'The 3 scenarios differ by engagement multiplier (×0.6 / ×1 / ×1.4) which scales reward utilization and referral volume. The global participation rate is the same across all 3.'} />
                    </div>
                  </th>
                  {scenarioRows.map(s => {
                    const isActive = s.key === activeKey;
                    return (
                      <th key={s.key} onClick={() => setActiveKey(s.key)}
                        className={`px-4 py-3 font-medium cursor-pointer transition-colors ${
                          isActive ? 'text-primary' : 'text-[#52473C] hover:bg-[#EEEDE6]'
                        }`}
                        style={isActive ? {
                          background: '#E8EFFE',
                          borderLeft: '1px solid #A3B8FD',
                          borderRight: '1px solid #A3B8FD',
                        } : undefined}>
                        <div className="text-[12px] text-right flex items-center justify-end gap-1.5">
                          {isActive && <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>}
                          {t ? s.labelFr : s.labelEn}
                        </div>
                        <div className="text-[10px] text-[#8A7D6B] font-normal mt-1 text-right">×{s.mult}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const activeIdx = SCENARIOS.findIndex(s => s.key === activeKey);
                  return (
                    <>
                      <PnlRow label={t ? 'CA loyalty (membres actifs)' : 'Loyalty revenue (active members)'}
                        values={scenarioRows.map(r => r.caLoyalty)} activeIdx={activeIdx}
                        hint={t ? `${formatCurrency(totalCustomerRevenue)} × participation` : `${formatCurrency(totalCustomerRevenue)} × participation`} />
                      <PnlRow label={t ? 'CA referral' : 'Referral revenue'}
                        values={scenarioRows.map(r => r.caReferral)} activeIdx={activeIdx}
                        hint={t ? 'Base × engagement du scénario' : 'Base × scenario engagement'} />
                      <PnlRow label={t ? 'CA total' : 'Total revenue'}
                        values={scenarioRows.map(r => r.caTotal)} bold activeIdx={activeIdx} />
                      <PnlRow label={`${t ? 'Marge brute' : 'Gross margin'} (×${settings.grossMargin}%)`}
                        values={scenarioRows.map(r => r.margin)} activeIdx={activeIdx} />
                      <PnlRow label={t ? 'Coût des rewards' : 'Rewards cost'}
                        values={scenarioRows.map(r => -r.rewardsCost)} negative activeIdx={activeIdx}
                        hint={t ? 'Utilisation modélisée × participation' : 'Modeled utilization × participation'} />
                      <PnlRow label={t ? 'Profit net' : 'Net profit'}
                        values={scenarioRows.map(r => r.netProfit)} bold profit activeIdx={activeIdx} />
                    </>
                  );
                })()}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-[#8A7D6B] mt-2">
            {t
              ? `« CA loyalty (membres actifs) » = CA total × ${globalParticipation}% (participation globale). Identique dans les 3 scénarios. Les scénarios diffèrent uniquement par l'engagement (×0.6/×1/×1.4) qui module le CA referral (via les parrainages effectifs) et le coût rewards (via l'utilisation modélisée). Ajuste la participation en haut de page.`
              : `"Loyalty revenue (active members)" = total revenue × ${globalParticipation}% (global participation). Same across all 3 scenarios. Scenarios differ only via engagement multiplier (×0.6/×1/×1.4) which scales referral CA (through actual referrals) and rewards cost (through modeled utilization). Adjust participation at the top of the page.`}
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
            <div className="flex items-baseline gap-2 mb-1">
              <div className="section-header" style={{ marginBottom: 0 }}>{t ? 'MASSE MONÉTAIRE DES POINTS (VUE CFO)' : 'POINTS MONETARY MASS (CFO VIEW)'}</div>
              <span className="text-[10px] text-[#8A7D6B]">— {t ? `scénario ${t ? activeScenario.labelFr : activeScenario.labelEn} (×${activeMult})` : `scenario ${activeScenario.labelEn} (×${activeMult})`}</span>
            </div>
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
                        <Tooltip text={t
                          ? (realCostIsFallback
                              ? `Aucune récompense burn n'est modélisée (ou utilisation à 0) — coût réel non calculable. Fallback : valeur faciale = ${formatCurrency(pointFaceValue)}/pt.`
                              : `Coût réel par point brûlé = coût burn modélisé / pts brûlés = ${formatCurrency(realCostPerBurnedPoint)}/pt. Reflète l'utilisation modélisée (utilization × paliers × rewards).`)
                          : (realCostIsFallback
                              ? `No burn reward modeled (or 0 utilization) — real cost not derivable. Fallback: face value = ${formatCurrency(pointFaceValue)}/pt.`
                              : `Real cost per burned point = modeled burn cost / pts burned = ${formatCurrency(realCostPerBurnedPoint)}/pt. Reflects modeled utilization (utilization × tiers × rewards).`)
                        } />
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
            <div className="card mt-4" style={{ borderLeft: '3px solid #D97706', backgroundColor: '#FFFBEB', borderColor: 'rgba(217,119,6,0.25)' }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-[#FEF3C7] flex items-center justify-center">
                  <TrendingUp size={14} className="text-[#D97706]" strokeWidth={1.6} />
                </div>
                <div className="section-subheader" style={{ color: '#D97706', marginBottom: 0, fontSize: 11 }}>
                  {t ? 'IMPACT POUR LE CFO' : 'CFO IMPACT'}
                </div>
              </div>
              <ul className="space-y-1.5 text-[13px] text-[#2B251F] mt-1 leading-relaxed">
                <li>
                  <strong>{t ? 'Taux d\'utilisation actuel' : 'Current utilization rate'} :</strong>{' '}
                  {formatPercent(pointsEconomy.utilizationRate)}
                  <span className="text-[12px] text-[#8A7D6B] ml-2">
                    {t ? '(part des points émis qui sont effectivement brûlés)' : '(share of emitted points actually burned)'}
                  </span>
                </li>
                <li>
                  <strong>{t ? 'Cash flow effectif' : 'Effective cash impact'} :</strong>{' '}
                  {formatCurrency(activeFunnel.burnCost)} {t ? 'de coût burn modélisé par an' : 'in modeled burn cost per year'}{' '}
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
function PnlRow({ label, values, bold, negative, profit, hint, activeIdx }) {
  const baseTextClass = bold ? 'font-bold text-[#2B251F]' : 'text-[#52473C]';
  return (
    <tr className={`border-b border-[#EEEDE6] ${bold ? 'bg-[#FAFAF7]' : ''}`}>
      <td className={`px-4 py-2.5 ${baseTextClass}`}>
        {label}
        {hint && <div className="text-[10px] text-[#8A7D6B] font-normal mt-0.5">{hint}</div>}
      </td>
      {values.map((v, i) => {
        let cls = `tabular-nums ${baseTextClass}`;
        if (negative) cls = `tabular-nums font-medium text-[#DC2626]`;
        if (profit) cls = `tabular-nums font-bold ${v >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`;
        const prefix = profit && v >= 0 ? '+' : '';
        const isActive = i === activeIdx;
        return (
          <td key={i} className={`text-right px-4 py-2.5 ${cls}`}
            style={isActive ? {
              background: 'rgba(41,101,254,0.04)',
              borderLeft: '1px solid #A3B8FD',
              borderRight: '1px solid #A3B8FD',
            } : undefined}
          >
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
