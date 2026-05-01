import { type UserDbClient } from '@repo/db';
import type { Hono } from 'hono';
import type { Env } from './app.js';
export declare const createTestContext: () => Promise<{
    primaryDb: import("@repo/db").PrimaryDbClient;
    getUserDb: (userId: string) => Promise<UserDbClient>;
    cleanup(): Promise<void>;
}>;
export declare const mockFetchWithHono: (app: Hono<Env>) => () => void;
//# sourceMappingURL=test-utils.d.ts.map