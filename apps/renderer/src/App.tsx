import type { Extraction, ExtractionDebug, ExtractionV2, NoteDto } from '@repo/api';
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

const entityColorPalette = [
  '#fff3bf',
  '#d3f9d8',
  '#d0ebff',
  '#ffd8a8',
  '#e5dbff',
  '#ffc9c9',
  '#c5f6fa',
  '#ffe3e3',
];

const getEntityColor = (index: number): string => {
  return entityColorPalette[index % entityColorPalette.length] ?? '#fff3bf';
};

const buildEntityChunks = (
  text: string,
  extractionV2: ExtractionV2,
): Array<{ key: string; text: string; entityId: string | null }> => {
  const spans = extractionV2.entities
    .map((entity) => ({ id: entity.id, start: entity.nameStart, end: entity.nameEnd }))
    .sort((a, b) => a.start - b.start);

  const chunks: Array<{ key: string; text: string; entityId: string | null }> = [];
  let cursor = 0;
  let plainCount = 0;

  for (const span of spans) {
    if (span.start < cursor || span.start >= span.end || span.end > text.length) {
      continue;
    }

    if (span.start > cursor) {
      chunks.push({
        key: `plain-${plainCount}-${cursor}-${span.start}`,
        text: text.slice(cursor, span.start),
        entityId: null,
      });
      plainCount += 1;
    }

    chunks.push({
      key: `entity-${span.id}-${span.start}-${span.end}`,
      text: text.slice(span.start, span.end),
      entityId: span.id,
    });

    cursor = span.end;
  }

  if (cursor < text.length) {
    chunks.push({
      key: `plain-${plainCount}-${cursor}-${text.length}`,
      text: text.slice(cursor),
      entityId: null,
    });
  }

  return chunks;
};

const getExcerpt = (text: string, start: number, end: number): string => {
  const left = Math.max(0, start - 40);
  const right = Math.min(text.length, end + 40);
  return text.slice(left, right).replace(/\s+/g, ' ').trim();
};

const ExtractionView = ({
  extraction,
  sourceText,
}: { extraction: Extraction; sourceText: string }) => {
  return (
    <section
      data-testid="extraction-result"
      style={{ border: '1px solid #d0d7de', borderRadius: 10, padding: 16, marginTop: 20 }}
    >
      <h2 data-testid="extraction-title" style={{ marginTop: 0 }}>
        {extraction.title}
      </h2>
      {extraction.memory ? <p data-testid="extraction-memory">{extraction.memory}</p> : null}

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
        {extraction.groups.map((group, groupIndex) => (
          <li key={`${group.name}-${groupIndex}`}>
            <strong>{group.name}</strong>: {group.itemIndexes.join(', ')}
          </li>
        ))}
      </ul>

      <h3>Source</h3>
      <pre style={{ whiteSpace: 'pre-wrap', border: '1px solid #d0d7de', padding: 10 }}>
        {sourceText}
      </pre>
    </section>
  );
};

