import { migration0001CreateNotes } from './0001-create-notes.ts';
import { migration0002AddNotesTitleIndex } from './0002-add-notes-title-index.ts';
import { migration0003CreateExtractionHistory } from './0003-create-extraction-history.ts';
import { migration0004AddCompareLanesToExtractionHistory } from './0004-add-compare-lanes-to-extraction-history.ts';
import { migration0005DropExtractionV1Json } from './0005-drop-extraction-v1-json.ts';
import type { Migration } from './types.ts';

export const migrations: Migration[] = [
  migration0001CreateNotes,
  migration0002AddNotesTitleIndex,
  migration0003CreateExtractionHistory,
  migration0004AddCompareLanesToExtractionHistory,
  migration0005DropExtractionV1Json,
];
