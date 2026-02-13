import type { Migration } from './types.ts';

export const migration0001CreateNotes: Migration = {
  name: '0001-create-notes',
  up: async (db) => {
    await db.schema
      .createTable('notes')
      .ifNotExists()
      .addColumn('id', 'text', (column) => column.primaryKey())
      .addColumn('title', 'text', (column) => column.notNull())
      .addColumn('body', 'text')
      .addColumn('created_at', 'text', (column) => column.notNull())
      .addColumn('updated_at', 'text', (column) => column.notNull())
      .execute();
  },
};
