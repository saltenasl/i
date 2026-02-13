import type { Kysely, Transaction } from 'kysely';
import type { Database } from '../generated/db.generated.ts';

export type MigrationDatabase = Kysely<Database> | Transaction<Database>;

export interface Migration {
  name: string;
  up: (db: MigrationDatabase) => Promise<void>;
}
