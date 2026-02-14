import type {
  ExtractionDebug,
  ExtractionHistoryEntryDto,
  ExtractionLaneResult,
  ExtractionV2,
} from '@repo/api';
import type { Database, DbClient } from '@repo/db';

type ExtractionHistoryRow = Database['extraction_history'];

const parseJson = <T>(value: string, label: string): T => {
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    throw new Error(
      `Failed to parse ${label} from extraction history: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

const mapExtractionHistoryRow = (row: ExtractionHistoryRow): ExtractionHistoryEntryDto => ({
  id: row.id,
  sourceText: row.source_text,
  prompt: row.prompt,
  extractionV2: parseJson<ExtractionV2>(row.extraction_v2_json, 'extraction_v2_json'),
  debug: parseJson<ExtractionDebug>(row.debug_json, 'debug_json'),
  ...(row.compare_lanes_json
    ? {
        compareLanes: parseJson<ExtractionLaneResult[]>(
          row.compare_lanes_json,
          'compare_lanes_json',
        ),
      }
    : {}),
  createdAt: row.created_at,
});

export interface CreateExtractionHistoryInput {
  sourceText: string;
  prompt: string;
  extractionV2: ExtractionV2;
  debug: ExtractionDebug;
  compareLanes?: ExtractionLaneResult[];
}

export const createExtractionHistoryEntry = async (
  db: DbClient,
  input: CreateExtractionHistoryInput,
): Promise<ExtractionHistoryEntryDto> => {
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();

  await db
    .insertInto('extraction_history')
    .values({
      id,
      source_text: input.sourceText,
      prompt: input.prompt,
      extraction_v2_json: JSON.stringify(input.extractionV2),
      debug_json: JSON.stringify(input.debug),
      compare_lanes_json: input.compareLanes ? JSON.stringify(input.compareLanes) : null,
      created_at: createdAt,
    })
    .executeTakeFirst();

  const row = await db
    .selectFrom('extraction_history')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirstOrThrow();

  return mapExtractionHistoryRow(row);
};

export const listExtractionHistory = async (
  db: DbClient,
  limit: number,
): Promise<ExtractionHistoryEntryDto[]> => {
  const rows = await db
    .selectFrom('extraction_history')
    .selectAll()
    .orderBy('created_at', 'desc')
    .limit(limit)
    .execute();

  return rows.map(mapExtractionHistoryRow);
};
