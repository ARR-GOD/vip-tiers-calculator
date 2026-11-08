import { useState } from 'react';
import { Plus, Trash2, ExternalLink, AlertCircle } from 'lucide-react';
import { CHECKLIST_STATUSES, CHECKLIST_OWNERS } from '../utils/checklist';

// ════════════════════════════════════════════════════════════════════
// Launch checklist board — shared by the CSM step and the client portal
// ════════════════════════════════════════════════════════════════════
// `checklist` comes from utils/checklist.js (buildChecklist). Changes go
// through onPatch(key, { status | owner | dueDate | note }), onAdd(phase,
// label) and onDelete(key) (added tasks only).

const FR = {
  progress: (done, total) => `${done} / ${total} étapes faites`,
  status: { todo: 'À faire', in_progress: 'En cours', done: 'Fait', na: 'Non concerné' },
  owner: { '': 'Responsable…', loyoly: 'Loyoly', brand: 'Marque', both: 'Les deux' },
  statusLabel: 'Statut', ownerLabel: 'Responsable', dateLabel: 'Date prévue', notesLabel: 'Notes',
  addNote: 'Note', notePlaceholder: 'Ajouter une note…',
  show: 'Afficher', all: 'Toutes', forLoyoly: 'Loyoly', forBrand: 'Marque', hideDone: 'Masquer les étapes faites',
  addTask: 'Ajouter une tâche', newTask: 'Nouvelle tâche', add: 'Ajouter', cancel: 'Annuler', remove: 'Supprimer',
  addedTasks: 'Tâches ajoutées',
  by: { client: 'marque', csm: 'Loyoly' },
  updated: (who, type, date) => `Modifié par ${who}${type ? ` (${type})` : ''} le ${date}`,
  missing: { cms: 'CMS', crm: 'CRM', international: 'international', languagesCurrencies: 'langues et devises', physicalStore: 'boutique physique', posSystem: 'caisse' },
  missingCsm: (list, n) => `Informations de setup à compléter : ${list}. ${n} étape${n > 1 ? 's' : ''} en attente.`,
  missingClient: n => `${n} étape${n > 1 ? 's' : ''} s'ajouteront quand votre CSM Loyoly aura complété les informations de setup.`,
  goToSetup: 'Compléter la Configuration',
  nothing: 'Aucune étape à afficher avec ces filtres.',
  confirmRemove: label => `Supprimer la tâche « ${label} » ?`,
};
const EN = {
  progress: (done, total) => `${done} / ${total} steps done`,
  status: { todo: 'To do', in_progress: 'In progress', done: 'Done', na: 'Not applicable' },
  owner: { '': 'Owner…', loyoly: 'Loyoly', brand: 'Brand', both: 'Both' },
  statusLabel: 'Status', ownerLabel: 'Owner', dateLabel: 'Due date', notesLabel: 'Notes',
  addNote: 'Note', notePlaceholder: 'Add a note…',
  show: 'Show', all: 'All', forLoyoly: 'Loyoly', forBrand: 'Brand', hideDone: 'Hide the steps done',
  addTask: 'Add a task', newTask: 'New task', add: 'Add', cancel: 'Cancel', remove: 'Remove',
  addedTasks: 'Added tasks',
  by: { client: 'brand', csm: 'Loyoly' },
  updated: (who, type, date) => `Changed by ${who}${type ? ` (${type})` : ''} on ${date}`,
  missing: { cms: 'CMS', crm: 'CRM', international: 'international', languagesCurrencies: 'languages and currencies', physicalStore: 'physical store', posSystem: 'POS system' },
  missingCsm: (list, n) => `Setup information to complete: ${list}. ${n} step${n > 1 ? 's' : ''} waiting.`,
  missingClient: n => `${n} more step${n > 1 ? 's' : ''} will show once your Loyoly CSM has completed the setup information.`,
  goToSetup: 'Complete the Configuration',
  nothing: 'No step to show with these filters.',
  confirmRemove: label => `Remove the task "${label}"?`,
};

// Inline: the global select / textarea rules (index.css) set a 40 px height.
const STATUS_STYLE = {
  todo: { background: '#EEEDE6', color: '#645648' },
  in_progress: { background: '#FEF3C7', color: '#92400E' },
  done: { background: '#D1FAE5', color: '#047857' },
  na: { background: '#F3F4F6', color: '#9CA3AF' },
};
const CONTROL = { height: 30, fontSize: 12, borderRadius: 8 };

const isClosed = item => item.status === 'done' || item.status === 'na';

