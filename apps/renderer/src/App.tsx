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

const getGlobalColor = (index: number): string => {
  const hue = (index * 137.508) % 360;
  return `hsl(${hue} 75% 85%)`;
};

const getRelationKey = (relation: ExtractionV2['relations'][number], index: number): string => {
  return `${relation.fromEntityId}-${relation.toEntityId}-${relation.type}-${index}`;
};

type SourceEntitySpan = {
  id: string;
  start: number;
  end: number;
};

type SourceOverlaySpan = {
  id: string;
  start: number;
  end: number;
  color: string;
};

type SourceChunk = {
  key: string;
  text: string;
  entityId: string | null;
  entityColor: string | null;
  overlayColor: string | null;
  involved: boolean;
};

const buildSourceChunks = (
  text: string,
  entitySpans: SourceEntitySpan[],
  colorByEntityId: Map<string, string>,
  overlaySpans: SourceOverlaySpan[],
): SourceChunk[] => {
  const boundaries = new Set<number>([0, text.length]);
  for (const span of entitySpans) {
    boundaries.add(span.start);
    boundaries.add(span.end);
  }
  for (const span of overlaySpans) {
    if (span.start >= 0 && span.end > span.start && span.end <= text.length) {
      boundaries.add(span.start);
      boundaries.add(span.end);
    }
  }

  const sorted = Array.from(boundaries).sort((a, b) => a - b);
  const chunks: SourceChunk[] = [];

  for (let index = 0; index < sorted.length - 1; index += 1) {
    const start = sorted[index];
    const end = sorted[index + 1];
    if (start === undefined || end === undefined || end <= start) {
      continue;
    }

    const textChunk = text.slice(start, end);
    if (!textChunk) {
      continue;
    }

    const ownerEntity = entitySpans.find((span) => span.start < end && span.end > start);
    const overlay = overlaySpans.find((span) => span.start < end && span.end > start);

    chunks.push({
      key: `chunk-${start}-${end}-${ownerEntity?.id ?? 'plain'}-${overlay?.id ?? 'idle'}`,
      text: textChunk,
      entityId: ownerEntity?.id ?? null,
      entityColor: ownerEntity ? (colorByEntityId.get(ownerEntity.id) ?? '#fff3bf') : null,
      overlayColor: overlay?.color ?? null,
      involved: overlay !== undefined,
    });
  }

  return chunks;
};

const getExcerpt = (text: string, start: number, end: number): string => {
  const left = Math.max(0, start - 40);
  const right = Math.min(text.length, end + 40);
  return text.slice(left, right).replace(/\s+/g, ' ').trim();
};

