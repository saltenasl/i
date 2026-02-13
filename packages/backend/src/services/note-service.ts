import { type ApiMethodMap, err, ok } from '@repo/api';
import type { DbClient } from '@repo/db';
import { createNote, listNotes } from '../data-access/note-repository.js';

const normalizeBody = (value: string | undefined): string | null => {
  if (value === undefined) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const validateTitle = (title: string) => {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    return err('VALIDATION_ERROR', 'Title is required.');
  }

  if (trimmed.length > 120) {
    return err('VALIDATION_ERROR', 'Title must be at most 120 characters.');
  }

  return ok(trimmed);
};

export const listNotesService = async (
  db: DbClient,
): Promise<ApiMethodMap['notes.list']['output']> => {
  const notes = await listNotes(db);
  return ok({ notes });
};

export const createNoteService = async (
  db: DbClient,
  input: ApiMethodMap['notes.create']['input'],
): Promise<ApiMethodMap['notes.create']['output']> => {
  const titleValidation = validateTitle(input.title);
  if (!titleValidation.ok) {
    return titleValidation;
  }

  const note = await createNote(db, {
    title: titleValidation.data,
    body: normalizeBody(input.body),
  });

  return ok({ note });
};
