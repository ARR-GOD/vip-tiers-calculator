import { useState, useEffect } from 'react';
import { X, ChevronRight } from 'lucide-react';
import Tooltip from './Tooltip';
import BenchmarkBadge, { BenchmarkBar } from './BenchmarkBadge';
import { formatCurrency, formatNumber } from '../utils/calculations';
import { BENCHMARKS } from '../data/benchmarks';

export default function Step1_DataSettings({ config, setConfig, customers, settings, setSettings, lang, brandAnalysis, clientName, onNext }) {
  const t = lang === 'fr' ? FR : EN;
  const [cashbackBannerDismissed, setCashbackBannerDismissed] = useState(false);

  const cashbackThresholds = BENCHMARKS.cashbackRate.getThresholds(settings.grossMargin);
  const thresholdKey = settings.grossMargin < 40 ? 'low' : settings.grossMargin <= 60 ? 'mid' : 'high';

  // Reset banner when margin bracket changes
  useEffect(() => {
    setCashbackBannerDismissed(false);
  }, [thresholdKey]);

  // Force sensible defaults when switching to VIP pur (points-based tiers don't make sense without points)
  useEffect(() => {
    if (!config.hasMissions) {
      setConfig(prev => ({
        ...prev,
        tierBasis: prev.tierBasis === 'points' ? 'spend' : prev.tierBasis,
        pointsExpire: false,
      }));
    }
  }, [config.hasMissions, setConfig]);

  const update = (key, val) => setConfig(prev => ({ ...prev, [key]: val }));

  const totalRevenue = customers.reduce((s, c) => s + c.total_ordered_TTC, 0);
  const activeCustomers = customers.filter(c => c.total_ordered_TTC > 0).length;

  return (
    <div className="space-y-3">
      <div>
        <div className="section-subheader">{lang === 'fr' ? 'ÉTAPE 3' : 'STEP 3'}</div>
        <h2 className="text-[28px] font-bold text-[#52473C]">{t.title}</h2>
        <p className="text-[15px] text-[#645648] mt-0.5">{t.subtitle}</p>
      </div>

      {/* ─── Points Toggle (Change 2) ─── */}
      <div>
        <div className="section-header">{lang === 'fr' ? 'TYPE DE PROGRAMME' : 'PROGRAM TYPE'}</div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => update('hasMissions', true)}
            className={`card card-hover text-left transition-all ${config.hasMissions ? 'ring-2 ring-primary' : ''}`}
            style={{ padding: '20px 24px', backgroundColor: config.hasMissions ? '#E8EFFE' : '#ffffff' }}>
            <div className="text-[15px] font-bold text-[#52473C]">
              {lang === 'fr' ? 'Programme à points' : 'Points Program'}
            </div>
            <p className="text-[13px] text-[#645648] mt-1">
              {lang === 'fr'
                ? 'Les clients accumulent des points via achats et missions'
                : 'Customers accumulate points through purchases and missions'}
            </p>
          </button>
          <button
            onClick={() => update('hasMissions', false)}
            className={`card card-hover text-left transition-all ${!config.hasMissions ? 'ring-2 ring-primary' : ''}`}
            style={{ padding: '20px 24px', backgroundColor: !config.hasMissions ? '#E8EFFE' : '#ffffff' }}>
            <div className="text-[15px] font-bold text-[#52473C]">
              {lang === 'fr' ? 'Programme VIP pur' : 'Pure VIP Program'}
            </div>
            <p className="text-[13px] text-[#645648] mt-1">
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
              options={[
                { value: 'spend', label: t.spend },
                { value: 'orders', label: t.orders },
                { value: 'points', label: t.points },
              ]}
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
          <label className="text-[13px] text-[#645648]">{t.delay}</label>
          <input type="number" min={1} max={60} value={config.expirationMonths}
            onChange={e => update('expirationMonths', parseInt(e.target.value) || 12)}
            className="w-20 px-2 py-1.5 text-[13px] text-center" />
          <span className="text-[13px] text-[#8A7D6B]">{t.months}</span>
          <div className="flex gap-1.5 ml-2">
            {['rolling', 'fixed'].map(type => (
              <button key={type} onClick={() => update('expirationType', type)}
                className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all
                  ${config.expirationType === type ? 'bg-primary text-white' : 'bg-[#E5E1D8] text-[#645648]'}`}>
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

          <div className="grid grid-cols-2 gap-4 pt-3 border-t border-[#D9D5CB]">
            <div>
              <label className="text-[12px] text-[#645648] mb-1 block">{t.aov}</label>
              <div className="relative">
                <input type="number" value={settings.aov}
                  onChange={e => setSettings(p => ({ ...p, aov: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 pr-8 text-[15px]" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#8A7D6B]">€</span>
              </div>
            </div>
            <div>
              <label className="text-[12px] text-[#645648] mb-1 block">{t.margin}</label>
              <div className="relative">
                <input type="number" value={settings.grossMargin}
                  onChange={e => setSettings(p => ({ ...p, grossMargin: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 pr-8 text-[15px]" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#8A7D6B]">%</span>
              </div>
              <BenchmarkBadge benchmarkKey="grossMargin" value={settings.grossMargin} lang={lang} />
            </div>
          </div>

          {/* Cashback slider — only for points programs */}
          {config.hasMissions && (
            <div className="pt-3 border-t border-[#D9D5CB]">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <label className="text-[12px] font-medium text-[#645648]">{t.cashbackRate}</label>
                  <Tooltip text={t.cashbackTip} />
                </div>
                <span className="text-[18px] font-bold text-primary">{settings.cashbackRate}%</span>
              </div>
              <input type="range" min={0.5} max={20} step={0.5} value={settings.cashbackRate}
                onChange={e => setSettings(p => ({ ...p, cashbackRate: parseFloat(e.target.value) }))} />
              <BenchmarkBar benchmarkKey="cashbackRate" value={settings.cashbackRate} grossMargin={settings.grossMargin} />
              <div className="mt-2"><BenchmarkBadge benchmarkKey="cashbackRate" value={settings.cashbackRate} lang={lang} grossMargin={settings.grossMargin} /></div>
              {settings.grossMargin > 0 && (
                <div className="mt-2 text-[11px] text-[#8A7D6B]">
                  = {((settings.cashbackRate / settings.grossMargin) * 100).toFixed(1)}% {t.ofMargin}
                  {settings.cashbackRate > cashbackThresholds.high && (
                    <span className="ml-2 text-red-500 font-medium">{'>'}{cashbackThresholds.high}% {lang === 'fr' ? 'seuil haut' : 'high threshold'}</span>
                  )}
                </div>
              )}
              {!cashbackBannerDismissed && (
                <div className="mt-3 px-3 py-2.5 rounded-lg border flex items-start gap-2"
                  style={{ backgroundColor: '#FFFBEB', borderColor: '#FCD34D' }}>
                  <span className="text-[13px] leading-none mt-0.5">💡</span>
                  <div className="flex-1 text-[12px] text-[#92400E]">
                    <span className="font-medium">{t.recoLabel}</span>{' '}
                    {lang === 'fr'
                      ? `Avec ${settings.grossMargin}% de marge, le cashback recommandé est ${cashbackThresholds.median}–${cashbackThresholds.high}%.`
                      : `With ${settings.grossMargin}% margin, recommended cashback is ${cashbackThresholds.median}–${cashbackThresholds.high}%.`}
                    {settings.grossMargin < 40 && (
                      <div className="mt-1 font-bold">
                        ⚠️ {lang === 'fr' ? 'Marge faible — privilégiez les perks non-monétaires' : 'Low margin — prefer non-monetary perks'}
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

          {/* Points per euro setting */}
          <div className="pt-3 border-t border-[#D9D5CB]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <label className="text-[12px] font-medium text-[#645648]">{t.pointsPerEuro}</label>
                <Tooltip text={t.pointsPerEuroTip} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <input type="number" min={1} max={1000} value={settings.pointsPerEuro || 100}
                  onChange={e => setSettings(p => ({ ...p, pointsPerEuro: parseInt(e.target.value) || 100 }))}
                  className="w-full px-3 py-2 pr-16 text-[15px]" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#8A7D6B]">pts = 1€</span>
              </div>
            </div>
            <div className="mt-2 text-[11px] text-[#8A7D6B]">
              {lang === 'fr'
                ? `→ ${settings.cashbackRate}% de cashback × ${settings.pointsPerEuro || 100} pts/€ = ${((settings.cashbackRate * (settings.pointsPerEuro || 100)) / 100).toFixed(1)} pts gagnés par 1€ dépensé`
                : `→ ${settings.cashbackRate}% cashback × ${settings.pointsPerEuro || 100} pts/€ = ${((settings.cashbackRate * (settings.pointsPerEuro || 100)) / 100).toFixed(1)} pts earned per 1€ spent`}
            </div>
            <div className="mt-2 px-3 py-2 rounded-lg" style={{ backgroundColor: '#F3F0FF' }}>
              <div className="text-[11px] text-primary font-medium">
                💡 {lang === 'fr' ? 'Recommandation' : 'Recommendation'}:{' '}
                <span className="font-normal text-[#645648]">
                  {lang === 'fr'
                    ? `Avec un taux de ${settings.cashbackRate}%, nous recommandons ${settings.cashbackRate <= 5 ? '100' : settings.cashbackRate <= 10 ? '10' : '1'} pts = 1€. Cela donne ${settings.cashbackRate <= 5 ? settings.cashbackRate : settings.cashbackRate <= 10 ? (settings.cashbackRate / 10).toFixed(1) : (settings.cashbackRate / 100).toFixed(2)} pts par € dépensé — un ratio facile à communiquer.`
                    : `With a ${settings.cashbackRate}% rate, we recommend ${settings.cashbackRate <= 5 ? '100' : settings.cashbackRate <= 10 ? '10' : '1'} pts = 1€. This gives ${settings.cashbackRate <= 5 ? settings.cashbackRate : settings.cashbackRate <= 10 ? (settings.cashbackRate / 10).toFixed(1) : (settings.cashbackRate / 100).toFixed(2)} pts per € spent — an easy ratio to communicate.`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Inline next */}
      {onNext && (
        <div className="flex justify-end pt-6">
          <button onClick={onNext} className="btn-primary">
            {lang === 'fr' ? 'Suivant' : 'Next'} <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function ConfigCard({ title, tooltip, options, selected, onChange }) {
  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div className="flex items-center gap-1 mb-2">
        <span className="text-[12px] font-semibold text-[#645648]">{title}</span>
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
    <div className="text-center p-2.5 bg-[#EEEDE6] rounded-lg">
      <div className="text-[15px] font-bold text-[#52473C]">{value}{suffix}</div>
      <div className="text-[11px] text-[#8A7D6B] mt-0.5">{label}</div>
    </div>
  );
}

const FR = {
  title: 'Configuration du programme', subtitle: 'Choisissez le type de programme et configurez les paramètres.',
  tierBasis: 'Base des paliers', tierBasisTip: 'Montant dépensé, nombre de commandes ou points accumulés.',
  spend: 'Dépenses (€)', orders: 'Commandes', points: 'Points',
  rewards: 'Récompenses', rewardsTip: 'Burn (points), Perks (palier) ou les deux.',
  burn: 'Points brûlés', perks: 'Avantages VIP', both: 'Les deux',
  expiration: 'Expiration', expirationTip: 'Les points expirent-ils ?',
  noExpiry: 'Non', withExpiry: 'Oui',
  delay: 'Délai', months: 'mois', rolling: 'Glissant', fixed: 'Fixe',
  keyParams: 'Paramètres clés', aov: 'Panier moyen (AOV)', margin: 'Marge brute',
  cashbackRate: 'Taux de cashback (base)', cashbackTip: '% de la valeur d\'achat retourné en points.',
  ofMargin: 'de la marge',
  recoLabel: 'Recommandation :',
  pointsPerEuro: 'Valeur des points', pointsPerEuroTip: 'Combien de points valent 1€ de récompense. Ex: 100 pts = 1€.',
};

const EN = {
  title: 'Program Configuration', subtitle: 'Choose your program type and configure parameters.',
  tierBasis: 'Tier basis', tierBasisTip: 'Total spend, number of orders, or accumulated points.',
  spend: 'Total spend (€)', orders: 'Orders', points: 'Points',
  rewards: 'Rewards', rewardsTip: 'Burn (points), Perks (tier benefits) or both.',
  burn: 'Points burned', perks: 'VIP perks', both: 'Both',
  expiration: 'Expiration', expirationTip: 'Do points expire?',
  noExpiry: 'No', withExpiry: 'Yes',
  delay: 'Delay', months: 'months', rolling: 'Rolling', fixed: 'Fixed',
  keyParams: 'Key parameters', aov: 'Avg order value (AOV)', margin: 'Gross margin',
  cashbackRate: 'Cashback rate (base)', cashbackTip: '% of purchase value returned as points.',
  ofMargin: 'of margin',
  recoLabel: 'Recommendation:',
  pointsPerEuro: 'Points value', pointsPerEuroTip: 'How many points equal 1€ in reward value. E.g.: 100 pts = 1€.',
};
