import type { Database, DbClient } from '@repo/db';

type NoteRow = Database['notes'];

const mapNoteRow = (row: NoteRow) => ({
  id: row.id,
  title: row.title,
  body: row.body,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const listNotes = async (db: DbClient) => {
  const rows = await db.selectFrom('notes').selectAll().orderBy('created_at', 'desc').execute();
  return rows.map(mapNoteRow);
};

export interface CreateNoteInput {
  title: string;
  body: string | null;
}

export const createNote = async (db: DbClient, input: CreateNoteInput) => {
  const timestamp = new Date().toISOString();
  const id = crypto.randomUUID();

  await db
    .insertInto('notes')
    .values({
      id,
      title: input.title,
      body: input.body,
      created_at: timestamp,
      updated_at: timestamp,
    })
    .executeTakeFirst();

  const row = await db
    .selectFrom('notes')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirstOrThrow();

  return mapNoteRow(row);
};
