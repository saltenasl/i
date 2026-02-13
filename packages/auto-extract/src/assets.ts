import { createWriteStream } from 'node:fs';
import { access, chmod, mkdir, rename, stat, unlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';

export const AUTO_EXTRACT_DIR = path.join(os.homedir(), '.auto-extract');
export const LLAMA_DIR = path.join(AUTO_EXTRACT_DIR, 'llama');
export const LLAMA_BIN = path.join(LLAMA_DIR, 'llama-cli');
export const MODEL_PATH = path.join(AUTO_EXTRACT_DIR, 'model.gguf');

// TODO: replace with a real prebuilt macOS arm64 llama.cpp binary URL.
export const LLAMA_MACOS_ARM64_URL = 'https://example.com/llama-cli-macos-arm64';
// TODO: replace with a real GGUF model URL (small model suitable for ~3GB RAM).
export const MODEL_GGUF_URL = 'https://example.com/model.gguf';

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

export type Assets = {
  llamaPath: string;
  modelPath: string;
};

export const ensureAssets = async (): Promise<Assets> => {
  if (process.platform !== 'darwin' || process.arch !== 'arm64') {
    throw new Error('auto-extract currently supports only macOS arm64 for this POC.');
  }

  await mkdir(AUTO_EXTRACT_DIR, { recursive: true });
  await mkdir(LLAMA_DIR, { recursive: true });

  if (!(await fileExistsAndNonEmpty(LLAMA_BIN))) {
    await downloadToFile(LLAMA_MACOS_ARM64_URL, LLAMA_BIN);
    await chmod(LLAMA_BIN, 0o755);

    const binaryStats = await stat(LLAMA_BIN);
    if (binaryStats.size <= 0) {
      throw new Error(`Downloaded llama binary is empty at ${LLAMA_BIN}`);
    }
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
    modelPath: MODEL_PATH,
  };
};
