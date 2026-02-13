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
  await db
    .insertInto('notes')
    .values({
      id: crypto.randomUUID(),
      title: 'Seeded note',
      body: 'This note comes from the baseline seed profile.',
      created_at: timestamp,
      updated_at: timestamp,
    })
    .executeTakeFirst();
};
