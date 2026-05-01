import { mkdtemp, rm, writeFile } from 'node:fs/promises';
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

const primaryOutputPath = path.join(packageRoot, 'src/primary/generated/db.generated.ts');
const userOutputPath = path.join(packageRoot, 'src/user/generated/db.generated.ts');

const run = async (): Promise<void> => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'db-generate-'));
  const primaryDbPath = path.join(tempDir, 'primary.sqlite');
  const userDbPath = path.join(tempDir, 'user.sqlite');

  try {
    const primaryDb = await initializePrimaryRuntimeDatabase({
      dbPath: primaryDbPath,
    });
    await closeDb(primaryDb);

    const primaryGenerated = renderDatabaseTypes(primaryDbPath);
    await writeFile(primaryOutputPath, primaryGenerated, 'utf-8');
    console.log(`Primary DB types regenerated at ${primaryOutputPath}`);

    const userDb = await initializeUserRuntimeDatabase({
      dbPath: userDbPath,
      seedProfile: 'fresh',
    });
    await closeDb(userDb);

    const userGenerated = renderDatabaseTypes(userDbPath);
    await writeFile(userOutputPath, userGenerated, 'utf-8');
    console.log(`User DB types regenerated at ${userOutputPath}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
};

await run();
