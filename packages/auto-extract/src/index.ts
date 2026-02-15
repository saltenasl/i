import { type ChildProcess, spawn } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { generateObject, generateText, jsonSchema } from 'ai';
import { ensureAssets } from './assets.js';
import { buildPromptV2, buildSystemPromptV2, buildUserPromptV2 } from './prompt.js';
import type { ExtractionDebug, ExtractionV2, FactPerspective, NoteSentiment } from './types.js';
import { parseAndValidateExtractionV2Output, validateExtractionV2 } from './validate.js';

const FAST_OUTPUT_TOKENS = 400;
const CLOUD_OUTPUT_TOKENS = 1_200;
const SERVER_READY_TIMEOUT_MS = 45_000;
const SERVER_REQUEST_TIMEOUT_MS = 20_000;
const CLOUD_REQUEST_TIMEOUT_MS = 30_000;
const ANTHROPIC_HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const OPENAI_GPT5_MINI_MODEL = 'gpt-5-mini';
const LOCAL_RECOVERY_DIRECTIVE =
  'CRITICAL: Return exactly one complete JSON object. Ensure emotions/entities/facts/relations/groups are JSON arrays.';
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
        required: [
          'id',
          'name',
          'type',
          'nameStart',
          'nameEnd',
          'evidenceStart',
          'evidenceEnd',
          'context',
          'confidence',
        ],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          type: { type: 'string', enum: ['person', 'org', 'tool', 'place', 'concept', 'event'] },
          nameStart: { type: 'integer' },
          nameEnd: { type: 'integer' },
          evidenceStart: { type: ['integer', 'null'] },
          evidenceEnd: { type: ['integer', 'null'] },
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
          'evidenceStart',
          'evidenceEnd',
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
          evidenceStart: { type: 'integer' },
          evidenceEnd: { type: 'integer' },
          confidence: { type: 'number' },
        },
      },
    },
    relations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'fromEntityId',
          'toEntityId',
          'type',
          'evidenceStart',
          'evidenceEnd',
          'confidence',
        ],
        properties: {
          fromEntityId: { type: 'string' },
          toEntityId: { type: 'string' },
          type: { type: 'string' },
          evidenceStart: { type: ['integer', 'null'] },
          evidenceEnd: { type: ['integer', 'null'] },
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

const hasRequiredFacts = (extraction: ExtractionV2): boolean => {
  return extraction.facts.length > 0;
};

export type ExtractionLaneId = 'local-llama' | 'anthropic-haiku' | 'openai-gpt5mini';

export type ExtractionLaneResult = {
  laneId: ExtractionLaneId;
  provider: 'local' | 'anthropic' | 'openai';
  model: string;
  status: 'ok' | 'error' | 'skipped';
  durationMs: number;
  extractionV2?: ExtractionV2;
  debug?: ExtractionDebug;
  errorMessage?: string;
};

type Span = { start: number; end: number };

type LlamaServerRuntime = {
  baseUrl: string;
  child: ChildProcess;
  mode: 'metal' | 'cpu';
  modelPath: string;
};

type ExtractionBundle = {
  extractionV2: ExtractionV2;
  debug: ExtractionDebug;
};

const NARRATOR_ENTITY_ID = 'ent_self';
const NOTETAKER_TERM = 'notetaker';

let assetsPromise: ReturnType<typeof ensureAssets> | undefined;
let runtimePromise: Promise<LlamaServerRuntime> | undefined;

const getAssets = async () => {
  assetsPromise ??= ensureAssets();
  return assetsPromise;
};

const isMetalFailure = (message: string): boolean => {
  const lowered = message.toLowerCase();
  return (
    lowered.includes('ggml_metal_init') ||
    lowered.includes('failed to create command queue') ||
    lowered.includes('failed to initialize  backend') ||
    lowered.includes('failed to initialize backend') ||
    lowered.includes('invalid device')
  );
};

const getFreePort = async (): Promise<number> => {
  return await new Promise<number>((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to allocate local port.')));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
};

const wait = async (ms: number): Promise<void> => {
  await new Promise<void>((resolve) => setTimeout(resolve, ms));
};

const isServerHealthy = async (baseUrl: string): Promise<boolean> => {
  try {
    const response = await fetch(`${baseUrl}/health`, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
};

const startServer = async (
  serverPath: string,
  modelPath: string,
  mode: 'metal' | 'cpu',
): Promise<LlamaServerRuntime> => {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const args = [
    '-m',
    modelPath,
    '--host',
    '127.0.0.1',
    '--port',
    String(port),
    '--ctx-size',
    '4096',
    '--threads',
    String(Math.max(1, os.availableParallelism() - 2)),
    '--n-gpu-layers',
    mode === 'metal' ? 'all' : '0',
  ];

  if (mode === 'cpu') {
    args.push('--device', 'none');
  }

  const child = spawn(serverPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  child.unref();
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');

  let stderr = '';
  let startupError: Error | null = null;

  child.stderr.on('data', (chunk: string) => {
    stderr += chunk;
  });

  child.on('error', (error) => {
    startupError = new Error(`Failed to start llama-server: ${error.message}`);
  });

  child.on('close', (code, signal) => {
    if (!startupError) {
      const excerpt = stderr.trim().slice(0, 1200);
      startupError = new Error(
        `llama-server exited during startup (code: ${code}, signal: ${signal}). ${excerpt}`,
      );
    }
  });

  const startedAt = Date.now();
  while (Date.now() - startedAt < SERVER_READY_TIMEOUT_MS) {
    if (startupError) {
      throw startupError;
    }

    if (await isServerHealthy(baseUrl)) {
      child.stdout.removeAllListeners('data');
      child.stderr.removeAllListeners('data');
      child.stdout.destroy();
      child.stderr.destroy();
      return { baseUrl, child, mode, modelPath };
    }

    await wait(150);
  }

  child.kill('SIGTERM');
  const excerpt = stderr.trim().slice(0, 1200);
  throw new Error(`Timed out waiting for llama-server readiness. ${excerpt}`);
};

const getRuntime = async (): Promise<LlamaServerRuntime> => {
  runtimePromise ??= (async () => {
    const assets = await getAssets();

    try {
      return await startServer(assets.llamaServerPath, assets.modelPath, 'metal');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!isMetalFailure(message)) {
        throw error;
      }

      return await startServer(assets.llamaServerPath, assets.modelPath, 'cpu');
    }
  })();

  return runtimePromise;
};

const stopRuntime = async (): Promise<void> => {
  if (!runtimePromise) {
    return;
  }

  try {
    const runtime = await runtimePromise;
    runtime.child.kill('SIGTERM');
  } finally {
    runtimePromise = undefined;
  }
};

let exitHandlersRegistered = false;
const ensureExitHandlers = (): void => {
  if (exitHandlersRegistered) {
    return;
  }

  exitHandlersRegistered = true;

  process.on('beforeExit', () => {
    void stopRuntime();
  });

  process.on('SIGINT', () => {
    void stopRuntime();
  });

  process.on('SIGTERM', () => {
    void stopRuntime();
  });
};

const readCompletionText = (responseBody: unknown): string => {
  if (typeof responseBody !== 'object' || responseBody === null) {
    throw new Error('Unexpected llama-server response shape.');
  }

  const body = responseBody as Record<string, unknown>;

  if (typeof body.content === 'string') {
    return body.content;
  }

  const choices = body.choices;
  if (Array.isArray(choices)) {
    const firstChoice = choices[0];
    if (firstChoice && typeof firstChoice === 'object') {
      const text = (firstChoice as Record<string, unknown>).text;
      if (typeof text === 'string') {
        return text;
      }

      const message = (firstChoice as Record<string, unknown>).message;
      if (message && typeof message === 'object') {
        const content = (message as Record<string, unknown>).content;
        if (typeof content === 'string') {
          return content;
        }
      }
    }
  }

  throw new Error('Unable to find completion text in llama-server response.');
};

const readChatCompletionText = (responseBody: unknown): string => {
  if (typeof responseBody !== 'object' || responseBody === null) {
    throw new Error('Unexpected llama-server chat response shape.');
  }

  const body = responseBody as Record<string, unknown>;
  const choices = body.choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error('llama-server chat response has no choices.');
  }

  const firstChoice = choices[0];
  if (!firstChoice || typeof firstChoice !== 'object') {
    throw new Error('llama-server chat first choice is invalid.');
  }

  const message = (firstChoice as Record<string, unknown>).message;
  if (!message || typeof message !== 'object') {
    throw new Error('llama-server chat choice has no message.');
  }

  const content = (message as Record<string, unknown>).content;
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    const joined = content
      .flatMap((part) => {
        if (!part || typeof part !== 'object') {
          return [];
        }
        const text = (part as Record<string, unknown>).text;
        return typeof text === 'string' ? [text] : [];
      })
      .join('');
    if (joined) {
      return joined;
    }
  }

  throw new Error('Unable to find content in llama-server chat response.');
};

const runLlamaCompletion = async (prompt: string, nPredict: number): Promise<string> => {
  ensureExitHandlers();
  const runtime = await getRuntime();

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, SERVER_REQUEST_TIMEOUT_MS);

  try {
    // Prefer OpenAI-compatible chat completions to improve instruction following on local GGUF models.
    try {
      const chatResponse = await fetch(`${runtime.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'local',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: nPredict,
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      });

      if (chatResponse.ok) {
        const chatJson = (await chatResponse.json()) as unknown;
        return readChatCompletionText(chatJson);
      }
    } catch {
      // Fall back to /completion if chat endpoint is unavailable.
    }

    const completionResponse = await fetch(`${runtime.baseUrl}/completion`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        n_predict: nPredict,
        temperature: 0,
        repeat_penalty: 1.1,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!completionResponse.ok) {
      const bodyText = await completionResponse.text();
      throw new Error(
        `llama-server completion failed (${completionResponse.status}): ${bodyText.slice(0, 600)}`,
      );
    }

    const completionJson = (await completionResponse.json()) as unknown;
    return readCompletionText(completionJson);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to run extraction completion: ${message}`);
  } finally {
    clearTimeout(timeout);
  }
};

const finalizeExtractionBundle = (
  text: string,
  prompt: string,
  rawModelOutput: string,
  validated: ExtractionV2,
  startedAt: number,
  runtime: ExtractionDebug['runtime'],
  fallbackUsed: boolean,
  errors: string[],
): ExtractionBundle => {
  const segmented = deriveSegments(validated, text);
  const extractionV2 = segmented.extraction;

  const debug: ExtractionDebug = {
    inputText: text,
    prompt,
    rawModelOutput,
    validatedExtractionV2BeforeSegmentation: validated,
    finalExtractionV2: extractionV2,
    segmentationTrace: segmented.trace,
    runtime: {
      ...runtime,
      totalMs: Date.now() - startedAt,
    },
    fallbackUsed,
    errors,
  };

  return { extractionV2, debug };
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

const isNarratorEntity = (entity: ExtractionV2['entities'][number]): boolean => {
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

const ensureNotetakerTerminology = (extraction: ExtractionV2): ExtractionV2 => {
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

const nextFactId = (facts: ExtractionV2['facts']): string => {
  const seen = new Set(facts.map((fact) => fact.id));
  let value = facts.length + 1;
  while (seen.has(`fact_${value}`)) {
    value += 1;
  }
  return `fact_${value}`;
};

const deriveFactSentiment = (fact: ExtractionV2['facts'][number], text: string): NoteSentiment => {
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
  extraction: ExtractionV2,
  text: string,
): {
  extraction: ExtractionV2;
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

const ensureSelfOwnership = (extraction: ExtractionV2, text: string): ExtractionV2 => {
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
    const ownerFromSubject =
      subjectEntityId && entityIdSet.has(subjectEntityId) ? subjectEntityId : undefined;
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

const isDrivingPredicate = (predicate: string): boolean => {
  return /\bdriv(?:e|ing)\b/i.test(predicate);
};

const removeConflictingCollectiveDrivingFacts = (
  extraction: ExtractionV2,
  text: string,
): ExtractionV2 => {
  const hasExplicitOtherDriver = extraction.facts.some(
    (fact) => fact.ownerEntityId !== NARRATOR_ENTITY_ID && isDrivingPredicate(fact.predicate),
  );

  if (!hasExplicitOtherDriver) {
    return extraction;
  }

  const facts = extraction.facts.filter((fact) => {
    if (fact.ownerEntityId !== NARRATOR_ENTITY_ID || !isDrivingPredicate(fact.predicate)) {
      return true;
    }

    const evidence = text.slice(fact.evidenceStart, fact.evidenceEnd);
    const explicitSelfDriver = /^\s*(?:i|i'm|ive|i’ve)\s+(?:was\s+)?driv(?:e|ing)\b/i.test(
      evidence,
    );
    if (explicitSelfDriver) {
      return true;
    }

    const collectivePronounDriver = /^\s*(?:we|our|us)\s+(?:were\s+)?driv(?:e|ing)\b/i.test(
      evidence,
    );
    return !collectivePronounDriver;
  });

  if (facts.length === extraction.facts.length) {
    return extraction;
  }

  const factIdSet = new Set(facts.map((fact) => fact.id));
  return {
    ...extraction,
    facts,
    groups: extraction.groups.map((group) => ({
      ...group,
      factIds: group.factIds.filter((factId) => factIdSet.has(factId)),
    })),
    segments: extraction.segments.map((segment) => ({
      ...segment,
      factIds: segment.factIds.filter((factId) => factIdSet.has(factId)),
    })),
  };
};

export const postProcessExtractionV2 = (extraction: ExtractionV2, text: string): ExtractionV2 => {
  const owned = ensureSelfOwnership(extraction, text);
  const withTodos = enrichTodoFacts(owned, text);
  const conflictCleaned = removeConflictingCollectiveDrivingFacts(withTodos, text);
  return ensureNotetakerTerminology(conflictCleaned);
};

const enrichTodoFacts = (extraction: ExtractionV2, text: string): ExtractionV2 => {
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
  'local-llama': {
    provider: 'local',
    model: 'local-llama.cpp',
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
  laneId: 'anthropic-haiku' | 'openai-gpt5mini',
): Promise<ExtractionBundle> => {
  const startedAt = Date.now();
  const prompt = buildUserPromptV2(text);
  const system = buildSystemPromptV2();
  const errors: string[] = [];
  let rawModelOutput = '';
  let validated: ExtractionV2 | null = null;
  let fallbackUsed = false;

  const model =
    laneId === 'anthropic-haiku'
      ? anthropic(ANTHROPIC_HAIKU_MODEL)
      : openai(OPENAI_GPT5_MINI_MODEL);

  try {
    const completion = await generateObject({
      model,
      system,
      prompt,
      maxOutputTokens: CLOUD_OUTPUT_TOKENS,
      timeout: CLOUD_REQUEST_TIMEOUT_MS,
      schemaName: 'extraction_v2',
      schemaDescription: 'Grounded extraction output for a personal note.',
      schema: jsonSchema(extractionV2JsonSchema),
    });

    const structuredOutput = completion.object;
    rawModelOutput = JSON.stringify(structuredOutput);

    const parsed = validateExtractionV2(text, structuredOutput);
    validated = postProcessExtractionV2(parsed, text);

    if (!hasRequiredFacts(validated)) {
      throw new Error('Model output had no facts.');
    }
  } catch (error) {
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
        temperature: 0,
      });

      rawModelOutput = completion.text;
      const parsed = parseAndValidateExtractionV2Output(text, rawModelOutput);
      validated = postProcessExtractionV2(parsed, text);

      if (!hasRequiredFacts(validated)) {
        throw new Error('Model output had no facts.');
      }
    } catch (error) {
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
  extractionV2: ExtractionV2;
  debug: ExtractionDebug;
}> {
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('extractWithDebug(text) requires a non-empty text string.');
  }

  const startedAt = Date.now();
  const prompt = buildPromptV2(text);
  const errors: string[] = [];
  let rawModelOutput = '';

  const runtime = await getRuntime();
  let validated: ExtractionV2 | null = null;
  let fallbackUsed = false;
  let nPredict = FAST_OUTPUT_TOKENS;

  const attempts: Array<{ promptValue: string; nPredictValue: number }> = [
    { promptValue: prompt, nPredictValue: FAST_OUTPUT_TOKENS },
    {
      promptValue: [prompt, '', LOCAL_RECOVERY_DIRECTIVE].join('\n'),
      nPredictValue: CLOUD_OUTPUT_TOKENS,
    },
  ];

  for (const [index, attempt] of attempts.entries()) {
    try {
      rawModelOutput = await runLlamaCompletion(attempt.promptValue, attempt.nPredictValue);
      const parsed = parseAndValidateExtractionV2Output(text, rawModelOutput);
      validated = postProcessExtractionV2(parsed, text);
      if (!hasRequiredFacts(validated)) {
        throw new Error('Model output had no facts.');
      }
      nPredict = attempt.nPredictValue;
      fallbackUsed = index > 0;
      break;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  if (!validated) {
    throw new Error(errors.join(' | '));
  }

  if (!validated) {
    throw new Error('Extraction validation failed with no parsed result.');
  }

  return finalizeExtractionBundle(
    text,
    prompt,
    rawModelOutput,
    validated,
    startedAt,
    {
      modelPath: runtime.modelPath,
      serverMode: runtime.mode,
      nPredict,
      totalMs: 0,
    },
    fallbackUsed,
    errors,
  );
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
      provider: 'local',
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
    const bundle =
      laneId === 'local-llama'
        ? await extractWithDebug(text)
        : await runCloudExtractionBundle(text, laneId);

    return {
      laneId,
      provider: lane.provider,
      model: lane.model,
      status: 'ok',
      durationMs: Date.now() - startedAt,
      extractionV2: bundle.extractionV2,
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

  const laneOrder: ExtractionLaneId[] = ['local-llama', 'anthropic-haiku', 'openai-gpt5mini'];
  const lanes = await Promise.all(laneOrder.map((laneId) => extractCompareLane(text, laneId)));
  return { lanes };
}

export async function extractV2(text: string): Promise<ExtractionV2> {
  const result = await extractWithDebug(text);
  return result.extractionV2;
}

export type { ExtractionDebug, ExtractionV2 } from './types.js';
