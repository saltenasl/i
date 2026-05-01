import { closeDb, createDb, runMigrations } from '../runtime.js';
import type { PrimaryDbClient } from './client.js';
import type { Database } from './generated/db.generated.js';
import { primaryMigrations } from './migrations/index.js';

export interface PrimaryRuntimeDatabaseOptions {
  dbPath: string;
}

export const initializePrimaryRuntimeDatabase = async (
  options: PrimaryRuntimeDatabaseOptions,
): Promise<PrimaryDbClient> => {
  const db = (await createDb<Database>(options.dbPath)) as PrimaryDbClient;
  await runMigrations(db, primaryMigrations);
  return db;
};

export { closeDb, createDb, runMigrations };
