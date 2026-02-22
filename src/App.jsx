import { useState, useCallback } from 'react';
import { RotateCcw, Globe, ChevronLeft, ChevronRight, Link2, Menu } from 'lucide-react';
import Step0_ProgramSetup from './components/Step0_ProgramSetup';
import Step1_DataSettings from './components/Step1_DataSettings';
import Step2_Missions from './components/Step2_Missions';
import Step3_Rewards from './components/Step3_Rewards';
import Step4_TierBuilder from './components/Step4_TierBuilder';
import Step5_Dashboard from './components/Step5_Dashboard';
import { parseSampleData } from './data/sampleData';
import { DEFAULT_MISSIONS, DEFAULT_REWARDS } from './data/defaults';
import { resizeAssignedTiers, resizeMissionEngagement } from './utils/calculations';
import { applyOnboardingDefaults } from './data/onboardingPresets';
import { applyBrandDefaults } from './data/brandPresets';
import StepBrand_Analyzer from './components/StepBrand_Analyzer';
import ProgramTypeBanner from './components/ProgramTypeBanner';

const INITIAL_CONFIG = {
  tierBasis: 'spend',
  hasMissions: true,
  rewardType: 'both',
  pointsExpire: false,
  expirationMonths: 12,
  expirationType: 'rolling',
};

const INITIAL_SETTINGS = {
  segmentationType: 'revenue',
  caWeight: 0.5,
  aov: 60,
  grossMargin: 60,
  cashbackRate: 3,
};

const INITIAL_TIERS = [
  { name: 'Bronze', color: '#CD7F32', threshold: 100, pointsThreshold: 0, pointsMultiplier: 1, perks: [] },
  { name: 'Argent', color: '#A8A9AD', threshold: 50, pointsThreshold: 1000, pointsMultiplier: 1.5, perks: [] },
  { name: 'Or', color: '#FFD700', threshold: 15, pointsThreshold: 3000, pointsMultiplier: 2, perks: [] },
];

const STEPS = [
  { id: 0, labelFr: 'Programme', labelEn: 'Program' },
  { id: 1, labelFr: 'Données', labelEn: 'Data' },
  { id: 2, labelFr: 'Missions', labelEn: 'Missions' },
  { id: 3, labelFr: 'Récompenses', labelEn: 'Rewards' },
  { id: 4, labelFr: 'Paliers', labelEn: 'Tiers' },
  { id: 5, labelFr: 'Dashboard', labelEn: 'Dashboard' },
];

