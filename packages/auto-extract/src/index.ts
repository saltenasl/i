import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import { generateObject, generateText, jsonSchema } from 'ai';
import { buildSystemPromptV2, buildUserPromptV2 } from './prompt.js';
import type { Extraction, ExtractionDebug, FactPerspective, NoteSentiment } from './types.js';
import { parseAndValidateExtractionV2Output, validateExtractionV2 } from './validate.js';

const CLOUD_OUTPUT_TOKENS = 2_000;
const CLOUD_REQUEST_TIMEOUT_MS = 90_000;
const ANTHROPIC_HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const OPENAI_GPT5_MINI_MODEL = 'gpt-5-mini';
const CLOUD_RECOVERY_DIRECTIVE =
  'Return one complete JSON object only. Do not omit required arrays (emotions, entities, facts, relations, groups).';

const extractionV2JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'title',
    'noteType',
    'summary',
    'language',
    'date',
    'sentiment',
    'emotions',
    'entities',
    'facts',
    'relations',
    'todos',
    'groups',
  ],
  properties: {
    title: { type: 'string' },
    noteType: { type: 'string' },
    summary: { type: 'string' },
    language: { type: 'string' },
    date: { type: ['string', 'null'] },
    sentiment: { type: 'string', enum: ['positive', 'negative', 'neutral', 'varied'] },
    emotions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['emotion', 'intensity'],
        properties: {
          emotion: { type: 'string' },
          intensity: { type: 'integer' },
        },
      },
    },
    entities: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'name', 'type', 'evidenceText', 'context', 'confidence'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          type: { type: 'string', enum: ['person', 'org', 'tool', 'place', 'concept', 'event'] },
          evidenceText: { type: ['string', 'null'] },
          context: { type: ['string', 'null'] },
          confidence: { type: 'number' },
        },
      },
    },
    facts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id',
          'ownerEntityId',
          'perspective',
          'subjectEntityId',
          'predicate',
          'objectEntityId',
          'objectText',
          'evidenceText',
          'confidence',
        ],
        properties: {
          id: { type: 'string' },
          ownerEntityId: { type: 'string' },
          perspective: { type: 'string', enum: ['self', 'other', 'uncertain'] },
          subjectEntityId: { type: ['string', 'null'] },
          predicate: { type: 'string' },
          objectEntityId: { type: ['string', 'null'] },
          objectText: { type: ['string', 'null'] },
          evidenceText: { type: 'string' },
          confidence: { type: 'number' },
        },
      },
    },
    relations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['fromEntityId', 'toEntityId', 'type', 'evidenceText', 'confidence'],
        properties: {
          fromEntityId: { type: 'string' },
          toEntityId: { type: 'string' },
          type: { type: 'string' },
          evidenceText: { type: ['string', 'null'] },
          confidence: { type: 'number' },
        },
      },
    },
    todos: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'description', 'assigneeEntityId', 'evidenceText', 'confidence'],
        properties: {
          id: { type: 'string' },
          description: { type: 'string' },
          assigneeEntityId: { type: ['string', 'null'] },
          evidenceText: { type: 'string' },
          confidence: { type: 'number' },
        },
      },
    },
    groups: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'entityIds', 'factIds'],
        properties: {
          name: { type: 'string' },
          entityIds: {
            type: 'array',
            items: { type: 'string' },
          },
          factIds: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    },
  },
} as const;

const hasRequiredFacts = (extraction: Extraction): boolean => {
  return extraction.facts.length > 0;
};

export type ExtractionLaneId = 'google-gemini' | 'anthropic-haiku' | 'openai-gpt5mini';

export type ExtractionLaneResult = {
  laneId: ExtractionLaneId;
  provider: 'google' | 'anthropic' | 'openai';
  model: string;
  status: 'ok' | 'error' | 'skipped';
  durationMs: number;
  extraction?: Extraction;
  debug?: ExtractionDebug;
  errorMessage?: string;
};

type Span = { start: number; end: number };

type ExtractionBundle = {
  extraction: Extraction;
  debug: ExtractionDebug;
};

const NARRATOR_ENTITY_ID = 'ent_self';
const NOTETAKER_TERM = 'notetaker';

