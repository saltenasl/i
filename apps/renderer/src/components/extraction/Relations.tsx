import type { Extraction } from '@repo/api';
import { cardStyle, itemRow, sectionHeader } from '../../styles/extraction-theme.js';
import type { ActiveHighlights, EntitySwatch, HoverTarget } from '../../types/extraction-ui.js';
import { getEntitySwatch } from '../../utils/extraction-color-utils.js';
import { formatOptionalSpan } from '../../utils/extraction-format-utils.js';

const clampLines = (lines: number) => ({
  display: '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical' as const,
  overflow: 'hidden',
});

export const ExtractionRelations = ({
  relations,
  entityById,
  entitySwatchById,
  active,
  setHoverTarget,
  compact = false,
}: {
  relations: Extraction['relations'];
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
      <h3 style={sectionHeader}>Relations</h3>
      <ul
        data-testid="extraction-v2-relations"
        style={{
          margin: 0,
          paddingLeft: 0,
          listStyle: 'none',
          display: 'grid',
          gap: compact ? 6 : 8,
        }}
      >
        {!relations || relations.length === 0 ? (
          <li style={{ opacity: 0.7 }}>-</li>
        ) : (
          relations.map((relation, index) => {
            const relationSwatch = getEntitySwatch(relation.fromEntityId, entitySwatchById);
            const isActive = active.relationIndexes.has(index);
            const showExpanded = !compact || isActive;
            return (
              <li
                key={`${relation.fromEntityId}-${relation.toEntityId}-${relation.type}-${index}`}
                data-testid={`relation-row-${index}`}
                data-active={isActive ? 'true' : 'false'}
                onMouseEnter={() => setHoverTarget({ kind: 'relation', relationIndex: index })}
                onMouseLeave={() => setHoverTarget(null)}
                style={{
                  ...itemRow,
                  padding: compact ? '8px 10px' : itemRow.padding,
                  border: isActive ? `2px solid ${relationSwatch.accent}` : '1px solid #d0d7de',
                  background: isActive ? '#f3f8ff' : '#fff',
                  fontSize: compact ? 13 : 14,
                }}
              >
                <div style={showExpanded ? undefined : clampLines(2)}>
                  #{index} {getEntityLabel(relation.fromEntityId)} {'->'}{' '}
                  <strong>{relation.type}</strong> {'->'} {getEntityLabel(relation.toEntityId)}
                  {showExpanded ? (
                    <>
                      {' '}
                      | evidence=
                      {formatOptionalSpan(relation.evidenceStart, relation.evidenceEnd)} |
                      confidence=
                      {relation.confidence.toFixed(2)}
                    </>
                  ) : (
                    <> | conf={relation.confidence.toFixed(2)}</>
                  )}
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
};
