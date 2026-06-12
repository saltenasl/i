import path from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import { extractCompareLane, extractWithDebug, } from '@repo/auto-extract';
import { createExtractionHistoryRepository, createNoteRepository, createSessionRepository, createUserRepository, initializePrimaryRuntimeDatabase, initializeUserRuntimeDatabase, } from '@repo/db';
import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { logger } from 'hono/logger';
// --- Configuration ---
const PRIMARY_DB_PATH = process.env.PRIMARY_DB_PATH || path.join(process.cwd(), 'data/primary.sqlite');
const USER_DATA_DIR = process.env.USER_DATA_DIR || path.join(process.cwd(), 'data/users');
const SESSION_COOKIE_NAME = 'app_session';
const SESSION_DURATION_DAYS = 30;
export const createApp = (deps) => {
    const app = new Hono();
    app.use('*', logger());
    // Serve static files in production
    if (process.env.NODE_ENV === 'production') {
        const isRootCwd = process.cwd().endsWith('/server') === false;
        const staticRoot = isRootCwd
            ? path.resolve(process.cwd(), 'apps/renderer/dist')
            : path.resolve(process.cwd(), '../renderer/dist');
        const rootPath = path.relative(process.cwd(), staticRoot) || '.';
        console.log('[App] serveStatic rootPath:', rootPath, 'ALLOW_MOCK_LOGIN:', process.env.ALLOW_MOCK_LOGIN);
        app.use('/*', serveStatic({ root: rootPath }));
    }
    const getPrimaryDb = deps?.getPrimaryDb ||
        (async () => {
            return await initializePrimaryRuntimeDatabase({ dbPath: PRIMARY_DB_PATH });
        });
    const getUserDb = deps?.getUserDb ||
        (async (userId) => {
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
    const auth = async (c, next) => {
        const sessionId = getCookie(c, SESSION_COOKIE_NAME);
        if (!sessionId)
            return c.json({ ok: false, error: 'UNAUTHORIZED' }, 401);
        const primaryDb = c.get('primaryDb');
        const sessionRepo = createSessionRepository(primaryDb);
        const session = await sessionRepo.getById(sessionId);
        if (!session || new Date(session.expiresAt) < new Date()) {
            deleteCookie(c, SESSION_COOKIE_NAME);
            return c.json({ ok: false, error: 'UNAUTHORIZED' }, 401);
        }
        // Sliding session: if under 15 days remaining, refresh to 30 days
        const msRemaining = new Date(session.expiresAt).getTime() - Date.now();
        const daysRemaining = msRemaining / (1000 * 60 * 60 * 24);
        if (daysRemaining < 15) {
            const newExpiresAt = new Date();
            newExpiresAt.setDate(newExpiresAt.getDate() + SESSION_DURATION_DAYS);
            await sessionRepo.updateExpiration(sessionId, newExpiresAt);
            setCookie(c, SESSION_COOKIE_NAME, sessionId, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'Lax',
                expires: newExpiresAt,
                path: '/',
            });
        }
        const userRepo = createUserRepository(primaryDb);
        const user = await userRepo.getById(session.userId);
        if (!user)
            return c.json({ ok: false, error: 'UNAUTHORIZED' }, 401);
        c.set('user', { id: user.id, email: user.email });
        const userDb = await getUserDb(user.id);
        c.set('userDb', userDb);
        c.set('noteRepo', createNoteRepository(userDb));
        c.set('extractionRepo', createExtractionHistoryRepository(userDb));
        await next();
    };
    const routes = app
        .get('/api/health', (c) => c.json({ status: 'ok' }))
        .get('/api/auth/google', async (c) => {
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5173/api/auth/google/callback';
        if (!clientId)
            return c.json({ ok: false, error: 'MISSING_CLIENT_ID' }, 500);
        const state = crypto.randomUUID();
        setCookie(c, 'oauth_state', state, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 60 * 10, // 10 minutes
            sameSite: 'Lax',
            path: '/',
        });
        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'openid email profile',
            access_type: 'offline',
            state,
        });
        return c.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
    })
        .get('/api/auth/google/callback', async (c) => {
        const code = c.req.query('code');
        const state = c.req.query('state');
        const savedState = getCookie(c, 'oauth_state');
        if (!code || !state || state !== savedState) {
            return c.json({ ok: false, error: 'INVALID_STATE_OR_CODE' }, 400);
        }
        deleteCookie(c, 'oauth_state');
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
        const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5173/api/auth/google/callback';
        if (!clientId || !clientSecret)
            return c.json({ ok: false, error: 'MISSING_CREDENTIALS' }, 500);
        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                code,
                grant_type: 'authorization_code',
                redirect_uri: redirectUri,
            }),
        });
        if (!tokenRes.ok)
            return c.json({ ok: false, error: 'FAILED_TO_EXCHANGE_CODE' }, 400);
        const tokenData = await tokenRes.json();
        const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        if (!userRes.ok)
            return c.json({ ok: false, error: 'FAILED_TO_FETCH_USER' }, 400);
        const userData = await userRes.json();
        const primaryDb = c.get('primaryDb');
        const userRepo = createUserRepository(primaryDb);
        const sessionRepo = createSessionRepository(primaryDb);
        let user = await userRepo.getByGoogleId(userData.id);
        if (!user) {
            user = await userRepo.create({ googleId: userData.id, email: userData.email });
        }
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);
        const session = await sessionRepo.create(user.id, expiresAt);
        setCookie(c, SESSION_COOKIE_NAME, session.id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Lax',
            expires: expiresAt,
            path: '/',
        });
        return c.redirect('/');
    })
        .get('/api/auth/mock-login', async (c) => {
        // Keep for dev/tests
        if (process.env.NODE_ENV === 'production' && process.env.ALLOW_MOCK_LOGIN !== 'true')
            return c.json({ ok: false, error: 'NOT_FOUND' }, 404);
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
            sameSite: 'Lax',
            expires: expiresAt,
            path: '/',
        });
        return c.json({ ok: true, user });
    })
        .get('/api/auth/me', auth, (c) => c.json({ ok: true, user: c.get('user') }))
        .post('/api/auth/logout', async (c) => {
        const sessionId = getCookie(c, SESSION_COOKIE_NAME);
        if (sessionId) {
            const sessionRepo = createSessionRepository(c.get('primaryDb'));
            await sessionRepo.delete(sessionId);
        }
        deleteCookie(c, SESSION_COOKIE_NAME);
        return c.json({ ok: true });
    })
        .get('/api/notes/list', auth, async (c) => {
        const notes = await c.get('noteRepo').list();
        return c.json({ ok: true, notes });
    })
        .post('/api/notes/create', auth, async (c) => {
        const input = await c.req.json();
        const note = await c.get('noteRepo').create(input);
        return c.json({ ok: true, note });
    })
        .post('/api/extract/run', auth, async (c) => {
        const { text } = await c.req.json();
        const bundle = await runExtractionBundle(text);
        await c.get('extractionRepo').create({
            sourceText: text,
            prompt: bundle.debug.prompt,
            extraction: bundle.extraction,
            debug: bundle.debug,
        });
        return c.json({ ok: true, ...bundle });
    })
        .get('/api/extract/history/list', auth, async (c) => {
        const limit = Number(c.req.query('limit')) || 20;
        const history = await c.get('extractionRepo').list(limit);
        return c.json({ ok: true, history });
    })
        .get('/api/extract/history/get/:id', auth, async (c) => {
        const id = c.req.param('id');
        if (!id)
            return c.json({ ok: false, error: 'BAD_REQUEST' }, 400);
        const entry = await c.get('extractionRepo').getById(id);
        if (!entry)
            return c.json({ ok: false, error: 'NOT_FOUND' }, 404);
        return c.json({ ok: true, entry });
    })
        .post('/api/extract/compareLane', auth, async (c) => {
        const { text, laneId } = await c.req.json();
        const lane = await runExtractionCompareLane(text, laneId);
        return c.json({ ok: true, lane });
    })
        .post('/api/extract/history/saveCompare', auth, async (c) => {
        const { text, lanes } = await c.req.json();
        const representativeLane = lanes.find((lane) => lane.status === 'ok' && lane.extraction && lane.debug);
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
//# sourceMappingURL=app.js.map