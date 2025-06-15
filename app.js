import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { Hono } from 'hono';
import { createHash } from 'node:crypto';

const PORT = 3000;

import { getAgentAccount, signWithAgent } from '@neardefi/shade-agent-js';

const app = new Hono();

app.use('/*', cors());

app.get('/api/address', async (c) => {
    const res = await getAgentAccount();

    return c.json(res);
});

app.get('/api/test-sign', async (c) => {
    const path = 'foo';
    const res = await signWithAgent(path, [
        ...(await createHash('sha256').update(Buffer.from('testing'))).digest(),
    ]);

    return c.json(res);
});

console.log('Server listening on port: ', PORT);

serve({
    fetch: app.fetch,
    port: PORT,
    hostname: '0.0.0.0',
});