const formatPredicate = (value: string): string => {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const getSafeEntityExcerptSpan = (
  entity: ExtractionV2['entities'][number],
): { start: number; end: number } => {
  return { start: entity.nameStart, end: entity.nameEnd };
};

const buildSummaryChunks = (
  summary: string,
  entities: ExtractionV2['entities'],
): Array<{ key: string; text: string; entityId: string | null }> => {
  const matches: Array<{ entityId: string; start: number; end: number }> = [];
  const lowerSummary = summary.toLowerCase();

  for (const entity of entities) {
    const needle = entity.name.trim().toLowerCase();
    if (!needle) {
      continue;
    }

    let from = 0;
    while (from < lowerSummary.length) {
      const at = lowerSummary.indexOf(needle, from);
      if (at < 0) {
        break;
      }
      matches.push({ entityId: entity.id, start: at, end: at + needle.length });
      from = at + needle.length;
    }
  }

  matches.sort((a, b) => a.start - b.start);

  const chunks: Array<{ key: string; text: string; entityId: string | null }> = [];
  let cursor = 0;
  let plainIndex = 0;
  for (const match of matches) {
    if (match.start < cursor) {
      continue;
    }
    if (match.start > cursor) {
      chunks.push({
        key: `summary-plain-${plainIndex}-${cursor}-${match.start}`,
        text: summary.slice(cursor, match.start),
        entityId: null,
      });
      plainIndex += 1;
    }
    chunks.push({
      key: `summary-entity-${match.entityId}-${match.start}-${match.end}`,
      text: summary.slice(match.start, match.end),
      entityId: match.entityId,
    });
    cursor = match.end;
  }

  if (cursor < summary.length) {
    chunks.push({
      key: `summary-plain-${plainIndex}-${cursor}-${summary.length}`,
      text: summary.slice(cursor),
      entityId: null,
    });
  }

  return chunks;
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
  const [activeEntityId, setActiveEntityId] = useState<string | null>(null);
  const [activeFactId, setActiveFactId] = useState<string | null>(null);
  const [activeRelationKey, setActiveRelationKey] = useState<string | null>(null);

  const entityOrder = useMemo(() => {
    return extractionV2.entities.map((entity, index) => ({
      id: entity.id,
      color: getGlobalColor(index),
    }));
  }, [extractionV2.entities]);

  const colorByEntityId = useMemo(() => {
    return new Map(entityOrder.map((entry) => [entry.id, entry.color]));
  }, [entityOrder]);

  const factOrder = useMemo(() => {
    return extractionV2.facts.map((fact, index) => ({
      id: fact.id,
      color: getGlobalColor(extractionV2.entities.length + index),
    }));
  }, [extractionV2.entities.length, extractionV2.facts]);

  const colorByFactId = useMemo(() => {
    return new Map(factOrder.map((entry) => [entry.id, entry.color]));
  }, [factOrder]);

  const relationOrder = useMemo(() => {
    return extractionV2.relations.map((relation, index) => ({
      key: getRelationKey(relation, index),
      color: getGlobalColor(extractionV2.entities.length + extractionV2.facts.length + index),
    }));
  }, [extractionV2.entities.length, extractionV2.facts.length, extractionV2.relations]);

  const colorByRelationKey = useMemo(() => {
    return new Map(relationOrder.map((entry) => [entry.key, entry.color]));
  }, [relationOrder]);

  const entityById = useMemo(() => {
    return new Map(extractionV2.entities.map((entity) => [entity.id, entity]));
  }, [extractionV2.entities]);

  const entitySpans = useMemo(() => {
    return extractionV2.entities
      .map((entity) => ({ id: entity.id, start: entity.nameStart, end: entity.nameEnd }))
      .filter((span) => span.start >= 0 && span.end > span.start && span.end <= sourceText.length);
  }, [extractionV2.entities, sourceText.length]);

  const activeOverlaySpans = useMemo(() => {
    const spans: SourceOverlaySpan[] = [];

    if (activeEntityId !== null) {
      const entity = extractionV2.entities.find((item) => item.id === activeEntityId);
      if (entity) {
        spans.push({
          id: `entity-${entity.id}`,
          start: entity.nameStart,
          end: entity.nameEnd,
          color: colorByEntityId.get(entity.id) ?? '#fff3bf',
        });
      }

      for (const fact of extractionV2.facts) {
        const isRelated =
          fact.ownerEntityId === activeEntityId ||
          fact.subjectEntityId === activeEntityId ||
          fact.objectEntityId === activeEntityId;
        if (!isRelated) {
          continue;
        }
        spans.push({
          id: `fact-${fact.id}`,
          start: fact.evidenceStart,
          end: fact.evidenceEnd,
          color: colorByFactId.get(fact.id) ?? '#ffe8cc',
        });
      }

      extractionV2.relations.forEach((relation, relationIndex) => {
        const isRelated =
          relation.fromEntityId === activeEntityId || relation.toEntityId === activeEntityId;
        if (!isRelated) {
          return;
        }
        if (relation.evidenceStart === undefined || relation.evidenceEnd === undefined) {
          return;
        }
        const key = getRelationKey(relation, relationIndex);
        spans.push({
          id: `relation-${key}`,
          start: relation.evidenceStart,
          end: relation.evidenceEnd,
          color: colorByRelationKey.get(key) ?? '#ffe8cc',
        });
      });
    }

    if (activeFactId !== null) {
      const fact = extractionV2.facts.find((item) => item.id === activeFactId);
      if (fact) {
        spans.push({
          id: `fact-${fact.id}`,
          start: fact.evidenceStart,
          end: fact.evidenceEnd,
          color: colorByFactId.get(fact.id) ?? '#ffe8cc',
        });
      }
    }

    if (activeRelationKey !== null) {
      const relationIndex = relationOrder.findIndex(
        (relation) => relation.key === activeRelationKey,
      );
      if (relationIndex >= 0) {
        const relation = extractionV2.relations[relationIndex];
        if (
          relation &&
          relation.evidenceStart !== undefined &&
          relation.evidenceEnd !== undefined
        ) {
          spans.push({
            id: `relation-${activeRelationKey}`,
            start: relation.evidenceStart,
            end: relation.evidenceEnd,
            color: colorByRelationKey.get(activeRelationKey) ?? '#ffe8cc',
          });
        }
      }
    }

    return spans.filter(
      (span) =>
        span.start >= 0 && span.end > span.start && span.end <= sourceText.length && span.color,
    );
  }, [
    activeEntityId,
    activeFactId,
    activeRelationKey,
    extractionV2.entities,
    extractionV2.facts,
    extractionV2.relations,
    relationOrder,
    colorByEntityId,
    colorByFactId,
    colorByRelationKey,
    sourceText.length,
  ]);

  const highlightedChunks = useMemo(() => {
    return buildSourceChunks(sourceText, entitySpans, colorByEntityId, activeOverlaySpans);
  }, [sourceText, entitySpans, colorByEntityId, activeOverlaySpans]);
  const summaryChunks = useMemo(
    () => buildSummaryChunks(extractionV2.summary, extractionV2.entities),
    [extractionV2.summary, extractionV2.entities],
  );

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
        <p style={{ margin: 0 }}>
          {summaryChunks.map((chunk) => {
            if (!chunk.entityId) {
              return <span key={chunk.key}>{chunk.text}</span>;
            }

            const color = colorByEntityId.get(chunk.entityId) ?? '#fff3bf';
            return (
              <span
                key={chunk.key}
                data-testid={`summary-entity-${chunk.entityId}`}
                onMouseEnter={() => {
                  setActiveEntityId(chunk.entityId);
                  setActiveFactId(null);
                  setActiveRelationKey(null);
                }}
                onMouseLeave={() => {
                  setActiveEntityId(null);
                  setActiveFactId(null);
                  setActiveRelationKey(null);
                }}
                style={{
                  background: color,
                  borderRadius: 4,
                  padding: '1px 2px',
                  cursor: 'pointer',
                }}
              >
                {chunk.text}
              </span>
            );
          })}
        </p>
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
              return (
                <span
                  key={chunk.key}
                  data-involved={chunk.involved ? 'true' : 'false'}
                  style={{
                    background: chunk.overlayColor ?? undefined,
                    borderRadius: chunk.overlayColor ? 4 : undefined,
                    padding: chunk.overlayColor ? '1px 1px' : undefined,
                    boxShadow: chunk.overlayColor ? 'inset 0 -2px 0 rgba(0,0,0,0.08)' : undefined,
                  }}
                >
                  {chunk.text}
                </span>
              );
            }

            const entity = entityById.get(chunk.entityId);
            const baseColor = colorByEntityId.get(chunk.entityId) ?? '#fff3bf';
            return (
              <span
                key={chunk.key}
                data-involved={chunk.involved ? 'true' : 'false'}
                data-testid={`source-entity-${chunk.entityId}`}
                onMouseEnter={() => {
                  setActiveEntityId(chunk.entityId);
                  setActiveFactId(null);
                  setActiveRelationKey(null);
                }}
                onMouseLeave={() => {
                  setActiveEntityId(null);
                  setActiveFactId(null);
                  setActiveRelationKey(null);
                }}
                style={{
                  background: chunk.overlayColor ?? chunk.entityColor ?? baseColor,
                  borderRadius: 4,
                  padding: '1px 2px',
                  boxShadow: chunk.involved ? 'inset 0 -2px 0 rgba(0,0,0,0.18)' : undefined,
                  opacity:
                    activeEntityId && chunk.entityId !== activeEntityId && !chunk.involved
                      ? 0.65
                      : 1,
                  cursor: 'pointer',
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
            const excerptSpan = getSafeEntityExcerptSpan(entity);
            const isActive = activeEntityId === entity.id;
            return (
              <li
                key={entity.id}
                data-testid={`entity-row-${entity.id}`}
                onMouseEnter={() => {
                  setActiveEntityId(entity.id);
                  setActiveFactId(null);
                  setActiveRelationKey(null);
                }}
                onMouseLeave={() => {
                  setActiveEntityId(null);
                  setActiveFactId(null);
                  setActiveRelationKey(null);
                }}
                style={{
                  outline: isActive ? '2px solid #f08c00' : 'none',
                  borderRadius: 6,
                  padding: '2px 4px',
                  cursor: 'pointer',
                }}
              >
                <span
                  data-testid={`entity-color-${entity.id}`}
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    marginRight: 6,
                    background: colorByEntityId.get(entity.id) ?? getGlobalColor(index),
                  }}
                />
                <strong>{entity.name}</strong> ({entity.type}) [{entity.nameStart}-{entity.nameEnd}]
                -{' '}
                <span data-testid={`entity-excerpt-${entity.id}`}>
                  {getExcerpt(sourceText, excerptSpan.start, excerptSpan.end)}
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
            const factColor = colorByFactId.get(fact.id) ?? '#ffe8cc';
            const involved =
              (activeEntityId !== null &&
                (fact.ownerEntityId === activeEntityId ||
                  fact.subjectEntityId === activeEntityId ||
                  fact.objectEntityId === activeEntityId)) ||
              activeFactId === fact.id;

            return (
              <li
                key={fact.id}
                data-testid={`fact-row-${fact.id}`}
                data-involved={involved ? 'true' : 'false'}
                onMouseEnter={() => {
                  setActiveEntityId(fact.subjectEntityId ?? fact.ownerEntityId ?? null);
                  setActiveFactId(fact.id);
                  setActiveRelationKey(null);
                }}
                onMouseLeave={() => {
                  setActiveEntityId(null);
                  setActiveFactId(null);
                  setActiveRelationKey(null);
                }}
                style={{
                  background: involved ? `${factColor}66` : undefined,
                  borderLeft: involved ? `3px solid ${factColor}` : undefined,
                  paddingLeft: involved ? 6 : undefined,
                  cursor: 'pointer',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    marginRight: 6,
                    background: factColor,
                  }}
                />
                owner=<strong>{owner}</strong> perspective=<strong>{fact.perspective}</strong> |{' '}
                {subject} → <strong>{formatPredicate(fact.predicate)}</strong> → {object} [
                {fact.evidenceStart}-{fact.evidenceEnd}]
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h3 style={{ marginBottom: 6 }}>Relations</h3>
        <ul data-testid="extraction-v2-relations" style={{ margin: 0, paddingLeft: 18 }}>
          {extractionV2.relations.map((relation, index) => {
            const key = getRelationKey(relation, index);
            const relationColor = colorByRelationKey.get(key) ?? '#ffe8cc';
            const isActive = activeRelationKey === key;
            return (
              <li
                key={key}
                onMouseEnter={() => {
                  setActiveEntityId(relation.fromEntityId);
                  setActiveFactId(null);
                  setActiveRelationKey(key);
                }}
                onMouseLeave={() => {
                  setActiveEntityId(null);
                  setActiveFactId(null);
                  setActiveRelationKey(null);
                }}
                style={{
                  cursor: 'pointer',
                  background: isActive ? `${relationColor}66` : undefined,
                  borderLeft: isActive ? `3px solid ${relationColor}` : undefined,
                  paddingLeft: isActive ? 6 : undefined,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    marginRight: 6,
                    background: relationColor,
                  }}
                />
                {relation.fromEntityId} → {relation.toEntityId} ({relation.type})
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h3 style={{ marginBottom: 6 }}>Groups</h3>
        <ul data-testid="extraction-v2-groups" style={{ margin: 0, paddingLeft: 18 }}>
          {extractionV2.groups.map((group) => (
            <li
              key={group.name}
              onMouseEnter={() => setActiveEntityId(group.entityIds[0] ?? null)}
              onMouseLeave={() => setActiveEntityId(null)}
              style={{ cursor: group.entityIds.length > 0 ? 'pointer' : 'default' }}
            >
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
  const [viewMode, setViewMode] = useState<'knowledge' | 'simple'>('knowledge');

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
    setViewMode('knowledge');
    setError(null);
    setCompareLanes([]);
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
