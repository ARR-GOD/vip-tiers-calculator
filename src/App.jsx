import { useState, useCallback, useEffect } from 'react';
import { RotateCcw, Globe, ChevronRight, Link2, Check } from 'lucide-react';
import Step0_ProgramSetup from './components/Step0_ProgramSetup';
import StepData_Import from './components/StepData_Import';
import Step1_DataSettings from './components/Step1_DataSettings';
import Step2_Missions from './components/Step2_Missions';
import Step3_Rewards from './components/Step3_Rewards';
import Step4_TierBuilder from './components/Step4_TierBuilder';
import Step5_Dashboard from './components/Step5_Dashboard';
import { parseSampleData } from './data/sampleData';
import { DEFAULT_MISSIONS, DEFAULT_REWARDS, INITIAL_REFERRAL } from './data/defaults';
import { resizeAssignedTiers, resizeMissionEngagement } from './utils/calculations';
import { applyOnboardingDefaults } from './data/onboardingPresets';
import { applyBrandDefaults } from './data/brandPresets';
import StepBrand_Analyzer from './components/StepBrand_Analyzer';
import ProgramTypeBanner from './components/ProgramTypeBanner';

const INITIAL_CONFIG = {
  tierBasis: 'spend',
  hasMissions: true,
  rewardType: 'both',
  pointsExpire: true,
  expirationMonths: 12,
  expirationType: 'rolling',
};

const INITIAL_SETTINGS = {
  segmentationType: 'revenue',
  caWeight: 0.5,
  aov: 60,
  grossMargin: 60,
  cashbackRate: 3,
  pointsPerEuro: 100, // 100 points = 1€ de récompense
};

const INITIAL_TIERS = [
  { name: 'Bronze', color: '#B87333', threshold: 100, spendThreshold: 0, pointsThreshold: 0, pointsMultiplier: 1, perks: [] },
  { name: 'Argent', color: '#9CA3AF', threshold: 50, spendThreshold: 500, pointsThreshold: 1000, pointsMultiplier: 1.5, perks: [] },
  { name: 'Or', color: '#D97706', threshold: 15, spendThreshold: 2000, pointsThreshold: 3000, pointsMultiplier: 2, perks: [] },
];