const KnowledgeExtractionView = ({
  extractionV2,
  sourceText,
  debug,
}: {
  extractionV2: ExtractionV2;
  sourceText: string;
  debug: ExtractionDebug;
}) => {
  const entityOrder = useMemo(() => {
    return extractionV2.entities.map((entity, index) => ({
      id: entity.id,
      color: getEntityColor(index),
    }));
  }, [extractionV2.entities]);

  const colorByEntityId = useMemo(() => {
    return new Map(entityOrder.map((entry) => [entry.id, entry.color]));
  }, [entityOrder]);

  const entityById = useMemo(() => {
    return new Map(extractionV2.entities.map((entity) => [entity.id, entity]));
  }, [extractionV2.entities]);

  const highlightedChunks = useMemo(() => {
    return buildEntityChunks(sourceText, extractionV2);
  }, [sourceText, extractionV2]);

  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  const copyDebugBundle = async () => {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(
          {
            copiedAt: new Date().toISOString(),
            sourceText,
            prompt: debug.prompt,
            rawModelOutput: debug.rawModelOutput,
            validatedExtractionV2BeforeSegmentation: debug.validatedExtractionV2BeforeSegmentation,
            finalExtractionV2: debug.finalExtractionV2,
            finalExtractionV1: debug.finalExtractionV1,
            segmentationTrace: debug.segmentationTrace,
            runtime: debug.runtime,
            fallbackUsed: debug.fallbackUsed,
            errors: debug.errors,
          },
          null,
          2,
        ),
      );
      setCopyState('copied');
    } catch {
      setCopyState('error');
    }
  };

  return (
    <section data-testid="extraction-v2-result" style={{ display: 'grid', gap: 14 }}>
      <div>
        <h3 style={{ marginBottom: 4 }}>Knowledge Summary</h3>
        <p style={{ margin: 0 }}>{extractionV2.summary}</p>
        <p style={{ margin: '6px 0 0', opacity: 0.8, fontSize: 13 }}>
          Type: {extractionV2.noteType} | Language: {extractionV2.language} | Sentiment:{' '}
          {extractionV2.sentiment}
        </p>
      </div>

      <div>
        <button
          type="button"
          data-testid="copy-debug-bundle"
          onClick={() => void copyDebugBundle()}
        >
          Copy Debug Bundle
        </button>
        <span data-testid="copy-debug-state" style={{ marginLeft: 8, opacity: 0.8 }}>
          {copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Copy failed' : ''}
        </span>
      </div>

      <div>
        <h3 style={{ marginBottom: 6 }}>Source Text</h3>
        <div
          data-testid="extraction-v2-source"
          style={{
            border: '1px solid #d0d7de',
            borderRadius: 8,
            padding: 10,
            whiteSpace: 'pre-wrap',
            lineHeight: 1.5,
          }}
        >
          {highlightedChunks.map((chunk) => {
            if (!chunk.entityId) {
              return <span key={chunk.key}>{chunk.text}</span>;
            }

            const entity = entityById.get(chunk.entityId);
            return (
              <span
                key={chunk.key}
                style={{
                  background: colorByEntityId.get(chunk.entityId) ?? '#fff3bf',
                  borderRadius: 4,
                  padding: '1px 2px',
                }}
                title={entity ? `${entity.name} (${entity.type})` : chunk.entityId}
              >
                {chunk.text}
              </span>
            );
          })}
        </div>
      </div>

      <div>
        <h3 style={{ marginBottom: 6 }}>Entities</h3>
        <ul data-testid="extraction-v2-entities" style={{ margin: 0, paddingLeft: 18 }}>
          {extractionV2.entities.map((entity, index) => {
            const excerptStart = entity.evidenceStart ?? entity.nameStart;
            const excerptEnd = entity.evidenceEnd ?? entity.nameEnd;
            return (
              <li key={entity.id}>
                <span
                  data-testid={`entity-color-${entity.id}`}
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    marginRight: 6,
                    background: getEntityColor(index),
                  }}
                />
                <strong>{entity.name}</strong> ({entity.type}) [{entity.nameStart}-{entity.nameEnd}]
                -{' '}
                <span data-testid={`entity-excerpt-${entity.id}`}>
                  {getExcerpt(sourceText, excerptStart, excerptEnd)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h3 style={{ marginBottom: 6 }}>Facts</h3>
        <ul data-testid="extraction-v2-facts" style={{ margin: 0, paddingLeft: 18 }}>
          {extractionV2.facts.map((fact) => {
            const owner = entityById.get(fact.ownerEntityId)?.name ?? fact.ownerEntityId;
            const subject = fact.subjectEntityId
              ? (entityById.get(fact.subjectEntityId)?.name ?? fact.subjectEntityId)
              : '-';
            const object = fact.objectEntityId
              ? (entityById.get(fact.objectEntityId)?.name ?? fact.objectEntityId)
              : (fact.objectText ?? '-');

            return (
              <li key={fact.id}>
                owner=<strong>{owner}</strong> perspective=<strong>{fact.perspective}</strong> |{' '}
                {subject} → <strong>{fact.predicate}</strong> → {object} [{fact.evidenceStart}-
                {fact.evidenceEnd}] seg:
                {fact.segmentId ?? '-'}
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h3 style={{ marginBottom: 6 }}>Relations</h3>
        <ul data-testid="extraction-v2-relations" style={{ margin: 0, paddingLeft: 18 }}>
          {extractionV2.relations.map((relation, index) => (
            <li key={`${relation.fromEntityId}-${relation.toEntityId}-${relation.type}-${index}`}>
              {relation.fromEntityId} → {relation.toEntityId} ({relation.type})
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 style={{ marginBottom: 6 }}>Segments</h3>
        <ul data-testid="extraction-v2-segments" style={{ margin: 0, paddingLeft: 18 }}>
          {extractionV2.segments.map((segment) => (
            <li key={segment.id}>
              <strong>{segment.id}</strong> [{segment.start}-{segment.end}] sentiment=
              {segment.sentiment} -{' '}
              {segment.summary || getExcerpt(sourceText, segment.start, segment.end)}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 style={{ marginBottom: 6 }}>Groups</h3>
        <ul data-testid="extraction-v2-groups" style={{ margin: 0, paddingLeft: 18 }}>
          {extractionV2.groups.map((group) => (
            <li key={group.name}>
              <strong>{group.name}</strong> - entities: {group.entityIds.length}, facts:{' '}
              {group.factIds.length}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

const ExtractPage = () => {
  const api = useApi();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    extraction: Extraction;
    extractionV2: ExtractionV2;
    debug: ExtractionDebug;
  } | null>(null);
  const [viewMode, setViewMode] = useState<'knowledge' | 'simple'>('knowledge');

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
    setResult({
      extraction: response.data.extraction,
      extractionV2: response.data.extractionV2,
      debug: response.data.debug,
    });
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

      {result ? (
        <>
          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <button
              type="button"
              data-testid="view-knowledge"
              onClick={() => setViewMode('knowledge')}
              style={{ fontWeight: viewMode === 'knowledge' ? 700 : 400 }}
            >
              Knowledge View
            </button>
            <button
              type="button"
              data-testid="view-simple"
              onClick={() => setViewMode('simple')}
              style={{ fontWeight: viewMode === 'simple' ? 700 : 400 }}
            >
              Simple View
            </button>
          </div>

          {viewMode === 'knowledge' ? (
            <KnowledgeExtractionView
              extractionV2={result.extractionV2}
              sourceText={text}
              debug={result.debug}
            />
          ) : (
            <ExtractionView extraction={result.extraction} sourceText={text} />
          )}

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
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </>
      ) : null}
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
