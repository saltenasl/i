import type { Migration } from '../../shared/migration-types.js';
import type { Database } from '../generated/db.generated.js';

export const migration0005DropExtractionV1Json: Migration<Database> = {
  name: '0005-drop-extraction-v1-json',
  up: async (db) => {
    await db.schema.alterTable('extraction_history').dropColumn('extraction_json').execute();
  },
};
