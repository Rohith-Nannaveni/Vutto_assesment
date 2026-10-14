import { useCallback, useEffect, useRef, useState } from 'react';
import { parseError } from '../api/client.js';

// Small data-loading hook: { data, loading, error, reload }. Ignores responses from stale requests.
export function useFetch(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const ticket = useRef(0);

  const run = useCallback(async ({ silent = false } = {}) => {
    const mine = ++ticket.current;
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fetcher();
      if (mine === ticket.current) setState({ data, loading: false, error: null });
    } catch (err) {
      if (mine === ticket.current) setState((s) => ({ data: silent ? s.data : null, loading: false, error: parseError(err) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { run(); return () => { ticket.current += 1; }; }, [run]);
  return { ...state, reload: run };
}
