import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Folder, Loader2, AlertCircle, ArrowRight, FolderOpen } from 'lucide-react';
import { listPrograms } from '../utils/programStore';
import { listCommentsToHandle } from '../utils/clientPortalStore';
import { groupProgramsIntoFolders, isMyFolder, matchesFolderSearch } from '../utils/clientFolders';

const FR = {
  title: 'Espace clients',
  subtitle: 'Un dossier par client, avec tous ses programmes. Partagé avec toute l\'équipe.',
  newClient: 'Nouveau client',
  manual: 'Configurer sans HubSpot',
  search: 'Rechercher un client ou un programme…',
  all: 'Tous',
  mine: 'Mes dossiers',
  loading: 'Chargement des dossiers…',
  empty: 'Aucun dossier pour l\'instant',
  emptyHint: 'Choisissez un client HubSpot pour créer son dossier et son premier programme.',
  noMatch: 'Aucun dossier ne correspond',
  outsideHubspot: 'Hors HubSpot',
  programs: n => `${n} programme${n > 1 ? 's' : ''}`,
  toHandle: n => `💬 ${n} à traiter`,
  updated: (date, by) => `Modifié le ${date}${by ? ` par ${by}` : ''}`,
  dbError: 'Base de données : ',
};

const EN = {
  title: 'Client space',
  subtitle: 'One folder per client, with all its programs. Shared with the whole team.',
  newClient: 'New client',
  manual: 'Set up without HubSpot',
  search: 'Search a client or a program…',
  all: 'All',
  mine: 'My folders',
  loading: 'Loading folders…',
  empty: 'No folder yet',
  emptyHint: 'Pick a HubSpot client to create its folder and first program.',
  noMatch: 'No matching folder',
  outsideHubspot: 'Outside HubSpot',
  programs: n => `${n} program${n > 1 ? 's' : ''}`,
  toHandle: n => `💬 ${n} to handle`,
  updated: (date, by) => `Updated ${date}${by ? ` by ${by}` : ''}`,
  dbError: 'Database: ',
};

export default function ClientSpace({ lang, userEmail, onOpenFolder, onNewClient, onManual }) {
  const t = lang === 'fr' ? FR : EN;
  const [folders, setFolders] = useState(null);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [onlyMine, setOnlyMine] = useState(false);
  const [toHandle, setToHandle] = useState({}); // programId → { count, page } of client comments

  useEffect(() => {
    let cancelled = false;
    listPrograms()
      .then(list => { if (!cancelled) setFolders(groupProgramsIntoFolders(list)); })
      .catch(err => { if (!cancelled) { setError(err.message); setFolders([]); } });
    listCommentsToHandle()
      .then(counts => { if (!cancelled) setToHandle(counts); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const toHandleIn = folder => folder.programs.reduce((n, p) => n + (toHandle[p.id]?.count || 0), 0);

  const shown = useMemo(() => (folders || [])
    .filter(f => !onlyMine || isMyFolder(f, userEmail))
    .filter(f => matchesFolderSearch(f, search)), [folders, onlyMine, userEmail, search]);

  const formatDate = iso => new Date(iso).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FolderOpen size={20} className="text-primary" />
            <h1 className="text-[24px] font-bold text-[#52473C]">{t.title}</h1>
          </div>
          <p className="text-[14px] text-[#8A7D6B]">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onManual} className="btn-secondary">{t.manual}</button>
          <button onClick={onNewClient} className="btn-primary"><Plus size={14} /> {t.newClient}</button>
        </div>
      </div>

      {error && (
        <div className="card text-[12px] text-red-600 flex items-center gap-2">
          <AlertCircle size={14} className="shrink-0" /> {t.dbError}{error}
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A7D6B]" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder={t.search}
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-[#D9D5CB] bg-[#EEEDE6] text-[13px] text-[#52473C] placeholder:text-[#8A7D6B] focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <div className="flex items-center gap-1">
          {[[false, t.all], [true, t.mine]].map(([mine, label]) => (
            <button key={label} onClick={() => setOnlyMine(mine)}
              className={`px-3 py-1 rounded-full text-[12px] font-medium border transition-all ${
                onlyMine === mine ? 'bg-primary/10 text-primary border-primary/30' : 'text-[#8A7D6B] border-transparent hover:bg-[#E5E1D8]'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Keyed states: the global transition must not morph one into another */}
      {folders === null ? (
        <div key="loading" className="card text-center py-12">
          <Loader2 size={24} className="animate-spin mx-auto text-primary mb-3" />
          <p className="text-[13px] text-[#8A7D6B]">{t.loading}</p>
        </div>
      ) : folders.length === 0 ? (
        <div key="empty" className="card text-center py-12">
          <Folder size={28} className="mx-auto text-[#D9D5CB] mb-3" />
          <p className="text-[15px] font-semibold text-[#52473C]">{t.empty}</p>
          <p className="text-[13px] text-[#8A7D6B] mt-1 mb-4">{t.emptyHint}</p>
          <button onClick={onNewClient} className="btn-primary mx-auto"><Plus size={14} /> {t.newClient}</button>
        </div>
      ) : shown.length === 0 ? (
        <div key="no-match" className="card text-center py-10 text-[13px] text-[#8A7D6B]">{t.noMatch}</div>
      ) : (
        <div key="folders" className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {shown.map(folder => (
            <button key={folder.key} onClick={() => onOpenFolder(folder.key)}
              className="card text-left hover:border-primary/40 transition-all group" style={{ padding: 16 }}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-[10px] bg-[#E8EFFE] text-primary flex items-center justify-center shrink-0">
                  <Folder size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[15px] font-semibold text-[#2B251F] truncate">{folder.name}</div>
                  <div className="text-[12px] text-[#8A7D6B] truncate">{folder.domain || '—'}</div>
                </div>
                {folder.hubspotCompanyId
                  ? folder.plan && <span className="pill pill-purple text-[10px] shrink-0">{folder.plan}</span>
                  : <span className="pill text-[10px] shrink-0 bg-[#F5F4F0] text-[#8A7D6B]">{t.outsideHubspot}</span>}
              </div>
              <div className="mt-3 pt-3 border-t border-[#E5E1D8] flex items-center justify-between gap-2 text-[12px]">
                <span className="font-medium text-[#52473C] whitespace-nowrap">{t.programs(folder.programs.length)}</span>
                {toHandleIn(folder) > 0 && (
                  <span className="pill text-[10px] bg-primary/10 text-primary whitespace-nowrap">{t.toHandle(toHandleIn(folder))}</span>
                )}
                <span className="text-[#8A7D6B] truncate">
                  {t.updated(formatDate(folder.updated_at), folder.updatedBy?.split('@')[0])}
                </span>
                <ArrowRight size={13} className="text-[#D9D5CB] group-hover:text-primary shrink-0" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
