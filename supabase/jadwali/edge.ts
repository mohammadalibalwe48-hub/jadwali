// Appended to the existing scanner by build-edge.mjs for a single-file deployment.
const reply = (status: number, value: unknown) => Response.json(value, {
  status, headers: { 'Cache-Control': 'no-store' },
});

Deno.serve(async (request) => {
  if (request.method !== 'POST') return reply(405, { error: 'Method not allowed' });
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') ?? '')) {
    return reply(415, { error: 'Send JSON' });
  }
  if (Number(request.headers.get('content-length')) > MAX_VISION_BODY) {
    return reply(413, { error: 'Images are too large' });
  }

  let body: unknown;
  try {
    const stream = request.body?.getReader();
    if (!stream) return reply(400, { error: 'Missing images' });
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await stream.read();
      if (done) break;
      size += value.length;
      if (size > MAX_VISION_BODY) {
        await stream.cancel();
        return reply(413, { error: 'Images are too large' });
      }
      chunks.push(value);
    }
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!inputSchema.safeParse(body).success) return reply(400, { error: 'Invalid images' });
  } catch {
    return reply(400, { error: 'Invalid request' });
  }

  const apiKey = Deno.env.get('JADWALI_AI_GATEWAY_API_KEY')?.trim();
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const url = Deno.env.get('SUPABASE_URL');
  if (!apiKey || !serviceKey || !url) return reply(503, { error: 'Scanner unavailable' });

  try {
    const quota = await fetch(url + '/rest/v1/rpc/jadwali_reserve_scan', {
      method: 'POST',
      headers: { apikey: serviceKey, Authorization: 'Bearer ' + serviceKey, 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(5000),
    });
    if (!quota.ok) return reply(503, { error: 'Scanner unavailable' });
    if (await quota.json() !== true) return reply(429, { error: 'Daily scan limit reached' });
  } catch {
    return reply(503, { error: 'Scanner unavailable' });
  }

  let status = 500;
  let response = '';
  const input = { method: 'POST', body, headers: { 'content-type': 'application/json' } };
  const output = {
    writeHead(code: number) { status = code; },
    end(text: string) { response = text; },
  };
  await handler(input as IncomingMessage, output as unknown as ServerResponse, apiKey);
  return new Response(response, {
    status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
});
