import { describe, expect, it } from 'vitest';
import type { Extraction } from './types.js';
import { parseAndValidateExtractionOutput, validateExtraction } from './validate.js';

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

  it('rejects out-of-range indices', () => {
    const extraction = createValidExtraction();
    const firstItem = extraction.items[0];
    if (!firstItem) {
      throw new Error('Expected first item in test fixture.');
    }
    extraction.items[0] = {
      ...firstItem,
      start: -1,
    };

    expect(() => validateExtraction(SOURCE_TEXT, extraction)).toThrow(/invalid start\/end/i);
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
