import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Briefcase, Loader2, AlertCircle, Check, Ban, RotateCcw, Folder, ExternalLink } from 'lucide-react';
import { listAgencies, setAgencyStatus, pendingCount } from '../utils/agencyStore';
import { listPrograms } from '../utils/programStore';
import { groupProgramsIntoFolders } from '../utils/clientFolders';

// ════════════════════════════════════════════════════════════════════
// Partner agencies — the Loyoly team reviews the agencies' accounts
// ════════════════════════════════════════════════════════════════════
// An agency signing up at /agency waits here until approved; approved, it
// uses the tool on its own folders. Suspending it cuts its access at once
// (its programs stay, visible to the team).

const FR = {
  back: 'Espace clients',
  title: 'Agences partenaires',
  subtitle: 'Les agences créent leur compte depuis /agency ; elles accèdent à l\'outil une fois validées.',
  loading: 'Chargement des agences…',
  empty: 'Aucune agence inscrite pour l\'instant.',
  status: { pending: 'En attente', approved: 'Validée', suspended: 'Suspendue' },
  approve: 'Valider', suspend: 'Suspendre', reactivate: 'Réactiver',
  confirmSuspend: name => `Suspendre l'accès de ${name} à l'outil ?`,
  members: 'Membres',
  signedUp: date => `Inscrite le ${date}`,
  reviewed: (date, by) => `Revue le ${date}${by ? ` par ${by.split('@')[0]}` : ''}`,
  folders: n => `${n} dossier${n > 1 ? 's' : ''}`,
  programs: n => `${n} programme${n > 1 ? 's' : ''}`,
  analyses: n => `${n} analyse${n > 1 ? 's' : ''} IA`,
  noFolder: 'Aucun dossier pour l\'instant',
};
const EN = {
  back: 'Client space',
  title: 'Partner agencies',
  subtitle: 'Agencies sign up at /agency; they get the tool once approved.',
  loading: 'Loading agencies…',
  empty: 'No agency signed up yet.',
  status: { pending: 'Pending', approved: 'Approved', suspended: 'Suspended' },
  approve: 'Approve', suspend: 'Suspend', reactivate: 'Reactivate',
  confirmSuspend: name => `Suspend ${name}'s access to the tool?`,
  members: 'Members',
  signedUp: date => `Signed up on ${date}`,
  reviewed: (date, by) => `Reviewed on ${date}${by ? ` by ${by.split('@')[0]}` : ''}`,
  folders: n => `${n} folder${n > 1 ? 's' : ''}`,
  programs: n => `${n} program${n > 1 ? 's' : ''}`,
  analyses: n => `${n} AI analys${n > 1 ? 'es' : 'is'}`,
  noFolder: 'No folder yet',
};

const STATUS_STYLE = {
  pending: 'bg-[#FEF3C7] text-[#92400E]',
  approved: 'bg-[#ECFDF5] text-[#047857]',
  suspended: 'bg-[#FEF2F2] text-[#B91C1C]',
};
const ORDER = { pending: 0, approved: 1, suspended: 2 };

