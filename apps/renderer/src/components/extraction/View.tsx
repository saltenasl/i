import type { ExtractionDebug, ExtractionV2 } from '@repo/api';
import { useMemo, useState } from 'react';
import type { ActiveHighlights, HoverTarget } from '../../types/extraction-ui.js';
import { buildEntitySwatchMap } from '../../utils/extraction-color-utils.js';
import { computeActiveHighlights } from '../../utils/extraction-highlight-utils.js';
import { ExtractionDebugActions } from './DebugActions.js';
import { ExtractionEmotions } from './Emotions.js';
import { ExtractionEntities } from './Entities.js';
import { ExtractionFacts } from './Facts.js';
import { ExtractionGroups } from './Groups.js';
import { ExtractionMetadata } from './Metadata.js';
import { ExtractionRelations } from './Relations.js';
import { ExtractionSegments } from './Segments.js';
import { ExtractionSourceText } from './SourceText.js';

export const ExtractionView = ({
  extractionV2,
  sourceText,
  debug,
  showDebugActions = true,
  layoutMode = 'full',
  showSegments = true,
}: {
  extractionV2: ExtractionV2;
  sourceText: string;
  debug: ExtractionDebug;
  showDebugActions?: boolean;
  layoutMode?: 'full' | 'compact';
  showSegments?: boolean;
}) => {
  const [hoverTarget, setHoverTarget] = useState<HoverTarget>(null);
  const compact = layoutMode === 'compact';

  const entityById = useMemo(
    () => new Map(extractionV2.entities.map((entity) => [entity.id, entity])),
    [extractionV2.entities],
  );

  const entitySwatchById = useMemo(
    () => buildEntitySwatchMap(extractionV2.entities),
    [extractionV2.entities],
  );

  const active = useMemo<ActiveHighlights>(
    () => computeActiveHighlights(hoverTarget, extractionV2),
    [hoverTarget, extractionV2],
  );

  const compactGridStyle = compact
    ? ({
        display: 'grid',
        gap: 12,
        gridTemplateColumns: 'repeat(12, minmax(0, 1fr))',
        alignItems: 'start',
      } as const)
    : undefined;

  const widget = (span: number): React.CSSProperties | undefined =>
    compact ? { minWidth: 0, gridColumn: `span ${span}` } : undefined;

  return (
    <section
      data-testid="extraction-v2-result"
      data-layout={compact ? 'compact' : 'full'}
      style={compact ? compactGridStyle : { display: 'grid', gap: 18 }}
    >
      <div style={widget(4)}>
        <ExtractionMetadata extractionV2={extractionV2} compact={compact} />
      </div>

      <div style={widget(4)}>
        <ExtractionEmotions extractionV2={extractionV2} compact={compact} />
      </div>

      {showDebugActions ? (
        <div style={widget(4)}>
          <ExtractionDebugActions sourceText={sourceText} debug={debug} />
        </div>
      ) : null}

      <div style={widget(compact ? 7 : 12)}>
        <ExtractionSourceText
          sourceText={sourceText}
          entities={extractionV2.entities}
          facts={extractionV2.facts}
          relations={extractionV2.relations}
          entitySwatchById={entitySwatchById}
          active={active}
          setHoverTarget={setHoverTarget}
          compact={compact}
        />
      </div>

      <div style={widget(compact ? 5 : 12)}>
        <ExtractionEntities
          entities={extractionV2.entities}
          sourceText={sourceText}
          entitySwatchById={entitySwatchById}
          active={active}
          setHoverTarget={setHoverTarget}
          compact={compact}
        />
      </div>

      <div style={widget(compact ? 8 : 12)}>
        <ExtractionFacts
          facts={extractionV2.facts}
          sourceText={sourceText}
          entityById={entityById}
          entitySwatchById={entitySwatchById}
          active={active}
          setHoverTarget={setHoverTarget}
          compact={compact}
        />
      </div>

      <div style={widget(compact ? 4 : 12)}>
        <ExtractionRelations
          relations={extractionV2.relations}
          entityById={entityById}
          entitySwatchById={entitySwatchById}
          active={active}
          setHoverTarget={setHoverTarget}
          compact={compact}
        />
      </div>

      <div style={widget(compact ? 4 : 12)}>
        <ExtractionGroups
          groups={extractionV2.groups}
          entityById={entityById}
          entitySwatchById={entitySwatchById}
          active={active}
          setHoverTarget={setHoverTarget}
          compact={compact}
        />
      </div>

      {showSegments ? (
        <div style={widget(12)}>
          <ExtractionSegments
            segments={extractionV2.segments}
            sourceTextLength={sourceText.length}
            entityById={entityById}
            entitySwatchById={entitySwatchById}
            active={active}
            setHoverTarget={setHoverTarget}
            compact={compact}
          />
        </div>
      ) : null}
    </section>
  );
};
