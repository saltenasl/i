import type { Migration } from './types.ts';

export const migration0003CreateExtractionHistory: Migration = {
  name: '0003-create-extraction-history',
  up: async (db) => {
    await db.schema
      .createTable('extraction_history')
      .ifNotExists()
      .addColumn('id', 'text', (column) => column.primaryKey())
      .addColumn('source_text', 'text', (column) => column.notNull())
      .addColumn('prompt', 'text', (column) => column.notNull())
      .addColumn('extraction_json', 'text', (column) => column.notNull())
      .addColumn('extraction_v2_json', 'text', (column) => column.notNull())
      .addColumn('debug_json', 'text', (column) => column.notNull())
      .addColumn('created_at', 'text', (column) => column.notNull())
      .execute();

    await db.schema
      .createIndex('idx_extraction_history_created_at')
      .ifNotExists()
      .on('extraction_history')
      .column('created_at')
      .execute();
  },
};
