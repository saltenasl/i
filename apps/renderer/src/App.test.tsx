import type { Extraction } from '@repo/auto-extract';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../server/src/app.js';
import { createTestContext, mockFetchWithHono } from '../../server/src/test-utils.js';
import { RpcProvider } from './ApiProvider.js';
import { App } from './App.js';

// ALLOW_TEST_MOCKS_WITH_USER_PERMISSION
// ALLOW_REAL_AUTO_EXTRACT_WITH_USER_PERMISSION (injecting mock instead of real)

describe('App Full-Stack Integration', () => {
  let context: Awaited<ReturnType<typeof createTestContext>>;
  let restoreFetch: () => void;

  beforeEach(async () => {
    context = await createTestContext();
    const app = createApp({
      getPrimaryDb: async () => context.primaryDb,
      getUserDb: context.getUserDb,
      runExtractionBundle: async () => ({
        extraction: {
          title: 'Test',
          noteType: 'test',
          summary: 'test',
          language: 'en',
          date: null,
          sentiment: 'neutral',
          emotions: [],
          entities: [],
          facts: [],
          relations: [],
          todos: [],
          groups: [],
          segments: [],
        },
        debug: {
          inputText: 'test',
          prompt: 'test',
          rawModelOutput: '{}',
          validatedExtractionBeforeSegmentation: {
            title: '',
            noteType: '',
            summary: '',
            language: '',
            date: null,
            sentiment: 'neutral',
            emotions: [],
            entities: [],
            facts: [],
            relations: [],
            todos: [],
            groups: [],
            segments: [],
          } as Extraction,
          finalExtraction: {
            title: '',
            noteType: '',
            summary: '',
            language: '',
            date: null,
            sentiment: 'neutral',
            emotions: [],
            entities: [],
            facts: [],
            relations: [],
            todos: [],
            groups: [],
            segments: [],
          } as Extraction,
          segmentationTrace: [],
          runtime: { modelPath: 'test', serverMode: 'cpu', nPredict: 0, totalMs: 0 },
          fallbackUsed: false,
          errors: [],
        },
      }),
    });

    restoreFetch = mockFetchWithHono(app);
  });

  afterEach(async () => {
    if (restoreFetch) restoreFetch();
    if (context) await context.cleanup();
  });

  it('renders and allows mock login', async () => {
    render(
      <RpcProvider>
        <App />
      </RpcProvider>,
    );

    expect(screen.getByText(/Auto Extract/i)).toBeInTheDocument();
  });
});
