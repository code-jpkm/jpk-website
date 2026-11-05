'use client';

import { useCallback, useEffect, useState } from 'react';

// Form values + "unsaved changes" warning when leaving the page.
export function useFormState(initial) {
  const [form, setForm] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const set = useCallback((key, value) => {
    setForm(f => ({ ...f, [key]: typeof value === 'function' ? value(f[key]) : value }));
    setDirty(true);
  }, []);
  const reset = useCallback(next => {
    setForm(next);
    setDirty(false);
  }, []);
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = e => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  return { form, set, setForm, dirty, setDirty, reset };
}
