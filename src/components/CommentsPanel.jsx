import { useState } from 'react';
import { MessageSquare, X, AlertCircle, PencilLine } from 'lucide-react';
import CommentThread from './CommentThread';
import { addCsmComment, editCsmComment, deleteCsmComment, setCommentResolved, countToHandleByPage } from '../utils/clientPortalStore';
import { CLIENT_PAGES, pageItems, pageLabel } from '../utils/clientView';
import { isLaterThan } from '../utils/programOps';

// CSM side of the client portal: the comment threads (one tab per page, with
// the number of client comments to handle; answer, resolve, edit or delete)
// and the activity feed of the brand's direct edits.
export default function CommentsPanel({
  lang, programId, comments, error, reload, page, onPageChange, view, user, onClose,
  activity = [], activityError, activitySeenAt, openOnActivity, onActivitySeen,
}) {
  const t = lang === 'fr';
  const [target, setTarget] = useState('');
  const [tab, setTab] = useState(openOnActivity ? 'activity' : 'comments');
  // Edits newer than this were not seen yet when the feed was opened: highlighted.
  const [highlightAfter, setHighlightAfter] = useState(activitySeenAt);
  const toHandle = countToHandleByPage(comments);
  const toHandleTotal = Object.values(toHandle).reduce((s, n) => s + n, 0);
  const newActivity = activity.filter(a => isLaterThan(a.at, activitySeenAt)).length;
  const showTab = key => {
    if (key === 'activity') {
      setHighlightAfter(activitySeenAt);
      onActivitySeen?.();
    }
    setTab(key);
  };
  const andReload = action => async (...args) => {
    await action(...args);
    await reload();
  };
  const selectPage = key => {
    setTarget('');
    onPageChange(key);
  };

  return (
    <aside className="fixed top-0 right-0 z-50 h-full w-full max-w-[440px] bg-[#FBFAF6] border-l border-[#E5E1D8] overflow-y-auto p-4"
      style={{ boxShadow: '-12px 0 32px -12px rgba(15,15,15,0.18)' }} aria-label={t ? 'Commentaires client' : 'Client comments'}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="section-subheader" style={{ marginBottom: 0 }}>{t ? 'ESPACE CLIENT' : 'CLIENT PORTAL'}</div>
          <div className="text-[16px] font-bold text-[#2B251F]">{t ? 'Commentaires client' : 'Client comments'}</div>
        </div>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#E5E1D8]" aria-label={t ? 'Fermer' : 'Close'}>
          <X size={16} />
        </button>
      </div>

      <div className="flex border-b border-[#E5E1D8] mb-3" role="tablist">
        {[
          { key: 'comments', label: t ? 'Commentaires' : 'Comments', count: toHandleTotal },
          { key: 'activity', label: t ? 'Activité de la marque' : 'Brand activity', count: newActivity },
        ].map(item => (
          <button key={item.key} role="tab" aria-selected={tab === item.key} onClick={() => showTab(item.key)}
            className={`relative px-3 py-2 text-[13px] inline-flex items-center gap-1.5 ${tab === item.key ? 'text-[#2B251F] font-semibold' : 'text-[#8A7D6B] font-medium hover:text-[#52473C]'}`}>
            {item.label}
            {item.count > 0 && <span className="px-1.5 rounded-full bg-primary/10 text-primary text-[10px]">{item.count}</span>}
            {tab === item.key && <span className="absolute left-2 right-2 -bottom-px h-[2px] bg-primary rounded-sm" />}
          </button>
        ))}
      </div>

      {tab === 'activity' ? <ActivityFeed lang={lang} activity={activity} error={activityError} highlightAfter={highlightAfter} /> : (
      <>

      <div className="flex gap-1 flex-wrap mb-3" role="tablist">
        {CLIENT_PAGES.map(p => (
          <button key={p.key} role="tab" aria-selected={page === p.key} onClick={() => selectPage(p.key)}
            className={`px-2.5 py-1 rounded-full text-[12px] font-medium border inline-flex items-center gap-1 ${
              page === p.key ? 'bg-primary text-white border-primary' : 'bg-white text-[#52473C] border-[#E5E1D8] hover:border-[#D9D5CB]'
            }`}>
            {t ? p.labelFr : p.labelEn}
            {toHandle[p.key] > 0 && (
              <span className={`px-1.5 rounded-full text-[10px] ${page === p.key ? 'bg-white/25' : 'bg-primary/10 text-primary'}`}>{toHandle[p.key]}</span>
            )}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-3 text-[12px] text-red-600 flex items-start gap-1.5">
          <AlertCircle size={13} className="shrink-0 mt-0.5" />
          {t ? 'Commentaires indisponibles : ' : 'Comments unavailable: '}{error}
        </div>
      )}

      <CommentThread
        lang={lang}
        comments={comments.filter(c => c.page === page)}
        items={view ? pageItems(view, lang, page) : []}
        target={target}
        onTargetChange={setTarget}
        onAdd={andReload(c => addCsmComment({ programId, page, ...c, author: { name: user.name, email: user.email } }))}
        onEdit={andReload(editCsmComment)}
        onDelete={andReload(deleteCsmComment)}
        onResolve={andReload(setCommentResolved)}
      />
      </>
      )}
    </aside>
  );
}

// The brand's direct edits, newest first: who, where, and the old → new value.
function ActivityFeed({ lang, activity, error, highlightAfter }) {
  const t = lang === 'fr';
  const formatDate = iso => new Date(iso).toLocaleString(t ? 'fr-FR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' });
  if (error) {
    return (
      <div className="text-[12px] text-red-600 flex items-start gap-1.5">
        <AlertCircle size={13} className="shrink-0 mt-0.5" />
        {t ? 'Activité indisponible : ' : 'Activity unavailable: '}{error}
      </div>
    );
  }
  if (!activity.length) {
    return (
      <p className="text-[13px] text-[#8A7D6B]">
        {t ? 'La marque n\'a encore rien modifié. Ses modifications depuis son espace apparaîtront ici et seront reprises dans le programme.'
          : 'The brand has not changed anything yet. Its changes from its portal will show here and be merged into the program.'}
      </p>
    );
  }
  return (
    <ol className="space-y-2" data-testid="activity-feed">
      {[...activity].reverse().map(a => {
        const isNew = isLaterThan(a.at, highlightAfter);
        return (
          <li key={a.id} className={`rounded-[10px] border p-3 ${isNew ? 'border-primary/40 bg-white' : 'border-[#E5E1D8] bg-white/60'}`}>
            <div className="flex items-center gap-1.5 text-[11px] text-[#8A7D6B]">
              <PencilLine size={12} />
              <span className="font-semibold text-[#52473C]">{a.actorName}</span>
              <span>· {pageLabel(a.page, lang)} · {formatDate(a.at)}</span>
              {isNew && <span className="ml-auto pill text-[10px] bg-primary/10 text-primary">{t ? 'Nouveau' : 'New'}</span>}
            </div>
            <div className="mt-1 text-[13px] text-[#2B251F]">
              <span className="font-semibold">{a.itemLabel}</span>{a.fieldLabel && <span className="text-[#645648]"> — {a.fieldLabel}</span>}
            </div>
            {(a.oldValue || a.newValue) && (
              <div className="mt-0.5 text-[13px]">
                {a.oldValue && <span className="text-[#8A7D6B] line-through">{a.oldValue}</span>}
                {a.oldValue && a.newValue && <span className="text-[#8A7D6B]"> → </span>}
                {a.newValue && <span className="font-semibold text-[#2B251F]">{a.newValue}</span>}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// Floating button of the wizard: client comments to handle, and brand edits
// not seen yet.
export function CommentsButton({ lang, count, activityCount = 0, onClick }) {
  return (
    <button onClick={onClick}
      className="fixed bottom-5 right-5 z-40 btn-primary shadow-lg"
      style={{ boxShadow: '0 8px 20px -6px rgba(41,101,254,0.5)' }}>
      <MessageSquare size={14} /> {lang === 'fr' ? 'Commentaires client' : 'Client comments'}
      <span className={`ml-1 px-1.5 rounded-full text-[11px] ${count > 0 ? 'bg-white text-primary font-bold' : 'bg-white/25'}`}>{count}</span>
      {activityCount > 0 && (
        <span className="ml-1 px-1.5 rounded-full text-[11px] bg-white text-primary font-bold inline-flex items-center gap-0.5"
          title={lang === 'fr' ? 'Modifications de la marque' : 'Brand changes'} data-testid="activity-count">
          <PencilLine size={11} /> {activityCount}
        </span>
      )}
    </button>
  );
}
