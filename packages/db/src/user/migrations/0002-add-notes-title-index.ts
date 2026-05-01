import type { Migration } from '../../shared/migration-types.js';
import type { Database } from '../generated/db.generated.js';

export const migration0002AddNotesTitleIndex: Migration<Database> = {
  name: '0002-add-notes-title-index',
  up: async (db) => {
    await db.schema
      .createIndex('idx_notes_title')
      .ifNotExists()
      .on('notes')
      .column('title')
      .execute();
  },
};
