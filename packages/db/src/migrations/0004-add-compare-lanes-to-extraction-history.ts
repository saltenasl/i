import type { Migration } from './types.ts';

export const migration0004AddCompareLanesToExtractionHistory: Migration = {
  name: '0004-add-compare-lanes-to-extraction-history',
  up: async (db) => {
    await db.schema
      .alterTable('extraction_history')
      .addColumn('compare_lanes_json', 'text')
      .execute();
  },
};
