import type { ExtractionV2 } from '@repo/api';
import { cardStyle, itemRow, sectionHeader } from '../../styles/extraction-theme.js';
import type { ActiveHighlights, EntitySwatch, HoverTarget } from '../../types/extraction-ui.js';
import { getEntitySwatch } from '../../utils/extraction-color-utils.js';
import { formatOptionalSpan } from '../../utils/extraction-format-utils.js';

export const ExtractionRelations = ({
  relations,
  entityById,
  entitySwatchById,
  active,
  setHoverTarget,
}: {
  relations: ExtractionV2['relations'];
  entityById: Map<string, ExtractionV2['entities'][number]>;
  entitySwatchById: Map<string, EntitySwatch>;
  active: ActiveHighlights;
  setHoverTarget: (target: HoverTarget) => void;
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
    <div style={{ ...cardStyle, padding: '16px 20px' }}>
      <h3 style={sectionHeader}>Relations</h3>
      <ul
        data-testid="extraction-v2-relations"
        style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 8 }}
      >
        {relations.length === 0 ? (
          <li style={{ opacity: 0.7 }}>-</li>
        ) : (
          relations.map((relation, index) => {
            const relationSwatch = getEntitySwatch(relation.fromEntityId, entitySwatchById);
            const isActive = active.relationIndexes.has(index);
            return (
              <li
                key={`${relation.fromEntityId}-${relation.toEntityId}-${relation.type}-${index}`}
                data-testid={`relation-row-${index}`}
                data-active={isActive ? 'true' : 'false'}
                onMouseEnter={() => setHoverTarget({ kind: 'relation', relationIndex: index })}
                onMouseLeave={() => setHoverTarget(null)}
                style={{
                  ...itemRow,
                  border: isActive ? `2px solid ${relationSwatch.accent}` : '1px solid #d0d7de',
                  background: isActive ? '#f3f8ff' : '#fff',
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
  );
};
