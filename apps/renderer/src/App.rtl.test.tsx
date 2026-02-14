import { createApiFromHandlers } from '@repo/api';
import { createBackendHandlers } from '@repo/backend';
import { type DbHarness, createDbHarness } from '@repo/test-utils';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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

  it('renders knowledge view fields from extraction v2', async () => {
    if (!harness) {
      throw new Error('DB harness was not initialized.');
    }

    const text = 'Egle was driving in Klaipeda and she was scared by ice on the road.';
    const egleStart = text.indexOf('Egle');
    const klaipedaStart = text.indexOf('Klaipeda');
    const drivingStart = text.indexOf('was driving');

    const api = createApiFromHandlers(
      createBackendHandlers({
        db: harness.db,
        runExtractionV2: async () => ({
          title: 'Winter Drive',
          noteType: 'personal',
          summary: 'I noticed dangerous road conditions while Egle drove in Klaipeda.',
          language: 'en',
          date: null,
          sentiment: 'mixed',
          emotions: [{ emotion: 'concern', intensity: 4 }],
          entities: [
            {
              id: 'ent_1',
              name: 'Egle',
              type: 'person',
              nameStart: egleStart,
              nameEnd: egleStart + 'Egle'.length,
              evidenceStart: drivingStart,
              evidenceEnd: drivingStart + 'was driving'.length,
              context: 'was driving',
              confidence: 0.9,
            },
            {
              id: 'ent_2',
              name: 'Klaipeda',
              type: 'place',
              nameStart: klaipedaStart,
              nameEnd: klaipedaStart + 'Klaipeda'.length,
              confidence: 0.85,
            },
          ],
          facts: [
            {
              id: 'fact_1',
              subjectEntityId: 'ent_1',
              predicate: 'drove_to',
              objectEntityId: 'ent_2',
              evidenceStart: drivingStart,
              evidenceEnd: drivingStart + 'was driving'.length,
              confidence: 0.8,
            },
          ],
          relations: [
            {
              fromEntityId: 'ent_1',
              toEntityId: 'ent_2',
              type: 'drove_to',
              confidence: 0.8,
            },
          ],
          groups: [{ name: 'people', entityIds: ['ent_1'], factIds: ['fact_1'] }],
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
    expect(screen.getByTestId('extraction-v2-entities')).toHaveTextContent('Egle');
    expect(screen.getByTestId('extraction-v2-facts')).toHaveTextContent('drove_to');
    expect(screen.getByTestId('extraction-v2-groups')).toHaveTextContent('people');
    expect(screen.getByTestId('extraction-raw-json')).toHaveTextContent('"entities"');
    expect(screen.getByTestId('extraction-raw-json')).toHaveTextContent('"facts"');
  });
});
