'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, qs } from '@/lib/client/api';

// Loads a paged list from the admin API and reloads when the filters change.
// Search text waits a moment after typing before it is sent.
export function useList(url, initialFilters = {}) {
  const [filters, setFilters] = useState({ page: 1, ...initialFilters });
  const [debounced, setDebounced] = useState(filters);
  const [state, setState] = useState({ items: [], total: 0, pages: 1, loading: true, error: '' });
  const reqId = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(filters), filters.q !== debounced.q ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const load = useCallback(async () => {
    const id = ++reqId.current;
    setState(s => ({ ...s, loading: true, error: '' }));
    try {
      const data = await api(`${url}${qs(debounced)}`);
      if (id !== reqId.current) return;
      setState({ items: data.items || [], total: data.total || 0, pages: data.pages || 1, loading: false, error: '' });
    } catch (err) {
      if (id !== reqId.current) return;
      setState(s => ({ ...s, loading: false, error: err.message }));
    }
  }, [url, debounced]);

  useEffect(() => {
    load();
  }, [load]);

  const update = useCallback(patch => setFilters(f => ({ ...f, page: 1, ...patch })), []);
  const setPage = useCallback(page => setFilters(f => ({ ...f, page })), []);
  return { ...state, filters, update, setPage, reload: load, setItems: fn => setState(s => ({ ...s, items: fn(s.items) })) };
}