export default function AgenciesAdmin({ lang, onBack, onOpenFolder, onPendingChange }) {
  const t = lang === 'fr' ? FR : EN;
  const [agencies, setAgencies] = useState(null);
  const [folders, setFolders] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);

  const refresh = useCallback(() => Promise.all([listAgencies(), listPrograms()])
    .then(([list, programs]) => {
      setAgencies([...list].sort((a, b) => ORDER[a.status] - ORDER[b.status]));
      setFolders(groupProgramsIntoFolders(programs.filter(p => p.agency_id)));
      onPendingChange?.(pendingCount(list));
    })
    .catch(err => { setError(err.message); setAgencies(a => a ?? []); }), [onPendingChange]);

  useEffect(() => { refresh(); }, [refresh]);

  const review = async (agency, status) => {
    if (status === 'suspended' && !confirm(t.confirmSuspend(agency.name))) return;
    setBusy(agency.id);
    setError('');
    try {
      await setAgencyStatus(agency.id, status);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
    setBusy(null);
  };

  const date = iso => new Date(iso).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { dateStyle: 'medium' });

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <button onClick={onBack} className="text-[13px] text-[#645648] hover:text-primary inline-flex items-center gap-1">
        <ChevronLeft size={14} /> {t.back}
      </button>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Briefcase size={20} className="text-primary" />
          <h1 className="text-[24px] font-bold text-[#52473C]">{t.title}</h1>
        </div>
        <p className="text-[14px] text-[#8A7D6B]">{t.subtitle}</p>
      </div>

      {error && (
        <div className="card text-[12px] text-red-600 flex items-center gap-2">
          <AlertCircle size={14} className="shrink-0" /> {error}
        </div>
      )}

      {agencies === null ? (
        <div key="loading" className="card text-center py-12">
          <Loader2 size={24} className="animate-spin mx-auto text-primary mb-3" />
          <p className="text-[13px] text-[#8A7D6B]">{t.loading}</p>
        </div>
      ) : agencies.length === 0 ? (
        <div key="empty" className="card text-center py-12 text-[13px] text-[#8A7D6B]">{t.empty}</div>
      ) : (
        <div key="list" className="space-y-3">
          {agencies.map(agency => {
            const own = folders.filter(f => f.agencyId === agency.id);
            const programCount = own.reduce((n, f) => n + f.programs.length, 0);
            return (
              <div key={agency.id} className="card space-y-3" data-testid="agency-row">
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-[220px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[16px] font-semibold text-[#2B251F]">{agency.name}</span>
                      <span className={`pill text-[10px] ${STATUS_STYLE[agency.status]}`}>{t.status[agency.status]}</span>
                    </div>
                    <div className="text-[12px] text-[#8A7D6B] mt-0.5 flex items-center gap-2 flex-wrap">
                      {agency.website && (
                        <a href={/^https?:\/\//.test(agency.website) ? agency.website : `https://${agency.website}`} target="_blank" rel="noreferrer"
                          className="inline-flex items-center gap-1 hover:text-primary">
                          {agency.website} <ExternalLink size={11} />
                        </a>
                      )}
                      <span>{t.signedUp(date(agency.created_at))}</span>
                      {agency.reviewed_at && <span>· {t.reviewed(date(agency.reviewed_at), agency.reviewed_by)}</span>}
                    </div>
                    <div className="text-[12px] text-[#645648] mt-1">
                      {t.members} : {agency.members.map(m => m.email).join(', ') || '—'}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {busy === agency.id && <Loader2 size={14} className="animate-spin text-primary" />}
                    {agency.status !== 'approved' && (
                      <button onClick={() => review(agency, 'approved')} disabled={busy !== null} className="btn-primary">
                        {agency.status === 'pending' ? <Check size={14} /> : <RotateCcw size={14} />}
                        {agency.status === 'pending' ? t.approve : t.reactivate}
                      </button>
                    )}
                    {agency.status !== 'suspended' && (
                      <button onClick={() => review(agency, 'suspended')} disabled={busy !== null} className="btn-secondary">
                        <Ban size={14} /> {t.suspend}
                      </button>
                    )}
                  </div>
                </div>
                <div className="pt-3 border-t border-[#E5E1D8] text-[12px]">
                  <div className="text-[#645648] mb-2">
                    {t.folders(own.length)} · {t.programs(programCount)} · {t.analyses(agency.analyses)}
                  </div>
                  {own.length === 0 ? (
                    <span className="text-[#B0A595]">{t.noFolder}</span>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {own.map(f => (
                        <button key={f.key} onClick={() => onOpenFolder(f.key)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-[#E5E1D8] hover:border-primary/40 text-[#52473C]">
                          <Folder size={12} className="text-primary" /> {f.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
