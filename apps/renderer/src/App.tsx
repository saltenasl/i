import { useEffect, useRef, useState } from 'react';
import { useRpc } from './api-context.js';
import { useHashRoute } from './hooks/useHashRoute.js';
import { ExtractPage } from './routes/ExtractPage.js';
import { NotesPage } from './routes/NotesPage.js';
import { ViewPage } from './routes/ViewPage.js';

export const App = () => {
  const { route, params } = useHashRoute();
  const rpc = useRpc();
  const didAutoView = useRef(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await rpc.api.auth.me.$get();
        const data = await res.json();
        setIsAuthenticated(data.ok);
      } catch (_err) {
        setIsAuthenticated(false);
      }
    };
    void checkAuth();
  }, [rpc]);

  useEffect(() => {
    if (!isAuthenticated) return;

    if (didAutoView.current) {
      return;
    }
    if (route !== 'extract') {
      return;
    }
    didAutoView.current = true;

    const autoView = async () => {
      const res = await rpc.api.extract.history.list.$get({ query: { limit: '1' } });
      const data = await res.json();
      if (data.ok) {
        const latest = data.history[0];
        if (latest) {
          window.location.hash = `#/view/${latest.id}`;
        }
      }
    };
    void autoView();
  }, [route, rpc, isAuthenticated]);

  if (isAuthenticated === null) {
    return <div style={{ padding: 24 }}>Loading...</div>;
  }

  if (!isAuthenticated) {
    return (
      <main
        style={{
          maxWidth: 400,
          margin: '100px auto',
          padding: 24,
          fontFamily: 'system-ui, sans-serif',
          textAlign: 'center',
          border: '1px solid #e2e8f0',
          borderRadius: 8,
        }}
      >
        <h1>Welcome</h1>
        <p style={{ color: '#64748b', marginBottom: 24 }}>Please sign in to continue.</p>
        <a
          href="/api/auth/google"
          style={{
            display: 'inline-block',
            padding: '10px 24px',
            backgroundColor: '#2563eb',
            color: 'white',
            textDecoration: 'none',
            borderRadius: 6,
            fontWeight: 500,
          }}
        >
          Sign in with Google
        </a>
      </main>
    );
  }

  return (
    <main
      style={{ maxWidth: 1080, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}
    >
      <style>
        {`
          @keyframes lane-spin {
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
      <nav style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <a href="#/" data-testid="nav-extract">
          Extract
        </a>
        <a href="#/notes" data-testid="nav-notes">
          Notes
        </a>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={async (e) => {
            e.preventDefault();
            await rpc.api.auth.logout.$post();
            setIsAuthenticated(false);
          }}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: '#2563eb',
            textDecoration: 'underline',
            cursor: 'pointer',
            fontSize: 'inherit',
            fontFamily: 'inherit',
          }}
        >
          Sign out
        </button>
      </nav>

      {route === 'notes' ? (
        <NotesPage />
      ) : route === 'view' && params.id ? (
        <ViewPage id={params.id} />
      ) : (
        <ExtractPage />
      )}
    </main>
  );
};
