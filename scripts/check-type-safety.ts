import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

interface Finding {
  file: string;
  line: number;
  label: string;
  snippet: string;
}

const repoRoot = process.cwd();
const roots = ['apps', 'packages', 'scripts'];
const ignoredDirNames = new Set(['dist', 'node_modules', '.git', '.pnpm-store', '.npm-cache']);
const ignoredPathFragments = ['/packages/db/src/generated/', '/scripts/check-type-safety.ts'];
const sourceFilePattern = /\.(ts|tsx)$/;

const forbiddenPatterns: Array<{ regex: RegExp; label: string }> = [
  { regex: /\bas never\b/g, label: 'Forbidden cast: as never' },
  { regex: /as unknown as/g, label: 'Forbidden chained cast: as unknown as' },
  { regex: /@ts-ignore/g, label: 'Forbidden directive: @ts-ignore' },
  { regex: /@ts-expect-error/g, label: 'Forbidden directive: @ts-expect-error' },
];

const walk = async (directory: string): Promise<string[]> => {
  const absolute = path.join(repoRoot, directory);
  const entries = await readdir(absolute, { withFileTypes: true });
  const discovered: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(absolute, entry.name);

    if (entry.isDirectory()) {
      if (ignoredDirNames.has(entry.name)) {
        continue;
      }

      discovered.push(...(await walk(path.relative(repoRoot, entryPath))));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (!sourceFilePattern.test(entry.name)) {
      continue;
    }

    const normalized = entryPath.split(path.sep).join('/');
    if (ignoredPathFragments.some((fragment) => normalized.includes(fragment))) {
      continue;
    }

    discovered.push(entryPath);
  }

  return discovered;
};

const analyzeFile = async (filePath: string): Promise<Finding[]> => {
  const content = await readFile(filePath, 'utf-8');
  const lines = content.split('\n');
  const findings: Finding[] = [];

  lines.forEach((line, index) => {
    for (const pattern of forbiddenPatterns) {
      pattern.regex.lastIndex = 0;
      if (!pattern.regex.test(line)) {
        continue;
      }

      findings.push({
        file: path.relative(repoRoot, filePath),
        line: index + 1,
        label: pattern.label,
        snippet: line.trim(),
      });
    }
  });

  return findings;
};

const main = async (): Promise<void> => {
  const files = (await Promise.all(roots.map((root) => walk(root)))).flat();

  const findings = (await Promise.all(files.map((file) => analyzeFile(file)))).flat();

  if (findings.length === 0) {
    console.log('Type safety check passed: no forbidden type escapes found.');
    return;
  }

  console.error('Type safety check failed. Forbidden patterns found:');
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} ${finding.label}`);
    console.error(`  ${finding.snippet}`);
  }

  process.exitCode = 1;
};

await main();
