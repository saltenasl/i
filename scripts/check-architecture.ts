import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { walkFiles } from './lib/walk.ts';

const root = path.resolve(process.cwd());
const backendRoot = path.join(root, 'packages/backend/src');

const kyselyImportPattern = /from\s+['\"]kysely['\"]|require\(['\"]kysely['\"]\)/;
const queryBuilderPattern = /\b(selectFrom|insertInto|updateTable|deleteFrom)\s*\(/;

const run = async (): Promise<void> => {
  const files = (await walkFiles(backendRoot)).filter((file) => file.endsWith('.ts'));
  const violations: string[] = [];

  for (const file of files) {
    const relative = path.relative(root, file);
    const inDataAccess = relative.startsWith('packages/backend/src/data-access/');
    if (inDataAccess) {
      continue;
    }

    const text = await readFile(file, 'utf-8');

    if (kyselyImportPattern.test(text)) {
      violations.push(`${relative}: imports kysely outside data-access`);
    }

    if (queryBuilderPattern.test(text)) {
      violations.push(`${relative}: query-builder call detected outside data-access`);
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
