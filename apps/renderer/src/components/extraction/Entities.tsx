import type { Extraction } from '@repo/api';
import {
  cardStyle,
  entityTypeBadges,
  itemRow,
  sectionHeader,
} from '../../styles/extraction-theme.js';
import type { ActiveHighlights, EntitySwatch, HoverTarget } from '../../types/extraction-ui.js';
import { getEntitySwatch } from '../../utils/extraction-color-utils.js';
import { formatOptionalSpan, formatSpan, getExcerpt } from '../../utils/extraction-format-utils.js';

const clampLines = (lines: number) => ({
  display: '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical' as const,
  overflow: 'hidden',
});

export const ExtractionEntities = ({
  entities,
  sourceText,
  entitySwatchById,
  active,
  setHoverTarget,
  compact = false,
}: {
  entities: Extraction['entities'];
  sourceText: string;
  entitySwatchById: Map<string, EntitySwatch>;
  active: ActiveHighlights;
  setHoverTarget: (target: HoverTarget) => void;
  compact?: boolean;
}) => {
  return (
    <div style={{ ...cardStyle, padding: compact ? '10px 12px' : '16px 20px' }}>
      <h3 style={sectionHeader}>Entities</h3>
      <ul
        data-testid="extraction-v2-entities"
        style={{
          margin: 0,
          paddingLeft: 0,
          listStyle: 'none',
          display: 'grid',
          gap: compact ? 6 : 8,
        }}
      >
        {entities.map((entity) => {
          const swatch = getEntitySwatch(entity.id, entitySwatchById);
          const isActive = active.entityIds.has(entity.id);
          const showExpanded = !compact || isActive;
          const badge = entityTypeBadges[entity.type];
          return (
            <li
              key={entity.id}
              data-testid={`entity-row-${entity.id}`}
              data-active={isActive ? 'true' : 'false'}
              onMouseEnter={() => setHoverTarget({ kind: 'entity', entityId: entity.id })}
              onMouseLeave={() => setHoverTarget(null)}
              style={{
                ...itemRow,
                padding: compact ? '8px 10px' : itemRow.padding,
                border: isActive ? `2px solid ${swatch.accent}` : '1px solid #d0d7de',
                background: isActive ? '#fffaf0' : '#fff',
                fontSize: compact ? 13 : 14,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: compact ? 6 : 8,
                  flexWrap: 'wrap',
                  lineHeight: compact ? 1.15 : 1.2,
                }}
              >
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
                <strong>{entity.name}</strong>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '0 6px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 600,
                    background: badge.bg,
                    color: badge.text,
                  }}
                >
                  {entity.type}
                </span>
                <span style={{ opacity: 0.8 }}>
                  [{formatSpan(entity.nameStart, entity.nameEnd)}]
                </span>
                <span style={{ opacity: 0.75 }}>conf={entity.confidence.toFixed(2)}</span>
                {showExpanded ? <span style={{ opacity: 0.7 }}>id={entity.id}</span> : null}
                {showExpanded ? (
                  <span style={{ opacity: 0.7 }}>
                    evidence={formatOptionalSpan(entity.evidenceStart, entity.evidenceEnd)}
                  </span>
                ) : null}
              </div>
              <div
                data-testid={`entity-excerpt-${entity.id}`}
                style={{
                  marginTop: compact ? 3 : 4,
                  opacity: 0.9,
                  ...(showExpanded ? {} : clampLines(2)),
                }}
              >
                {getExcerpt(sourceText, entity.nameStart, entity.nameEnd)}
              </div>
              {entity.context ? (
                <div
                  style={{
                    marginTop: 2,
                    opacity: 0.75,
                    ...(showExpanded ? {} : clampLines(1)),
                  }}
                >
                  context: {entity.context}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
