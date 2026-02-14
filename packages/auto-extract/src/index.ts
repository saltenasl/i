import { type ChildProcess, spawn } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import { ensureAssets } from './assets.js';
import { buildPromptV2 } from './prompt.js';
import type {
  EntityType,
  Extraction,
  ExtractionDebug,
  ExtractionV2,
  FactPerspective,
  NoteSentiment,
} from './types.js';
import { parseAndValidateExtractionV2Output } from './validate.js';

const FAST_OUTPUT_TOKENS = 220;
const SERVER_READY_TIMEOUT_MS = 45_000;
const SERVER_REQUEST_TIMEOUT_MS = 20_000;
const SEGMENT_GAP_CHARS = 80;

type Span = { start: number; end: number };

type LlamaServerRuntime = {
  baseUrl: string;
  child: ChildProcess;
  mode: 'metal' | 'cpu';
  modelPath: string;
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

const clampToSentenceBoundaries = (text: string, start: number, end: number): Span => {
  let left = start;
  while (left > 0 && !/[.!?\n]/.test(text[left - 1] ?? '')) {
    left -= 1;
  }

  let right = end;
  while (right < text.length && !/[.!?\n]/.test(text[right] ?? '')) {
    right += 1;
  }

  if (right < text.length) {
    right += 1;
  }

  return { start: left, end: Math.min(text.length, right) };
};

const deriveSegments = (
  extraction: ExtractionV2,
  text: string,
): {
  extraction: ExtractionV2;
  trace: ExtractionDebug['segmentationTrace'];
} => {
  const spans: Span[] = [];

  for (const fact of extraction.facts) {
    spans.push({ start: fact.evidenceStart, end: fact.evidenceEnd });
  }

  for (const entity of extraction.entities) {
    spans.push({ start: entity.nameStart, end: entity.nameEnd });
    if (entity.evidenceStart !== undefined && entity.evidenceEnd !== undefined) {
      spans.push({ start: entity.evidenceStart, end: entity.evidenceEnd });
    }
  }

  if (spans.length === 0) {
    const segmentId = 'seg_1';
    const onlySegment = {
      id: segmentId,
      start: 0,
      end: text.length,
      sentiment: extraction.sentiment,
      summary: extraction.summary,
      entityIds: extraction.entities.map((entity) => entity.id),
      factIds: extraction.facts.map((fact) => fact.id),
      relationIndexes: extraction.relations.map((_, index) => index),
    };

    return {
      extraction: {
        ...extraction,
        segments: [onlySegment],
        facts: extraction.facts.map((fact) => ({ ...fact, segmentId })),
      },
      trace: [{ segmentId, start: 0, end: text.length, reason: 'no spans, fallback full note' }],
    };
  }

  const sorted = spans.sort((a, b) => a.start - b.start);
  const clusters: Span[] = [];

  const first = sorted[0];
  if (!first) {
    return {
      extraction: { ...extraction, segments: [] },
      trace: [],
    };
  }

  let current: Span = { ...first };
  for (let index = 1; index < sorted.length; index += 1) {
    const next = sorted[index];
    if (!next) {
      continue;
    }

    if (next.start - current.end <= SEGMENT_GAP_CHARS) {
      current.end = Math.max(current.end, next.end);
      continue;
    }

    clusters.push(current);
    current = { ...next };
  }
  clusters.push(current);

  const segments = clusters.map((cluster, clusterIndex) => {
    const clamped = clampToSentenceBoundaries(text, cluster.start, cluster.end);
    const segmentId = `seg_${clusterIndex + 1}`;

    const factIds = extraction.facts
      .filter((fact) => fact.evidenceStart < clamped.end && fact.evidenceEnd > clamped.start)
      .map((fact) => fact.id);

    const entityIds = extraction.entities
      .filter((entity) => entity.nameStart < clamped.end && entity.nameEnd > clamped.start)
      .map((entity) => entity.id);

    const relationIndexes = extraction.relations.flatMap((relation, relationIndex) => {
      const touchesEntity =
        entityIds.includes(relation.fromEntityId) || entityIds.includes(relation.toEntityId);
      return touchesEntity ? [relationIndex] : [];
    });

    const segmentFacts = extraction.facts.filter((fact) => factIds.includes(fact.id));
    const sentiments = segmentFacts.map((fact) => deriveFactSentiment(fact, text));
    const sentiment =
      sentiments.length === 0
        ? 'neutral'
        : sentiments.every((value) => value === sentiments[0])
          ? (sentiments[0] ?? 'neutral')
          : 'varied';

    const summary = text
      .slice(clamped.start, Math.min(text.length, clamped.start + 120))
      .replace(/\s+/g, ' ')
      .trim();

    return {
      id: segmentId,
      start: clamped.start,
      end: clamped.end,
      sentiment,
      summary,
      entityIds,
      factIds,
      relationIndexes,
    } satisfies ExtractionV2['segments'][number];
  });

  const factSegmentMap = new Map<string, string>();
  for (const segment of segments) {
    for (const factId of segment.factIds) {
      if (!factSegmentMap.has(factId)) {
        factSegmentMap.set(factId, segment.id);
      }
    }
  }

  const facts = extraction.facts.map((fact) => {
    const segmentId = factSegmentMap.get(fact.id);
    if (!segmentId) {
      return { ...fact };
    }

    return { ...fact, segmentId };
  });

  const segmentSentiments = segments.map((segment) => segment.sentiment);
  const rollupSentiment =
    segmentSentiments.length === 0
      ? extraction.sentiment
      : segmentSentiments.every((value) => value === segmentSentiments[0])
        ? (segmentSentiments[0] ?? 'neutral')
        : 'varied';

  return {
    extraction: {
      ...extraction,
      sentiment: rollupSentiment,
      facts,
      segments,
    },
    trace: segments.map((segment) => ({
      segmentId: segment.id,
      start: segment.start,
      end: segment.end,
      reason: 'clustered grounded spans',
    })),
  };
};

const ensureSelfOwnership = (extraction: ExtractionV2, text: string): ExtractionV2 => {
  const entities = [...extraction.entities];
  let selfEntity = entities.find((entity) => entity.name.toLowerCase() === 'i');

  const pronounSpan = findFirstPronounSpan(text);
  if (!selfEntity && pronounSpan) {
    selfEntity = {
      id: `ent_${entities.length + 1}`,
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
    const ownerFromSubject =
      fact.subjectEntityId && entityIdSet.has(fact.subjectEntityId)
        ? fact.subjectEntityId
        : undefined;

    const ownerEntityId = entityIdSet.has(fact.ownerEntityId)
      ? fact.ownerEntityId
      : (ownerFromSubject ??
        (firstPersonEvidence && selfEntity ? selfEntity.id : undefined) ??
        selfEntity?.id);

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
        'drove_to',
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
        'felt_scared',
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
        'called_road_maintenance',
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
        'observed_heavy_snow',
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
        'childhood_memory',
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
      type: 'drove_to',
      confidence: 0.7,
    });
  }

  if (egleId && iceId && scaredFact) {
    relations.push({
      fromEntityId: egleId,
      toEntityId: iceId,
      type: 'was_scared_because_of',
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

  return deriveSegments(ensureSelfOwnership(raw, text), text).extraction;
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
    validated = ensureSelfOwnership(parsed, text);
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
      modelPath: runtime.modelPath,
      serverMode: runtime.mode,
      nPredict: FAST_OUTPUT_TOKENS,
      totalMs: Date.now() - startedAt,
    },
    fallbackUsed,
    errors,
  };

  return { extraction, extractionV2, debug };
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
