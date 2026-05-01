import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue, type StatementSync } from 'node:sqlite';
import { Kysely, SqliteDialect, sql } from 'kysely';
import type { Migration } from './shared/migration-types.js';

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

export const createDb = async <T>(dbPath: string): Promise<Kysely<T>> => {
  await mkdir(path.dirname(dbPath), { recursive: true });
  const sqlite = new DatabaseSync(dbPath);

  return new Kysely<T>({
    dialect: new SqliteDialect({
      database: new SqliteDatabaseAdapter(sqlite),
    }),
  });
};

const ensureMigrationTable = async <T>(db: Kysely<T>): Promise<void> => {
  await db.schema
    .createTable('_migrations')
    .ifNotExists()
    .addColumn('name', 'text', (column) => column.primaryKey())
    .addColumn('applied_at', 'text', (column) => column.notNull())
    .execute();
};

export const runMigrations = async <T>(
  db: Kysely<T>,
  migrations: Migration<T>[],
): Promise<string[]> => {
  await ensureMigrationTable(db);

  const appliedRows = await sql<{ name: string }>`select name from _migrations`.execute(db);
  const applied = new Set(appliedRows.rows.map((row) => row.name));
  const newlyApplied: string[] = [];

  for (const migration of migrations) {
    if (applied.has(migration.name)) {
      continue;
    }

    await db.transaction().execute(async (trx) => {
      await migration.up(trx);

      await sql`insert into _migrations (name, applied_at) values (${migration.name}, ${new Date().toISOString()})`.execute(
        trx,
      );
    });

    newlyApplied.push(migration.name);
  }

  return newlyApplied;
};

export const closeDb = async <T>(db: Kysely<T>): Promise<void> => {
  await db.destroy();
};
