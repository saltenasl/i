import { describe, expect, it } from 'vitest';
import type { Extraction, ExtractionV2 } from './types.js';
import {
  normalizeGroupsV2,
  parseAndValidateExtractionOutput,
  validateExtraction,
  validateExtractionV2,
} from './validate.js';

const SOURCE_TEXT = 'I want Gemma 2B Q5 with llama.cpp under 3GB RAM';

const createValidExtraction = (): Extraction => {
  const modelValue = 'Gemma 2B Q5';
  const toolValue = 'llama.cpp';
  const constraintValue = 'under 3GB RAM';

  const modelStart = SOURCE_TEXT.indexOf(modelValue);
  const toolStart = SOURCE_TEXT.indexOf(toolValue);
  const constraintStart = SOURCE_TEXT.indexOf(constraintValue);

  if (modelStart < 0 || toolStart < 0 || constraintStart < 0) {
    throw new Error('Test fixture values were not found in SOURCE_TEXT.');
  }

  return {
    title: 'Gemma local extract',
    memory: 'Use local llama.cpp under 3GB RAM.',
    items: [
      {
        label: 'model',
        value: modelValue,
        start: modelStart,
        end: modelStart + modelValue.length,
        confidence: 0.95,
      },
      {
        label: 'tool',
        value: toolValue,
        start: toolStart,
        end: toolStart + toolValue.length,
        confidence: 0.93,
      },
      {
        label: 'constraint',
        value: constraintValue,
        start: constraintStart,
        end: constraintStart + constraintValue.length,
        confidence: 0.9,
      },
    ],
    groups: [
      {
        name: 'preferences',
        itemIndexes: [0, 1, 2],
      },
    ],
  };
};

describe('validateExtraction', () => {
  it('accepts a valid grounded extraction', () => {
    const extraction = createValidExtraction();
    const result = validateExtraction(SOURCE_TEXT, extraction);
    expect(result.title).toBe('Gemma local extract');
    expect(result.items).toHaveLength(3);
  });

  it('rejects non-grounded value mismatch', () => {
    const extraction = createValidExtraction();
    const firstItem = extraction.items[0];
    if (!firstItem) {
      throw new Error('Expected first item in test fixture.');
    }
    extraction.items[0] = {
      ...firstItem,
      value: 'Not in source',
    };

    expect(() => validateExtraction(SOURCE_TEXT, extraction)).toThrow(
      /grounding check|missing required explicit mention extraction/i,
    );
  });

  it('repairs out-of-range indices when value is grounded', () => {
    const extraction = createValidExtraction();
    const firstItem = extraction.items[0];
    if (!firstItem) {
      throw new Error('Expected first item in test fixture.');
    }
    extraction.items[0] = {
      ...firstItem,
      start: -1,
    };

    const result = validateExtraction(SOURCE_TEXT, extraction);
    expect(result.items[0]?.value).toBe('Gemma 2B Q5');
    expect(result.items[0]?.start).toBe(SOURCE_TEXT.indexOf('Gemma 2B Q5'));
  });

  it('rejects title longer than 25 chars', () => {
    const extraction = createValidExtraction();
    extraction.title = 'this title is definitely way too long';

    expect(() => validateExtraction(SOURCE_TEXT, extraction)).toThrow(/25 characters or fewer/i);
  });

  it('rejects invalid confidence', () => {
    const extraction = createValidExtraction();
    const firstItem = extraction.items[0];
    if (!firstItem) {
      throw new Error('Expected first item in test fixture.');
    }
    extraction.items[0] = {
      ...firstItem,
      confidence: 1.2,
    };

    expect(() => validateExtraction(SOURCE_TEXT, extraction)).toThrow(/confidence/i);
  });

  it('drops out-of-range group indexes', () => {
    const extraction = createValidExtraction();
    const firstGroup = extraction.groups[0];
    if (!firstGroup) {
      throw new Error('Expected first group in test fixture.');
    }
    extraction.groups[0] = {
      ...firstGroup,
      itemIndexes: [99],
    };

    const result = validateExtraction(SOURCE_TEXT, extraction);
    expect(result.groups[0]?.itemIndexes).toEqual([]);
  });

  it('requires explicit mention coverage for models/tools/constraints', () => {
    const extraction = createValidExtraction();
    const firstItem = extraction.items[0];
    if (!firstItem) {
      throw new Error('Expected first item in test fixture.');
    }
    extraction.items = [firstItem];
    extraction.groups = [{ name: 'preferences', itemIndexes: [0] }];

    expect(() => validateExtraction(SOURCE_TEXT, extraction)).toThrow(
      /missing required explicit mention extraction/i,
    );
  });
});

const V2_TEXT =
  "we were driving and there was ice on the highway today. Egle was driving, she was scared. There's a ton of snow here in Klaipeda. Maybe when I was a kid the seaside had so much snow it was all white dunes.";

