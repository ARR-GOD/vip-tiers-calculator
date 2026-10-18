import { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, AlertCircle, CheckCircle2, MessageSquare, Globe, KeyRound, LogOut } from 'lucide-react';
import CommentThread from './CommentThread';
import { clientApi, normalizeComment } from '../utils/clientPortalStore';
import { CLIENT_PAGES, pageSections, pageItems, pageLabel } from '../utils/clientView';
import { normalizeAccessCode, isValidAccessCode, formatAccessCode } from '../utils/accessCode';
import { getAnonSupabase } from '../lib/supabase';

// ════════════════════════════════════════════════════════════════════
// Client portal — /client/<code>: the client's side of their program
// ════════════════════════════════════════════════════════════════════
// No Google sign-in: the access code shared by the CSM opens the published
// programs of the client folder. The first name and a random author key stay
// in this browser; the key lets the client edit or delete their comments.

const CODE_STORAGE = 'loyoly-client-code';
const AUTHOR_STORAGE = 'loyoly-client-author';
const REFRESH_MS = 30000;

const FR = {
  portal: 'Programme de fidélité',
  codeTitle: 'Accédez à votre programme',
  codeHint: 'Saisissez le code transmis par votre CSM Loyoly.',
  codeInvalid: 'Ce code n\'est pas valide ou n\'est plus actif. Demandez un nouveau lien à votre CSM.',
  access: 'Accéder',
  welcome: 'Bienvenue !',
  nameHint: 'Indiquez votre prénom : il signera vos commentaires et vos validations.',
  namePlaceholder: 'Votre prénom',
  continue: 'Continuer',
  loading: 'Chargement de votre programme…',
  error: 'Impossible de charger votre programme.',
  retry: 'Réessayer',
  notPublished: 'Votre programme est en préparation : votre CSM Loyoly le publiera ici.',
  version: (v, date) => `Version ${v} · publiée le ${date}`,
  validate: 'Je valide cette page',
  validated: (by, date) => `Validé par ${by} le ${date}`,
  comment: 'Commenter',
  emptyPage: {
    missions: 'Ce programme n\'a pas de points.',
    rewards: 'Pas de récompense en points dans ce programme.',
    referral: 'Pas de parrainage dans ce programme.',
    tiers: 'Pas de paliers VIP dans ce programme.',
  },
  signedAs: name => `Connecté·e en tant que ${name}`,
  leave: 'Quitter',
};

const EN = {
  portal: 'Loyalty program',
  codeTitle: 'Access your program',
  codeHint: 'Enter the code your Loyoly CSM sent you.',
  codeInvalid: 'This code is not valid or no longer active. Ask your CSM for a new link.',
  access: 'Access',
  welcome: 'Welcome!',
  nameHint: 'Enter your first name: it signs your comments and approvals.',
  namePlaceholder: 'Your first name',
  continue: 'Continue',
  loading: 'Loading your program…',
  error: 'Your program could not be loaded.',
  retry: 'Retry',
  notPublished: 'Your program is being prepared: your Loyoly CSM will publish it here.',
  version: (v, date) => `Version ${v} · published on ${date}`,
  validate: 'I approve this page',
  validated: (by, date) => `Approved by ${by} on ${date}`,
  comment: 'Comment',
  emptyPage: {
    missions: 'This program has no points.',
    rewards: 'No points reward in this program.',
    referral: 'No referral in this program.',
    tiers: 'No VIP tiers in this program.',
  },
  signedAs: name => `Signed in as ${name}`,
  leave: 'Leave',
};

// Browser storage may be unavailable (private mode): the portal still works
// for the current visit.
function readStored(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function writeStored(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch { /* kept in memory only */ }
}

const newAuthorKey = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, '0')).join('');
const codeFromUrl = () => normalizeAccessCode(decodeURIComponent(window.location.pathname.replace(/^\/client\/?/, '')));
const isInvalidCode = err => /invalid_code/.test(err?.message || '');

