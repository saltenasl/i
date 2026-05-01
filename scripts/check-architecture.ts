import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { walkFiles } from './lib/walk.ts';

const root = path.resolve(process.cwd());
const serverRoot = path.join(root, 'apps/server/src');
const dbRoot = path.join(root, 'packages/db/src');

const kyselyImportPattern = /from\s+['\"]kysely['\"]|require\(['\"]kysely['\"]\)/;
const queryBuilderPattern = /\b(selectFrom|insertInto|updateTable|deleteFrom)\s*\(/;

const run = async (): Promise<void> => {
  const serverFiles = (await walkFiles(serverRoot)).filter((file) => file.endsWith('.ts'));
  const dbFiles = (await walkFiles(dbRoot)).filter((file) => file.endsWith('.ts'));
  const allFiles = [...serverFiles, ...dbFiles];

  const violations: string[] = [];

  for (const file of allFiles) {
    const relative = path.relative(root, file);

    // Server files should NOT have kysely or query builder at all
    if (relative.startsWith('apps/server/src/')) {
      const text = await readFile(file, 'utf-8');
      if (kyselyImportPattern.test(text)) {
        violations.push(
          `${relative}: imports kysely in server app (logic should be in data-access)`,
        );
      }
      if (queryBuilderPattern.test(text)) {
        violations.push(
          `${relative}: query-builder call detected in server app (logic should be in data-access)`,
        );
      }
      continue;
    }

    // DB files: ONLY files in data-access folders can have kysely/query-builder
    if (relative.startsWith('packages/db/src/')) {
      const isDataAccess = relative.includes('/data-access/');
      const isRuntime = relative.endsWith('runtime.ts');
      const isClient = relative.endsWith('client.ts');
      const isMigrationTypes = relative.endsWith('migration-types.ts');
      const isTest = relative.endsWith('runtime.test.ts');
      const isSeeds = relative.includes('/seeds/');

      if (isDataAccess || isRuntime || isClient || isMigrationTypes || isTest || isSeeds) {
        continue;
      }
      const text = await readFile(file, 'utf-8');

      if (kyselyImportPattern.test(text)) {
        violations.push(`${relative}: imports kysely outside data-access or runtime`);
      }

      if (queryBuilderPattern.test(text)) {
        violations.push(`${relative}: query-builder call detected outside data-access`);
      }
    }
  }

  if (violations.length > 0) {
    console.error('Architecture violations found:');
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exit(1);
  }

  console.log('Architecture check passed.');
};

await run();
