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
}: {
  extractionV2: ExtractionV2;
  sourceText: string;
  debug: ExtractionDebug;
  showDebugActions?: boolean;
}) => {
  const [hoverTarget, setHoverTarget] = useState<HoverTarget>(null);

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

  return (
    <section data-testid="extraction-v2-result" style={{ display: 'grid', gap: 18 }}>
      <ExtractionMetadata extractionV2={extractionV2} />
      <ExtractionEmotions extractionV2={extractionV2} />

      {showDebugActions ? <ExtractionDebugActions sourceText={sourceText} debug={debug} /> : null}

      <ExtractionSourceText
        sourceText={sourceText}
        entities={extractionV2.entities}
        facts={extractionV2.facts}
        relations={extractionV2.relations}
        entitySwatchById={entitySwatchById}
        active={active}
        setHoverTarget={setHoverTarget}
      />

      <ExtractionEntities
        entities={extractionV2.entities}
        sourceText={sourceText}
        entitySwatchById={entitySwatchById}
        active={active}
        setHoverTarget={setHoverTarget}
      />

      <ExtractionFacts
        facts={extractionV2.facts}
        sourceText={sourceText}
        entityById={entityById}
        entitySwatchById={entitySwatchById}
        active={active}
        setHoverTarget={setHoverTarget}
      />

      <ExtractionRelations
        relations={extractionV2.relations}
        entityById={entityById}
        entitySwatchById={entitySwatchById}
        active={active}
        setHoverTarget={setHoverTarget}
      />

      <ExtractionGroups
        groups={extractionV2.groups}
        entityById={entityById}
        entitySwatchById={entitySwatchById}
        active={active}
        setHoverTarget={setHoverTarget}
      />

      <ExtractionSegments
        segments={extractionV2.segments}
        sourceTextLength={sourceText.length}
        entityById={entityById}
        entitySwatchById={entitySwatchById}
        active={active}
        setHoverTarget={setHoverTarget}
      />
    </section>
  );
};
