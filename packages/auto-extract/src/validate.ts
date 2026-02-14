import type {
  EntityType,
  Extraction,
  ExtractionV2,
  FactPerspective,
  NoteSentiment,
} from './types.js';

type RequiredMention = {
  start: number;
  end: number;
  value: string;
};

const TAXONOMY = [
  'people',
  'places',
  'events',
  'actions',
  'emotions',
  'memories',
  'work',
  'tasks',
  'ideas',
  'constraints',
  'tools',
  'organizations',
  'concepts',
] as const;

type TaxonomyName = (typeof TAXONOMY)[number];

const sentimentValues: NoteSentiment[] = ['positive', 'negative', 'neutral', 'varied'];
const perspectiveValues: FactPerspective[] = ['self', 'other', 'uncertain'];
const entityTypeValues: EntityType[] = ['person', 'org', 'tool', 'place', 'concept', 'event'];

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

const parseOptionalString = (value: unknown, label: string): string | undefined => {
  if (value === undefined) {
    return undefined;
  }
  return parseString(value, label);
};

const parseJsonObjectFromOutput = (rawOutput: string): unknown => {
  const trimmed = rawOutput.trim();

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

        if (ch === '\\') {
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
    return JSON.parse(trimmed);
  } catch (error) {
    const candidate = findFirstJsonObject(trimmed);
    if (!candidate) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Model output is not valid JSON: ${message}. Raw output: ${trimmed.slice(0, 1200)}`,
      );
    }

    try {
      return JSON.parse(candidate);
    } catch {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Model output is not valid JSON: ${message}. Raw output: ${trimmed.slice(0, 1200)}`,
      );
    }
  }
};

