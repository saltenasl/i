import { closeDb, createDb, runMigrations } from '../runtime.js';
import type { UserDbClient } from './client.js';
import type { Database } from './generated/db.generated.js';
import { migrations as userMigrations } from './migrations/index.js';
import type { SeedProfile } from './seeds/index.js';
import { runSeedProfile } from './seeds/index.js';

export interface UserRuntimeDatabaseOptions {
  dbPath: string;
  seedProfile?: SeedProfile;
}

export const initializeUserRuntimeDatabase = async (
  options: UserRuntimeDatabaseOptions,
): Promise<UserDbClient> => {
  const db = (await createDb<Database>(options.dbPath)) as UserDbClient;
  await runMigrations(db, userMigrations);

  if (options.seedProfile && options.seedProfile !== 'fresh') {
    await runSeedProfile(db, options.seedProfile);
  }

  return db;
};

export { closeDb, createDb, runMigrations };