export default function ClientPortal() {
  const [lang, setLang] = useState(() => (navigator.language?.startsWith('fr') === false ? 'en' : 'fr'));
  const t = lang === 'fr' ? FR : EN;
  const [code, setCode] = useState(() => codeFromUrl() || readStored(CODE_STORAGE) || '');
  const [author, setAuthor] = useState(() => readStored(AUTHOR_STORAGE));
  const [data, setData] = useState(null);
  const [status, setStatus] = useState(() => (code ? 'loading' : 'code')); // code | loading | ready | invalid | error
  const [programId, setProgramId] = useState(null);
  const [page, setPage] = useState('missions');
  const [target, setTarget] = useState('');
  const textareaRef = useRef(null);

  const load = useCallback(() => {
    if (!code) return Promise.resolve();
    return clientApi.portal(code, author?.key || '')
      .then(portal => {
        setData(portal);
        setStatus('ready');
        writeStored(CODE_STORAGE, code);
      })
      .catch(err => {
        if (isInvalidCode(err)) {
          writeStored(CODE_STORAGE, null);
          setStatus('invalid');
        } else {
          setStatus(s => (s === 'ready' ? s : 'error'));
        }
      });
  }, [code, author?.key]);

  useEffect(() => {
    if (!getAnonSupabase()) return undefined;
    load();
    const timer = setInterval(load, REFRESH_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  useEffect(() => {
    document.title = data?.client_name ? `${data.client_name} — ${t.portal}` : `Loyoly — ${t.portal}`;
  }, [data?.client_name, t.portal]);

  const submitCode = (value) => {
    const normalized = normalizeAccessCode(value);
    if (!isValidAccessCode(normalized)) {
      setStatus('invalid');
      return;
    }
    window.history.replaceState(null, '', `/client/${formatAccessCode(normalized)}`);
    setStatus('loading');
    setCode(normalized);
  };

  const saveName = (name) => {
    const next = { name: name.trim(), key: author?.key || newAuthorKey() };
    writeStored(AUTHOR_STORAGE, next);
    setAuthor(next);
  };

  const leave = () => {
    writeStored(CODE_STORAGE, null);
    window.history.replaceState(null, '', '/client');
    setData(null);
    setCode('');
    setStatus('code');
  };

  const program = data?.programs.find(p => p.id === programId) || data?.programs[0] || null;
  const view = program?.view;
  const comments = (program?.comments || []).map(c => normalizeComment(c)).filter(c => c.page === page);
  const items = view ? pageItems(view, lang, page) : [];
  const validation = program?.validations.find(v => v.page === page);
  const formatDate = iso => new Date(iso).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { dateStyle: 'long' });

  const withReload = action => async (...args) => {
    await action(...args);
    await load();
  };
  const commentOn = (ref) => {
    setTarget(ref);
    textareaRef.current?.focus();
    textareaRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };
  const openCountOf = ref => comments.filter(c => c.itemRef === ref && !c.resolved).length;

  // ── Screens before the program ──
  const shell = content => (
    <div className="min-h-screen bg-surface flex flex-col">
      <header style={{ backgroundColor: '#2B251F' }}>
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-[60px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/loyoly-logo.svg" alt="Loyoly" style={{ height: 26, filter: 'brightness(0) invert(1)' }} />
            <span className="text-[14px] font-semibold text-white/90 truncate">
              {data?.client_name ? `${data.client_name} · ${t.portal}` : t.portal}
            </span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {author && status === 'ready' && <span className="text-[12px] text-white/60 hidden sm:inline mr-2">{t.signedAs(author.name)}</span>}
            <button onClick={() => setLang(l => (l === 'fr' ? 'en' : 'fr'))}
              className="h-9 px-2 flex items-center gap-1 rounded-lg text-white/70 hover:text-white hover:bg-white/10 text-[12px]">
              <Globe size={14} /> {lang === 'fr' ? 'EN' : 'FR'}
            </button>
            {status === 'ready' && (
              <button onClick={leave} className="h-9 px-2 flex items-center gap-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 text-[12px]" title={t.leave}>
                <LogOut size={14} />
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 sm:px-6 pt-6 pb-16">{content}</main>
    </div>
  );

  if (status === 'code' || status === 'invalid') {
    return shell(<CodeForm t={t} invalid={status === 'invalid'} onSubmit={submitCode} />);
  }
  if (status === 'loading' || (status !== 'error' && !data)) {
    return shell(
      <div className="card text-center py-16">
        <Loader2 size={24} className="animate-spin mx-auto text-primary mb-3" />
        <p className="text-[13px] text-[#8A7D6B]">{t.loading}</p>
      </div>,
    );
  }
  if (status === 'error') {
    return shell(
      <div className="card text-center py-16">
        <AlertCircle size={24} className="mx-auto text-red-500 mb-3" />
        <p className="text-[14px] text-[#52473C] mb-4">{t.error}</p>
        <button onClick={() => { setStatus('loading'); load(); }} className="btn-primary mx-auto">{t.retry}</button>
      </div>,
    );
  }
  if (!author) return shell(<NameForm t={t} onSubmit={saveName} />);
  if (!program) {
    return shell(
      <div className="card text-center py-16 max-w-xl mx-auto">
        <p className="text-[15px] text-[#52473C]">{t.notPublished}</p>
      </div>,
    );
  }

  // ── The program ──
  const sections = pageSections(view, lang, page);
  const hasContent = sections.some(s => s.rows?.length || s.facts?.length);

  return shell(
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {view.brand?.logo && <img src={view.brand.logo} alt="" className="brand-avatar" />}
          <div>
            <h1 className="text-[24px] font-bold text-[#52473C] leading-tight">{program.name}</h1>
            <p className="text-[12px] text-[#8A7D6B]">{t.version(program.version, formatDate(program.published_at))}</p>
          </div>
        </div>
        {data.programs.length > 1 && (
          <div className="flex gap-1 flex-wrap" role="tablist" aria-label="Programmes">
            {data.programs.map(p => (
              <button key={p.id} onClick={() => { setProgramId(p.id); setTarget(''); }}
                className={`px-3 py-1.5 rounded-[10px] text-[12px] font-semibold border ${p.id === program.id ? 'bg-primary text-white border-primary' : 'bg-white text-[#52473C] border-[#E5E1D8]'}`}>
                {p.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <nav className="flex gap-1 border-b border-[#E5E1D8] overflow-x-auto">
        {CLIENT_PAGES.map(p => {
          const open = (program.comments || []).filter(c => c.page === p.key && !c.resolved).length;
          const done = program.validations.some(v => v.page === p.key);
          return (
            <button key={p.key} onClick={() => { setPage(p.key); setTarget(''); }}
              className={`relative px-3.5 py-2.5 text-[13px] whitespace-nowrap inline-flex items-center gap-1.5 ${page === p.key ? 'text-[#2B251F] font-semibold' : 'text-[#8A7D6B] font-medium hover:text-[#52473C]'}`}>
              {done && <CheckCircle2 size={13} className="text-[#059669]" />}
              {lang === 'fr' ? p.labelFr : p.labelEn}
              {open > 0 && <span className="px-1.5 rounded-full bg-primary/10 text-primary text-[10px]">{open}</span>}
              {page === p.key && <span className="absolute left-3 right-3 -bottom-px h-[2px] bg-primary rounded-sm" />}
            </button>
          );
        })}
      </nav>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
        <div className="space-y-3 min-w-0">
          <div className="card flex items-center justify-between gap-3 flex-wrap" style={{ padding: 14 }}>
            {validation ? (
              <span className="text-[13px] font-medium text-[#059669] inline-flex items-center gap-1.5">
                <CheckCircle2 size={15} /> {t.validated(validation.by, formatDate(validation.at))}
              </span>
            ) : (
              <>
                <span className="text-[13px] text-[#645648]">{program.name} · {pageLabel(page, lang)}</span>
                <button onClick={withReload(() => clientApi.validate(code, author, program.id, page))} className="btn-primary">
                  <CheckCircle2 size={14} /> {t.validate}
                </button>
              </>
            )}
          </div>

          {!hasContent && <div className="card text-[13px] text-[#8A7D6B]">{sections.find(s => s.note)?.note || t.emptyPage[page]}</div>}
          {sections.filter(s => s.rows?.length || s.facts?.length).map(section => (
            <SectionCard key={section.key} section={section} t={t} onComment={commentOn} openCountOf={openCountOf} />
          ))}
        </div>

        <aside className="card lg:sticky lg:top-4" style={{ padding: 16 }}>
          <CommentThread
            lang={lang}
            comments={comments}
            items={items}
            target={target}
            onTargetChange={setTarget}
            textareaRef={textareaRef}
            onAdd={withReload(c => clientApi.addComment(code, author, { programId: program.id, page, ...c }))}
            onEdit={withReload((id, body) => clientApi.editComment(code, author, id, body))}
            onDelete={withReload(id => clientApi.deleteComment(code, author, id))}
          />
        </aside>
      </div>
    </div>,
  );
}

function SectionCard({ section, t, onComment, openCountOf }) {
  return (
    <section className="card" style={{ padding: 18 }}>
      <h2 className="text-[16px] font-bold text-[#2B251F] mb-3">{section.title}</h2>
      {section.facts && (
        <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-[max-content_1fr] text-[13px] mb-1">
          {section.facts.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="font-medium text-[#645648]">{label}</dt>
              <dd className="text-[#2B251F]">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {section.rows?.length > 0 && (
        <div className="overflow-x-auto -mx-1 mt-2">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-[#8A7D6B]">
                {section.columns.map((col, i) => <th key={i} className="px-2 py-1.5 font-semibold">{col}</th>)}
                <th className="px-2 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {section.rows.map((row, r) => {
                const ref = section.refs?.[r];
                const open = ref ? openCountOf(ref) : 0;
                return (
                  <tr key={ref || r} className="border-t border-[#E5E1D8] align-top">
                    {row.map((cell, c) => (
                      <td key={c} className={`px-2 py-2 ${c === 0 ? 'font-medium text-[#2B251F]' : `text-[#52473C] ${Array.isArray(cell) ? '' : 'whitespace-nowrap'}`}`}>
                        {Array.isArray(cell)
                          ? <ul className="list-disc pl-4 space-y-0.5">{cell.map(item => <li key={item}>{item}</li>)}</ul>
                          : cell}
                      </td>
                    ))}
                    <td className="px-2 py-2 text-right whitespace-nowrap">
                      {ref && (
                        <button onClick={() => onComment(ref)} title={t.comment} aria-label={`${t.comment} ${row[0]}`}
                          className="inline-flex items-center gap-1 text-[12px] text-[#8A7D6B] hover:text-primary">
                          <MessageSquare size={13} /> {open > 0 && <span className="text-primary font-semibold">{open}</span>}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function CodeForm({ t, invalid, onSubmit }) {
  const [value, setValue] = useState('');
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(value); }} className="card max-w-md mx-auto mt-10 text-center space-y-3">
      <KeyRound size={26} className="mx-auto text-primary" />
      <h1 className="text-[20px] font-bold text-[#2B251F]">{t.codeTitle}</h1>
      <p className="text-[13px] text-[#8A7D6B]">{t.codeHint}</p>
      <input value={value} onChange={e => setValue(e.target.value)} placeholder="XXXX-XXXX-XXXX" autoFocus
        className="w-full px-3 py-2 text-center font-mono text-[16px] tracking-widest rounded-lg" aria-label={t.codeTitle} />
      {invalid && <p className="text-[12px] text-red-600">{t.codeInvalid}</p>}
      <button type="submit" disabled={!value.trim()} className="btn-primary w-full justify-center">{t.access}</button>
    </form>
  );
}

function NameForm({ t, onSubmit }) {
  const [name, setName] = useState('');
  return (
    <form onSubmit={e => { e.preventDefault(); if (name.trim()) onSubmit(name); }} className="card max-w-md mx-auto mt-10 text-center space-y-3">
      <h1 className="text-[20px] font-bold text-[#2B251F]">{t.welcome}</h1>
      <p className="text-[13px] text-[#8A7D6B]">{t.nameHint}</p>
      <input value={name} onChange={e => setName(e.target.value)} placeholder={t.namePlaceholder} maxLength={80} autoFocus
        className="w-full px-3 py-2 text-[15px] rounded-lg" aria-label={t.namePlaceholder} />
      <button type="submit" disabled={!name.trim()} className="btn-primary w-full justify-center">{t.continue}</button>
    </form>
  );
}