const finalizeExtractionBundle = (
  text: string,
  prompt: string,
  rawModelOutput: string,
  validated: Extraction,
  startedAt: number,
  runtime: ExtractionDebug['runtime'],
  fallbackUsed: boolean,
  errors: string[],
): ExtractionBundle => {
  const segmented = deriveSegments(validated, text);
  const extraction = segmented.extraction;

  const debug: ExtractionDebug = {
    inputText: text,
    prompt,
    rawModelOutput,
    validatedExtractionBeforeSegmentation: validated,
    finalExtraction: extraction,
    segmentationTrace: segmented.trace,
    runtime: {
      ...runtime,
      totalMs: Date.now() - startedAt,
    },
    fallbackUsed,
    errors,
  };

  return { extraction, debug };
};

const spanFromRegexMatch = (match: RegExpExecArray | null): Span | null => {
  if (!match || match.index === undefined) {
    return null;
  }

  return {
    start: match.index,
    end: match.index + match[0].length,
  };
};

const findPreferredNarratorSpan = (text: string): Span | null => {
  const singular = spanFromRegexMatch(/\b(?:I|i|me|my|mine)\b/.exec(text));
  if (singular) {
    return singular;
  }

  return spanFromRegexMatch(/\b(?:we|our|us)\b/.exec(text));
};

const isNarratorPronoun = (value: string): boolean => {
  return /^(?:i|me|my|mine|we|our|us)$/i.test(value.trim());
};

const isNarratorEntity = (entity: Extraction['entities'][number]): boolean => {
  if (entity.id === NARRATOR_ENTITY_ID) {
    return true;
  }

  if (isNarratorPronoun(entity.name)) {
    return true;
  }

  const normalizedContext = entity.context?.toLowerCase() ?? '';
  return normalizedContext.includes('narrator') || normalizedContext.includes(NOTETAKER_TERM);
};

const normalizeSelfContext = (context: string | undefined): string => {
  const normalized = (context ?? '').replace(/\bnarrator\b/gi, NOTETAKER_TERM).trim();
  if (!normalized) {
    return NOTETAKER_TERM;
  }
  if (/\bnotetaker\b/i.test(normalized)) {
    return normalized;
  }
  return `${normalized}; ${NOTETAKER_TERM}`;
};

const replaceNarratorWord = (value: string): string => {
  return value.replace(/\bnarrator\b/gi, NOTETAKER_TERM);
};

const ensureNotetakerTerminology = (extraction: Extraction): Extraction => {
  return {
    ...extraction,
    summary: replaceNarratorWord(extraction.summary),
    entities: extraction.entities.map((entity) => ({
      ...entity,
      ...(entity.id === NARRATOR_ENTITY_ID && /^narrator$/i.test(entity.name)
        ? { name: 'I' }
        : { name: replaceNarratorWord(entity.name) }),
      ...(entity.context ? { context: replaceNarratorWord(entity.context) } : {}),
    })),
    facts: extraction.facts.map((fact) => ({
      ...fact,
      predicate: replaceNarratorWord(fact.predicate),
      ...(fact.objectText ? { objectText: replaceNarratorWord(fact.objectText) } : {}),
    })),
  };
};

const nextFactId = (facts: Extraction['facts']): string => {
  const seen = new Set(facts.map((fact) => fact.id));
  let value = facts.length + 1;
  while (seen.has(`fact_${value}`)) {
    value += 1;
  }
  return `fact_${value}`;
};

const deriveFactSentiment = (fact: Extraction['facts'][number], text: string): NoteSentiment => {
  const evidence = text.slice(fact.evidenceStart, fact.evidenceEnd).toLowerCase();
  const predicate = fact.predicate.toLowerCase();
  const object = (fact.objectText ?? '').toLowerCase();
  const blob = `${evidence} ${predicate} ${object}`;

  if (/\b(scared|fear|unsafe|danger|ice|hazard|worry|uncertain|anxious)\b/.test(blob)) {
    return 'negative';
  }

  if (/\b(remember|memory|childhood|idea|reflect|reflection)\b/.test(blob)) {
    return 'varied';
  }

  if (/\b(help|support|called|resolved|safe|good)\b/.test(blob)) {
    return 'positive';
  }

  return 'neutral';
};

const deriveSegments = (
  extraction: Extraction,
  text: string,
): {
  extraction: Extraction;
  trace: ExtractionDebug['segmentationTrace'];
} => {
  const factSentiments = extraction.facts.map((fact) => deriveFactSentiment(fact, text));
  const rollupSentiment =
    factSentiments.length === 0
      ? extraction.sentiment
      : factSentiments.every((value) => value === factSentiments[0])
        ? (factSentiments[0] ?? 'neutral')
        : 'varied';

  return {
    extraction: {
      ...extraction,
      sentiment: rollupSentiment,
      segments: [],
    },
    trace: [],
  };
};

