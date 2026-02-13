import { execSync } from 'node:child_process';

const generatedFile = 'packages/db/src/generated/db.generated.ts';
const migrationsDir = 'packages/db/src/migrations/';

const run = (): void => {
  try {
    execSync('git rev-parse --is-inside-work-tree', {
      stdio: 'ignore',
    });
  } catch {
    console.log('Migration discipline check skipped: not a git repository.');
    return;
  }

  const statusOutput = execSync('git status --porcelain', {
    encoding: 'utf-8',
  });

  const changed = statusOutput
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.slice(3).trim());

  const generatedChanged = changed.some((entry) => entry.endsWith(generatedFile));
  const migrationChanged = changed.some((entry) => entry.includes(migrationsDir));

  if (generatedChanged && !migrationChanged) {
    console.error('Migration discipline violation detected.');
    console.error(`- ${generatedFile} changed without any migration file updates.`);
    console.error(
      'Add a migration in packages/db/src/migrations before changing generated DB types.',
    );
    process.exit(1);
  }

  console.log('Migration discipline check passed.');
};

run();
