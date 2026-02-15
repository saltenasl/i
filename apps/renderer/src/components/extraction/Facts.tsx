import type { ExtractionV2 } from '@repo/api';
import { cardStyle, itemRow, sectionHeader } from '../../styles/extraction-theme.js';
import type { ActiveHighlights, EntitySwatch, HoverTarget } from '../../types/extraction-ui.js';
import { getEntitySwatch } from '../../utils/extraction-color-utils.js';
import { formatSpan, getExcerpt } from '../../utils/extraction-format-utils.js';

export const ExtractionFacts = ({
  facts,
  sourceText,
  entityById,
  entitySwatchById,
  active,
  setHoverTarget,
}: {
  facts: ExtractionV2['facts'];
  sourceText: string;
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
      <h3 style={sectionHeader}>Facts</h3>
      <ul
        data-testid="extraction-v2-facts"
        style={{ margin: 0, paddingLeft: 0, listStyle: 'none', display: 'grid', gap: 8 }}
      >
        {facts.map((fact) => {
          const ownerSwatch = getEntitySwatch(fact.ownerEntityId, entitySwatchById);
          const isActive = active.factIds.has(fact.id);
          return (
            <li
              key={fact.id}
              data-testid={`fact-row-${fact.id}`}
              data-active={isActive ? 'true' : 'false'}
              onMouseEnter={() => setHoverTarget({ kind: 'fact', factId: fact.id })}
              onMouseLeave={() => setHoverTarget(null)}
              style={{
                ...itemRow,
                borderLeft: `5px solid ${ownerSwatch.accent}`,
                background: isActive ? '#f8f2e7' : '#f7f7f8',
                outline: isActive ? `2px solid ${ownerSwatch.accent}` : 'none',
              }}
            >
              <div>
                owner=<strong>{getEntityLabel(fact.ownerEntityId)}</strong> perspective=
                <strong>{fact.perspective}</strong> | {getEntityLabel(fact.subjectEntityId)} {'->'}{' '}
                <strong>{fact.predicate}</strong> {'->'}{' '}
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
  );
};
