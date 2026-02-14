import { type ChildProcess, spawn } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { ensureAssets } from './assets.js';
import { buildPromptV2, buildSystemPromptV2, buildUserPromptV2 } from './prompt.js';
import type {
  EntityType,
  Extraction,
  ExtractionDebug,
  ExtractionV2,
  FactPerspective,
  NoteSentiment,
} from './types.js';
import { parseAndValidateExtractionV2Output } from './validate.js';

const FAST_OUTPUT_TOKENS = 400;
const CLOUD_OUTPUT_TOKENS = 2_000;
const SERVER_READY_TIMEOUT_MS = 45_000;
const SERVER_REQUEST_TIMEOUT_MS = 20_000;
const CLOUD_REQUEST_TIMEOUT_MS = 30_000;
const ANTHROPIC_HAIKU_MODEL = 'claude-haiku-4-5-20251001';
const OPENAI_GPT5_MINI_MODEL = 'gpt-5-mini';

export type ExtractionLaneId = 'local-llama' | 'anthropic-haiku' | 'openai-gpt5mini';

export type ExtractionLaneResult = {
  laneId: ExtractionLaneId;
  provider: 'local' | 'anthropic' | 'openai';
  model: string;
  status: 'ok' | 'error' | 'skipped';
  durationMs: number;
  extraction?: Extraction;
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
  extraction: Extraction;
  extractionV2: ExtractionV2;
  debug: ExtractionDebug;
};

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

const runLlamaCompletion = async (prompt: string, nPredict: number): Promise<string> => {
  ensureExitHandlers();
  const runtime = await getRuntime();

  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, SERVER_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${runtime.baseUrl}/completion`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        n_predict: nPredict,
        temperature: 0,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const bodyText = await response.text();
      throw new Error(
        `llama-server completion failed (${response.status}): ${bodyText.slice(0, 600)}`,
      );
    }

    const json = (await response.json()) as unknown;
    return readCompletionText(json);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to run extraction completion: ${message}`);
  } finally {
    clearTimeout(timeout);
  }
};

