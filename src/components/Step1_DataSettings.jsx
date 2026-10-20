import { useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Tooltip from './Tooltip';
import { formatCurrency, formatNumber } from '../utils/calculations';
import { EARN_RATE_OPTIONS, defaultEarnRate, pointsModel } from '../utils/pointsModel';

export default function Step1_DataSettings({ config, setConfig, customers, settings, setSettings, lang, brandAnalysis, onboardingAnswers, onPrev, onNext }) {
  const t = lang === 'fr' ? FR : EN;
  const update = (key, val) => setConfig(prev => ({ ...prev, [key]: val }));
  // Without points, tiers can't be based on points.
  const setHasMissions = (val) => setConfig(prev => ({
    ...prev,
    hasMissions: val,
    tierBasis: !val && prev.tierBasis === 'points' ? 'spend' : prev.tierBasis,
  }));

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

  // ── Points: earn rate (follows the AOV rule until chosen) ──
  // A rate the CSM picked is never overwritten when coming back to this step.
  const { earnRate } = pointsModel(settings);
  const autoEarnRate = defaultEarnRate(settings.aov);

  return (
    <div className="space-y-3">
      <div>
        <div className="section-subheader">{lang === 'fr' ? 'ÉTAPE 3' : 'STEP 3'}</div>
        <h2 className="text-[28px] font-bold text-[#52473C]">{t.title}</h2>
        <p className="text-[15px] text-[#645648] mt-0.5">{t.subtitle}</p>
      </div>

      {/* ─── Program structure: each answer holds its own settings ─── */}
      {/* The reward types follow from the structure: a points program spends
          points on rewards, VIP tiers give perks. */}
      <div>
        <div className="section-header">{t.structureHeader}</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-start">
          <YesNoCard
            title={t.qPoints}
            tooltip={t.qPointsTip}
            value={config.hasMissions}
            onChange={setHasMissions}
            lang={lang}
          >
            <Setting label={t.expirationLabel} tooltip={t.expirationTip}>
              <div className="flex flex-wrap items-center gap-2">
                <input type="number" min={1} max={60} value={config.expirationMonths}
                  onChange={e => update('expirationMonths', parseInt(e.target.value) || 12)}
                  className="w-20 px-2 py-1.5 text-[13px] text-center" aria-label={t.expirationLabel} />
                <span className="text-[13px] text-[#8A7D6B]">{t.months}</span>
                <div className="flex gap-1.5">
                  {['rolling', 'fixed'].map(type => (
                    <PillOption key={type} label={type === 'rolling' ? t.rolling : t.fixed}
                      active={config.expirationType === type} onClick={() => update('expirationType', type)} />
                  ))}
                </div>
              </div>
              <div className="text-[11px] text-[#8A7D6B] mt-1">{t.expirationDefault}</div>
            </Setting>
          </YesNoCard>

          <YesNoCard
            title={t.qTiers}
            tooltip={t.qTiersTip}
            value={config.hasTiers}
            onChange={v => update('hasTiers', v)}
            lang={lang}
          >
            <Setting label={t.tierBasis} tooltip={t.tierBasisTip}>
              <div className="flex flex-wrap gap-1.5">
                <PillOption label={t.spend} active={config.tierBasis === 'spend'} onClick={() => update('tierBasis', 'spend')} />
                <PillOption label={t.orders} active={config.tierBasis === 'orders'} onClick={() => update('tierBasis', 'orders')} />
                {config.hasMissions && (
                  <PillOption label={t.points} active={config.tierBasis === 'points'} onClick={() => update('tierBasis', 'points')} />
                )}
              </div>
            </Setting>
            <Setting label={t.tierExpireLabel} tooltip={t.tierExpireTip}>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-1.5">
                  <PillOption label={lang === 'fr' ? 'Oui' : 'Yes'} active={config.tiersExpire === true} onClick={() => update('tiersExpire', true)} />
                  <PillOption label={lang === 'fr' ? 'Non' : 'No'} active={config.tiersExpire === false} onClick={() => update('tiersExpire', false)} />
                </div>
                {config.tiersExpire && (
                  <>
                    <span className="text-[12px] text-[#8A7D6B]">{t.tierEvery}</span>
                    <input type="number" min={1} max={60} value={config.tierExpirationMonths}
                      onChange={e => update('tierExpirationMonths', parseInt(e.target.value) || 12)}
                      className="w-20 px-2 py-1.5 text-[13px] text-center" aria-label={t.tierExpireLabel} />
                    <span className="text-[13px] text-[#8A7D6B]">{t.months}</span>
                    <div className="flex gap-1.5">
                      {['rolling', 'fixed'].map(type => (
                        <PillOption key={type} label={type === 'rolling' ? t.rolling : t.fixed}
                          active={config.tierExpirationType === type} onClick={() => update('tierExpirationType', type)} />
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="text-[11px] text-[#8A7D6B] mt-1">
                {config.tiersExpire && `${t.tierExpireDefault} `}{t.tierExpireExplanation}
              </div>
            </Setting>
          </YesNoCard>
        </div>
      </div>

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

          {/* Earn rate — points per € spent */}
          {config.hasMissions && (
            <div className="pt-3 border-t border-[#D9D5CB]">
              <div className="flex items-center gap-1.5 mb-1.5">
                <label className="text-[12px] font-medium text-[#645648]">{t.earnRate}</label>
                <Tooltip text={t.earnRateTip} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {EARN_RATE_OPTIONS.map(rate => (
                  <PillOption key={rate} label={`${rate} ${rate > 1 ? 'pts' : 'pt'} / €`} active={earnRate === rate}
                    onClick={() => setSettings(p => ({ ...p, earnRate: rate, earnRateManual: true }))} />
                ))}
                {settings.earnRateManual ? (
                  <button
                    onClick={() => setSettings(p => ({ ...p, earnRateManual: false }))}
                    className="text-[12px] text-primary hover:underline font-medium ml-1"
                  >
                    {lang === 'fr' ? `Revenir à la règle panier moyen (${autoEarnRate} pt${autoEarnRate > 1 ? 's' : ''}/€)` : `Back to the AOV rule (${autoEarnRate} pt${autoEarnRate > 1 ? 's' : ''}/€)`}
                  </button>
                ) : (
                  <span className="text-[11px] text-[#8A7D6B] ml-1">{t.earnRateAuto}</span>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Inline nav */}
      <div className="flex justify-between pt-6">
        {onPrev ? (
          <button onClick={onPrev} className="btn-secondary">
            <ChevronLeft size={16} /> {lang === 'fr' ? 'Précédent' : 'Previous'}
          </button>
        ) : <span />}
        {onNext && (
          <button onClick={onNext} className="btn-primary">
            {lang === 'fr' ? 'Suivant' : 'Next'} <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

// A structure question; its settings show inside the card when the answer is yes.
function YesNoCard({ title, tooltip, value, onChange, lang, children }) {
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
      {value && children && (
        <div className="mt-4 pt-4 border-t border-[#E5E1D8] space-y-4">{children}</div>
      )}
    </div>
  );
}

function Setting({ label, tooltip, children }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <label className="text-[12px] font-medium text-[#645648]">{label}</label>
        {tooltip && <Tooltip text={tooltip} />}
      </div>
      {children}
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
  earnRate: 'Points gagnés par € dépensé',
  earnRateTip: 'Règle Loyoly : panier moyen ≥ 50 € → 1 pt/€, sous 50 € → 10 pts/€. Les points des missions et le prix des récompenses suivent ce ratio.',
  earnRateAuto: 'Automatique selon le panier moyen (≥ 50 € → 1 pt/€, < 50 € → 10 pts/€)',
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
  earnRate: 'Points earned per € spent',
  earnRateTip: 'Loyoly rule: AOV ≥ 50€ → 1 pt/€, below 50€ → 10 pts/€. Mission points and reward prices follow this rate.',
  earnRateAuto: 'Automatic from the AOV (≥ 50€ → 1 pt/€, < 50€ → 10 pts/€)',
};
