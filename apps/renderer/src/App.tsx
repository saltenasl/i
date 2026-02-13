import type { Extraction, NoteDto } from '@repo/api';
import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useApi } from './api-context.js';

type Route = 'extract' | 'notes';

const resolveRoute = (hash: string): Route => {
  if (hash === '#/notes') {
    return 'notes';
  }

  return 'extract';
};

const useHashRoute = (): Route => {
  const [route, setRoute] = useState<Route>(() => resolveRoute(window.location.hash));

  useEffect(() => {
    const onHashChange = () => {
      setRoute(resolveRoute(window.location.hash));
    };

    window.addEventListener('hashchange', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
    };
  }, []);

  return route;
};

const NotesPage = () => {
  const api = useApi();
  const [notes, setNotes] = useState<NoteDto[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadNotes = useCallback(async () => {
    const response = await api.call('notes.list', {});
    if (!response.ok) {
      setError(response.error.message);
      return;
    }

    setError(null);
    setNotes(response.data.notes);
  }, [api]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    const response = await api.call('notes.create', {
      title,
      body,
    });

    setIsSubmitting(false);

    if (!response.ok) {
      setError(response.error.message);
      return;
    }

    setError(null);
    setTitle('');
    setBody('');
    await loadNotes();
  };

  return (
    <section>
      <h1>Notes</h1>

      <form onSubmit={onSubmit} aria-label="create-note-form">
        <label htmlFor="title">Title</label>
        <input
          id="title"
          data-testid="title-input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Title"
        />

        <label htmlFor="body">Body</label>
        <textarea
          id="body"
          data-testid="body-input"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Body"
        />

        <button data-testid="create-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create'}
        </button>
      </form>

      {error ? (
        <p role="alert" data-testid="notes-error-message">
          {error}
        </p>
      ) : null}

      {notes.length === 0 ? (
        <p data-testid="empty-state">No notes yet.</p>
      ) : (
        <ul data-testid="notes-list">
          {notes.map((note) => (
            <li key={note.id}>
              <strong>{note.title}</strong>
              {note.body ? <p>{note.body}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

const ExtractionView = ({ extraction }: { extraction: Extraction }) => {
  const groupedItems = useMemo(() => {
    return extraction.groups.map((group) => ({
      ...group,
      labels: group.itemIndexes.map((itemIndex) => extraction.items[itemIndex]?.label ?? 'unknown'),
    }));
  }, [extraction]);

  return (
    <section data-testid="extraction-result">
      <h2 data-testid="extraction-title">{extraction.title}</h2>
      {extraction.memory ? <p data-testid="extraction-memory">{extraction.memory}</p> : null}

      <h3>Items</h3>
      <table data-testid="extraction-items-table">
        <thead>
          <tr>
            <th>Label</th>
            <th>Value</th>
            <th>Span</th>
            <th>Confidence</th>
          </tr>
        </thead>
        <tbody>
          {extraction.items.map((item, index) => (
            <tr key={`${item.label}-${item.start}-${item.end}-${index}`}>
              <td>{item.label}</td>
              <td>{item.value}</td>
              <td>
                {item.start}-{item.end}
              </td>
              <td>{item.confidence.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Groups</h3>
      <ul data-testid="extraction-groups-list">
        {groupedItems.map((group, groupIndex) => (
          <li key={`${group.name}-${groupIndex}`}>
            <strong>{group.name}</strong>: {group.labels.join(', ')}
          </li>
        ))}
      </ul>
    </section>
  );
};

const ExtractPage = () => {
  const api = useApi();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<Extraction | null>(null);

  const submit = async () => {
    setIsSubmitting(true);

    const response = await api.call('extract.run', { text });

    setIsSubmitting(false);

    if (!response.ok) {
      setError(response.error.message);
      setResult(null);
      return;
    }

    setError(null);
    setResult(response.data.extraction);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await submit();
  };

  const onKeyDown = async (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && event.metaKey) {
      event.preventDefault();
      await submit();
    }
  };

  return (
    <section>
      <h1>Auto Extract</h1>

      <form onSubmit={onSubmit} aria-label="extract-form">
        <label htmlFor="extract-text">Text</label>
        <textarea
          id="extract-text"
          data-testid="extract-text-input"
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            void onKeyDown(event);
          }}
          placeholder="Paste text and press Cmd+Enter to submit"
        />

        <button data-testid="extract-submit-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Extracting...' : 'Submit'}
        </button>
      </form>

      {error ? (
        <p role="alert" data-testid="extract-error-message">
          {error}
        </p>
      ) : null}

      {result ? <ExtractionView extraction={result} /> : null}
    </section>
  );
};

export const App = () => {
  const route = useHashRoute();

  return (
    <main
      style={{ maxWidth: 900, margin: '0 auto', padding: 24, fontFamily: 'system-ui, sans-serif' }}
    >
      <nav style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
        <a href="#/" data-testid="nav-extract">
          Extract
        </a>
        <a href="#/notes" data-testid="nav-notes">
          Notes
        </a>
      </nav>

      {route === 'notes' ? <NotesPage /> : <ExtractPage />}
    </main>
  );
};
