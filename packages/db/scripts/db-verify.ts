import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializePrimaryRuntimeDatabase } from '../src/primary/runtime.js';
import { closeDb } from '../src/runtime.js';
import { initializeUserRuntimeDatabase } from '../src/user/runtime.js';
import { renderDatabaseTypes } from './generate-db-types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageRoot = path.resolve(__dirname, '..');

const primaryGeneratedPath = path.join(packageRoot, 'src/primary/generated/db.generated.ts');
const userGeneratedPath = path.join(packageRoot, 'src/user/generated/db.generated.ts');

const normalize = (input: string): string => input.replace(/\r\n/g, '\n').trimEnd();

const run = async (): Promise<void> => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'db-verify-'));
  const primaryTempDbPath = path.join(tempDir, 'primary.sqlite');
  const primaryDebugPath = path.join(tempDir, 'primary.generated.ts');
  const userTempDbPath = path.join(tempDir, 'user.sqlite');
  const userDebugPath = path.join(tempDir, 'user.generated.ts');

  try {
    const primaryDb = await initializePrimaryRuntimeDatabase({
      dbPath: primaryTempDbPath,
    });
    await closeDb(primaryDb);

    const primaryGeneratedFromMigrations = renderDatabaseTypes(primaryTempDbPath);
    const primaryCommitted = await readFile(primaryGeneratedPath, 'utf-8').catch(() => '');

    if (normalize(primaryGeneratedFromMigrations) !== normalize(primaryCommitted)) {
      await writeFile(primaryDebugPath, primaryGeneratedFromMigrations, 'utf-8');
      throw new Error(
        [
          'Primary DB type drift detected.',
          `- Expected (committed): ${primaryGeneratedPath}`,
          `- Regenerated snapshot: ${primaryDebugPath}`,
          'Create/update migration and regenerate DB types to resolve drift.',
        ].join('\n'),
      );
    }

    const userDb = await initializeUserRuntimeDatabase({
      dbPath: userTempDbPath,
      seedProfile: 'fresh',
    });
    await closeDb(userDb);

    const userGeneratedFromMigrations = renderDatabaseTypes(userTempDbPath);
    const userCommitted = await readFile(userGeneratedPath, 'utf-8').catch(() => '');

    if (normalize(userGeneratedFromMigrations) !== normalize(userCommitted)) {
      await writeFile(userDebugPath, userGeneratedFromMigrations, 'utf-8');
      throw new Error(
        [
          'User DB type drift detected.',
          `- Expected (committed): ${userGeneratedPath}`,
          `- Regenerated snapshot: ${userDebugPath}`,
          'Create/update migration and regenerate DB types to resolve drift.',
        ].join('\n'),
      );
    }

    console.log(
      'DB verify passed: primary and user migrations and generated DB types are in sync.',
    );
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
