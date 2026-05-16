import { useMemo, useRef } from 'react';
import { Download, Image } from 'lucide-react';
import { saveAs } from 'file-saver';
import { toPng } from 'html-to-image';
import {
  computeCustomerScores, assignTiers, computeTierStats,
  computeProgramFunnel, computeReferralEconomics, computePointsEconomy,
  derivePointsFromCashback,
  formatCurrency, formatNumber, formatPercent, formatCompact,
} from '../utils/calculations';

const SCENARIOS = [
  { key: 'conservative', mult: 0.6, labelFr: 'Conservateur', labelEn: 'Conservative' },
  { key: 'base',          mult: 1.0, labelFr: 'Base',          labelEn: 'Base' },
  { key: 'optimistic',    mult: 1.4, labelFr: 'Optimiste',     labelEn: 'Optimistic' },
];

export default function Step5_Dashboard({
  tiers, customers, settings, config,
  missions, customMissions, rewards, burnRate,
  lang, referralConfig,
}) {
  const t = lang === 'fr';
  const dashRef = useRef(null);

  const tierStats = useMemo(() => {
    const scored = computeCustomerScores(customers, settings.segmentationType, settings.caWeight);
    const { pointsPerEuro } = derivePointsFromCashback(settings.cashbackRate, settings.pointsPerEuro);
    const assigned = assignTiers(scored, tiers, config.tierBasis, { pointsPerEuro });
    return computeTierStats(assigned, tiers);
  }, [customers, settings, tiers, config]);

  const referralEcon = useMemo(
    () => computeReferralEconomics(referralConfig, settings.aov),
    [referralConfig, settings.aov]
  );

  // One funnel per scenario → drives the P&L columns.
  const scenarioRows = useMemo(() => {
    return SCENARIOS.map(s => {
      const f = computeProgramFunnel(tierStats, missions, customMissions, rewards, settings, tiers, s.mult);
      const caLoyalty   = f.incrementalRevenue;
      const caReferral  = referralEcon.revenuePerYear;
      const caTotal     = caLoyalty + caReferral;
      const margin      = caTotal * (settings.grossMargin / 100);
      const rewardsCost = f.rewardsCost + referralEcon.totalCostPerYear;
      const netProfit   = margin - rewardsCost;
      return { ...s, caLoyalty, caReferral, caTotal, margin, rewardsCost, netProfit };
    });
  }, [tierStats, missions, customMissions, rewards, settings, tiers, referralEcon]);

  const pointsEconomy = useMemo(
    () => computePointsEconomy(tierStats, tiers, missions, customMissions, rewards, settings, burnRate),
    [tierStats, tiers, missions, customMissions, rewards, settings, burnRate]
  );

  // Convert a point quantity to € using current settings.pointsPerEuro (= pts per 1€ reward).
  const ptsToEur = (pts) => {
    const p = settings.pointsPerEuro || 100;
    return pts / p;
  };

  // Tier breakdown totals
  const totals = useMemo(() => {
    const customersCount = tierStats.reduce((s, st) => s + st.count, 0);
    const totalRev = tierStats.reduce((s, st) => s + st.revenue, 0);
    return { customersCount, totalRev };
  }, [tierStats]);

  const exportCSV = () => {
    const lines = [];
    // Scenario P&L
    lines.push([t ? 'Indicateur' : 'Metric', ...SCENARIOS.map(s => t ? s.labelFr : s.labelEn)].join(','));
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
    // Tier breakdown
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
          <div className="section-header">{t ? 'P&L PAR SCÉNARIO (PAR AN)' : 'P&L BY SCENARIO (PER YEAR)'}</div>
          <div className="card overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-[#EEEDE6] border-b border-[#D9D5CB]">
                  <th className="text-left px-4 py-3 font-medium text-[#645648]">{t ? 'Indicateur' : 'Metric'}</th>
                  {scenarioRows.map(s => (
                    <th key={s.key} className="text-right px-4 py-3 font-medium text-[#645648]">
                      <div className="text-[12px]">{t ? s.labelFr : s.labelEn}</div>
                      <div className="text-[10px] text-[#8A7D6B] font-normal">×{s.mult}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <PnlRow label={t ? 'CA loyalty (incrémental)' : 'Loyalty revenue (incremental)'}
                  values={scenarioRows.map(r => r.caLoyalty)} />
                <PnlRow label={t ? 'CA referral' : 'Referral revenue'}
                  values={scenarioRows.map(r => r.caReferral)} />
                <PnlRow label={t ? 'CA total' : 'Total revenue'}
                  values={scenarioRows.map(r => r.caTotal)} bold />
                <PnlRow label={`${t ? 'Marge brute' : 'Gross margin'} (×${settings.grossMargin}%)`}
                  values={scenarioRows.map(r => r.margin)} />
                <PnlRow label={t ? 'Coût des rewards' : 'Rewards cost'}
                  values={scenarioRows.map(r => -r.rewardsCost)} negative />
                <PnlRow label={t ? 'Profit net' : 'Net profit'}
                  values={scenarioRows.map(r => r.netProfit)} bold profit />
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-[#8A7D6B] mt-2">
            {t
              ? "« CA loyalty » = CA incrémental attribuable au programme (uplift). Le scénario multiplie l'engagement missions (×0.6 / ×1 / ×1.4). Le CA referral utilise les hypothèses définies à l'étape Parrainage."
              : '"Loyalty revenue" = incremental revenue attributable to the program (uplift). The scenario scales mission engagement (×0.6 / ×1 / ×1.4). Referral revenue uses the inputs from the Referral step.'}
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
                    <th className="text-right px-4 py-3 font-medium text-[#645648]">{t ? 'Équivalent €' : 'EUR equivalent'}</th>
                    <th className="text-left px-4 py-3 font-medium text-[#645648]">{t ? 'Commentaire' : 'Comment'}</th>
                  </tr>
                </thead>
                <tbody>
                  <PointsRow
                    label={t ? 'Points émis / an' : 'Points emitted / yr'}
                    volume={pointsEconomy.totalEmitted}
                    eur={ptsToEur(pointsEconomy.totalEmitted)}
                    comment={t ? 'Émission brute (achats + missions)' : 'Gross emission (purchases + missions)'}
                  />
                  <PointsRow
                    label={t ? 'Points brûlés / an' : 'Points burned / yr'}
                    volume={pointsEconomy.totalBurned}
                    eur={ptsToEur(pointsEconomy.totalBurned)}
                    comment={`${t ? 'Cible burn' : 'Burn target'} ${burnRate}%`}
                    color="green"
                  />
                  <PointsRow
                    label={t ? 'Points dormants (en circulation)' : 'Dormant points (in circulation)'}
                    volume={pointsEconomy.totalDormant}
                    eur={ptsToEur(pointsEconomy.totalDormant)}
                    comment={t ? 'Non encore utilisés — passif latent' : 'Not yet redeemed — outstanding liability'}
                    color="orange"
                  />
                </tbody>
                <tfoot>
                  <tr className="bg-[#EEEDE6] border-t border-[#D9D5CB] font-semibold">
                    <td className="px-4 py-3 text-[#645648]">{t ? 'Provision IFRS (passif latent)' : 'IFRS provision (outstanding liability)'}</td>
                    <td className="text-right px-4 py-3 text-[#52473C] tabular-nums">—</td>
                    <td className="text-right px-4 py-3 text-[#DC2626] font-bold tabular-nums">{formatCurrency(pointsEconomy.provisionEur || ptsToEur(pointsEconomy.totalDormant))}</td>
                    <td className="px-4 py-3 text-[11px] text-[#8A7D6B]">{t ? 'À provisionner au bilan' : 'To provision on balance sheet'}</td>
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
                  {formatCurrency(ptsToEur(pointsEconomy.totalBurned))} {t ? 'de remises / cadeaux décaissés par an' : 'in discounts / gifts disbursed per year'}.
                </li>
                <li>
                  <strong>{t ? 'Risque marge' : 'Margin risk'} :</strong>{' '}
                  {t ? 'si 100% des points dormants sont brûlés simultanément' : 'if 100% of dormant points were burned at once'} →{' '}
                  <span className="text-[#DC2626] font-semibold">−{formatCurrency(ptsToEur(pointsEconomy.totalDormant))}</span>{' '}
                  {t ? 'de coût additionnel ponctuel' : 'one-off additional cost'}.
                </li>
                <li>
                  <strong>{t ? 'Stratégie d\'expiration' : 'Expiration strategy'} :</strong>{' '}
                  {config.pointsExpire
                    ? (t
                        ? `expiration activée (${config.expirationMonths} mois ${config.expirationType === 'rolling' ? 'glissants' : 'fixes'}) — réduit le passif latent.`
                        : `expiration enabled (${config.expirationMonths} months ${config.expirationType}) — reduces outstanding liability.`)
                    : (t
                        ? 'aucune expiration — le passif s\'accumule année après année.'
                        : 'no expiration — liability accumulates year over year.')}
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Row helpers ───
function PnlRow({ label, values, bold, negative, profit }) {
  const baseTextClass = bold ? 'font-bold text-[#52473C]' : 'text-[#645648]';
  return (
    <tr className={`border-b border-[#E5E1D8] ${bold ? 'bg-[#FAFAF7]' : ''}`}>
      <td className={`px-4 py-2.5 ${baseTextClass}`}>{label}</td>
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

function PointsRow({ label, volume, eur, comment, color }) {
  const volColor = color === 'green' ? 'text-[#059669]' : color === 'orange' ? 'text-[#D97706]' : 'text-[#52473C]';
  return (
    <tr className="border-b border-[#E5E1D8] hover:bg-[#EEEDE6]">
      <td className="px-4 py-2.5 text-[#645648]">{label}</td>
      <td className={`text-right px-4 py-2.5 font-medium tabular-nums ${volColor}`}>{formatCompact(volume)}</td>
      <td className={`text-right px-4 py-2.5 font-medium tabular-nums ${volColor}`}>{formatCurrency(eur)}</td>
      <td className="px-4 py-2.5 text-[12px] text-[#8A7D6B]">{comment}</td>
    </tr>
  );
}
