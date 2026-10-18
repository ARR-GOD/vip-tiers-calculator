import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, Plus, Folder, Loader2, AlertCircle, Copy, Pencil, Trash2, ArrowRight, Check, X } from 'lucide-react';
import { listPrograms, deleteProgram, renameProgram, duplicateProgram } from '../utils/programStore';
import { groupProgramsIntoFolders, nextProgramName, copyName } from '../utils/clientFolders';
import { listComments, listValidations, setProgramShared } from '../utils/clientPortalStore';
import { CLIENT_PAGES } from '../utils/clientView';
import ClientAccessCard from './ClientAccessCard';

const FR = {
  space: 'Espace clients',
  newProgram: 'Nouveau programme',
  loading: 'Chargement du dossier…',
  empty: 'Ce dossier est vide.',
  outsideHubspot: 'Hors HubSpot',
  programs: n => `${n} programme${n > 1 ? 's' : ''}`,
  tiers: n => `${n} paliers`,
  customers: n => (n > 0 ? `${n.toLocaleString('fr-FR')} clients importés` : 'Données client à importer'),
  updated: (date, by) => `modifié le ${date}${by ? ` par ${by}` : ''}`,
  rename: 'Renommer', duplicate: 'Dupliquer', remove: 'Supprimer',
  confirmDelete: name => `Supprimer le programme « ${name} » pour toute l'équipe ?`,
  published: (v, date) => `Publié v${v} le ${date}`,
  notPublished: 'Non publié',
  shared: 'Visible par le client',
  openComments: n => `${n} commentaire${n > 1 ? 's' : ''} ouvert${n > 1 ? 's' : ''}`,
  validated: (n, total) => `${n}/${total} pages validées`,
};

const EN = {
  space: 'Client space',
  newProgram: 'New program',
  loading: 'Loading folder…',
  empty: 'This folder is empty.',
  outsideHubspot: 'Outside HubSpot',
  programs: n => `${n} program${n > 1 ? 's' : ''}`,
  tiers: n => `${n} tiers`,
  customers: n => (n > 0 ? `${n.toLocaleString('en-US')} customers imported` : 'Customer data to import'),
  updated: (date, by) => `updated ${date}${by ? ` by ${by}` : ''}`,
  rename: 'Rename', duplicate: 'Duplicate', remove: 'Delete',
  confirmDelete: name => `Delete the "${name}" program for the whole team?`,
  published: (v, date) => `Published v${v} on ${date}`,
  notPublished: 'Not published',
  shared: 'Visible to the client',
  openComments: n => `${n} open comment${n > 1 ? 's' : ''}`,
  validated: (n, total) => `${n}/${total} pages approved`,
};

