import {
  type ApiHandlers,
  type ApiInput,
  type Extraction,
  type ExtractionDebug,
  type ExtractionV2,
  err,
  ok,
} from '@repo/api';
import { extractWithDebug } from '@repo/auto-extract';
import type { DbClient } from '@repo/db';
import { createNoteService, listNotesService } from './services/note-service.js';

export interface BackendDependencies {
  db: DbClient;
  runExtractionBundle?: (text: string) => Promise<{
    extractionV2: ExtractionV2;
    extraction: Extraction;
    debug: ExtractionDebug;
  }>;
}

export const createBackendHandlers = (deps: BackendDependencies): ApiHandlers => ({
  'health.ping': async () => ok({ status: 'ok' }),
  'notes.list': async () => {
    try {
      return await listNotesService(deps.db);
    } catch (error) {
      return err('DB_ERROR', 'Failed to list notes.', {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  },
  'notes.create': async (input: ApiInput<'notes.create'>) => {
    try {
      return await createNoteService(deps.db, input);
    } catch (error) {
      return err('DB_ERROR', 'Failed to create note.', {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  },
  'extract.run': async (input: ApiInput<'extract.run'>) => {
    const text = input.text.trim();
    if (!text) {
      return err('VALIDATION_ERROR', 'Text must not be empty.');
    }

    try {
      const bundle = await (deps.runExtractionBundle ?? extractWithDebug)(text);
      // TODO: persist extractionV2 graph projection in DB once graph storage is introduced.
      return ok(bundle);
    } catch (error) {
      return err('INTERNAL_ERROR', 'Failed to extract text.', {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  },
});