export default function ChecklistBoard({ lang, audience, title, subtitle, checklist, onPatch, onAdd, onDelete, onGoToSetup }) {
  const t = lang === 'fr' ? FR : EN;
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [hideDone, setHideDone] = useState(false);
  const visible = item => (!hideDone || !isClosed(item))
    && (ownerFilter === 'all' || item.owner === ownerFilter || item.owner === 'both');
  const { done, total } = checklist.progress;
  const percent = total ? Math.round((done / total) * 100) : 0;
  const missingList = checklist.missing.map(key => t.missing[key]).join(', ');
  const anyVisible = checklist.phases.some(p => [...p.groups.flatMap(g => g.items), ...p.custom].some(visible));

  return (
    <div className="space-y-3" data-testid="checklist">
      <section className="card" style={{ padding: 18 }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            {title && <h2 className="text-[18px] font-bold text-[#2B251F]">{title}</h2>}
            {subtitle && <p className="text-[13px] text-[#8A7D6B] mt-0.5">{subtitle}</p>}
          </div>
          <div className="w-full sm:w-[260px]">
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="font-semibold text-[#2B251F]" data-testid="checklist-progress">{t.progress(done, total)}</span>
              <span className="text-[#8A7D6B]">{percent} %</span>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-[#EEEDE6] overflow-hidden">
              <div className="h-full bg-[#059669] rounded-full transition-all" style={{ width: `${percent}%` }} />
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px]">
          <div className="flex items-center gap-1" role="group" aria-label={t.ownerLabel}>
            <span className="text-[#8A7D6B] mr-1">{t.show}</span>
            {[['all', t.all], ['loyoly', t.forLoyoly], ['brand', t.forBrand]].map(([key, label]) => (
              <button key={key} type="button" onClick={() => setOwnerFilter(key)} aria-pressed={ownerFilter === key}
                className={`px-2.5 py-1 rounded-full font-medium ${ownerFilter === key ? 'bg-primary text-white' : 'bg-[#EEEDE6] text-[#645648] hover:bg-[#E5E1D8]'}`}>
                {label}
              </button>
            ))}
          </div>
          <label className="inline-flex items-center gap-1.5 text-[#645648] cursor-pointer">
            <input type="checkbox" checked={hideDone} onChange={e => setHideDone(e.target.checked)} />
            {t.hideDone}
          </label>
        </div>
        {checklist.pending > 0 && (
          <div className="mt-3 rounded-[10px] bg-[#FFFBEB] border border-[#FDE68A] px-3 py-2 text-[12px] text-[#92400E] flex flex-wrap items-center gap-2">
            <AlertCircle size={14} className="shrink-0" />
            <span>{audience === 'csm' ? t.missingCsm(missingList, checklist.pending) : t.missingClient(checklist.pending)}</span>
            {audience === 'csm' && onGoToSetup && (
              <button type="button" onClick={onGoToSetup} className="font-semibold underline">{t.goToSetup}</button>
            )}
          </div>
        )}
      </section>

      {!anyVisible && <div className="card text-[13px] text-[#8A7D6B]">{t.nothing}</div>}

      {checklist.phases.map(phase => {
        const items = [...phase.groups.flatMap(g => g.items), ...phase.custom];
        const counted = items.filter(i => i.status !== 'na');
        const groups = phase.groups.map(g => ({ ...g, items: g.items.filter(visible) })).filter(g => g.items.length);
        const custom = phase.custom.filter(visible);
        return (
          <section key={phase.key} className="card" style={{ padding: 18 }} data-phase={phase.key}>
            <div className="flex items-center justify-between gap-3 mb-1">
              <h3 className="text-[15px] font-bold text-[#2B251F]">{phase.icon} {phase.label}</h3>
              <span className="text-[12px] text-[#8A7D6B] whitespace-nowrap">
                {counted.filter(i => i.status === 'done').length} / {counted.length}
              </span>
            </div>
            {groups.map(group => (
              <div key={group.key || 'all'} className="mt-2">
                {group.label && <div className="text-[11px] font-semibold uppercase tracking-wide text-[#8A7D6B] mt-3 mb-0.5">{group.label}</div>}
                <ul>{group.items.map(item => <ItemRow key={item.key} t={t} lang={lang} item={item} onPatch={onPatch} onDelete={onDelete} />)}</ul>
              </div>
            ))}
            {custom.length > 0 && (
              <div className="mt-2">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-[#8A7D6B] mt-3 mb-0.5">{t.addedTasks}</div>
                <ul>{custom.map(item => <ItemRow key={item.key} t={t} lang={lang} item={item} onPatch={onPatch} onDelete={onDelete} />)}</ul>
              </div>
            )}
            <div className="mt-3">
              <AddTask t={t} phase={phase} onAdd={onAdd} />
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ItemRow({ t, lang, item, onPatch, onDelete }) {
  const closed = isClosed(item);
  const date = item.updatedAt && new Date(item.updatedAt).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US', { day: 'numeric', month: 'short' });
  return (
    <li className="py-2.5 border-t border-[#EEEDE6] first:border-t-0" data-item={`checklist:${item.key}`}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <select value={item.status} aria-label={`${t.statusLabel} ${item.label}`}
          onChange={e => onPatch(item.key, { status: e.target.value })}
          className="px-2.5 shrink-0 w-[124px] font-semibold"
          style={{ ...CONTROL, ...STATUS_STYLE[item.status], border: 'none', borderRadius: 999 }}>
          {CHECKLIST_STATUSES.map(s => <option key={s} value={s}>{t.status[s]}</option>)}
        </select>
        <div className="flex-1 min-w-[220px]">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`text-[13px] font-medium ${closed ? 'text-[#8A7D6B] line-through' : 'text-[#2B251F]'}`}>{item.label}</span>
            {item.tag && <span className="inline-flex items-center px-2 py-px rounded-full text-[10px] font-semibold bg-[#EEF3FF] text-primary">{item.tag}</span>}
          </div>
          {(item.hint || item.guides.length > 0) && (
            <div className="mt-0.5 text-[12px] text-[#8A7D6B] flex flex-wrap items-center gap-x-3 gap-y-0.5">
              {item.hint && <span>{item.hint}</span>}
              {item.guides.map(guide => (
                <a key={guide.url} href={guide.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-primary hover:underline">
                  {guide.title} <ExternalLink size={10} />
                </a>
              ))}
            </div>
          )}
          <NoteField key={`${item.key}:${item.note}`} t={t} item={item} onSave={note => onPatch(item.key, { note })} />
          {item.updatedAt && item.updatedByName && (
            <div className="text-[11px] text-[#B0A595] mt-0.5">{t.updated(item.updatedByName, t.by[item.updatedByType], date)}</div>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <select value={item.owner || ''} aria-label={`${t.ownerLabel} ${item.label}`}
            onChange={e => onPatch(item.key, { owner: e.target.value || null })}
            className="px-2 w-[118px]" style={{ ...CONTROL, color: item.owner ? '#2B251F' : '#8A7D6B' }}>
            {['', ...CHECKLIST_OWNERS].map(o => <option key={o} value={o}>{t.owner[o]}</option>)}
          </select>
          <input type="date" value={item.dueDate || ''} aria-label={`${t.dateLabel} ${item.label}`}
            onChange={e => onPatch(item.key, { dueDate: e.target.value || null })}
            className="px-2 w-[136px] border border-[#E5E1D8] bg-white text-[#2B251F]" style={CONTROL} />
          {item.custom && (
            <button type="button" title={t.remove} aria-label={`${t.remove} ${item.label}`}
              onClick={() => { if (window.confirm(t.confirmRemove(item.label))) onDelete(item.key); }}
              className="text-[#B0A595] hover:text-red-600"><Trash2 size={14} /></button>
          )}
        </div>
      </div>
    </li>
  );
}

// The team's note on a step: saved when the field is left.
function NoteField({ t, item, onSave }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(item.note || '');
  if (!item.note && !open) {
    return (
      <button type="button" onClick={() => setOpen(true)} aria-label={`${t.addNote} ${item.label}`}
        className="mt-1 text-[12px] text-[#8A7D6B] hover:text-primary inline-flex items-center gap-0.5">
        <Plus size={12} /> {t.addNote}
      </button>
    );
  }
  return (
    <textarea value={draft} autoFocus={open && !item.note} rows={2} maxLength={2000}
      aria-label={`${t.notesLabel} ${item.label}`} placeholder={t.notePlaceholder}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => {
        if (draft.trim() !== (item.note || '').trim()) onSave(draft);
        else if (!draft.trim()) setOpen(false);
      }}
      className="mt-1.5 w-full px-2 py-1.5 resize-y" style={{ height: 'auto', minHeight: 52, fontSize: 12, borderRadius: 8 }} />
  );
}

function AddTask({ t, phase, onAdd }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} aria-label={`${t.addTask} — ${phase.label}`}
        className="btn-secondary text-[12px]">
        <Plus size={13} /> {t.addTask}
      </button>
    );
  }
  const submit = e => {
    e.preventDefault();
    if (!label.trim()) return;
    onAdd(phase.key, label.trim());
    setLabel('');
    setOpen(false);
  };
  return (
    <form onSubmit={submit} className="flex flex-wrap gap-2" aria-label={`${t.addTask} — ${phase.label}`}>
      <input autoFocus value={label} onChange={e => setLabel(e.target.value)} maxLength={200}
        aria-label={t.newTask} placeholder={t.newTask} className="flex-1 min-w-[200px] px-2 py-1.5 text-[13px] rounded-lg" />
      <button type="submit" disabled={!label.trim()} className="btn-primary">{t.add}</button>
      <button type="button" onClick={() => setOpen(false)} className="btn-secondary">{t.cancel}</button>
    </form>
  );
}
