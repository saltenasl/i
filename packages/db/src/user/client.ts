import type { Kysely } from 'kysely';
import type { Database } from './generated/db.generated.js';

export type UserDatabase = Database;
export type UserDbClient = Kysely<UserDatabase>;
