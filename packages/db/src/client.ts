import type { Kysely } from 'kysely';
import type { Database } from './generated/db.generated.ts';

export type DbClient = Kysely<Database>;