const ensureSelfOwnership = (extraction: Extraction, text: string): Extraction => {
  const seenEntityIds = new Set<string>();
  const dedupedEntities = extraction.entities.filter((entity) => {
    if (seenEntityIds.has(entity.id)) {
      return false;
    }
    seenEntityIds.add(entity.id);
    return true;
  });

  let selfEntity = dedupedEntities.find((entity) => isNarratorEntity(entity));

  const narratorSpan = findPreferredNarratorSpan(text);
  if (!selfEntity && narratorSpan) {
    selfEntity = {
      id: NARRATOR_ENTITY_ID,
      name: text.slice(narratorSpan.start, narratorSpan.end),
      type: 'person',
      nameStart: narratorSpan.start,
      nameEnd: narratorSpan.end,
      context: NOTETAKER_TERM,
      confidence: 0.75,
    };
  }

  const oldSelfId = selfEntity?.id;
  const entities = dedupedEntities.filter((entity) => !isNarratorEntity(entity));
  if (selfEntity) {
    const normalizedSelfSpan =
      narratorSpan ??
      (selfEntity.nameStart >= 0 &&
      selfEntity.nameEnd > selfEntity.nameStart &&
      selfEntity.nameEnd <= text.length
        ? { start: selfEntity.nameStart, end: selfEntity.nameEnd }
        : null);

    entities.push({
      ...selfEntity,
      id: NARRATOR_ENTITY_ID,
      ...(normalizedSelfSpan
        ? {
            name: text.slice(normalizedSelfSpan.start, normalizedSelfSpan.end),
            nameStart: normalizedSelfSpan.start,
            nameEnd: normalizedSelfSpan.end,
          }
        : {}),
      context: normalizeSelfContext(selfEntity.context),
    });
  }

  const remapEntityId = (entityId: string | undefined): string | undefined => {
    if (!entityId) {
      return undefined;
    }

    if (entityId === oldSelfId || entityId === NARRATOR_ENTITY_ID) {
      return NARRATOR_ENTITY_ID;
    }

    return entityId;
  };

  const entityIdSet = new Set(entities.map((entity) => entity.id));

  const facts = extraction.facts.flatMap((fact) => {
    const evidence = text.slice(fact.evidenceStart, fact.evidenceEnd);
    const startsWithFirstPerson = /^\s*(?:i|i'm|ive|i’ve|we|we're|weve|we’ve|me|my|our|us)\b/i.test(
      evidence,
    );
    const startsWithThirdPerson = /^\s*(?:he|she|they|it|his|her|their|egle)\b/i.test(evidence);
    const subjectEntityId = remapEntityId(fact.subjectEntityId);
    let ownerFromSubject: string | undefined = undefined;
    if (subjectEntityId && entityIdSet.has(subjectEntityId)) {
      ownerFromSubject = subjectEntityId;
    }
    const ownerFromFact = remapEntityId(fact.ownerEntityId);
    const objectEntityId = remapEntityId(fact.objectEntityId);

    const shouldForceSelf =
      Boolean(selfEntity) && (fact.perspective === 'self' || startsWithFirstPerson);

    const ownerEntityId = shouldForceSelf
      ? NARRATOR_ENTITY_ID
      : ownerFromFact && entityIdSet.has(ownerFromFact)
        ? ownerFromFact
        : ownerFromSubject;

    if (!ownerEntityId) {
      return [];
    }

    let perspective: FactPerspective = fact.perspective;
    if (ownerEntityId === NARRATOR_ENTITY_ID) {
      perspective = 'self';
    } else if (
      startsWithThirdPerson ||
      (ownerFromSubject && ownerFromSubject !== NARRATOR_ENTITY_ID)
    ) {
      perspective = 'other';
    } else if (perspective !== 'self' && perspective !== 'other') {
      perspective = 'uncertain';
    }

    return [
      {
        ...fact,
        ownerEntityId,
        perspective,
        ...(subjectEntityId ? { subjectEntityId } : {}),
        ...(objectEntityId ? { objectEntityId } : {}),
      },
    ];
  });

  const factIdSet = new Set(facts.map((fact) => fact.id));

  const relations = extraction.relations.flatMap((relation) => {
    const fromEntityId = remapEntityId(relation.fromEntityId) ?? relation.fromEntityId;
    const toEntityId = remapEntityId(relation.toEntityId) ?? relation.toEntityId;

    if (!entityIdSet.has(fromEntityId) || !entityIdSet.has(toEntityId)) {
      return [];
    }

    return [{ ...relation, fromEntityId, toEntityId }];
  });

  const groups = extraction.groups.map((group) => ({
    ...group,
    entityIds: Array.from(
      new Set(group.entityIds.map((entityId) => remapEntityId(entityId) ?? entityId)),
    ),
    factIds: group.factIds.filter((factId) => factIdSet.has(factId)),
  }));

  const segments = extraction.segments.map((segment) => ({
    ...segment,
    entityIds: Array.from(
      new Set(segment.entityIds.map((entityId) => remapEntityId(entityId) ?? entityId)),
    ),
    factIds: segment.factIds.filter((factId) => factIdSet.has(factId)),
  }));

  return {
    ...extraction,
    entities,
    facts,
    relations,
    groups,
    segments,
  };
};

