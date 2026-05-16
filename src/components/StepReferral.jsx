import { useMemo } from 'react';
import { Users, UserPlus, Lightbulb } from 'lucide-react';
import { formatNumber } from '../utils/calculations';
import { getReferralBaseline } from '../data/defaults';

export default function StepReferral({ referralConfig, setReferralConfig, lang, aov, customers, industry }) {
  const t = lang === 'fr';
  const c = referralConfig;

  const update = (field, value) => {
    setReferralConfig(prev => ({ ...prev, [field]: value }));
  };

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
          {/* Referrer + Referee side by side */}
          <div className="grid grid-cols-2 gap-3">
            {/* Referrer */}
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users size={16} className="text-primary" />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-[#52473C]">{t ? 'Parrain' : 'Referrer'}</div>
                  <div className="text-[11px] text-[#8A7D6B]">{t ? 'Récompense pour celui qui parraine' : 'Reward for the one who refers'}</div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex gap-1.5">
                  <button
                    onClick={() => update('referrerType', 'fixed')}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${c.referrerType === 'fixed' ? 'bg-primary text-white' : 'bg-[#E5E1D8] text-[#645648]'}`}
                  >
                    {t ? '€ fixe' : '€ fixed'}
                  </button>
                  <button
                    onClick={() => update('referrerType', 'percent')}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${c.referrerType === 'percent' ? 'bg-primary text-white' : 'bg-[#E5E1D8] text-[#645648]'}`}
                  >
                    {t ? '% de la commande' : '% of order'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" min={0} value={c.referrerValue}
                    onChange={e => update('referrerValue', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-[13px] rounded-lg border border-[#D9D5CB]" />
                  <span className="text-[13px] text-[#8A7D6B] shrink-0">{c.referrerType === 'percent' ? '%' : '€'}</span>
                </div>
              </div>
            </div>

            {/* Referee */}
            <div className="card">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center">
                  <UserPlus size={16} className="text-green-600" />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-[#52473C]">{t ? 'Filleul' : 'Referee'}</div>
                  <div className="text-[11px] text-[#8A7D6B]">{t ? 'Récompense pour le nouveau client' : 'Reward for the new customer'}</div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex gap-1.5">
                  <button
                    onClick={() => update('refereeType', 'fixed')}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${c.refereeType === 'fixed' ? 'bg-primary text-white' : 'bg-[#E5E1D8] text-[#645648]'}`}
                  >
                    {t ? '€ fixe' : '€ fixed'}
                  </button>
                  <button
                    onClick={() => update('refereeType', 'percent')}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${c.refereeType === 'percent' ? 'bg-primary text-white' : 'bg-[#E5E1D8] text-[#645648]'}`}
                  >
                    {t ? '% de la commande' : '% of order'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input type="number" min={0} value={c.refereeValue}
                    onChange={e => update('refereeValue', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-[13px] rounded-lg border border-[#D9D5CB]" />
                  <span className="text-[13px] text-[#8A7D6B] shrink-0">{c.refereeType === 'percent' ? '%' : '€'}</span>
                </div>
              </div>
            </div>
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
