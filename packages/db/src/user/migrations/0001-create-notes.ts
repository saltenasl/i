import type { Migration } from '../../shared/migration-types.js';
import type { Database } from '../generated/db.generated.js';

export const migration0001CreateNotes: Migration<Database> = {
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