export const postProcessExtractionV2 = (extraction: Extraction, text: string): Extraction => {
  const owned = ensureSelfOwnership(extraction, text);
  const withTodos = enrichTodoFacts(owned, text);
  return ensureNotetakerTerminology(withTodos);
};

const enrichTodoFacts = (extraction: Extraction, text: string): Extraction => {
  const selfEntity = extraction.entities.find((entity) => isNarratorEntity(entity));
  if (!selfEntity) {
    return extraction;
  }

  const facts = [...extraction.facts];
  const todoPattern =
    /\b(?:todo|to do|need to|must|should|remember to|don't forget to|dont forget to)\b[^.!?\n]*/gi;

  for (const match of text.matchAll(todoPattern)) {
    const value = match[0];
    const matchIndex = match.index;
    if (!value || matchIndex === undefined) {
      continue;
    }

    const leadingTrim = value.match(/^\s*/)?.[0].length ?? 0;
    const trailingTrim = value.match(/\s*$/)?.[0].length ?? 0;
    const start = matchIndex + leadingTrim;
    const end = matchIndex + value.length - trailingTrim;

    if (start < 0 || end <= start || end > text.length) {
      continue;
    }

    const overlapExisting = facts.some((fact) => {
      const overlaps = fact.evidenceStart < end && fact.evidenceEnd > start;
      if (!overlaps) {
        return false;
      }
      return /\b(todo|task|need to|remember to|must|should)\b/i.test(
        `${fact.predicate} ${text.slice(fact.evidenceStart, fact.evidenceEnd)}`,
      );
    });

    if (overlapExisting) {
      continue;
    }

    facts.push({
      id: nextFactId(facts),
      ownerEntityId: selfEntity.id,
      perspective: 'self',
      subjectEntityId: selfEntity.id,
      predicate: 'todo',
      objectText: text.slice(start, end).trim(),
      evidenceStart: start,
      evidenceEnd: end,
      confidence: 0.72,
    });
  }

  return {
    ...extraction,
    facts,
  };
};

const laneMeta: Record<
  ExtractionLaneId,
  { provider: ExtractionLaneResult['provider']; model: string; envKey?: string }
> = {
  'google-gemini': {
    provider: 'google',
    model: 'gemini-3-flash-preview',
    envKey: 'GOOGLE_GENERATIVE_AI_API_KEY',
  },
  'anthropic-haiku': {
    provider: 'anthropic',
    model: ANTHROPIC_HAIKU_MODEL,
    envKey: 'ANTHROPIC_API_KEY',
  },
  'openai-gpt5mini': {
    provider: 'openai',
    model: OPENAI_GPT5_MINI_MODEL,
    envKey: 'OPENAI_API_KEY',
  },
};

const runCloudExtractionBundle = async (
  text: string,
  laneId: ExtractionLaneId,
): Promise<ExtractionBundle> => {
  const startedAt = Date.now();
  const prompt = buildUserPromptV2(text);
  const system = buildSystemPromptV2();
  const errors: string[] = [];
  let rawModelOutput = '';
  let validated: Extraction | null = null;
  let fallbackUsed = false;

  const model =
    laneId === 'anthropic-haiku'
      ? anthropic(ANTHROPIC_HAIKU_MODEL)
      : laneId === 'openai-gpt5mini'
        ? openai(OPENAI_GPT5_MINI_MODEL)
        : google('gemini-3-flash-preview');
  const providerOptions =
    laneId === 'openai-gpt5mini'
      ? { openai: { reasoningEffort: 'minimal' as const, textVerbosity: 'low' as const } }
      : undefined;

  try {
    const completion = await generateObject({
      model,
      system,
      prompt,
      maxOutputTokens: CLOUD_OUTPUT_TOKENS,
      timeout: CLOUD_REQUEST_TIMEOUT_MS,
      schemaName: 'extraction',
      schemaDescription: 'Grounded extraction output for a personal note.',
      schema: jsonSchema(extractionV2JsonSchema),
      ...(providerOptions ? { providerOptions } : {}),
    });

    const structuredOutput = completion.object;
    rawModelOutput = JSON.stringify(structuredOutput);

    const parsed = validateExtractionV2(text, structuredOutput);
    validated = postProcessExtractionV2(parsed, text);

    if (!hasRequiredFacts(validated)) {
      throw new Error('Model output had no facts.');
    }
  } catch (error) {
    validated = null;
    errors.push(error instanceof Error ? error.message : String(error));
  }

  if (!validated) {
    fallbackUsed = true;
    try {
      const completion = await generateText({
        model,
        system,
        prompt: [prompt, '', CLOUD_RECOVERY_DIRECTIVE].join('\n'),
        maxOutputTokens: CLOUD_OUTPUT_TOKENS,
        timeout: CLOUD_REQUEST_TIMEOUT_MS,
        ...(providerOptions ? { providerOptions } : {}),
      });

      rawModelOutput = completion.text;
      const parsed = parseAndValidateExtractionV2Output(text, rawModelOutput);
      validated = postProcessExtractionV2(parsed, text);

      if (!hasRequiredFacts(validated)) {
        throw new Error('Model output had no facts.');
      }
    } catch (error) {
      validated = null;
      errors.push(error instanceof Error ? error.message : String(error));
      throw new Error(errors.join(' | '));
    }
  }

  if (!validated) {
    throw new Error('Cloud extraction validation failed with no parsed result.');
  }

  const meta = laneMeta[laneId];
  return finalizeExtractionBundle(
    text,
    [system, '', prompt].join('\n'),
    rawModelOutput,
    validated,
    startedAt,
    {
      modelPath: `${meta.provider}:${meta.model}`,
      serverMode: 'cpu',
      nPredict: CLOUD_OUTPUT_TOKENS,
      totalMs: 0,
    },
    fallbackUsed,
    errors,
  );
};

export async function extractWithDebug(text: string): Promise<{
  extraction: Extraction;
  debug: ExtractionDebug;
}> {
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('extractWithDebug(text) requires a non-empty text string.');
  }

  return runCloudExtractionBundle(text, 'google-gemini');
}

