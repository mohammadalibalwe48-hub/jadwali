import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';

const cacheDir = await mkdtemp(join(tmpdir(), 'jadwali-vision-'));
const vite = await createServer({ cacheDir, optimizeDeps: { noDiscovery: true }, server: { host: '127.0.0.1' } });
const originalFetch = globalThis.fetch;
const originalKey = process.env.AI_GATEWAY_API_KEY;

try {
  await vite.listen();
  const endpoint = `http://127.0.0.1:${vite.httpServer.address().port}/api/vision`;
  const post = (body, headers = {}) => fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const input = { images: ['data:image/jpeg;base64,/9j/2Q=='] };
  delete process.env.AI_GATEWAY_API_KEY;
  assert.equal((await post(input)).status, 503);

  const serverKey = 'test-only-server-key';
  process.env.AI_GATEWAY_API_KEY = serverKey;
  const expected = {
    sessions: [{
      day: 'الأحد', startTime: '08:30', endTime: '10:00',
      courseName: 'مهارات الحاسوب', courseCode: 'UNRC101', room: 'S-07', type: 'عملي',
    }],
    issues: [],
  };
  let gatewayOutput = [{ ...expected, portalTables: [] }];
  let gatewayCalls = 0;
  globalThis.fetch = (url, options) => {
    if (String(url) !== 'https://ai-gateway.vercel.sh/v3/ai/language-model') return originalFetch(url, options);
    gatewayCalls++;
    const headers = new Headers(options.headers);
    assert.equal(headers.get('authorization'), `Bearer ${serverKey}`);
    assert.equal(headers.get('ai-language-model-id'), 'alibaba/qwen3.7-flash');
    const request = JSON.parse(options.body);
    assert.equal(request.providerOptions.alibaba.enableThinking, false);
    assert.ok(request.prompt.some((message) => Array.isArray(message.content) &&
      message.content.some((part) => part.type === 'file' && part.mediaType === 'image/jpeg')));
    const result = typeof gatewayOutput === 'function' ? gatewayOutput(request.responseFormat.schema) : gatewayOutput;
    return Promise.resolve(Response.json({
      content: [{ type: 'text', text: JSON.stringify(result) }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: { inputTokens: { total: 20 }, outputTokens: { total: 10 } },
    }));
  };

  assert.equal((await fetch(endpoint)).status, 405);
  assert.equal((await post({ images: ['https://example.org/schedule.jpg'] })).status, 400);
  assert.equal((await post({ images: Array(9).fill(input.images[0]) })).status, 400);
  assert.equal(gatewayCalls, 0);
  const result = await post(input);
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), expected);
  assert.equal(gatewayCalls, 1);
  const { courseName, courseCode, ...meeting } = expected.sessions[0];
  const portalTables = [{
    rowCount: 3,
    catalog: [{ row: 2, courseName: 'Other course', courseCode: null }, { row: 3, courseName, courseCode }],
    meetings: [{ row: 3, ...meeting }],
  }];
  gatewayOutput = [{ sessions: [], portalTables, issues: ['ambiguous_join'] }];
  const multipleImages = { images: [...input.images, ...input.images] };
  const ambiguous = await post(multipleImages, { Authorization: 'Bearer client-value-ignored' });
  assert.equal(ambiguous.status, 200);
  assert.deepEqual(await ambiguous.json(), { sessions: [], issues: ['ambiguous_join'] });
  assert.equal(gatewayCalls, 2);
  gatewayOutput = [{ sessions: [], portalTables, issues: [] }];
  assert.deepEqual(await post(multipleImages).then((response) => response.json()), expected);
  gatewayOutput = [{ sessions: [], portalTables: [{ ...portalTables[0], catalog: [] }], issues: [] }];
  assert.deepEqual(await post(multipleImages).then((response) => response.json()), { sessions: [], issues: ['missing_catalog'] });
  gatewayOutput = [{ ...expected, portalTables: [], sessions: [{ ...expected.sessions[0], endTime: '07:00' }] }];
  assert.deepEqual(await post(input).then((response) => response.json()), { sessions: [], issues: ['unreadable'] });
  gatewayOutput = (schema) => schema.properties.portalTables
    ? [{ sessions: [{ ...meeting, courseName: null, courseCode: null }], portalTables: [{ ...portalTables[0], meetings: [] }], issues: [] }]
    : { meetings: [{ ...meeting, row: 3, day: 'الاثنين' }] };
  assert.deepEqual(await post(multipleImages).then((response) => response.json()), {
    sessions: [{ ...expected.sessions[0], day: 'الإثنين' }],
    issues: [],
  });
  console.log('Vision API passed with server credentials, array-wrapped Qwen responses, and input validation.');
} finally {
  globalThis.fetch = originalFetch;
  if (originalKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
  else process.env.AI_GATEWAY_API_KEY = originalKey;
  await vite.close();
  await rm(cacheDir, { recursive: true, force: true });
}
