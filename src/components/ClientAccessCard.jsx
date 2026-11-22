import { useState, useEffect } from 'react';
import { KeyRound, Copy, Check, RefreshCw, Ban, Loader2 } from 'lucide-react';
import { getActiveAccess, createAccess, revokeAccess } from '../utils/clientPortalStore';
import { formatAccessCode, clientPortalUrl } from '../utils/accessCode';

const FR = {
  title: 'Accès client',
  hint: 'Le client voit les programmes partagés et publiés (Missions, Récompenses, Parrainage, Paliers VIP), les commente et les valide.',
  generate: 'Générer un accès client',
  code: 'Code',
  copy: 'Copier le lien', copied: 'Lien copié',
  regenerate: 'Régénérer', revoke: 'Révoquer',
  lastSeen: date => `Dernière visite du client : ${date}`,
  neverSeen: 'Le client n\'a pas encore ouvert son espace.',
  confirmRegenerate: 'Générer un nouveau code ? L\'ancien lien ne fonctionnera plus.',
  confirmRevoke: 'Révoquer l\'accès ? Le client ne pourra plus ouvrir son espace.',
};

const EN = {
  title: 'Client access',
  hint: 'The client sees the shared, published programs (Missions, Rewards, Referral, VIP tiers), comments on them and approves them.',
  generate: 'Generate client access',
  code: 'Code',
  copy: 'Copy link', copied: 'Link copied',
  regenerate: 'Regenerate', revoke: 'Revoke',
  lastSeen: date => `Client's last visit: ${date}`,
  neverSeen: 'The client has not opened their space yet.',
  confirmRegenerate: 'Generate a new code? The previous link will stop working.',
  confirmRevoke: 'Revoke access? The client will no longer open their space.',
};

export default function ClientAccessCard({ lang, folderKey }) {
  const t = lang === 'fr' ? FR : EN;
  const [access, setAccess] = useState(undefined); // undefined while loading, null when none
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getActiveAccess(folderKey)
      .then(a => { if (!cancelled) setAccess(a); })
      .catch(err => { if (!cancelled) { setError(err.message); setAccess(null); } });
    return () => { cancelled = true; };
  }, [folderKey]);

  const run = async (action) => {
    setBusy(true);
    setError('');
    try {
      setAccess(await action());
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  const generate = () => run(() => createAccess(folderKey));
  const regenerate = () => { if (confirm(t.confirmRegenerate)) generate(); };
  const revoke = () => {
    if (confirm(t.confirmRevoke)) run(async () => { await revokeAccess(folderKey); return null; });
  };
  const copyLink = async () => {
    await navigator.clipboard.writeText(clientPortalUrl(access.code));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = iso => new Date(iso).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-[10px] bg-[#ECFDF5] text-[#047857] flex items-center justify-center shrink-0">
          <KeyRound size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold text-[#2B251F]">{t.title}</div>
          <p className="text-[12px] text-[#8A7D6B]">{t.hint}</p>

          {access === undefined ? (
            <Loader2 size={16} className="animate-spin text-primary mt-3" />
          ) : access === null ? (
            <button onClick={generate} disabled={busy} className="btn-primary mt-3">
              {busy ? <Loader2 size={14} className="animate-spin" /> : <KeyRound size={14} />} {t.generate}
            </button>
          ) : (
            <div className="mt-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <input readOnly value={clientPortalUrl(access.code)} onFocus={e => e.target.select()}
                  className="flex-1 min-w-[240px] px-2 py-1.5 text-[12px] rounded-lg" aria-label={t.title} />
                <button onClick={copyLink} className="btn-primary text-[12px]">
                  {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? t.copied : t.copy}
                </button>
              </div>
              <div className="flex items-center gap-3 flex-wrap text-[12px]">
                <span className="text-[#8A7D6B]">{t.code}</span>
                <span className="font-mono text-[14px] font-semibold tracking-wider text-[#2B251F]" data-testid="access-code">{formatAccessCode(access.code)}</span>
                <span className="text-[#8A7D6B]">· {access.last_seen_at ? t.lastSeen(formatDate(access.last_seen_at)) : t.neverSeen}</span>
                <span className="ml-auto flex items-center gap-3">
                  <button onClick={regenerate} disabled={busy} className="text-[#645648] hover:text-primary inline-flex items-center gap-1"><RefreshCw size={12} /> {t.regenerate}</button>
                  <button onClick={revoke} disabled={busy} className="text-[#645648] hover:text-red-500 inline-flex items-center gap-1"><Ban size={12} /> {t.revoke}</button>
                </span>
              </div>
            </div>
          )}
          {error && <p className="mt-2 text-[12px] text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}
