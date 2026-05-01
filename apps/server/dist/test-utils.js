import { closeDb, initializePrimaryRuntimeDatabase, initializeUserRuntimeDatabase, } from '@repo/db';
export const createTestContext = async () => {
    const primaryDb = await initializePrimaryRuntimeDatabase({
        dbPath: ':memory:',
    });
    const userDbs = new Map();
    const getUserDb = async (userId) => {
        let db = userDbs.get(userId);
        if (!db) {
            db = await initializeUserRuntimeDatabase({
                dbPath: ':memory:',
                seedProfile: 'fresh',
            });
            userDbs.set(userId, db);
        }
        return db;
    };
    return {
        primaryDb,
        getUserDb,
        async cleanup() {
            await closeDb(primaryDb);
            for (const db of userDbs.values()) {
                await closeDb(db);
            }
        },
    };
};
export const mockFetchWithHono = (app) => {
    const originalFetch = global.fetch;
    const cookieJar = new Map();
    global.fetch = async (input, init) => {
        let url;
        if (typeof input === 'string') {
            url = input;
        }
        else if (input instanceof URL) {
            url = input.toString();
        }
        else {
            url = input.url;
        }
        if (url.startsWith('/')) {
            url = `http://localhost${url}`;
        }
        const requestInit = { ...init };
        const headers = new Headers(requestInit.headers);
        const cookieHeader = Array.from(cookieJar.entries())
            .map(([name, value]) => `${name}=${value}`)
            .join('; ');
        if (cookieHeader) {
            headers.set('Cookie', cookieHeader);
        }
        requestInit.headers = headers;
        const request = new Request(url, requestInit);
        const response = await app.request(request);
        const setCookie = response.headers.get('Set-Cookie');
        if (setCookie) {
            const parts = setCookie.split(';');
            const [nameValue] = parts;
            if (nameValue) {
                const [name, value] = nameValue.split('=');
                if (name && value) {
                    cookieJar.set(name.trim(), value.trim());
                }
            }
        }
        return response;
    };
    return () => {
        global.fetch = originalFetch;
    };
};
//# sourceMappingURL=test-utils.js.map