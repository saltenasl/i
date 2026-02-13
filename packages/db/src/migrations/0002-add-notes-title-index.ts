import type { Migration } from './types.ts';

export const migration0002AddNotesTitleIndex: Migration = {
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