const createValidExtractionV2 = (): ExtractionV2 => {
  const egleStart = V2_TEXT.indexOf('Egle');
  const drivingStart = V2_TEXT.indexOf('Egle was driving');
  const klaipedaStart = V2_TEXT.indexOf('Klaipeda');
  const memoryStart = V2_TEXT.indexOf('when I was a kid');
  const memoryEnd = V2_TEXT.indexOf('white dunes') + 'white dunes'.length;

  if (egleStart < 0 || drivingStart < 0 || klaipedaStart < 0 || memoryStart < 0 || memoryEnd < 0) {
    throw new Error('Expected V2 fixture spans to exist in source text.');
  }

  return {
    title: 'Winter drive note',
    noteType: 'personal',
    summary: 'I noticed dangerous winter road conditions while traveling.',
    language: 'en',
    date: null,
    sentiment: 'mixed',
    emotions: [{ emotion: 'fear', intensity: 4 }],
    entities: [
      {
        id: 'ent-egle',
        name: 'Egle',
        type: 'person',
        nameStart: egleStart,
        nameEnd: egleStart + 'Egle'.length,
        evidenceStart: drivingStart,
        evidenceEnd: drivingStart + 'Egle was driving'.length,
        context: 'driving in icy conditions',
        confidence: 0.9,
      },
      {
        id: 'ent-klaipeda',
        name: 'Klaipeda',
        type: 'place',
        nameStart: klaipedaStart,
        nameEnd: klaipedaStart + 'Klaipeda'.length,
        confidence: 0.88,
      },
    ],
    facts: [
      {
        id: 'fact-drive',
        subjectEntityId: 'ent-egle',
        predicate: 'drove_to',
        objectEntityId: 'ent-klaipeda',
        evidenceStart: drivingStart,
        evidenceEnd: drivingStart + 'Egle was driving'.length,
        confidence: 0.86,
      },
      {
        id: 'fact-memory',
        predicate: 'childhood_memory',
        objectText: V2_TEXT.slice(memoryStart, memoryEnd),
        evidenceStart: memoryStart,
        evidenceEnd: memoryEnd,
        confidence: 0.75,
      },
    ],
    relations: [
      {
        fromEntityId: 'ent-egle',
        toEntityId: 'ent-klaipeda',
        type: 'drove_to',
        confidence: 0.82,
      },
    ],
    groups: [
      {
        name: 'people',
        entityIds: ['ent-egle'],
        factIds: ['fact-drive'],
      },
    ],
  };
};

describe('validateExtractionV2', () => {
  it('extracts person as canonical name with evidence span', () => {
    const extraction = validateExtractionV2(V2_TEXT, createValidExtractionV2());
    const egle = extraction.entities.find((entity) => entity.id === 'ent-egle');
    expect(egle?.name).toBe('Egle');
    expect(egle?.type).toBe('person');
    expect(V2_TEXT.slice(egle?.evidenceStart ?? 0, egle?.evidenceEnd ?? 0)).toContain(
      'was driving',
    );
  });

  it('keeps place entity and memory fact grounded', () => {
    const extraction = validateExtractionV2(V2_TEXT, createValidExtractionV2());
    const place = extraction.entities.find((entity) => entity.type === 'place');
    const memoryFact = extraction.facts.find((fact) => fact.id === 'fact-memory');
    expect(place?.name).toBe('Klaipeda');
    expect(memoryFact).toBeDefined();
    expect(V2_TEXT.slice(memoryFact?.evidenceStart ?? 0, memoryFact?.evidenceEnd ?? 0)).toContain(
      'when I was a kid',
    );
  });

  it('normalizes groups into taxonomy buckets instead of one generic group', () => {
    const extraction = validateExtractionV2(V2_TEXT, createValidExtractionV2());
    const names = extraction.groups.map((group) => group.name);
    expect(names).toContain('people');
    expect(names).toContain('places');
    expect(names).toContain('actions');
    expect(names).toContain('memories');
  });

  it('drops malformed relations while keeping extraction valid', () => {
    const extraction = createValidExtractionV2();
    extraction.relations.push({
      fromEntityId: 'missing',
      toEntityId: 'ent-klaipeda',
      type: 'invalid',
      confidence: 0.5,
    });

    const result = validateExtractionV2(V2_TEXT, extraction);
    expect(result.relations).toHaveLength(1);
    expect(result.relations[0]?.fromEntityId).toBe('ent-egle');
  });

  it('normalizes invalid custom groups to taxonomy', () => {
    const extraction = createValidExtractionV2();
    extraction.groups = [
      { name: 'driving events', entityIds: ['ent-egle'], factIds: ['fact-drive'] },
    ];

    const normalized = normalizeGroupsV2(validateExtractionV2(V2_TEXT, extraction));
    expect(normalized.some((group) => group.name === 'actions')).toBe(true);
  });
});

describe('parseAndValidateExtractionOutput', () => {
  it('accepts pure JSON output and returns Extraction', () => {
    const extraction = createValidExtraction();
    const jsonOutput = JSON.stringify(extraction);

    const result = parseAndValidateExtractionOutput(SOURCE_TEXT, jsonOutput);

    expect(result.items.map((item) => item.value)).toEqual([
      'Gemma 2B Q5',
      'llama.cpp',
      'under 3GB RAM',
    ]);
  });

  it('accepts JSON wrapped in extra prefix text', () => {
    const extraction = createValidExtraction();
    const wrappedOutput = `Output:\\n${JSON.stringify(extraction)}`;

    const result = parseAndValidateExtractionOutput(SOURCE_TEXT, wrappedOutput);
    expect(result.title).toBe('Gemma local extract');
  });

  it('rejects non-JSON output', () => {
    expect(() => parseAndValidateExtractionOutput(SOURCE_TEXT, 'not json')).toThrow(
      /not valid json/i,
    );
  });
});
