import { useState, useEffect, useCallback, useRef } from 'react';
import { listProgramActivity } from './clientPortalStore';

const REFRESH_MS = 30000;

// Missing table: the client_edits migration has not been run yet.
const isMissingTable = err => err?.code === '42P01' || err?.code === 'PGRST205' || /program_activity/.test(err?.message || '');

// The brand's edits of the open program (client portal), oldest first,
// refreshed every 30 s and when the tab comes back to the foreground.
// `onLoad(activity, programId)` is called with every answer.
export function useProgramActivity(programId, onLoad) {
  const [state, setState] = useState({ programId: null, activity: [], error: '' });
  const lastRequest = useRef(0);
  const onLoadRef = useRef(onLoad);
  useEffect(() => { onLoadRef.current = onLoad; });

  const reload = useCallback(() => {
    if (!programId) return Promise.resolve();
    const request = ++lastRequest.current;
    return listProgramActivity(programId)
      .then(activity => {
        if (request !== lastRequest.current) return;
        setState({ programId, activity, error: '' });
        onLoadRef.current?.(activity, programId);
      })
      .catch(err => {
        if (request !== lastRequest.current) return;
        setState(s => (isMissingTable(err)
          ? { programId, activity: [], error: '' }
          : { ...s, programId, error: err.message }));
      });
  }, [programId]);

  useEffect(() => {
    reload();
    const timer = setInterval(reload, REFRESH_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') reload(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [reload]);

  const current = !!programId && state.programId === programId;
  return { activity: current ? state.activity : [], error: current ? state.error : '', reload };
}
