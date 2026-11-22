import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { Loader2, AlertCircle, Globe, LogOut, Clock, Building2 } from 'lucide-react';
import { AuthCard, NewPassword } from './BrandKit';
import { authErrorText } from '../utils/accountSpaces';
import { supabase } from '../lib/supabase';
import { savePendingAgency } from '../utils/agencyStore';

// ════════════════════════════════════════════════════════════════════
// /agency — partner agencies: account, review by Loyoly, then the tool
// ════════════════════════════════════════════════════════════════════
// An agency signs up with Google, or with agency name, website, email and
// password (Supabase Auth sends the confirmation email). A Google account
// gives its agency name on a "complete your account" form. Its first visit creates its agency, pending
// until the Loyoly team approves it (supabase/migrations/20261122000000_agencies.sql).
// Approved, it gets the setup tool (App, mode "agency").

const FR = {
  space: 'Espace agence',
  signupTab: 'Créer un compte', loginTab: 'Se connecter',
  brandName: 'Nom de l\'agence', website: 'Site de l\'agence (facultatif)',
  email: 'Email professionnel', password: 'Mot de passe', passwordHint: '8 caractères minimum',
  signup: 'Créer mon compte agence', login: 'Se connecter', forgot: 'Mot de passe oublié ?', sendReset: 'Recevoir un lien',
  backToLogin: 'Retour à la connexion',
  or: 'ou',
  googleError: 'Connexion Google impossible. Réessayez ou utilisez votre email.',
  completeTitle: 'Finalisez votre compte agence',
  completeText: 'Indiquez le nom de votre agence : l\'équipe Loyoly validera ensuite votre accès.',
  completeSubmit: 'Créer mon compte agence',
  pitch: 'Concevez des programmes de fidélité Loyoly pour vos clients',
  pitchItems: [
    'Analyse du site de votre client ou prospect et programme proposé en quelques minutes',
    'Points, missions, récompenses, paliers VIP et parrainage, avec l\'estimation des coûts',
    'Plusieurs programmes par client pour comparer les options, fiche de setup à présenter',
  ],
  sentTitle: 'Vérifiez votre boîte mail',
  sent: email => `Un email de confirmation vient d'être envoyé à ${email}. Cliquez sur le lien qu'il contient : l'équipe Loyoly validera ensuite votre accès.`,
  resetSent: email => `Si un compte existe pour ${email}, un lien pour choisir un nouveau mot de passe vient de lui être envoyé.`,
  newPasswordTitle: 'Nouveau mot de passe', savePassword: 'Enregistrer',
  loading: 'Chargement…',
  logout: 'Se déconnecter',
  pendingTitle: 'Votre accès est en cours de validation',
  pending: name => `Merci ! Le compte de ${name} a bien été créé. L'équipe Loyoly valide chaque agence partenaire : vous recevrez l'accès à l'outil dès que c'est fait.`,
  refresh: 'Actualiser',
  suspended: 'L\'accès de votre agence à l\'outil a été suspendu. Contactez l\'équipe Loyoly.',
  teamAccount: 'Vous êtes connecté·e avec un compte Loyoly : utilisez l\'espace Loyoly.',
  openTeam: 'Ouvrir l\'espace Loyoly',
  errors: {
    'Invalid login credentials': 'Email ou mot de passe incorrect.',
    'Email not confirmed': 'Confirmez d\'abord votre email : cliquez sur le lien reçu à l\'inscription.',
    'User already registered': 'Un compte existe déjà avec cet email : connectez-vous.',
    email_not_confirmed: 'Confirmez d\'abord votre email : cliquez sur le lien reçu à l\'inscription.',
    brand_account: 'Cet email est déjà utilisé par un compte marque (kit d\'onboarding). Utilisez un autre email pour votre agence.',
    team_account: 'Vous êtes connecté·e avec un compte Loyoly : utilisez l\'espace Loyoly.',
    generic: 'Une erreur est survenue. Réessayez dans un instant.',
  },
};

