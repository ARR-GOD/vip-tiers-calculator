import { useEffect, useState } from 'react';
import { Store, Sparkles, Briefcase, ArrowRight, Loader2, Globe } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { spaceOf } from '../utils/accountSpaces';

// ════════════════════════════════════════════════════════════════════
// / — the three ways in: clients (brands), the Loyoly team, agencies
// ════════════════════════════════════════════════════════════════════
// Someone already signed in goes straight to their space, so the team's old
// bookmarks of "/" and the confirmation links that fall back to the site's
// root still land in the right place.

const FR = {
  title: 'Loyoly Setup',
  subtitle: 'Concevez et lancez votre programme de fidélité.',
  entries: {
    clients: { title: 'Clients', text: 'Votre kit d\'onboarding Loyoly, ou l\'espace partagé par votre CSM.', cta: 'Accéder à mon espace', code: 'J\'ai un code d\'accès' },
    loyoly: { title: 'Loyoly', text: 'L\'outil de l\'équipe Loyoly (connexion Google @loyoly.io).', cta: 'Se connecter' },
    agency: { title: 'Agence', text: 'Agences partenaires : concevez des programmes pour vos clients et prospects.', cta: 'Accéder à l\'espace agence' },
  },
  codePlaceholder: 'XXXX-XXXX-XXXX',
  open: 'Ouvrir',
};
const EN = {
  title: 'Loyoly Setup',
  subtitle: 'Design and launch your loyalty program.',
  entries: {
    clients: { title: 'Clients', text: 'Your Loyoly onboarding kit, or the space your CSM shared with you.', cta: 'Open my space', code: 'I have an access code' },
    loyoly: { title: 'Loyoly', text: 'The Loyoly team\'s tool (Google sign-in @loyoly.io).', cta: 'Sign in' },
    agency: { title: 'Agency', text: 'Partner agencies: design programs for your clients and prospects.', cta: 'Open the agency space' },
  },
  codePlaceholder: 'XXXX-XXXX-XXXX',
  open: 'Open',
};

export default function Landing() {
  const [lang, setLang] = useState(() => (navigator.language?.startsWith('fr') === false ? 'en' : 'fr'));
  const t = lang === 'fr' ? FR : EN;
  const [checking, setChecking] = useState(!!supabase);
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      const target = spaceOf(data.session);
      if (target) window.location.replace(`${target}${window.location.search}${window.location.hash}`);
      else setChecking(false);
    });
  }, []);

  useEffect(() => { document.title = 'Loyoly Setup'; }, []);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#EEEDE6' }}>
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  const openCode = e => {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (clean) window.location.assign(`/client/${encodeURIComponent(clean)}`);
  };

  const cards = [
    { key: 'clients', icon: <Store size={20} />, href: '/kit' },
    { key: 'loyoly', icon: <Sparkles size={20} />, href: '/loyoly' },
    { key: 'agency', icon: <Briefcase size={20} />, href: '/agence' },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#EEEDE6' }}>
      <div className="flex justify-end p-4">
        <button onClick={() => setLang(l => (l === 'fr' ? 'en' : 'fr'))}
          className="h-9 px-3 flex items-center gap-1 rounded-lg text-[#645648] hover:bg-white/60 text-[12px]">
          <Globe size={14} /> {lang === 'fr' ? 'EN' : 'FR'}
        </button>
      </div>
      <main className="flex-1 w-full max-w-[1040px] mx-auto px-4 sm:px-6 pb-16">
        <div className="flex flex-col items-center text-center gap-3 mb-10">
          <img src="/loyoly-logo.svg" alt="Loyoly" style={{ height: 40 }} />
          <h1 className="text-[28px] font-bold text-[#2B251F]">{t.title}</h1>
          <p className="text-[15px] text-[#645648]">{t.subtitle}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {cards.map(({ key, icon, href }) => {
            const entry = t.entries[key];
            return (
              <div key={key} className="card flex flex-col gap-3" style={{ padding: 20 }}>
                <div className="w-11 h-11 rounded-[12px] bg-[#E8EFFE] text-primary flex items-center justify-center">
                  {icon}
                </div>
                <h2 className="text-[18px] font-bold text-[#2B251F]">{entry.title}</h2>
                <p className="text-[14px] text-[#645648] flex-1">{entry.text}</p>
                <a href={href} className="btn-primary justify-center">{entry.cta} <ArrowRight size={14} /></a>
                {key === 'clients' && (showCode ? (
                  <form onSubmit={openCode} className="flex gap-2">
                    <input type="text" value={code} onChange={e => setCode(e.target.value)} placeholder={t.codePlaceholder}
                      aria-label={entry.code} autoFocus className="flex-1 min-w-0 px-3 text-[13px]" style={{ height: 36 }} />
                    <button type="submit" disabled={!code.trim()} className="btn-secondary">{t.open}</button>
                  </form>
                ) : (
                  <button onClick={() => setShowCode(true)} className="text-[12px] text-primary hover:underline">{entry.code}</button>
                ))}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
