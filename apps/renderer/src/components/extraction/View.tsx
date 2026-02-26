import type { Extraction, ExtractionDebug } from '@repo/api';
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
import { ExtractionTodos } from './Todos.js';

export const ExtractionView = ({
  extraction,
  sourceText,
  debug,
  showDebugActions = true,
  layoutMode = 'full',
  showSegments = true,
}: {
  extraction: Extraction;
  sourceText: string;
  debug: ExtractionDebug;
  showDebugActions?: boolean;
  layoutMode?: 'full' | 'compact';
  showSegments?: boolean;
}) => {
  const [hoverTarget, setHoverTarget] = useState<HoverTarget>(null);
  const compact = layoutMode === 'compact';

  const entityById = useMemo(
    () => new Map(extraction.entities.map((entity) => [entity.id, entity])),
    [extraction.entities],
  );

  const entitySwatchById = useMemo(
    () => buildEntitySwatchMap(extraction.entities),
    [extraction.entities],
  );

  const active = useMemo<ActiveHighlights>(
    () => computeActiveHighlights(hoverTarget, extraction),
    [hoverTarget, extraction],
  );

  if (compact) {
    return (
      <section
        data-testid="extraction-v2-result"
        data-layout="compact"
        style={{
          display: 'grid',
          gap: 12,
          gridTemplateColumns: 'minmax(0, 1.75fr) minmax(0, 1.25fr)',
          alignItems: 'start',
        }}
      >
        <div style={{ minWidth: 0, display: 'grid', gap: 12, alignContent: 'start' }}>
          <ExtractionSourceText
            sourceText={sourceText}
            entities={extraction.entities}
            facts={extraction.facts}
            relations={extraction.relations}
            todos={extraction.todos}
            entitySwatchById={entitySwatchById}
            active={active}
            setHoverTarget={setHoverTarget}
            compact
          />

          <ExtractionFacts
            facts={extraction.facts}
            sourceText={sourceText}
            entityById={entityById}
            entitySwatchById={entitySwatchById}
            active={active}
            setHoverTarget={setHoverTarget}
            compact
          />

          <ExtractionTodos
            todos={extraction.todos}
            sourceText={sourceText}
            entityById={entityById}
            entitySwatchById={entitySwatchById}
            active={active}
            setHoverTarget={setHoverTarget}
            compact
          />

          {showSegments ? (
            <ExtractionSegments
              segments={extraction.segments}
              sourceTextLength={sourceText.length}
              entityById={entityById}
              entitySwatchById={entitySwatchById}
              active={active}
              setHoverTarget={setHoverTarget}
              compact
            />
          ) : null}
        </div>

        <div style={{ minWidth: 0, display: 'grid', gap: 12, alignContent: 'start' }}>
          <ExtractionMetadata extraction={extraction} compact />
          <ExtractionEmotions extraction={extraction} compact />

          {showDebugActions ? (
            <ExtractionDebugActions sourceText={sourceText} debug={debug} />
          ) : null}

          <ExtractionEntities
            entities={extraction.entities}
            sourceText={sourceText}
            entitySwatchById={entitySwatchById}
            active={active}
            setHoverTarget={setHoverTarget}
            compact
          />

          <ExtractionRelations
            relations={extraction.relations}
            entityById={entityById}
            entitySwatchById={entitySwatchById}
            active={active}
            setHoverTarget={setHoverTarget}
            compact
          />

          <ExtractionGroups
            groups={extraction.groups}
            entityById={entityById}
            entitySwatchById={entitySwatchById}
            active={active}
            setHoverTarget={setHoverTarget}
            compact
          />
        </div>
      </section>
    );
  }

  return (
    <section
      data-testid="extraction-v2-result"
      data-layout="full"
      style={{ display: 'grid', gap: 18 }}
    >
      <ExtractionMetadata extraction={extraction} />
      <ExtractionEmotions extraction={extraction} />

      {showDebugActions ? <ExtractionDebugActions sourceText={sourceText} debug={debug} /> : null}

      <ExtractionSourceText
        sourceText={sourceText}
        entities={extraction.entities}
        facts={extraction.facts}
        relations={extraction.relations}
        todos={extraction.todos}
        entitySwatchById={entitySwatchById}
        active={active}
        setHoverTarget={setHoverTarget}
      />

      <ExtractionEntities
        entities={extraction.entities}
        sourceText={sourceText}
        entitySwatchById={entitySwatchById}
        active={active}
        setHoverTarget={setHoverTarget}
      />

      <ExtractionFacts
        facts={extraction.facts}
        sourceText={sourceText}
        entityById={entityById}
        entitySwatchById={entitySwatchById}
        active={active}
        setHoverTarget={setHoverTarget}
      />

      <ExtractionTodos
        todos={extraction.todos}
        sourceText={sourceText}
        entityById={entityById}
        entitySwatchById={entitySwatchById}
        active={active}
        setHoverTarget={setHoverTarget}
      />

      <ExtractionRelations
        relations={extraction.relations}
        entityById={entityById}
        entitySwatchById={entitySwatchById}
        active={active}
        setHoverTarget={setHoverTarget}
      />

      <ExtractionGroups
        groups={extraction.groups}
        entityById={entityById}
        entitySwatchById={entitySwatchById}
        active={active}
        setHoverTarget={setHoverTarget}
      />

      {showSegments ? (
        <ExtractionSegments
          segments={extraction.segments}
          sourceTextLength={sourceText.length}
          entityById={entityById}
          entitySwatchById={entitySwatchById}
          active={active}
          setHoverTarget={setHoverTarget}
        />
      ) : null}
    </section>
  );
};
