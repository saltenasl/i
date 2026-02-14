import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { walkFiles } from './lib/walk.ts';

const root = path.resolve(process.cwd());
const allowRealAutoExtract = process.env.ALLOW_REAL_AUTO_EXTRACT_TESTS === 'true';
const explicitOverrideTag = 'ALLOW_REAL_AUTO_EXTRACT_WITH_USER_PERMISSION';

const run = async (): Promise<void> => {
  if (allowRealAutoExtract) {
    console.log('Auto-extract test policy check skipped (ALLOW_REAL_AUTO_EXTRACT_TESTS=true).');
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

    if (text.includes('@repo/auto-extract')) {
      violations.push(
        `${path.relative(root, file)}: direct @repo/auto-extract import in tests is blocked`,
      );
    }

    if (text.includes("handlers['extract.run'](") && !text.includes('runExtractionBundle:')) {
      violations.push(
        `${path.relative(root, file)}: extract.run test must inject runExtractionBundle`,
      );
    }

    if (
      text.includes("handlers['extract.compareLane'](") &&
      !text.includes('runExtractionCompareLane:')
    ) {
      violations.push(
        `${path.relative(root, file)}: extract.compareLane test must inject runExtractionCompareLane`,
      );
    }

    if (text.includes("handlers['extract.compare'](") && !text.includes('runExtractionCompare:')) {
      violations.push(
        `${path.relative(root, file)}: extract.compare test must inject runExtractionCompare`,
      );
    }
  }

  if (violations.length > 0) {
    console.error('Auto-extract test policy violations found:');
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    console.error(
      'Real auto-extract inference in tests is blocked by default due cost/latency. Require explicit user permission to override.',
    );
    process.exit(1);
  }

  console.log('Auto-extract test policy check passed.');
};

await run();
