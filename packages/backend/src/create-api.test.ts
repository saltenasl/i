import { type DbHarness, createDbHarness } from '@repo/test-utils';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createBackendHandlers } from './create-api.js';

describe('createBackendHandlers', () => {
  let harness: DbHarness | undefined;

  beforeAll(async () => {
    harness = await createDbHarness('fresh');
  });

  beforeEach(async () => {
    if (!harness) {
      throw new Error('DB harness was not initialized.');
    }
    await harness.beginTestCase();
  });

  afterEach(async () => {
    if (!harness) {
      return;
    }
    await harness.rollbackTestCase();
  });

  afterAll(async () => {
    if (!harness) {
      return;
    }

    await harness.close();
  });

  it('returns health status', async () => {
    if (!harness) {
      throw new Error('DB harness was not initialized.');
    }

    const handlers = createBackendHandlers({ db: harness.db });
    const result = await handlers['health.ping']({});

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.status).toBe('ok');
  });

  it('creates and lists notes with real DB', async () => {
    if (!harness) {
      throw new Error('DB harness was not initialized.');
    }

    const handlers = createBackendHandlers({ db: harness.db });

    const createResult = await handlers['notes.create']({
      title: 'Backend note',
      body: 'Persisted using SQLite + Kysely.',
    });

    expect(createResult.ok).toBe(true);

    const listResult = await handlers['notes.list']({});
    expect(listResult.ok).toBe(true);

    if (!listResult.ok) {
      return;
    }

    expect(listResult.data.notes).toHaveLength(1);
    expect(listResult.data.notes[0]?.title).toBe('Backend note');
  });

  it('rejects empty title with validation error', async () => {
    if (!harness) {
      throw new Error('DB harness was not initialized.');
    }

    const handlers = createBackendHandlers({ db: harness.db });

    const createResult = await handlers['notes.create']({
      title: '   ',
      body: 'ignored',
    });

    expect(createResult.ok).toBe(false);
    if (createResult.ok) {
      return;
    }

    expect(createResult.error.code).toBe('VALIDATION_ERROR');
  });

  it('runs extraction through the injected extraction dependency', async () => {
    if (!harness) {
      throw new Error('DB harness was not initialized.');
    }

    const handlers = createBackendHandlers({
      db: harness.db,
      runExtractionBundle: async (text) => ({
        extractionV2: {
          title: 'Extracted',
          noteType: 'reference',
          summary: 'Uses local llama runtime.',
          language: 'en',
          date: null,
          sentiment: 'neutral',
          emotions: [],
          entities: [
            {
              id: 'ent_1',
              name: 'llama.cpp',
              type: 'tool',
              nameStart: text.indexOf('llama.cpp'),
              nameEnd: text.indexOf('llama.cpp') + 'llama.cpp'.length,
              confidence: 0.91,
            },
          ],
          facts: [
            {
              id: 'fact_1',
              ownerEntityId: 'ent_1',
              perspective: 'other',
              subjectEntityId: 'ent_1',
              predicate: 'used_for_extraction',
              evidenceStart: text.indexOf('llama.cpp'),
              evidenceEnd: text.indexOf('llama.cpp') + 'llama.cpp'.length,
              confidence: 0.9,
            },
          ],
          relations: [],
          groups: [{ name: 'tools', entityIds: ['ent_1'], factIds: ['fact_1'] }],
          segments: [
            {
              id: 'seg_1',
              start: 0,
              end: text.length,
              sentiment: 'neutral',
              summary: 'Uses local llama runtime.',
              entityIds: ['ent_1'],
              factIds: ['fact_1'],
              relationIndexes: [],
            },
          ],
        },
        debug: {
          inputText: text,
          prompt: 'prompt',
          rawModelOutput: '{}',
          validatedExtractionV2BeforeSegmentation: {
            title: 'Extracted',
            noteType: 'reference',
            summary: 'Uses local llama runtime.',
            language: 'en',
            date: null,
            sentiment: 'neutral',
            emotions: [],
            entities: [],
            facts: [],
            relations: [],
            groups: [],
            segments: [],
          },
          finalExtractionV2: {
            title: 'Extracted',
            noteType: 'reference',
            summary: 'Uses local llama runtime.',
            language: 'en',
            date: null,
            sentiment: 'neutral',
            emotions: [],
            entities: [],
            facts: [],
            relations: [],
            groups: [],
            segments: [],
          },
          segmentationTrace: [],
          runtime: {
            modelPath: '/tmp/model.gguf',
            serverMode: 'cpu',
            nPredict: 220,
            totalMs: 10,
          },
          fallbackUsed: false,
          errors: [],
        },
      }),
    });

    const result = await handlers['extract.run']({ text: 'Use llama.cpp locally.' });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.extractionV2.entities[0]?.name).toBe('llama.cpp');
    expect(result.data.debug.runtime.serverMode).toBe('cpu');

    const historyResult = await handlers['extract.history.list']({ limit: 10 });
    expect(historyResult.ok).toBe(true);
    if (!historyResult.ok) {
      return;
    }

    expect(historyResult.data.entries).toHaveLength(1);
    expect(historyResult.data.entries[0]?.prompt).toBe('prompt');
    expect(historyResult.data.entries[0]?.sourceText).toBe('Use llama.cpp locally.');
  });

  it('lists extraction history using default and bounded limits', async () => {
    if (!harness) {
      throw new Error('DB harness was not initialized.');
    }

    const handlers = createBackendHandlers({
      db: harness.db,
      runExtractionBundle: async (text) => ({
        extractionV2: {
          title: text.slice(0, 12),
          noteType: 'personal',
          summary: text,
          language: 'en',
          date: null,
          sentiment: 'neutral',
          emotions: [],
          entities: [],
          facts: [],
          relations: [],
          groups: [],
          segments: [],
        },
        debug: {
          inputText: text,
          prompt: `prompt:${text}`,
          rawModelOutput: '{}',
          validatedExtractionV2BeforeSegmentation: {
            title: text.slice(0, 12),
            noteType: 'personal',
            summary: text,
            language: 'en',
            date: null,
            sentiment: 'neutral',
            emotions: [],
            entities: [],
            facts: [],
            relations: [],
            groups: [],
            segments: [],
          },
          finalExtractionV2: {
            title: text.slice(0, 12),
            noteType: 'personal',
            summary: text,
            language: 'en',
            date: null,
            sentiment: 'neutral',
            emotions: [],
            entities: [],
            facts: [],
            relations: [],
            groups: [],
            segments: [],
          },
          segmentationTrace: [],
          runtime: {
            modelPath: '/tmp/model.gguf',
            serverMode: 'cpu',
            nPredict: 220,
            totalMs: 10,
          },
          fallbackUsed: false,
          errors: [],
        },
      }),
    });

    await handlers['extract.run']({ text: 'first' });
    await handlers['extract.run']({ text: 'second' });
    await handlers['extract.run']({ text: 'third' });

    const limited = await handlers['extract.history.list']({ limit: 2 });
    expect(limited.ok).toBe(true);
    if (!limited.ok) {
      return;
    }
    expect(limited.data.entries).toHaveLength(2);

    const invalidLimit = await handlers['extract.history.list']({ limit: -4 });
    expect(invalidLimit.ok).toBe(true);
    if (!invalidLimit.ok) {
      return;
    }
    expect(invalidLimit.data.entries).toHaveLength(3);
  });

  it('runs compare lane through injected lane dependency without persisting history rows', async () => {
    if (!harness) {
      throw new Error('DB harness was not initialized.');
    }

    const handlers = createBackendHandlers({
      db: harness.db,
      runExtractionCompareLane: async (text, laneId) => ({
        laneId,
        provider:
          laneId === 'local-llama'
            ? 'local'
            : laneId === 'anthropic-haiku'
              ? 'anthropic'
              : 'openai',
        model: laneId,
        status: 'ok',
        durationMs: 5,
        extractionV2: {
          title: 'Lane',
          noteType: 'personal',
          summary: 'Summary',
          language: 'en',
          date: null,
          sentiment: 'neutral',
          emotions: [],
          entities: [],
          facts: [],
          relations: [],
          groups: [],
          segments: [],
        },
        debug: {
          inputText: text,
          prompt: 'prompt',
          rawModelOutput: '{}',
          validatedExtractionV2BeforeSegmentation: {
            title: 'Lane',
            noteType: 'personal',
            summary: 'Summary',
            language: 'en',
            date: null,
            sentiment: 'neutral',
            emotions: [],
            entities: [],
            facts: [],
            relations: [],
            groups: [],
            segments: [],
          },
          finalExtractionV2: {
            title: 'Lane',
            noteType: 'personal',
            summary: 'Summary',
            language: 'en',
            date: null,
            sentiment: 'neutral',
            emotions: [],
            entities: [],
            facts: [],
            relations: [],
            groups: [],
            segments: [],
          },
          segmentationTrace: [],
          runtime: {
            modelPath: 'lane',
            serverMode: 'cpu',
            nPredict: 220,
            totalMs: 5,
          },
          fallbackUsed: false,
          errors: [],
        },
      }),
    });

    const result = await handlers['extract.compareLane']({
      text: 'Compare this text',
      laneId: 'openai-gpt5mini',
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.lane.laneId).toBe('openai-gpt5mini');
    expect(result.data.lane.status).toBe('ok');

    const history = await handlers['extract.history.list']({ limit: 10 });
    expect(history.ok).toBe(true);
    if (!history.ok) {
      return;
    }
    expect(history.data.entries).toHaveLength(0);
  });

  it('runs compare through injected compare dependency and persists full lane snapshot', async () => {
    if (!harness) {
      throw new Error('DB harness was not initialized.');
    }

    const handlers = createBackendHandlers({
      db: harness.db,
      runExtractionCompare: async (text) => ({
        lanes: [
          {
            laneId: 'local-llama',
            provider: 'local',
            model: 'local-llama.cpp',
            status: 'ok',
            durationMs: 10,
            extractionV2: {
              title: 'Local',
              noteType: 'personal',
              summary: 'Local summary',
              language: 'en',
              date: null,
              sentiment: 'neutral',
              emotions: [],
              entities: [],
              facts: [],
              relations: [],
              groups: [],
              segments: [],
            },
            debug: {
              inputText: text,
              prompt: 'compare prompt',
              rawModelOutput: '{}',
              validatedExtractionV2BeforeSegmentation: {
                title: 'Local',
                noteType: 'personal',
                summary: 'Local summary',
                language: 'en',
                date: null,
                sentiment: 'neutral',
                emotions: [],
                entities: [],
                facts: [],
                relations: [],
                groups: [],
                segments: [],
              },
              finalExtractionV2: {
                title: 'Local',
                noteType: 'personal',
                summary: 'Local summary',
                language: 'en',
                date: null,
                sentiment: 'neutral',
                emotions: [],
                entities: [],
                facts: [],
                relations: [],
                groups: [],
                segments: [],
              },
              segmentationTrace: [],
              runtime: {
                modelPath: 'local',
                serverMode: 'cpu',
                nPredict: 220,
                totalMs: 10,
              },
              fallbackUsed: false,
              errors: [],
            },
          },
          {
            laneId: 'anthropic-haiku',
            provider: 'anthropic',
            model: 'claude-haiku-4-5-20251001',
            status: 'skipped',
            durationMs: 1,
            errorMessage: 'Missing key',
          },
          {
            laneId: 'openai-gpt5mini',
            provider: 'openai',
            model: 'gpt-5-mini',
            status: 'error',
            durationMs: 2,
            errorMessage: 'Upstream error',
          },
        ],
      }),
    });

    const result = await handlers['extract.compare']({ text: 'Compare all lanes' });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.data.lanes).toHaveLength(3);
    expect(result.data.lanes[1]?.status).toBe('skipped');
    expect(result.data.lanes[2]?.status).toBe('error');

    const history = await handlers['extract.history.list']({ limit: 10 });
    expect(history.ok).toBe(true);
    if (!history.ok) {
      return;
    }
    expect(history.data.entries).toHaveLength(1);
    expect(history.data.entries[0]?.sourceText).toBe('Compare all lanes');
    expect(history.data.entries[0]?.compareLanes).toHaveLength(3);
    expect(history.data.entries[0]?.compareLanes?.[1]?.status).toBe('skipped');
  });
});
