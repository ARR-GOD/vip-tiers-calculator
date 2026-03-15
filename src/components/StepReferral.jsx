import { useMemo } from 'react';
import { Users, UserPlus } from 'lucide-react';
import { computeReferralEconomics, formatCurrency, formatPercent } from '../utils/calculations';

export default function StepReferral({ referralConfig, setReferralConfig, lang, aov }) {
  const t = lang === 'fr';
  const c = referralConfig;

  const update = (field, value) => {
    setReferralConfig(prev => ({ ...prev, [field]: value }));
  };

  const economics = useMemo(() => {
    return computeReferralEconomics(c, aov);
  }, [c, aov]);

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

          {/* Projections */}
          <div className="card">
            <div className="section-subheader">{t ? 'PROJECTIONS' : 'PROJECTIONS'}</div>
            <div className="grid grid-cols-3 gap-3 mt-2">
              <div>
                <label className="text-[11px] text-[#645648] block mb-1">{t ? 'Parrainages / mois' : 'Referrals / month'}</label>
                <input type="number" min={0} value={c.estimatedReferralsPerMonth}
                  onChange={e => update('estimatedReferralsPerMonth', parseInt(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-[13px] rounded-lg border border-[#D9D5CB]" />
              </div>
              <div>
                <label className="text-[11px] text-[#645648] block mb-1">{t ? 'Taux de conversion (%)' : 'Conversion rate (%)'}</label>
                <input type="number" min={0} max={100} value={c.conversionRate}
                  onChange={e => update('conversionRate', parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 text-[13px] rounded-lg border border-[#D9D5CB]" />
              </div>
              <div>
                <label className="text-[11px] text-[#645648] block mb-1">{t ? 'Panier moyen 1er achat' : 'Avg first order value'}</label>
                <div className="flex items-center gap-1">
                  <input type="number" min={0} value={c.avgFirstOrderValue}
                    onChange={e => update('avgFirstOrderValue', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-[13px] rounded-lg border border-[#D9D5CB]" />
                  <span className="text-[13px] text-[#8A7D6B]">€</span>
                </div>
              </div>
            </div>
          </div>

          {/* Economics summary */}
          <div className="card" style={{ backgroundColor: '#EEEDE6' }}>
            <div className="section-subheader">{t ? 'BILAN ANNUEL PARRAINAGE' : 'ANNUAL REFERRAL SUMMARY'}</div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
              <div>
                <div className="text-[11px] text-[#645648]">{t ? 'Coût parrains / an' : 'Referrer cost / yr'}</div>
                <div className="text-[18px] font-bold text-[#DC2626]">{formatCurrency(economics.costReferrerPerYear)}</div>
              </div>
              <div>
                <div className="text-[11px] text-[#645648]">{t ? 'Coût filleuls / an' : 'Referee cost / yr'}</div>
                <div className="text-[18px] font-bold text-[#DC2626]">{formatCurrency(economics.costRefereePerYear)}</div>
              </div>
              <div>
                <div className="text-[11px] text-[#645648]">{t ? 'Revenue filleuls / an' : 'Referee revenue / yr'}</div>
                <div className="text-[18px] font-bold text-[#059669]">{formatCurrency(economics.revenuePerYear)}</div>
              </div>
              <div>
                <div className="text-[11px] text-[#645648]">{t ? 'ROI parrainage' : 'Referral ROI'}</div>
                <div className={`text-[18px] font-bold ${economics.roi >= 0 ? 'text-[#059669]' : 'text-[#DC2626]'}`}>
                  {economics.roi >= 0 ? '+' : ''}{formatPercent(economics.roi)}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