const findClosestMatchStart = (text: string, value: string, hintStart: number): number => {
  if (!value) {
    return -1;
  }

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

const normalizeSpan = (
  text: string,
  value: string,
  start: number,
  end: number,
): { start: number; end: number } | null => {
  if (
    !Number.isInteger(start) ||
    !Number.isInteger(end) ||
    start < 0 ||
    end <= start ||
    end > text.length
  ) {
    const repairedStart = findClosestMatchStart(text, value, Math.max(0, start));
    if (repairedStart < 0) {
      return null;
    }

    return {
      start: repairedStart,
      end: repairedStart + value.length,
    };
  }

  if (text.slice(start, end) === value) {
    return { start, end };
  }

  const repairedStart = findClosestMatchStart(text, value, start);
  if (repairedStart < 0) {
    return null;
  }

  return {
    start: repairedStart,
    end: repairedStart + value.length,
  };
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
    const covered = extraction.items.some(
      (item) => item.start <= mention.start && item.end >= mention.end,
    );

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

  const memory = parseOptionalString(raw.memory, 'memory');

  if (!Array.isArray(raw.items)) {
    throw new Error('items must be an array.');
  }

  const items = raw.items.flatMap((itemRaw, index) => {
    if (!isObject(itemRaw)) {
      throw new Error(`items[${index}] must be an object.`);
    }

    const label = parseString(itemRaw.label, `items[${index}].label`);
    const value = parseString(itemRaw.value, `items[${index}].value`);
    const start = parseNumber(itemRaw.start, `items[${index}].start`);
    const end = parseNumber(itemRaw.end, `items[${index}].end`);
    const confidence = parseNumber(itemRaw.confidence, `items[${index}].confidence`);

    if (confidence < 0 || confidence > 1) {
      throw new Error(`items[${index}].confidence must be in [0,1].`);
    }

    const span = normalizeSpan(text, value, start, end);
    if (!span) {
      return [];
    }

    return [
      {
        label,
        value,
        start: span.start,
        end: span.end,
        confidence,
      },
    ];
  });

  if (!Array.isArray(raw.groups)) {
    throw new Error('groups must be an array.');
  }

  const groups = raw.groups.map((groupRaw, index) => {
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

    return { name, itemIndexes };
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

const toTaxonomyName = (name: string): TaxonomyName | null => {
  const normalized = name.toLowerCase();

  if (normalized.includes('people') || normalized.includes('person')) {
    return 'people';
  }
  if (normalized.includes('place') || normalized.includes('location')) {
    return 'places';
  }
  if (normalized.includes('event')) {
    return 'events';
  }
  if (
    normalized.includes('action') ||
    normalized.includes('call') ||
    normalized.includes('drive')
  ) {
    return 'actions';
  }
  if (normalized.includes('emotion') || normalized.includes('feeling')) {
    return 'emotions';
  }
  if (
    normalized.includes('memory') ||
    normalized.includes('childhood') ||
    normalized.includes('reflection')
  ) {
    return 'memories';
  }
  if (normalized.includes('work') || normalized.includes('job')) {
    return 'work';
  }
  if (normalized.includes('task') || normalized.includes('todo')) {
    return 'tasks';
  }
  if (normalized.includes('idea')) {
    return 'ideas';
  }
  if (normalized.includes('constraint') || normalized.includes('limitation')) {
    return 'constraints';
  }
  if (normalized.includes('tool')) {
    return 'tools';
  }
  if (normalized.includes('org') || normalized.includes('organization')) {
    return 'organizations';
  }
  if (normalized.includes('concept')) {
    return 'concepts';
  }

  return null;
};

const entityTypeToGroup = (type: EntityType): TaxonomyName => {
  if (type === 'person') {
    return 'people';
  }
  if (type === 'place') {
    return 'places';
  }
  if (type === 'tool') {
    return 'tools';
  }
  if (type === 'org') {
    return 'organizations';
  }
  if (type === 'concept') {
    return 'concepts';
  }
  return 'events';
};

const predicateToGroup = (predicate: string): TaxonomyName => {
  const normalized = predicate.toLowerCase();
  if (
    normalized.includes('feel') ||
    normalized.includes('scared') ||
    normalized.includes('emotion')
  ) {
    return 'emotions';
  }
  if (
    normalized.includes('remember') ||
    normalized.includes('childhood') ||
    normalized.includes('memory')
  ) {
    return 'memories';
  }
  if (normalized.includes('task') || normalized.includes('todo')) {
    return 'tasks';
  }
  if (normalized.includes('work')) {
    return 'work';
  }
  if (normalized.includes('idea')) {
    return 'ideas';
  }
  return 'actions';
};

export const normalizeGroupsV2 = (extraction: ExtractionV2): ExtractionV2['groups'] => {
  const map = new Map<TaxonomyName, { entityIds: Set<string>; factIds: Set<string> }>();

  const ensureGroup = (name: TaxonomyName) => {
    if (!map.has(name)) {
      map.set(name, { entityIds: new Set<string>(), factIds: new Set<string>() });
    }
    return map.get(name);
  };

  for (const rawGroup of extraction.groups) {
    const normalizedName = toTaxonomyName(rawGroup.name);
    if (!normalizedName) {
      continue;
    }

    const group = ensureGroup(normalizedName);
    if (!group) {
      continue;
    }

    for (const entityId of rawGroup.entityIds) {
      group.entityIds.add(entityId);
    }
    for (const factId of rawGroup.factIds) {
      group.factIds.add(factId);
    }
  }

  for (const entity of extraction.entities) {
    const group = ensureGroup(entityTypeToGroup(entity.type));
    if (!group) {
      continue;
    }
    group.entityIds.add(entity.id);
  }

  for (const fact of extraction.facts) {
    const group = ensureGroup(predicateToGroup(fact.predicate));
    if (!group) {
      continue;
    }
    group.factIds.add(fact.id);
  }

  return TAXONOMY.flatMap((name) => {
    const group = map.get(name);
    if (!group) {
      return [];
    }

    if (group.entityIds.size === 0 && group.factIds.size === 0) {
      return [];
    }

    return [
      {
        name,
        entityIds: Array.from(group.entityIds),
        factIds: Array.from(group.factIds),
      },
    ];
  });
};

const normalizeSentiment = (value: string): NoteSentiment => {
  if (value === 'mixed') {
    return 'varied';
  }
  if (!sentimentValues.includes(value as NoteSentiment)) {
    return 'neutral';
  }
  return value as NoteSentiment;
};

export const validateExtractionV2 = (text: string, raw: unknown): ExtractionV2 => {
  if (!isObject(raw)) {
    throw new Error('ExtractionV2 must be an object.');
  }

  const title = parseString(raw.title, 'title');
  if (title.length > 25) {
    throw new Error('title must be 25 characters or fewer.');
  }

  const noteType = parseString(raw.noteType, 'noteType');
  const summary = parseString(raw.summary, 'summary');
  const language = parseString(raw.language, 'language');

  const dateRaw = raw.date;
  const date = dateRaw === null ? null : (parseOptionalString(dateRaw, 'date') ?? null);

  const sentimentRaw = parseString(raw.sentiment, 'sentiment');
  const sentiment = normalizeSentiment(sentimentRaw);

  const emotionsRaw = raw.emotions;
  if (!Array.isArray(emotionsRaw)) {
    throw new Error('emotions must be an array.');
  }

  const emotions = emotionsRaw.flatMap((emotionRaw, index) => {
    if (!isObject(emotionRaw)) {
      return [];
    }

    const emotion = parseString(emotionRaw.emotion, `emotions[${index}].emotion`);
    const intensity = parseNumber(emotionRaw.intensity, `emotions[${index}].intensity`);
    if (!Number.isInteger(intensity) || intensity < 1 || intensity > 5) {
      return [];
    }

    return [{ emotion, intensity: intensity as 1 | 2 | 3 | 4 | 5 }];
  });

  if (!Array.isArray(raw.entities)) {
    throw new Error('entities must be an array.');
  }

  const entities = raw.entities.flatMap((entityRaw, index) => {
    if (!isObject(entityRaw)) {
      return [];
    }

    const id = parseString(entityRaw.id, `entities[${index}].id`);
    const name = parseString(entityRaw.name, `entities[${index}].name`);
    const typeRaw = parseString(entityRaw.type, `entities[${index}].type`);
    if (!entityTypeValues.includes(typeRaw as EntityType)) {
      return [];
    }

    const nameStart = parseNumber(entityRaw.nameStart, `entities[${index}].nameStart`);
    const nameEnd = parseNumber(entityRaw.nameEnd, `entities[${index}].nameEnd`);
    const confidence = parseNumber(entityRaw.confidence, `entities[${index}].confidence`);

    if (confidence < 0 || confidence > 1) {
      return [];
    }

    const normalizedNameSpan = normalizeSpan(text, name, nameStart, nameEnd);
    if (!normalizedNameSpan) {
      return [];
    }

    const context = parseOptionalString(entityRaw.context, `entities[${index}].context`);

    let evidenceStart = entityRaw.evidenceStart as number | undefined;
    let evidenceEnd = entityRaw.evidenceEnd as number | undefined;

    if (evidenceStart !== undefined && evidenceEnd !== undefined) {
      if (!Number.isFinite(evidenceStart) || !Number.isFinite(evidenceEnd)) {
        evidenceStart = undefined;
        evidenceEnd = undefined;
      }

      if (
        evidenceStart !== undefined &&
        evidenceEnd !== undefined &&
        (!Number.isInteger(evidenceStart) ||
          !Number.isInteger(evidenceEnd) ||
          evidenceStart < 0 ||
          evidenceEnd <= evidenceStart ||
          evidenceEnd > text.length)
      ) {
        evidenceStart = undefined;
        evidenceEnd = undefined;
      }
    }

    return [
      {
        id,
        name,
        type: typeRaw as EntityType,
        nameStart: normalizedNameSpan.start,
        nameEnd: normalizedNameSpan.end,
        ...(evidenceStart === undefined || evidenceEnd === undefined
          ? {}
          : { evidenceStart, evidenceEnd }),
        ...(context ? { context } : {}),
        confidence,
      },
    ];
  });

  const entityIdSet = new Set(entities.map((entity) => entity.id));

  if (!Array.isArray(raw.facts)) {
    throw new Error('facts must be an array.');
  }

  const facts = raw.facts.flatMap((factRaw, index) => {
    if (!isObject(factRaw)) {
      return [];
    }

    const id = parseString(factRaw.id, `facts[${index}].id`);
    const predicate = parseString(factRaw.predicate, `facts[${index}].predicate`);
    const evidenceStart = parseNumber(factRaw.evidenceStart, `facts[${index}].evidenceStart`);
    const evidenceEnd = parseNumber(factRaw.evidenceEnd, `facts[${index}].evidenceEnd`);
    const confidence = parseNumber(factRaw.confidence, `facts[${index}].confidence`);

    if (
      !Number.isInteger(evidenceStart) ||
      !Number.isInteger(evidenceEnd) ||
      evidenceStart < 0 ||
      evidenceEnd <= evidenceStart ||
      evidenceEnd > text.length
    ) {
      return [];
    }

    if (confidence < 0 || confidence > 1) {
      return [];
    }

    const ownerEntityIdRaw = parseOptionalString(
      factRaw.ownerEntityId,
      `facts[${index}].ownerEntityId`,
    );
    const perspectiveRaw = parseOptionalString(factRaw.perspective, `facts[${index}].perspective`);

    const subjectEntityIdRaw = parseOptionalString(
      factRaw.subjectEntityId,
      `facts[${index}].subjectEntityId`,
    );
    const objectEntityIdRaw = parseOptionalString(
      factRaw.objectEntityId,
      `facts[${index}].objectEntityId`,
    );
    const objectText = parseOptionalString(factRaw.objectText, `facts[${index}].objectText`);
    const segmentId = parseOptionalString(factRaw.segmentId, `facts[${index}].segmentId`);

    const subjectEntityId =
      subjectEntityIdRaw && entityIdSet.has(subjectEntityIdRaw) ? subjectEntityIdRaw : undefined;
    const objectEntityId =
      objectEntityIdRaw && entityIdSet.has(objectEntityIdRaw) ? objectEntityIdRaw : undefined;

    const ownerEntityId =
      ownerEntityIdRaw && entityIdSet.has(ownerEntityIdRaw) ? ownerEntityIdRaw : subjectEntityId;

    const perspective =
      perspectiveRaw && perspectiveValues.includes(perspectiveRaw as FactPerspective)
        ? (perspectiveRaw as FactPerspective)
        : 'uncertain';

    if (!ownerEntityId) {
      return [];
    }

    return [
      {
        id,
        ownerEntityId,
        perspective,
        ...(segmentId ? { segmentId } : {}),
        predicate,
        ...(subjectEntityId ? { subjectEntityId } : {}),
        ...(objectEntityId ? { objectEntityId } : {}),
        ...(objectText ? { objectText } : {}),
        evidenceStart,
        evidenceEnd,
        confidence,
      },
    ];
  });

  const factIdSet = new Set(facts.map((fact) => fact.id));

  if (!Array.isArray(raw.relations)) {
    throw new Error('relations must be an array.');
  }

  const relations = raw.relations.flatMap((relationRaw, index) => {
    if (!isObject(relationRaw)) {
      return [];
    }

    const fromEntityId = parseString(relationRaw.fromEntityId, `relations[${index}].fromEntityId`);
    const toEntityId = parseString(relationRaw.toEntityId, `relations[${index}].toEntityId`);
    const type = parseString(relationRaw.type, `relations[${index}].type`);
    const confidence = parseNumber(relationRaw.confidence, `relations[${index}].confidence`);

    if (!entityIdSet.has(fromEntityId) || !entityIdSet.has(toEntityId)) {
      return [];
    }

    if (confidence < 0 || confidence > 1) {
      return [];
    }

    const evidenceStartRaw = relationRaw.evidenceStart;
    const evidenceEndRaw = relationRaw.evidenceEnd;

    let evidenceStart: number | undefined;
    let evidenceEnd: number | undefined;

    if (evidenceStartRaw !== undefined && evidenceEndRaw !== undefined) {
      evidenceStart = parseNumber(evidenceStartRaw, `relations[${index}].evidenceStart`);
      evidenceEnd = parseNumber(evidenceEndRaw, `relations[${index}].evidenceEnd`);

      if (
        !Number.isInteger(evidenceStart) ||
        !Number.isInteger(evidenceEnd) ||
        evidenceStart < 0 ||
        evidenceEnd <= evidenceStart ||
        evidenceEnd > text.length
      ) {
        evidenceStart = undefined;
        evidenceEnd = undefined;
      }
    }

    return [
      {
        fromEntityId,
        toEntityId,
        type,
        ...(evidenceStart === undefined || evidenceEnd === undefined
          ? {}
          : { evidenceStart, evidenceEnd }),
        confidence,
      },
    ];
  });

  const rawGroups = Array.isArray(raw.groups)
    ? raw.groups.flatMap((groupRaw, index) => {
        if (!isObject(groupRaw)) {
          return [];
        }

        const name = parseString(groupRaw.name, `groups[${index}].name`);
        const entityIdsRaw = groupRaw.entityIds;
        const factIdsRaw = groupRaw.factIds;
        if (!Array.isArray(entityIdsRaw) || !Array.isArray(factIdsRaw)) {
          return [];
        }

        const entityIds = entityIdsRaw.flatMap((entityIdRaw) => {
          if (typeof entityIdRaw !== 'string') {
            return [];
          }
          if (!entityIdSet.has(entityIdRaw)) {
            return [];
          }
          return [entityIdRaw];
        });

        const factIds = factIdsRaw.flatMap((factIdRaw) => {
          if (typeof factIdRaw !== 'string') {
            return [];
          }
          if (!factIdSet.has(factIdRaw)) {
            return [];
          }
          return [factIdRaw];
        });

        return [{ name, entityIds, factIds }];
      })
    : [];

  const rawSegments = Array.isArray(raw.segments)
    ? raw.segments.flatMap((segmentRaw, index) => {
        if (!isObject(segmentRaw)) {
          return [];
        }

        const id = parseString(segmentRaw.id, `segments[${index}].id`);
        const start = parseNumber(segmentRaw.start, `segments[${index}].start`);
        const end = parseNumber(segmentRaw.end, `segments[${index}].end`);
        const summary = parseString(segmentRaw.summary, `segments[${index}].summary`);
        const sentimentValue = normalizeSentiment(
          parseString(segmentRaw.sentiment, `segments[${index}].sentiment`),
        );

        if (
          !Number.isInteger(start) ||
          !Number.isInteger(end) ||
          start < 0 ||
          end <= start ||
          end > text.length
        ) {
          return [];
        }

        const entityIdsRaw = segmentRaw.entityIds;
        const factIdsRaw = segmentRaw.factIds;
        const relationIndexesRaw = segmentRaw.relationIndexes;

        if (
          !Array.isArray(entityIdsRaw) ||
          !Array.isArray(factIdsRaw) ||
          !Array.isArray(relationIndexesRaw)
        ) {
          return [];
        }

        const entityIds = entityIdsRaw.flatMap((entityIdRaw) => {
          if (typeof entityIdRaw !== 'string' || !entityIdSet.has(entityIdRaw)) {
            return [];
          }
          return [entityIdRaw];
        });

        const factIds = factIdsRaw.flatMap((factIdRaw) => {
          if (typeof factIdRaw !== 'string' || !factIdSet.has(factIdRaw)) {
            return [];
          }
          return [factIdRaw];
        });

        const relationIndexes = relationIndexesRaw.flatMap((value, relationIndex) => {
          const parsed = parseNumber(value, `segments[${index}].relationIndexes[${relationIndex}]`);
          if (!Number.isInteger(parsed) || parsed < 0 || parsed >= relations.length) {
            return [];
          }
          return [parsed];
        });

        return [
          {
            id,
            start,
            end,
            summary,
            sentiment: sentimentValue,
            entityIds,
            factIds,
            relationIndexes,
          },
        ];
      })
    : [];

  const extraction: ExtractionV2 = {
    title,
    noteType,
    summary,
    language,
    date,
    sentiment,
    emotions,
    entities,
    facts,
    relations,
    groups: rawGroups,
    segments: rawSegments,
  };

  return {
    ...extraction,
    groups: normalizeGroupsV2(extraction),
  };
};

export const parseAndValidateExtractionOutput = (text: string, rawOutput: string): Extraction => {
  return validateExtraction(text, parseJsonObjectFromOutput(rawOutput));
};

export const parseAndValidateExtractionV2Output = (
  text: string,
  rawOutput: string,
): ExtractionV2 => {
  return validateExtractionV2(text, parseJsonObjectFromOutput(rawOutput));
};
