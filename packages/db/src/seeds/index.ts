import type { Kysely } from 'kysely';
import type { Database } from '../generated/db.generated.ts';

export type SeedProfile = 'fresh' | 'baseline';

const nowIso = () => new Date().toISOString();

export const runSeedProfile = async (db: Kysely<Database>, profile: SeedProfile): Promise<void> => {
  if (profile === 'fresh') {
    return;
  }

  const countRow = await db
    .selectFrom('notes')
    .select((expressionBuilder) => expressionBuilder.fn.count<number>('id').as('count'))
    .executeTakeFirstOrThrow();

  if (Number(countRow.count) > 0) {
    return;
  }

  const timestamp = nowIso();
  const noteInsert = await db
    .insertInto('notes')
    .values({
      id: crypto.randomUUID(),
      title: 'Seeded note',
      body: 'This note comes from the baseline seed profile.',
      created_at: timestamp,
      updated_at: timestamp,
    })
    .executeTakeFirst();

  await db
    .insertInto('extraction_history')
    .values({
      id: crypto.randomUUID(),
      source_text: 'This is the baseline source text that was extracted.',
      prompt: 'System prompt...',
      extraction_v2_json: JSON.stringify({
        title: 'Baseline Extraction',
        noteType: 'personal',
        summary: 'A seeded historical extraction.',
        language: 'en',
        date: null,
        sentiment: 'neutral',
        emotions: [{ emotion: 'joy', intensity: 3 }],
        entities: [],
        facts: [],
        relations: [],
        todos: [],
        groups: [],
        segments: [],
      }),
      debug_json: JSON.stringify({ rawText: 'mock' }),
      created_at: timestamp,
      compare_lanes_json: null,
    })
    .executeTakeFirst();
};
