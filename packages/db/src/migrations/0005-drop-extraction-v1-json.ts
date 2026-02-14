import type { Migration } from './types.ts';

export const migration0005DropExtractionV1Json: Migration = {
  name: '0005-drop-extraction-v1-json',
  up: async (db) => {
    await db.schema.alterTable('extraction_history').dropColumn('extraction_json').execute();
  },
};
