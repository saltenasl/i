import type { Migration } from '../../shared/migration-types.js';
import type { Database } from '../generated/db.generated.js';
import { migration0001CreateNotes } from './0001-create-notes.js';
import { migration0002AddNotesTitleIndex } from './0002-add-notes-title-index.js';
import { migration0003CreateExtractionHistory } from './0003-create-extraction-history.js';
import { migration0004AddCompareLanesToExtractionHistory } from './0004-add-compare-lanes-to-extraction-history.js';
import { migration0005DropExtractionV1Json } from './0005-drop-extraction-v1-json.js';

export const migrations: Migration<Database>[] = [
  migration0001CreateNotes,
  migration0002AddNotesTitleIndex,
  migration0003CreateExtractionHistory,
  migration0004AddCompareLanesToExtractionHistory,
  migration0005DropExtractionV1Json,
];
