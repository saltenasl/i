import type { ExtractionDebug, ExtractionLaneResult, ExtractionV2 } from '@repo/api';
import { type ApiMethodMap, ok } from '@repo/api';
import type { DbClient } from '@repo/db';
import {
  createExtractionHistoryEntry,
  listExtractionHistory,
} from '../data-access/extraction-history-repository.js';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const normalizeLimit = (value: number | undefined): number => {
  if (value === undefined) {
    return DEFAULT_LIMIT;
  }

  if (!Number.isInteger(value) || value <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(value, MAX_LIMIT);
};

export const listExtractionHistoryService = async (
  db: DbClient,
  input: ApiMethodMap['extract.history.list']['input'],
): Promise<ApiMethodMap['extract.history.list']['output']> => {
  const entries = await listExtractionHistory(db, normalizeLimit(input.limit));
  return ok({ entries });
};

export interface PersistExtractionHistoryInput {
  sourceText: string;
  prompt: string;
  extractionV2: ExtractionV2;
  debug: ExtractionDebug;
  compareLanes?: ExtractionLaneResult[];
}

export const persistExtractionHistoryService = async (
  db: DbClient,
  input: PersistExtractionHistoryInput,
): Promise<void> => {
  await createExtractionHistoryEntry(db, {
    sourceText: input.sourceText,
    prompt: input.prompt,
    extractionV2: input.extractionV2,
    debug: input.debug,
    ...(input.compareLanes ? { compareLanes: input.compareLanes } : {}),
  });
};
