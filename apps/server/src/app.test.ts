import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { createTestContext } from './test-utils.js';

describe('Hono Server', () => {
  let context: Awaited<ReturnType<typeof createTestContext>>;

  beforeEach(async () => {
    context = await createTestContext();
  });

  afterEach(async () => {
    await context.cleanup();
  });

  it('health check returns ok', async () => {
    const app = createApp({
      getPrimaryDb: async () => context.primaryDb,
      getUserDb: context.getUserDb,
    });

    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('unauthorized request returns 401', async () => {
    const app = createApp({
      getPrimaryDb: async () => context.primaryDb,
      getUserDb: context.getUserDb,
    });

    const res = await app.request('/api/notes/list');
    expect(res.status).toBe(401);
  });
});
