import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue, type StatementSync } from 'node:sqlite';
import { Kysely, SqliteDialect } from 'kysely';
import type { Database } from './generated/db.generated.ts';
import { migrations } from './migrations/index.ts';
import type { SeedProfile } from './seeds/index.ts';
import { runSeedProfile } from './seeds/index.ts';

const readerStatementPattern = /^\s*(select|with|pragma|explain)\b/i;

class SqliteStatementAdapter {
  private readonly statement: StatementSync;
  readonly reader: boolean;

  constructor(statement: StatementSync, sql: string) {
    this.statement = statement;
    this.reader = readerStatementPattern.test(sql);
  }

  all(parameters: ReadonlyArray<unknown> = []): unknown[] {
    const values = parameters as ReadonlyArray<SQLInputValue>;
    return this.statement.all(...values) as unknown[];
  }

  run(parameters: ReadonlyArray<unknown> = []): {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  } {
    const values = parameters as ReadonlyArray<SQLInputValue>;
    const result = this.statement.run(...values) as {
      changes: number | bigint;
      lastInsertRowid: number | bigint;
    };

    return {
      changes: result.changes,
      lastInsertRowid: result.lastInsertRowid,
    };
  }

  iterate(parameters: ReadonlyArray<unknown> = []): IterableIterator<unknown> {
    const values = parameters as ReadonlyArray<SQLInputValue>;
    return this.statement.iterate(...values) as IterableIterator<unknown>;
  }
}

class SqliteDatabaseAdapter {
  private readonly sqlite: DatabaseSync;

  constructor(sqlite: DatabaseSync) {
    this.sqlite = sqlite;
  }

  close(): void {
    this.sqlite.close();
  }

  prepare(sql: string): SqliteStatementAdapter {
    return new SqliteStatementAdapter(this.sqlite.prepare(sql), sql);
  }
}

export interface RuntimeDatabaseOptions {
  dbPath: string;
  seedProfile?: SeedProfile;
}

export const createDb = async (dbPath: string): Promise<Kysely<Database>> => {
  await mkdir(path.dirname(dbPath), { recursive: true });
  const sqlite = new DatabaseSync(dbPath);

  return new Kysely<Database>({
    dialect: new SqliteDialect({
      database: new SqliteDatabaseAdapter(sqlite),
    }),
  });
};

const ensureMigrationTable = async (db: Kysely<Database>): Promise<void> => {
  await db.schema
    .createTable('_migrations')
    .ifNotExists()
    .addColumn('name', 'text', (column) => column.primaryKey())
    .addColumn('applied_at', 'text', (column) => column.notNull())
    .execute();
};

export const runMigrations = async (db: Kysely<Database>): Promise<string[]> => {
  await ensureMigrationTable(db);

  const appliedRows = await db.selectFrom('_migrations').select('name').execute();
  const applied = new Set(appliedRows.map((row) => row.name));
  const newlyApplied: string[] = [];

  for (const migration of migrations) {
    if (applied.has(migration.name)) {
      continue;
    }

    await db.transaction().execute(async (trx) => {
      await migration.up(trx);
      await trx
        .insertInto('_migrations')
        .values({
          name: migration.name,
          applied_at: new Date().toISOString(),
        })
        .executeTakeFirst();
    });

    newlyApplied.push(migration.name);
  }

  return newlyApplied;
};

export const initializeRuntimeDatabase = async (
  options: RuntimeDatabaseOptions,
): Promise<Kysely<Database>> => {
  const db = await createDb(options.dbPath);
  await runMigrations(db);

  if (options.seedProfile && options.seedProfile !== 'fresh') {
    await runSeedProfile(db, options.seedProfile);
  }

  return db;
};

export const closeDb = async (db: Kysely<Database>): Promise<void> => {
  await db.destroy();
};
