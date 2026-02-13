import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  type Database,
  type SeedProfile,
  closeDb,
  createDb,
  initializeRuntimeDatabase,
} from '@repo/db';
import { type Kysely, sql } from 'kysely';

export interface DbHarness {
  db: Kysely<Database>;
  dbPath: string;
  beginTestCase: () => Promise<void>;
  rollbackTestCase: () => Promise<void>;
  close: () => Promise<void>;
}

const TEST_SAVEPOINT = 'vitest_case';

export const createDbHarness = async (seedProfile: SeedProfile = 'fresh'): Promise<DbHarness> => {
  const rootDir = await mkdtemp(join(tmpdir(), 'repo-db-harness-'));
  const templatePath = join(rootDir, 'template.sqlite');
  const runtimePath = join(rootDir, 'runtime.sqlite');

  const templateDb = await initializeRuntimeDatabase({
    dbPath: templatePath,
    seedProfile,
  });
  await closeDb(templateDb);
  await copyFile(templatePath, runtimePath);

  const db = await createDb(runtimePath);

  return {
    db,
    dbPath: runtimePath,
    beginTestCase: async () => {
      await sql.raw(`SAVEPOINT ${TEST_SAVEPOINT}`).execute(db);
    },
    rollbackTestCase: async () => {
      await sql.raw(`ROLLBACK TO SAVEPOINT ${TEST_SAVEPOINT}`).execute(db);
      await sql.raw(`RELEASE SAVEPOINT ${TEST_SAVEPOINT}`).execute(db);
    },
    close: async () => {
      await closeDb(db);
      await rm(rootDir, { recursive: true, force: true });
    },
  };
};
