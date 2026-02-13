import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeDb, initializeRuntimeDatabase } from '../src/runtime.ts';
import { renderDatabaseTypes } from './generate-db-types.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');
const generatedPath = path.join(packageRoot, 'src/generated/db.generated.ts');

const normalize = (input: string): string => input.replace(/\r\n/g, '\n').trimEnd();

const run = async (): Promise<void> => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'db-verify-'));
  const tempDbPath = path.join(tempDir, 'verify.sqlite');
  const debugGeneratedPath = path.join(tempDir, 'db.generated.ts');

  try {
    const db = await initializeRuntimeDatabase({
      dbPath: tempDbPath,
      seedProfile: 'fresh',
    });
    await closeDb(db);

    const generatedFromMigrations = renderDatabaseTypes(tempDbPath);
    const committed = await readFile(generatedPath, 'utf-8');

    if (normalize(generatedFromMigrations) !== normalize(committed)) {
      await writeFile(debugGeneratedPath, generatedFromMigrations, 'utf-8');
      throw new Error(
        [
          'DB type drift detected.',
          `- Expected (committed): ${generatedPath}`,
          `- Regenerated snapshot: ${debugGeneratedPath}`,
          'Create/update migration and regenerate DB types to resolve drift.',
        ].join('\n'),
      );
    }

    console.log('DB verify passed: migrations and generated DB types are in sync.');
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};

try {
  await run();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
