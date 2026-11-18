import type { IncomingMessage, ServerResponse } from 'node:http';
import { renderScheduleVectorPdf, type PdfRequestPayload } from '../server/pdfGenerator.js';

function readBody(req: IncomingMessage & { body?: any }): Promise<PdfRequestPayload> {
  if (req.body && typeof req.body === 'object') {
    return Promise.resolve(req.body as PdfRequestPayload);
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    return Promise.resolve(JSON.parse(req.body) as PdfRequestPayload);
  }
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.from(c)));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve((raw ? JSON.parse(raw) : {}) as PdfRequestPayload);
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export default async function handler(
  req: IncomingMessage & { body?: any; method?: string },
  res: ServerResponse
) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  try {
    const payload = await readBody(req);
    const pdfBuffer = await renderScheduleVectorPdf(payload);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="schedule.pdf"');
    res.setHeader('Content-Length', String(pdfBuffer.length));
    res.end(pdfBuffer);
  } catch (err: any) {
    console.error('Vercel PDF endpoint error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: err?.message || 'تعذّر إنشاء ملف PDF.' }));
  }
}