export default function ClientFolder({ lang, folderKey, onBack, onOpenProgram, onNewProgram }) {
  const t = lang === 'fr' ? FR : EN;
  const [folder, setFolder] = useState(undefined); // undefined while loading, null when empty
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);           // id of the program being acted on, or 'new'
  const [editing, setEditing] = useState(null);     // { id, name } while renaming
  const [activity, setActivity] = useState({});     // programId → { open, validated } (client portal)

  const refresh = useCallback(() => listPrograms()
    .then(async list => {
      const found = groupProgramsIntoFolders(list).find(f => f.key === folderKey) || null;
      setFolder(found);
      if (!found) return;
      const ids = found.programs.map(p => p.id);
      const [comments, validations] = await Promise.all([listComments(ids), listValidations(ids)]);
      setActivity(Object.fromEntries(found.programs.map(p => [p.id, {
        open: comments.filter(c => c.programId === p.id && !c.resolved).length,
        validated: new Set(validations
          .filter(v => v.program_id === p.id && v.published_version === p.published_version)
          .map(v => v.page)).size,
      }])));
    })
    .catch(err => { setError(err.message); setFolder(f => f ?? null); }), [folderKey]);
  useEffect(() => { refresh(); }, [refresh]);

  // Every action reports its error here and reloads the folder.
  const run = async (id, action) => {
    setBusy(id);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(err.message);
    }
    setBusy(null);
  };

  const open = id => run(id, () => onOpenProgram(id));
  const create = () => run('new', () => onNewProgram(folder, nextProgramName(folder, lang)));
  const duplicate = p => run(p.id, async () => {
    await duplicateProgram(p.id, copyName(p.program_name, folder, lang));
    await refresh();
  });
  const remove = p => {
    if (!confirm(t.confirmDelete(p.program_name))) return;
    run(p.id, async () => {
      await deleteProgram(p.id);
      await refresh();
    });
  };
  const toggleShared = p => run(p.id, async () => {
    await setProgramShared(p.id, !p.shared_with_client);
    await refresh();
  });
  const saveName = () => {
    const { id, name } = editing;
    setEditing(null);
    if (!name.trim()) return;
    run(id, async () => {
      await renameProgram(id, name.trim());
      await refresh();
    });
  };

  const formatDate = iso => new Date(iso).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });
  const iconButton = 'w-8 h-8 flex items-center justify-center rounded-lg text-[#8A7D6B] hover:bg-white transition-all disabled:opacity-40';

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <button onClick={onBack} className="text-[13px] text-[#645648] hover:text-primary inline-flex items-center gap-1">
        <ChevronLeft size={14} /> {t.space}
      </button>

      {/* Keyed states: the global transition must not morph one into another */}
      {folder === undefined ? (
        <div key="loading" className="card text-center py-12">
          <Loader2 size={24} className="animate-spin mx-auto text-primary mb-3" />
          <p className="text-[13px] text-[#8A7D6B]">{t.loading}</p>
        </div>
      ) : folder === null ? (
        <div key="empty" className="card text-center py-12 text-[13px] text-[#8A7D6B]">
          {error ? <span className="text-red-600">{error}</span> : t.empty}
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-[12px] bg-[#E8EFFE] text-primary flex items-center justify-center">
                <Folder size={20} />
              </div>
              <div>
                <h1 className="text-[24px] font-bold text-[#52473C] leading-tight">{folder.name}</h1>
                <div className="flex items-center gap-2 text-[12px] text-[#8A7D6B] mt-0.5">
                  {folder.domain && <span>{folder.domain}</span>}
                  {folder.hubspotCompanyId
                    ? folder.plan && <span className="pill pill-purple text-[10px]">{folder.plan}</span>
                    : <span className="pill text-[10px] bg-[#F5F4F0] text-[#8A7D6B]">{t.outsideHubspot}</span>}
                  <span>· {t.programs(folder.programs.length)}</span>
                </div>
              </div>
            </div>
            <button onClick={create} disabled={busy !== null} className="btn-primary">
              {busy === 'new' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} {t.newProgram}
            </button>
          </div>

          <ClientAccessCard lang={lang} folderKey={folder.key} />

          {error && (
            <div className="card text-[12px] text-red-600 flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" /> {error}
            </div>
          )}

          <div key="programs" className="card" style={{ padding: 8 }}>
            {folder.programs.map(p => (
              <div key={p.id} className="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-[#F5F4F0] transition-all">
                {editing?.id === p.id ? (
                  <div className="flex-1 flex items-center gap-1">
                    <input autoFocus value={editing.name}
                      onChange={e => setEditing({ id: p.id, name: e.target.value })}
                      onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditing(null); }}
                      className="flex-1 px-2 py-1 text-[14px]" aria-label={t.rename} />
                    <button onClick={saveName} className={iconButton} title={t.rename}><Check size={14} /></button>
                    <button onClick={() => setEditing(null)} className={iconButton}><X size={14} /></button>
                  </div>
                ) : (
                  <div className="flex-1 min-w-0">
                    <button onClick={() => open(p.id)} disabled={busy !== null} className="program-open block w-full text-left disabled:opacity-60">
                      <div className="text-[14px] font-semibold text-[#2B251F] truncate">{p.program_name}</div>
                      <div className="text-[12px] text-[#8A7D6B] truncate">
                        {t.tiers(p.tier_count ?? 0)} · {t.customers(p.customers_count ?? 0)} · {t.updated(formatDate(p.updated_at), p.updated_by?.split('@')[0])}
                      </div>
                    </button>
                    {/* Client portal: publication, visibility, comments, approvals */}
                    <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[11px]">
                      {p.published_version > 0 ? (
                        <>
                          <span className="pill text-[10px] bg-[#ECFDF5] text-[#047857]">
                            {t.published(p.published_version, new Date(p.published_at).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US'))}
                          </span>
                          <label className="inline-flex items-center gap-1 text-[#645648] cursor-pointer">
                            <input type="checkbox" checked={!!p.shared_with_client} onChange={() => toggleShared(p)} disabled={busy !== null} />
                            {t.shared}
                          </label>
                          <span className="text-[#047857]">✓ {t.validated(activity[p.id]?.validated ?? 0, CLIENT_PAGES.length)}</span>
                        </>
                      ) : (
                        <span className="pill text-[10px] bg-[#F5F4F0] text-[#8A7D6B]">{t.notPublished}</span>
                      )}
                      {activity[p.id]?.open > 0 && <span className="text-primary">💬 {t.openComments(activity[p.id].open)}</span>}
                    </div>
                  </div>
                )}
                {editing?.id !== p.id && (
                  <>
                    <button onClick={() => setEditing({ id: p.id, name: p.program_name })} disabled={busy !== null} className={`${iconButton} hover:text-[#2B251F]`} title={t.rename}><Pencil size={14} /></button>
                    <button onClick={() => duplicate(p)} disabled={busy !== null} className={`${iconButton} hover:text-[#2B251F]`} title={t.duplicate}><Copy size={14} /></button>
                    <button onClick={() => remove(p)} disabled={busy !== null} className={`${iconButton} hover:text-red-500`} title={t.remove}><Trash2 size={14} /></button>
                    {busy === p.id
                      ? <Loader2 size={14} className="animate-spin text-primary shrink-0" />
                      : <ArrowRight size={14} className="text-[#D9D5CB] shrink-0" />}
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
