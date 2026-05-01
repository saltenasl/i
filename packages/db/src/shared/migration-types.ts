import type { Kysely, Transaction } from 'kysely';

export type MigrationDatabase<T> = Kysely<T> | Transaction<T>;

export interface Migration<T = unknown> {
  name: string;
  up: (db: MigrationDatabase<T>) => Promise<void>;
}
