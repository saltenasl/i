import { useHashRoute } from './hooks/useHashRoute.js';
import { ExtractPage } from './routes/ExtractPage.js';
import { NotesPage } from './routes/NotesPage.js';
import { ViewPage } from './routes/ViewPage.js';

export const App = () => {
  const { route, params } = useHashRoute();

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
