import { useMemo, useRef, useState } from 'react';
import { Download, Image, ChevronDown, Check, X, FileText, Link2 } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';
import { saveAs } from 'file-saver';
import { toPng } from 'html-to-image';
import { computeCustomerScores, assignTiers, computeTierStats, computeRewardsCost, computeProgramFunnel, compute12MonthProjection, computeTierFinancials, derivePointsFromCashback, formatCurrency, formatNumber, formatPercent, formatCompact } from '../utils/calculations';
import { ENGAGEMENT_SCENARIOS } from '../data/defaults';
import RecommendationBlock from './RecommendationBlock';
import { getRecommendation } from '../utils/recommendations';

const SCENARIO_MULTIPLIERS = { conservative: 0.6, base: 1, optimistic: 1.4 };

const COMPETITORS = [
  {
    id: 'sephora',
    brand: 'Sephora',
    program: 'Beauty Insider',
    initials: 'SE',
    color: '#000000',
    modelFr: 'Points',
    modelEn: 'Points',
    descFr: '3 paliers, cashback ~3-5%',
    descEn: '3 tiers, cashback ~3-5%',
    strengthsFr: ['Catalogue de récompenses très profond', 'Programme reconnu et aspirationnel'],
    strengthsEn: ['Very deep rewards catalog', 'Recognized and aspirational program'],
    weaknessFr: 'Complexité du barème de points',
    weaknessEn: 'Complex points schedule',
    cashback: '3-5%',
  },
  {
    id: 'yvesrocher',
    brand: 'Yves Rocher',
    program: 'Club',
    initials: 'YR',
    color: '#2D8C3C',
    modelFr: 'Cashback',
    modelEn: 'Cashback',
    descFr: 'Paliers sur CA, cashback 8-12%',
    descEn: 'Spend-based tiers, cashback 8-12%',
    strengthsFr: ['Mécanique simple et transparente', 'Forte rétention sur les paliers hauts'],
    strengthsEn: ['Simple and transparent mechanics', 'Strong retention on high tiers'],
    weaknessFr: 'Peu de gamification / engagement',
    weaknessEn: 'Low gamification / engagement',
    cashback: '8-12%',
  },
  {
    id: 'venum',
    brand: 'Venum',
    program: 'Fight Club',
    initials: 'VN',
    color: '#D4AF37',
    modelFr: 'Points + Missions',
    modelEn: 'Points + Missions',
    descFr: '2 paliers, cashback 5-8%',
    descEn: '2 tiers, cashback 5-8%',
    strengthsFr: ['Missions communautaires engageantes', 'Fort sentiment d\'appartenance'],
    strengthsEn: ['Engaging community missions', 'Strong sense of belonging'],
    weaknessFr: 'Nombre limité de paliers',
    weaknessEn: 'Limited number of tiers',
    cashback: '5-8%',
  },
  {
    id: 'lululemon',
    brand: 'Lululemon',
    program: 'Membership',
    initials: 'LL',
    color: '#C41230',
    modelFr: 'Perks VIP',
    modelEn: 'VIP Perks',
    descFr: 'Pas de points, perks exclusifs',
    descEn: 'No points, exclusive perks',
    strengthsFr: ['Expérience premium sans friction', 'Perks exclusifs à forte valeur perçue'],
    strengthsEn: ['Frictionless premium experience', 'High perceived value exclusive perks'],
    weaknessFr: 'Pas de mécanique de rétention progressive',
    weaknessEn: 'No progressive retention mechanic',
    cashback: '0%',
  },
];

const DIFFERENTIATION_TIPS = {
  luxury: {
    fr: 'Inspirez-vous de Lululemon : misez sur des perks exclusifs à forte valeur perçue (accès anticipé, événements privés, personnalisation) plutôt que sur du cashback. Votre programme doit renforcer le sentiment de privilège.',
    en: 'Take inspiration from Lululemon: focus on exclusive perks with high perceived value (early access, private events, personalization) rather than cashback. Your program should reinforce a sense of privilege.',
  },
  mid: {
    fr: 'Combinez le meilleur d\'Yves Rocher (paliers transparents) et de Venum (missions engageantes). Un mix points + missions avec des perks aspirationnels sur les paliers hauts vous différenciera.',
    en: 'Combine the best of Yves Rocher (transparent tiers) and Venum (engaging missions). A mix of points + missions with aspirational perks on high tiers will differentiate you.',
  },
  mass: {
    fr: 'Adoptez la profondeur du catalogue Sephora : proposez un large choix de récompenses accessibles dès le premier palier, avec des missions variées pour maximiser l\'engagement quotidien.',
    en: 'Adopt Sephora\'s catalog depth: offer a wide choice of accessible rewards from the first tier, with varied missions to maximize daily engagement.',
  },
};

