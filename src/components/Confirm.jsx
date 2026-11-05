'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// "Are you sure?" dialog. const [confirm, dialog] = useConfirm(); then: if (await confirm({...})) …
export function useConfirm() {
  const [state, setState] = useState(null);
  const resolver = useRef(null);
  const confirm = useCallback(opts => new Promise(resolve => {
    resolver.current = resolve;
    setState({ title: 'Are you sure?', confirmLabel: 'Confirm', tone: 'danger', ...opts });
  }), []);
  const close = useCallback(answer => {
    setState(null);
    if (resolver.current) resolver.current(answer);
    resolver.current = null;
  }, []);
  const dialog = state ? <ConfirmDialog {...state} onClose={close} /> : null;
  return [confirm, dialog];
}

function ConfirmDialog({ title, message, confirmLabel, tone, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
    const btn = el && el.querySelector('[data-autofocus]');
    if (btn) btn.focus();
  }, []);
  return (
    <dialog ref={ref} className="dialog" onCancel={e => { e.preventDefault(); onClose(false); }} aria-labelledby="confirm-title">
      <div className="dialog__body">
        <h2 id="confirm-title" className="dialog__title">{title}</h2>
        {message ? <p className="dialog__text">{message}</p> : null}
      </div>
      <div className="dialog__actions">
        <button type="button" className="btn btn--ghost" onClick={() => onClose(false)} data-autofocus>Cancel</button>
        <button type="button" className={`btn ${tone === 'danger' ? 'btn--danger' : 'btn--primary'}`} onClick={() => onClose(true)}>{confirmLabel}</button>
      </div>
    </dialog>
  );
}
