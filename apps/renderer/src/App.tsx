import type {
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

type EntitySwatch = {
  fill: string;
  accent: string;
};

type SourceToken = {
  start: number;
  text: string;
  entityId?: string;
};

type HoverTarget =
  | { kind: 'entity'; entityId: string }
  | { kind: 'fact'; factId: string }
  | { kind: 'relation'; relationIndex: number }
  | { kind: 'group'; groupName: string }
  | null;

type ActiveHighlights = {
  entityIds: Set<string>;
  factIds: Set<string>;
  relationIndexes: Set<number>;
  groupNames: Set<string>;
};

const ENTITY_SWATCHES: EntitySwatch[] = [
  { fill: '#f8e7ba', accent: '#d97706' },
  { fill: '#d9efdd', accent: '#2f9e44' },
  { fill: '#dceaf8', accent: '#1971c2' },
  { fill: '#f8dcc7', accent: '#c2410c' },
  { fill: '#f0ddf8', accent: '#7c3aed' },
  { fill: '#f7d8e7', accent: '#c2255c' },
  { fill: '#d9f2ef', accent: '#0f766e' },
  { fill: '#f9e2cf', accent: '#b45309' },
];

const DEFAULT_SWATCH: EntitySwatch = {
  fill: '#e9ecef',
  accent: '#6c757d',
};

const buildSourceTokens = (
  sourceText: string,
  entities: ExtractionV2['entities'],
): SourceToken[] => {
  const validEntities = entities
    .filter((entity) => entity.nameStart >= 0 && entity.nameEnd > entity.nameStart)
    .map((entity) => ({
      entityId: entity.id,
      start: Math.max(0, Math.min(sourceText.length, entity.nameStart)),
      end: Math.max(0, Math.min(sourceText.length, entity.nameEnd)),
    }))
    .filter((entity) => entity.end > entity.start)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const tokens: SourceToken[] = [];
  let cursor = 0;

  for (const entity of validEntities) {
    if (entity.start < cursor) {
      continue;
    }
    if (cursor < entity.start) {
      tokens.push({ start: cursor, text: sourceText.slice(cursor, entity.start) });
    }
    tokens.push({
      start: entity.start,
      text: sourceText.slice(entity.start, entity.end),
      entityId: entity.entityId,
    });
    cursor = entity.end;
  }

  if (cursor < sourceText.length) {
    tokens.push({ start: cursor, text: sourceText.slice(cursor) });
  }

  if (tokens.length === 0) {
    return [{ start: 0, text: sourceText }];
  }

  return tokens;
};

const factTouchesEntity = (fact: ExtractionV2['facts'][number], entityId: string): boolean => {
  return (
    fact.ownerEntityId === entityId ||
    fact.subjectEntityId === entityId ||
    fact.objectEntityId === entityId
  );
};

const ExtractionContractView = ({
  extractionV2,
  sourceText,
  debug,
}: {
  extractionV2: ExtractionV2;
  sourceText: string;
  debug: ExtractionDebug;
}) => {
  const entityById = useMemo(() => {
    return new Map(extractionV2.entities.map((entity) => [entity.id, entity]));
  }, [extractionV2.entities]);
  const factById = useMemo(() => {
    return new Map(extractionV2.facts.map((fact) => [fact.id, fact]));
  }, [extractionV2.facts]);
  const groupByName = useMemo(() => {
    return new Map(extractionV2.groups.map((group) => [group.name, group]));
  }, [extractionV2.groups]);
  const entitySwatchById = useMemo(() => {
    const swatchMap = new Map<string, EntitySwatch>();
    for (const [index, entity] of extractionV2.entities.entries()) {
      swatchMap.set(entity.id, ENTITY_SWATCHES[index % ENTITY_SWATCHES.length] ?? DEFAULT_SWATCH);
    }
    return swatchMap;
  }, [extractionV2.entities]);
  const sourceTokens = useMemo(() => {
    return buildSourceTokens(sourceText, extractionV2.entities);
  }, [sourceText, extractionV2.entities]);

  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [hoverTarget, setHoverTarget] = useState<HoverTarget>(null);

  const getEntitySwatch = (entityId: string | undefined): EntitySwatch => {
    if (!entityId) {
      return DEFAULT_SWATCH;
    }
    return entitySwatchById.get(entityId) ?? DEFAULT_SWATCH;
  };

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

  const active = useMemo<ActiveHighlights>(() => {
    const entityIds = new Set<string>();
    const factIds = new Set<string>();
    const relationIndexes = new Set<number>();
    const groupNames = new Set<string>();

    const addEntity = (entityId: string | undefined) => {
      if (!entityId) {
        return;
      }
      entityIds.add(entityId);
    };

    const addFact = (fact: ExtractionV2['facts'][number] | undefined) => {
      if (!fact) {
        return;
      }
      factIds.add(fact.id);
      addEntity(fact.ownerEntityId);
      addEntity(fact.subjectEntityId);
      addEntity(fact.objectEntityId);
    };

    const includeGroupsForCurrentSelection = () => {
      for (const group of extractionV2.groups) {
        const touchesEntity = group.entityIds.some((entityId) => entityIds.has(entityId));
        const touchesFact = group.factIds.some((factId) => factIds.has(factId));
        if (!touchesEntity && !touchesFact) {
          continue;
        }
        groupNames.add(group.name);
      }
    };

    switch (hoverTarget?.kind) {
      case 'entity': {
        addEntity(hoverTarget.entityId);
        for (const fact of extractionV2.facts) {
          if (factTouchesEntity(fact, hoverTarget.entityId)) {
            addFact(fact);
          }
        }
        for (const [relationIndex, relation] of extractionV2.relations.entries()) {
          if (
            relation.fromEntityId === hoverTarget.entityId ||
            relation.toEntityId === hoverTarget.entityId
          ) {
            relationIndexes.add(relationIndex);
            addEntity(relation.fromEntityId);
            addEntity(relation.toEntityId);
          }
        }
        includeGroupsForCurrentSelection();
        break;
      }
      case 'fact': {
        addFact(factById.get(hoverTarget.factId));
        for (const [relationIndex, relation] of extractionV2.relations.entries()) {
          if (entityIds.has(relation.fromEntityId) || entityIds.has(relation.toEntityId)) {
            relationIndexes.add(relationIndex);
            addEntity(relation.fromEntityId);
            addEntity(relation.toEntityId);
          }
        }
        includeGroupsForCurrentSelection();
        break;
      }
      case 'relation': {
        const relation = extractionV2.relations[hoverTarget.relationIndex];
        if (relation) {
          relationIndexes.add(hoverTarget.relationIndex);
          addEntity(relation.fromEntityId);
          addEntity(relation.toEntityId);
          for (const fact of extractionV2.facts) {
            if (
              factTouchesEntity(fact, relation.fromEntityId) ||
              factTouchesEntity(fact, relation.toEntityId)
            ) {
              addFact(fact);
            }
          }
          includeGroupsForCurrentSelection();
        }
        break;
      }
      case 'group': {
        const group = groupByName.get(hoverTarget.groupName);
        if (group) {
          groupNames.add(group.name);
          for (const entityId of group.entityIds) {
            addEntity(entityId);
          }
          for (const factId of group.factIds) {
            addFact(factById.get(factId));
          }
          for (const [relationIndex, relation] of extractionV2.relations.entries()) {
            if (entityIds.has(relation.fromEntityId) || entityIds.has(relation.toEntityId)) {
              relationIndexes.add(relationIndex);
            }
          }
        }
        break;
      }
      default:
        break;
    }

    return { entityIds, factIds, relationIndexes, groupNames };
  }, [
    hoverTarget,
    extractionV2.facts,
    extractionV2.relations,
    extractionV2.groups,
    factById,
    groupByName,
  ]);

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
    <section data-testid="extraction-v2-result" style={{ display: 'grid', gap: 18 }}>
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
            border: '1px solid #c3ccd5',
            borderRadius: 14,
            background: '#f6f7f9',
            padding: 16,
            whiteSpace: 'pre-wrap',
            lineHeight: 1.45,
            fontSize: 19,
            margin: 0,
          }}
        >
          {sourceTokens.map((token) => {
            if (!token.entityId) {
              return <span key={`plain-${token.start}`}>{token.text}</span>;
            }
            const entityId = token.entityId;
            const entity = entityById.get(entityId);
            const swatch = getEntitySwatch(entityId);
            const activeEntity = active.entityIds.has(entityId);
            return (
              <span
                key={`entity-${entityId}-${token.start}`}
                data-testid={`source-entity-${entityId}`}
                data-active={activeEntity ? 'true' : 'false'}
                onMouseEnter={() => setHoverTarget({ kind: 'entity', entityId })}
                onMouseLeave={() => setHoverTarget(null)}
                style={{
                  background: swatch.fill,
                  borderRadius: 7,
                  padding: '0 3px',
                  boxShadow: activeEntity ? `0 0 0 2px ${swatch.accent} inset` : 'none',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.08s ease',
                }}
                title={entity ? `${entity.name} (${entity.type})` : entityId}
              >
                {token.text}
              </span>
            );
          })}
        </pre>
      </div>

      <div>
        <h3 style={{ marginBottom: 6 }}>Entities</h3>
        <ul
          data-testid="extraction-v2-entities"
          style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 8 }}
        >
          {extractionV2.entities.map((entity) => {
            const swatch = getEntitySwatch(entity.id);
            const isActive = active.entityIds.has(entity.id);
            return (
              <li
                key={entity.id}
                data-testid={`entity-row-${entity.id}`}
                data-active={isActive ? 'true' : 'false'}
                onMouseEnter={() => setHoverTarget({ kind: 'entity', entityId: entity.id })}
                onMouseLeave={() => setHoverTarget(null)}
                style={{
                  border: isActive ? `2px solid ${swatch.accent}` : '1px solid #d0d7de',
                  borderRadius: 12,
                  padding: '8px 10px',
                  background: isActive ? '#fffaf0' : '#fff',
                  transition: 'border-color 0.08s ease',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span
                    aria-hidden
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: swatch.fill,
                      border: `1px solid ${swatch.accent}`,
                    }}
                  />
                  <strong>{entity.name}</strong> ({entity.type}) [
                  {formatSpan(entity.nameStart, entity.nameEnd)}]
                  <span style={{ opacity: 0.7 }}>id={entity.id}</span>
                  <span style={{ opacity: 0.7 }}>
                    evidence={formatOptionalSpan(entity.evidenceStart, entity.evidenceEnd)}
                  </span>
                  <span style={{ opacity: 0.7 }}>confidence={entity.confidence.toFixed(2)}</span>
                </div>
                <div
                  data-testid={`entity-excerpt-${entity.id}`}
                  style={{ marginTop: 4, opacity: 0.9 }}
                >
                  {getExcerpt(sourceText, entity.nameStart, entity.nameEnd)}
                </div>
                {entity.context ? (
                  <div style={{ marginTop: 2, opacity: 0.75 }}>context: {entity.context}</div>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h3 style={{ marginBottom: 6 }}>Facts</h3>
        <ul
          data-testid="extraction-v2-facts"
          style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 8 }}
        >
          {extractionV2.facts.map((fact) => {
            const ownerSwatch = getEntitySwatch(fact.ownerEntityId);
            const isActive = active.factIds.has(fact.id);
            return (
              <li
                key={fact.id}
                data-testid={`fact-row-${fact.id}`}
                data-active={isActive ? 'true' : 'false'}
                onMouseEnter={() => setHoverTarget({ kind: 'fact', factId: fact.id })}
                onMouseLeave={() => setHoverTarget(null)}
                style={{
                  borderLeft: `5px solid ${ownerSwatch.accent}`,
                  borderRadius: 10,
                  padding: '8px 10px',
                  background: isActive ? '#f8f2e7' : '#f7f7f8',
                  outline: isActive ? `2px solid ${ownerSwatch.accent}` : 'none',
                  cursor: 'pointer',
                }}
              >
                <div>
                  owner=<strong>{getEntityLabel(fact.ownerEntityId)}</strong> perspective=
                  <strong>{fact.perspective}</strong> | {getEntityLabel(fact.subjectEntityId)}{' '}
                  {'->'} <strong>{fact.predicate}</strong> {'->'}{' '}
                  {fact.objectEntityId
                    ? getEntityLabel(fact.objectEntityId)
                    : (fact.objectText ?? '-')}{' '}
                  | [{formatSpan(fact.evidenceStart, fact.evidenceEnd)}]
                </div>
                <div style={{ marginTop: 3, opacity: 0.78 }}>
                  id={fact.id} segment={fact.segmentId ?? '-'} confidence=
                  {fact.confidence.toFixed(2)}
                </div>
                <div style={{ marginTop: 2, opacity: 0.85 }}>
                  {getExcerpt(sourceText, fact.evidenceStart, fact.evidenceEnd)}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h3 style={{ marginBottom: 6 }}>Relations</h3>
        <ul
          data-testid="extraction-v2-relations"
          style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 8 }}
        >
          {extractionV2.relations.length === 0 ? (
            <li style={{ opacity: 0.7 }}>-</li>
          ) : (
            extractionV2.relations.map((relation, index) => {
              const relationSwatch = getEntitySwatch(relation.fromEntityId);
              const isActive = active.relationIndexes.has(index);
              return (
                <li
                  key={`${relation.fromEntityId}-${relation.toEntityId}-${relation.type}-${index}`}
                  data-testid={`relation-row-${index}`}
                  data-active={isActive ? 'true' : 'false'}
                  onMouseEnter={() => setHoverTarget({ kind: 'relation', relationIndex: index })}
                  onMouseLeave={() => setHoverTarget(null)}
                  style={{
                    border: isActive ? `2px solid ${relationSwatch.accent}` : '1px solid #d0d7de',
                    borderRadius: 10,
                    padding: '8px 10px',
                    background: isActive ? '#f3f8ff' : '#fff',
                    cursor: 'pointer',
                  }}
                >
                  #{index} {getEntityLabel(relation.fromEntityId)} {'->'}{' '}
                  <strong>{relation.type}</strong> {'->'} {getEntityLabel(relation.toEntityId)} |
                  evidence=
                  {formatOptionalSpan(relation.evidenceStart, relation.evidenceEnd)} | confidence=
                  {relation.confidence.toFixed(2)}
                </li>
              );
            })
          )}
        </ul>
      </div>

      <div>
        <h3 style={{ marginBottom: 6 }}>Groups</h3>
        <ul
          data-testid="extraction-v2-groups"
          style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 8 }}
        >
          {extractionV2.groups.length === 0 ? (
            <li style={{ opacity: 0.7 }}>-</li>
          ) : (
            extractionV2.groups.map((group) => {
              const isActive = active.groupNames.has(group.name);
              return (
                <li
                  key={group.name}
                  data-testid={`group-row-${group.name.replace(/\s+/g, '-')}`}
                  data-active={isActive ? 'true' : 'false'}
                  onMouseEnter={() => setHoverTarget({ kind: 'group', groupName: group.name })}
                  onMouseLeave={() => setHoverTarget(null)}
                  style={{
                    border: isActive ? '2px solid #4c6ef5' : '1px solid #d0d7de',
                    borderRadius: 10,
                    padding: '8px 10px',
                    background: isActive ? '#edf2ff' : '#fff',
                    cursor: 'pointer',
                  }}
                >
                  <strong>{group.name}</strong> | entities=
                  {group.entityIds.length === 0
                    ? '-'
                    : group.entityIds.map((entityId) => getEntityLabel(entityId)).join(', ')}{' '}
                  | facts={group.factIds.length === 0 ? '-' : group.factIds.join(', ')}
                </li>
              );
            })
          )}
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

      {lane.status === 'ok' && lane.extractionV2 && lane.debug ? (
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
