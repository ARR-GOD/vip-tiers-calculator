import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import Tooltip from './Tooltip';
import BenchmarkBadge, { BenchmarkBar } from './BenchmarkBadge';
import { formatCurrency, formatNumber, getCashbackRecommendation } from '../utils/calculations';
import RecommendationBlock from './RecommendationBlock';
import { getRecommendation } from '../utils/recommendations';

export default function Step1_DataSettings({ config, setConfig, customers, settings, setSettings, lang, brandAnalysis }) {
  const t = lang === 'fr' ? FR : EN;
  const [cashbackBannerDismissed, setCashbackBannerDismissed] = useState(false);

  const cashbackReco = getCashbackRecommendation(settings.grossMargin);
  const recoBracket = cashbackReco?.bracket;

  // Reset banner when margin bracket changes
  useEffect(() => {
    setCashbackBannerDismissed(false);
  }, [recoBracket]);

  // Force sensible defaults when switching to VIP pur
  useEffect(() => {
    if (!config.hasMissions) {
      setConfig(prev => ({
        ...prev,
        tierBasis: 'spend',
        pointsExpire: false,
      }));
    }
  }, [config.hasMissions, setConfig]);

  const update = (key, val) => setConfig(prev => ({ ...prev, [key]: val }));

  const reco = getRecommendation(2, { brandAnalysis, config, settings, customers, lang: lang === 'fr' ? 'fr' : 'en' });

  const totalRevenue = customers.reduce((s, c) => s + c.total_ordered_TTC, 0);
  const activeCustomers = customers.filter(c => c.total_ordered_TTC > 0).length;

  return (
    <div className="space-y-3">
      <div>
        <div className="section-subheader">{lang === 'fr' ? 'ÉTAPE 3' : 'STEP 3'}</div>
        <h2 className="text-[28px] font-bold text-[#111827]">{t.title}</h2>
        <p className="text-[15px] text-[#6B7280] mt-0.5">{t.subtitle}</p>
      </div>

      <RecommendationBlock stepKey={2} brandName={brandAnalysis?.brand_name} body={reco?.body} lang={lang} />

      {/* ─── Points Toggle (Change 2) ─── */}
      <div>
        <div className="section-header">{lang === 'fr' ? 'TYPE DE PROGRAMME' : 'PROGRAM TYPE'}</div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => update('hasMissions', true)}
            className={`card card-hover text-left transition-all ${config.hasMissions ? 'ring-2 ring-primary' : ''}`}
            style={{ padding: '20px 24px', backgroundColor: config.hasMissions ? '#F5F3FF' : '#ffffff' }}>
            <div className="text-[15px] font-bold text-[#111827]">
              {lang === 'fr' ? 'Programme à points' : 'Points Program'}
            </div>
            <p className="text-[13px] text-[#6B7280] mt-1">
              {lang === 'fr'
                ? 'Les clients accumulent des points via achats et missions'
                : 'Customers accumulate points through purchases and missions'}
            </p>
          </button>
          <button
            onClick={() => update('hasMissions', false)}
            className={`card card-hover text-left transition-all ${!config.hasMissions ? 'ring-2 ring-primary' : ''}`}
            style={{ padding: '20px 24px', backgroundColor: !config.hasMissions ? '#F5F3FF' : '#ffffff' }}>
            <div className="text-[15px] font-bold text-[#111827]">
              {lang === 'fr' ? 'Programme VIP pur' : 'Pure VIP Program'}
            </div>
            <p className="text-[13px] text-[#6B7280] mt-1">
              {lang === 'fr'
                ? 'Paliers basés sur les dépenses, sans système de points'
                : 'Spend-based tiers, no points system'}
            </p>
          </button>
        </div>
      </div>

      {/* ─── Program Config Cards ─── */}
      <div>
        <div className="section-header">{lang === 'fr' ? 'CONFIGURATION DU PROGRAMME' : 'PROGRAM CONFIGURATION'}</div>
        <div className={`grid gap-3 ${config.hasMissions ? 'grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 lg:grid-cols-1'}`}>
          {config.hasMissions && (
            <ConfigCard title={t.tierBasis} tooltip={t.tierBasisTip}
              options={[{ value: 'spend', label: t.spend }, { value: 'points', label: t.points }]}
              selected={config.tierBasis} onChange={v => update('tierBasis', v)} />
          )}
          <ConfigCard title={t.rewards} tooltip={t.rewardsTip}
            options={[{ value: 'burn', label: t.burn }, { value: 'perks', label: t.perks }, { value: 'both', label: t.both }]}
            selected={config.rewardType} onChange={v => update('rewardType', v)} />
          {config.hasMissions && (
            <ConfigCard title={t.expiration} tooltip={t.expirationTip}
              options={[{ value: false, label: t.noExpiry }, { value: true, label: t.withExpiry }]}
              selected={config.pointsExpire} onChange={v => update('pointsExpire', v)} />
          )}
        </div>
      </div>

      {config.hasMissions && config.pointsExpire && (
        <div className="card flex flex-wrap items-center gap-4" style={{ padding: 16 }}>
          <label className="text-[13px] text-[#6B7280]">{t.delay}</label>
          <input type="number" min={1} max={60} value={config.expirationMonths}
            onChange={e => update('expirationMonths', parseInt(e.target.value) || 12)}
            className="w-20 px-2 py-1.5 text-[13px] text-center" />
          <span className="text-[13px] text-[#9CA3AF]">{t.months}</span>
          <div className="flex gap-1.5 ml-2">
            {['rolling', 'fixed'].map(type => (
              <button key={type} onClick={() => update('expirationType', type)}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all
                  ${config.expirationType === type ? 'bg-primary text-white' : 'bg-gray-100 text-[#6B7280]'}`}>
                {type === 'rolling' ? t.rolling : t.fixed}
              </button>
            ))}
          </div>
          <div className="ml-auto"><BenchmarkBadge benchmarkKey="expirationMonths" value={config.expirationMonths} lang={lang} /></div>
        </div>
      )}

      {/* ─── Parameters ─── */}
      <div>
        <div className="section-header">{lang === 'fr' ? 'PARAMÈTRES DU PROGRAMME' : 'PROGRAM PARAMETERS'}</div>
        <div className="card space-y-4">
          <div className="section-subheader">{t.keyParams.toUpperCase()}</div>

          {/* Data summary row */}
          <div className="grid grid-cols-3 gap-3">
            <MiniStat value={formatNumber(customers.length)} label={lang === 'fr' ? 'Clients' : 'Customers'} />
            <MiniStat value={formatCurrency(totalRevenue)} label={lang === 'fr' ? 'CA total' : 'Total revenue'} />
            <MiniStat value={formatNumber(Math.round(totalRevenue / (activeCustomers || 1)))} label="LTV" suffix="€" />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100">
            <div>
              <label className="text-[12px] text-[#6B7280] mb-1 block">{t.aov}</label>
              <div className="relative">
                <input type="number" value={settings.aov}
                  onChange={e => setSettings(p => ({ ...p, aov: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 pr-8 text-[15px]" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#9CA3AF]">€</span>
              </div>
            </div>
            <div>
              <label className="text-[12px] text-[#6B7280] mb-1 block">{t.margin}</label>
              <div className="relative">
                <input type="number" value={settings.grossMargin}
                  onChange={e => setSettings(p => ({ ...p, grossMargin: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 pr-8 text-[15px]" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#9CA3AF]">%</span>
              </div>
              <BenchmarkBadge benchmarkKey="grossMargin" value={settings.grossMargin} lang={lang} />
            </div>
          </div>

          {/* Cashback slider — only for points programs */}
          {config.hasMissions && (
            <div className="pt-3 border-t border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <label className="text-[12px] font-medium text-[#374151]">{t.cashbackRate}</label>
                  <Tooltip text={t.cashbackTip} />
                </div>
                <span className="text-[18px] font-bold text-primary">{settings.cashbackRate}%</span>
              </div>
              <input type="range" min={0.5} max={20} step={0.5} value={settings.cashbackRate}
                onChange={e => setSettings(p => ({ ...p, cashbackRate: parseFloat(e.target.value) }))} />
              <BenchmarkBar benchmarkKey="cashbackRate" value={settings.cashbackRate} />
              <div className="mt-2"><BenchmarkBadge benchmarkKey="cashbackRate" value={settings.cashbackRate} lang={lang} /></div>
              {settings.grossMargin > 0 && (
                <div className="mt-2 text-[11px] text-[#9CA3AF]">
                  = {((settings.cashbackRate / settings.grossMargin) * 100).toFixed(1)}% {t.ofMargin}
                  {settings.cashbackRate > settings.grossMargin * 0.08 && (
                    <span className="ml-2 text-red-500 font-medium">{'>'}8% {t.ofMargin}</span>
                  )}
                </div>
              )}
              {cashbackReco && !cashbackBannerDismissed && (
                <div className="mt-3 px-3 py-2.5 rounded-lg border flex items-start gap-2"
                  style={{ backgroundColor: '#FFFBEB', borderColor: '#FCD34D' }}>
                  <span className="text-[13px] leading-none mt-0.5">💡</span>
                  <div className="flex-1 text-[12px] text-[#92400E]">
                    <span className="font-medium">{t.recoLabel}</span>{' '}
                    {lang === 'fr'
                      ? `Avec ${settings.grossMargin}% de marge, le cashback recommandé est ${cashbackReco.minRate}–${cashbackReco.maxRate}%.`
                      : `With ${settings.grossMargin}% margin, recommended cashback is ${cashbackReco.minRate}–${cashbackReco.maxRate}%.`}
                    {cashbackReco.bracket === 'low' && (
                      <div className="mt-1 font-bold">
                        ⚠️ {lang === 'fr' ? cashbackReco.warningFr : cashbackReco.warningEn}
                      </div>
                    )}
                  </div>
                  <button onClick={() => setCashbackBannerDismissed(true)}
                    className="text-[#D97706] hover:text-[#92400E] transition-colors mt-0.5">
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfigCard({ title, tooltip, options, selected, onChange }) {
  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div className="flex items-center gap-1 mb-2">
        <span className="text-[12px] font-semibold text-[#374151]">{title}</span>
        {tooltip && <Tooltip text={tooltip} />}
      </div>
      <div className="flex flex-col gap-1">
        {options.map(opt => (
          <button key={String(opt.value)} onClick={() => onChange(opt.value)}
            className={`selection-card text-[12px] font-medium text-left
              ${selected === opt.value ? 'selected' : ''}`}>
            <span>{opt.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MiniStat({ value, label, suffix }) {
  return (
    <div className="text-center p-2.5 bg-gray-50 rounded-lg">
      <div className="text-[15px] font-bold text-[#111827]">{value}{suffix}</div>
      <div className="text-[11px] text-[#9CA3AF] mt-0.5">{label}</div>
    </div>
  );
}

const FR = {
  title: 'Configuration du programme', subtitle: 'Choisissez le type de programme et configurez les paramètres.',
  tierBasis: 'Base des paliers', tierBasisTip: 'Montant dépensé ou points accumulés.',
  spend: 'Dépenses (€)', points: 'Points',
  rewards: 'Récompenses', rewardsTip: 'Burn (points), Perks (palier) ou les deux.',
  burn: 'Points brûlés', perks: 'Avantages VIP', both: 'Les deux',
  expiration: 'Expiration', expirationTip: 'Les points expirent-ils ?',
  noExpiry: 'Non', withExpiry: 'Oui',
  delay: 'Délai', months: 'mois', rolling: 'Glissant', fixed: 'Fixe',
  keyParams: 'Paramètres clés', aov: 'Panier moyen (AOV)', margin: 'Marge brute',
  cashbackRate: 'Taux de cashback (base)', cashbackTip: '% de la valeur d\'achat retourné en points.',
  ofMargin: 'de la marge',
  recoLabel: 'Recommandation :',
};

const EN = {
  title: 'Program Configuration', subtitle: 'Choose your program type and configure parameters.',
  tierBasis: 'Tier basis', tierBasisTip: 'Total spend or accumulated points.',
  spend: 'Total spend (€)', points: 'Points',
  rewards: 'Rewards', rewardsTip: 'Burn (points), Perks (tier benefits) or both.',
  burn: 'Points burned', perks: 'VIP perks', both: 'Both',
  expiration: 'Expiration', expirationTip: 'Do points expire?',
  noExpiry: 'No', withExpiry: 'Yes',
  delay: 'Delay', months: 'months', rolling: 'Rolling', fixed: 'Fixed',
  keyParams: 'Key parameters', aov: 'Avg order value (AOV)', margin: 'Gross margin',
  cashbackRate: 'Cashback rate (base)', cashbackTip: '% of purchase value returned as points.',
  ofMargin: 'of margin',
  recoLabel: 'Recommendation:',
};