const EN = {
  space: 'Agency space',
  signupTab: 'Create an account', loginTab: 'Sign in',
  brandName: 'Agency name', website: 'Agency website (optional)',
  email: 'Work email', password: 'Password', passwordHint: 'At least 8 characters',
  signup: 'Create my agency account', login: 'Sign in', forgot: 'Forgot your password?', sendReset: 'Send me a link',
  backToLogin: 'Back to sign in',
  or: 'or',
  googleError: 'Google sign-in failed. Try again or use your email.',
  completeTitle: 'Complete your agency account',
  completeText: 'Enter your agency\'s name: the Loyoly team will then approve your access.',
  completeSubmit: 'Create my agency account',
  pitch: 'Design Loyoly loyalty programs for your clients',
  pitchItems: [
    'Analysis of your client\'s or prospect\'s website and a suggested program in minutes',
    'Points, missions, rewards, VIP tiers and referral, with the cost estimate',
    'Several programs per client to compare options, a setup sheet to present',
  ],
  sentTitle: 'Check your inbox',
  sent: email => `A confirmation email was just sent to ${email}. Click the link inside: the Loyoly team will then approve your access.`,
  resetSent: email => `If an account exists for ${email}, a link to choose a new password was just sent to it.`,
  newPasswordTitle: 'New password', savePassword: 'Save',
  loading: 'Loading…',
  logout: 'Sign out',
  pendingTitle: 'Your access is being reviewed',
  pending: name => `Thank you! The ${name} account was created. The Loyoly team reviews every partner agency: you will get access to the tool as soon as it is done.`,
  refresh: 'Refresh',
  suspended: 'Your agency\'s access to the tool was suspended. Contact the Loyoly team.',
  teamAccount: 'You are signed in with a Loyoly account: use the Loyoly space.',
  openTeam: 'Open the Loyoly space',
  errors: {
    'Invalid login credentials': 'Wrong email or password.',
    'Email not confirmed': 'Confirm your email first: click the link received when you signed up.',
    'User already registered': 'An account already exists with this email: sign in.',
    email_not_confirmed: 'Confirm your email first: click the link received when you signed up.',
    brand_account: 'This email is already used by a brand account (onboarding kit). Use another email for your agency.',
    team_account: 'You are signed in with a Loyoly account: use the Loyoly space.',
    generic: 'Something went wrong. Try again in a moment.',
  },
};

const agencyTexts = lang => (lang === 'fr' ? FR : EN);
const agencyErrorText = (lang, err) => authErrorText(agencyTexts(lang), err);

// Page frame of the agency screens before the tool (sign-in, review…).
export function AgencyShell({ lang, onLang, onSignOut, children }) {
  const t = agencyTexts(lang);
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      <header style={{ backgroundColor: '#2B251F' }}>
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-[60px] flex items-center justify-between gap-3">
          <a href="/" className="flex items-center gap-3 min-w-0">
            <img src="/loyoly-logo.svg" alt="Loyoly" style={{ height: 26, filter: 'brightness(0) invert(1)' }} />
            <span className="text-[14px] font-semibold text-white/90 truncate">{t.space}</span>
          </a>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onLang}
              className="h-9 px-2 flex items-center gap-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 text-[12px]">
              <Globe size={14} /> {lang === 'fr' ? 'EN' : 'FR'}
            </button>
            {onSignOut && (
              <button onClick={onSignOut} title={t.logout} aria-label={t.logout}
                className="h-9 px-2 flex items-center gap-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 text-[12px]">
                <LogOut size={14} />
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 sm:px-6 pt-8 pb-16">{children}</main>
    </div>
  );
}

export function AgencySignIn({ lang }) {
  return (
    <AuthCard t={agencyTexts(lang)} redirectPath="/agency" nameKey="agency_name" websiteKey="agency_website"
      extraData={{ account_type: 'agency' }}
      google={({ mode, name, website }) => <AgencyGoogleButton lang={lang} mode={mode} name={name} website={website} />} />
  );
}

// Google sign-in (any Google account; a @loyoly.io one is sent to /loyoly).
// The agency name typed on the sign-up tab, if any, is kept for the first
// visit; otherwise the account completes it right after (AgencyComplete).
function AgencyGoogleButton({ lang, mode, name, website }) {
  const t = agencyTexts(lang);
  const [error, setError] = useState('');
  const onSuccess = async ({ credential }) => {
    setError('');
    if (mode === 'signup' && name) savePendingAgency({ name, website });
    const { error: err } = await supabase.auth.signInWithIdToken({ provider: 'google', token: credential });
    if (err) setError(t.googleError);
  };
  return (
    <div className="space-y-1">
      <div className="flex justify-center">
        <GoogleLogin onSuccess={onSuccess} onError={() => setError(t.googleError)}
          theme="outline" size="large" width="360" shape="rectangular" locale={lang}
          text={mode === 'signup' ? 'signup_with' : 'signin_with'} />
      </div>
      {error && <p className="text-[12px] text-red-600 text-center" role="alert">{error}</p>}
    </div>
  );
}

