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

const getHighlightColor = (index: number): string => {
  const colors = ['#fff3bf', '#d3f9d8', '#d0ebff', '#ffd8a8', '#e5dbff', '#ffc9c9'];
  return colors[index % colors.length] ?? '#fff3bf';
};

const buildHighlightedChunks = (
  text: string,
  extraction: Extraction,
): Array<{ key: string; text: string; itemIndex: number | null }> => {
  const sorted = extraction.items
    .map((item, index) => ({ ...item, index }))
    .sort((a, b) => a.start - b.start);

  const chunks: Array<{ key: string; text: string; itemIndex: number | null }> = [];
  let cursor = 0;
  let plainChunkCount = 0;

  for (const item of sorted) {
    if (item.start > cursor) {
      chunks.push({
        key: `plain-${plainChunkCount}-${cursor}-${item.start}`,
        text: text.slice(cursor, item.start),
        itemIndex: null,
      });
      plainChunkCount += 1;
    }

    chunks.push({
      key: `item-${item.index}-${item.start}-${item.end}`,
      text: text.slice(item.start, item.end),
      itemIndex: item.index,
    });
    cursor = item.end;
  }

  if (cursor < text.length) {
    chunks.push({
      key: `plain-${plainChunkCount}-${cursor}-${text.length}`,
      text: text.slice(cursor),
      itemIndex: null,
    });
  }

  return chunks;
};

const ExtractionView = ({
  extraction,
  sourceText,
}: { extraction: Extraction; sourceText: string }) => {
  const groupedItems = useMemo(() => {
    return extraction.groups.map((group) => ({
      ...group,
      labels: group.itemIndexes.map((itemIndex) => extraction.items[itemIndex]?.label ?? 'unknown'),
    }));
  }, [extraction]);

  const highlightedChunks = useMemo(
    () => buildHighlightedChunks(sourceText, extraction),
    [sourceText, extraction],
  );

  const groupedItemIndexes = useMemo(() => {
    return new Set(groupedItems.flatMap((group) => group.itemIndexes));
  }, [groupedItems]);

  return (
    <section
      data-testid="extraction-result"
      style={{ border: '1px solid #d0d7de', borderRadius: 10, padding: 16, marginTop: 20 }}
    >
      <h2 data-testid="extraction-title" style={{ marginTop: 0 }}>
        {extraction.title}
      </h2>
      {extraction.memory ? <p data-testid="extraction-memory">{extraction.memory}</p> : null}

      <h3 style={{ marginBottom: 8 }}>What Was Found</h3>
      <div
        style={{
          border: '1px solid #d0d7de',
          borderRadius: 8,
          padding: 12,
          background: '#fafbfc',
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
        }}
      >
        {highlightedChunks.map((chunk) => {
          if (chunk.itemIndex === null) {
            return <span key={chunk.key}>{chunk.text}</span>;
          }

          const item = extraction.items[chunk.itemIndex];
          if (!item) {
            return <span key={chunk.key}>{chunk.text}</span>;
          }

          return (
            <span
              key={chunk.key}
              title={`${item.label} (${item.start}-${item.end})`}
              style={{
                background: getHighlightColor(chunk.itemIndex),
                borderRadius: 4,
                padding: '1px 2px',
              }}
            >
              {chunk.text}
            </span>
          );
        })}
      </div>

      <h3 style={{ marginTop: 16 }}>Items</h3>
      <div style={{ display: 'grid', gap: 8, marginBottom: 10 }}>
        {extraction.items.map((item, index) => (
          <div
            key={`${item.label}-${item.start}-${item.end}-${index}`}
            style={{
              border: '1px solid #d0d7de',
              borderRadius: 8,
              padding: 8,
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: 6,
            }}
          >
            <div>
              <strong>{item.label}</strong>{' '}
              <span style={{ opacity: 0.8 }}>
                ({item.start}-{item.end})
              </span>
            </div>
            <div style={{ fontVariantNumeric: 'tabular-nums' }}>{item.confidence.toFixed(2)}</div>
            <div
              style={{
                gridColumn: '1 / span 2',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              }}
            >
              {item.value}
            </div>
          </div>
        ))}
      </div>

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
      <ul data-testid="extraction-groups-list" style={{ display: 'grid', gap: 8 }}>
        {groupedItems.map((group, groupIndex) => (
          <li key={`${group.name}-${groupIndex}`}>
            <strong>{group.name}</strong>:{' '}
            {group.labels.map((label, labelIndex) => (
              <span
                key={`${group.name}-${label}-${labelIndex}`}
                style={{
                  display: 'inline-block',
                  marginRight: 6,
                  marginTop: 4,
                  padding: '2px 8px',
                  borderRadius: 999,
                  border: '1px solid #cdd9e5',
                  background: '#f6f8fa',
                }}
              >
                {label}
              </span>
            ))}
          </li>
        ))}
      </ul>

      <p style={{ marginTop: 12, fontSize: 13, opacity: 0.8 }}>
        Grouped items: {groupedItemIndexes.size}/{extraction.items.length}
      </p>

      <details style={{ marginTop: 10 }}>
        <summary>Raw JSON</summary>
        <pre
          data-testid="extraction-raw-json"
          style={{
            marginTop: 10,
            padding: 10,
            borderRadius: 8,
            border: '1px solid #d0d7de',
            background: '#0d1117',
            color: '#e6edf3',
            overflowX: 'auto',
          }}
        >
          {JSON.stringify(extraction, null, 2)}
        </pre>
      </details>
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

      {result ? <ExtractionView extraction={result} sourceText={text} /> : null}
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
