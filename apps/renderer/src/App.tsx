import { useEffect, useRef } from 'react';
import { useApi } from './api-context.js';
import { useHashRoute } from './hooks/useHashRoute.js';
import { ExtractPage } from './routes/ExtractPage.js';
import { NotesPage } from './routes/NotesPage.js';
import { ViewPage } from './routes/ViewPage.js';

export const App = () => {
  const { route, params } = useHashRoute();
  const api = useApi();
  const didAutoView = useRef(false);

  useEffect(() => {
    if (didAutoView.current) {
      return;
    }
    if (route !== 'extract') {
      return;
    }
    didAutoView.current = true;

    const autoView = async () => {
      const response = await api.call('extract.history.list', { limit: 1 });
      if (response.ok) {
        const latest = response.data.entries[0];
        if (latest) {
          window.location.hash = `#/view/${latest.id}`;
        }
      }
    };
    void autoView();
  }, [route, api]);

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