// A Google account without an agency yet: its name (and website).
function AgencyComplete({ lang, onComplete }) {
  const t = agencyTexts(lang);
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    await onComplete({ name: name.trim(), website: website.trim() });
    setBusy(false);
  };
  const input = 'w-full px-3 py-2 rounded-lg border border-[#E5E1D8] bg-white text-[14px] text-[#2B251F] focus:outline-none focus:border-primary';
  return (
    <form onSubmit={submit} className="card max-w-md mx-auto space-y-3 py-8">
      <Building2 size={28} className="mx-auto text-primary" />
      <h1 className="text-[20px] font-bold text-[#2B251F] text-center">{t.completeTitle}</h1>
      <p className="text-[14px] text-[#52473C] text-center">{t.completeText}</p>
      <label className="block text-[12px] font-medium text-[#645648] space-y-1">
        <span>{t.brandName}</span>
        <input type="text" value={name} onChange={e => setName(e.target.value)} maxLength={80} autoComplete="organization" className={input} />
      </label>
      <label className="block text-[12px] font-medium text-[#645648] space-y-1">
        <span>{t.website}</span>
        <input type="url" value={website} onChange={e => setWebsite(e.target.value)} maxLength={200} autoComplete="url" placeholder="https://" className={input} />
      </label>
      <button type="submit" disabled={!name.trim() || busy} className="btn-primary w-full justify-center">
        {busy && <Loader2 size={14} className="animate-spin" />} {t.completeSubmit}
      </button>
    </form>
  );
}

export function AgencyNewPassword({ lang, onDone }) {
  return <NewPassword t={agencyTexts(lang)} onDone={onDone} />;
}

export function AgencyLoading({ lang }) {
  return (
    <div className="card text-center py-16 max-w-md mx-auto">
      <Loader2 size={24} className="animate-spin mx-auto text-primary mb-3" />
      <p className="text-[13px] text-[#8A7D6B]">{agencyTexts(lang).loading}</p>
    </div>
  );
}

// Signed in, not in the tool yet: waiting for the review, suspended, or a problem.
export function AgencyBlocked({ lang, agency, error, onRetry, onComplete, onSignOut }) {
  const t = agencyTexts(lang);
  if (error?.includes('agency_name_required')) return <AgencyComplete lang={lang} onComplete={onComplete} />;
  if (error?.includes('team_account')) {
    return (
      <div className="card max-w-md mx-auto text-center space-y-3">
        <p className="text-[14px] text-[#52473C]">{t.teamAccount}</p>
        <div className="flex justify-center gap-2">
          <a href="/loyoly" className="btn-primary">{t.openTeam}</a>
          <button onClick={onSignOut} className="btn-secondary">{t.logout}</button>
        </div>
      </div>
    );
  }
  if (error) {
    return (
      <div className="card max-w-md mx-auto text-center py-10 space-y-3">
        <AlertCircle size={24} className="mx-auto text-red-500" />
        <p className="text-[14px] text-[#52473C]">{agencyErrorText(lang, { message: error })}</p>
        <div className="flex justify-center gap-2">
          <button onClick={onRetry} className="btn-secondary">{t.refresh}</button>
          <button onClick={onSignOut} className="btn-secondary">{t.logout}</button>
        </div>
      </div>
    );
  }
  if (agency?.status === 'suspended') {
    return (
      <div className="card max-w-md mx-auto text-center py-10 space-y-3">
        <AlertCircle size={24} className="mx-auto text-red-500" />
        <p className="text-[14px] text-[#52473C]">{t.suspended}</p>
      </div>
    );
  }
  return (
    <div className="card max-w-md mx-auto text-center py-10 space-y-3">
      <Clock size={28} className="mx-auto text-primary" />
      <h1 className="text-[20px] font-bold text-[#2B251F]">{t.pendingTitle}</h1>
      <p className="text-[14px] text-[#52473C]">{t.pending(agency?.name || '')}</p>
      <button onClick={onRetry} className="btn-secondary mx-auto">{t.refresh}</button>
    </div>
  );
}
