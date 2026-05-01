import type { Kysely } from 'kysely';
import type { Database } from './generated/db.generated.js';

export type PrimaryDatabase = Database;
export type PrimaryDbClient = Kysely<PrimaryDatabase>;
