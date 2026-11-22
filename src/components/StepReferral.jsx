import { useMemo } from 'react';
import { Users, UserPlus, Lightbulb, Sparkles } from 'lucide-react';
import Tooltip from './Tooltip';
import { formatNumber } from '../utils/calculations';
import { getReferralBaseline } from '../data/defaults';
import { referralRewardForAov, referralExpirationDays, resolveReferral, formatReferralReward } from '../utils/referralModel';

export default function StepReferral({ referralConfig, setReferralConfig, lang, aov, customers, industry }) {
  const t = lang === 'fr';
  // Values shown are the resolved ones: auto fields follow the AOV.
  const c = resolveReferral(referralConfig, aov);

  const update = (field, value) => {
    setReferralConfig(prev => ({ ...prev, [field]: value }));
  };

  // Editing a reward / an expiration freezes both sides at what is shown.
  const updateReward = (field, value) => setReferralConfig(prev => ({
    ...prev,
    rewardsAuto: false,
    referrerType: c.referrerType, referrerValue: c.referrerValue,
    refereeType: c.refereeType, refereeValue: c.refereeValue,
    [field]: value,
  }));
  const updateExpiration = (field, value) => setReferralConfig(prev => ({
    ...prev,
    expirationsAuto: false,
    referrerExpirationDays: c.referrerExpirationDays,
    refereeExpirationDays: c.refereeExpirationDays,
    [field]: value,
  }));
  const updateMinPurchase = (side, value) => setReferralConfig(prev => ({
    ...prev, [`${side}MinPurchaseAuto`]: false, [`${side}MinPurchase`]: value,
  }));

  const recommended = referralRewardForAov(aov);
  const isRecommended = referralConfig.rewardsAuto && referralConfig.expirationsAuto
    && referralConfig.referrerMinPurchaseAuto && referralConfig.refereeMinPurchaseAuto;
  const applyRecommended = () => setReferralConfig(prev => ({
    ...prev, rewardsAuto: true, expirationsAuto: true, referrerMinPurchaseAuto: true, refereeMinPurchaseAuto: true,
  }));

  // Data-driven baseline projections from the imported customer base + industry.
  const baseline = useMemo(
    () => getReferralBaseline({
      customerCount: customers?.length || 0,
      aov: aov || 60,
      industry,
    }),
    [customers, aov, industry]
  );

  const applyAllBaselines = () => {
    setReferralConfig(prev => ({
      ...prev,
      estimatedReferralsPerMonth: baseline.estimatedReferralsPerMonth,
      conversionRate: baseline.conversionRate,
      avgFirstOrderValue: baseline.avgFirstOrderValue,
    }));
  };

  const sides = [
    {
      key: 'referrer', icon: <Users size={16} className="text-primary" />, iconBg: 'bg-primary/10',
      title: t ? 'Parrain' : 'Referrer', subtitle: t ? 'Récompense pour celui qui parraine' : 'Reward for the one who refers',
    },
    {
      key: 'referee', icon: <UserPlus size={16} className="text-green-600" />, iconBg: 'bg-green-50',
      title: t ? 'Filleul' : 'Referee', subtitle: t ? 'Récompense pour le nouveau client' : 'Reward for the new customer',
    },
  ];

  return (
    <div className="space-y-3">
      {/* Toggle */}
      <div className="flex items-center gap-3">
        <label className="relative inline-flex items-center cursor-pointer">
          <input type="checkbox" checked={c.enabled} onChange={e => update('enabled', e.target.checked)} className="sr-only peer" />
          <div className="w-9 h-5 bg-[#D9D5CB] peer-checked:bg-primary rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
        </label>
        <span className="text-[14px] font-medium text-[#645648]">
          {t ? 'Activer le parrainage' : 'Enable referral program'}
        </span>
      </div>

      {c.enabled && (
        <>
          {/* Loyoly recommendation for this AOV */}
          <div className="card flex flex-wrap items-center gap-3" style={{ padding: '12px 16px', borderLeft: '3px solid #2965FE' }}>
            <Sparkles size={14} className="text-primary shrink-0" />
            <span className="text-[12px] text-[#52473C]">
              {t
                ? `Recommandé pour un panier moyen de ${aov || 0} € : ${formatReferralReward(recommended.type, recommended.value)} parrain et filleul, expiration ${referralExpirationDays(recommended.type, recommended.value, 'referrer')} j / ${referralExpirationDays(recommended.type, recommended.value, 'referee')} j, achat minimum = panier moyen.`
                : `Recommended for a ${aov || 0}€ AOV: ${formatReferralReward(recommended.type, recommended.value)} for referrer and referee, expiry ${referralExpirationDays(recommended.type, recommended.value, 'referrer')} d / ${referralExpirationDays(recommended.type, recommended.value, 'referee')} d, minimum purchase = AOV.`}
            </span>
            {isRecommended ? (
              <span className="ml-auto text-[11px] font-medium text-[#059669]">{t ? '✓ Valeurs recommandées appliquées' : '✓ Recommended values applied'}</span>
            ) : (
              <button onClick={applyRecommended} className="ml-auto btn-secondary text-[11px] px-2 py-1">
                {t ? 'Valeurs recommandées' : 'Recommended values'}
              </button>
            )}
          </div>

          {/* Referrer + Referee side by side */}
          <div className="grid grid-cols-2 gap-3">
            {sides.map(side => {
              const type = c[`${side.key}Type`];
              return (
                <div key={side.key} className="card">
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-8 h-8 rounded-full ${side.iconBg} flex items-center justify-center`}>
                      {side.icon}
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold text-[#52473C]">{side.title}</div>
                      <div className="text-[11px] text-[#8A7D6B]">{side.subtitle}</div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex gap-1.5">
                      {[['fixed', t ? '€ fixe' : '€ fixed'], ['percent', t ? '% de la commande' : '% of order']].map(([value, label]) => (
                        <button key={value}
                          onClick={() => updateReward(`${side.key}Type`, value)}
                          className={`flex-1 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${type === value ? 'bg-primary text-white' : 'bg-[#E5E1D8] text-[#645648]'}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="number" min={0} value={c[`${side.key}Value`]}
                        onChange={e => updateReward(`${side.key}Value`, parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 text-[13px] rounded-lg border border-[#D9D5CB]" />
                      <span className="text-[13px] text-[#8A7D6B] shrink-0">{type === 'percent' ? '%' : '€'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-[#645648] mb-1 flex items-center gap-1">
                          {t ? 'Expiration' : 'Expiry'}
                          <Tooltip text={t ? 'Durée de validité de la récompense. Par défaut selon le montant (10 % / 10 € / 15 € : 7 j filleul, 14 j parrain ; 5 € / 20 € : 14 j filleul, 30 j parrain).' : 'How long the reward stays valid. Default by amount (10% / €10 / €15: 7 d referee, 14 d referrer; €5 / €20: 14 d referee, 30 d referrer).'} />
                        </label>
                        <div className="flex items-center gap-1">
                          <input type="number" min={0} value={c[`${side.key}ExpirationDays`]}
                            onChange={e => updateExpiration(`${side.key}ExpirationDays`, parseInt(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 text-[13px] rounded-lg border border-[#D9D5CB]" />
                          <span className="text-[12px] text-[#8A7D6B] shrink-0">{t ? 'jours' : 'days'}</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] text-[#645648] mb-1 block">{t ? 'Achat minimum' : 'Min purchase'}</label>
                        <div className="flex items-center gap-1">
                          <input type="number" min={0} value={c[`${side.key}MinPurchase`]}
                            onChange={e => updateMinPurchase(side.key, parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 text-[13px] rounded-lg border border-[#D9D5CB]" />
                          <span className="text-[12px] text-[#8A7D6B] shrink-0">€</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Data-driven projections */}
          <div className="card">
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="section-subheader">{t ? 'PROJECTIONS' : 'PROJECTIONS'}</div>
                <div className="text-[11px] text-[#8A7D6B] mt-0.5 flex items-center gap-1">
                  <Lightbulb size={11} className="text-[#D97706]" />
                  {t
                    ? `Suggéré depuis ${formatNumber(customers?.length || 0)} clients${baseline.industryUsed ? ` × secteur ${baseline.industryUsed}` : ''}.`
                    : `Suggested from ${formatNumber(customers?.length || 0)} customers${baseline.industryUsed ? ` × ${baseline.industryUsed} industry` : ''}.`}
                </div>
              </div>
              <button onClick={applyAllBaselines} className="btn-secondary text-[11px] px-2 py-1">
                {t ? 'Tout appliquer' : 'Apply all'}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-2">
              <ProjectionInput
                label={t ? 'Parrainages / mois' : 'Referrals / month'}
                value={c.estimatedReferralsPerMonth}
                suggested={baseline.estimatedReferralsPerMonth}
                onChange={v => update('estimatedReferralsPerMonth', parseInt(v) || 0)}
                onApply={() => update('estimatedReferralsPerMonth', baseline.estimatedReferralsPerMonth)}
                hint={t
                  ? `${Math.round(baseline.participation * 100)}% des clients × ${baseline.refsPerReferrer} refs/an ÷ 12`
                  : `${Math.round(baseline.participation * 100)}% of customers × ${baseline.refsPerReferrer} refs/yr ÷ 12`}
                lang={lang}
              />
              <ProjectionInput
                label={t ? 'Taux de conversion' : 'Conversion rate'}
                value={c.conversionRate}
                suggested={baseline.conversionRate}
                onChange={v => update('conversionRate', parseFloat(v) || 0)}
                onApply={() => update('conversionRate', baseline.conversionRate)}
                hint={t ? 'Filleuls qui achètent' : 'Referees who purchase'}
                suffix="%"
                lang={lang}
              />
              <ProjectionInput
                label={t ? 'Panier moyen 1er achat' : 'Avg first order value'}
                value={c.avgFirstOrderValue}
                suggested={baseline.avgFirstOrderValue}
                onChange={v => update('avgFirstOrderValue', parseFloat(v) || 0)}
                onApply={() => update('avgFirstOrderValue', baseline.avgFirstOrderValue)}
                hint={t
                  ? `AOV ${aov || 60}€ × ${Math.round(baseline.firstOrderRatio * 100)}%`
                  : `AOV ${aov || 60}€ × ${Math.round(baseline.firstOrderRatio * 100)}%`}
                suffix="€"
                lang={lang}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ProjectionInput({ label, value, suggested, onChange, onApply, hint, suffix, lang }) {
  const t = lang === 'fr';
  const isDifferent = Math.abs((Number(value) || 0) - (Number(suggested) || 0)) > 0.5;
  return (
    <div>
      <label className="text-[11px] text-[#645648] block mb-1">{label}</label>
      <div className="flex items-center gap-1">
        <input type="number" min={0} value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full px-3 py-2 text-[13px] rounded-lg border border-[#D9D5CB]" />
        {suffix && <span className="text-[13px] text-[#8A7D6B] shrink-0">{suffix}</span>}
      </div>
      <div className="flex items-center gap-1 mt-1 text-[10px] text-[#8A7D6B]">
        <span>
          {t ? 'Suggéré' : 'Suggested'}: <strong>{suggested}{suffix || ''}</strong>
        </span>
        {isDifferent && (
          <button onClick={onApply} className="text-primary hover:underline font-medium">
            {t ? 'Utiliser' : 'Apply'}
          </button>
        )}
      </div>
      {hint && <div className="text-[10px] text-[#8A7D6B] mt-0.5 italic">{hint}</div>}
    </div>
  );
}
