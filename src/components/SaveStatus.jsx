import { Check, Loader2, AlertCircle } from 'lucide-react';

// Navbar indicator of the database save state of the open program.
export default function SaveStatus({ saveState, lang }) {
  const t = lang === 'fr';
  const { status, savedAt, error } = saveState;

  if (status === 'pending' || status === 'saving') {
    return (
      <span className="text-[11px] text-white/60 inline-flex items-center gap-1 mr-2">
        <Loader2 size={12} className="animate-spin" /> {t ? 'Enregistrement…' : 'Saving…'}
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="text-[11px] text-red-300 inline-flex items-center gap-1 mr-2" title={error?.message || ''}>
        <AlertCircle size={12} /> {t ? 'Non enregistré — nouvelle tentative…' : 'Not saved — retrying…'}
      </span>
    );
  }
  if (status === 'saved' && savedAt) {
    return (
      <span className="text-[11px] text-[#6EE7B7] inline-flex items-center gap-1 mr-2"
        title={t ? 'Enregistré en base, visible par toute l\'équipe' : 'Saved to the database, visible to the whole team'}>
        <Check size={12} /> {t ? 'Enregistré' : 'Saved'} {new Date(savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    );
  }
  return null;
}
