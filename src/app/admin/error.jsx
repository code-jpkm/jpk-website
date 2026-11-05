'use client';

import { useEffect } from 'react';

// Shown when a screen fails to load (usually the database was briefly unreachable).
export default function AdminError({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="no-access">
      <div className="page-header"><div><h1 className="page-header__title">This screen could not be loaded</h1></div></div>
      <div className="notice notice--danger" role="alert">
        <div className="notice__body">
          <strong className="notice__title">Something went wrong while loading.</strong>
          <div className="notice__text">This is usually temporary (for example the database was busy). Please try again.</div>
        </div>
        <div className="notice__action"><button type="button" className="btn btn--primary btn--sm" onClick={() => reset()}>Try again</button></div>
      </div>
    </div>
  );
}
