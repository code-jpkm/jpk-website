'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

// Short messages in the corner ("Saved", "Could not save: …").
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const id = useRef(0);
  const dismiss = useCallback(key => setToasts(list => list.filter(t => t.key !== key)), []);
  const show = useCallback((message, tone = 'success', ms = tone === 'error' ? 7000 : 3500) => {
    const key = ++id.current;
    setToasts(list => [...list.slice(-3), { key, message, tone }]);
    setTimeout(() => dismiss(key), ms);
  }, [dismiss]);
  const value = useMemo(() => ({
    success: m => show(m, 'success'),
    error: m => show(m, 'error'),
    info: m => show(m, 'info'),
  }), [show]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite" aria-atomic="false">
        {toasts.map(t => (
          <div key={t.key} className={`toast toast--${t.tone}`} role={t.tone === 'error' ? 'alert' : 'status'}>
            <span>{t.message}</span>
            <button type="button" className="toast__close" onClick={() => dismiss(t.key)} aria-label="Dismiss">×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return { success: () => {}, error: m => console.error(m), info: () => {} };
  return ctx;
}
