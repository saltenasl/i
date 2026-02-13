import { migration0001CreateNotes } from './0001-create-notes.ts';
import { migration0002AddNotesTitleIndex } from './0002-add-notes-title-index.ts';
import type { Migration } from './types.ts';

export const migrations: Migration[] = [migration0001CreateNotes, migration0002AddNotesTitleIndex];
