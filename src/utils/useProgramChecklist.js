import { useState, useEffect, useCallback, useRef } from 'react';
import { listChecklist } from './checklistStore';

const REFRESH_MS = 30000;

// Missing table: the checklist migration has not been run yet.
const isMissingTable = err => err?.code === '42P01' || err?.code === 'PGRST205' || /program_checklist/.test(err?.message || '');

// The checklist rows of the open program, refreshed every 30 s and when the
// tab comes back to the foreground. `update` changes them locally at once
// (the save follows).
export function useProgramChecklist(programId) {
  const [state, setState] = useState({ programId: null, rows: [], error: '', missing: false });
  const lastRequest = useRef(0);

  const reload = useCallback(() => {
    if (!programId) return Promise.resolve();
    const request = ++lastRequest.current;
    return listChecklist(programId)
      .then(rows => { if (request === lastRequest.current) setState({ programId, rows, error: '', missing: false }); })
      .catch(err => {
        if (request !== lastRequest.current) return;
        setState(s => ({ ...s, programId, error: isMissingTable(err) ? '' : err.message, missing: isMissingTable(err) }));
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

  const update = useCallback(fn => {
    lastRequest.current++; // a refresh already on its way would bring the old rows back
    setState(s => ({ ...s, rows: fn(s.rows) }));
  }, []);

  const current = !!programId && state.programId === programId;
  return {
    rows: current ? state.rows : [],
    loaded: current,
    error: current ? state.error : '',
    missing: current && state.missing,
    reload,
    update,
  };
}
