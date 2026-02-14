import type {
  Extraction,
  ExtractionDebug,
  ExtractionLaneId,
  ExtractionLaneResult,
  ExtractionV2,
  NoteDto,
} from '@repo/api';
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

const compareLaneOrder: ExtractionLaneId[] = ['local-llama', 'anthropic-haiku', 'openai-gpt5mini'];

const compareLaneMeta: Record<
  ExtractionLaneId,
  { label: string; providerLabel: string; model: string }
> = {
  'local-llama': {
    label: 'Local Llama',
    providerLabel: 'Local',
    model: 'local-llama.cpp',
  },
  'anthropic-haiku': {
    label: 'Claude Haiku',
    providerLabel: 'Anthropic',
    model: 'claude-haiku-4-5-20251001',
  },
  'openai-gpt5mini': {
    label: 'GPT-5 mini',
    providerLabel: 'OpenAI',
    model: 'gpt-5-mini',
  },
};

type CompareLaneUi = {
  laneId: ExtractionLaneId;
  provider: 'local' | 'anthropic' | 'openai';
  model: string;
  status: 'loading' | 'ok' | 'error' | 'skipped';
  durationMs: number | null;
  extraction?: Extraction;
  extractionV2?: ExtractionV2;
  debug?: ExtractionDebug;
  errorMessage?: string;
};

const createLoadingLane = (laneId: ExtractionLaneId): CompareLaneUi => {
  const lane = compareLaneMeta[laneId];
  return {
    laneId,
    provider:
      laneId === 'local-llama' ? 'local' : laneId === 'anthropic-haiku' ? 'anthropic' : 'openai',
    model: lane.model,
    status: 'loading',
    durationMs: null,
  };
};

const toLaneUi = (lane: ExtractionLaneResult): CompareLaneUi => {
  return {
    laneId: lane.laneId,
    provider: lane.provider,
    model: lane.model,
    status: lane.status,
    durationMs: lane.durationMs,
    ...(lane.extraction ? { extraction: lane.extraction } : {}),
    ...(lane.extractionV2 ? { extractionV2: lane.extractionV2 } : {}),
    ...(lane.debug ? { debug: lane.debug } : {}),
    ...(lane.errorMessage ? { errorMessage: lane.errorMessage } : {}),
  };
};

const CompareLaneCard = ({
  lane,
  sourceText,
  viewMode,
}: {
  lane: CompareLaneUi;
  sourceText: string;
  viewMode: 'knowledge' | 'simple';
}) => {
  const laneLabel = compareLaneMeta[lane.laneId];

  return (
    <article
      data-testid={`compare-lane-${lane.laneId}`}
      style={{
        position: 'relative',
        minWidth: 360,
        maxWidth: 520,
        padding: '14px 14px 14px 42px',
        border: '1px dotted #9aa4b2',
        borderRadius: 10,
        background: '#fff',
      }}
    >
      <span
        data-testid={`compare-lane-vertical-${lane.laneId}`}
        style={{
          position: 'absolute',
          left: 8,
          top: 10,
          writingMode: 'vertical-rl',
          transform: 'rotate(180deg)',
          fontSize: 10,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          color: '#5f6b7a',
          opacity: 0.75,
          pointerEvents: 'none',
        }}
      >
        {laneLabel.providerLabel} {laneLabel.label}
      </span>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong style={{ fontSize: 13 }}>{laneLabel.label}</strong>
        <span data-testid={`compare-lane-status-${lane.laneId}`} style={{ fontSize: 12 }}>
          {lane.status}
        </span>
      </header>

      <p style={{ margin: '4px 0 10px', opacity: 0.75, fontSize: 12 }}>{lane.model}</p>

      {lane.status === 'loading' ? (
        <div
          data-testid={`compare-lane-loading-${lane.laneId}`}
          style={{ display: 'flex', gap: 8 }}
        >
          <span
            className="lane-spinner"
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              border: '2px solid #d0d7de',
              borderTopColor: '#4c6ef5',
              animation: 'lane-spin 0.8s linear infinite',
              marginTop: 3,
            }}
          />
          <span style={{ fontSize: 13 }}>Running {laneLabel.label}...</span>
        </div>
      ) : null}

      {lane.durationMs !== null ? (
        <p style={{ margin: '0 0 10px', fontSize: 12, opacity: 0.75 }}>
          Duration: {lane.durationMs} ms
        </p>
      ) : null}

      {lane.status === 'error' || lane.status === 'skipped' ? (
        <p data-testid={`compare-lane-message-${lane.laneId}`} style={{ margin: 0, fontSize: 13 }}>
          {lane.errorMessage ?? 'No details.'}
        </p>
      ) : null}

      {lane.status === 'ok' && lane.extraction && lane.extractionV2 && lane.debug ? (
        viewMode === 'knowledge' ? (
          <KnowledgeExtractionView
            extractionV2={lane.extractionV2}
            sourceText={sourceText}
            debug={lane.debug}
          />
        ) : (
          <ExtractionView extraction={lane.extraction} sourceText={sourceText} />
        )
      ) : null}
    </article>
  );
};

