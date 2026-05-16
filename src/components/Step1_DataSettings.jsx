import { useMemo, useState, useEffect } from 'react';
import { ChevronRight, Lightbulb } from 'lucide-react';
import Tooltip from './Tooltip';
import { formatCurrency, formatNumber } from '../utils/calculations';

// Default cashback rate suggestion based on gross margin.
// Rule: margin < 40 → 5%; < 60 → 10%; < 80 → 15%; else → 20%.
function suggestedCashback(margin) {
  if (!margin || margin < 40) return 5;
  if (margin < 60) return 10;
  if (margin < 80) return 15;
  return 20;
}

export default function Step1_DataSettings({ config, setConfig, customers, settings, setSettings, lang, brandAnalysis, clientName, onboardingAnswers, onNext }) {
  const t = lang === 'fr' ? FR : EN;
  const update = (key, val) => setConfig(prev => ({ ...prev, [key]: val }));

  // ── Derived stats from imported customers ──
  const stats = useMemo(() => {
    const totalRevenue = customers.reduce((s, c) => s + (c.total_ordered_TTC || 0), 0);
    const totalOrders = customers.reduce((s, c) => s + (c.number_of_orders || 0), 0);
    const activeCustomers = customers.filter(c => c.total_ordered_TTC > 0).length;
    const computedAov = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : null;
    const ltv = activeCustomers > 0 ? Math.round(totalRevenue / activeCustomers) : 0;
    return { totalRevenue, totalOrders, activeCustomers, computedAov, ltv };
  }, [customers]);

  // ── AOV source: computed from data if available; otherwise default/manual ──
  const aovSourceText = stats.computedAov
    ? (lang === 'fr'
        ? `Calculé depuis l'import : ${formatCurrency(stats.totalRevenue)} / ${formatNumber(stats.totalOrders)} cmd`
        : `Computed from import: ${formatCurrency(stats.totalRevenue)} / ${formatNumber(stats.totalOrders)} orders`)
    : (lang === 'fr' ? 'Valeur par défaut — pas de données suffisantes' : 'Default value — not enough data');

  // ── Gross margin source: brand preset → industry estimate; otherwise manual ──
  const industry = onboardingAnswers?.industry || brandAnalysis?.industry;
  const marginSourceText = industry
    ? (lang === 'fr'
        ? `Estimation sectorielle (${industry}) — ajustable`
        : `Industry estimate (${industry}) — adjustable`)
    : (lang === 'fr' ? 'Saisi manuellement' : 'Manually entered');

  // ── Cashback suggestion ──
  const suggested = suggestedCashback(settings.grossMargin);

  // Track whether the user has manually edited cashback. If not, we keep it in
  // sync with the margin-derived suggestion when margin changes.
  const [cashbackTouched, setCashbackTouched] = useState(false);
  useEffect(() => {
    if (!cashbackTouched) {
      setSettings(p => ({ ...p, cashbackRate: suggested }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggested]);

  // ── Derive pointsToEuro so that 1€ spent = 1 pt earned ──
  // points_earned_per_euro = cashbackRate × pointsToEuro / 100
  // We want points_earned_per_euro = 1 → pointsToEuro = 100 / cashbackRate.
  // Auto-derive unless user has manually overridden.
  const [pointsTouched, setPointsTouched] = useState(false);
  const derivedPointsValue = settings.cashbackRate > 0
    ? Math.max(1, Math.round(100 / settings.cashbackRate))
    : 100;
  useEffect(() => {
    if (!pointsTouched) {
      setSettings(p => ({ ...p, pointsPerEuro: derivedPointsValue }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derivedPointsValue]);

  // ── Keep config consistent: if no points, tierBasis can't be 'points' ──
  useEffect(() => {
    if (!config.hasMissions && config.tierBasis === 'points') {
      update('tierBasis', 'spend');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.hasMissions]);

  const pointsEarnedPerEuro = settings.pointsPerEuro > 0
    ? (settings.cashbackRate * settings.pointsPerEuro) / 100
    : 0;

  return (
    <div className="space-y-3">
      <div>
        <div className="section-subheader">{lang === 'fr' ? 'ÉTAPE 3' : 'STEP 3'}</div>
        <h2 className="text-[28px] font-bold text-[#52473C]">{t.title}</h2>
        <p className="text-[15px] text-[#645648] mt-0.5">{t.subtitle}</p>
      </div>

      {/* ─── Program structure questions ─── */}
      <div>
        <div className="section-header">{t.structureHeader}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <YesNoCard
            title={t.qPoints}
            tooltip={t.qPointsTip}
            value={config.hasMissions}
            onChange={v => update('hasMissions', v)}
            lang={lang}
          />
          <YesNoCard
            title={t.qTiers}
            tooltip={t.qTiersTip}
            value={config.hasTiers}
            onChange={v => update('hasTiers', v)}
            lang={lang}
          />
        </div>
      </div>

      {/* ─── Points expiration (only if points program) ─── */}
      {config.hasMissions && (
        <div className="card flex flex-wrap items-center gap-4" style={{ padding: 16 }}>
          <div className="flex items-center gap-1.5">
            <label className="text-[13px] font-medium text-[#645648]">{t.expirationLabel}</label>
            <Tooltip text={t.expirationTip} />
          </div>
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
          <span className="text-[11px] text-[#8A7D6B] ml-2">{t.expirationDefault}</span>
        </div>
      )}

      {/* ─── Tier basis (only if tiers enabled) ─── */}
      {config.hasTiers && (
        <div className="card flex flex-wrap items-center gap-3" style={{ padding: 16 }}>
          <div className="flex items-center gap-1.5">
            <label className="text-[13px] font-medium text-[#645648]">{t.tierBasis}</label>
            <Tooltip text={t.tierBasisTip} />
          </div>
          <div className="flex gap-1.5">
            <PillOption label={t.spend} active={config.tierBasis === 'spend'} onClick={() => update('tierBasis', 'spend')} />
            <PillOption label={t.orders} active={config.tierBasis === 'orders'} onClick={() => update('tierBasis', 'orders')} />
            {config.hasMissions && (
              <PillOption label={t.points} active={config.tierBasis === 'points'} onClick={() => update('tierBasis', 'points')} />
            )}
          </div>
        </div>
      )}

      {/* ─── Tier reassessment / expiration (only if tiers enabled) ─── */}
      {config.hasTiers && (
        <div className="card" style={{ padding: 16 }}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <label className="text-[13px] font-medium text-[#645648]">{t.tierExpireLabel}</label>
              <Tooltip text={t.tierExpireTip} />
            </div>
            <div className="flex gap-1.5">
              <PillOption label={lang === 'fr' ? 'Oui' : 'Yes'} active={config.tiersExpire === true} onClick={() => update('tiersExpire', true)} />
              <PillOption label={lang === 'fr' ? 'Non' : 'No'} active={config.tiersExpire === false} onClick={() => update('tiersExpire', false)} />
            </div>
            {config.tiersExpire && (
              <>
                <span className="text-[12px] text-[#8A7D6B] ml-2">{t.tierEvery}</span>
                <input type="number" min={1} max={60} value={config.tierExpirationMonths}
                  onChange={e => update('tierExpirationMonths', parseInt(e.target.value) || 12)}
                  className="w-20 px-2 py-1.5 text-[13px] text-center" />
                <span className="text-[13px] text-[#8A7D6B]">{t.months}</span>
                <div className="flex gap-1.5 ml-2">
                  {['rolling', 'fixed'].map(type => (
                    <button key={type} onClick={() => update('tierExpirationType', type)}
                      className={`px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all
                        ${config.tierExpirationType === type ? 'bg-primary text-white' : 'bg-[#E5E1D8] text-[#645648]'}`}>
                      {type === 'rolling' ? t.rolling : t.fixed}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-[#8A7D6B] ml-2">{t.tierExpireDefault}</span>
              </>
            )}
          </div>
          <div className="text-[11px] text-[#8A7D6B] mt-2">
            {t.tierExpireExplanation}
          </div>
        </div>
      )}

      {/* ─── Reward type (only if points program) ─── */}
      {config.hasMissions && (
        <div className="card flex flex-wrap items-center gap-3" style={{ padding: 16 }}>
          <div className="flex items-center gap-1.5">
            <label className="text-[13px] font-medium text-[#645648]">{t.rewards}</label>
            <Tooltip text={t.rewardsTip} />
          </div>
          <div className="flex gap-1.5">
            <PillOption label={t.burn} active={config.rewardType === 'burn'} onClick={() => update('rewardType', 'burn')} />
            <PillOption label={t.perks} active={config.rewardType === 'perks'} onClick={() => update('rewardType', 'perks')} />
            <PillOption label={t.both} active={config.rewardType === 'both'} onClick={() => update('rewardType', 'both')} />
          </div>
        </div>
      )}

      {/* ─── Program parameters ─── */}
      <div>
        <div className="section-header">{lang === 'fr' ? 'PARAMÈTRES DU PROGRAMME' : 'PROGRAM PARAMETERS'}</div>
        <div className="card space-y-4">
          <div className="section-subheader">{t.keyParams.toUpperCase()}</div>

          {/* Data summary row */}
          <div className="grid grid-cols-3 gap-3">
            <MiniStat value={formatNumber(customers.length)} label={lang === 'fr' ? 'Clients' : 'Customers'} />
            <MiniStat value={formatCurrency(stats.totalRevenue)} label={lang === 'fr' ? 'CA total' : 'Total revenue'} />
            <MiniStat value={`${formatNumber(stats.ltv)}€`} label="LTV" />
          </div>

          {/* AOV + Margin */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-[#D9D5CB]">
            <div>
              <label className="text-[12px] text-[#645648] mb-1 block">{t.aov}</label>
              <div className="relative">
                <input type="number" value={settings.aov || ''} min={0}
                  onChange={e => setSettings(p => ({ ...p, aov: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 pr-8 text-[15px]" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#8A7D6B]">€</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] text-[#8A7D6B]">{aovSourceText}</span>
                {stats.computedAov && stats.computedAov !== settings.aov && (
                  <button
                    onClick={() => setSettings(p => ({ ...p, aov: stats.computedAov }))}
                    className="text-[11px] text-primary hover:underline font-medium"
                  >
                    {lang === 'fr' ? `Utiliser ${stats.computedAov}€` : `Use ${stats.computedAov}€`}
                  </button>
                )}
              </div>
            </div>
            <div>
              <label className="text-[12px] text-[#645648] mb-1 block">{t.margin}</label>
              <div className="relative">
                <input type="number" value={settings.grossMargin || ''} min={0} max={100}
                  onChange={e => setSettings(p => ({ ...p, grossMargin: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 pr-8 text-[15px]" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#8A7D6B]">%</span>
              </div>
              <div className="mt-1 text-[11px] text-[#8A7D6B]">{marginSourceText}</div>
            </div>
          </div>

          {/* Cashback rate — number input + suggested hint */}
          {config.hasMissions && (
            <div className="pt-3 border-t border-[#D9D5CB]">
              <div className="flex items-center gap-1.5 mb-1.5">
                <label className="text-[12px] font-medium text-[#645648]">{t.cashbackRate}</label>
                <Tooltip text={t.cashbackTip} />
              </div>
              <div className="flex items-center gap-3">
                <div className="relative" style={{ width: 140 }}>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={settings.cashbackRate || ''}
                    onChange={e => {
                      setCashbackTouched(true);
                      setSettings(p => ({ ...p, cashbackRate: parseFloat(e.target.value) || 0 }));
                    }}
                    className="w-full px-3 py-2 pr-8 text-[15px]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#8A7D6B]">%</span>
                </div>
                <div className="flex items-center gap-2 text-[12px] text-[#8A7D6B]">
                  <Lightbulb size={13} className="text-[#D97706]" />
                  <span>
                    {lang === 'fr'
                      ? `Suggéré pour ${settings.grossMargin || 0}% de marge : ${suggested}%`
                      : `Suggested for ${settings.grossMargin || 0}% margin: ${suggested}%`}
                  </span>
                  {settings.cashbackRate !== suggested && (
                    <button
                      onClick={() => {
                        setCashbackTouched(false);
                        setSettings(p => ({ ...p, cashbackRate: suggested }));
                      }}
                      className="text-primary hover:underline font-medium"
                    >
                      {lang === 'fr' ? 'Utiliser' : 'Apply'}
                    </button>
                  )}
                </div>
              </div>
              {settings.grossMargin > 0 && (
                <div className="mt-2 text-[11px] text-[#8A7D6B]">
                  = {((settings.cashbackRate / settings.grossMargin) * 100).toFixed(1)}% {t.ofMargin}
                </div>
              )}
            </div>
          )}

          {/* Points value — derived to keep 1€ = 1pt earning convention */}
          {config.hasMissions && (
            <div className="pt-3 border-t border-[#D9D5CB]">
              <div className="flex items-center gap-1.5 mb-1.5">
                <label className="text-[12px] font-medium text-[#645648]">{t.pointsPerEuro}</label>
                <Tooltip text={t.pointsPerEuroTip} />
              </div>
              <div className="flex items-center gap-3">
                <div className="relative" style={{ width: 180 }}>
                  <input
                    type="number" min={1} max={10000}
                    value={settings.pointsPerEuro || ''}
                    onChange={e => {
                      setPointsTouched(true);
                      setSettings(p => ({ ...p, pointsPerEuro: parseInt(e.target.value) || 1 }));
                    }}
                    className="w-full px-3 py-2 pr-16 text-[15px]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-[#8A7D6B]">pts = 1€</span>
                </div>
                {settings.pointsPerEuro !== derivedPointsValue && derivedPointsValue > 0 && (
                  <button
                    onClick={() => {
                      setPointsTouched(false);
                      setSettings(p => ({ ...p, pointsPerEuro: derivedPointsValue }));
                    }}
                    className="text-[12px] text-primary hover:underline font-medium"
                  >
                    {lang === 'fr' ? `Réinitialiser (${derivedPointsValue} pts = 1€)` : `Reset (${derivedPointsValue} pts = 1€)`}
                  </button>
                )}
              </div>
              <div className="mt-2 text-[11px] text-[#8A7D6B]">
                {lang === 'fr'
                  ? `→ ${settings.cashbackRate}% × ${settings.pointsPerEuro || 1} pts/€ = ${pointsEarnedPerEuro.toFixed(2)} pt(s) gagné(s) par 1€ dépensé`
                  : `→ ${settings.cashbackRate}% × ${settings.pointsPerEuro || 1} pts/€ = ${pointsEarnedPerEuro.toFixed(2)} pt(s) earned per 1€ spent`}
              </div>
              <div className="mt-1 text-[11px]" style={{ color: '#059669' }}>
                {lang === 'fr'
                  ? '💡 Convention par défaut : 1€ dépensé = 1 pt gagné. Ajuster « pts = 1€ » change ce que les points valent à la conversion.'
                  : '💡 Default convention: 1€ spent = 1 pt earned. Adjusting "pts = 1€" changes what points are worth at redemption.'}
              </div>
            </div>
          )}
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

function YesNoCard({ title, tooltip, value, onChange, lang }) {
  return (
    <div className="card" style={{ padding: '16px 20px' }}>
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-[13px] font-semibold text-[#52473C]">{title}</span>
        {tooltip && <Tooltip text={tooltip} />}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onChange(true)}
          className={`flex-1 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
            value === true ? 'bg-primary text-white' : 'bg-[#EEEDE6] text-[#645648] hover:bg-[#E5E1D8]'
          }`}
        >
          {lang === 'fr' ? 'Oui' : 'Yes'}
        </button>
        <button
          onClick={() => onChange(false)}
          className={`flex-1 px-3 py-2 rounded-lg text-[13px] font-medium transition-all ${
            value === false ? 'bg-primary text-white' : 'bg-[#EEEDE6] text-[#645648] hover:bg-[#E5E1D8]'
          }`}
        >
          {lang === 'fr' ? 'Non' : 'No'}
        </button>
      </div>
    </div>
  );
}

function PillOption({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
        active ? 'bg-primary text-white' : 'bg-[#EEEDE6] text-[#645648] hover:bg-[#E5E1D8]'
      }`}
    >
      {label}
    </button>
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
  title: 'Configuration du programme',
  subtitle: 'Configurez la structure du programme et ses paramètres.',
  structureHeader: 'STRUCTURE DU PROGRAMME',
  qPoints: 'Programme à points ?',
  qPointsTip: 'Les clients accumulent des points via achats / missions, échangeables contre des récompenses.',
  qTiers: 'Paliers VIP ?',
  qTiersTip: 'Segmentation des clients en plusieurs niveaux (Bronze / Argent / Or…).',
  tierBasis: 'Base des paliers',
  tierBasisTip: 'Sur quelle métrique segmenter les clients.',
  spend: 'Dépenses (€)', orders: 'Commandes', points: 'Points',
  rewards: 'Type de récompenses',
  rewardsTip: 'Burn : réductions/cadeaux échangés contre des points. Perks : avantages par palier.',
  burn: 'Points brûlés', perks: 'Avantages VIP', both: 'Les deux',
  expirationLabel: "Délai d'expiration des points",
  expirationTip: 'Au bout de combien de temps les points expirent.',
  months: 'mois', rolling: 'Glissant', fixed: 'Fixe',
  expirationDefault: '(défaut : 12 mois glissants)',
  tierExpireLabel: 'Réévaluation des paliers ?',
  tierExpireTip: "Les paliers sont-ils réévalués périodiquement ? Si oui, un client peut redescendre d'un palier s'il ne maintient pas le seuil sur la période. Indépendant des points.",
  tierEvery: 'Tous les',
  tierExpireDefault: '(défaut : 12 mois glissants)',
  tierExpireExplanation: "Sur la fenêtre choisie, on regarde le cumul de la métrique (dépenses, commandes ou points). Si le client passe sous le seuil de son palier, il redescend au palier inférieur.",
  keyParams: 'Paramètres clés',
  aov: 'Panier moyen (AOV)',
  margin: 'Marge brute',
  cashbackRate: 'Taux de cashback',
  cashbackTip: '% de la valeur d\'achat retourné au client en valeur de récompense.',
  ofMargin: 'de la marge',
  pointsPerEuro: 'Valeur des points',
  pointsPerEuroTip: 'Combien de points valent 1€ à la conversion en récompense.',
};

const EN = {
  title: 'Program Configuration',
  subtitle: 'Configure the program structure and parameters.',
  structureHeader: 'PROGRAM STRUCTURE',
  qPoints: 'Points program?',
  qPointsTip: 'Customers earn points via purchases / missions, redeemable for rewards.',
  qTiers: 'VIP tiers?',
  qTiersTip: 'Segment customers across levels (Bronze / Silver / Gold…).',
  tierBasis: 'Tier basis',
  tierBasisTip: 'Which metric segments customers.',
  spend: 'Total spend (€)', orders: 'Orders', points: 'Points',
  rewards: 'Reward type',
  rewardsTip: 'Burn: redeem points for discounts/gifts. Perks: tier-based benefits.',
  burn: 'Points burned', perks: 'VIP perks', both: 'Both',
  expirationLabel: 'Points expiration delay',
  expirationTip: 'How long until points expire.',
  months: 'months', rolling: 'Rolling', fixed: 'Fixed',
  expirationDefault: '(default: 12 months rolling)',
  tierExpireLabel: 'Tier reassessment?',
  tierExpireTip: "Are tiers periodically reassessed? If yes, a customer can drop a tier if they don't meet the threshold over the window. Independent of points.",
  tierEvery: 'Every',
  tierExpireDefault: '(default: 12 months rolling)',
  tierExpireExplanation: "Over the chosen window, the metric (spend, orders or points) is summed. If a customer falls below their tier threshold, they drop to the lower tier.",
  keyParams: 'Key parameters',
  aov: 'Avg order value (AOV)',
  margin: 'Gross margin',
  cashbackRate: 'Cashback rate',
  cashbackTip: '% of purchase value returned to the customer as reward value.',
  ofMargin: 'of margin',
  pointsPerEuro: 'Points value',
  pointsPerEuroTip: 'How many points equal 1€ at redemption.',
};
