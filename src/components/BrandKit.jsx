import { useState, useEffect, useCallback } from 'react';
import { Loader2, AlertCircle, Globe, LogOut, Mail, Sparkles, CheckCircle2 } from 'lucide-react';
import ClientPortal from './ClientPortal';
import { supabase, apiFetch, isLoyolyEmail } from '../lib/supabase';
import { buildKit } from '../utils/brandKit';
import { normalizeDomain } from '../utils/clientFolders';

// ════════════════════════════════════════════════════════════════════
// /kit — self-serve brands: an account, then a ready-to-use onboarding kit
// ════════════════════════════════════════════════════════════════════
// A brand Loyoly does not accompany signs up (email, brand name, password;
// Supabase Auth sends the confirmation email). On its first visit its site is
// analyzed and its kit created (supabase/migrations/20261112000000_brand_accounts.sql):
// a program proposed for it, published to its own client folder, and the
// access code of that folder. Its space is then the client portal, opened
// with that code.

const FR = {
  kit: 'Kit d\'onboarding',
  signupTab: 'Créer un compte', loginTab: 'Se connecter',
  brandName: 'Nom de la marque', email: 'Email', password: 'Mot de passe', passwordHint: '8 caractères minimum',
  signup: 'Créer mon compte', login: 'Se connecter', forgot: 'Mot de passe oublié ?', sendReset: 'Recevoir un lien',
  backToLogin: 'Retour à la connexion',
  pitch: 'Votre programme de fidélité Loyoly, prêt à l\'emploi',
  pitchItems: [
    'Un programme proposé pour votre marque : missions, récompenses, paliers VIP, parrainage',
    'Votre checklist de lancement, étape par étape, avec les guides Loyoly',
    'Tout reste modifiable, à votre rythme',
  ],
  sentTitle: 'Vérifiez votre boîte mail',
  sent: email => `Un email de confirmation vient d'être envoyé à ${email}. Cliquez sur le lien qu'il contient pour accéder à votre kit.`,
  resetSent: email => `Si un compte existe pour ${email}, un lien pour choisir un nouveau mot de passe vient de lui être envoyé.`,
  newPasswordTitle: 'Nouveau mot de passe', savePassword: 'Enregistrer',
  welcome: name => `Bienvenue, ${name} 👋`,
  createTitle: 'Créons votre kit d\'onboarding',
  createHint: 'Indiquez le site de votre marque : nous l\'analysons pour vous proposer un programme adapté (panier moyen, secteur, paliers…).',
  site: 'Site internet de votre marque', generate: 'Générer mon kit',
  withoutAnalysis: 'Créer le kit sans analyser le site',
  analyzing: 'Analyse de votre site…', creating: 'Préparation de votre kit…',
  analysesLeft: n => `${n} analyse${n > 1 ? 's' : ''} restante${n > 1 ? 's' : ''}`,
  analysisFailed: msg => `L'analyse du site n'a pas abouti (${msg}). Vous pouvez réessayer avec une autre adresse ou créer le kit sans analyse.`,
  loading: 'Chargement…',
  logout: 'Se déconnecter',
  teamAccount: 'Vous êtes connecté·e avec un compte Loyoly : le kit d\'onboarding est réservé aux marques. Utilisez l\'outil CSM.',
  openCsm: 'Ouvrir l\'outil CSM',
  noAccess: 'Votre accès à votre kit a été suspendu. Contactez l\'équipe Loyoly.',
  errors: {
    'Invalid login credentials': 'Email ou mot de passe incorrect.',
    'Email not confirmed': 'Confirmez d\'abord votre email : cliquez sur le lien reçu à l\'inscription.',
    'User already registered': 'Un compte existe déjà avec cet email : connectez-vous.',
    email_not_confirmed: 'Confirmez d\'abord votre email : cliquez sur le lien reçu à l\'inscription.',
    generic: 'Une erreur est survenue. Réessayez dans un instant.',
  },
};
const EN = {
  kit: 'Onboarding kit',
  signupTab: 'Create an account', loginTab: 'Sign in',
  brandName: 'Brand name', email: 'Email', password: 'Password', passwordHint: 'At least 8 characters',
  signup: 'Create my account', login: 'Sign in', forgot: 'Forgot your password?', sendReset: 'Send me a link',
  backToLogin: 'Back to sign in',
  pitch: 'Your Loyoly loyalty program, ready to use',
  pitchItems: [
    'A program suggested for your brand: missions, rewards, VIP tiers, referral',
    'Your launch checklist, step by step, with the Loyoly guides',
    'Everything stays editable, at your own pace',
  ],
  sentTitle: 'Check your inbox',
  sent: email => `A confirmation email was just sent to ${email}. Click the link inside to open your kit.`,
  resetSent: email => `If an account exists for ${email}, a link to choose a new password was just sent to it.`,
  newPasswordTitle: 'New password', savePassword: 'Save',
  welcome: name => `Welcome, ${name} 👋`,
  createTitle: 'Let\'s create your onboarding kit',
  createHint: 'Enter your brand\'s website: we analyze it to suggest a program that fits (average order, industry, tiers…).',
  site: 'Your brand\'s website', generate: 'Generate my kit',
  withoutAnalysis: 'Create the kit without analyzing the site',
  analyzing: 'Analyzing your website…', creating: 'Preparing your kit…',
  analysesLeft: n => `${n} analysis${n > 1 ? 'es' : ''} left`,
  analysisFailed: msg => `The website analysis did not work (${msg}). Try another address or create the kit without analysis.`,
  loading: 'Loading…',
  logout: 'Sign out',
  teamAccount: 'You are signed in with a Loyoly account: the onboarding kit is for brands. Use the CSM tool.',
  openCsm: 'Open the CSM tool',
  noAccess: 'Your access to your kit was suspended. Contact the Loyoly team.',
  errors: {
    'Invalid login credentials': 'Wrong email or password.',
    'Email not confirmed': 'Confirm your email first: click the link received when you signed up.',
    'User already registered': 'An account already exists with this email: sign in.',
    email_not_confirmed: 'Confirm your email first: click the link received when you signed up.',
    generic: 'Something went wrong. Try again in a moment.',
  },
};

