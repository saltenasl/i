import type { Migration } from '../../shared/migration-types.js';
import type { Database } from '../generated/db.generated.js';

export const migration0001CreateUsers: Migration<Database> = {
  name: '0001-create-users',
  up: async (db) => {
    await db.schema
      .createTable('users')
      .ifNotExists()
      .addColumn('id', 'text', (column) => column.primaryKey())
      .addColumn('google_id', 'text', (column) => column.notNull().unique())
      .addColumn('email', 'text', (column) => column.notNull().unique())
      .addColumn('created_at', 'text', (column) => column.notNull())
      .execute();

    await db.schema
      .createTable('sessions')
      .ifNotExists()
      .addColumn('id', 'text', (column) => column.primaryKey())
      .addColumn('user_id', 'text', (column) => column.notNull())
      .addColumn('expires_at', 'text', (column) => column.notNull())
      .execute();
  },
};
