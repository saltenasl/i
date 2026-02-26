import type { Extraction } from '@repo/api';
import { cardStyle, itemRow, sectionHeader } from '../../styles/extraction-theme.js';
import type { ActiveHighlights, EntitySwatch, HoverTarget } from '../../types/extraction-ui.js';
import { getEntitySwatch } from '../../utils/extraction-color-utils.js';
import { formatSpan, getExcerpt } from '../../utils/extraction-format-utils.js';

const clampLines = (lines: number) => ({
  display: '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical' as const,
  overflow: 'hidden',
});

export const ExtractionFacts = ({
  facts,
  sourceText,
  entityById,
  entitySwatchById,
  active,
  setHoverTarget,
  compact = false,
}: {
  facts: Extraction['facts'];
  sourceText: string;
  entityById: Map<string, Extraction['entities'][number]>;
  entitySwatchById: Map<string, EntitySwatch>;
  active: ActiveHighlights;
  setHoverTarget: (target: HoverTarget) => void;
  compact?: boolean;
}) => {
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

  return (
    <div style={{ ...cardStyle, padding: compact ? '10px 12px' : '16px 20px' }}>
      <h3 style={sectionHeader}>Facts</h3>
      <ul
        data-testid="extraction-v2-facts"
        style={{
          margin: 0,
          paddingLeft: 0,
          listStyle: 'none',
          display: 'grid',
          gap: compact ? 6 : 8,
        }}
      >
        {facts.map((fact) => {
          const ownerSwatch = getEntitySwatch(fact.ownerEntityId, entitySwatchById);
          const isActive = active.factIds.has(fact.id);
          const showExpanded = !compact || isActive;
          return (
            <li
              key={fact.id}
              data-testid={`fact-row-${fact.id}`}
              data-active={isActive ? 'true' : 'false'}
              onMouseEnter={() => setHoverTarget({ kind: 'fact', factId: fact.id })}
              onMouseLeave={() => setHoverTarget(null)}
              style={{
                ...itemRow,
                padding: compact ? '8px 10px' : itemRow.padding,
                borderLeft: `5px solid ${ownerSwatch.accent}`,
                background: isActive ? '#f8f2e7' : '#f7f7f8',
                outline: isActive ? `2px solid ${ownerSwatch.accent}` : 'none',
                fontSize: compact ? 13 : 14,
              }}
            >
              <div style={showExpanded ? undefined : clampLines(2)}>
                owner=<strong>{getEntityLabel(fact.ownerEntityId)}</strong> perspective=
                <strong>{fact.perspective}</strong> | {getEntityLabel(fact.subjectEntityId)} {'->'}{' '}
                <strong>{fact.predicate}</strong> {'->'}{' '}
                {fact.objectEntityId
                  ? getEntityLabel(fact.objectEntityId)
                  : (fact.objectText ?? '-')}{' '}
                | [{formatSpan(fact.evidenceStart, fact.evidenceEnd)}]
              </div>
              <div
                style={{
                  marginTop: 3,
                  opacity: 0.78,
                  ...(showExpanded ? {} : clampLines(1)),
                }}
              >
                {showExpanded ? (
                  <>
                    id={fact.id} segment={fact.segmentId ?? '-'} confidence=
                    {fact.confidence.toFixed(2)}
                  </>
                ) : (
                  <>confidence={fact.confidence.toFixed(2)}</>
                )}
              </div>
              <div
                style={{
                  marginTop: 2,
                  opacity: 0.85,
                  ...(showExpanded ? {} : clampLines(1)),
                }}
              >
                {getExcerpt(sourceText, fact.evidenceStart, fact.evidenceEnd)}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
