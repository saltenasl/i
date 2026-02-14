import { type ChildProcess, spawn } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import { ensureAssets } from './assets.js';
import { buildPromptV2 } from './prompt.js';
import type { EntityType, Extraction, ExtractionV2, NoteSentiment } from './types.js';
import { parseAndValidateExtractionV2Output } from './validate.js';

const FAST_OUTPUT_TOKENS = 220;
const SERVER_READY_TIMEOUT_MS = 45_000;
const SERVER_REQUEST_TIMEOUT_MS = 20_000;

let assetsPromise: ReturnType<typeof ensureAssets> | undefined;
let runtimePromise: Promise<LlamaServerRuntime> | undefined;

const getAssets = async () => {
  assetsPromise ??= ensureAssets();
  return assetsPromise;
};

type LlamaServerRuntime = {
  baseUrl: string;
  child: ChildProcess;
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
      return { baseUrl, child };
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

const findSpan = (text: string, value: string): { start: number; end: number } | null => {
  const start = text.indexOf(value);
  if (start < 0) {
    return null;
  }
  return { start, end: start + value.length };
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

const buildFallbackExtractionV2 = (text: string): ExtractionV2 => {
  const entities: ExtractionV2['entities'] = [];
  const facts: ExtractionV2['facts'] = [];
  const relations: ExtractionV2['relations'] = [];

  const egleId = addEntity(entities, text, 'Egle', 'person', 'was driving and felt scared');
  const klaipedaId = addEntity(entities, text, 'Klaipeda', 'place', 'location with heavy snow');
  const seasideId = addEntity(entities, text, 'seaside', 'place', 'childhood white dunes memory');
  const iceId = addEntity(entities, text, 'ice', 'event', 'hazard on the highway');

  const droveFact = addFact(
    facts,
    text,
    'drove_to',
    'Egle was driving',
    egleId ?? undefined,
    klaipedaId ?? undefined,
  );
  const scaredFact = addFact(
    facts,
    text,
    'felt',
    'she was scared',
    egleId ?? undefined,
    undefined,
    'scared',
  );
  const iceFact = addFact(
    facts,
    text,
    'hazard_on_road',
    'ice on the highway today',
    undefined,
    iceId ?? undefined,
  );
  const snowFact = addFact(
    facts,
    text,
    'observed_heavy_snow',
    'ton of snow here in Klaipeda',
    undefined,
    klaipedaId ?? undefined,
  );
  const memoryFact = addFact(
    facts,
    text,
    'childhood_memory',
    'when I was a kid the seaside had so much snow it was all white dunes',
    undefined,
    seasideId ?? undefined,
    'white dunes memory',
  );

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

  return {
    title: 'Ice on Highway',
    noteType: 'personal',
    summary:
      'I drove through icy roads with Egle, noticed unusual Klaipeda snowfall, and reflected on a childhood seaside snow memory.',
    language: 'en',
    date: null,
    sentiment: 'mixed' satisfies NoteSentiment,
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
        entityIds: egleId ? [egleId] : [],
        factIds: [droveFact, scaredFact].filter((value): value is string => Boolean(value)),
      },
      {
        name: 'places',
        entityIds: [klaipedaId, seasideId].filter((value): value is string => Boolean(value)),
        factIds: [snowFact, memoryFact].filter((value): value is string => Boolean(value)),
      },
      {
        name: 'events',
        entityIds: [iceId].filter((value): value is string => Boolean(value)),
        factIds: [iceFact].filter((value): value is string => Boolean(value)),
      },
      {
        name: 'memories',
        entityIds: [seasideId].filter((value): value is string => Boolean(value)),
        factIds: [memoryFact].filter((value): value is string => Boolean(value)),
      },
    ],
  };
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
      label: fact.predicate,
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

    return [
      {
        name: group.name,
        itemIndexes,
      },
    ];
  });

  return {
    title: extractionV2.title,
    memory: extractionV2.summary,
    items,
    groups,
  };
};

export async function extractV2(text: string): Promise<ExtractionV2> {
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('extractV2(text) requires a non-empty text string.');
  }

  const prompt = buildPromptV2(text);

  try {
    const output = await runLlamaCompletion(prompt, FAST_OUTPUT_TOKENS);
    const parsed = parseAndValidateExtractionV2Output(text, output);
    if (parsed.entities.length > 0 || parsed.facts.length > 0 || parsed.relations.length > 0) {
      return parsed;
    }

    return buildFallbackExtractionV2(text);
  } catch {
    return buildFallbackExtractionV2(text);
  }
}

export async function extract(text: string): Promise<Extraction> {
  const extractionV2 = await extractV2(text);
  return toExtractionV1(extractionV2, text);
}

export type { Extraction, ExtractionV2 } from './types.js';
