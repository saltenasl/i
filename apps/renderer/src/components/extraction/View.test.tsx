import type { ExtractionDebug, ExtractionV2 } from '@repo/api';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ExtractionView } from './View.js';

const sourceText = 'I called road maintenance. Egle was driving in Klaipeda and she was scared.';

const iStart = sourceText.indexOf('I');
const egleStart = sourceText.indexOf('Egle');
const klaipedaStart = sourceText.indexOf('Klaipeda');
const drivingStart = sourceText.indexOf('Egle was driving');
const scaredStart = sourceText.indexOf('she was scared');

const extraction: ExtractionV2 = {
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
      end: sourceText.length,
      sentiment: 'negative',
      summary: 'Egle was driving and felt scared in Klaipeda.',
      entityIds: ['ent_egle', 'ent_klaipeda'],
      factIds: ['fact_scared'],
      relationIndexes: [0],
    },
  ],
};

const debug: ExtractionDebug = {
  inputText: sourceText,
  prompt: 'prompt',
  rawModelOutput: '{...}',
  validatedExtractionV2BeforeSegmentation: {
    ...extraction,
    emotions: [],
    entities: [],
    facts: [],
    relations: [],
    groups: [],
    segments: [],
  },
  finalExtractionV2: {
    ...extraction,
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
    totalMs: 100,
  },
  fallbackUsed: false,
  errors: [],
};

describe('ExtractionView', () => {
  it('renders all sections with test data', () => {
    render(<ExtractionView extractionV2={extraction} sourceText={sourceText} debug={debug} />);

    expect(screen.getByTestId('extraction-v2-result')).toBeInTheDocument();
    expect(screen.getByTestId('extraction-v2-metadata')).toHaveTextContent('Winter Drive');
    expect(screen.getByTestId('extraction-v2-metadata')).toHaveTextContent('personal');
    expect(screen.getByTestId('extraction-v2-emotions')).toHaveTextContent('concern');
    expect(screen.getByTestId('extraction-v2-source')).toHaveTextContent('Egle was driving');
    expect(screen.getByTestId('extraction-v2-entities')).toHaveTextContent('Klaipeda');
    expect(screen.getByTestId('extraction-v2-facts')).toHaveTextContent('called_road_maintenance');
    expect(screen.getByTestId('extraction-v2-relations')).toHaveTextContent('drove_to');
    expect(screen.getByTestId('extraction-v2-groups')).toHaveTextContent('people');
    expect(screen.getByTestId('extraction-v2-segments')).toBeInTheDocument();
    expect(screen.getByTestId('segment-timeline')).toBeInTheDocument();
  });

  it('hovering entity highlights related facts, relations, groups, segments', async () => {
    const user = userEvent.setup();
    render(<ExtractionView extractionV2={extraction} sourceText={sourceText} debug={debug} />);

    expect(screen.getByTestId('entity-row-ent_egle')).toHaveAttribute('data-active', 'false');
    expect(screen.getByTestId('fact-row-fact_scared')).toHaveAttribute('data-active', 'false');
    expect(screen.getByTestId('relation-row-0')).toHaveAttribute('data-active', 'false');
    expect(screen.getByTestId('group-row-people')).toHaveAttribute('data-active', 'false');
    expect(screen.getByTestId('segment-row-seg_2')).toHaveAttribute('data-active', 'false');

    await user.hover(screen.getByTestId('entity-row-ent_egle'));

    expect(screen.getByTestId('entity-row-ent_egle')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('fact-row-fact_scared')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('relation-row-0')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('group-row-people')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('segment-row-seg_2')).toHaveAttribute('data-active', 'true');

    const sourceEgle = screen.getAllByTestId('source-entity-ent_egle')[0];
    expect(sourceEgle).toHaveAttribute('data-active', 'true');
  });

  it('hovering fact highlights owner/subject/object entities and segments', async () => {
    const user = userEvent.setup();
    render(<ExtractionView extractionV2={extraction} sourceText={sourceText} debug={debug} />);

    await user.hover(screen.getByTestId('fact-row-fact_scared'));

    expect(screen.getByTestId('fact-row-fact_scared')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('entity-row-ent_egle')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('segment-row-seg_2')).toHaveAttribute('data-active', 'true');
  });

  it('hovering segment highlights all contained entities, facts, relations', async () => {
    const user = userEvent.setup();
    render(<ExtractionView extractionV2={extraction} sourceText={sourceText} debug={debug} />);

    await user.hover(screen.getByTestId('segment-row-seg_2'));

    expect(screen.getByTestId('segment-row-seg_2')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('entity-row-ent_egle')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('entity-row-ent_klaipeda')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('fact-row-fact_scared')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('relation-row-0')).toHaveAttribute('data-active', 'true');
  });

  it('hovering relation highlights from/to entities and related facts', async () => {
    const user = userEvent.setup();
    render(<ExtractionView extractionV2={extraction} sourceText={sourceText} debug={debug} />);

    await user.hover(screen.getByTestId('relation-row-0'));

    expect(screen.getByTestId('relation-row-0')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('entity-row-ent_egle')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('entity-row-ent_klaipeda')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('segment-row-seg_2')).toHaveAttribute('data-active', 'true');
  });

  it('unhover deactivates everything', async () => {
    const user = userEvent.setup();
    render(<ExtractionView extractionV2={extraction} sourceText={sourceText} debug={debug} />);

    await user.hover(screen.getByTestId('entity-row-ent_egle'));
    expect(screen.getByTestId('entity-row-ent_egle')).toHaveAttribute('data-active', 'true');

    await user.unhover(screen.getByTestId('entity-row-ent_egle'));
    expect(screen.getByTestId('entity-row-ent_egle')).toHaveAttribute('data-active', 'false');
    expect(screen.getByTestId('fact-row-fact_scared')).toHaveAttribute('data-active', 'false');
    expect(screen.getByTestId('relation-row-0')).toHaveAttribute('data-active', 'false');
    expect(screen.getByTestId('segment-row-seg_2')).toHaveAttribute('data-active', 'false');
  });

  it('hovering group highlights all member entities and facts', async () => {
    const user = userEvent.setup();
    render(<ExtractionView extractionV2={extraction} sourceText={sourceText} debug={debug} />);

    await user.hover(screen.getByTestId('group-row-people'));

    expect(screen.getByTestId('group-row-people')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('entity-row-ent_self')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('entity-row-ent_egle')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('fact-row-fact_call')).toHaveAttribute('data-active', 'true');
    expect(screen.getByTestId('fact-row-fact_scared')).toHaveAttribute('data-active', 'true');
  });
});
