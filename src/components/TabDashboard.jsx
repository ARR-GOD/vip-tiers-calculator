import { useMemo, useRef } from 'react';
import { Download, Image, TrendingUp, Users, DollarSign, Award, Zap, ArrowUpRight, Flame, Trophy } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { saveAs } from 'file-saver';
import { toPng } from 'html-to-image';
import { ENGAGEMENT_SCENARIOS } from '../data/defaults';
import { computeCustomerScores, assignTiers, computeTierStats, computeExpirationImpact, computeRewardsCost, derivePointsFromCashback, formatCurrency, formatNumber, formatPercent } from '../utils/calculations';

export default function TabDashboard({ tiers, customers, settings, config, missions, customMissions, rewards, burnRate, lang }) {
  const t = lang === 'fr' ? FR : EN;
  const summaryRef = useRef(null);

  // Core calculations
  const { pointsPerEuro } = derivePointsFromCashback(settings.cashbackRate, settings.pointsPerEuro);
  const sorted = useMemo(() => computeCustomerScores(customers, settings.segmentationType, settings.caWeight), [customers, settings]);
  const assigned = useMemo(() => assignTiers(sorted, tiers, config.tierBasis, { pointsPerEuro }), [sorted, tiers, config, pointsPerEuro]);
  const tierStats = useMemo(() => computeTierStats(assigned, tiers), [assigned, tiers]);

  const totalCustomers = tierStats.reduce((s, ts) => s + ts.count, 0);
  const totalRevenue = tierStats.reduce((s, ts) => s + ts.revenue, 0);

  // Engagement scenario data
  const scenarioData = useMemo(() => {
    return Object.entries(ENGAGEMENT_SCENARIOS).map(([key, scenario]) => {
      const allMissions = [...missions, ...customMissions];
      const activeMissions = scenario.missions
        ? allMissions.filter(m => m.enabled && scenario.missions.includes(m.id))
        : allMissions.filter(m => m.enabled);
      const missionPts = activeMissions.reduce((sum, m) =>
        sum + (parseFloat(m.points) || 0) * (parseFloat(m.frequency) || 0) * scenario.frequencyMultiplier, 0);
      const perTier = tiers.map((tier, i) => {
        const aov = parseFloat(settings.aov) || 80;
        const multiplier = parseFloat(tier.pointsMultiplier) || 1;
        const purchasePts = aov * multiplier * pointsPerEuro * (tierStats[i]?.avgOrders || 4);
        return {
          tierName: tier.name, tierColor: tier.color,
          missionPts: Math.round(missionPts), purchasePts: Math.round(purchasePts),
          totalPts: Math.round(missionPts + purchasePts),
        };
      });
      return { key, scenario, perTier };
    });
  }, [missions, customMissions, tiers, settings, tierStats, pointsPerEuro]);

  // Program cost using new burn/perk split
  const costData = useMemo(() => {
    return computeRewardsCost(rewards, burnRate, tierStats, tiers);
  }, [rewards, burnRate, tierStats, tiers]);

  const programCost = costData.totalCost;
  const incrementalRevenue = programCost * 3.5;
  const roi = programCost > 0 ? ((incrementalRevenue - programCost) / programCost) * 100 : 0;
  const grossProfit = incrementalRevenue * ((settings.grossMargin || 50) / 100);
  const netProfit = grossProfit - programCost;

  // Expiration
  const expirationPct = config.pointsExpire ? computeExpirationImpact(config.expirationMonths, config.expirationType === 'rolling') : 0;

  // Chart data
  const pieData = tierStats.map(s => ({ name: s.name, value: s.count, color: s.color }));
  const revenueBarData = tierStats.map(s => ({ name: s.name, revenue: Math.round(s.revenue), color: s.color }));

  const engagementBarData = tiers.map((tier, i) => {
    const row = { name: tier.name };
    scenarioData.forEach(sd => {
      const label = lang === 'fr' ? sd.scenario.nameFr : sd.scenario.nameEn;
      row[label] = sd.perTier[i]?.totalPts || 0;
    });
    return row;
  });
  const scenarioKeys = scenarioData.map(sd => lang === 'fr' ? sd.scenario.nameFr : sd.scenario.nameEn);
  const scenarioColors = ['#F59E0B', '#F97316', '#EF4444'];

  // Upgrade timeline
  const upgradeData = useMemo(() => {
    return tiers.slice(0, -1).map((tier, i) => {
      const nextTier = tiers[i + 1];
      const stat = tierStats[i];
      if (!stat || !nextTier) return null;
      const scenarios = scenarioData.map(sd => {
        const yearlyPts = sd.perTier[i]?.totalPts || 0;
        const monthlyPts = yearlyPts / 12;
        const target = config.tierBasis === 'points'
          ? (nextTier.pointsThreshold || 0) - (tier.pointsThreshold || 0)
          : (stat.avgLTV || 0) * pointsPerEuro;
        const months = monthlyPts > 0 ? Math.ceil(target / monthlyPts) : null;
        return { scenario: lang === 'fr' ? sd.scenario.nameFr : sd.scenario.nameEn, months };
      });
      return { from: tier.name, to: nextTier.name, color: tier.color, nextColor: nextTier.color, scenarios };
    }).filter(Boolean);
  }, [tiers, tierStats, scenarioData, config, pointsPerEuro, lang]);

  // Reward counts per tier
  const getRewardCounts = (tierIndex) => {
    const perks = rewards.filter(r => (r.rewardUsage === 'perk' || r.rewardUsage === 'both') && r.assignedTiers?.[tierIndex]);
    const burns = rewards.filter(r => (r.rewardUsage === 'burn' || r.rewardUsage === 'both') && r.assignedTiers?.[tierIndex]);
    return { perks: perks.length, burns: burns.length, total: new Set([...perks, ...burns].map(r => r.id)).size };
  };

  // Exports
  const exportCSV = () => {
    const headers = ['customer_id', 'total_ordered_TTC', 'number_of_orders', 'tier', 'estimated_points_year'];
    const rows = assigned.map(c => {
      const tierName = tiers[c.tier]?.name || '';
      const pts = scenarioData[1]?.perTier[c.tier]?.totalPts || 0;
      return [c.customer_id, c.total_ordered_TTC, c.number_of_orders, tierName, pts].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    saveAs(blob, 'vip_tiers_export.csv');
  };

  const exportPNG = async () => {
    if (!summaryRef.current) return;
    try {
      const dataUrl = await toPng(summaryRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 });
      saveAs(dataUrl, 'vip_tiers_summary.png');
    } catch (e) { console.error('Export error:', e); }
  };

  return (
    <div className="space-y-5">
      {/* ── KPI CARDS ROW ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KPICard icon={<Users size={16} />} label={t.totalClients} value={formatNumber(totalCustomers)} color="text-primary" bg="bg-primary-50" />
        <KPICard icon={<DollarSign size={16} />} label={t.totalRevenue} value={formatCurrency(totalRevenue)} color="text-emerald-600" bg="bg-emerald-50" />
        <KPICard icon={<Zap size={16} />} label={t.programCost} value={formatCurrency(programCost)} color="text-red-500" bg="bg-red-50" />
        <KPICard icon={<TrendingUp size={16} />} label={t.incrementalRev} value={formatCurrency(incrementalRevenue)} color="text-emerald-600" bg="bg-emerald-50" />
        <KPICard icon={<ArrowUpRight size={16} />} label={t.roi} value={formatPercent(roi)} color="text-primary" bg="bg-primary-50" highlight />
      </div>

      {/* ── UNIT ECONOMICS + COST SPLIT ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Unit Economics */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 text-sm mb-4">{t.unitEconomics}</h3>
          <div className="grid grid-cols-2 gap-3">
            <EconRow label="AOV" value={formatCurrency(parseFloat(settings.aov) || 80)} />
            <EconRow label={t.grossMargin} value={`${settings.grossMargin}%`} />
            <EconRow label={t.cashbackRate} value={`${settings.cashbackRate}%`} />
            <EconRow label={t.burnRateLabel} value={`${burnRate}%`} sub={config.pointsExpire ? `(${t.adjusted}: ${formatNumber(burnRate * (1 - expirationPct / 100))}%)` : null} />
          </div>
          <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-2 gap-3">
            <EconRow label={t.burnCostLabel} value={formatCurrency(costData.burnCost)} icon={<Flame size={10} className="text-orange-500" />} />
            <EconRow label={t.perkCostLabel} value={formatCurrency(costData.perkCost)} icon={<Trophy size={10} className="text-primary" />} />
            <EconRow label={t.totalCostLabel} value={formatCurrency(programCost)} highlight="red" />
            <EconRow label={t.grossProfitLabel} value={formatCurrency(grossProfit)} />
            <EconRow label={t.netProfitLabel} value={formatCurrency(netProfit)} highlight={netProfit > 0 ? 'green' : 'red'} />
            <EconRow label={t.roiLabel} value={formatPercent(roi)} highlight={roi > 0 ? 'green' : 'red'} />
          </div>
        </div>

        {/* Revenue distribution chart */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 text-sm mb-4 flex items-center gap-2">
            <DollarSign size={14} /> {t.revenueDist}
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenueBarData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <RechartsTooltip formatter={(value) => formatCurrency(value)} />
              <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                {revenueBarData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── TIER COMPARISON TABLE ── */}
      <div ref={summaryRef} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-5 pb-0">
          <h3 className="font-semibold text-gray-800 text-sm mb-4">{t.tierComparison}</h3>
        </div>

        <div className="grid px-5 pb-5" style={{ gridTemplateColumns: `180px repeat(${tiers.length}, 1fr)` }}>
          {/* Header */}
          <div className="text-xs font-semibold text-gray-400 py-2" />
          {tiers.map((tier, i) => (
            <div key={i} className="text-center py-2">
              <div className="inline-block w-3 h-3 rounded-full mr-1" style={{ backgroundColor: tier.color }} />
              <span className="text-xs font-bold" style={{ color: tier.color }}>
                {tier.name}
              </span>
            </div>
          ))}

          {/* Rows */}
          <CompRow label={t.clients} values={tierStats.map(s => formatNumber(s.count))} />
          <CompRow label={`% ${t.ofClients}`} values={tierStats.map(s => formatPercent(s.percentage))} />
          <CompRow label="% CA" values={tierStats.map(s => formatPercent(s.revenuePercentage))} />
          <CompRow label={t.avgLTV} values={tierStats.map(s => formatCurrency(s.avgLTV))} bold />
          <CompRow label={t.avgAOV} values={tierStats.map(s => formatCurrency(s.avgAOV))} />
          <CompRow label={t.multiplier} values={tiers.map(tier => `${tier.pointsMultiplier}x`)} />
          {config.tierBasis === 'spend'
            ? <CompRow label={t.entryThreshold} values={tierStats.map(s => `> ${formatCurrency(s.minRevenue)}`)} />
            : <CompRow label={t.entryThreshold} values={tiers.map(tier => `${formatNumber(tier.pointsThreshold)} pts`)} />
          }

          {/* Reward breakdown per tier */}
          <CompRow
            label={<span className="flex items-center gap-1"><Trophy size={10} className="text-primary" /> {t.perkRewards}</span>}
            values={tierStats.map((_, i) => {
              const count = getRewardCounts(i).perks;
              return count > 0 ? String(count) : '—';
            })}
          />
          <CompRow
            label={<span className="flex items-center gap-1"><Flame size={10} className="text-orange-500" /> {t.burnRewards}</span>}
            values={tierStats.map((_, i) => {
              const count = getRewardCounts(i).burns;
              return count > 0 ? String(count) : '—';
            })}
          />

          {/* Engagement scenarios */}
          {config.hasMissions && scenarioData.map(sd => (
            <CompRow
              key={sd.key}
              label={`${lang === 'fr' ? sd.scenario.nameFr : sd.scenario.nameEn} pts/${t.yr}`}
              values={sd.perTier.map(tp => formatNumber(tp.totalPts))}
              sub={sd.perTier.map(tp => `${formatNumber(tp.purchasePts)} + ${formatNumber(tp.missionPts)}`)}
            />
          ))}
        </div>
      </div>

      {/* ── CHARTS ROW: PIE + ENGAGEMENT ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Donut */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
            <Users size={14} /> {t.clientDist}
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} stroke="white" strokeWidth={2} />)}
              </Pie>
              <RechartsTooltip formatter={(value) => formatNumber(value)} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Engagement bar chart */}
        {config.hasMissions && (
          <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 text-sm mb-3 flex items-center gap-2">
              <Award size={14} /> {t.engagementChart}
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={engagementBarData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <RechartsTooltip formatter={(value) => `${formatNumber(value)} pts`} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {scenarioKeys.map((key, i) => <Bar key={key} dataKey={key} fill={scenarioColors[i]} radius={[4, 4, 0, 0]} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── UPGRADE TIMELINE ── */}
      {upgradeData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm">
          <h3 className="font-semibold text-gray-800 text-sm mb-3">{t.upgradeTimeline}</h3>
          <div className="grid gap-2">
            {upgradeData.map((up, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-2 min-w-[130px]">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: up.color }} />
                  <span className="text-xs font-medium">{up.from}</span>
                  <span className="text-gray-300">→</span>
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: up.nextColor }} />
                  <span className="text-xs font-medium">{up.to}</span>
                </div>
                <div className="flex gap-4 flex-1">
                  {up.scenarios.map((s, si) => (
                    <div key={si} className="text-center flex-1">
                      <div className="text-[10px] text-gray-400">{s.scenario}</div>
                      <div className="font-bold text-sm">{s.months ? `${s.months} ${t.months}` : '—'}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── EXPORT ── */}
      <div className="flex justify-center gap-3">
        <button onClick={exportCSV}
          className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-700 hover:bg-gray-50 shadow-sm">
          <Download size={14} /> {t.exportCSV}
        </button>
        <button onClick={exportPNG}
          className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-700 hover:bg-gray-50 shadow-sm">
          <Image size={14} /> {t.exportPNG}
        </button>
      </div>
    </div>
  );
}

function KPICard({ icon, label, value, color, bg, highlight }) {
  return (
    <div className={`${bg} rounded-xl p-4 ${highlight ? 'ring-2 ring-primary/20' : ''}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <span className={color}>{icon}</span>
        <span className="text-[10px] text-gray-500 font-medium">{label}</span>
      </div>
      <div className={`text-lg font-bold ${color}`}>{value}</div>
    </div>
  );
}

function EconRow({ label, value, sub, highlight, icon }) {
  const colorClass = highlight === 'red' ? 'text-red-500' : highlight === 'green' ? 'text-emerald-600' : 'text-gray-800';
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
      <span className="text-xs text-gray-500 flex items-center gap-1">{icon}{label}</span>
      <div className="text-right">
        <span className={`text-xs font-semibold ${colorClass}`}>{value}</span>
        {sub && <div className="text-[10px] text-gray-400">{sub}</div>}
      </div>
    </div>
  );
}

function CompRow({ label, values, sub, bold }) {
  return (
    <>
      <div className="text-xs text-gray-500 py-2 border-b border-gray-50 flex items-center">{label}</div>
      {values.map((v, i) => (
        <div key={i} className="text-center py-2 border-b border-gray-50">
          <div className={`text-xs ${bold ? 'font-bold text-gray-900' : 'font-medium text-gray-700'}`}>{v}</div>
          {sub && sub[i] && <div className="text-[9px] text-gray-400">{sub[i]}</div>}
        </div>
      ))}
    </>
  );
}

const FR = {
  totalClients: 'Clients', totalRevenue: 'CA total', programCost: 'Coût programme',
  incrementalRev: 'CA incrémental', roi: 'ROI',
  unitEconomics: 'Unit Economics',
  grossMargin: 'Marge brute', cashbackRate: 'Cashback', burnRateLabel: 'Taux de burn',
  adjusted: 'ajusté',
  burnCostLabel: 'Coût burn', perkCostLabel: 'Coût perks', totalCostLabel: 'Coût total',
  grossProfitLabel: 'Profit brut incr.',
  netProfitLabel: 'Profit net incr.', roiLabel: 'ROI programme',
  revenueDist: 'CA par palier', tierComparison: 'Comparaison des paliers',
  clients: 'Clients', ofClients: 'de la base', avgLTV: 'LTV moy.', avgAOV: 'AOV moy.',
  multiplier: 'Multiplicateur', entryThreshold: "Seuil d'entrée",
  perkRewards: 'Réc. perks', burnRewards: 'Réc. burn',
  yr: 'an', clientDist: 'Répartition clients',
  engagementChart: 'Points / an par scénario', upgradeTimeline: 'Temps pour monter de palier',
  months: 'mois', exportCSV: 'Exporter CSV', exportPNG: 'Exporter PNG',
};

const EN = {
  totalClients: 'Customers', totalRevenue: 'Total revenue', programCost: 'Program cost',
  incrementalRev: 'Incremental rev.', roi: 'ROI',
  unitEconomics: 'Unit Economics',
  grossMargin: 'Gross margin', cashbackRate: 'Cashback', burnRateLabel: 'Burn rate',
  adjusted: 'adjusted',
  burnCostLabel: 'Burn cost', perkCostLabel: 'Perk cost', totalCostLabel: 'Total cost',
  grossProfitLabel: 'Gross profit incr.',
  netProfitLabel: 'Net profit incr.', roiLabel: 'Program ROI',
  revenueDist: 'Revenue by tier', tierComparison: 'Tier comparison',
  clients: 'Clients', ofClients: 'of base', avgLTV: 'Avg LTV', avgAOV: 'Avg AOV',
  multiplier: 'Multiplier', entryThreshold: 'Entry threshold',
  perkRewards: 'Perk rewards', burnRewards: 'Burn rewards',
  yr: 'yr', clientDist: 'Client distribution',
  engagementChart: 'Points / year by scenario', upgradeTimeline: 'Upgrade timeline',
  months: 'months', exportCSV: 'Export CSV', exportPNG: 'Export PNG',
};