function App() {
  const [lang, setLang] = useState('fr');
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState(INITIAL_CONFIG);
  const [settings, setSettings] = useState(INITIAL_SETTINGS);
  const [customers, setCustomers] = useState(() => parseSampleData());
  const [tiers, setTiersRaw] = useState(INITIAL_TIERS);
  const [missions, setMissions] = useState(() => DEFAULT_MISSIONS.map(m => ({ ...m, engagementByTier: [...(m.engagementByTier || [20, 30, 50])] })));
  const [customMissions, setCustomMissions] = useState([]);
  const [rewards, setRewards] = useState(DEFAULT_REWARDS);
  const [burnRate, setBurnRate] = useState(40);
  const [onboardingAnswers, setOnboardingAnswers] = useState(null);
  const [phase, setPhase] = useState('brand'); // 'brand' | 'wizard'
  const [brandAnalysis, setBrandAnalysis] = useState(null);

  const setTiers = useCallback((newTiersOrFn) => {
    setTiersRaw(prev => {
      const newTiers = typeof newTiersOrFn === 'function' ? newTiersOrFn(prev) : newTiersOrFn;
      if (newTiers.length !== prev.length) {
        setRewards(r => resizeAssignedTiers(r, newTiers.length));
        setMissions(m => resizeMissionEngagement(m, newTiers.length));
        setCustomMissions(m => resizeMissionEngagement(m, newTiers.length));
      }
      return newTiers;
    });
  }, []);

  const handleBrandComplete = (analysisResult) => {
    setBrandAnalysis(analysisResult);
    const defaults = applyBrandDefaults(analysisResult, lang);
    setConfig(defaults.config);
    setSettings(defaults.settings);
    setTiersRaw(defaults.tiers);
    setRewards(defaults.rewards);
    setMissions(defaults.missions);
    setBurnRate(defaults.burnRate);
    setPhase('wizard');
    setStep(1);
  };

  const handleBrandSkip = () => {
    setBrandAnalysis(null);
    setPhase('wizard');
    setStep(0);
  };

  const handleStep0Complete = (answers) => {
    setOnboardingAnswers(answers);
    const defaults = applyOnboardingDefaults(answers, lang);
    setConfig(defaults.config);
    setSettings(defaults.settings);
    setTiersRaw(defaults.tiers);
    setRewards(defaults.rewards);
    setMissions(defaults.missions);
    setBurnRate(defaults.burnRate);
    setStep(1);
  };

  const reset = () => {
    setConfig(INITIAL_CONFIG);
    setSettings(INITIAL_SETTINGS);
    setCustomers(parseSampleData());
    setTiersRaw(INITIAL_TIERS);
    setMissions(DEFAULT_MISSIONS.map(m => ({ ...m, engagementByTier: [...(m.engagementByTier || [20, 30, 50])] })));
    setCustomMissions([]);
    setRewards(DEFAULT_REWARDS);
    setBurnRate(40);
    setOnboardingAnswers(null);
    setBrandAnalysis(null);
    setPhase('brand');
    setStep(0);
  };

  const copyShareableLink = () => {
    const state = { config, settings, tiers, onboardingAnswers };
    const encoded = btoa(JSON.stringify(state));
    const url = `${window.location.origin}${window.location.pathname}?state=${encoded}`;
    navigator.clipboard.writeText(url);
  };

  const t = lang === 'fr';

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* ─── Navbar ─── */}
      <header className="sticky top-0 z-40 bg-white" style={{ height: 56, borderBottom: '1px solid #E5E7EB' }}>
        <div className="max-w-[960px] mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Menu size={18} className="text-gray-400" />
            <div>
              <span className="text-[15px] font-bold text-gray-900">VIP Tiers Calculator</span>
              <span className="text-[12px] text-gray-400 ml-2">by Loyoly</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={copyShareableLink}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-all"
              title={t ? 'Copier le lien' : 'Copy link'}>
              <Link2 size={15} />
            </button>
            <button onClick={() => setLang(l => l === 'fr' ? 'en' : 'fr')}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 transition-all">
              <Globe size={15} />
            </button>
            <button onClick={reset}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-all">
              <RotateCcw size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* ─── Program type / Onboarding banner ─── */}
      {phase === 'wizard' && step > 0 && brandAnalysis && (
        <ProgramTypeBanner
          programType={brandAnalysis.recommended_program}
          brandName={brandAnalysis.brand_name}
          lang={lang}
          onEdit={() => { setPhase('brand'); }}
        />
      )}
      {phase === 'wizard' && step > 0 && !brandAnalysis && onboardingAnswers && (
        <div className="bg-primary-50" style={{ borderBottom: '1px solid #E8E1FF' }}>
          <div className="max-w-[960px] mx-auto px-6 py-2 flex items-center gap-4 text-[12px]">
            <span className="section-subheader" style={{ marginBottom: 0, fontSize: 10 }}>{t ? 'PROGRAMME' : 'PROGRAM'}</span>
            <span className="text-gray-600">{onboardingAnswers.industry}</span>
            <span className="text-gray-300">|</span>
            <span className="text-gray-600">{onboardingAnswers.priceRange}</span>
            <span className="text-gray-300">|</span>
            <span className="text-gray-600">{onboardingAnswers.goals?.join(', ')}</span>
            <button onClick={() => setStep(0)} className="ml-auto text-primary font-medium hover:underline text-[12px]">
              {t ? 'Modifier' : 'Edit'}
            </button>
          </div>
        </div>
      )}

      {/* ─── Main Content ─── */}
      <main className="flex-1 max-w-[960px] mx-auto w-full px-6 pt-8 pb-24">
        {phase === 'brand' ? (
          <StepBrand_Analyzer
            lang={lang}
            onComplete={handleBrandComplete}
            onSkip={handleBrandSkip}
            initialData={brandAnalysis}
          />
        ) : (
          <div className="step-transition" key={step}>
            {step === 0 && (
              <Step0_ProgramSetup lang={lang} answers={onboardingAnswers}
                onComplete={handleStep0Complete} onSkip={() => setStep(1)} />
            )}
            {step === 1 && (
              <Step1_DataSettings config={config} setConfig={setConfig}
                customers={customers} setCustomers={setCustomers}
                settings={settings} setSettings={setSettings} lang={lang} />
            )}
            {step === 2 && (
              <Step2_Missions missions={missions} setMissions={setMissions}
                customMissions={customMissions} setCustomMissions={setCustomMissions}
                tiers={tiers} customers={customers} settings={settings} config={config} lang={lang} />
            )}
            {step === 3 && (
              <Step3_Rewards rewards={rewards} setRewards={setRewards}
                settings={settings} config={config} lang={lang} />
            )}
            {step === 4 && (
              <Step4_TierBuilder tiers={tiers} setTiers={setTiers}
                rewards={rewards} setRewards={setRewards}
                burnRate={burnRate} setBurnRate={setBurnRate}
                customers={customers} settings={settings} config={config}
                missions={missions} customMissions={customMissions} lang={lang} />
            )}
            {step === 5 && (
              <Step5_Dashboard tiers={tiers} customers={customers}
                settings={settings} config={config}
                missions={missions} customMissions={customMissions}
                rewards={rewards} burnRate={burnRate} lang={lang} />
            )}
          </div>
        )}
      </main>

      {/* ─── Bottom Navigation (hidden during brand phase) ─── */}
      {phase === 'wizard' && (
        <footer className="fixed bottom-0 left-0 right-0 z-40 bg-white" style={{ borderTop: '1px solid #E5E7EB' }}>
          <div className="max-w-[960px] mx-auto px-6 py-3 flex items-center justify-between">
            <button
              onClick={() => {
                if (step === 0 && brandAnalysis) {
                  setPhase('brand');
                } else {
                  setStep(s => Math.max(0, s - 1));
                }
              }}
              disabled={step === 0 && !brandAnalysis}
              className="btn-ghost disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
              {t ? 'Précédent' : 'Previous'}
            </button>

            <span className="text-[13px] text-gray-400">
              {t ? `Étape ${step + 1} sur ${STEPS.length}` : `Step ${step + 1} of ${STEPS.length}`}
            </span>

            <button
              onClick={() => setStep(s => Math.min(STEPS.length - 1, s + 1))}
              disabled={step === STEPS.length - 1}
              className="btn-primary disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {t ? 'Suivant' : 'Next'}
              <ChevronRight size={16} />
            </button>
          </div>
        </footer>
      )}
    </div>
  );
}

export default App;
