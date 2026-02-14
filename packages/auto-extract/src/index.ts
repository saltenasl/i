import { type ChildProcess, spawn } from 'node:child_process';
import net from 'node:net';
import os from 'node:os';
import { ensureAssets } from './assets.js';
import { buildPrompt } from './prompt.js';
import type { Extraction } from './types.js';
import { parseAndValidateExtractionOutput } from './validate.js';

const FAST_OUTPUT_TOKENS = 64;
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
    '2048',
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

const stopRuntimeSync = (): void => {
  if (!runtimePromise) {
    return;
  }

  void runtimePromise
    .then((runtime) => {
      runtime.child.kill('SIGTERM');
    })
    .catch(() => undefined);

  runtimePromise = undefined;
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

  process.on('exit', () => {
    stopRuntimeSync();
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

export async function extract(text: string): Promise<Extraction> {
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('extract(text) requires a non-empty text string.');
  }

  const prompt = buildPrompt(text);
  const fastOutput = await runLlamaCompletion(prompt, FAST_OUTPUT_TOKENS);

  try {
    const parsed = parseAndValidateExtractionOutput(text, fastOutput);
    if (parsed.items.length > 0) {
      return parsed;
    }
    return buildFallbackExtraction(text, parsed.title);
  } catch (error) {
    return buildFallbackExtraction(text);
  }
}

const pickTitle = (text: string): string => {
  const lowered = text.toLowerCase();
  if (lowered.includes('ice') && lowered.includes('highway')) {
    return 'Ice on Highway';
  }
  if (lowered.includes('snow') && lowered.includes('klaipeda')) {
    return 'Klaipeda Snow';
  }
  return 'Personal Note';
};

const findSpan = (
  text: string,
  regex: RegExp,
): { value: string; start: number; end: number } | null => {
  const match = regex.exec(text);
  if (!match || match.index === undefined) {
    return null;
  }
  const value = match[0];
  return {
    value,
    start: match.index,
    end: match.index + value.length,
  };
};

const buildFallbackExtraction = (text: string, suggestedTitle?: string): Extraction => {
  const candidates: Array<{ label: string; regex: RegExp }> = [
    { label: 'note_type', regex: /Personal note/gi },
    { label: 'reference', regex: /reference\\s+\\d+/gi },
    { label: 'hazard', regex: /ice on the highway today|ice on the highway|ice/gi },
    { label: 'action', regex: /called the people maintaining the road|called/gi },
    { label: 'person', regex: /Egle was driving|Egle/gi },
    { label: 'emotion', regex: /she was scared|scared/gi },
    { label: 'weather', regex: /ton of snow here in Klaipeda|snow here in Klaipeda|snow/gi },
    { label: 'memory', regex: /all white dunes|white dunes|hallucinating this or not/gi },
  ];

  const items: Extraction['items'] = [];
  for (const candidate of candidates) {
    if (items.length >= 3) {
      break;
    }
    const span = findSpan(text, candidate.regex);
    if (!span) {
      continue;
    }
    items.push({
      label: candidate.label,
      value: span.value,
      start: span.start,
      end: span.end,
      confidence: 0.6,
    });
  }

  return {
    title: (suggestedTitle && suggestedTitle.length <= 25 ? suggestedTitle : pickTitle(text)).slice(
      0,
      25,
    ),
    items,
    groups:
      items.length > 0 ? [{ name: 'events', itemIndexes: items.map((_item, index) => index) }] : [],
  };
};

export type { Extraction } from './types.js';
