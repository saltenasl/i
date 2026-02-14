import {
  type ApiHandlers,
  type ApiInput,
  type Extraction,
  type ExtractionV2,
  err,
  ok,
} from '@repo/api';
import { extractV2, toExtractionV1 } from '@repo/auto-extract';
import type { DbClient } from '@repo/db';
import { createNoteService, listNotesService } from './services/note-service.js';

export interface BackendDependencies {
  db: DbClient;
  runExtractionV2?: (text: string) => Promise<ExtractionV2>;
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
      const extractionV2 = await (deps.runExtractionV2 ?? extractV2)(text);
      const extraction = toExtractionV1(extractionV2, text);
      // TODO: persist extractionV2 graph projection in DB once graph storage is introduced.
      return ok({ extraction, extractionV2 });
    } catch (error) {
      return err('INTERNAL_ERROR', 'Failed to extract text.', {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  },
});