const errorText = (t, err) => {
  const message = err?.message || '';
  const known = Object.keys(t.errors).find(key => message.includes(key));
  return known ? t.errors[known] : (message || t.errors.generic);
};

export default function BrandKit() {
  const [lang, setLang] = useState(() => (navigator.language?.startsWith('fr') === false ? 'en' : 'fr'));
  const t = lang === 'fr' ? FR : EN;
  const [session, setSession] = useState(undefined); // undefined: not known yet
  const [recovery, setRecovery] = useState(false);
  const [account, setAccount] = useState(null);
  const [accountError, setAccountError] = useState('');

  useEffect(() => {
    if (!supabase) return undefined;
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next ?? null);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const isBrand = !!session && !isLoyolyEmail(session.user?.email);
  const loadAccount = useCallback(() => supabase.rpc('brand_account').then(({ data, error }) => {
    if (error) setAccountError(error.message);
    else { setAccount(data); setAccountError(''); }
  }), []);

  useEffect(() => {
    if (!isBrand || recovery) return;
    loadAccount();
  }, [isBrand, recovery, loadAccount, session?.user?.id]);

  useEffect(() => { document.title = `Loyoly — ${t.kit}`; }, [t.kit]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setAccount(null);
  };

  const shell = content => (
    <div className="min-h-screen bg-surface flex flex-col">
      <header style={{ backgroundColor: '#2B251F' }}>
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-[60px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/loyoly-logo.svg" alt="Loyoly" style={{ height: 26, filter: 'brightness(0) invert(1)' }} />
            <span className="text-[14px] font-semibold text-white/90 truncate">{t.kit}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setLang(l => (l === 'fr' ? 'en' : 'fr'))}
              className="h-9 px-2 flex items-center gap-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 text-[12px]">
              <Globe size={14} /> {lang === 'fr' ? 'EN' : 'FR'}
            </button>
            {session && (
              <button onClick={signOut} title={t.logout} aria-label={t.logout}
                className="h-9 px-2 flex items-center gap-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 text-[12px]">
                <LogOut size={14} />
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 sm:px-6 pt-8 pb-16">{content}</main>
    </div>
  );

  if (!supabase || session === undefined) return shell(<Loading t={t} />);
  if (recovery && session) return shell(<NewPassword t={t} onDone={() => setRecovery(false)} />);
  if (!session) return shell(<AuthCard t={t} />);
  if (!isBrand) {
    return shell(
      <div className="card max-w-md mx-auto text-center space-y-3">
        <p className="text-[14px] text-[#52473C]">{t.teamAccount}</p>
        <div className="flex justify-center gap-2">
          <a href="/" className="btn-primary">{t.openCsm}</a>
          <button onClick={signOut} className="btn-secondary">{t.logout}</button>
        </div>
      </div>,
    );
  }
  if (accountError) return shell(<Problem t={t} message={errorText(t, { message: accountError })} onRetry={loadAccount} />);
  if (!account) return shell(<Loading t={t} />);
  if (account.code) {
    return (
      <ClientPortal key={account.code} fixedCode={account.code} selfServe onLeave={signOut}
        fixedAuthor={{ name: account.brand_name, key: `brand-${session.user.id}` }} />
    );
  }
  if (account.has_kit) return shell(<Problem t={t} message={t.noAccess} />);
  return shell(<CreateKit t={t} lang={lang} account={account} onCreated={code => setAccount({ ...account, code, has_kit: true })} />);
}

function Loading({ t }) {
  return (
    <div className="card text-center py-16 max-w-md mx-auto">
      <Loader2 size={24} className="animate-spin mx-auto text-primary mb-3" />
      <p className="text-[13px] text-[#8A7D6B]">{t.loading}</p>
    </div>
  );
}

function Problem({ t, message, onRetry }) {
  return (
    <div className="card max-w-md mx-auto text-center py-10 space-y-3">
      <AlertCircle size={24} className="mx-auto text-red-500" />
      <p className="text-[14px] text-[#52473C]">{message}</p>
      {onRetry && <button onClick={onRetry} className="btn-secondary mx-auto">{t.loginTab}</button>}
    </div>
  );
}

const field = 'w-full px-3 text-[14px]';
// Inline: the global input rules (index.css) only cover type="text" / "number".
const FIELD_STYLE = { height: 40, border: '1px solid var(--color-card-border)', borderRadius: 10, background: 'var(--color-card-elev)' };

function AuthCard({ t }) {
  const [mode, setMode] = useState('signup'); // signup | login | forgot
  const [brandName, setBrandName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(null); // { kind: 'signup' | 'reset', email }

  const run = async action => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(errorText(t, err));
    }
    setBusy(false);
  };
  const redirectTo = `${window.location.origin}/kit`;
  const submit = e => {
    e.preventDefault();
    if (mode === 'signup') {
      run(async () => {
        const { data, error: err } = await supabase.auth.signUp({
          email: email.trim(), password, options: { data: { brand_name: brandName.trim() }, emailRedirectTo: redirectTo },
        });
        if (err) throw err;
        if (!data.session) setSent({ kind: 'signup', email: email.trim() });
      });
    } else if (mode === 'login') {
      run(async () => {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (err) throw err;
      });
    } else {
      run(async () => {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
        if (err) throw err;
        setSent({ kind: 'reset', email: email.trim() });
      });
    }
  };

  if (sent) {
    return (
      <div className="card max-w-md mx-auto text-center space-y-3 py-10">
        <Mail size={28} className="mx-auto text-primary" />
        <h1 className="text-[20px] font-bold text-[#2B251F]">{t.sentTitle}</h1>
        <p className="text-[14px] text-[#52473C]">{sent.kind === 'signup' ? t.sent(sent.email) : t.resetSent(sent.email)}</p>
        <button onClick={() => { setSent(null); setMode('login'); }} className="btn-secondary mx-auto">{t.backToLogin}</button>
      </div>
    );
  }

  const valid = /\S+@\S+\.\S+/.test(email.trim())
    && (mode === 'forgot' || password.length >= 8)
    && (mode !== 'signup' || brandName.trim().length > 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_420px] items-start max-w-[980px] mx-auto">
      <div className="pt-2">
        <div className="section-subheader">LOYOLY</div>
        <h1 className="text-[30px] font-bold text-[#2B251F] leading-tight">{t.pitch}</h1>
        <ul className="mt-5 space-y-3">
          {t.pitchItems.map(item => (
            <li key={item} className="flex items-start gap-2.5 text-[15px] text-[#52473C]">
              <CheckCircle2 size={18} className="text-[#059669] shrink-0 mt-0.5" /> {item}
            </li>
          ))}
        </ul>
      </div>
      <form onSubmit={submit} className="card space-y-3" aria-label={mode === 'signup' ? t.signupTab : mode === 'login' ? t.loginTab : t.forgot}>
        {mode !== 'forgot' && (
          <div className="flex border-b border-[#E5E1D8] -mt-1" role="tablist">
            {[['signup', t.signupTab], ['login', t.loginTab]].map(([key, label]) => (
              <button key={key} type="button" role="tab" aria-selected={mode === key} onClick={() => { setMode(key); setError(''); }}
                className={`relative px-3 py-2 text-[14px] ${mode === key ? 'font-semibold text-[#2B251F]' : 'text-[#8A7D6B]'}`}>
                {label}
                {mode === key && <span className="absolute left-2 right-2 -bottom-px h-[2px] bg-primary rounded-sm" />}
              </button>
            ))}
          </div>
        )}
        {mode === 'forgot' && <h2 className="text-[16px] font-bold text-[#2B251F]">{t.forgot}</h2>}
        {mode === 'signup' && (
          <label className="block text-[12px] font-medium text-[#645648] space-y-1">
            <span>{t.brandName}</span>
            <input type="text" value={brandName} onChange={e => setBrandName(e.target.value)} maxLength={80} autoComplete="organization" className={field} style={FIELD_STYLE} />
          </label>
        )}
        <label className="block text-[12px] font-medium text-[#645648] space-y-1">
          <span>{t.email}</span>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" className={field} style={FIELD_STYLE} />
        </label>
        {mode !== 'forgot' && (
          <label className="block text-[12px] font-medium text-[#645648] space-y-1">
            <span>{t.password}</span>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={8}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} className={field} style={FIELD_STYLE} />
            {mode === 'signup' && <span className="block text-[11px] font-normal text-[#8A7D6B]">{t.passwordHint}</span>}
          </label>
        )}
        {error && <p className="text-[12px] text-red-600" role="alert">{error}</p>}
        <button type="submit" disabled={!valid || busy} className="btn-primary w-full justify-center">
          {busy && <Loader2 size={14} className="animate-spin" />}
          {mode === 'signup' ? t.signup : mode === 'login' ? t.login : t.sendReset}
        </button>
        {mode === 'login' && (
          <button type="button" onClick={() => { setMode('forgot'); setError(''); }} className="text-[12px] text-primary hover:underline">{t.forgot}</button>
        )}
        {mode === 'forgot' && (
          <button type="button" onClick={() => { setMode('login'); setError(''); }} className="text-[12px] text-primary hover:underline">{t.backToLogin}</button>
        )}
      </form>
    </div>
  );
}

