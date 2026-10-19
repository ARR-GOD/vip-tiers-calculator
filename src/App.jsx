import { useState, useCallback, useEffect } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { FolderOpen, Globe, ChevronLeft, ChevronRight, Link2, Check, LogOut, Save, AlertCircle, Loader2, Send } from 'lucide-react';
import Step0_ProgramSetup from './components/Step0_ProgramSetup';
import StepData_Import from './components/StepData_Import';
import Step1_DataSettings from './components/Step1_DataSettings';
import Step2_Missions from './components/Step2_Missions';
import Step3_Rewards from './components/Step3_Rewards';
import Step4_TierBuilder from './components/Step4_TierBuilder';
import Step5_Dashboard from './components/Step5_Dashboard';
import StepReferral from './components/StepReferral';
import { parseSampleData } from './data/sampleData';
import { INITIAL_REFERRAL } from './data/defaults';
import { normalizeProgram } from './data/programDefaults';
import { resizeAssignedTiers } from './utils/calculations';
import { applyOnboardingDefaults } from './data/onboardingPresets';
import { createProgramSaver, buildProgramSnapshot, programClientFields, listCompanyPrograms, loadProgram, migrateProgramState, STATE_VERSION, DEFAULT_PROGRAM_NAME } from './utils/programStore';
import { folderKeyOf } from './utils/clientFolders';
import { supabase, apiFetch, ALLOWED_DOMAIN, isLoyolyEmail } from './lib/supabase';
import { applyBrandDefaults } from './data/brandPresets';
import { applyCsmDefaults, buildCsmOnboardingAnswers } from './data/csmPresets';
import StepBrand_Analyzer from './components/StepBrand_Analyzer';
import StepCSM_Selector from './components/StepCSM_Selector';
import ClientSpace from './components/ClientSpace';
import ClientFolder from './components/ClientFolder';
import ProgramTypeBanner from './components/ProgramTypeBanner';
import SaveStatus from './components/SaveStatus';
import CommentsPanel, { CommentsButton } from './components/CommentsPanel';
import { buildClientView, hasUnpublishedChanges, PAGE_OF_STEP, STEP_OF_PAGE } from './utils/clientView';
import { publishProgram, countToHandleByPage } from './utils/clientPortalStore';
import { useProgramComments } from './utils/useProgramComments';
import { Building2 } from 'lucide-react';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

