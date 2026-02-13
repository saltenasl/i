import { readdir } from 'node:fs/promises';
import path from 'node:path';

const defaultIgnores = new Set(['node_modules', '.git', 'dist', 'coverage', 'playwright-report']);

export const walkFiles = async (root: string): Promise<string[]> => {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      if (defaultIgnores.has(entry.name)) {
        return [] as string[];
      }

      const fullPath = path.join(root, entry.name);
      if (entry.isDirectory()) {
        return walkFiles(fullPath);
      }

      if (entry.isFile()) {
        return [fullPath];
      }

      return [] as string[];
    }),
  );

  return nested.flat();
};
