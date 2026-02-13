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
});
