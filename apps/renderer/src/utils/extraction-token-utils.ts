import type { ExtractionV2 } from '@repo/api';
import type { EnhancedSourceToken, SourceSpan } from '../types/extraction-ui.js';

export const buildEnhancedSourceTokens = (
  sourceText: string,
  entities: ExtractionV2['entities'],
  facts: ExtractionV2['facts'],
  relations: ExtractionV2['relations'],
): EnhancedSourceToken[] => {
  if (sourceText.length === 0) {
    return [];
  }

  const allSpans: SourceSpan[] = [];

  for (const entity of entities) {
    if (entity.nameStart >= 0 && entity.nameEnd > entity.nameStart) {
      const start = Math.max(0, Math.min(sourceText.length, entity.nameStart));
      const end = Math.max(0, Math.min(sourceText.length, entity.nameEnd));
      if (end > start) {
        allSpans.push({
          start,
          end,
          type: 'entity-name',
          id: entity.id,
          priority: 1,
        });
      }
    }
    if (
      entity.evidenceStart !== undefined &&
      entity.evidenceEnd !== undefined &&
      entity.evidenceEnd > entity.evidenceStart
    ) {
      const start = Math.max(0, Math.min(sourceText.length, entity.evidenceStart));
      const end = Math.max(0, Math.min(sourceText.length, entity.evidenceEnd));
      if (end > start) {
        allSpans.push({
          start,
          end,
          type: 'entity-evidence',
          id: entity.id,
          priority: 2,
        });
      }
    }
  }

  for (const fact of facts) {
    if (fact.evidenceEnd > fact.evidenceStart) {
      const start = Math.max(0, Math.min(sourceText.length, fact.evidenceStart));
      const end = Math.max(0, Math.min(sourceText.length, fact.evidenceEnd));
      if (end > start) {
        allSpans.push({
          start,
          end,
          type: 'fact-evidence',
          id: fact.id,
          priority: 3,
        });
      }
    }
  }

  for (const [index, relation] of relations.entries()) {
    if (
      relation.evidenceStart !== undefined &&
      relation.evidenceEnd !== undefined &&
      relation.evidenceEnd > relation.evidenceStart
    ) {
      const start = Math.max(0, Math.min(sourceText.length, relation.evidenceStart));
      const end = Math.max(0, Math.min(sourceText.length, relation.evidenceEnd));
      if (end > start) {
        allSpans.push({
          start,
          end,
          type: 'relation-evidence',
          id: String(index),
          priority: 4,
        });
      }
    }
  }

  const breakpoints = new Set<number>();
  breakpoints.add(0);
  breakpoints.add(sourceText.length);
  for (const span of allSpans) {
    breakpoints.add(span.start);
    breakpoints.add(span.end);
  }

  const sortedBreakpoints = [...breakpoints].sort((a, b) => a - b);

  const tokens: EnhancedSourceToken[] = [];
  for (let i = 0; i < sortedBreakpoints.length - 1; i++) {
    const start = sortedBreakpoints[i];
    const end = sortedBreakpoints[i + 1];
    if (start === undefined || end === undefined) {
      continue;
    }
    if (start >= end) {
      continue;
    }

    const overlapping = allSpans
      .filter((span) => span.start <= start && span.end >= end)
      .sort((a, b) => a.priority - b.priority);

    tokens.push({
      start,
      text: sourceText.slice(start, end),
      spans: overlapping,
    });
  }

  return tokens;
};
