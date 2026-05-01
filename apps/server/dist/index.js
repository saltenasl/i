import { serve } from '@hono/node-server';
import { createApp } from './app.js';
const app = createApp();
const port = 3000;
console.log(`Server is running on http://localhost:${port}`);
serve({
    fetch: app.fetch,
    port,
});
//# sourceMappingURL=index.js.map