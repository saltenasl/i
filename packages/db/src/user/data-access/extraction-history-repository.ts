import type { Extraction, ExtractionDebug, ExtractionLaneResult } from '@repo/auto-extract';
import type { Selectable } from 'kysely';
import type { UserDatabase, UserDbClient } from '../client.js';

export interface ExtractionHistoryEntry {
  id: string;
  sourceText: string;
  prompt: string;
  extraction: Extraction;
  debug: ExtractionDebug;
  compareLanes?: ExtractionLaneResult[] | undefined;
  createdAt: string;
}

export interface CreateExtractionHistoryInput {
  sourceText: string;
  prompt: string;
  extraction: Extraction;
  debug: ExtractionDebug;
  compareLanes?: ExtractionLaneResult[] | undefined;
}

export interface ExtractionHistoryRepository {
  list(limit: number): Promise<ExtractionHistoryEntry[]>;
  getById(id: string): Promise<ExtractionHistoryEntry | null>;
  create(input: CreateExtractionHistoryInput): Promise<ExtractionHistoryEntry>;
}

type ExtractionHistoryRow = Selectable<UserDatabase['extraction_history']>;

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

const mapExtractionHistoryRow = (row: ExtractionHistoryRow): ExtractionHistoryEntry => ({
  id: row.id,
  sourceText: row.source_text,
  prompt: row.prompt,
  extraction: parseJson<Extraction>(row.extraction_v2_json, 'extraction_v2_json'),
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

export const createExtractionHistoryRepository = (
  db: UserDbClient,
): ExtractionHistoryRepository => ({
  async list(limit) {
    const rows = await db
      .selectFrom('extraction_history')
      .selectAll()
      .orderBy('created_at', 'desc')
      .limit(limit)
      .execute();

    return rows.map(mapExtractionHistoryRow);
  },

  async getById(id) {
    const row = await db
      .selectFrom('extraction_history')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!row) {
      return null;
    }

    return mapExtractionHistoryRow(row);
  },

  async create(input) {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    await db
      .insertInto('extraction_history')
      .values({
        id,
        source_text: input.sourceText,
        prompt: input.prompt,
        extraction_v2_json: JSON.stringify(input.extraction),
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
  },
});
