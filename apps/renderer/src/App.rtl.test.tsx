import { createApiFromHandlers } from '@repo/api';
import { createBackendHandlers } from '@repo/backend';
import { type DbHarness, createDbHarness } from '@repo/test-utils';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiProvider } from './ApiProvider.js';
import { App } from './App.js';

describe('App (RTL with real backend implementation)', () => {
  let harness: DbHarness | undefined;

  beforeAll(async () => {
    harness = await createDbHarness('fresh');
  });

  beforeEach(async () => {
    if (!harness) {
      throw new Error('DB harness was not initialized.');
    }
    window.location.hash = '#/';
    await harness.beginTestCase();
  });

  afterEach(async () => {
    if (!harness) {
      return;
    }
    await harness.rollbackTestCase();
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    if (!harness) {
      return;
    }

    await harness.close();
  });

  it('shows extract form by default', async () => {
    if (!harness) {
      throw new Error('DB harness was not initialized.');
    }

    const api = createApiFromHandlers(createBackendHandlers({ db: harness.db }));
    render(
      <ApiProvider api={api}>
        <App />
      </ApiProvider>,
    );

    expect(await screen.findByTestId('extract-text-input')).toBeInTheDocument();
    expect(screen.getByTestId('extract-submit-button')).toBeInTheDocument();
  });

  it('creates and lists notes through the real backend implementation', async () => {
    if (!harness) {
      throw new Error('DB harness was not initialized.');
    }

    const api = createApiFromHandlers(createBackendHandlers({ db: harness.db }));
    const user = userEvent.setup();
    render(
      <ApiProvider api={api}>
        <App />
      </ApiProvider>,
    );

    await user.click(await screen.findByTestId('nav-notes'));

    expect(await screen.findByTestId('empty-state')).toBeInTheDocument();

    await user.type(screen.getByTestId('title-input'), 'From RTL');
    await user.type(screen.getByTestId('body-input'), 'Using the real backend API');
    await user.click(screen.getByTestId('create-button'));

    await waitFor(() => {
      expect(screen.getByText('From RTL')).toBeInTheDocument();
    });
    expect(screen.getByText('Using the real backend API')).toBeInTheDocument();
  });

  it('renders knowledge view highlights, ownership and debug copy', async () => {
    if (!harness) {
      throw new Error('DB harness was not initialized.');
    }

    const text = 'I called road maintenance. Egle was driving in Klaipeda and she was scared.';
    const iStart = text.indexOf('I');
    const egleStart = text.indexOf('Egle');
    const klaipedaStart = text.indexOf('Klaipeda');
    const drivingStart = text.indexOf('Egle was driving');
    const scaredStart = text.indexOf('she was scared');

    const clipboardMock = vi.fn(async () => undefined);
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(clipboardMock);
    } else {
      Object.defineProperty(globalThis.navigator, 'clipboard', {
        configurable: true,
        writable: true,
        value: {
          writeText: clipboardMock,
        },
      });
    }

    const api = createApiFromHandlers(
      createBackendHandlers({
        db: harness.db,
        runExtractionBundle: async () => ({
          extraction: {
            title: 'Winter Drive',
            items: [
              {
                label: 'called_road_maintenance:self',
                value: 'I called road maintenance',
                start: 0,
                end: 24,
                confidence: 0.9,
              },
            ],
            groups: [{ name: 'actions', itemIndexes: [0] }],
          },
          extractionV2: {
            title: 'Winter Drive',
            noteType: 'personal',
            summary: 'I called maintenance while Egle drove through scary icy roads.',
            language: 'en',
            date: null,
            sentiment: 'varied',
            emotions: [{ emotion: 'concern', intensity: 4 }],
            entities: [
              {
                id: 'ent_self',
                name: 'I',
                type: 'person',
                nameStart: iStart,
                nameEnd: iStart + 1,
                confidence: 0.9,
              },
              {
                id: 'ent_egle',
                name: 'Egle',
                type: 'person',
                nameStart: egleStart,
                nameEnd: egleStart + 'Egle'.length,
                evidenceStart: drivingStart,
                evidenceEnd: drivingStart + 'Egle was driving'.length,
                confidence: 0.9,
              },
              {
                id: 'ent_klaipeda',
                name: 'Klaipeda',
                type: 'place',
                nameStart: klaipedaStart,
                nameEnd: klaipedaStart + 'Klaipeda'.length,
                confidence: 0.88,
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
                segmentId: 'seg_1',
              },
              {
                id: 'fact_scared',
                ownerEntityId: 'ent_egle',
                perspective: 'other',
                subjectEntityId: 'ent_egle',
                predicate: 'felt_scared',
                evidenceStart: scaredStart,
                evidenceEnd: scaredStart + 'she was scared'.length,
                confidence: 0.87,
                segmentId: 'seg_2',
              },
            ],
            relations: [
              {
                fromEntityId: 'ent_egle',
                toEntityId: 'ent_klaipeda',
                type: 'drove_to',
                confidence: 0.8,
              },
            ],
            groups: [
              {
                name: 'people',
                entityIds: ['ent_self', 'ent_egle'],
                factIds: ['fact_call', 'fact_scared'],
              },
            ],
            segments: [
              {
                id: 'seg_1',
                start: 0,
                end: 24,
                sentiment: 'neutral',
                summary: 'I called road maintenance.',
                entityIds: ['ent_self'],
                factIds: ['fact_call'],
                relationIndexes: [],
              },
              {
                id: 'seg_2',
                start: drivingStart,
                end: text.length,
                sentiment: 'negative',
                summary: 'Egle was driving and felt scared in Klaipeda.',
                entityIds: ['ent_egle', 'ent_klaipeda'],
                factIds: ['fact_scared'],
                relationIndexes: [0],
              },
            ],
          },
          debug: {
            inputText: text,
            prompt: 'prompt',
            rawModelOutput: '{...}',
            validatedExtractionV2BeforeSegmentation: {
              title: 'Winter Drive',
              noteType: 'personal',
              summary: 'I called maintenance while Egle drove through scary icy roads.',
              language: 'en',
              date: null,
              sentiment: 'varied',
              emotions: [],
              entities: [],
              facts: [],
              relations: [],
              groups: [],
              segments: [],
            },
            finalExtractionV2: {
              title: 'Winter Drive',
              noteType: 'personal',
              summary: 'I called maintenance while Egle drove through scary icy roads.',
              language: 'en',
              date: null,
              sentiment: 'varied',
              emotions: [],
              entities: [],
              facts: [],
              relations: [],
              groups: [],
              segments: [],
            },
            finalExtractionV1: {
              title: 'Winter Drive',
              items: [],
              groups: [],
            },
            segmentationTrace: [],
            runtime: {
              modelPath: '/tmp/model.gguf',
              serverMode: 'cpu',
              nPredict: 220,
              totalMs: 100,
            },
            fallbackUsed: false,
            errors: [],
          },
        }),
      }),
    );

    const user = userEvent.setup();
    render(
      <ApiProvider api={api}>
        <App />
      </ApiProvider>,
    );

    await user.type(screen.getByTestId('extract-text-input'), text);
    await user.click(screen.getByTestId('extract-submit-button'));

    expect(await screen.findByTestId('extraction-v2-result')).toBeInTheDocument();
    expect(screen.getByTestId('extraction-v2-source')).toHaveTextContent('Egle was driving');
    expect(screen.getByTestId('extraction-v2-entities')).toHaveTextContent('Klaipeda');
    expect(screen.getByTestId('entity-excerpt-ent_egle')).toHaveTextContent('driving');
    expect(screen.getByTestId('extraction-v2-facts')).toHaveTextContent('owner=Egle');
    expect(screen.getByTestId('extraction-v2-facts')).toHaveTextContent('perspective=other');
    expect(screen.getByTestId('extraction-v2-segments')).toHaveTextContent('seg_2');

    await user.click(screen.getByTestId('copy-debug-bundle'));
    expect(clipboardMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('copy-debug-state')).toHaveTextContent('Copied');
  });
});
