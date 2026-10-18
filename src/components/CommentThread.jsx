import { useState } from 'react';
import { MessageSquare, Pencil, Trash2, Check, RotateCcw, Loader2 } from 'lucide-react';
import { isEdited } from '../utils/clientPortalStore';

const FR = {
  title: 'Commentaires',
  open: n => `${n} ouvert${n > 1 ? 's' : ''}`,
  all: 'Tous les commentaires',
  general: 'Général (toute la page)',
  about: 'À propos de :',
  empty: 'Aucun commentaire pour l\'instant.',
  showResolved: n => `Afficher les résolus (${n})`,
  hideResolved: 'Masquer les résolus',
  placeholder: 'Écrire un commentaire…',
  send: 'Envoyer',
  edit: 'Modifier', remove: 'Supprimer', save: 'Enregistrer', cancel: 'Annuler',
  resolve: 'Marquer résolu', reopen: 'Rouvrir', resolved: 'Résolu',
  edited: '(modifié)',
  confirmDelete: 'Supprimer ce commentaire ?',
  client: 'Client', loyoly: 'Loyoly',
};

const EN = {
  title: 'Comments',
  open: n => `${n} open`,
  all: 'All comments',
  general: 'General (whole page)',
  about: 'About:',
  empty: 'No comment yet.',
  showResolved: n => `Show resolved (${n})`,
  hideResolved: 'Hide resolved',
  placeholder: 'Write a comment…',
  send: 'Send',
  edit: 'Edit', remove: 'Delete', save: 'Save', cancel: 'Cancel',
  resolve: 'Mark resolved', reopen: 'Reopen', resolved: 'Resolved',
  edited: '(edited)',
  confirmDelete: 'Delete this comment?',
  client: 'Client', loyoly: 'Loyoly',
};

