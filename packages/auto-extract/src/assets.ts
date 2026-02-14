import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { access, chmod, mkdir, mkdtemp, readdir, rename, rm, stat, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';

export const AUTO_EXTRACT_DIR = path.join(os.homedir(), '.auto-extract');
export const LLAMA_DIR = path.join(AUTO_EXTRACT_DIR, 'llama');
export const LLAMA_BIN = path.join(LLAMA_DIR, 'llama-cli');
export const LLAMA_SERVER_BIN = path.join(LLAMA_DIR, 'llama-server');
export const MODEL_PATH = path.join(AUTO_EXTRACT_DIR, 'model.gguf');

const LLAMA_RELEASE_TAG = 'b8027';
export const LLAMA_MACOS_ARM64_URL = `https://github.com/ggml-org/llama.cpp/releases/download/${LLAMA_RELEASE_TAG}/llama-${LLAMA_RELEASE_TAG}-bin-macos-arm64.tar.gz`;
export const MODEL_GGUF_URL =
  'https://huggingface.co/unsloth/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q5_K_M.gguf';

const fileExistsAndNonEmpty = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath);
    const fileStats = await stat(filePath);
    return fileStats.size > 0;
  } catch {
    return false;
  }
};

const downloadToFile = async (url: string, destination: string): Promise<void> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed (${response.status}) for ${url}`);
  }

  if (!response.body) {
    throw new Error(`Download response had no body for ${url}`);
  }

  const tempPath = `${destination}.tmp`;

  try {
    await response.body.pipeTo(Writable.toWeb(createWriteStream(tempPath)));
    const downloaded = await stat(tempPath);
    if (downloaded.size <= 0) {
      throw new Error(`Downloaded file is empty for ${url}`);
    }

    await rename(tempPath, destination);
  } catch (error) {
    await unlink(tempPath).catch(() => undefined);
    throw error;
  }
};

const runCommand = async (command: string, args: string[], cwd: string): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => {
      stderr += chunk;
    });

    child.on('error', (error) => {
      reject(new Error(`Failed to run ${command}: ${error.message}`));
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${command} exited with code ${code}. ${stderr.trim()}`));
        return;
      }

      resolve();
    });
  });
};

const installLlamaBinary = async (): Promise<void> => {
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'auto-extract-llama-'));
  const archivePath = path.join(tempRoot, 'llama-macos-arm64.tar.gz');
  const extractDir = path.join(tempRoot, 'extract');

  try {
    await mkdir(extractDir, { recursive: true });
    await downloadToFile(LLAMA_MACOS_ARM64_URL, archivePath);
    await runCommand('tar', ['-xzf', archivePath, '-C', extractDir], tempRoot);

    const candidateDirs = [
      path.join(extractDir, `llama-${LLAMA_RELEASE_TAG}`),
      path.join(extractDir, `llama-${LLAMA_RELEASE_TAG}-bin-macos-arm64`),
      extractDir,
    ];

    let runtimeDir: string | null = null;
    for (const candidateDir of candidateDirs) {
      if (await fileExistsAndNonEmpty(path.join(candidateDir, 'llama-cli'))) {
        runtimeDir = candidateDir;
        break;
      }
    }

    if (!runtimeDir) {
      throw new Error('Failed to find llama-cli inside downloaded llama.cpp archive.');
    }

    const runtimeEntries = await readdir(runtimeDir);
    for (const entry of runtimeEntries) {
      await rename(path.join(runtimeDir, entry), path.join(LLAMA_DIR, entry));
    }

    await chmod(LLAMA_BIN, 0o755);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
};

export type Assets = {
  llamaPath: string;
  llamaServerPath: string;
  modelPath: string;
};

export const ensureAssets = async (): Promise<Assets> => {
  if (process.platform !== 'darwin' || process.arch !== 'arm64') {
    throw new Error('auto-extract currently supports only macOS arm64 for this POC.');
  }

  await mkdir(AUTO_EXTRACT_DIR, { recursive: true });
  await mkdir(LLAMA_DIR, { recursive: true });

  if (!(await fileExistsAndNonEmpty(LLAMA_BIN))) {
    await installLlamaBinary();

    const binaryStats = await stat(LLAMA_BIN);
    if (binaryStats.size <= 0) {
      throw new Error(`Downloaded llama binary is empty at ${LLAMA_BIN}`);
    }
  }

  if (!(await fileExistsAndNonEmpty(LLAMA_SERVER_BIN))) {
    throw new Error(`llama-server binary is missing at ${LLAMA_SERVER_BIN}`);
  }

  if (!(await fileExistsAndNonEmpty(MODEL_PATH))) {
    await downloadToFile(MODEL_GGUF_URL, MODEL_PATH);
    const modelStats = await stat(MODEL_PATH);
    if (modelStats.size <= 0) {
      throw new Error(`Downloaded model is empty at ${MODEL_PATH}`);
    }
  }

  return {
    llamaPath: LLAMA_BIN,
    llamaServerPath: LLAMA_SERVER_BIN,
    modelPath: MODEL_PATH,
  };
};