export async function extractCompareLane(
  text: string,
  laneId: ExtractionLaneId,
): Promise<ExtractionLaneResult> {
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('extractCompareLane(text) requires a non-empty text string.');
  }

  const lane = laneMeta[laneId];
  const startedAt = Date.now();

  if (!lane) {
    return {
      laneId,
      provider: 'google',
      model: 'unknown',
      status: 'error',
      durationMs: Date.now() - startedAt,
      errorMessage: `Unknown lane: ${laneId}`,
    };
  }

  if (lane.envKey && !process.env[lane.envKey]) {
    return {
      laneId,
      provider: lane.provider,
      model: lane.model,
      status: 'skipped',
      durationMs: Date.now() - startedAt,
      errorMessage: `Missing ${lane.envKey} environment variable.`,
    };
  }

  try {
    const bundle = await runCloudExtractionBundle(text, laneId);

    return {
      laneId,
      provider: lane.provider,
      model: lane.model,
      status: 'ok',
      durationMs: Date.now() - startedAt,
      extraction: bundle.extraction,
      debug: bundle.debug,
    };
  } catch (error) {
    return {
      laneId,
      provider: lane.provider,
      model: lane.model,
      status: 'error',
      durationMs: Date.now() - startedAt,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function extractCompare(text: string): Promise<{ lanes: ExtractionLaneResult[] }> {
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('extractCompare(text) requires a non-empty text string.');
  }

  const laneOrder: ExtractionLaneId[] = ['google-gemini', 'anthropic-haiku', 'openai-gpt5mini'];
  const lanes = await Promise.all(laneOrder.map((laneId) => extractCompareLane(text, laneId)));
  return { lanes };
}

export async function extractV2(text: string): Promise<Extraction> {
  const result = await extractWithDebug(text);
  return result.extraction;
}

export type { ExtractionDebug, Extraction } from './types.js';
