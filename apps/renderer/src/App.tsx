import type {
  Extraction,
  ExtractionDebug,
  ExtractionHistoryEntryDto,
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

const getExcerpt = (text: string, start: number, end: number): string => {
  const left = Math.max(0, start - 40);
  const right = Math.min(text.length, end + 40);
  return text.slice(left, right).replace(/\s+/g, ' ').trim();
};

const formatSpan = (start: number, end: number): string => {
  return `${start}-${end}`;
};

const formatOptionalSpan = (start: number | undefined, end: number | undefined): string => {
  if (start === undefined || end === undefined) {
    return '-';
  }
  return `${start}-${end}`;
};

const ExtractionContractView = ({
  extraction,
  extractionV2,
  sourceText,
  debug,
}: {
  extraction: Extraction;
  extractionV2: ExtractionV2;
  sourceText: string;
  debug: ExtractionDebug;
}) => {
  const entityById = useMemo(() => {
    return new Map(extractionV2.entities.map((entity) => [entity.id, entity]));
  }, [extractionV2.entities]);

  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');

  const getEntityLabel = (entityId: string | undefined): string => {
    if (!entityId) {
      return '-';
    }
    const entity = entityById.get(entityId);
    if (!entity) {
      return entityId;
    }
    return `${entityId} (${entity.name})`;
  };

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
        <h3 style={{ marginBottom: 6 }}>Extraction Metadata</h3>
        <ul data-testid="extraction-v2-metadata" style={{ margin: 0, paddingLeft: 18 }}>
          <li>
            <strong>title</strong>: {extractionV2.title}
          </li>
          <li>
            <strong>noteType</strong>: {extractionV2.noteType}
          </li>
          <li>
            <strong>summary</strong>: {extractionV2.summary}
          </li>
          <li>
            <strong>language</strong>: {extractionV2.language}
          </li>
          <li>
            <strong>date</strong>: {extractionV2.date ?? '-'}
          </li>
          <li>
            <strong>sentiment</strong>: {extractionV2.sentiment}
          </li>
        </ul>
      </div>

      <div>
        <h3 style={{ marginBottom: 6 }}>Emotions</h3>
        <ul data-testid="extraction-v2-emotions" style={{ margin: 0, paddingLeft: 18 }}>
          {extractionV2.emotions.length === 0 ? (
            <li>-</li>
          ) : (
            extractionV2.emotions.map((emotion, index) => (
              <li key={`${emotion.emotion}-${index}`}>
                {emotion.emotion} (intensity {emotion.intensity})
              </li>
            ))
          )}
        </ul>
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
        <pre
          data-testid="extraction-v2-source"
          style={{
            border: '1px solid #d0d7de',
            borderRadius: 8,
            padding: 10,
            whiteSpace: 'pre-wrap',
            lineHeight: 1.5,
            margin: 0,
          }}
        >
          {sourceText}
        </pre>
      </div>

      <div>
        <h3 style={{ marginBottom: 6 }}>Entities</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>id</th>
                <th>name</th>
                <th>type</th>
                <th>nameSpan</th>
                <th>evidenceSpan</th>
                <th>context</th>
                <th>confidence</th>
                <th>excerpt</th>
              </tr>
            </thead>
            <tbody data-testid="extraction-v2-entities">
              {extractionV2.entities.map((entity) => (
                <tr key={entity.id} data-testid={`entity-row-${entity.id}`}>
                  <td>{entity.id}</td>
                  <td>{entity.name}</td>
                  <td>{entity.type}</td>
                  <td>{formatSpan(entity.nameStart, entity.nameEnd)}</td>
                  <td>{formatOptionalSpan(entity.evidenceStart, entity.evidenceEnd)}</td>
                  <td>{entity.context ?? '-'}</td>
                  <td>{entity.confidence.toFixed(2)}</td>
                  <td data-testid={`entity-excerpt-${entity.id}`}>
                    {getExcerpt(sourceText, entity.nameStart, entity.nameEnd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 style={{ marginBottom: 6 }}>Facts</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>id</th>
                <th>ownerEntityId</th>
                <th>perspective</th>
                <th>subjectEntityId</th>
                <th>predicate</th>
                <th>object</th>
                <th>segmentId</th>
                <th>evidenceSpan</th>
                <th>confidence</th>
                <th>excerpt</th>
              </tr>
            </thead>
            <tbody data-testid="extraction-v2-facts">
              {extractionV2.facts.map((fact) => (
                <tr key={fact.id} data-testid={`fact-row-${fact.id}`}>
                  <td>{fact.id}</td>
                  <td>{getEntityLabel(fact.ownerEntityId)}</td>
                  <td>{fact.perspective}</td>
                  <td>{getEntityLabel(fact.subjectEntityId)}</td>
                  <td>{fact.predicate}</td>
                  <td>
                    {fact.objectEntityId
                      ? getEntityLabel(fact.objectEntityId)
                      : (fact.objectText ?? '-')}
                  </td>
                  <td>{fact.segmentId ?? '-'}</td>
                  <td>{formatSpan(fact.evidenceStart, fact.evidenceEnd)}</td>
                  <td>{fact.confidence.toFixed(2)}</td>
                  <td>{getExcerpt(sourceText, fact.evidenceStart, fact.evidenceEnd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 style={{ marginBottom: 6 }}>Relations</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>#</th>
                <th>fromEntityId</th>
                <th>toEntityId</th>
                <th>type</th>
                <th>evidenceSpan</th>
                <th>confidence</th>
              </tr>
            </thead>
            <tbody data-testid="extraction-v2-relations">
              {extractionV2.relations.map((relation, index) => (
                <tr
                  key={`${relation.fromEntityId}-${relation.toEntityId}-${relation.type}-${index}`}
                >
                  <td>{index}</td>
                  <td>{getEntityLabel(relation.fromEntityId)}</td>
                  <td>{getEntityLabel(relation.toEntityId)}</td>
                  <td>{relation.type}</td>
                  <td>{formatOptionalSpan(relation.evidenceStart, relation.evidenceEnd)}</td>
                  <td>{relation.confidence.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 style={{ marginBottom: 6 }}>Groups</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>name</th>
                <th>entityIds</th>
                <th>factIds</th>
              </tr>
            </thead>
            <tbody data-testid="extraction-v2-groups">
              {extractionV2.groups.map((group) => (
                <tr key={group.name}>
                  <td>{group.name}</td>
                  <td>
                    {group.entityIds.length === 0
                      ? '-'
                      : group.entityIds.map((entityId) => getEntityLabel(entityId)).join(', ')}
                  </td>
                  <td>{group.factIds.length === 0 ? '-' : group.factIds.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <details>
        <summary>V1 Compatibility Output</summary>
        <pre
          data-testid="extraction-v1-json"
          style={{
            marginTop: 8,
            border: '1px solid #d0d7de',
            borderRadius: 8,
            padding: 10,
            whiteSpace: 'pre-wrap',
            overflowX: 'auto',
          }}
        >
          {JSON.stringify(extraction, null, 2)}
        </pre>
      </details>
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

const LANE_ERROR_PREVIEW_MAX_CHARS = 320;

const splitLaneErrorMessage = (
  errorMessage: string | undefined,
): { preview: string; details?: string } => {
  const normalized = (errorMessage ?? 'No details.').trim();
  const rawOutputIndex = normalized.indexOf('Raw output:');
  if (rawOutputIndex >= 0) {
    const preview = normalized.slice(0, rawOutputIndex).trim();
    const details = normalized.slice(rawOutputIndex).trim();
    return {
      preview: preview.length > 0 ? preview : 'Model output was not valid JSON.',
      ...(details.length > 0 ? { details } : {}),
    };
  }

  if (normalized.length <= LANE_ERROR_PREVIEW_MAX_CHARS) {
    return { preview: normalized };
  }

  return {
    preview: `${normalized.slice(0, LANE_ERROR_PREVIEW_MAX_CHARS).trimEnd()}...`,
    details: normalized,
  };
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
}: {
  lane: CompareLaneUi;
  sourceText: string;
}) => {
  const laneLabel = compareLaneMeta[lane.laneId];
  const laneExtraction = lane.status === 'ok' ? lane.extractionV2 : undefined;
  const laneError =
    lane.status === 'error' || lane.status === 'skipped'
      ? splitLaneErrorMessage(lane.errorMessage)
      : undefined;

  return (
    <article
      data-testid={`compare-lane-${lane.laneId}`}
      style={{
        position: 'relative',
        minWidth: 0,
        width: '100%',
        boxSizing: 'border-box',
        padding: '14px 14px 14px 42px',
        border: '1px dotted #9aa4b2',
        borderRadius: 10,
        background: '#fff',
        overflow: 'hidden',
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
        <div style={{ display: 'grid', gap: 8 }}>
          <p
            data-testid={`compare-lane-message-${lane.laneId}`}
            style={{ margin: 0, fontSize: 13, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
          >
            {laneError?.preview}
          </p>
          {laneError?.details ? (
            <details>
              <summary>Show Full Error</summary>
              <pre
                data-testid={`compare-lane-message-full-${lane.laneId}`}
                style={{
                  marginTop: 8,
                  maxHeight: 220,
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  overflowWrap: 'anywhere',
                  border: '1px solid #d0d7de',
                  borderRadius: 8,
                  padding: 8,
                }}
              >
                {laneError.details}
              </pre>
            </details>
          ) : null}
        </div>
      ) : null}

      {lane.status === 'ok' && lane.extraction && lane.extractionV2 && lane.debug ? (
        <div
          data-testid={`compare-lane-success-${lane.laneId}`}
          style={{ display: 'grid', gap: 10 }}
        >
          <div style={{ fontSize: 13, display: 'grid', gap: 4 }}>
            <div>
              <strong>Title:</strong> {laneExtraction?.title}
            </div>
            <div>
              <strong>Sentiment:</strong> {laneExtraction?.sentiment}
            </div>
            <div>
              <strong>Entities:</strong> {laneExtraction?.entities.length ?? 0} |{' '}
              <strong>Facts:</strong> {laneExtraction?.facts.length ?? 0} |{' '}
              <strong>Relations:</strong> {laneExtraction?.relations.length ?? 0}
            </div>
            <div style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              <strong>Summary:</strong> {laneExtraction?.summary}
            </div>
          </div>
          <details>
            <summary>Open Full Extraction</summary>
            <div
              style={{
                marginTop: 8,
                maxHeight: 520,
                overflow: 'auto',
                border: '1px solid #d0d7de',
                borderRadius: 8,
                padding: 8,
              }}
            >
              <ExtractionContractView
                extraction={lane.extraction}
                extractionV2={lane.extractionV2}
                sourceText={sourceText}
                debug={lane.debug}
              />
            </div>
          </details>
        </div>
      ) : null}
    </article>
  );
};

const ExtractPage = () => {
  const api = useApi();
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [compareCompleted, setCompareCompleted] = useState(0);
  const [compareLanes, setCompareLanes] = useState<CompareLaneUi[]>([]);
  const [historyEntries, setHistoryEntries] = useState<ExtractionHistoryEntryDto[]>([]);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<Set<string>>(new Set());
  const [copySelectedState, setCopySelectedState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [result, setResult] = useState<{
    extraction: Extraction;
    extractionV2: ExtractionV2;
    debug: ExtractionDebug;
  } | null>(null);

  const loadHistory = useCallback(async () => {
    const response = await api.call('extract.history.list', { limit: 100 });
    if (!response.ok) {
      setHistoryError(response.error.message);
      return;
    }
    setHistoryError(null);
    setHistoryEntries(response.data.entries);
  }, [api]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

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
    await loadHistory();
  };

  const submitCompare = async () => {
    setIsComparing(true);
    setResult(null);
    setError(null);
    setCompareCompleted(0);
    setCompareLanes(compareLaneOrder.map((laneId) => createLoadingLane(laneId)));
    try {
      const response = await api.call('extract.compare', { text });
      if (!response.ok) {
        setError(response.error.message);
        setCompareLanes([]);
        return;
      }

      const byLaneId = new Map(response.data.lanes.map((lane) => [lane.laneId, toLaneUi(lane)]));
      setCompareLanes(
        compareLaneOrder.map((laneId) => byLaneId.get(laneId) ?? createLoadingLane(laneId)),
      );
      setCompareCompleted(compareLaneOrder.length);
    } catch (compareError) {
      setError(compareError instanceof Error ? compareError.message : String(compareError));
      setCompareLanes([]);
    }
    setIsComparing(false);
    await loadHistory();
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

  const toggleHistorySelection = (entryId: string) => {
    setSelectedHistoryIds((current) => {
      const next = new Set(current);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
    setCopySelectedState('idle');
  };

  const selectedHistory = historyEntries.filter((entry) => selectedHistoryIds.has(entry.id));

  const copySelectedDebugLogs = async () => {
    try {
      await navigator.clipboard.writeText(
        JSON.stringify(
          {
            copiedAt: new Date().toISOString(),
            count: selectedHistory.length,
            entries: selectedHistory.map((entry) => ({
              id: entry.id,
              createdAt: entry.createdAt,
              sourceText: entry.sourceText,
              prompt: entry.prompt,
              extraction: entry.extraction,
              extractionV2: entry.extractionV2,
              debug: entry.debug,
              compareLanes: entry.compareLanes,
            })),
          },
          null,
          2,
        ),
      );
      setCopySelectedState('copied');
    } catch {
      setCopySelectedState('error');
    }
  };

  const openHistoryEntry = (entry: ExtractionHistoryEntryDto) => {
    setText(entry.sourceText);
    setResult({
      extraction: entry.extraction,
      extractionV2: entry.extractionV2,
      debug: entry.debug,
    });
    setCompareLanes((entry.compareLanes ?? []).map(toLaneUi));
    setCompareCompleted(entry.compareLanes ? entry.compareLanes.length : 0);
    setError(null);
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

      {historyError ? (
        <p role="alert" data-testid="extract-history-error">
          {historyError}
        </p>
      ) : null}

      {result ? (
        <>
          <ExtractionContractView
            extraction={result.extraction}
            extractionV2={result.extractionV2}
            sourceText={text}
            debug={result.debug}
          />

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
              display: 'grid',
              width: '100%',
              gap: 12,
              alignItems: 'start',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            }}
          >
            {compareLaneOrder.map((laneId) => {
              const lane = compareLanes.find((entry) => entry.laneId === laneId);
              if (!lane) {
                return null;
              }

              return <CompareLaneCard key={laneId} lane={lane} sourceText={text} />;
            })}
          </div>
        </section>
      ) : null}

      <section data-testid="extraction-history" style={{ marginTop: 20, display: 'grid', gap: 10 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>Extraction History</h2>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>
          Select one or more entries to enable bulk debug-copy.
        </p>
        {historyEntries.length === 0 ? (
          <p data-testid="extraction-history-empty" style={{ margin: 0, opacity: 0.75 }}>
            No extraction history yet.
          </p>
        ) : (
          <ul
            data-testid="extraction-history-list"
            style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 10 }}
          >
            {historyEntries.map((entry) => {
              const selected = selectedHistoryIds.has(entry.id);
              return (
                <li
                  key={entry.id}
                  data-testid={`history-item-${entry.id}`}
                  style={{
                    position: 'relative',
                    border: selected ? '1px solid #f08c00' : '1px solid #d0d7de',
                    borderRadius: 10,
                    padding: '10px 54px 10px 14px',
                    background: selected ? '#fff9db' : '#fff',
                  }}
                >
                  <label
                    data-testid={`history-checkbox-floating-${entry.id}`}
                    style={{
                      position: 'absolute',
                      top: 10,
                      right: 10,
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      border: '1px solid #cfd8e3',
                      background: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                      cursor: 'pointer',
                    }}
                    title="Select debug bundle"
                  >
                    <input
                      data-testid={`history-checkbox-${entry.id}`}
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleHistorySelection(entry.id)}
                    />
                  </label>

                  <button
                    type="button"
                    data-testid={`history-open-${entry.id}`}
                    onClick={() => openHistoryEntry(entry)}
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                      display: 'block',
                      width: '100%',
                    }}
                  >
                    <div style={{ fontSize: 12, opacity: 0.75 }}>
                      {new Date(entry.createdAt).toLocaleString()}
                    </div>
                    <div style={{ fontWeight: 700 }}>{entry.extractionV2.title}</div>
                    <div style={{ fontSize: 13, opacity: 0.85 }}>{entry.extractionV2.summary}</div>
                    <div style={{ fontSize: 12, marginTop: 4, opacity: 0.8 }}>
                      Prompt: {entry.prompt.slice(0, 120)}
                      {entry.prompt.length > 120 ? '...' : ''}
                    </div>
                  </button>
                  {entry.compareLanes && entry.compareLanes.length > 0 ? (
                    <div style={{ marginTop: 10 }}>
                      <div
                        data-testid={`history-compare-results-${entry.id}`}
                        style={{ display: 'grid', gap: 8 }}
                      >
                        <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>
                          {entry.compareLanes.length}/{compareLaneOrder.length} complete
                        </p>
                        <div
                          data-testid={`history-compare-lanes-${entry.id}`}
                          style={{
                            display: 'grid',
                            width: '100%',
                            gap: 12,
                            alignItems: 'start',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                          }}
                        >
                          {compareLaneOrder.map((laneId) => {
                            const lane = entry.compareLanes?.find((item) => item.laneId === laneId);
                            if (!lane) {
                              return null;
                            }
                            return (
                              <CompareLaneCard
                                key={`${entry.id}-${laneId}`}
                                lane={toLaneUi(lane)}
                                sourceText={entry.sourceText}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {selectedHistory.length > 0 ? (
        <div
          data-testid="history-copy-selected-floating"
          style={{
            position: 'fixed',
            right: 20,
            bottom: 20,
            zIndex: 40,
            display: 'flex',
            gap: 8,
            alignItems: 'center',
            background: '#111827',
            color: '#fff',
            borderRadius: 999,
            padding: '10px 14px',
            boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
          }}
        >
          <button
            type="button"
            data-testid="history-copy-selected-button"
            onClick={() => {
              void copySelectedDebugLogs();
            }}
            style={{
              border: '1px solid #4b5563',
              background: '#1f2937',
              color: '#fff',
              borderRadius: 999,
              padding: '6px 10px',
              cursor: 'pointer',
            }}
          >
            Copy {selectedHistory.length} debug log{selectedHistory.length === 1 ? '' : 's'}
          </button>
          <span data-testid="history-copy-selected-state" style={{ fontSize: 12, opacity: 0.9 }}>
            {copySelectedState === 'copied'
              ? 'Copied'
              : copySelectedState === 'error'
                ? 'Copy failed'
                : ''}
          </span>
        </div>
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
