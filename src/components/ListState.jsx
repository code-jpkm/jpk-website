'use client';

import { Notice, Spinner } from './ui';

// Loading / error / empty states around a list's table.
export default function ListState({ list, empty, children }) {
  if (list.error) {
    return (
      <div className="card__body">
        <Notice tone="danger" title="The list could not be loaded." action={<button type="button" className="btn btn--ghost btn--sm" onClick={list.reload}>Try again</button>}>
          {list.error}
        </Notice>
      </div>
    );
  }
  if (list.loading && !list.items.length) return <div className="list-state"><Spinner /></div>;
  if (!list.items.length) return empty;
  return <div className="table-wrap" aria-busy={list.loading}>{children}</div>;
}
