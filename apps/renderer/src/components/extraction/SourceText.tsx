import type { ExtractionV2 } from '@repo/api';
import { useMemo } from 'react';
import { cardStyle, sectionHeader, sourceTextContainer } from '../../styles/extraction-theme.js';
import type { ActiveHighlights, EntitySwatch, HoverTarget } from '../../types/extraction-ui.js';
import { DEFAULT_SWATCH, getEntitySwatch } from '../../utils/extraction-color-utils.js';
import { buildEnhancedSourceTokens } from '../../utils/extraction-token-utils.js';

export const ExtractionSourceText = ({
  sourceText,
  entities,
  facts,
  relations,
  entitySwatchById,
  active,
  setHoverTarget,
}: {
  sourceText: string;
  entities: ExtractionV2['entities'];
  facts: ExtractionV2['facts'];
  relations: ExtractionV2['relations'];
  entitySwatchById: Map<string, EntitySwatch>;
  active: ActiveHighlights;
  setHoverTarget: (target: HoverTarget) => void;
}) => {
  const tokens = useMemo(
    () => buildEnhancedSourceTokens(sourceText, entities, facts, relations),
    [sourceText, entities, facts, relations],
  );

  const factById = useMemo(() => new Map(facts.map((f) => [f.id, f])), [facts]);

  return (
    <div style={{ ...cardStyle, padding: '16px 20px' }}>
      <h3 style={sectionHeader}>Source Text</h3>
      <pre
        data-testid="extraction-v2-source"
        style={{ ...sourceTextContainer, border: '1px solid #c3ccd5' }}
      >
        {tokens.map((token) => {
          const entityNameSpan = token.spans.find((s) => s.type === 'entity-name');
          const evidenceSpans = token.spans.filter((s) => s.type !== 'entity-name');

          if (entityNameSpan) {
            const entityId = entityNameSpan.id;
            const swatch = getEntitySwatch(entityId, entitySwatchById);
            const isActive = active.entityIds.has(entityId);
            return (
              <span
                key={`entity-${entityId}-${token.start}`}
                data-testid={`source-entity-${entityId}`}
                data-active={isActive ? 'true' : 'false'}
                onMouseEnter={() => setHoverTarget({ kind: 'entity', entityId })}
                onMouseLeave={() => setHoverTarget(null)}
                style={{
                  background: swatch.fill,
                  borderRadius: 7,
                  padding: '0 3px',
                  boxShadow: isActive ? `0 0 0 2px ${swatch.accent} inset` : 'none',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.08s ease',
                  borderBottom: getEvidenceUnderline(
                    evidenceSpans,
                    entitySwatchById,
                    factById,
                    relations,
                    active,
                  ),
                }}
                title={entityId}
              >
                {token.text}
              </span>
            );
          }

          if (evidenceSpans.length > 0) {
            const topSpan = evidenceSpans[0];
            if (!topSpan) {
              return <span key={`plain-${token.start}`}>{token.text}</span>;
            }
            const isActive = isEvidenceSpanActive(topSpan, active);
            const swatch = getEvidenceSpanSwatch(topSpan, entitySwatchById, factById, relations);
            return (
              <span
                key={`evidence-${topSpan.type}-${topSpan.id}-${token.start}`}
                data-testid={`source-evidence-${topSpan.type}-${topSpan.id}`}
                data-active={isActive ? 'true' : 'false'}
                onMouseEnter={() => setHoverTargetForEvidence(topSpan, setHoverTarget)}
                onMouseLeave={() => setHoverTarget(null)}
                style={{
                  borderBottom: `2px ${getEvidenceLineStyle(topSpan.type)} ${isActive ? swatch.accent : 'rgba(0,0,0,0.15)'}`,
                  cursor: 'pointer',
                  transition: 'border-color 0.08s ease',
                }}
              >
                {token.text}
              </span>
            );
          }

          return <span key={`plain-${token.start}`}>{token.text}</span>;
        })}
      </pre>
    </div>
  );
};

const getEvidenceLineStyle = (type: string): string => {
  switch (type) {
    case 'entity-evidence':
      return 'dashed';
    case 'fact-evidence':
      return 'solid';
    case 'relation-evidence':
      return 'dotted';
    default:
      return 'solid';
  }
};

const getEvidenceUnderline = (
  evidenceSpans: Array<{ type: string; id: string }>,
  entitySwatchById: Map<string, EntitySwatch>,
  factById: Map<string, ExtractionV2['facts'][number]>,
  relations: ExtractionV2['relations'],
  active: ActiveHighlights,
): string | undefined => {
  if (evidenceSpans.length === 0) {
    return undefined;
  }
  const topSpan = evidenceSpans[0];
  if (!topSpan) {
    return undefined;
  }
  const isActive = isEvidenceSpanActive(topSpan, active);
  const swatch = getEvidenceSpanSwatch(topSpan, entitySwatchById, factById, relations);
  return `2px ${getEvidenceLineStyle(topSpan.type)} ${isActive ? swatch.accent : 'transparent'}`;
};

const isEvidenceSpanActive = (
  span: { type: string; id: string },
  active: ActiveHighlights,
): boolean => {
  switch (span.type) {
    case 'entity-evidence':
      return active.entityIds.has(span.id);
    case 'fact-evidence':
      return active.factIds.has(span.id);
    case 'relation-evidence':
      return active.relationIndexes.has(Number(span.id));
    default:
      return false;
  }
};

const getEvidenceSpanSwatch = (
  span: { type: string; id: string },
  entitySwatchById: Map<string, EntitySwatch>,
  factById: Map<string, ExtractionV2['facts'][number]>,
  relations: ExtractionV2['relations'],
): EntitySwatch => {
  if (span.type === 'entity-evidence') {
    return getEntitySwatch(span.id, entitySwatchById);
  }
  if (span.type === 'fact-evidence') {
    const fact = factById.get(span.id);
    if (fact) {
      return getEntitySwatch(fact.ownerEntityId, entitySwatchById);
    }
  }
  if (span.type === 'relation-evidence') {
    const relation = relations[Number(span.id)];
    if (relation) {
      return getEntitySwatch(relation.fromEntityId, entitySwatchById);
    }
  }
  return DEFAULT_SWATCH;
};

const setHoverTargetForEvidence = (
  span: { type: string; id: string },
  setHoverTarget: (target: HoverTarget) => void,
) => {
  switch (span.type) {
    case 'entity-evidence':
      setHoverTarget({ kind: 'entity', entityId: span.id });
      break;
    case 'fact-evidence':
      setHoverTarget({ kind: 'fact', factId: span.id });
      break;
    case 'relation-evidence':
      setHoverTarget({ kind: 'relation', relationIndex: Number(span.id) });
      break;
  }
};
