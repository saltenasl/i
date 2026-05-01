import type { Migration } from '../../shared/migration-types.js';
import type { Database } from '../generated/db.generated.js';
import { migration0001CreateUsers } from './0001-create-users.js';

export const primaryMigrations: Migration<Database>[] = [migration0001CreateUsers];
