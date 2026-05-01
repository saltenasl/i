import path from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import {
  type Extraction,
  type ExtractionDebug,
  type ExtractionLaneId,
  type ExtractionLaneResult,
  extractCompareLane,
  extractWithDebug,
} from '@repo/auto-extract';
import {
  type ExtractionHistoryRepository,
  type NoteRepository,
  type PrimaryDbClient,
  type UserDbClient,
  createExtractionHistoryRepository,
  createNoteRepository,
  createSessionRepository,
  createUserRepository,
  initializePrimaryRuntimeDatabase,
  initializeUserRuntimeDatabase,
} from '@repo/db';
import { type Context, Hono, type Next } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { logger } from 'hono/logger';

// --- Configuration ---
const PRIMARY_DB_PATH =
  process.env.PRIMARY_DB_PATH || path.join(process.cwd(), 'data/primary.sqlite');
const USER_DATA_DIR = process.env.USER_DATA_DIR || path.join(process.cwd(), 'data/users');
const SESSION_COOKIE_NAME = 'app_session';
const SESSION_DURATION_DAYS = 30;

// --- Types ---
export type Variables = {
  primaryDb: PrimaryDbClient;
  userDb: UserDbClient;
  user: { id: string; email: string };
  noteRepo: NoteRepository;
  extractionRepo: ExtractionHistoryRepository;
};

export type Env = {
  Variables: Variables;
};

export interface AppDependencies {
  getPrimaryDb?: () => Promise<PrimaryDbClient>;
  getUserDb?: (userId: string) => Promise<UserDbClient>;
  runExtractionBundle?: (text: string) => Promise<{
    extraction: Extraction;
    debug: ExtractionDebug;
  }>;
  runExtractionCompareLane?: (
    text: string,
    laneId: ExtractionLaneId,
  ) => Promise<ExtractionLaneResult>;
}

