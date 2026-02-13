import { spawn } from 'node:child_process';
import { ensureAssets } from './assets.js';
import { buildPrompt } from './prompt.js';
import type { Extraction } from './types.js';
import { parseAndValidateExtractionOutput } from './validate.js';

const MAX_OUTPUT_TOKENS = 512;

let assetsPromise: ReturnType<typeof ensureAssets> | undefined;

const getAssets = async () => {
  assetsPromise ??= ensureAssets();
  return assetsPromise;
};

const runLlama = async (llamaPath: string, modelPath: string, prompt: string): Promise<string> => {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(
      llamaPath,
      ['-m', modelPath, '-f', '-', '--temp', '0', '-n', String(MAX_OUTPUT_TOKENS)],
      {
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    );

    let stdout = '';
    let stderr = '';

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', (chunk: string) => {
      stdout += chunk;
    });

    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });

    child.on('error', (error) => {
      reject(new Error(`Failed to start llama process: ${error.message}`));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        const excerpt = stderr.trim().slice(0, 600);
        reject(new Error(`llama process exited with code ${code}. stderr: ${excerpt}`));
        return;
      }

      resolve(stdout);
    });

    child.stdin.on('error', (error) => {
      reject(new Error(`Failed to write prompt to llama stdin: ${error.message}`));
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
};

export async function extract(text: string): Promise<Extraction> {
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('extract(text) requires a non-empty text string.');
  }

  const assets = await getAssets();
  const prompt = buildPrompt(text);
  const rawOutput = await runLlama(assets.llamaPath, assets.modelPath, prompt);
  return parseAndValidateExtractionOutput(text, rawOutput);
}

export type { Extraction } from './types.js';
