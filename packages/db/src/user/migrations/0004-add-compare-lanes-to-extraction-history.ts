import type { Migration } from '../../shared/migration-types.js';
import type { Database } from '../generated/db.generated.js';

export const migration0004AddCompareLanesToExtractionHistory: Migration<Database> = {
  name: '0004-add-compare-lanes-to-extraction-history',
  up: async (db) => {
    await db.schema
      .alterTable('extraction_history')
      .addColumn('compare_lanes_json', 'text')
      .execute();
  },
};
