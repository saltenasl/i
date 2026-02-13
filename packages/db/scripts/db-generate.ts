import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeDb, initializeRuntimeDatabase } from '../src/runtime.ts';
import { renderDatabaseTypes } from './generate-db-types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');
const outputPath = path.join(packageRoot, 'src/generated/db.generated.ts');

const run = async (): Promise<void> => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'db-generate-'));
  const dbPath = path.join(tempDir, 'generate.sqlite');

  try {
    const db = await initializeRuntimeDatabase({
      dbPath,
      seedProfile: 'fresh',
    });
    await closeDb(db);

    const generated = renderDatabaseTypes(dbPath);
    await writeFile(outputPath, generated, 'utf-8');
    console.log(`DB types regenerated at ${outputPath}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};

await run();
