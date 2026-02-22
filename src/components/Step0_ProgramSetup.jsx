import { useState } from 'react';
import { ArrowRight, SkipForward } from 'lucide-react';
import { INDUSTRIES, PRICE_RANGES, GOALS } from '../data/defaults';

export default function Step0_ProgramSetup({ lang, answers, onComplete, onSkip }) {
  const t = lang === 'fr';
  const [industry, setIndustry] = useState(answers?.industry || '');
  const [priceRange, setPriceRange] = useState(answers?.priceRange || '');
  const [goals, setGoals] = useState(answers?.goals || []);

  const toggleGoal = (id) => {
    setGoals(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);
  };

  const canContinue = industry && priceRange;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <div className="section-subheader">{t ? 'CONFIGURATION' : 'SETUP'}</div>
        <h2 className="text-[22px] font-bold text-[#111827]">
          {t ? 'Configurez votre programme VIP' : 'Configure your VIP Program'}
        </h2>
        <p className="text-[15px] text-[#6B7280] mt-1.5">
          {t ? 'Ces réponses pré-rempliront les étapes suivantes. Vous pourrez tout modifier.' : 'These answers will pre-fill the next steps. You can change everything later.'}
        </p>
      </div>

      {/* Industry */}
      <div className="card" style={{ padding: 24 }}>
        <div className="section-subheader">{t ? 'SECTEUR D\'ACTIVITÉ' : 'INDUSTRY'}</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {INDUSTRIES.map(ind => (
            <button key={ind.id} onClick={() => setIndustry(ind.id)}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl text-[13px] font-medium transition-all border
                ${industry === ind.id
                  ? 'bg-primary-50 text-primary border-primary-200 shadow-sm'
                  : 'bg-white text-[#6B7280] border-gray-100 hover:border-gray-200'}`}>
              <span className="text-xl">{ind.emoji}</span>
              <span>{t ? ind.nameFr : ind.nameEn}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div className="card" style={{ padding: 24 }}>
        <div className="section-subheader">{t ? 'GAMME DE PRIX' : 'PRICE RANGE'}</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PRICE_RANGES.map(pr => (
            <button key={pr.id} onClick={() => setPriceRange(pr.id)}
              className={`px-4 py-3 rounded-xl text-[13px] font-medium transition-all border text-center
                ${priceRange === pr.id
                  ? 'bg-primary-50 text-primary border-primary-200 shadow-sm'
                  : 'bg-white text-[#6B7280] border-gray-100 hover:border-gray-200'}`}>
              {t ? pr.labelFr : pr.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* Goals */}
      <div className="card" style={{ padding: 24 }}>
        <div className="section-subheader">
          {t ? 'OBJECTIFS' : 'GOALS'}
          <span className="text-[#9CA3AF] font-normal ml-1 text-[10px] normal-case tracking-normal">({t ? 'optionnel' : 'optional'})</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {GOALS.map(g => (
            <button key={g.id} onClick={() => toggleGoal(g.id)}
              className={`flex items-center gap-2 px-4 py-3 rounded-xl text-[13px] font-medium transition-all border
                ${goals.includes(g.id)
                  ? 'bg-primary-50 text-primary border-primary-200'
                  : 'bg-white text-[#6B7280] border-gray-100 hover:border-gray-200'}`}>
              <span>{t ? g.labelFr : g.labelEn}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button onClick={onSkip} className="btn-ghost">
          <SkipForward size={14} />
          {t ? 'Passer' : 'Skip'}
        </button>
        <button onClick={() => onComplete({ industry, priceRange, goals })}
          disabled={!canContinue}
          className="btn-primary">
          {t ? 'Appliquer & continuer' : 'Apply & continue'}
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}
