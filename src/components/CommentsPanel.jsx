import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, X } from 'lucide-react';
import CommentThread from './CommentThread';
import { listComments, addCsmComment, editCsmComment, deleteCsmComment, setCommentResolved } from '../utils/clientPortalStore';
import { pageLabel } from '../utils/clientView';

const REFRESH_MS = 30000;

// CSM side of a client portal page's thread: a button with the open count,
// and a side panel to answer, resolve, edit or delete.
export default function CommentsPanel({ lang, programId, page, items, user }) {
  const t = lang === 'fr';
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState([]);
  const [target, setTarget] = useState('');

  const load = useCallback(() => listComments([programId], user.email)
    .then(setComments)
    .catch(() => {}), [programId, user.email]);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const pageComments = comments.filter(c => c.page === page);
  const openCount = pageComments.filter(c => !c.resolved).length;
  const andReload = action => async (...args) => {
    await action(...args);
    await load();
  };

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 btn-primary shadow-lg"
        style={{ boxShadow: '0 8px 20px -6px rgba(41,101,254,0.5)' }}>
        <MessageSquare size={14} /> {t ? 'Commentaires client' : 'Client comments'}
        <span className="ml-1 px-1.5 rounded-full bg-white/25 text-[11px]">{openCount}</span>
      </button>

      {open && (
        <aside className="fixed top-0 right-0 z-50 h-full w-full max-w-[420px] bg-[#FBFAF6] border-l border-[#E5E1D8] overflow-y-auto p-4"
          style={{ boxShadow: '-12px 0 32px -12px rgba(15,15,15,0.18)' }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="section-subheader" style={{ marginBottom: 0 }}>{t ? 'ESPACE CLIENT' : 'CLIENT PORTAL'}</div>
              <div className="text-[16px] font-bold text-[#2B251F]">{pageLabel(page, lang)}</div>
            </div>
            <button onClick={() => setOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#E5E1D8]" aria-label={t ? 'Fermer' : 'Close'}>
              <X size={16} />
            </button>
          </div>
          <CommentThread
            lang={lang}
            comments={pageComments}
            items={items}
            target={target}
            onTargetChange={setTarget}
            onAdd={andReload(c => addCsmComment({ programId, page, ...c, author: { name: user.name, email: user.email } }))}
            onEdit={andReload(editCsmComment)}
            onDelete={andReload(deleteCsmComment)}
            onResolve={andReload(setCommentResolved)}
          />
        </aside>
      )}
    </>
  );
}