// Program the wizard starts from before any preset is applied.
const BLANK_PROGRAM = normalizeProgram();

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
  // CSMs sign in with Google (@loyoly.io only). The Google ID token is then
  // exchanged for a Supabase session, which gives access to the shared
  // programs table and is forwarded to the /api functions.
  const [session, setSession] = useState(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [loginError, setLoginError] = useState(null);

  useEffect(() => {
    if (!supabase) return;
    const accept = (s) => {
      if (s && !isLoyolyEmail(s.user?.email)) {
        setLoginError(`Accès réservé aux comptes @${ALLOWED_DOMAIN}`);
        // Supabase calls must not be awaited inside the auth callback.
        setTimeout(() => supabase.auth.signOut(), 0);
        return null;
      }
      return s;
    };
    supabase.auth.getSession().then(({ data }) => {
      setSession(accept(data.session));
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(accept(s)));
    return () => sub.subscription.unsubscribe();
  }, []);

  const meta = session?.user?.user_metadata || {};
  const user = session?.user
    ? { name: meta.full_name || meta.name || session.user.email, email: session.user.email, picture: meta.avatar_url || meta.picture }
    : null;

  const handleLoginSuccess = async (credentialResponse) => {
    setLoginError(null);
    try {
      const credential = credentialResponse.credential;
      const decoded = JSON.parse(atob(credential.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      // Restrict to @loyoly.io domain
      if (decoded.hd !== ALLOWED_DOMAIN) {
        setLoginError(`Accès réservé aux comptes @${ALLOWED_DOMAIN}`);
        return;
      }
      const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: credential });
      if (error) setLoginError(`Connexion impossible : ${error.message}`);
    } catch {
      setLoginError('Erreur de connexion Google');
    }
  };

  const [lang, setLang] = useState('fr');
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState(BLANK_PROGRAM.config);
  const [settings, setSettings] = useState(BLANK_PROGRAM.settings);
  const [customers, setCustomers] = useState(() => parseSampleData());
  const [tiers, setTiersRaw] = useState(BLANK_PROGRAM.tiers);
  const [missions, setMissions] = useState(BLANK_PROGRAM.missions);
  const [customMissions, setCustomMissions] = useState(BLANK_PROGRAM.customMissions);
  const [rewards, setRewards] = useState(BLANK_PROGRAM.rewards);
  const [burnRate, setBurnRate] = useState(BLANK_PROGRAM.burnRate);
  const [referralConfig, setReferralConfig] = useState(BLANK_PROGRAM.referralConfig);
  const [onboardingAnswers, setOnboardingAnswers] = useState(null);
  const [phase, setPhase] = useState('clients'); // 'clients' | 'folder' | 'csm' | 'brand' | 'wizard'
  const [folderKey, setFolderKey] = useState(null); // client folder shown in the 'folder' phase
  const [brandAnalysis, setBrandAnalysis] = useState(null);
  const [visitedSteps, setVisitedSteps] = useState(new Set([0]));
  const [csmMode, setCsmMode] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);

  // ─── Program persistence (Supabase) ───
  // programTarget is the handle of the open program: { id, hubspotCompanyId, name },
  // null while none is open. Its id is filled in by the first save.
  const [programTarget, setProgramTarget] = useState(null);
  // What the client portal shows of the open program: { version, at, view }, null until published.
  const [publication, setPublication] = useState(null);
  const [publishing, setPublishing] = useState(false);
  // Client comments of the open program (CSM side panel).
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentsPage, setCommentsPage] = useState('missions');
  const { comments: programComments, error: commentsError, reload: reloadComments } =
    useProgramComments(phase === 'wizard' ? programTarget?.id : null, user?.email);
  const toHandleByPage = countToHandleByPage(programComments);
  const toHandleTotal = Object.values(toHandleByPage).reduce((s, n) => s + n, 0);
  const [saveState, setSaveState] = useState({ status: 'idle', savedAt: null, error: null });
  const [saver] = useState(() => createProgramSaver({ onChange: setSaveState }));

  // A new program starts clean: nothing from the previously opened brand
  // (imported customers, custom missions, referral) carries over.
  const startNewProgram = (hubspotCompanyId = null, name = DEFAULT_PROGRAM_NAME) => {
    setProgramTarget({ id: null, hubspotCompanyId, name });
    setPublication(null);
    setCustomers(parseSampleData());
    setCustomMissions([]);
    setReferralConfig(INITIAL_REFERRAL);
  };

  const setTiers = (newTiersOrFn) => {
    setTiersRaw(prev => {
      const newTiers = typeof newTiersOrFn === 'function' ? newTiersOrFn(prev) : newTiersOrFn;
      if (newTiers.length !== prev.length) {
        setRewards(r => resizeAssignedTiers(r, newTiers.length));
      }
      return newTiers;
    });
  };

  // Load the program-level values of a normalized program into the wizard.
  const applyProgram = (program) => {
    setConfig(program.config);
    setSettings(program.settings);
    setTiersRaw(program.tiers);
    setRewards(program.rewards);
    setMissions(program.missions);
    setCustomMissions(program.customMissions);
    setBurnRate(program.burnRate);
    setReferralConfig(program.referralConfig);
  };

  // Re-running the brand analysis from an open program keeps that program.
  const handleBrandComplete = (analysisResult) => {
    if (!programTarget) startNewProgram();
    setBrandAnalysis(analysisResult);
    applyProgram(applyBrandDefaults(analysisResult, lang));
    setPhase('wizard');
    setStep(1); // Go to CSV import step
  };

  const handleBrandSkip = () => {
    if (!programTarget) startNewProgram();
    setBrandAnalysis(null);
    setPhase('wizard');
    setStep(0); // Go to manual onboarding
  };

  // CSM mode handlers
  const handleSkipToManual = () => {
    setProgramTarget(null);
    setPhase('brand'); // Go to brand analysis
  };

  // Load a saved program into the wizard.
  const openProgram = (row) => {
    const savedVersion = row.state?.v ?? 1;
    const values = {
      ...normalizeProgram(migrateProgramState(row.state || {})),
      customers: row.customers?.length ? row.customers : parseSampleData(),
      selectedClient: row.hubspot_company_id
        ? { id: row.hubspot_company_id, name: row.client_name, domain: row.client_domain, plan: row.client_plan }
        : null,
      step: row.step ?? 1,
    };
    const target = { id: row.id, hubspotCompanyId: row.hubspot_company_id, name: row.program_name };

    applyProgram(values);
    setOnboardingAnswers(values.onboardingAnswers);
    setBrandAnalysis(values.brandAnalysis);
    setCustomers(values.customers);
    setSelectedClient(values.selectedClient);
    setCsmMode(!!values.selectedClient);
    setProgramTarget(target);
    setPhase('wizard');
    setStep(values.step);
    setVisitedSteps(new Set([values.step]));
    // This is what the database already holds: nothing to write back —
    // unless it was stored in an older format, which gets rewritten.
    if (savedVersion >= STATE_VERSION) saver.markSaved(buildProgramSnapshot(target, values));
    setPublication(row.published_version > 0
      ? { version: row.published_version, at: row.published_at, view: row.published_view }
      : null);
  };

  // `commentsPage` opens the program on that page's step, comments panel open.
  const handleOpenProgram = async (programId, { commentsPage: page } = {}) => {
    openProgram(await loadProgram(programId));
    if (page) {
      setStep(STEP_OF_PAGE[page]);
      setCommentsPage(page);
      setCommentsOpen(true);
    }
  };

  // A client that already has a folder opens it; otherwise its first program
  // starts. Throws when Supabase can't be reached: the selector then shows the
  // error rather than starting a second folder for this client.
  const handleCSMClientSelected = async (client, details) => {
    const existing = await listCompanyPrograms(client.id);
    if (existing.length > 0) {
      openFolder(`hs:${client.id}`);
      return;
    }
    startCsmProgram(client, details, DEFAULT_PROGRAM_NAME);
  };

  // New program for a HubSpot client: CSM-inferred defaults, then Step 0
  // (Program Setup) pre-filled from the HubSpot company data.
  const startCsmProgram = (client, details, name) => {
    startNewProgram(String(client.id), name);
    setBrandAnalysis(null);
    setSelectedClient(client);
    setCsmMode(true);
    const company = details?.company || {};
    applyProgram(applyCsmDefaults(company, lang));
    setOnboardingAnswers(buildCsmOnboardingAnswers(company));
    setPhase('wizard');
    setStep(0);
    setVisitedSteps(new Set([0]));
  };

  // "Nouveau programme" in a client folder.
  const handleNewProgramInFolder = async (folder, name) => {
    if (folder.hubspotCompanyId) {
      const client = { id: folder.hubspotCompanyId, name: folder.name, domain: folder.domain, plan: folder.plan };
      // HubSpot details refine the defaults; without them the program starts from generic ones.
      const details = await apiFetch(`/api/hubspot-client-details?companyId=${client.id}`)
        .then(res => (res.ok ? res.json() : {}))
        .catch(() => ({}));
      startCsmProgram(client, details, name);
      return;
    }
    // Outside HubSpot: start again from the brand analysis of the folder's latest program.
    const latest = await loadProgram(folder.programs[0].id);
    const analysis = latest.state?.brandAnalysis || null;
    const firstStep = analysis ? 1 : 0;
    startNewProgram(null, name);
    setSelectedClient(null);
    setCsmMode(false);
    setOnboardingAnswers(null);
    setBrandAnalysis(analysis);
    applyProgram(analysis ? applyBrandDefaults(analysis, lang) : BLANK_PROGRAM);
    setPhase('wizard');
    setStep(firstStep);
    setVisitedSteps(new Set([firstStep]));
  };

  const handleStep0Complete = (answers) => {
    setOnboardingAnswers(answers);
    applyProgram(applyOnboardingDefaults(answers, lang));
    setStep(1); // Go to CSV import step
  };

  // Close the open program once its pending edits reach the database; the
  // wizard is cleared so nothing carries over to the next program.
  const closeProgram = async () => {
    await saver.flush();
    setProgramTarget(null);
    setPublication(null);
    setCommentsOpen(false);
    applyProgram(BLANK_PROGRAM);
    setCustomers(parseSampleData());
    setOnboardingAnswers(null);
    setBrandAnalysis(null);
    setCsmMode(false);
    setSelectedClient(null);
    setStep(0);
    setVisitedSteps(new Set([0]));
  };

  const openFolder = (key) => {
    setFolderKey(key);
    setPhase('folder');
  };

  const goToClientSpace = async () => {
    if (programTarget) await closeProgram();
    setPhase('clients');
  };

  // Back from the wizard to the folder of the open program.
  const leaveProgram = async () => {
    const key = folderKeyOf({
      hubspot_company_id: programTarget?.hubspotCompanyId,
      ...programClientFields({ selectedClient, brandAnalysis }),
    });
    await closeProgram();
    openFolder(key);
  };

  // Track visited steps (updated during render when a new step is shown).
  if (phase === 'wizard' && !visitedSteps.has(step)) {
    setVisitedSteps(new Set([...visitedSteps, step]));
  }

  // ── Persistence: every change of the open program is saved to Supabase ──
  const [shareToast, setShareToast] = useState(null); // success/error toast for save ops

  // The saver debounces (600 ms), serializes and retries the writes.
  useEffect(() => {
    if (phase !== 'wizard' || !programTarget) return;
    saver.schedule(buildProgramSnapshot(programTarget, {
      config, settings, tiers, rewards, missions, customMissions,
      burnRate, referralConfig, onboardingAnswers, brandAnalysis,
      selectedClient, customers, step,
    }));
  }, [saver, phase, programTarget, config, settings, tiers, rewards, missions, customMissions,
      burnRate, referralConfig, onboardingAnswers, brandAnalysis, selectedClient, customers, step]);

  // Write immediately when the tab is hidden, and ask before closing it while
  // a change hasn't reached the database yet.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') saver.flush();
    };
    const onBeforeUnload = (e) => {
      if (!saver.hasUnsaved()) return;
      saver.flush();
      e.preventDefault();
      e.returnValue = '';
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [saver]);

  // Explicit save button: writes right away and confirms via toast.
  const forceSave = useCallback(async () => {
    const ok = await saver.flush();
    if (ok) {
      const custCount = customers?.length || 0;
      setShareToast({ ok: true, message: `Programme enregistré · ${tiers.length} paliers · ${custCount.toLocaleString('fr-FR')} clients` });
    } else {
      setShareToast({ ok: false, message: 'Échec de l\'enregistrement — nouvelle tentative automatique dans quelques secondes' });
    }
    setTimeout(() => setShareToast(null), 4000);
  }, [saver, tiers.length, customers]);

  // ── Client portal: the program as the client sees it, and its publication ──
  const clientView = phase === 'wizard' && programTarget
    ? buildClientView({ config, settings, tiers, rewards, missions, customMissions, referralConfig }, {
      clientName: programClientFields({ selectedClient, brandAnalysis }).client_name,
      brandLogo: brandAnalysis?.brand_logo || null,
    })
    : null;
  const unpublishedChanges = !!clientView && hasUnpublishedChanges(clientView, publication?.view);
  // The panel opens on the current step's page, else where the client wrote.
  const openComments = () => {
    setCommentsPage(PAGE_OF_STEP[step] || Object.keys(toHandleByPage)[0] || 'missions');
    setCommentsOpen(true);
  };

  const publishForClient = async () => {
    setPublishing(true);
    try {
      await saver.flush(); // the first save creates the row that gets published
      if (!programTarget.id) throw new Error(t ? 'programme pas encore enregistré' : 'program not saved yet');
      const version = await publishProgram(programTarget.id, clientView);
      setPublication({ version, at: new Date().toISOString(), view: clientView });
      setShareToast({ ok: true, message: t ? `Version ${version} publiée pour le client` : `Version ${version} published for the client` });
    } catch (err) {
      setShareToast({ ok: false, message: `${t ? 'Échec de la publication' : 'Publication failed'} : ${err.message}` });
    }
    setPublishing(false);
    setTimeout(() => setShareToast(null), 4000);
  };

  const handleLogout = async () => {
    await saver.flush();
    await supabase.auth.signOut();
  };

  // Smooth scroll the page back to the top so the new step's title is visible.
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goNext = () => {
    setStep(s => Math.min(STEPS.length - 1, s + 1));
    requestAnimationFrame(scrollToTop);
  };

  const goPrev = () => {
    setStep(s => Math.max(0, s - 1));
    requestAnimationFrame(scrollToTop);
  };

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

  // ─── Configuration / login gate ───
  if (!supabase || !GOOGLE_CLIENT_ID) {
    const missing = [
      !import.meta.env.VITE_SUPABASE_URL && 'VITE_SUPABASE_URL',
      !import.meta.env.VITE_SUPABASE_ANON_KEY && 'VITE_SUPABASE_ANON_KEY',
      !GOOGLE_CLIENT_ID && 'VITE_GOOGLE_CLIENT_ID',
    ].filter(Boolean);
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#EEEDE6' }}>
        <div className="card max-w-md text-center">
          <AlertCircle size={28} className="mx-auto text-red-500 mb-3" />
          <h1 className="text-[18px] font-bold text-[#52473C] mb-2">Configuration incomplète</h1>
          <p className="text-[13px] text-[#645648]">
            Variables d'environnement manquantes : <code>{missing.join(', ')}</code>
          </p>
        </div>
      </div>
    );
  }

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EEEDE6' }}>
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ backgroundColor: '#EEEDE6' }}>
        <div className="flex flex-col items-center gap-8 p-10 rounded-2xl" style={{ backgroundColor: '#fff', boxShadow: '0 2px 16px rgba(0,0,0,0.08)', maxWidth: 400, width: '100%' }}>
          <div className="flex flex-col items-center gap-3">
            <img src="/loyoly-logo.svg" alt="Loyoly" style={{ height: 40 }} />
            <h1 className="text-[22px] font-bold" style={{ color: '#2B251F' }}>Loyoly Setup</h1>
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
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={goToClientSpace} className="flex items-center gap-3 shrink-0" title={t ? 'Espace clients' : 'Client space'}>
              <img src="/loyoly-logo.svg" alt="Loyoly" style={{ height: 28, filter: 'brightness(0) invert(1)' }} />
              <span className="text-[15px] font-bold text-white">Loyoly Setup</span>
            </button>
            {/* Breadcrumb of the open program: client folder › program */}
            {phase === 'wizard' && programTarget && (
              <div className="hidden md:flex items-center gap-2 text-[13px] text-white/50 min-w-0">
                <ChevronRight size={13} className="shrink-0" />
                <button onClick={leaveProgram} className="text-white/80 hover:text-white truncate">
                  {programClientFields({ selectedClient, brandAnalysis }).client_name}
                </button>
                <ChevronRight size={13} className="shrink-0" />
                <span className="text-white font-medium truncate">{programTarget.name}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            {phase === 'wizard' && programTarget && (
              <div className="flex items-center gap-2 mr-2">
                <span className="text-[12px] text-white/60 hidden lg:inline" data-testid="publication-status">
                  {!publication
                    ? (t ? 'Non publié' : 'Not published')
                    : unpublishedChanges
                      ? (t ? `v${publication.version} · modifications non publiées` : `v${publication.version} · unpublished changes`)
                      : (t ? `v${publication.version} publiée` : `v${publication.version} published`)}
                </span>
                <button onClick={publishForClient} disabled={publishing || (publication && !unpublishedChanges)}
                  className="h-8 px-3 rounded-lg text-[12px] font-medium text-white bg-white/10 hover:bg-white/20 transition-all inline-flex items-center gap-1.5 disabled:opacity-40"
                  title={t ? 'Rendre cette version visible dans l\'espace client' : 'Make this version visible in the client portal'}>
                  {publishing ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                  {publication ? (t ? 'Publier la mise à jour' : 'Publish update') : (t ? 'Publier pour le client' : 'Publish for the client')}
                </button>
              </div>
            )}
            {phase === 'wizard' && programTarget && <SaveStatus saveState={saveState} lang={lang} />}
            <button onClick={copyShareableLink}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all"
              title={t ? 'Copier le lien' : 'Copy link'}>
              <Link2 size={15} />
            </button>
            <button onClick={() => setLang(l => l === 'fr' ? 'en' : 'fr')}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all">
              <Globe size={15} />
            </button>
            <button onClick={goToClientSpace} title={t ? 'Espace clients' : 'Client space'}
              className="w-9 h-9 flex items-center justify-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all">
              <FolderOpen size={15} />
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
            {programTarget?.name && (
              <>
                <span className="text-[#B0A595]">|</span>
                <span className="text-[#52473C] whitespace-nowrap">{programTarget.name}</span>
              </>
            )}
            <div className="ml-auto flex items-center gap-3">
              <button onClick={forceSave} className="text-primary font-medium hover:underline text-[12px] inline-flex items-center gap-1"
                title={t ? 'Enregistrer immédiatement en base (partagé avec l\'équipe)' : 'Save to the database now (shared with the team)'}>
                <Save size={12} /> {t ? 'Enregistrer' : 'Save'}
              </button>
              <button onClick={leaveProgram}
                className="text-primary font-medium hover:underline text-[12px]">
                {t ? 'Dossier client' : 'Client folder'}
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
              <button onClick={forceSave} className="text-primary font-medium hover:underline text-[12px] inline-flex items-center gap-1"
                title={t ? 'Enregistrer immédiatement en base (partagé avec l\'équipe)' : 'Save to the database now (shared with the team)'}>
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
                  {toHandleByPage[PAGE_OF_STEP[s.id]] > 0 && (
                    <span className="px-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold"
                      title={t ? 'Commentaires client à traiter' : 'Client comments to handle'}>
                      {toHandleByPage[PAGE_OF_STEP[s.id]]}
                    </span>
                  )}
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
      {phase === 'wizard' && programTarget?.id && (
        <>
          <CommentsButton lang={lang} count={toHandleTotal} onClick={openComments} />
          {commentsOpen && (
            <CommentsPanel lang={lang} programId={programTarget.id} comments={programComments}
              error={commentsError} reload={reloadComments} page={commentsPage} onPageChange={setCommentsPage}
              view={clientView} user={user} onClose={() => setCommentsOpen(false)} />
          )}
        </>
      )}

      <main className="flex-1 max-w-[1400px] mx-auto w-full px-6 pt-6 pb-24">
        {phase === 'clients' ? (
          <ClientSpace
            lang={lang}
            userEmail={user.email}
            onOpenFolder={openFolder}
            onNewClient={() => setPhase('csm')}
            onManual={handleSkipToManual}
          />
        ) : phase === 'folder' ? (
          <ClientFolder
            lang={lang}
            folderKey={folderKey}
            onBack={() => setPhase('clients')}
            onOpenProgram={handleOpenProgram}
            onNewProgram={handleNewProgramInFolder}
          />
        ) : phase === 'csm' ? (
          <StepCSM_Selector
            lang={lang}
            onClientSelected={handleCSMClientSelected}
            onSkipToManual={handleSkipToManual}
            onBack={() => setPhase('clients')}
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
                lang={lang} brandAnalysis={brandAnalysis}
                onboardingAnswers={onboardingAnswers}
                onPrev={goPrev} onNext={goNext} />
            )}
            {step === 3 && (
              <Step2_Missions missions={missions} setMissions={setMissions}
                customMissions={customMissions} setCustomMissions={setCustomMissions}
                tiers={tiers} customers={customers} settings={settings} setSettings={setSettings}
                config={config} lang={lang}
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
                tiers={tiers} settings={settings} lang={lang}
                burnRate={burnRate} setBurnRate={setBurnRate}
                onPrev={goPrev} onNext={goNext} />
            )}
            {step === 6 && (
              <Step4_TierBuilder tiers={tiers} setTiers={setTiers}
                rewards={rewards} setRewards={setRewards}
                customers={customers} settings={settings} config={config} lang={lang}
                onPrev={goPrev} onNext={goNext} />
            )}
            {step === 7 && (
              <Step5_Dashboard tiers={tiers} customers={customers}
                settings={settings} setSettings={setSettings} config={config}
                missions={missions} customMissions={customMissions}
                rewards={rewards} burnRate={burnRate} lang={lang}
                referralConfig={referralConfig}
                clientName={selectedClient?.name || brandAnalysis?.brand_name}
                author={user.name}
                onPrev={goPrev} />
            )}
          </div>
        )}
      </main>

    </div>
  );
}

export default App;
