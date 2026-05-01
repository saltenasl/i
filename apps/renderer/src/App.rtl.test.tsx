import type { Extraction, ExtractionLaneId, ExtractionLaneResult } from '@repo/auto-extract';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type AppDependencies, createApp } from '../../server/src/app.js';
import { createTestContext, mockFetchWithHono } from '../../server/src/test-utils.js';
import { RpcProvider } from './ApiProvider.js';
import { App } from './App.js';

// ALLOW_TEST_MOCKS_WITH_USER_PERMISSION
// ALLOW_REAL_AUTO_EXTRACT_WITH_USER_PERMISSION

describe('App (RTL with Full-Stack Integration)', () => {
  let context: Awaited<ReturnType<typeof createTestContext>>;
  let restoreFetch: () => void;

  beforeEach(async () => {
    context = await createTestContext();
    window.location.hash = '#/';
  });

  afterEach(async () => {
    if (restoreFetch) restoreFetch();
    if (context) await context.cleanup();
    vi.restoreAllMocks();
  });

  const setupApp = (deps?: Partial<AppDependencies>) => {
    const app = createApp({
      getPrimaryDb: async () => context.primaryDb,
      getUserDb: context.getUserDb,
      ...deps,
    });
    restoreFetch = mockFetchWithHono(app);
  };

  const emptyExtraction: Extraction = {
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
  };

  it('shows extract form by default after login', async () => {
    setupApp();
    render(
      <RpcProvider>
        <App />
      </RpcProvider>,
    );

    await fetch('/api/auth/mock-login');

    expect(await screen.findByTestId('extract-text-input')).toBeInTheDocument();
    expect(screen.getByTestId('extract-submit-button')).toBeInTheDocument();
  });

  it('creates and lists notes', async () => {
    setupApp();
    const user = userEvent.setup();
    render(
      <RpcProvider>
        <App />
      </RpcProvider>,
    );

    await fetch('/api/auth/mock-login');

    await user.click(await screen.findByTestId('nav-notes'));
    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();

    await user.type(screen.getByTestId('title-input'), 'From RTL');
    await user.type(screen.getByTestId('body-input'), 'Using full stack integration');
    await user.click(screen.getByTestId('create-button'));

    await waitFor(() => {
      expect(screen.getByText('From RTL')).toBeInTheDocument();
    });
    expect(screen.getByText('Using full stack integration')).toBeInTheDocument();
  });

  it('renders extraction view highlights', async () => {
    const text = 'I called road maintenance.';

    setupApp({
      runExtractionBundle: async () => ({
        extraction: {
          ...emptyExtraction,
          title: 'Winter Drive',
          noteType: 'personal',
          summary: 'I called maintenance.',
          entities: [
            {
              id: 'ent_self',
              name: 'I',
              type: 'person',
              nameStart: 0,
              nameEnd: 1,
              confidence: 0.9,
            },
          ],
          facts: [
            {
              id: 'fact_call',
              ownerEntityId: 'ent_self',
              perspective: 'self',
              subjectEntityId: 'ent_self',
              predicate: 'called_road_maintenance',
              evidenceStart: 0,
              evidenceEnd: 24,
              confidence: 0.9,
            },
          ],
        },
        debug: {
          inputText: text,
          prompt: 'prompt',
          rawModelOutput: '{}',
          validatedExtractionBeforeSegmentation: emptyExtraction,
          finalExtraction: emptyExtraction,
          segmentationTrace: [],
          runtime: { modelPath: 'test', serverMode: 'cpu', nPredict: 0, totalMs: 0 },
          fallbackUsed: false,
          errors: [],
        },
      }),
    });

    const user = userEvent.setup();
    render(
      <RpcProvider>
        <App />
      </RpcProvider>,
    );

    await fetch('/api/auth/mock-login');

    await user.type(await screen.findByTestId('extract-text-input'), text);
    await user.click(screen.getByTestId('extract-submit-button'));

    expect(await screen.findByTestId('extraction-v2-result')).toBeInTheDocument();
    expect(screen.getByTestId('extraction-v2-metadata')).toHaveTextContent('personal');
  });

  it('runs compare and restores from history', async () => {
    setupApp({
      runExtractionCompareLane: async (
        text: string,
        laneId: ExtractionLaneId,
      ): Promise<ExtractionLaneResult> => {
        return {
          laneId,
          provider: 'google',
          model: 'gemini',
          status: 'ok',
          durationMs: 10,
          extraction: emptyExtraction,
          debug: {
            inputText: text,
            prompt: 'prompt',
            rawModelOutput: '{}',
            validatedExtractionBeforeSegmentation: emptyExtraction,
            finalExtraction: emptyExtraction,
            segmentationTrace: [],
            runtime: { modelPath: 'test', serverMode: 'cpu', nPredict: 0, totalMs: 0 },
            fallbackUsed: false,
            errors: [],
          },
        };
      },
    });

    const user = userEvent.setup();
    render(
      <RpcProvider>
        <App />
      </RpcProvider>,
    );

    await fetch('/api/auth/mock-login');

    await user.type(await screen.findByTestId('extract-text-input'), 'Compare this');
    await user.click(screen.getByTestId('extract-compare-button'));

    expect(await screen.findByTestId('compare-results')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('compare-progress')).toHaveTextContent('3/3 complete');
    });

    const historyList = await screen.findByTestId('extraction-history-list');
    const openButtons = historyList.querySelectorAll('[data-testid^="history-open-"]');
    const firstOpenButton = openButtons[0];
    if (!firstOpenButton) throw new Error('No open button found');
    await user.click(firstOpenButton);

    expect(await screen.findByTestId('compare-results')).toBeInTheDocument();
  });
});
