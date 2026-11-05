import { isDbDown } from '@/lib/errors';

// Shown instead of the admin when the server cannot work (missing settings, database down).
export default function SystemProblem({ error }) {
  const notConfigured = error && error.code === 'CONFIG';
  const down = isDbDown(error);
  return (
    <div className="error-page">
      <div className="error-page__box">
        <img src="/logo.png" alt="JPK Metallics" width="170" height="41" />
        <h1>{notConfigured ? 'Almost ready' : down ? 'The database cannot be reached' : 'Something went wrong'}</h1>
        {notConfigured ? (
          <>
            <p className="muted">The admin needs its database address before anyone can sign in.</p>
            <ol className="setup-steps">
              <li>Open the service on Render → <strong>Environment</strong>.</li>
              <li>Add <code>MONGODB_URI</code> with your MongoDB Atlas connection string.</li>
              <li>Save; Render restarts the admin. Then sign in with the first admin account.</li>
            </ol>
          </>
        ) : down ? (
          <>
            <p className="muted">Please try again in a minute. If it keeps happening, check that MongoDB Atlas allows connections from anywhere (Network Access → 0.0.0.0/0) and that <code>MONGODB_URI</code> is correct.</p>
          </>
        ) : (
          <p className="muted">Please reload the page. If the problem stays, check the server log on Render.</p>
        )}
        <a href="/admin" className="btn btn--primary">Try again</a>
      </div>
    </div>
  );
}
