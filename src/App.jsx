import { useState, useCallback, useEffect } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { RotateCcw, Globe, ChevronLeft, ChevronRight, Link2, Check, LogOut, Save, AlertCircle } from 'lucide-react';
import Step0_ProgramSetup from './components/Step0_ProgramSetup';
import StepData_Import from './components/StepData_Import';
import Step1_DataSettings from './components/Step1_DataSettings';
import Step2_Missions from './components/Step2_Missions';
import Step3_Rewards from './components/Step3_Rewards';
import Step4_TierBuilder from './components/Step4_TierBuilder';
import Step5_Dashboard from './components/Step5_Dashboard';
import StepReferral from './components/StepReferral';
import { parseSampleData } from './data/sampleData';
import { DEFAULT_MISSIONS, DEFAULT_REWARDS, INITIAL_REFERRAL } from './data/defaults';
import { resizeAssignedTiers, resizeMissionEngagement } from './utils/calculations';
import { applyOnboardingDefaults } from './data/onboardingPresets';
import { saveDraft, loadDraft, listDrafts } from './utils/persistence';
import { applyBrandDefaults } from './data/brandPresets';
import { applyCsmDefaults, buildCsmOnboardingAnswers } from './data/csmPresets';
import StepBrand_Analyzer from './components/StepBrand_Analyzer';
import StepCSM_Selector from './components/StepCSM_Selector';
import ProgramTypeBanner from './components/ProgramTypeBanner';
import { Building2 } from 'lucide-react';

const INITIAL_CONFIG = {
  tierBasis: 'spend',
  hasMissions: true,    // "Programme à points" — Oui/Non
  hasTiers: true,       // "Paliers VIP" — Oui/Non
  rewardType: 'both',
  // Points expiration (only meaningful when hasMissions)
  pointsExpire: true,
  expirationMonths: 12,
  expirationType: 'rolling',
  // Tier expiration / reassessment (independent of points — applies when hasTiers)
  tiersExpire: true,
  tierExpirationMonths: 12,
  tierExpirationType: 'rolling',
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
  { name: 'Bronze', color: '#B87333', threshold: 100, spendThreshold: 0, pointsThreshold: 0, orderThreshold: 0, pointsMultiplier: 1, perks: [] },
  { name: 'Argent', color: '#9CA3AF', threshold: 50, spendThreshold: 500, pointsThreshold: 1000, orderThreshold: 3, pointsMultiplier: 1.5, perks: [] },
  { name: 'Or', color: '#D97706', threshold: 15, spendThreshold: 2000, pointsThreshold: 3000, orderThreshold: 10, pointsMultiplier: 2, perks: [] },
];

const STEPS = [
  { id: 0, labelFr: 'Programme', labelEn: 'Program' },
  { id: 1, labelFr: 'Import', labelEn: 'Import' },
  { id: 2, labelFr: 'Configuration', labelEn: 'Config' },
  { id: 3, labelFr: 'Missions', labelEn: 'Missions' },
  { id: 4, labelFr: 'Parrainage', labelEn: 'Referral' },
  { id: 5, labelFr: 'Récompenses', labelEn: 'Rewards' },
  { id: 6, labelFr: 'Paliers', labelEn: 'Tiers' },
  { id: 7, labelFr: 'Dashboard', labelEn: 'Dashboard' },
];