export default function Step5_Dashboard({ tiers, customers, settings, config, missions, customMissions, rewards, burnRate, lang, programType, brandAnalysis }) {
  const t = lang === 'fr';
  const dashRef = useRef(null);
  const [scenario, setScenario] = useState('base');
  const [benchmarkOpen, setBenchmarkOpen] = useState(false);
  const scenarioMult = SCENARIO_MULTIPLIERS[scenario];

  const { tierStats, assignedCustomers } = useMemo(() => {
    const scored = computeCustomerScores(customers, settings.segmentationType, settings.caWeight);
    const { pointsPerEuro } = derivePointsFromCashback(settings.cashbackRate, settings.pointsPerEuro);
    const assigned = assignTiers(scored, tiers, config.tierBasis, { pointsPerEuro });
    return { tierStats: computeTierStats(assigned, tiers), assignedCustomers: assigned };
  }, [customers, settings, tiers, config]);

  const funnel = useMemo(() => {
    return computeProgramFunnel(tierStats, missions, customMissions, rewards, settings, tiers, scenarioMult);
  }, [tierStats, missions, customMissions, rewards, settings, tiers, scenarioMult]);

  const monthlyProjection = useMemo(() => {
    return compute12MonthProjection(tierStats, rewards, settings, tiers, missions, customMissions, scenarioMult);
  }, [tierStats, rewards, settings, tiers, missions, customMissions, scenarioMult]);

  const tierFinancials = useMemo(() => {
    return tiers.map((_, i) => computeTierFinancials(i, tierStats[i], rewards, settings.grossMargin, burnRate));
  }, [tiers, tierStats, rewards, settings.grossMargin, burnRate]);

  const pieData = tierStats.map(stat => ({ name: stat.name, value: stat.count, color: stat.color }));

  const barData = tierStats.map((stat, i) => ({
    name: stat.name,
    revenue: Math.round(stat.revenue),
    cost: Math.round(tierFinancials[i]?.rewardsCost || 0),
    profit: Math.round(tierFinancials[i]?.netProfit || 0),
  }));

  const exportCSV = () => {
    const headers = [t ? 'Palier' : 'Tier', t ? 'Clients' : 'Customers', '%', t ? 'CA' : 'Revenue', 'LTV', t ? 'Coût' : 'Cost', t ? 'Profit' : 'Profit'];
    const rows = tierStats.map((stat, i) => [
      stat.name, stat.count, stat.percentage.toFixed(1),
      Math.round(stat.revenue), Math.round(stat.avgLTV),
      Math.round(tierFinancials[i]?.rewardsCost || 0),
      Math.round(tierFinancials[i]?.netProfit || 0),
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    saveAs(blob, 'vip-tiers-dashboard.csv');
  };

  const exportPNG = async () => {
    if (!dashRef.current) return;
    try {
      const dataUrl = await toPng(dashRef.current, { backgroundColor: '#F0F0F0', pixelRatio: 2 });
      saveAs(dataUrl, 'vip-tiers-dashboard.png');
    } catch (err) { console.error(err); }
  };

  const effectiveType = programType || (config.hasMissions ? 'mid' : 'luxury');
  const tip = DIFFERENTIATION_TIPS[effectiveType] || DIFFERENTIATION_TIPS.mid;

  const reco = getRecommendation(6, { brandAnalysis, config, settings, customers, lang });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="section-subheader">{t ? 'ÉTAPE 7' : 'STEP 7'}</div>
          <h2 className="text-[28px] font-bold text-[#111827]">{t ? 'Dashboard du programme' : 'Program Dashboard'}</h2>
          <p className="text-[15px] text-[#6B7280] mt-0.5">{t ? 'Vue d\'ensemble et projections financières.' : 'Overview and financial projections.'}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="btn-secondary"><Download size={13} /> CSV</button>
          <button onClick={exportPNG} className="btn-secondary"><Image size={13} /> PNG</button>
        </div>
      </div>

      <RecommendationBlock stepKey={6} brandName={brandAnalysis?.brand_name} body={reco?.body} lang={lang} />

      {/* Scenario */}
      <div className="card flex items-center gap-3" style={{ padding: 16 }}>
        <span className="text-[13px] font-medium text-[#374151]">{t ? 'Scénario' : 'Scenario'}:</span>
        {Object.entries(SCENARIO_MULTIPLIERS).map(([key, mult]) => (
          <button key={key} onClick={() => setScenario(key)}
            className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all
              ${scenario === key ? 'bg-primary text-white' : 'bg-gray-100 text-[#6B7280] hover:bg-gray-200'}`}>
            {key === 'conservative' ? (t ? 'Conservateur' : 'Conservative')
              : key === 'base' ? 'Base'
              : (t ? 'Optimiste' : 'Optimistic')}
          </button>
        ))}
        <span className="ml-auto text-[12px] text-[#9CA3AF]">{'\u00d7'}{scenarioMult}</span>
      </div>

      <div ref={dashRef}>
        {/* KPI cards */}
        <div className="section-header">{t ? 'INDICATEURS CLÉS' : 'KEY METRICS'}</div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <KPICard label={t ? 'CLIENTS' : 'CUSTOMERS'} value={formatNumber(funnel.totalCustomers)} sub={t ? 'total' : 'total'} />
          <KPICard label={t ? 'CA TOTAL' : 'TOTAL REVENUE'} value={formatCurrency(funnel.totalRevenue)} sub={t ? 'par an' : 'per year'} />
          <KPICard label={t ? 'COÛT PROGRAMME' : 'PROGRAM COST'} value={formatCurrency(funnel.rewardsCost)} sub={t ? 'récompenses' : 'rewards'} color="red" />
          <KPICard label={t ? 'PROFIT NET' : 'NET PROFIT'}
            value={`${funnel.netProfit >= 0 ? '+' : ''}${formatCurrency(funnel.netProfit)}`}
            sub={t ? 'par an' : 'per year'}
            color={funnel.netProfit >= 0 ? 'green' : 'red'} />
        </div>

        {/* Funnel */}
        <div className="card mb-3" >
          <div className="section-header" style={{ marginBottom: 12 }}>{t ? 'ENTONNOIR DU PROGRAMME' : 'PROGRAM FUNNEL'}</div>
          <div className="grid grid-cols-6 gap-2">
            {[
              { label: t ? 'Pts achats' : 'Purchase pts', value: formatCompact(funnel.totalPurchasePoints) },
              { label: t ? 'Pts missions' : 'Mission pts', value: formatCompact(funnel.totalMissionPoints) },
              { label: t ? 'Total pts' : 'Total pts', value: formatCompact(funnel.totalPointsEarned) },
              { label: t ? 'Coût burn' : 'Burn cost', value: formatCurrency(funnel.burnCost) },
              { label: t ? 'Coût perk' : 'Perk cost', value: formatCurrency(funnel.perkCost) },
              { label: t ? 'Rev. incr.' : 'Incr. rev.', value: formatCurrency(funnel.incrementalRevenue) },
            ].map((item, i) => (
              <div key={i} className="text-center p-3 bg-gray-50 rounded-lg relative">
                <div className="text-[13px] font-bold text-[#111827]">{item.value}</div>
                <div className="text-[10px] text-[#9CA3AF] mt-0.5">{item.label}</div>
                {i < 5 && <span className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 text-[#D1D5DB] text-[12px] z-10">{'\u2192'}</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Charts row */}
        <div className="section-header">{t ? 'VISUALISATIONS' : 'VISUALIZATIONS'}</div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-3">
          {/* Donut */}
          <div className="card" >
            <div className="section-header" style={{ marginBottom: 12 }}>{t ? 'RÉPARTITION CLIENTS' : 'CUSTOMER DISTRIBUTION'}</div>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={2}>
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <RTooltip formatter={(v, name) => [`${v} (${formatPercent(v / funnel.totalCustomers * 100)})`, name]} />
                <Legend verticalAlign="bottom" height={36} formatter={(value) => <span style={{ fontSize: 12, color: '#6B7280' }}>{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Bar chart */}
          <div className="card" >
            <div className="section-header" style={{ marginBottom: 12 }}>{t ? 'CA VS COÛT VS PROFIT' : 'REVENUE VS COST VS PROFIT'}</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6B7280' }} />
                <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={v => formatCompact(v)} />
                <RTooltip formatter={(v) => formatCurrency(v)} />
                <Legend verticalAlign="bottom" height={36} formatter={(value) => <span style={{ fontSize: 12, color: '#6B7280' }}>{value}</span>} />
                <Bar dataKey="revenue" name={t ? 'CA' : 'Revenue'} fill="#6B4EFF" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cost" name={t ? 'Coût' : 'Cost'} fill="#EF4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" name={t ? 'Profit' : 'Profit'} fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 12-month projection */}
        <div className="card mb-3" >
          <div className="section-header" style={{ marginBottom: 12 }}>{t ? 'PROJECTION 12 MOIS' : '12-MONTH PROJECTION'}</div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={monthlyProjection}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={v => `M${v}`} />
              <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={v => formatCompact(v)} />
              <RTooltip formatter={(v) => formatCurrency(v)} labelFormatter={v => `${t ? 'Mois' : 'Month'} ${v}`} />
              <Legend verticalAlign="bottom" height={36} formatter={(value) => <span style={{ fontSize: 12, color: '#6B7280' }}>{value}</span>} />
              <Line type="monotone" dataKey="revenue" name={t ? 'Rev. cumulé' : 'Cumul. revenue'} stroke="#6B4EFF" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="cost" name={t ? 'Coût cumulé' : 'Cumul. cost'} stroke="#EF4444" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="profit" name={t ? 'Profit cumulé' : 'Cumul. profit'} stroke="#10B981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Per-tier comparison table */}
        <div className="section-header">{t ? 'COMPARAISON DÉTAILLÉE' : 'DETAILED COMPARISON'}</div>
        <div className="card overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-2.5 font-medium text-[#6B7280]">{t ? 'Palier' : 'Tier'}</th>
                <th className="text-center px-3 py-2.5 font-medium text-[#6B7280]">{t ? 'Clients' : 'Customers'}</th>
                <th className="text-center px-3 py-2.5 font-medium text-[#6B7280]">%</th>
                <th className="text-center px-3 py-2.5 font-medium text-[#6B7280]">{t ? 'CA' : 'Revenue'}</th>
                <th className="text-center px-3 py-2.5 font-medium text-[#6B7280]">LTV</th>
                <th className="text-center px-3 py-2.5 font-medium text-[#6B7280]">AOV</th>
                <th className="text-center px-3 py-2.5 font-medium text-primary">{'\u00d7'}</th>
                <th className="text-center px-3 py-2.5 font-medium text-[#6B7280]">{t ? 'Coût' : 'Cost'}</th>
                <th className="text-center px-3 py-2.5 font-medium text-[#6B7280]">{t ? 'Rev. incr.' : 'Incr. rev.'}</th>
                <th className="text-center px-3 py-2.5 font-medium text-[#6B7280]">{t ? 'Profit' : 'Profit'}</th>
              </tr>
            </thead>
            <tbody>
              {tierStats.map((stat, i) => {
                const fin = tierFinancials[i];
                return (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50" style={{ transition: 'all 0.15s ease' }}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: stat.color }}></div>
                        <span className="font-medium text-[#374151]">{stat.name}</span>
                      </div>
                    </td>
                    <td className="text-center px-3 py-2.5 text-[#374151]">{stat.count}</td>
                    <td className="text-center px-3 py-2.5 text-[#6B7280]">{formatPercent(stat.percentage)}</td>
                    <td className="text-center px-3 py-2.5 text-[#374151]">{formatCurrency(stat.revenue)}</td>
                    <td className="text-center px-3 py-2.5 font-medium text-[#111827]">{formatCurrency(stat.avgLTV)}</td>
                    <td className="text-center px-3 py-2.5 text-[#374151]">{formatCurrency(stat.avgAOV)}</td>
                    <td className="text-center px-3 py-2.5 text-primary font-medium">{tiers[i]?.pointsMultiplier}{'\u00d7'}</td>
                    <td className="text-center px-3 py-2.5 text-[#DC2626]">{formatCurrency(fin?.rewardsCost || 0)}</td>
                    <td className="text-center px-3 py-2.5 text-[#374151]">{formatCurrency(fin?.incrementalRevenue || 0)}</td>
                    <td className={`text-center px-3 py-2.5 font-bold ${(fin?.netProfit || 0) >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
                      {(fin?.netProfit || 0) >= 0 ? '+' : ''}{formatCurrency(fin?.netProfit || 0)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200 font-semibold">
                <td className="px-4 py-2.5 text-[#374151]">Total</td>
                <td className="text-center px-3 py-2.5 text-[#111827]">{tierStats.reduce((s, st) => s + st.count, 0)}</td>
                <td className="text-center px-3 py-2.5 text-[#111827]">100%</td>
                <td className="text-center px-3 py-2.5 text-[#111827]">{formatCurrency(tierStats.reduce((s, st) => s + st.revenue, 0))}</td>
                <td colSpan={3}></td>
                <td className="text-center px-3 py-2.5 text-[#DC2626]">{formatCurrency(tierFinancials.reduce((s, f) => s + f.rewardsCost, 0))}</td>
                <td className="text-center px-3 py-2.5 text-[#111827]">{formatCurrency(tierFinancials.reduce((s, f) => s + f.incrementalRevenue, 0))}</td>
                <td className={`text-center px-3 py-2.5 font-bold ${tierFinancials.reduce((s, f) => s + f.netProfit, 0) >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
                  {tierFinancials.reduce((s, f) => s + f.netProfit, 0) >= 0 ? '+' : ''}{formatCurrency(tierFinancials.reduce((s, f) => s + f.netProfit, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ─── Benchmark concurrents ─── */}
      <div className="mt-6">
        <button
          onClick={() => setBenchmarkOpen(o => !o)}
          className="w-full flex items-center justify-between px-0 py-2 group"
        >
          <div className="section-header" style={{ marginBottom: 0 }}>
            {t ? 'BENCHMARK CONCURRENTS' : 'COMPETITOR BENCHMARK'}
          </div>
          <ChevronDown
            size={18}
            className="text-[#9CA3AF] transition-transform"
            style={{ transform: benchmarkOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
          />
        </button>

        {benchmarkOpen && (
          <div className="space-y-3 mt-2" style={{ animation: 'fadeSlideIn 0.15s ease' }}>
            {/* Competitor cards — 2-col grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {COMPETITORS.map((comp) => (
                <div key={comp.id} className="card">
                  {/* Header row: logo + name + model pill */}
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[13px] font-bold shrink-0"
                      style={{ backgroundColor: comp.color }}
                    >
                      {comp.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[15px] font-semibold text-[#111827] leading-tight">{comp.program}</div>
                      <div className="text-[12px] text-[#9CA3AF]">{comp.brand}</div>
                    </div>
                    <span className="pill pill-purple text-[11px] shrink-0">
                      {t ? comp.modelFr : comp.modelEn}
                    </span>
                  </div>

                  <div className="text-[13px] text-[#6B7280] mb-3">
                    {t ? comp.descFr : comp.descEn}
                  </div>

                  {/* Strengths */}
                  <div className="space-y-1.5 mb-2">
                    {(t ? comp.strengthsFr : comp.strengthsEn).map((s, j) => (
                      <div key={j} className="flex items-start gap-2">
                        <Check size={14} className="text-[#10B981] shrink-0 mt-0.5" />
                        <span className="text-[13px] text-[#374151]">{s}</span>
                      </div>
                    ))}
                  </div>

                  {/* Weakness */}
                  <div className="flex items-start gap-2 mb-3">
                    <X size={14} className="text-[#EF4444] shrink-0 mt-0.5" />
                    <span className="text-[13px] text-[#374151]">{t ? comp.weaknessFr : comp.weaknessEn}</span>
                  </div>

                  {/* Cashback badge */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="text-[11px] text-[#9CA3AF] uppercase tracking-wider">
                      {t ? 'Cashback équivalent' : 'Cashback equivalent'}
                    </span>
                    <span className="pill pill-gray text-[12px]">{comp.cashback}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Differentiation recommendation */}
            <div className="card" style={{ borderLeft: '3px solid #6B4EFF' }}>
              <div className="section-subheader">
                {t ? 'COMMENT VOUS DÉMARQUER' : 'HOW TO DIFFERENTIATE'}
              </div>
              <p className="text-[14px] text-[#374151] leading-relaxed mt-1">
                {t ? tip.fr : tip.en}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ─── Competitive Advantage CTA ─── */}
      <div
        className="mt-6"
        style={{
          backgroundColor: '#6B4EFF',
          borderRadius: 10,
          padding: '24px 28px',
        }}
      >
        <h3 className="text-[22px] font-bold text-white mb-3">
          {t ? 'Ce qui vous différencie' : 'What sets you apart'}
        </h3>
        <div className="space-y-3 mb-6">
          {config.hasMissions && (
            <div className="flex items-start gap-3">
              <span className="text-white/90 text-[16px] mt-0.5">&#10003;</span>
              <span className="text-[14px] text-white/90 leading-relaxed">
                {t
                  ? 'Engagement au-delà de l\'achat — vos clients gagnent des points en interagissant avec votre marque'
                  : 'Engagement beyond purchase — your customers earn points by interacting with your brand'}
              </span>
            </div>
          )}
          {effectiveType === 'luxury' && (
            <div className="flex items-start gap-3">
              <span className="text-white/90 text-[16px] mt-0.5">&#10003;</span>
              <span className="text-[14px] text-white/90 leading-relaxed">
                {t
                  ? 'Programme premium sans dévaluation — aucun discount, que de la valeur perçue'
                  : 'Premium program without devaluation — no discounts, only perceived value'}
              </span>
            </div>
          )}
          {config.rewardType !== 'perk' && (
            <div className="flex items-start gap-3">
              <span className="text-white/90 text-[16px] mt-0.5">&#10003;</span>
              <span className="text-[14px] text-white/90 leading-relaxed">
                {t
                  ? 'Économie circulaire — les points réinjectent du CA dans votre boutique'
                  : 'Circular economy — points reinject revenue into your store'}
              </span>
            </div>
          )}
          <div className="flex items-start gap-3">
            <span className="text-white/90 text-[16px] mt-0.5">&#10003;</span>
            <span className="text-[14px] text-white/90 leading-relaxed">
              {t
                ? 'Simulé sur vos vraies données clients — pas un benchmark générique'
                : 'Simulated on your real customer data — not a generic benchmark'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={exportPNG}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[14px] font-semibold transition-all"
            style={{ backgroundColor: 'white', color: '#6B4EFF' }}
          >
            <FileText size={15} />
            {t ? 'Exporter le rapport' : 'Export report'}
          </button>
          <button
            onClick={() => {
              const state = { config, settings, tiers };
              const encoded = btoa(JSON.stringify(state));
              const url = `${window.location.origin}${window.location.pathname}?state=${encoded}`;
              navigator.clipboard.writeText(url);
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-[14px] font-semibold transition-all"
            style={{ backgroundColor: 'transparent', color: 'white', border: '1.5px solid rgba(255,255,255,0.4)' }}
          >
            <Link2 size={15} />
            {t ? 'Partager la configuration' : 'Share configuration'}
          </button>
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, sub, color }) {
  const textColor = color === 'red' ? 'text-[#DC2626]' : color === 'green' ? 'text-[#059669]' : 'text-[#111827]';
  return (
    <div className="card" >
      <div className="flex items-start justify-between">
        <div className="section-subheader">{label}</div>
      </div>
      <div className={`text-[28px] font-bold text-right ${textColor}`}>{value}</div>
      <div className="text-[12px] text-[#6B7280] text-right">{sub}</div>
    </div>
  );
}
