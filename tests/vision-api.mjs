import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer as createViteServer } from 'vite';

let answer = {
  sessions: [{
    day: 'الأحد', startTime: '08:30', endTime: '10:00',
    courseName: 'مهارات الحاسوب', courseCode: 'UNRC101', room: 'S-07', type: 'عملي',
  }],
  issues: ['cropped'],
};
let received;
const model = createServer(async (req, res) => {
  assert.equal(req.url, '/api/chat');
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  received = JSON.parse(Buffer.concat(chunks).toString());
  const content = JSON.stringify(answer);
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ message: { content } }));
}).listen(0, '127.0.0.1');
await once(model, 'listening');

process.env.JADWALI_OLLAMA_URL = `http://127.0.0.1:${model.address().port}`;
process.env.JADWALI_OLLAMA_ACCESS_CODE = 'test-only';
const cacheDir = await mkdtemp(join(tmpdir(), 'jadwali-vision-'));
const vite = await createViteServer({ cacheDir, optimizeDeps: { noDiscovery: true }, server: { port: 0, host: '127.0.0.1' } });
try {
  await vite.listen();
  const address = vite.httpServer.address();
  const endpoint = `http://127.0.0.1:${address.port}/api/vision`;
  const configuration = await fetch(endpoint).then((response) => response.json());
  assert.deepEqual(configuration, { ollama: true, requiresCode: true });
  const post = (body, credential) => fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(credential ? { Authorization: `Bearer ${credential}` } : {}) },
    body: JSON.stringify(body),
  });

  const input = { mode: 'ollama', images: ['data:image/jpeg;base64,/9j/2Q=='] };
  assert.equal((await post(input)).status, 401);
  assert.equal((await post({ ...input, mode: 'gateway' })).status, 401);
  assert.equal((await post({ ...input, images: ['https://example.org/schedule.jpg'] }, 'test-only')).status, 400);
  assert.equal(received, undefined);
  const result = await post(input, 'test-only');
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), answer);
  assert.equal(received.model, 'qwen3-vl:8b');
  assert.deepEqual(received.messages[1].images, ['/9j/2Q==']);
  assert.equal(received.format.properties.sessions.type, 'array');

  answer = { ...answer, sessions: [{ ...answer.sessions[0], startTime: '13:00' }] };
  assert.deepEqual(await post(input, 'test-only').then((response) => response.json()), { sessions: [], issues: ['cropped'] });
  const gatewayInput = { ...input, mode: 'gateway' };
  const expected = {
    sessions: [{ ...answer.sessions[0], startTime: '08:30' }],
    issues: [],
  };
  let gatewayOutput = [expected];
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = (url, options) => {
      if (String(url) !== 'https://ai-gateway.vercel.sh/v3/ai/language-model') return originalFetch(url, options);
      assert.equal(new Headers(options.headers).get('ai-language-model-id'), 'alibaba/qwen3.7-flash');
      assert.equal(JSON.parse(options.body).providerOptions.alibaba.enableThinking, false);
      return Promise.resolve(Response.json({
        content: [{ type: 'text', text: JSON.stringify(gatewayOutput) }],
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: { inputTokens: { total: 20 }, outputTokens: { total: 10 } },
      }));
    };

    const qwen = await post(gatewayInput, 'test-only');
    assert.equal(qwen.status, 200);
    assert.deepEqual(await qwen.json(), expected);
    gatewayOutput = [{ ...expected, issues: ['ambiguous_join'] }];
    const ambiguous = await post(gatewayInput, 'test-only');
    assert.equal(ambiguous.status, 200);
    assert.deepEqual(await ambiguous.json(), { sessions: [], issues: ['ambiguous_join'] });
  } finally {
    globalThis.fetch = originalFetch;
  }
  console.log('Vision API passed with mock Ollama and Qwen responses.');
} finally {
  await vite.close();
  await rm(cacheDir, { recursive: true, force: true });
  await new Promise((resolve, reject) => model.close((error) => error ? reject(error) : resolve()));
}
