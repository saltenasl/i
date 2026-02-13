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
});