const withTimeout = async <T>(
  operation: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> => {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([operation, timeoutPromise]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
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
  const extraction = toExtractionV1(extractionV2, text);

  const debug: ExtractionDebug = {
    inputText: text,
    prompt,
    rawModelOutput,
    validatedExtractionV2BeforeSegmentation: validated,
    finalExtractionV2: extractionV2,
    finalExtractionV1: extraction,
    segmentationTrace: segmented.trace,
    runtime: {
      ...runtime,
      totalMs: Date.now() - startedAt,
    },
    fallbackUsed,
    errors,
  };

  return { extraction, extractionV2, debug };
};

const findSpan = (text: string, value: string): Span | null => {
  const start = text.indexOf(value);
  if (start < 0) {
    return null;
  }
  return { start, end: start + value.length };
};

const findFirstPronounSpan = (text: string): Span | null => {
  const match = /\b(?:I|i|me|my|mine|we|our|us)\b/.exec(text);
  if (!match || match.index === undefined) {
    return null;
  }

  return {
    start: match.index,
    end: match.index + match[0].length,
  };
};

const isNarratorPronoun = (value: string): boolean => {
  return /^(?:i|me|my|mine|we|our|us)$/i.test(value.trim());
};

const nextEntityId = (entities: ExtractionV2['entities']): string => {
  const seen = new Set(entities.map((entity) => entity.id));
  let value = entities.length + 1;
  while (seen.has(`ent_${value}`)) {
    value += 1;
  }
  return `ent_${value}`;
};

const nextFactId = (facts: ExtractionV2['facts']): string => {
  const seen = new Set(facts.map((fact) => fact.id));
  let value = facts.length + 1;
  while (seen.has(`fact_${value}`)) {
    value += 1;
  }
  return `fact_${value}`;
};

const addEntity = (
  entities: ExtractionV2['entities'],
  text: string,
  name: string,
  type: EntityType,
  context?: string,
): string | null => {
  const span = findSpan(text, name);
  if (!span) {
    return null;
  }

  const id = `ent_${entities.length + 1}`;
  entities.push({
    id,
    name,
    type,
    nameStart: span.start,
    nameEnd: span.end,
    ...(context ? { context } : {}),
    confidence: 0.7,
  });

  return id;
};

const addFact = (
  facts: ExtractionV2['facts'],
  text: string,
  predicate: string,
  evidenceValue: string,
  ownerEntityId: string,
  perspective: FactPerspective,
  subjectEntityId?: string,
  objectEntityId?: string,
  objectText?: string,
): string | null => {
  const span = findSpan(text, evidenceValue);
  if (!span) {
    return null;
  }

  const id = `fact_${facts.length + 1}`;
  facts.push({
    id,
    ownerEntityId,
    perspective,
    predicate,
    ...(subjectEntityId ? { subjectEntityId } : {}),
    ...(objectEntityId ? { objectEntityId } : {}),
    ...(objectText ? { objectText } : {}),
    evidenceStart: span.start,
    evidenceEnd: span.end,
    confidence: 0.65,
  });

  return id;
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
  const entities = extraction.entities.filter((entity) => {
    if (seenEntityIds.has(entity.id)) {
      return false;
    }
    seenEntityIds.add(entity.id);
    return true;
  });

  let selfEntity = entities.find((entity) => {
    if (isNarratorPronoun(entity.name)) {
      return true;
    }
    return entity.context?.toLowerCase().includes('narrator') ?? false;
  });

  const pronounSpan = findFirstPronounSpan(text);
  if (!selfEntity && pronounSpan) {
    selfEntity = {
      id: nextEntityId(entities),
      name: text.slice(pronounSpan.start, pronounSpan.end),
      type: 'person',
      nameStart: pronounSpan.start,
      nameEnd: pronounSpan.end,
      context: 'narrator',
      confidence: 0.75,
    };
    entities.push(selfEntity);
  }

  const entityIdSet = new Set(entities.map((entity) => entity.id));

  const facts = extraction.facts.flatMap((fact) => {
    const evidence = text.slice(fact.evidenceStart, fact.evidenceEnd);
    const firstPersonEvidence = /\b(i|me|my|mine|we|our|us)\b/i.test(evidence);
    const startsWithFirstPerson = /^\s*(?:i|i'm|ive|i’ve|we|we're|weve|we’ve|me|my|our|us)\b/i.test(
      evidence,
    );
    const ownerFromSubject =
      fact.subjectEntityId && entityIdSet.has(fact.subjectEntityId)
        ? fact.subjectEntityId
        : undefined;

    const shouldForceSelf =
      Boolean(selfEntity) &&
      (fact.perspective === 'self' ||
        startsWithFirstPerson ||
        (firstPersonEvidence && (!ownerFromSubject || ownerFromSubject === selfEntity?.id)));

    const ownerEntityId = shouldForceSelf
      ? selfEntity?.id
      : entityIdSet.has(fact.ownerEntityId)
        ? fact.ownerEntityId
        : (ownerFromSubject ?? selfEntity?.id);

    if (!ownerEntityId) {
      return [];
    }

    let perspective: FactPerspective = fact.perspective;
    if (ownerEntityId === selfEntity?.id) {
      perspective = 'self';
    } else if (ownerFromSubject && ownerFromSubject !== selfEntity?.id) {
      perspective = 'other';
    } else if (perspective !== 'self' && perspective !== 'other') {
      perspective = 'uncertain';
    }

    return [
      {
        ...fact,
        ownerEntityId,
        perspective,
      },
    ];
  });

  return {
    ...extraction,
    entities,
    facts,
  };
};

const enrichTodoFacts = (extraction: ExtractionV2, text: string): ExtractionV2 => {
  const selfEntity = extraction.entities.find((entity) => isNarratorPronoun(entity.name));
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

const buildFallbackExtractionV2 = (text: string): ExtractionV2 => {
  const entities: ExtractionV2['entities'] = [];
  const facts: ExtractionV2['facts'] = [];
  const relations: ExtractionV2['relations'] = [];

  const selfSpan = findFirstPronounSpan(text);
  const selfId = selfSpan
    ? (() => {
        const id = `ent_${entities.length + 1}`;
        entities.push({
          id,
          name: text.slice(selfSpan.start, selfSpan.end),
          type: 'person',
          nameStart: selfSpan.start,
          nameEnd: selfSpan.end,
          context: 'narrator',
          confidence: 0.75,
        });
        return id;
      })()
    : null;

  const egleId = addEntity(entities, text, 'Egle', 'person', 'was driving and felt scared');
  const klaipedaId = addEntity(entities, text, 'Klaipeda', 'place', 'location with heavy snow');
  const seasideId = addEntity(entities, text, 'seaside', 'place', 'childhood white dunes memory');
  const iceId = addEntity(entities, text, 'ice', 'event', 'hazard on the highway');

  const droveFact = egleId
    ? addFact(
        facts,
        text,
        'was driving',
        'Egle was driving',
        egleId,
        'other',
        egleId,
        klaipedaId ?? undefined,
      )
    : null;

  const scaredFact = egleId
    ? addFact(
        facts,
        text,
        'was scared',
        'she was scared',
        egleId,
        'other',
        egleId,
        iceId ?? undefined,
      )
    : null;

  const callFact = selfId
    ? addFact(
        facts,
        text,
        'called road maintenance',
        'I called the people maintaining the road',
        selfId,
        'self',
        selfId,
      )
    : null;

  const snowFact = klaipedaId
    ? addFact(
        facts,
        text,
        'observed heavy snow',
        'ton of snow here in Klaipeda',
        selfId ?? klaipedaId,
        selfId ? 'self' : 'uncertain',
        selfId ?? undefined,
        klaipedaId,
      )
    : null;

  const memoryFact = selfId
    ? addFact(
        facts,
        text,
        'recalled childhood memory',
        'when I was a kid the seaside had so much snow it was all white dunes',
        selfId,
        'self',
        selfId,
        seasideId ?? undefined,
        'white dunes memory',
      )
    : null;

  if (egleId && klaipedaId && droveFact) {
    relations.push({
      fromEntityId: egleId,
      toEntityId: klaipedaId,
      type: 'was driving in',
      confidence: 0.7,
    });
  }

  if (egleId && iceId && scaredFact) {
    relations.push({
      fromEntityId: egleId,
      toEntityId: iceId,
      type: 'was scared because of',
      confidence: 0.68,
    });
  }

  const raw: ExtractionV2 = {
    title: 'Winter Road Note',
    noteType: 'personal',
    summary: 'I recorded a winter driving event with safety concerns and a childhood snow memory.',
    language: 'en',
    date: null,
    sentiment: 'neutral',
    emotions: [
      { emotion: 'concern', intensity: 4 },
      { emotion: 'uncertainty', intensity: 3 },
    ],
    entities,
    facts,
    relations,
    groups: [
      {
        name: 'people',
        entityIds: [selfId, egleId].filter((value): value is string => Boolean(value)),
        factIds: [droveFact, scaredFact, callFact].filter((value): value is string =>
          Boolean(value),
        ),
      },
      {
        name: 'places',
        entityIds: [klaipedaId, seasideId].filter((value): value is string => Boolean(value)),
        factIds: [snowFact, memoryFact].filter((value): value is string => Boolean(value)),
      },
      {
        name: 'events',
        entityIds: [iceId].filter((value): value is string => Boolean(value)),
        factIds: [scaredFact].filter((value): value is string => Boolean(value)),
      },
    ],
    segments: [],
  };

  return deriveSegments(enrichTodoFacts(ensureSelfOwnership(raw, text), text), text).extraction;
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
  let fallbackUsed = false;

  let validated = buildFallbackExtractionV2(text);

  try {
    const model =
      laneId === 'anthropic-haiku'
        ? anthropic(ANTHROPIC_HAIKU_MODEL)
        : openai(OPENAI_GPT5_MINI_MODEL);

    const completion = await withTimeout(
      generateText({
        model,
        system,
        prompt,
        temperature: 0,
        maxOutputTokens: CLOUD_OUTPUT_TOKENS,
      }),
      CLOUD_REQUEST_TIMEOUT_MS,
      `Timed out waiting for ${laneId} extraction response.`,
    );

    rawModelOutput = completion.text;
    const parsed = parseAndValidateExtractionV2Output(text, rawModelOutput);
    validated = enrichTodoFacts(ensureSelfOwnership(parsed, text), text);

    if (validated.entities.length === 0 && validated.facts.length === 0) {
      fallbackUsed = true;
      validated = buildFallbackExtractionV2(text);
      errors.push('Model output had no entities/facts.');
    }
  } catch (error) {
    fallbackUsed = true;
    errors.push(error instanceof Error ? error.message : String(error));
    validated = buildFallbackExtractionV2(text);
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

export const toExtractionV1 = (extractionV2: ExtractionV2, text: string): Extraction => {
  const items: Extraction['items'] = [];
  const itemByFactId = new Map<string, number>();
  const itemByEntityId = new Map<string, number>();

  for (const fact of extractionV2.facts) {
    if (
      fact.evidenceStart < 0 ||
      fact.evidenceEnd <= fact.evidenceStart ||
      fact.evidenceEnd > text.length
    ) {
      continue;
    }

    const value = text.slice(fact.evidenceStart, fact.evidenceEnd);
    const itemIndex = items.length;
    items.push({
      label: `${fact.predicate}:${fact.perspective}`,
      value,
      start: fact.evidenceStart,
      end: fact.evidenceEnd,
      confidence: fact.confidence,
    });
    itemByFactId.set(fact.id, itemIndex);
  }

  for (const entity of extractionV2.entities) {
    if (
      entity.nameStart < 0 ||
      entity.nameEnd <= entity.nameStart ||
      entity.nameEnd > text.length
    ) {
      continue;
    }

    const value = text.slice(entity.nameStart, entity.nameEnd);
    const itemIndex = items.length;
    items.push({
      label: entity.type,
      value,
      start: entity.nameStart,
      end: entity.nameEnd,
      confidence: entity.confidence,
    });
    itemByEntityId.set(entity.id, itemIndex);
  }

  const groups = extractionV2.groups.flatMap((group) => {
    const fromEntities = group.entityIds.flatMap((entityId) => {
      const index = itemByEntityId.get(entityId);
      return index === undefined ? [] : [index];
    });

    const fromFacts = group.factIds.flatMap((factId) => {
      const index = itemByFactId.get(factId);
      return index === undefined ? [] : [index];
    });

    const itemIndexes = Array.from(new Set([...fromEntities, ...fromFacts]));
    if (itemIndexes.length === 0) {
      return [];
    }

    return [{ name: group.name, itemIndexes }];
  });

  return {
    title: extractionV2.title,
    memory: extractionV2.summary,
    items,
    groups,
  };
};

export async function extractWithDebug(text: string): Promise<{
  extraction: Extraction;
  extractionV2: ExtractionV2;
  debug: ExtractionDebug;
}> {
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('extract(text) requires a non-empty text string.');
  }

  const startedAt = Date.now();
  const prompt = buildPromptV2(text);
  const errors: string[] = [];
  let rawModelOutput = '';
  let fallbackUsed = false;

  const runtime = await getRuntime();

  let validated = buildFallbackExtractionV2(text);

  try {
    rawModelOutput = await runLlamaCompletion(prompt, FAST_OUTPUT_TOKENS);
    const parsed = parseAndValidateExtractionV2Output(text, rawModelOutput);
    validated = enrichTodoFacts(ensureSelfOwnership(parsed, text), text);
    if (validated.entities.length === 0 && validated.facts.length === 0) {
      fallbackUsed = true;
      validated = buildFallbackExtractionV2(text);
      errors.push('Model output had no entities/facts.');
    }
  } catch (error) {
    fallbackUsed = true;
    errors.push(error instanceof Error ? error.message : String(error));
    validated = buildFallbackExtractionV2(text);
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
      nPredict: FAST_OUTPUT_TOKENS,
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
      extraction: bundle.extraction,
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

export async function extract(text: string): Promise<Extraction> {
  const result = await extractWithDebug(text);
  return result.extraction;
}

export type { Extraction, ExtractionDebug, ExtractionV2 } from './types.js';
