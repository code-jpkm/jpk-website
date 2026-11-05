'use client';

export default function Pagination({ page, pages, total, onPage, noun = 'items' }) {
  if (!total) return null;
  return (
    <div className="pagination">
      <span className="pagination__info">{total} {total === 1 ? noun.replace(/s$/, '') : noun}</span>
      {pages > 1 ? (
        <div className="pagination__buttons">
          <button type="button" className="btn btn--ghost btn--sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Previous</button>
          <span className="pagination__page">Page {page} of {pages}</span>
          <button type="button" className="btn btn--ghost btn--sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next →</button>
        </div>
      ) : null}
    </div>
  );
}