export const createApp = (deps?: AppDependencies) => {
  const app = new Hono<Env>();

  app.use('*', logger());

  // Serve static files in production
  if (process.env.NODE_ENV === 'production') {
    // Dist is sibling to src in build, but in dev it's in apps/renderer/dist
    const staticRoot = path.resolve(process.cwd(), '../renderer/dist');
    app.use('/*', serveStatic({ root: path.relative(process.cwd(), staticRoot) }));
  }

  const getPrimaryDb =
    deps?.getPrimaryDb ||
    (async (): Promise<PrimaryDbClient> => {
      return await initializePrimaryRuntimeDatabase({ dbPath: PRIMARY_DB_PATH });
    });

  const getUserDb =
    deps?.getUserDb ||
    (async (userId: string): Promise<UserDbClient> => {
      return await initializeUserRuntimeDatabase({
        dbPath: path.join(USER_DATA_DIR, `${userId}.sqlite`),
        seedProfile: 'fresh',
      });
    });

  const runExtractionBundle = deps?.runExtractionBundle || extractWithDebug;
  const runExtractionCompareLane = deps?.runExtractionCompareLane || extractCompareLane;

  app.use('*', async (c, next) => {
    const db = await getPrimaryDb();
    c.set('primaryDb', db);
    await next();
  });

  const auth = async (c: Context<Env>, next: Next) => {
    const sessionId = getCookie(c, SESSION_COOKIE_NAME);
    if (!sessionId) return c.json({ ok: false, error: 'UNAUTHORIZED' }, 401);

    const primaryDb = c.get('primaryDb');
    const sessionRepo = createSessionRepository(primaryDb);
    const session = await sessionRepo.getById(sessionId);
    if (!session || new Date(session.expiresAt) < new Date()) {
      deleteCookie(c, SESSION_COOKIE_NAME);
      return c.json({ ok: false, error: 'UNAUTHORIZED' }, 401);
    }

    const userRepo = createUserRepository(primaryDb);
    const user = await userRepo.getById(session.userId);
    if (!user) return c.json({ ok: false, error: 'UNAUTHORIZED' }, 401);

    c.set('user', { id: user.id, email: user.email });
    const userDb = await getUserDb(user.id);
    c.set('userDb', userDb);
    c.set('noteRepo', createNoteRepository(userDb));
    c.set('extractionRepo', createExtractionHistoryRepository(userDb));

    await next();
  };

  const routes = app
    .get('/api/health', (c: Context<Env>) => c.json({ status: 'ok' }))
    .get('/api/auth/mock-login', async (c: Context<Env>) => {
      const primaryDb = c.get('primaryDb');
      const userRepo = createUserRepository(primaryDb);
      const sessionRepo = createSessionRepository(primaryDb);

      let user = await userRepo.getByGoogleId('mock-google-id');
      if (!user) {
        user = await userRepo.create({ googleId: 'mock-google-id', email: 'user@example.com' });
      }

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);
      const session = await sessionRepo.create(user.id, expiresAt);

      setCookie(c, SESSION_COOKIE_NAME, session.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        expires: expiresAt,
      });

      return c.json({ ok: true, user });
    })
    .get('/api/auth/me', auth, (c: Context<Env>) => c.json({ ok: true, user: c.get('user') }))
    .post('/api/auth/logout', async (c: Context<Env>) => {
      const sessionId = getCookie(c, SESSION_COOKIE_NAME);
      if (sessionId) {
        const sessionRepo = createSessionRepository(c.get('primaryDb'));
        await sessionRepo.delete(sessionId);
      }
      deleteCookie(c, SESSION_COOKIE_NAME);
      return c.json({ ok: true });
    })
    .get('/api/notes/list', auth, async (c: Context<Env>) => {
      const notes = await c.get('noteRepo').list();
      return c.json({ ok: true, notes });
    })
    .post('/api/notes/create', auth, async (c: Context<Env>) => {
      const input = await c.req.json<{ title: string; body: string | null }>();
      const note = await c.get('noteRepo').create(input);
      return c.json({ ok: true, note });
    })
    .post('/api/extract/run', auth, async (c: Context<Env>) => {
      const { text } = await c.req.json<{ text: string }>();
      const bundle = await runExtractionBundle(text);
      await c.get('extractionRepo').create({
        sourceText: text,
        prompt: bundle.debug.prompt,
        extraction: bundle.extraction,
        debug: bundle.debug,
      });
      return c.json({ ok: true, ...bundle });
    })
    .get('/api/extract/history/list', auth, async (c: Context<Env>) => {
      const limit = Number(c.req.query('limit')) || 20;
      const history = await c.get('extractionRepo').list(limit);
      return c.json({ ok: true, history });
    })
    .get('/api/extract/history/get/:id', auth, async (c: Context<Env>) => {
      const id = c.req.param('id');
      if (!id) return c.json({ ok: false, error: 'BAD_REQUEST' }, 400);
      const entry = await c.get('extractionRepo').getById(id);
      if (!entry) return c.json({ ok: false, error: 'NOT_FOUND' }, 404);
      return c.json({ ok: true, entry });
    })
    .post('/api/extract/compareLane', auth, async (c: Context<Env>) => {
      const { text, laneId } = await c.req.json<{ text: string; laneId: ExtractionLaneId }>();
      const lane = await runExtractionCompareLane(text, laneId);
      return c.json({ ok: true, lane });
    })
    .post('/api/extract/history/saveCompare', auth, async (c: Context<Env>) => {
      const { text, lanes } = await c.req.json<{ text: string; lanes: ExtractionLaneResult[] }>();
      const representativeLane = lanes.find(
        (lane) => lane.status === 'ok' && lane.extraction && lane.debug,
      );

      if (representativeLane?.extraction && representativeLane.debug) {
        await c.get('extractionRepo').create({
          sourceText: text,
          prompt: representativeLane.debug.prompt,
          extraction: representativeLane.extraction,
          debug: representativeLane.debug,
          compareLanes: lanes,
        });
      }

      return c.json({ ok: true, success: true });
    });

  return routes;
};

const appForType = createApp();
export type AppType = typeof appForType;