function NewPassword({ t, onDone }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const save = async e => {
    e.preventDefault();
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) setError(errorText(t, err));
    else onDone();
  };
  return (
    <form onSubmit={save} className="card max-w-md mx-auto space-y-3">
      <h1 className="text-[18px] font-bold text-[#2B251F]">{t.newPasswordTitle}</h1>
      <label className="block text-[12px] font-medium text-[#645648] space-y-1">
        <span>{t.password}</span>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} autoComplete="new-password"
          className={field} style={FIELD_STYLE} />
        <span className="block text-[11px] font-normal text-[#8A7D6B]">{t.passwordHint}</span>
      </label>
      {error && <p className="text-[12px] text-red-600" role="alert">{error}</p>}
      <button type="submit" disabled={password.length < 8} className="btn-primary w-full justify-center">{t.savePassword}</button>
    </form>
  );
}

function CreateKit({ t, lang, account, onCreated }) {
  const [url, setUrl] = useState('');
  const [phase, setPhase] = useState('input'); // input | analyzing | creating
  const [error, setError] = useState('');
  const [analysesLeft, setAnalysesLeft] = useState(account.analyses_left);

  const create = async analysis => {
    setPhase('creating');
    const { state, view } = buildKit(account.brand_name, analysis, lang);
    const domain = normalizeDomain(analysis?.brand_url || url) || null;
    const { data, error: err } = await supabase.rpc('brand_create_kit', { p_domain: domain, p_state: state, p_view: view });
    if (err) {
      setError(errorText(t, err));
      setPhase('input');
      return;
    }
    onCreated(data);
  };

  const analyze = async e => {
    e.preventDefault();
    setError('');
    setPhase('analyzing');
    try {
      const res = await apiFetch('/api/analyze-brand', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: url.trim() }),
      });
      setAnalysesLeft(n => Math.max(0, n - 1));
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const analysis = await res.json();
      await create({ ...analysis, brand_url: analysis.brand_url || url.trim() });
    } catch (err) {
      setError(t.analysisFailed(err.message));
      setPhase('input');
    }
  };

  const busy = phase !== 'input';
  return (
    <div className="max-w-xl mx-auto space-y-4">
      <div>
        <div className="section-subheader">{t.kit.toUpperCase()}</div>
        <h1 className="text-[26px] font-bold text-[#2B251F]">{t.welcome(account.brand_name)}</h1>
      </div>
      <form onSubmit={analyze} className="card space-y-3" aria-label={t.createTitle}>
        <h2 className="text-[16px] font-bold text-[#2B251F] flex items-center gap-2"><Sparkles size={16} className="text-primary" /> {t.createTitle}</h2>
        <p className="text-[13px] text-[#645648]">{t.createHint}</p>
        <label className="block text-[12px] font-medium text-[#645648] space-y-1">
          <span>{t.site}</span>
          <input type="text" value={url} onChange={e => setUrl(e.target.value)} placeholder="www.votre-marque.com" disabled={busy} className={field} style={FIELD_STYLE} />
        </label>
        {error && <p className="text-[12px] text-red-600" role="alert">{error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={!url.trim() || busy || analysesLeft < 1} className="btn-primary">
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {phase === 'analyzing' ? t.analyzing : phase === 'creating' ? t.creating : t.generate}
          </button>
          <span className="text-[12px] text-[#8A7D6B]">{t.analysesLeft(analysesLeft)}</span>
        </div>
        <button type="button" onClick={() => create(null)} disabled={busy} className="text-[12px] text-primary hover:underline">
          {t.withoutAnalysis}
        </button>
      </form>
    </div>
  );
}