const ExtractPage = () => {
  const api = useApi();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [compareCompleted, setCompareCompleted] = useState(0);
  const [compareLanes, setCompareLanes] = useState<CompareLaneUi[]>([]);
  const [result, setResult] = useState<{
    extraction: Extraction;
    extractionV2: ExtractionV2;
    debug: ExtractionDebug;
  } | null>(null);
  const [viewMode, setViewMode] = useState<'knowledge' | 'simple'>('knowledge');

  const submit = async () => {
    setIsSubmitting(true);
    setCompareLanes([]);
    setCompareCompleted(0);

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

  const submitCompare = async () => {
    setIsComparing(true);
    setResult(null);
    setError(null);
    setCompareCompleted(0);
    setCompareLanes(compareLaneOrder.map((laneId) => createLoadingLane(laneId)));

    const runLane = async (laneId: ExtractionLaneId) => {
      try {
        const response = await api.call('extract.compareLane', { text, laneId });
        if (!response.ok) {
          setCompareLanes((current) =>
            current.map((lane) =>
              lane.laneId === laneId
                ? {
                    ...lane,
                    status: 'error',
                    durationMs: 0,
                    errorMessage: response.error.message,
                  }
                : lane,
            ),
          );
          return;
        }

        setCompareLanes((current) =>
          current.map((lane) => (lane.laneId === laneId ? toLaneUi(response.data.lane) : lane)),
        );
      } catch (laneError) {
        setCompareLanes((current) =>
          current.map((lane) =>
            lane.laneId === laneId
              ? {
                  ...lane,
                  status: 'error',
                  durationMs: 0,
                  errorMessage: laneError instanceof Error ? laneError.message : String(laneError),
                }
              : lane,
          ),
        );
      } finally {
        setCompareCompleted((value) => value + 1);
      }
    };

    await Promise.allSettled(compareLaneOrder.map((laneId) => runLane(laneId)));
    setIsComparing(false);
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

        <button
          data-testid="extract-submit-button"
          type="submit"
          disabled={isSubmitting || isComparing}
        >
          {isSubmitting ? 'Extracting...' : 'Submit'}
        </button>
        <button
          data-testid="extract-compare-button"
          type="button"
          onClick={() => {
            void submitCompare();
          }}
          disabled={isComparing || isSubmitting}
          style={{ marginLeft: 8 }}
        >
          {isComparing ? 'Running 3 models...' : 'Run A/B Compare'}
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

      {compareLanes.length > 0 ? (
        <section data-testid="compare-results" style={{ marginTop: 18, display: 'grid', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>Model Compare</h2>
            <p data-testid="compare-progress" style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>
              {compareCompleted}/{compareLaneOrder.length} complete
            </p>
          </div>

          <div
            data-testid="compare-lanes-scroll"
            style={{
              display: 'flex',
              gap: 12,
              overflowX: 'auto',
              paddingBottom: 8,
            }}
          >
            {compareLaneOrder.map((laneId) => {
              const lane = compareLanes.find((entry) => entry.laneId === laneId);
              if (!lane) {
                return null;
              }

              return (
                <CompareLaneCard key={laneId} lane={lane} sourceText={text} viewMode={viewMode} />
              );
            })}
          </div>
        </section>
      ) : null}
    </section>
  );
};

export const App = () => {
  const route = useHashRoute();

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

      {route === 'notes' ? <NotesPage /> : <ExtractPage />}
    </main>
  );
};
