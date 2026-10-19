import { useState, useEffect, useCallback, useRef } from 'react';
import { listComments } from './clientPortalStore';

const REFRESH_MS = 30000;

// All the comments of the open program, refreshed every 30 s and when the
// tab comes back to the foreground.
export function useProgramComments(programId, viewerEmail) {
  const [comments, setComments] = useState([]);
  const [error, setError] = useState('');
  // A background refresh answering after a newer one must not bring back an old list.
  const lastRequest = useRef(0);

  const reload = useCallback(() => {
    if (!programId) return Promise.resolve();
    const request = ++lastRequest.current;
    return listComments([programId], viewerEmail)
      .then(list => {
        if (request !== lastRequest.current) return;
        setComments(list);
        setError('');
      })
      .catch(err => { if (request === lastRequest.current) setError(err.message); });
  }, [programId, viewerEmail]);

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

  return { comments: programId ? comments : [], error, reload };
}
