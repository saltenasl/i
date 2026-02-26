import type { Extraction } from '@repo/api';
import type { EntitySwatch } from '../types/extraction-ui.js';

export const ENTITY_SWATCHES: EntitySwatch[] = [
  { fill: '#f8e7ba', accent: '#d97706' },
  { fill: '#d9efdd', accent: '#2f9e44' },
  { fill: '#dceaf8', accent: '#1971c2' },
  { fill: '#f8dcc7', accent: '#c2410c' },
  { fill: '#f0ddf8', accent: '#7c3aed' },
  { fill: '#f7d8e7', accent: '#c2255c' },
  { fill: '#d9f2ef', accent: '#0f766e' },
  { fill: '#f9e2cf', accent: '#b45309' },
];

export const DEFAULT_SWATCH: EntitySwatch = {
  fill: '#e9ecef',
  accent: '#6c757d',
};

export const buildEntitySwatchMap = (
  entities: Extraction['entities'],
): Map<string, EntitySwatch> => {
  const swatchMap = new Map<string, EntitySwatch>();
  for (const [index, entity] of entities.entries()) {
    swatchMap.set(entity.id, ENTITY_SWATCHES[index % ENTITY_SWATCHES.length] ?? DEFAULT_SWATCH);
  }
  return swatchMap;
};

export const getEntitySwatch = (
  entityId: string | undefined,
  swatchMap: Map<string, EntitySwatch>,
): EntitySwatch => {
  if (!entityId) {
    return DEFAULT_SWATCH;
  }
  return swatchMap.get(entityId) ?? DEFAULT_SWATCH;
};
