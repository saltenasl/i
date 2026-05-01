import type { Selectable } from 'kysely';
import type { UserDatabase, UserDbClient } from '../client.js';

export interface Note {
  id: string;
  title: string;
  body: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteInput {
  title: string;
  body: string | null;
}

export interface NoteRepository {
  list(): Promise<Note[]>;
  create(input: CreateNoteInput): Promise<Note>;
}

type NoteRow = Selectable<UserDatabase['notes']>;

const mapNoteRow = (row: NoteRow): Note => ({
  id: row.id,
  title: row.title,
  body: row.body,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const createNoteRepository = (db: UserDbClient): NoteRepository => ({
  async list() {
    const rows = await db.selectFrom('notes').selectAll().orderBy('created_at', 'desc').execute();
    return rows.map(mapNoteRow);
  },

  async create(input) {
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
  },
});
