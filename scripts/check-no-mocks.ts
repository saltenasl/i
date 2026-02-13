import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { walkFiles } from './lib/walk.ts';

const root = path.resolve(process.cwd());
const allowMocks = process.env.ALLOW_TEST_MOCKS === 'true';
const mockPattern = /\b(?:vi|jest)\.mock\s*\(/;
const explicitOverrideTag = 'ALLOW_TEST_MOCKS_WITH_USER_PERMISSION';

const run = async (): Promise<void> => {
  if (allowMocks) {
    console.log('Mock usage check skipped (ALLOW_TEST_MOCKS=true).');
    return;
  }

  const files = await walkFiles(root);
  const testFiles = files.filter((file) => /\.(test|spec)\.(ts|tsx)$/.test(file));
  const violations: string[] = [];

  for (const file of testFiles) {
    const text = await readFile(file, 'utf-8');
    if (text.includes(explicitOverrideTag)) {
      continue;
    }

    if (mockPattern.test(text)) {
      violations.push(path.relative(root, file));
    }
  }

  if (violations.length > 0) {
    console.error('Mock usage is blocked by policy. Violations:');
    for (const file of violations) {
      console.error(`- ${file}`);
    }
    console.error(
      'Set ALLOW_TEST_MOCKS=true only when user explicitly approves mocks for the task.',
    );
    process.exit(1);
  }

  console.log('No forbidden mock usage detected.');
};

await run();
