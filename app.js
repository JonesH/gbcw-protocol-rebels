import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { Hono } from 'hono';
import { createHash } from 'node:crypto';
import { evaluateCredibility } from './utils/credibility.js';
import { signWithAgent } from '@neardefi/shade-agent-js';

const PORT = 3000;

import { getAgentAccount } from '@neardefi/shade-agent-js';

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

app.post('/api/evaluate', async (c) => {
    try {
        const { question } = await c.req.json();
        
        if (!question) {
            return c.json({ error: 'Question is required' }, 400);
        }

        // Evaluate the question
        const answer = await evaluateCredibility(question);
        
        // Create a hash of the question and answer for blockchain
        const data = JSON.stringify({ question, answer });
        const hash = await createHash('sha256').update(Buffer.from(data)).digest();
        
        // Remove signing with NEAR agent
        // const result = await signWithAgent('question-evaluation', [...hash]);
        
        // Return the answer and hash only
        return c.json({
            answer,
            hash: hash.toString('hex'),
            status: 'evaluated'
        });
    } catch (error) {
        console.error('Error in /api/evaluate:', error);
        return c.json({ error: error.message }, 500);
    }
});

app.post('/api/evaluate-local', async (c) => {
    try {
        const { question } = await c.req.json();
        if (!question) {
            return c.json({ error: 'Question is required' }, 400);
        }
        const answerBool = await evaluateCredibility(question);
        return c.json({ answer: answerBool ? 'yes' : 'no' });
    } catch (error) {
        console.error('Error in /api/evaluate-local:', error);
        return c.json({ error: error.message }, 500);
    }
});

console.log('Server listening on port: ', PORT);

serve({
    fetch: app.fetch,
    port: PORT,
    hostname: '0.0.0.0',
});