// One page's thread. Comments may target one item of the page (a mission,
// a reward, a tier…); `target` is the item preselected for the next comment.
export default function CommentThread({
  lang, comments, items = [], target = '', onTargetChange, textareaRef,
  onAdd, onEdit, onDelete, onResolve,
}) {
  const t = lang === 'fr' ? FR : EN;
  const [filter, setFilter] = useState('');
  const [showResolved, setShowResolved] = useState(false);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(null); // { id, body }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const run = async (action) => {
    setBusy(true);
    setError('');
    try {
      await action();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const shown = comments.filter(c => !filter || c.itemRef === filter);
  const open = shown.filter(c => !c.resolved);
  const resolved = shown.filter(c => c.resolved);
  const openCount = comments.filter(c => !c.resolved).length;
  const labelOf = ref => items.find(i => i.ref === ref)?.label;

  const send = async () => {
    if (!draft.trim()) return;
    const ok = await run(() => onAdd({ body: draft, itemRef: target || null, itemLabel: labelOf(target) || null }));
    if (ok) setDraft('');
  };

  const saveEdit = async () => {
    if (!editing.body.trim()) return;
    const ok = await run(() => onEdit(editing.id, editing.body));
    if (ok) setEditing(null);
  };

  const remove = id => {
    if (confirm(t.confirmDelete)) run(() => onDelete(id));
  };

  const formatDate = iso => new Date(iso).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US', { dateStyle: 'short', timeStyle: 'short' });
  const linkButton = 'text-[11px] font-medium text-[#8A7D6B] hover:text-[#2B251F] inline-flex items-center gap-1 disabled:opacity-40';

  const renderComment = c => (
    <div key={c.id} className={`rounded-[10px] border px-3 py-2.5 ${c.resolved ? 'bg-[#F5F4F0] border-[#E5E1D8]' : 'bg-white border-[#E5E1D8]'}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[13px] font-semibold text-[#2B251F]">{c.authorName}</span>
        <span className={`pill text-[10px] ${c.authorType === 'csm' ? 'pill-purple' : 'bg-[#ECFDF5] text-[#047857]'}`}>
          {c.authorType === 'csm' ? t.loyoly : t.client}
        </span>
        <span className="text-[11px] text-[#8A7D6B]">{formatDate(c.createdAt)} {isEdited(c) && t.edited}</span>
        {c.resolved && <span className="ml-auto text-[11px] font-medium text-[#059669] inline-flex items-center gap-1"><Check size={11} /> {t.resolved}</span>}
      </div>
      {c.itemRef && (
        <div className="mt-1 text-[11px] text-primary">{t.about} {c.itemLabel || c.itemRef}</div>
      )}
      {editing?.id === c.id ? (
        <div className="mt-2 space-y-2">
          <textarea value={editing.body} onChange={e => setEditing({ id: c.id, body: e.target.value })} rows={3}
            className="w-full px-2 py-1.5 text-[13px] rounded-lg" aria-label={t.edit} />
          <div className="flex gap-2">
            <button onClick={saveEdit} disabled={busy || !editing.body.trim()} className="btn-primary text-[12px] px-3 py-1">{t.save}</button>
            <button onClick={() => setEditing(null)} className="btn-secondary text-[12px] px-3 py-1">{t.cancel}</button>
          </div>
        </div>
      ) : (
        <p className="mt-1 text-[13px] text-[#2B251F] whitespace-pre-wrap break-words">{c.body}</p>
      )}
      {editing?.id !== c.id && (c.mine || onResolve) && (
        <div className="mt-2 flex items-center gap-3">
          {c.mine && <button onClick={() => setEditing({ id: c.id, body: c.body })} disabled={busy} className={linkButton}><Pencil size={11} /> {t.edit}</button>}
          {c.mine && <button onClick={() => remove(c.id)} disabled={busy} className={`${linkButton} hover:text-red-500`}><Trash2 size={11} /> {t.remove}</button>}
          {onResolve && (
            <button onClick={() => run(() => onResolve(c.id, !c.resolved))} disabled={busy} className={`${linkButton} ml-auto`}>
              {c.resolved ? <><RotateCcw size={11} /> {t.reopen}</> : <><Check size={11} /> {t.resolve}</>}
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <MessageSquare size={15} className="text-primary" />
        <span className="text-[14px] font-semibold text-[#2B251F]">{t.title}</span>
        <span className="text-[12px] text-[#8A7D6B]">· {t.open(openCount)}</span>
        {busy && <Loader2 size={13} className="animate-spin text-primary ml-auto" />}
      </div>

      {items.length > 0 && (
        <select value={filter} onChange={e => setFilter(e.target.value)} className="w-full px-2 py-1.5 text-[12px] rounded-lg" aria-label={t.all}>
          <option value="">{t.all}</option>
          {items.map(i => <option key={i.ref} value={i.ref}>{i.label}</option>)}
        </select>
      )}

      <div className="flex flex-col gap-2">
        {open.length === 0 && resolved.length === 0 && <p className="text-[12px] text-[#8A7D6B]">{t.empty}</p>}
        {open.map(renderComment)}
        {resolved.length > 0 && (
          <button onClick={() => setShowResolved(v => !v)} className="text-[12px] text-[#645648] hover:text-primary text-left">
            {showResolved ? t.hideResolved : t.showResolved(resolved.length)}
          </button>
        )}
        {showResolved && resolved.map(renderComment)}
      </div>

      {error && <p className="text-[12px] text-red-600">{error}</p>}

      <div className="flex flex-col gap-2 pt-2 border-t border-[#E5E1D8]">
        {items.length > 0 && (
          <select value={target} onChange={e => onTargetChange?.(e.target.value)} className="w-full px-2 py-1.5 text-[12px] rounded-lg" aria-label={t.about}>
            <option value="">{t.general}</option>
            {items.map(i => <option key={i.ref} value={i.ref}>{t.about} {i.label}</option>)}
          </select>
        )}
        <textarea ref={textareaRef} value={draft} onChange={e => setDraft(e.target.value)} rows={3} maxLength={4000}
          placeholder={t.placeholder} className="w-full px-2 py-1.5 text-[13px] rounded-lg"
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }} />
        <button onClick={send} disabled={busy || !draft.trim()} className="btn-primary self-end text-[13px]">{t.send}</button>
      </div>
    </div>
  );
}
