import { useState } from 'react';
import { X, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { INDUSTRIES, PRICE_RANGES, GOALS } from '../data/onboardingPresets';

export default function OnboardingModal({ lang, onComplete, onSkip }) {
  const t = lang === 'fr' ? FR : EN;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({
    industry: null,
    priceRange: null,
    goals: [],
  });

  const canNext = () => {
    if (step === 0) return answers.industry !== null;
    if (step === 1) return answers.priceRange !== null;
    if (step === 2) return answers.goals.length > 0;
    return true;
  };

  const toggleGoal = (id) => {
    setAnswers(prev => ({
      ...prev,
      goals: prev.goals.includes(id)
        ? prev.goals.filter(g => g !== id)
        : [...prev.goals, id],
    }));
  };

  const handleNext = () => {
    if (step < 2) {
      setStep(step + 1);
    } else {
      onComplete(answers);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 modal-backdrop">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onSkip} />
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden transition-step">
        {/* Header */}
        <div className="bg-primary px-6 py-5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles size={18} />
              <h2 className="font-bold text-sm">{t.title}</h2>
            </div>
            <button onClick={onSkip} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
              <X size={16} />
            </button>
          </div>
          <p className="text-white/70 text-xs mt-1">{t.subtitle}</p>
          {/* Progress */}
          <div className="flex gap-1 mt-3">
            {[0, 1, 2].map(i => (
              <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? 'bg-white' : 'bg-white/30'}`} />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 0 && (
            <div>
              <h3 className="font-semibold text-gray-800 text-sm mb-3">{t.industryQ}</h3>
              <div className="grid grid-cols-3 gap-2">
                {INDUSTRIES.map(ind => (
                  <button
                    key={ind.id}
                    onClick={() => setAnswers(prev => ({ ...prev, industry: ind.id }))}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all text-center
                      ${answers.industry === ind.id
                        ? 'border-primary bg-primary-50 text-primary'
                        : 'border-gray-100 hover:border-gray-200 text-gray-600'}`}
                  >
                    <span className="text-2xl">{ind.emoji}</span>
                    <span className="text-xs font-medium">{lang === 'fr' ? ind.labelFr : ind.labelEn}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h3 className="font-semibold text-gray-800 text-sm mb-3">{t.priceQ}</h3>
              <div className="grid grid-cols-2 gap-2">
                {PRICE_RANGES.map(pr => (
                  <button
                    key={pr.id}
                    onClick={() => setAnswers(prev => ({ ...prev, priceRange: pr.id }))}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all
                      ${answers.priceRange === pr.id
                        ? 'border-primary bg-primary-50 text-primary'
                        : 'border-gray-100 hover:border-gray-200 text-gray-600'}`}
                  >
                    <span className="text-lg">{pr.emoji}</span>
                    <span className="text-xs font-medium">{lang === 'fr' ? pr.labelFr : pr.labelEn}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h3 className="font-semibold text-gray-800 text-sm mb-3">{t.goalsQ}</h3>
              <div className="space-y-2">
                {GOALS.map(goal => (
                  <button
                    key={goal.id}
                    onClick={() => toggleGoal(goal.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left
                      ${answers.goals.includes(goal.id)
                        ? 'border-primary bg-primary-50'
                        : 'border-gray-100 hover:border-gray-200'}`}
                  >
                    <span className="text-lg">{goal.emoji}</span>
                    <div>
                      <div className={`text-xs font-semibold ${answers.goals.includes(goal.id) ? 'text-primary' : 'text-gray-700'}`}>
                        {lang === 'fr' ? goal.labelFr : goal.labelEn}
                      </div>
                      <div className="text-[10px] text-gray-400">{lang === 'fr' ? goal.descFr : goal.descEn}</div>
                    </div>
                    <div className={`ml-auto w-4 h-4 rounded border-2 flex items-center justify-center text-[8px] transition-colors
                      ${answers.goals.includes(goal.id) ? 'bg-primary border-primary text-white' : 'border-gray-300'}`}>
                      {answers.goals.includes(goal.id) && '✓'}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 flex items-center justify-between">
          <button
            onClick={onSkip}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            {t.skip}
          </button>
          <div className="flex items-center gap-2">
            {step > 0 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft size={12} /> {t.back}
              </button>
            )}
            <button
              onClick={handleNext}
              disabled={!canNext()}
              className="flex items-center gap-1 px-4 py-2 bg-primary text-white rounded-lg text-xs font-medium disabled:opacity-40 hover:bg-primary/90 transition-colors"
            >
              {step === 2 ? t.apply : t.next} <ArrowRight size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const FR = {
  title: 'Configurez votre programme',
  subtitle: 'Répondez à 3 questions pour une configuration personnalisée',
  industryQ: 'Quel est votre secteur ?',
  priceQ: 'Quel est votre panier moyen ?',
  goalsQ: 'Quels sont vos objectifs ? (multi-choix)',
  skip: 'Passer →',
  back: 'Retour',
  next: 'Suivant',
  apply: 'Appliquer',
};

const EN = {
  title: 'Configure your program',
  subtitle: 'Answer 3 questions for a personalized setup',
  industryQ: 'What is your industry?',
  priceQ: 'What is your average order value?',
  goalsQ: 'What are your goals? (select multiple)',
  skip: 'Skip →',
  back: 'Back',
  next: 'Next',
  apply: 'Apply',
};
