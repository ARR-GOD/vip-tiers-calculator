import { useState } from 'react';
import { Plus, Trash2, ExternalLink, AlertCircle, Check, Minus, ChevronDown, ChevronRight, StickyNote, ArrowRight } from 'lucide-react';
import { CHECKLIST_STATUSES, CHECKLIST_OWNERS } from '../utils/checklist';

// ════════════════════════════════════════════════════════════════════
// Launch checklist board — shared by the CSM step and the client portal
// ════════════════════════════════════════════════════════════════════
// `checklist` comes from utils/checklist.js (buildChecklist). Changes go
// through onPatch(key, { status | owner | dueDate | note }), onAdd(phase,
// label) and onDelete(key) (added tasks only).
//
// Kept light: only the section of the next step is open at first (its
// phase too), one line per step with a check box, its details (guides,
// owner, date, notes) on click; "Tout déplier" shows everything.

const FR = {
  progress: (done, total) => `${done} / ${total} étapes faites`,
  next: 'Prochaine étape',
  allDone: 'Toutes les étapes sont faites 🎉',
  status: { todo: 'À faire', in_progress: 'En cours', done: 'Fait', na: 'Non concerné' },
  owner: { '': '—', loyoly: 'Loyoly', brand: 'Marque', both: 'Les deux' },
  statusLabel: 'Statut', ownerLabel: 'Responsable', dateLabel: 'Date prévue', notesLabel: 'Notes',
  markDone: 'Fait :', details: 'Détails :', concerns: 'Concerne',
  notePlaceholder: 'Ajouter une note…',
  show: 'Afficher', all: 'Toutes', forLoyoly: 'Loyoly', forBrand: 'Marque', hideDone: 'Masquer les faites',
  expandAll: 'Tout déplier', collapseAll: 'Tout replier',
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
  next: 'Next step',
  allDone: 'Every step is done 🎉',
  status: { todo: 'To do', in_progress: 'In progress', done: 'Done', na: 'Not applicable' },
  owner: { '': '—', loyoly: 'Loyoly', brand: 'Brand', both: 'Both' },
  statusLabel: 'Status', ownerLabel: 'Owner', dateLabel: 'Due date', notesLabel: 'Notes',
  markDone: 'Done:', details: 'Details:', concerns: 'For',
  notePlaceholder: 'Add a note…',
  show: 'Show', all: 'All', forLoyoly: 'Loyoly', forBrand: 'Brand', hideDone: 'Hide the done ones',
  expandAll: 'Expand all', collapseAll: 'Collapse all',
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
const CONTROL = { height: 30, fontSize: 12, borderRadius: 8 };
const OWNER_CHIP = { loyoly: 'bg-[#EEF3FF] text-primary', brand: 'bg-[#F5EFE6] text-[#8A6A3B]', both: 'bg-[#F0EEE8] text-[#645648]' };

const isClosed = item => item.status === 'done' || item.status === 'na';
const itemsOf = phase => [...phase.groups.flatMap(g => g.items), ...phase.custom];
const countOf = items => {
  const counted = items.filter(i => i.status !== 'na');
  return { done: counted.filter(i => i.status === 'done').length, total: counted.length };
};
const groupId = (phase, group) => `${phase.key}:${group.key ?? 'all'}`;
const todayIso = () => new Date().toISOString().slice(0, 10);

// The first step left, in the template's order, with its phase and section.
function nextStep(checklist) {
  for (const phase of checklist.phases) {
    for (const group of phase.groups) {
      const item = group.items.find(i => !isClosed(i));
      if (item) return { phase, group, item };
    }
    const item = phase.custom.find(i => !isClosed(i));
    if (item) return { phase, group: null, item };
  }
  return null;
}

export default function ChecklistBoard({ lang, audience, title, subtitle, checklist, onPatch, onAdd, onDelete, onGoToSetup }) {
  const t = lang === 'fr' ? FR : EN;
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [hideDone, setHideDone] = useState(false);
  // Open at first: the phase and section of the next step.
  const [openPhases, setOpenPhases] = useState(() => {
    const next = nextStep(checklist);
    return new Set(next ? [next.phase.key] : []);
  });
  const [openGroups, setOpenGroups] = useState(() => {
    const next = nextStep(checklist);
    return new Set(next?.group ? [groupId(next.phase, next.group)] : []);
  });
  const [openItems, setOpenItems] = useState(() => new Set());

  const filtering = ownerFilter !== 'all' || hideDone;
  const visible = item => (!hideDone || !isClosed(item))
    && (ownerFilter === 'all' || item.owner === ownerFilter || item.owner === 'both');
  const toggle = (set, setter, key) => setter(() => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const labelledGroups = checklist.phases.flatMap(p => p.groups.filter(g => g.label).map(g => groupId(p, g)));
  const allOpen = checklist.phases.every(p => openPhases.has(p.key)) && labelledGroups.every(id => openGroups.has(id));
  const toggleAll = () => {
    if (allOpen) {
      setOpenPhases(new Set());
      setOpenGroups(new Set());
    } else {
      setOpenPhases(new Set(checklist.phases.map(p => p.key)));
      setOpenGroups(new Set(labelledGroups));
    }
  };

  const { done, total } = checklist.progress;
  const percent = total ? Math.round((done / total) * 100) : 0;
  const missingList = checklist.missing.map(key => t.missing[key]).join(', ');
  const anyVisible = checklist.phases.some(p => itemsOf(p).some(visible));

  // The next step: shown, and opened on click.
  const next = nextStep(checklist);
  const nextItem = next?.item;
  const goToNext = () => {
    setOpenPhases(s => new Set([...s, next.phase.key]));
    if (next.group) setOpenGroups(s => new Set([...s, groupId(next.phase, next.group)]));
    setOpenItems(s => new Set([...s, nextItem.key]));
    requestAnimationFrame(() => document.querySelector(`[data-item="checklist:${nextItem.key}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }));
  };

  const row = item => (
    <ItemRow key={item.key} t={t} lang={lang} item={item} open={openItems.has(item.key)}
      onToggle={() => toggle(openItems, setOpenItems, item.key)} onPatch={onPatch} onDelete={onDelete} />
  );

  return (
    <div className="space-y-2.5" data-testid="checklist">
      <section className="card" style={{ padding: '16px 18px' }}>
        {title && <h2 className="text-[18px] font-bold text-[#2B251F]">{title}</h2>}
        {subtitle && <p className="text-[13px] text-[#8A7D6B] mt-0.5 mb-3">{subtitle}</p>}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex-1 min-w-[220px] max-w-[420px]">
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="font-semibold text-[#2B251F]" data-testid="checklist-progress">{t.progress(done, total)}</span>
              <span className="text-[#8A7D6B]">{percent} %</span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-[#EEEDE6] overflow-hidden">
              <div className="h-full bg-[#059669] rounded-full transition-all" style={{ width: `${percent}%` }} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px]">
            <div className="flex items-center gap-1" role="group" aria-label={t.ownerLabel}>
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
            <button type="button" onClick={toggleAll} className="text-primary font-medium hover:underline">
              {allOpen ? t.collapseAll : t.expandAll}
            </button>
          </div>
        </div>
        <div className="mt-3 text-[13px]">
          {nextItem ? (
            <button type="button" onClick={goToNext} className="inline-flex items-center gap-1.5 text-left text-[#52473C] hover:text-primary">
              <ArrowRight size={14} className="text-primary shrink-0" />
              <span className="text-[#8A7D6B]">{t.next} :</span>
              <span className="font-medium">{nextItem.label}</span>
            </button>
          ) : total > 0 && <span className="font-medium text-[#047857]">{t.allDone}</span>}
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
        const all = itemsOf(phase);
        if (filtering && !all.some(visible)) return null;
        const open = filtering || openPhases.has(phase.key);
        const count = countOf(all);
        const complete = count.total > 0 && count.done === count.total;
        return (
          <section key={phase.key} className="card" style={{ padding: '12px 18px' }} data-phase={phase.key}>
            <button type="button" onClick={() => toggle(openPhases, setOpenPhases, phase.key)} aria-expanded={open}
              className="w-full flex items-center gap-3 text-left py-1">
              <span className="text-[15px] w-5 text-center">{complete ? '✅' : phase.icon}</span>
              <span className="flex-1 min-w-0 text-[14px] font-bold text-[#2B251F]">{phase.label}</span>
              <span className="hidden sm:block w-[110px] h-1.5 rounded-full bg-[#EEEDE6] overflow-hidden">
                <span className="block h-full bg-[#059669] rounded-full" style={{ width: `${count.total ? (count.done / count.total) * 100 : 0}%` }} />
              </span>
              <span className="text-[12px] text-[#8A7D6B] w-[42px] text-right tabular-nums">{count.done}/{count.total}</span>
              <ChevronDown size={16} className={`text-[#8A7D6B] transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
              <div className="mt-1">
                {phase.groups.map(group => {
                  const items = group.items.filter(visible);
                  if (!items.length) return null;
                  const id = groupId(phase, group);
                  const groupOpen = filtering || !group.label || openGroups.has(id);
                  const groupCount = countOf(group.items);
                  return (
                    <div key={id}>
                      {group.label && (
                        <button type="button" onClick={() => toggle(openGroups, setOpenGroups, id)} aria-expanded={groupOpen}
                          className="w-full flex items-center gap-1.5 mt-2.5 mb-0.5 text-left">
                          <ChevronRight size={13} className={`text-[#8A7D6B] transition-transform ${groupOpen ? 'rotate-90' : ''}`} />
                          <span className="flex-1 text-[11px] font-semibold uppercase tracking-wide text-[#8A7D6B]">{group.label}</span>
                          <span className="text-[11px] text-[#8A7D6B] tabular-nums">{groupCount.done}/{groupCount.total}</span>
                        </button>
                      )}
                      {groupOpen && <ul>{items.map(row)}</ul>}
                    </div>
                  );
                })}
                {phase.custom.some(visible) && (
                  <div>
                    <div className="mt-2.5 mb-0.5 pl-[19px] text-[11px] font-semibold uppercase tracking-wide text-[#8A7D6B]">{t.addedTasks}</div>
                    <ul>{phase.custom.filter(visible).map(row)}</ul>
                  </div>
                )}
                <div className="mt-2 pl-[30px]">
                  <AddTask t={t} phase={phase} onAdd={onAdd} />
                </div>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

// The check box: done ↔ to do; in progress and not applicable show too.
function StatusCheck({ t, item, onPatch }) {
  const style = {
    todo: 'border-[#CFC8BC] bg-white hover:border-[#059669]',
    in_progress: 'border-[#F59E0B] bg-[#FFFBEB] hover:border-[#059669]',
    done: 'border-[#059669] bg-[#059669] text-white',
    na: 'border-[#D9D5CB] bg-[#F3F4F6] text-[#9CA3AF]',
  }[item.status];
  return (
    <button type="button" role="checkbox" aria-checked={item.status === 'done'} aria-label={`${t.markDone} ${item.label}`}
      title={t.status[item.status]}
      onClick={() => onPatch(item.key, { status: item.status === 'done' ? 'todo' : 'done' })}
      className={`w-[19px] h-[19px] rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${style}`}>
      {item.status === 'done' && <Check size={11} strokeWidth={3} />}
      {item.status === 'in_progress' && <span className="w-[7px] h-[7px] rounded-full bg-[#F59E0B]" />}
      {item.status === 'na' && <Minus size={11} strokeWidth={3} />}
    </button>
  );
}

function ItemRow({ t, lang, item, open, onToggle, onPatch, onDelete }) {
  const closed = isClosed(item);
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US';
  const shortDate = iso => new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
  const overdue = item.dueDate && !closed && item.dueDate < todayIso();
  return (
    <li className="border-t border-[#F0EEE8] first:border-t-0" data-item={`checklist:${item.key}`}>
      <div className="flex items-center gap-2.5 py-[7px] pl-[11px]">
        <StatusCheck t={t} item={item} onPatch={onPatch} />
        <button type="button" onClick={onToggle} aria-expanded={open} aria-label={`${t.details} ${item.label}`} title={item.label}
          className="flex-1 min-w-0 flex items-center gap-2 text-left group">
          <span className={`text-[13px] truncate ${closed ? 'line-through text-[#B0A595]' : 'text-[#2B251F] group-hover:text-primary'}`}>{item.label}</span>
          {item.note && <StickyNote size={12} className="text-[#B0A595] shrink-0" />}
          <span className="ml-auto flex items-center gap-1.5 shrink-0">
            {item.status === 'in_progress' && <span className="px-1.5 py-px rounded-full text-[10px] font-semibold bg-[#FEF3C7] text-[#92400E]">{t.status.in_progress}</span>}
            {item.status === 'na' && <span className="px-1.5 py-px rounded-full text-[10px] font-semibold bg-[#F3F4F6] text-[#9CA3AF]">{t.status.na}</span>}
            {item.owner && <span className={`px-1.5 py-px rounded-full text-[10px] font-semibold ${OWNER_CHIP[item.owner]}`}>{t.owner[item.owner]}</span>}
            {item.dueDate && (
              <span className={`text-[11px] tabular-nums ${overdue ? 'text-red-600 font-semibold' : 'text-[#8A7D6B]'}`}>{shortDate(item.dueDate)}</span>
            )}
            <ChevronDown size={14} className={`text-[#B0A595] transition-transform ${open ? 'rotate-180' : ''}`} />
          </span>
        </button>
      </div>
      {open && (
        <div className="pl-[41px] pr-1 pb-3 space-y-2">
          {(item.hint || item.guides.length > 0 || item.tag) && (
            <div className="text-[12px] text-[#8A7D6B] flex flex-wrap items-center gap-x-3 gap-y-0.5">
              {item.tag && <span>{t.concerns} : {item.tag}</span>}
              {item.hint && <span>{item.hint}</span>}
              {item.guides.map(guide => (
                <a key={guide.url} href={guide.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 text-primary hover:underline">
                  {guide.title} <ExternalLink size={10} />
                </a>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <select value={item.status} aria-label={`${t.statusLabel} ${item.label}`}
              onChange={e => onPatch(item.key, { status: e.target.value })} className="px-2 w-[130px]" style={CONTROL}>
              {CHECKLIST_STATUSES.map(s => <option key={s} value={s}>{t.status[s]}</option>)}
            </select>
            <label className="inline-flex items-center gap-1.5 text-[12px] text-[#8A7D6B]">
              {t.ownerLabel}
              <select value={item.owner || ''} aria-label={`${t.ownerLabel} ${item.label}`}
                onChange={e => onPatch(item.key, { owner: e.target.value || null })} className="px-2 w-[104px]" style={CONTROL}>
                {['', ...CHECKLIST_OWNERS].map(o => <option key={o} value={o}>{t.owner[o]}</option>)}
              </select>
            </label>
            <label className="inline-flex items-center gap-1.5 text-[12px] text-[#8A7D6B]">
              {t.dateLabel}
              <input type="date" value={item.dueDate || ''} aria-label={`${t.dateLabel} ${item.label}`}
                onChange={e => onPatch(item.key, { dueDate: e.target.value || null })}
                className="px-2 w-[136px] border border-[#E5E1D8] bg-white text-[#2B251F]" style={CONTROL} />
            </label>
            {item.custom && (
              <button type="button" title={t.remove} aria-label={`${t.remove} ${item.label}`}
                onClick={() => { if (window.confirm(t.confirmRemove(item.label))) onDelete(item.key); }}
                className="ml-auto text-[#B0A595] hover:text-red-600"><Trash2 size={14} /></button>
            )}
          </div>
          <NoteField key={`${item.key}:${item.note}`} t={t} item={item} onSave={note => onPatch(item.key, { note })} />
          {item.updatedAt && item.updatedByName && (
            <div className="text-[11px] text-[#B0A595]">{t.updated(item.updatedByName, t.by[item.updatedByType], shortDate(item.updatedAt))}</div>
          )}
        </div>
      )}
    </li>
  );
}

// The team's note on a step: saved when the field is left.
function NoteField({ t, item, onSave }) {
  const [draft, setDraft] = useState(item.note || '');
  return (
    <textarea value={draft} rows={2} maxLength={2000}
      aria-label={`${t.notesLabel} ${item.label}`} placeholder={t.notePlaceholder}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { if (draft.trim() !== (item.note || '').trim()) onSave(draft); }}
      className="w-full px-2 py-1.5 resize-y" style={{ height: 'auto', minHeight: 48, fontSize: 12, borderRadius: 8 }} />
  );
}

function AddTask({ t, phase, onAdd }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} aria-label={`${t.addTask} — ${phase.label}`}
        className="text-[12px] font-medium text-[#8A7D6B] hover:text-primary inline-flex items-center gap-1">
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
        aria-label={t.newTask} placeholder={t.newTask} className="flex-1 min-w-[200px] px-2" style={{ ...CONTROL, height: 32, fontSize: 13 }} />
      <button type="submit" disabled={!label.trim()} className="btn-primary">{t.add}</button>
      <button type="button" onClick={() => setOpen(false)} className="btn-secondary">{t.cancel}</button>
    </form>
  );
}