const STEPS = [
  { id: 0, labelFr: 'Programme', labelEn: 'Program' },
  { id: 1, labelFr: 'Import', labelEn: 'Import' },
  { id: 2, labelFr: 'Configuration', labelEn: 'Config' },
  { id: 3, labelFr: 'Missions', labelEn: 'Missions' },
  { id: 4, labelFr: 'Récompenses', labelEn: 'Rewards' },
  { id: 5, labelFr: 'Paliers', labelEn: 'Tiers' },
  { id: 6, labelFr: 'Dashboard', labelEn: 'Dashboard' },
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
  const [referralConfig, setReferralConfig] = useState(INITIAL_REFERRAL);
  const [onboardingAnswers, setOnboardingAnswers] = useState(null);
  const [phase, setPhase] = useState('brand'); // 'brand' | 'wizard'
  const [brandAnalysis, setBrandAnalysis] = useState(null);
  const [visitedSteps, setVisitedSteps] = useState(new Set([0]));

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
    setStep(1); // Go to CSV import step
  };

  const handleBrandSkip = () => {
    setBrandAnalysis(null);
    setPhase('wizard');
    setStep(0); // Go to manual onboarding
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
    setStep(1); // Go to CSV import step
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
    setReferralConfig(INITIAL_REFERRAL);
    setOnboardingAnswers(null);
    setBrandAnalysis(null);
    setPhase('brand');
    setStep(0);
    setVisitedSteps(new Set([0]));
    // Clear recommendation dismiss flags
    for (let i = 1; i <= 6; i++) {
      try { localStorage.removeItem(`vip_reco_dismissed_step${i}`); } catch { /* noop */ }
    }
  };

  // Track visited steps
  useEffect(() => {
    if (phase === 'wizard') {
      setVisitedSteps(prev => {
        if (prev.has(step)) return prev;
        const next = new Set(prev);
        next.add(step);
        return next;
      });
    }
  }, [step, phase]);

  const goNext = useCallback(() => {
    setStep(s => Math.min(STEPS.length - 1, s + 1));
  }, []);

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
      <header className="sticky top-0 z-40" style={{ height: 56, backgroundColor: '#2B251F' }}>
        <div className="max-w-[1100px] mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/loyoly-logo.svg" alt="Loyoly" style={{ height: 28, filter: 'brightness(0) invert(1)' }} />
            <span className="text-[15px] font-bold text-white">VIP Tiers Calculator</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={copyShareableLink}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all"
              title={t ? 'Copier le lien' : 'Copy link'}>
              <Link2 size={15} />
            </button>
            <button onClick={() => setLang(l => l === 'fr' ? 'en' : 'fr')}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all">
              <Globe size={15} />
            </button>
            <button onClick={reset}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-white/60 hover:text-red-400 hover:bg-white/10 transition-all">
              <RotateCcw size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* ─── Program type / Onboarding banner ─── */}
      {phase === 'wizard' && step > 1 && brandAnalysis && (
        <ProgramTypeBanner
          programType={brandAnalysis.recommended_program}
          brandName={brandAnalysis.brand_name}
          brandLogo={brandAnalysis.brand_logo}
          lang={lang}
          onEdit={() => { setPhase('brand'); }}
        />
      )}
      {phase === 'wizard' && step > 1 && !brandAnalysis && onboardingAnswers && (
        <div style={{ backgroundColor: '#E8EFFE', borderBottom: '1px solid #D9D5CB' }}>
          <div className="max-w-[1100px] mx-auto px-6 py-2 flex items-center gap-4 text-[12px]">
            <span className="section-subheader" style={{ marginBottom: 0, fontSize: 10 }}>{t ? 'PROGRAMME' : 'PROGRAM'}</span>
            <span className="text-[#645648]">{onboardingAnswers.industry}</span>
            <span className="text-[#8A7D6B]">|</span>
            <span className="text-[#645648]">{onboardingAnswers.priceRange}</span>
            <span className="text-[#8A7D6B]">|</span>
            <span className="text-[#645648]">{onboardingAnswers.goals?.join(', ')}</span>
            <button onClick={() => setStep(0)} className="ml-auto text-primary font-medium hover:underline text-[12px]">
              {t ? 'Modifier' : 'Edit'}
            </button>
          </div>
        </div>
      )}

      {/* ─── Step Tabs ─── */}
      {phase === 'wizard' && (
        <nav className="sticky top-[57px] z-30" style={{ backgroundColor: '#EEEDE6', borderBottom: '1px solid #D9D5CB' }}>
          <div className="max-w-[1100px] mx-auto px-6 flex items-center gap-1 overflow-x-auto py-2 tier-scroll" style={{ scrollbarWidth: 'none' }}>
            {STEPS.map((s) => {
              const isActive = step === s.id;
              const isVisited = visitedSteps.has(s.id) && !isActive;
              return (
                <button
                  key={s.id}
                  onClick={() => setStep(s.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium whitespace-nowrap transition-all shrink-0 ${
                    isActive
                      ? 'bg-primary text-white'
                      : isVisited
                        ? 'text-[#059669] hover:bg-[#E5E1D8]'
                        : 'text-[#8A7D6B] hover:bg-[#E5E1D8]'
                  }`}
                  style={!isActive ? { backgroundColor: 'transparent' } : undefined}
                >
                  {isVisited && !isActive && <Check size={12} className="text-[#059669]" />}
                  <span className="text-[11px] font-normal" style={{ color: isActive ? 'rgba(255,255,255,0.7)' : '#8A7D6B' }}>{s.id + 1}.</span>
                  {t ? s.labelFr : s.labelEn}
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* ─── Main Content ─── */}
      <main className="flex-1 max-w-[1100px] mx-auto w-full px-6 pt-6 pb-12">
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
              <StepData_Import customers={customers} setCustomers={setCustomers} lang={lang}
                brandAnalysis={brandAnalysis} config={config} settings={settings} onNext={goNext} />
            )}
            {step === 2 && (
              <Step1_DataSettings config={config} setConfig={setConfig}
                customers={customers} settings={settings} setSettings={setSettings}
                lang={lang} brandAnalysis={brandAnalysis} onNext={goNext} />
            )}
            {step === 3 && (
              <Step2_Missions missions={missions} setMissions={setMissions}
                customMissions={customMissions} setCustomMissions={setCustomMissions}
                tiers={tiers} customers={customers} settings={settings} config={config} lang={lang}
                burnRate={burnRate} brandAnalysis={brandAnalysis}
                referralConfig={referralConfig} setReferralConfig={setReferralConfig} onNext={goNext} />
            )}
            {step === 4 && (
              <Step3_Rewards rewards={rewards} setRewards={setRewards}
                settings={settings} config={config} lang={lang}
                brandAnalysis={brandAnalysis} customers={customers} onNext={goNext} />
            )}
            {step === 5 && (
              <Step4_TierBuilder tiers={tiers} setTiers={setTiers}
                rewards={rewards} setRewards={setRewards}
                burnRate={burnRate} setBurnRate={setBurnRate}
                customers={customers} settings={settings} config={config}
                missions={missions} customMissions={customMissions} lang={lang}
                brandAnalysis={brandAnalysis} onNext={goNext} />
            )}
            {step === 6 && (
              <Step5_Dashboard tiers={tiers} customers={customers}
                settings={settings} config={config}
                missions={missions} customMissions={customMissions}
                rewards={rewards} burnRate={burnRate} lang={lang}
                programType={brandAnalysis?.recommended_program || (config.hasMissions ? 'mid' : 'luxury')}
                brandAnalysis={brandAnalysis}
                referralConfig={referralConfig} />
            )}
          </div>
        )}
      </main>

    </div>
  );
}

export default App;
