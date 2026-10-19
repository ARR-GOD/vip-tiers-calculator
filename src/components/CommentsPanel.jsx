import { useState } from 'react';
import { MessageSquare, X, AlertCircle } from 'lucide-react';
import CommentThread from './CommentThread';
import { addCsmComment, editCsmComment, deleteCsmComment, setCommentResolved, countToHandleByPage } from '../utils/clientPortalStore';
import { CLIENT_PAGES, pageItems } from '../utils/clientView';

// CSM side of the client portal threads: one tab per page, with the number
// of client comments to handle; answer, resolve, edit or delete.
export default function CommentsPanel({ lang, programId, comments, error, reload, page, onPageChange, view, user, onClose }) {
  const t = lang === 'fr';
  const [target, setTarget] = useState('');
  const toHandle = countToHandleByPage(comments);
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
    </aside>
  );
}

// Floating button of the wizard: total of client comments to handle.
export function CommentsButton({ lang, count, onClick }) {
  return (
    <button onClick={onClick}
      className="fixed bottom-5 right-5 z-40 btn-primary shadow-lg"
      style={{ boxShadow: '0 8px 20px -6px rgba(41,101,254,0.5)' }}>
      <MessageSquare size={14} /> {lang === 'fr' ? 'Commentaires client' : 'Client comments'}
      <span className={`ml-1 px-1.5 rounded-full text-[11px] ${count > 0 ? 'bg-white text-primary font-bold' : 'bg-white/25'}`}>{count}</span>
    </button>
  );
}