function App() {
  // ─── Auth state ───
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('loyoly_user');
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      // Verify domain on reload
      if (!parsed.email?.endsWith('@loyoly.io')) {
        localStorage.removeItem('loyoly_user');
        return null;
      }
      return parsed;
    } catch { return null; }
  });

  const ALLOWED_DOMAIN = 'loyoly.io';
  const [loginError, setLoginError] = useState(null);

  const handleLoginSuccess = (credentialResponse) => {
    try {
      const decoded = JSON.parse(atob(credentialResponse.credential.split('.')[1]));
      // Restrict to @loyoly.io domain
      if (decoded.hd !== ALLOWED_DOMAIN) {
        setLoginError(`Accès réservé aux comptes @${ALLOWED_DOMAIN}`);
        return;
      }
      setLoginError(null);
      const userData = { name: decoded.name, email: decoded.email, picture: decoded.picture };
      setUser(userData);
      localStorage.setItem('loyoly_user', JSON.stringify(userData));
    } catch { /* invalid token */ }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('loyoly_user');
  };

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
  const [phase, setPhase] = useState('csm'); // 'csm' | 'brand' | 'wizard'
  const [brandAnalysis, setBrandAnalysis] = useState(null);
  const [visitedSteps, setVisitedSteps] = useState(new Set([0]));
  const [csmMode, setCsmMode] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientDetails, setClientDetails] = useState(null);
  const [firefliesInsights, setFirefliesInsights] = useState(null);
  const [firefliesLoading, setFirefliesLoading] = useState(false);

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

  // CSM mode handlers
  const handleHubSpotUnavailable = useCallback(() => {
    setPhase('brand'); // Fallback: skip CSM selector, go to brand analysis
  }, []);

  const handleSkipToManual = () => {
    setPhase('brand'); // Go to brand analysis
  };

  const handleCSMClientSelected = (client, details) => {
    setSelectedClient({ ...client, contacts: details.contacts || [] });
    setClientDetails(details);
    setCsmMode(true);

    // Apply CSM-inferred defaults and skip straight to Step 0 (Program Setup),
    // pre-filled with values inferred from HubSpot company data so the user
    // can adjust before continuing into the wizard.
    const company = details?.company || {};
    const defaults = applyCsmDefaults(company, lang);
    setConfig(defaults.config);
    setSettings(defaults.settings);
    setTiersRaw(defaults.tiers);
    setRewards(defaults.rewards);
    setMissions(defaults.missions);
    setBurnRate(defaults.burnRate);
    setOnboardingAnswers(buildCsmOnboardingAnswers(company));

    setPhase('wizard');
    setStep(0);
    setVisitedSteps(new Set([0]));
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
    setCsmMode(false);
    setSelectedClient(null);
    setClientDetails(null);
    setFirefliesInsights(null);
    setFirefliesLoading(false);
    setPhase('csm');
    setStep(0);
    setVisitedSteps(new Set([0]));
    // Clear recommendation dismiss flags
    for (let i = 1; i <= 7; i++) {
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

  // ── Persistence: auto-save to localStorage on every change during the wizard ──
  const [savedAt, setSavedAt] = useState(null);
  const [shareToast, setShareToast] = useState(null); // success/error toast for save ops

  useEffect(() => {
    if (phase !== 'wizard') return;
    const handle = setTimeout(() => {
      const res = saveDraft({
        config, settings, tiers, rewards, missions, customMissions,
        burnRate, referralConfig, onboardingAnswers,
        selectedClient, customers, step,
      });
      if (res.ok) setSavedAt(res.savedAt);
    }, 600); // debounce
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, config, settings, tiers, rewards, missions, customMissions,
      burnRate, referralConfig, onboardingAnswers, selectedClient, customers, step]);

  // Restore a saved draft (called from the CSM selector).
  const restoreDraft = useCallback((draft) => {
    if (!draft) return;
    setConfig(draft.config);
    setSettings(draft.settings);
    setTiersRaw(draft.tiers);
    setRewards(draft.rewards);
    setMissions(draft.missions);
    setCustomMissions(draft.customMissions || []);
    setBurnRate(draft.burnRate);
    setReferralConfig(draft.referralConfig);
    setOnboardingAnswers(draft.onboardingAnswers);
    if (draft.customers && draft.customers.length) setCustomers(draft.customers);
    if (draft.selectedClient) {
      setSelectedClient(draft.selectedClient);
      setClientDetails({ company: { name: draft.selectedClient.name, domain: draft.selectedClient.domain } });
      setCsmMode(true);
    }
    setPhase('wizard');
    setStep(draft.step ?? 1);
  }, []);

  // Force an immediate save (bypasses the 600ms debounce) and confirm via toast.
  // The auto-save useEffect already does this on every change, but the explicit
  // button gives the user a clear visual confirmation that work won't be lost.
  const forceSave = useCallback(() => {
    const res = saveDraft({
      config, settings, tiers, rewards, missions, customMissions,
      burnRate, referralConfig, onboardingAnswers,
      selectedClient, customers, step,
    });
    if (res.ok) {
      setSavedAt(res.savedAt);
      const tierCount = tiers.length;
      const custCount = customers?.length || 0;
      const msg = res.withCustomers
        ? `Brouillon enregistré · ${tierCount} paliers · ${custCount.toLocaleString('fr-FR')} clients`
        : `Brouillon enregistré · ${tierCount} paliers (clients trop volumineux, réimportez le CSV à la reprise)`;
      setShareToast({ ok: true, message: msg });
    } else {
      setShareToast({ ok: false, message: 'Échec de l\'enregistrement — espace navigateur plein ?' });
    }
    setTimeout(() => setShareToast(null), 4000);
  }, [config, settings, tiers, rewards, missions, customMissions, burnRate, referralConfig, onboardingAnswers, selectedClient, customers, step]);

  // Smooth scroll the page back to the top so the new step's title is visible.
  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const goNext = useCallback(() => {
    setStep(s => Math.min(STEPS.length - 1, s + 1));
    requestAnimationFrame(scrollToTop);
  }, [scrollToTop]);

  const goPrev = useCallback(() => {
    setStep(s => Math.max(0, s - 1));
    requestAnimationFrame(scrollToTop);
  }, [scrollToTop]);

  // Step navigation is click-only (Précédent / Suivant buttons + tabs).
  // Earlier prototype with wheel-driven advance was removed — it conflicted
  // with normal page scroll on long steps (Dashboard, TierBuilder).

  const copyShareableLink = () => {
    const state = { config, settings, tiers, onboardingAnswers };
    const encoded = btoa(JSON.stringify(state));
    const url = `${window.location.origin}${window.location.pathname}?state=${encoded}`;
    navigator.clipboard.writeText(url);
  };

  const t = lang === 'fr';
  const clientName = csmMode ? (selectedClient?.name || selectedClient?.company?.name || null) : null;

  // ─── Login gate ───
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: '#EEEDE6' }}>
        <div className="flex flex-col items-center gap-8 p-10 rounded-2xl" style={{ backgroundColor: '#fff', boxShadow: '0 2px 16px rgba(0,0,0,0.08)', maxWidth: 400, width: '100%' }}>
          <div className="flex flex-col items-center gap-3">
            <img src="/loyoly-logo.svg" alt="Loyoly" style={{ height: 40 }} />
            <h1 className="text-[22px] font-bold" style={{ color: '#2B251F' }}>VIP Tiers Calculator</h1>
            <p className="text-[13px] text-center" style={{ color: '#8A7D6B' }}>
              Connectez-vous pour accéder à l'outil
            </p>
          </div>
          <GoogleLogin
            onSuccess={handleLoginSuccess}
            onError={() => setLoginError('Erreur de connexion Google')}
            theme="outline"
            size="large"
            width="320"
            text="signin_with"
            shape="rectangular"
            hosted_domain="loyoly.io"
          />
          {loginError && (
            <p className="text-[13px] text-red-600 text-center">{loginError}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* ─── Navbar ─── */}
      <header className="sticky top-0 z-40" style={{ height: 60, backgroundColor: '#2B251F' }}>
        <div className="max-w-[1400px] mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/loyoly-logo.svg" alt="Loyoly" style={{ height: 28, filter: 'brightness(0) invert(1)' }} />
            <span className="text-[15px] font-bold text-white">VIP Tiers Calculator</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={copyShareableLink}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all"
              title={t ? 'Copier le lien' : 'Copy link'}>
              <Link2 size={15} />
            </button>
            <button onClick={() => setLang(l => l === 'fr' ? 'en' : 'fr')}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all">
              <Globe size={15} />
            </button>
            <button onClick={reset}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-white/60 hover:text-red-400 hover:bg-white/10 transition-all">
              <RotateCcw size={15} />
            </button>
            {/* User avatar + logout */}
            <div className="flex items-center gap-2 ml-2 pl-2" style={{ borderLeft: '1px solid rgba(255,255,255,0.12)' }}>
              {user.picture && (
                <img src={user.picture} alt="" className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
              )}
              <span className="text-[12px] text-white/70 hidden sm:inline">{user.name?.split(' ')[0]}</span>
              <button onClick={handleLogout}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all"
                title="Déconnexion">
                <LogOut size={13} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ─── CSM Client banner ─── */}
      {phase === 'wizard' && csmMode && selectedClient && (
        <div style={{ backgroundColor: '#E8EFFE', borderBottom: '1px solid #E5E1D8' }}>
          <div className="max-w-[1400px] mx-auto px-6 py-2.5 flex items-center gap-4 text-[12px]">
            <Building2 size={14} className="text-primary shrink-0" />
            <span className="section-subheader" style={{ marginBottom: 0, fontSize: 10 }}>CLIENT</span>
            <span className="text-[#2B251F] font-semibold whitespace-nowrap">{selectedClient.name}</span>
            {selectedClient.domain && (
              <>
                <span className="text-[#B0A595]">|</span>
                <span className="text-[#52473C] whitespace-nowrap">{selectedClient.domain}</span>
              </>
            )}
            {selectedClient.plan && (
              <>
                <span className="text-[#B0A595]">|</span>
                <span className="pill pill-purple text-[10px]">{selectedClient.plan}</span>
              </>
            )}
            <div className="ml-auto flex items-center gap-3">
              {savedAt && (
                <span className="text-[11px] text-[#059669] inline-flex items-center gap-1" title={t ? 'Brouillon enregistré automatiquement dans ce navigateur' : 'Draft auto-saved in this browser'}>
                  <Check size={12} /> {t ? 'Enregistré' : 'Saved'} {new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <button onClick={forceSave} className="text-primary font-medium hover:underline text-[12px] inline-flex items-center gap-1"
                title={t ? "Sauvegarde immédiate dans ce navigateur (survit à la fermeture)" : 'Immediate save in this browser (survives closing)'}>
                <Save size={12} /> {t ? 'Enregistrer' : 'Save'}
              </button>
              <button onClick={() => { setCsmMode(false); setSelectedClient(null); setClientDetails(null); setFirefliesInsights(null); setPhase('csm'); }}
                className="text-primary font-medium hover:underline text-[12px]">
                {t ? 'Changer de client' : 'Change client'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Program type / Onboarding banner ─── */}
      {phase === 'wizard' && step > 1 && !csmMode && brandAnalysis && (
        <ProgramTypeBanner
          programType={brandAnalysis.recommended_program}
          brandName={brandAnalysis.brand_name}
          brandLogo={brandAnalysis.brand_logo}
          lang={lang}
          onEdit={() => { setPhase('brand'); }}
        />
      )}
      {phase === 'wizard' && step > 1 && !csmMode && !brandAnalysis && onboardingAnswers && (
        <div style={{ backgroundColor: '#E8EFFE', borderBottom: '1px solid #E5E1D8' }}>
          <div className="max-w-[1400px] mx-auto px-6 py-2.5 flex items-center gap-4 text-[12px]">
            <span className="section-subheader" style={{ marginBottom: 0, fontSize: 10 }}>{t ? 'PROGRAMME' : 'PROGRAM'}</span>
            <span className="text-[#52473C] whitespace-nowrap">{onboardingAnswers.industry}</span>
            <span className="text-[#B0A595]">|</span>
            <span className="text-[#52473C] whitespace-nowrap">{onboardingAnswers.priceRange}</span>
            <span className="text-[#B0A595]">|</span>
            <span className="text-[#52473C] whitespace-nowrap">{onboardingAnswers.goals?.join(', ')}</span>
            <div className="ml-auto flex items-center gap-3">
              {savedAt && (
                <span className="text-[11px] text-[#059669] inline-flex items-center gap-1">
                  <Check size={12} /> {t ? 'Enregistré' : 'Saved'} {new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <button onClick={forceSave} className="text-primary font-medium hover:underline text-[12px] inline-flex items-center gap-1"
                title={t ? "Sauvegarde immédiate dans ce navigateur (survit à la fermeture)" : 'Immediate save in this browser (survives closing)'}>
                <Save size={12} /> {t ? 'Enregistrer' : 'Save'}
              </button>
              <button onClick={() => setStep(0)} className="text-primary font-medium hover:underline text-[12px]">
                {t ? 'Modifier' : 'Edit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating toast (save confirmations, errors) */}
      {shareToast && (
        <div className="fixed top-4 right-4 z-50 toast-enter">
          <div
            className="flex items-center gap-3 pl-3 pr-4 py-2.5 rounded-[10px] bg-white border border-[#E5E1D8] text-[13px] font-medium text-[#2B251F] max-w-[420px]"
            style={{
              borderLeft: `3px solid ${shareToast.ok ? '#059669' : '#DC2626'}`,
              boxShadow: '0 12px 24px -6px rgba(15,15,15,0.18)',
            }}
          >
            <span className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${shareToast.ok ? 'bg-[#ECFDF5] text-[#059669]' : 'bg-[#FEF2F2] text-[#DC2626]'}`}>
              {shareToast.ok ? <Check size={13} strokeWidth={2.5} /> : <AlertCircle size={13} />}
            </span>
            <span>{shareToast.message}</span>
          </div>
        </div>
      )}

      {/* ─── Step Tabs (underline indicator + progress bar) ─── */}
      {phase === 'wizard' && (
        <nav className="sticky top-[61px] z-30 relative" style={{ backgroundColor: '#F5F4F0', borderBottom: '1px solid #E5E1D8' }}>
          <div className="max-w-[1400px] mx-auto px-6 flex items-center gap-1 overflow-x-auto tier-scroll" style={{ scrollbarWidth: 'none' }}>
            {STEPS.map((s) => {
              const isActive = step === s.id;
              const isVisited = visitedSteps.has(s.id) && !isActive;
              return (
                <button
                  key={s.id}
                  onClick={() => setStep(s.id)}
                  className={`relative flex items-center gap-1.5 px-3.5 py-3 text-[13px] whitespace-nowrap transition-colors shrink-0 ${
                    isActive
                      ? 'text-[#2B251F] font-semibold'
                      : isVisited
                        ? 'text-[#059669] font-medium'
                        : 'text-[#8A7D6B] font-medium hover:text-[#52473C]'
                  }`}
                >
                  {isVisited && !isActive && <Check size={12} />}
                  <span className="text-[11px] font-normal opacity-60">{s.id + 1}.</span>
                  {t ? s.labelFr : s.labelEn}
                  {isActive && (
                    <span className="absolute left-3.5 right-3.5 -bottom-px h-[2px] bg-primary rounded-sm" />
                  )}
                </button>
              );
            })}
          </div>
          {/* Subtle progression bar — fills as more steps are visited */}
          <div
            className="absolute bottom-0 left-0 h-[2px] bg-primary/40 transition-all duration-300 pointer-events-none"
            style={{ width: `${Math.min(100, (visitedSteps.size / STEPS.length) * 100)}%` }}
          />
        </nav>
      )}

      {/* ─── Main Content ─── */}
      <main className="flex-1 max-w-[1400px] mx-auto w-full px-6 pt-6 pb-12">
        {phase === 'csm' ? (
          <StepCSM_Selector
            lang={lang}
            onClientSelected={handleCSMClientSelected}
            onSkipToManual={handleSkipToManual}
            onHubSpotUnavailable={handleHubSpotUnavailable}
            onResumeDraft={restoreDraft}
          />
        ) : phase === 'brand' ? (
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
                brandAnalysis={brandAnalysis} config={config} settings={settings}
                onPrev={goPrev} onNext={goNext} />
            )}
            {step === 2 && (
              <Step1_DataSettings config={config} setConfig={setConfig}
                customers={customers} settings={settings} setSettings={setSettings}
                lang={lang} brandAnalysis={brandAnalysis} clientName={clientName}
                onboardingAnswers={onboardingAnswers}
                onPrev={goPrev} onNext={goNext} />
            )}
            {step === 3 && (
              <Step2_Missions missions={missions} setMissions={setMissions}
                customMissions={customMissions} setCustomMissions={setCustomMissions}
                tiers={tiers} customers={customers} settings={settings} config={config} lang={lang}
                onPrev={goPrev} onNext={goNext} />
            )}
            {step === 4 && (
              <div className="space-y-3">
                <div>
                  <div className="section-subheader">{lang === 'fr' ? 'ÉTAPE 5' : 'STEP 5'}</div>
                  <h2 className="text-[28px] font-bold text-[#52473C]">{lang === 'fr' ? 'Parrainage' : 'Referral'}</h2>
                  <p className="text-[15px] text-[#645648] mt-0.5">
                    {lang === 'fr'
                      ? 'Configurez les incentives parrain/filleul et estimez le ROI.'
                      : 'Configure referrer/referee incentives and estimate ROI.'}
                  </p>
                </div>
                <StepReferral referralConfig={referralConfig} setReferralConfig={setReferralConfig}
                  lang={lang} aov={settings.aov}
                  customers={customers}
                  industry={onboardingAnswers?.industry || brandAnalysis?.industry} />
                <div className="flex justify-between pt-6">
                  <button onClick={goPrev} className="btn-secondary">
                    <ChevronLeft size={16} /> {lang === 'fr' ? 'Précédent' : 'Previous'}
                  </button>
                  <button onClick={goNext} className="btn-primary">
                    {lang === 'fr' ? 'Suivant' : 'Next'} <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
            {step === 5 && (
              <Step3_Rewards rewards={rewards} setRewards={setRewards}
                settings={settings} config={config} lang={lang}
                brandAnalysis={brandAnalysis} clientName={clientName} customers={customers}
                onPrev={goPrev} onNext={goNext} />
            )}
            {step === 6 && (
              <Step4_TierBuilder tiers={tiers} setTiers={setTiers}
                rewards={rewards} setRewards={setRewards}
                burnRate={burnRate} setBurnRate={setBurnRate}
                customers={customers} settings={settings} config={config}
                missions={missions} customMissions={customMissions} lang={lang}
                brandAnalysis={brandAnalysis} clientName={clientName}
                onPrev={goPrev} onNext={goNext} />
            )}
            {step === 7 && (
              <Step5_Dashboard tiers={tiers} customers={customers}
                settings={settings} config={config}
                missions={missions} customMissions={customMissions}
                rewards={rewards} burnRate={burnRate} lang={lang}
                programType={brandAnalysis?.recommended_program || (config.hasMissions ? 'mid' : 'luxury')}
                brandAnalysis={brandAnalysis} clientName={clientName}
                referralConfig={referralConfig}
                onPrev={goPrev} />
            )}
          </div>
        )}
      </main>

    </div>
  );
}

export default App;
