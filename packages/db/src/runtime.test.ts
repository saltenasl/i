import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sql } from 'kysely';
import { afterEach, describe, expect, it } from 'vitest';
import type { UserDatabase } from './index.js';
import { migration0001CreateNotes } from './user/migrations/0001-create-notes.js';
import { migrations as userMigrations } from './user/migrations/index.js';
import { createDb, initializeUserRuntimeDatabase, runMigrations } from './user/runtime.js';

const tempDirs: string[] = [];

const makeTempDbPath = async (): Promise<string> => {
  const dir = await mkdtemp(path.join(tmpdir(), 'repo-db-tests-'));
  tempDirs.push(dir);
  return path.join(dir, 'db.sqlite');
};

afterEach(async () => {
  for (const dir of tempDirs.splice(0, tempDirs.length)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe('runtime migrations (user db)', () => {
  it('creates schema on a fresh DB', async () => {
    const dbPath = await makeTempDbPath();
    const db = await initializeUserRuntimeDatabase({ dbPath, seedProfile: 'fresh' });

    const tableRow = await sql<{ name: string }>`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name = 'notes'
    `.execute(db);

    expect(tableRow.rows[0]?.name).toBe('notes');

    await db.destroy();
  });

  it('applies pending migrations to an older schema', async () => {
    const dbPath = await makeTempDbPath();
    const db = await createDb<UserDatabase>(dbPath);

    await db.schema
      .createTable('_migrations')
      .ifNotExists()
      .addColumn('name', 'text', (column) => column.primaryKey())
      .addColumn('applied_at', 'text', (column) => column.notNull())
      .execute();

    await migration0001CreateNotes.up(db);

    await sql`insert into _migrations (name, applied_at) values (${migration0001CreateNotes.name}, ${new Date().toISOString()})`.execute(
      db,
    );

    const applied = await runMigrations(db, userMigrations);
    expect(applied).toContain('0002-add-notes-title-index');
    expect(applied).toContain('0003-create-extraction-history');
    expect(applied).toContain('0004-add-compare-lanes-to-extraction-history');
    expect(applied).toContain('0005-drop-extraction-v1-json');

    const indexResult = await sql<{ name: string }>`
      PRAGMA index_list('notes')
    `.execute(db);

    const indexNames = indexResult.rows.map((row) => row.name);
    expect(indexNames).toContain('idx_notes_title');

    const extractionTable = await sql<{ name: string }>`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name = 'extraction_history'
    `.execute(db);
    expect(extractionTable.rows[0]?.name).toBe('extraction_history');

    await db.destroy();
  });
});
