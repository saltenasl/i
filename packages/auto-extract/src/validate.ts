import type { Extraction } from './types.js';

type RequiredMention = {
  start: number;
  end: number;
  value: string;
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const parseNumber = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
  return value;
};

const parseString = (value: unknown, label: string): string => {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be a string.`);
  }
  return value;
};

const findClosestMatchStart = (text: string, value: string, hintStart: number): number => {
  const matches: number[] = [];
  let fromIndex = 0;

  while (fromIndex <= text.length) {
    const index = text.indexOf(value, fromIndex);
    if (index < 0) {
      break;
    }
    matches.push(index);
    fromIndex = index + 1;
  }

  if (matches.length === 0) {
    return -1;
  }

  let best = matches[0] ?? -1;
  let bestDistance = Math.abs(best - hintStart);

  for (const candidate of matches) {
    const distance = Math.abs(candidate - hintStart);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best;
};

const mentionPatterns: RegExp[] = [
  /\b(?:gemma(?:\s+\d+(?:\.\d+)?b)?(?:\s+q\d+)?)\b/gi,
  /\bllama\.cpp\b/gi,
  /\bgguf\b/gi,
  /\bq\d+\b/gi,
  /\b(?:under|within|less than|<=?)\s+\d+(?:\.\d+)?\s*(?:gb|mb)\s*ram\b/gi,
  /--[a-zA-Z0-9-]+(?:=[^\s]+)?/g,
  /\bconfig(?:uration)?\b/gi,
];

const collectRequiredMentions = (text: string): RequiredMention[] => {
  const mentions: RequiredMention[] = [];
  const seen = new Set<string>();

  for (const pattern of mentionPatterns) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const value = match[0];
      const start = match.index;
      if (start === undefined) {
        continue;
      }

      const end = start + value.length;
      const key = `${start}:${end}:${value.toLowerCase()}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      mentions.push({ start, end, value });
    }
  }

  return mentions;
};

const assertMentionCoverage = (text: string, extraction: Extraction): void => {
  const requiredMentions = collectRequiredMentions(text);

  for (const mention of requiredMentions) {
    const covered = extraction.items.some((item) => {
      return item.start <= mention.start && item.end >= mention.end;
    });

    if (!covered) {
      throw new Error(`Missing required explicit mention extraction: "${mention.value}".`);
    }
  }
};

export const validateExtraction = (text: string, raw: unknown): Extraction => {
  if (!isObject(raw)) {
    throw new Error('Extraction must be an object.');
  }

  const title = parseString(raw.title, 'title');
  if (title.length > 25) {
    throw new Error('title must be 25 characters or fewer.');
  }

  const memoryRaw = raw.memory;
  const memory = memoryRaw === undefined ? undefined : parseString(memoryRaw, 'memory');

  const itemsRaw = raw.items;
  if (!Array.isArray(itemsRaw)) {
    throw new Error('items must be an array.');
  }

  const items = itemsRaw.flatMap((itemRaw, index) => {
    if (!isObject(itemRaw)) {
      throw new Error(`items[${index}] must be an object.`);
    }

    const label = parseString(itemRaw.label, `items[${index}].label`);
    const value = parseString(itemRaw.value, `items[${index}].value`);
    let start = parseNumber(itemRaw.start, `items[${index}].start`);
    let end = parseNumber(itemRaw.end, `items[${index}].end`);
    const confidence = parseNumber(itemRaw.confidence, `items[${index}].confidence`);

    if (!Number.isInteger(start) || !Number.isInteger(end)) {
      throw new Error(`items[${index}] start/end must be integers.`);
    }

    if (start < 0 || end <= start || end > text.length) {
      throw new Error(`items[${index}] has invalid start/end bounds.`);
    }

    if (confidence < 0 || confidence > 1) {
      throw new Error(`items[${index}].confidence must be in [0,1].`);
    }

    const grounded = text.slice(start, end);
    if (value !== grounded) {
      const repairedStart = findClosestMatchStart(text, value, start);
      if (repairedStart < 0) {
        return [];
      }
      start = repairedStart;
      end = repairedStart + value.length;
    }

    return [
      {
        label,
        value,
        start,
        end,
        confidence,
      },
    ];
  });

  const groupsRaw = raw.groups;
  if (!Array.isArray(groupsRaw)) {
    throw new Error('groups must be an array.');
  }

  const groups = groupsRaw.map((groupRaw, index) => {
    if (!isObject(groupRaw)) {
      throw new Error(`groups[${index}] must be an object.`);
    }

    const name = parseString(groupRaw.name, `groups[${index}].name`);
    const itemIndexesRaw = groupRaw.itemIndexes;

    if (!Array.isArray(itemIndexesRaw)) {
      throw new Error(`groups[${index}].itemIndexes must be an array.`);
    }

    const itemIndexes = itemIndexesRaw.flatMap((itemIndex, itemIndexPos) => {
      const parsedIndex = parseNumber(itemIndex, `groups[${index}].itemIndexes[${itemIndexPos}]`);

      if (!Number.isInteger(parsedIndex)) {
        throw new Error(`groups[${index}].itemIndexes[${itemIndexPos}] must be an integer.`);
      }

      if (parsedIndex < 0 || parsedIndex >= items.length) {
        return [];
      }

      return [parsedIndex];
    });

    return {
      name,
      itemIndexes,
    };
  });

  const extraction: Extraction = {
    title,
    items,
    groups,
    ...(memory === undefined ? {} : { memory }),
  };

  assertMentionCoverage(text, extraction);

  return extraction;
};

export const parseAndValidateExtractionOutput = (text: string, rawOutput: string): Extraction => {
  const trimmed = rawOutput.trim();
  let parsed: unknown;

  const findFirstJsonObject = (input: string): string | null => {
    const startIndex = input.indexOf('{');
    if (startIndex < 0) {
      return null;
    }

    let depth = 0;
    let inString = false;
    let escaping = false;

    for (let index = startIndex; index < input.length; index += 1) {
      const ch = input[index];

      if (inString) {
        if (escaping) {
          escaping = false;
          continue;
        }

        if (ch === '\\\\') {
          escaping = true;
          continue;
        }

        if (ch === '"') {
          inString = false;
        }
        continue;
      }

      if (ch === '"') {
        inString = true;
        continue;
      }

      if (ch === '{') {
        depth += 1;
        continue;
      }

      if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          return input.slice(startIndex, index + 1);
        }
      }
    }

    return null;
  };

  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    const candidate = findFirstJsonObject(trimmed);
    if (candidate) {
      try {
        parsed = JSON.parse(candidate);
      } catch {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Model output is not valid JSON: ${message}. Raw output: ${trimmed.slice(0, 1200)}`,
        );
      }
    } else {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Model output is not valid JSON: ${message}. Raw output: ${trimmed.slice(0, 1200)}`,
      );
    }
  }

  return validateExtraction(text, parsed);
};
