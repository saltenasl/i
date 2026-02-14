import {
  type ApiHandlers,
  type ApiInput,
  type ExtractionDebug,
  type ExtractionLaneId,
  type ExtractionLaneResult,
  type ExtractionV2,
  err,
  ok,
} from '@repo/api';
import { extractCompare, extractCompareLane, extractWithDebug } from '@repo/auto-extract';
import type { DbClient } from '@repo/db';
import {
  listExtractionHistoryService,
  persistExtractionHistoryService,
} from './services/extraction-history-service.js';
import { createNoteService, listNotesService } from './services/note-service.js';

export interface BackendDependencies {
  db: DbClient;
  runExtractionBundle?: (text: string) => Promise<{
    extractionV2: ExtractionV2;
    debug: ExtractionDebug;
  }>;
  runExtractionCompareLane?: (
    text: string,
    laneId: ExtractionLaneId,
  ) => Promise<ExtractionLaneResult>;
  runExtractionCompare?: (text: string) => Promise<{ lanes: ExtractionLaneResult[] }>;
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
      await persistExtractionHistoryService(deps.db, {
        sourceText: text,
        prompt: bundle.debug.prompt,
        extractionV2: bundle.extractionV2,
        debug: bundle.debug,
      });
      return ok(bundle);
    } catch (error) {
      return err('INTERNAL_ERROR', 'Failed to extract text.', {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  },
  'extract.history.list': async (input: ApiInput<'extract.history.list'>) => {
    try {
      return await listExtractionHistoryService(deps.db, input);
    } catch (error) {
      return err('DB_ERROR', 'Failed to list extraction history.', {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  },
  'extract.compareLane': async (input: ApiInput<'extract.compareLane'>) => {
    const text = input.text.trim();
    if (!text) {
      return err('VALIDATION_ERROR', 'Text must not be empty.');
    }

    try {
      const lane = await (deps.runExtractionCompareLane ?? extractCompareLane)(text, input.laneId);
      return ok({ lane });
    } catch (error) {
      return err('INTERNAL_ERROR', 'Failed to compare extraction lane.', {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  },
  'extract.compare': async (input: ApiInput<'extract.compare'>) => {
    const text = input.text.trim();
    if (!text) {
      return err('VALIDATION_ERROR', 'Text must not be empty.');
    }

    try {
      const compare = await (deps.runExtractionCompare ?? extractCompare)(text);
      const representativeLane = compare.lanes.find(
        (lane) => lane.status === 'ok' && lane.extractionV2 && lane.debug,
      );
      if (representativeLane?.extractionV2 && representativeLane.debug) {
        await persistExtractionHistoryService(deps.db, {
          sourceText: text,
          prompt: representativeLane.debug.prompt,
          extractionV2: representativeLane.extractionV2,
          debug: representativeLane.debug,
          compareLanes: compare.lanes,
        });
      }
      return ok(compare);
    } catch (error) {
      return err('INTERNAL_ERROR', 'Failed to compare extraction.', {
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  },
});
