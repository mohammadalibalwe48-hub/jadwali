import type { IncomingMessage, ServerResponse } from 'node:http';
import { z } from 'zod';
import { DAYS_ORDER } from '../src/types.js';
import { renderScheduleVectorPdf } from '../server/pdfGenerator.js';

const maxBodyBytes = 1_000_000;
const label = z.string().max(300);
const timetable = z.object({
  locale: z.enum(['ar', 'en']).optional(),
  metadata: z.object({ title: label.optional(), subtitle: label.optional(), semester: label.optional() }).optional(),
  sessions: z.array(z.object({
    day: z.enum(DAYS_ORDER),
    startTime: z.string().max(16),
    endTime: z.string().max(16),
    courseName: label,
    courseCode: z.string().max(64).optional(),
    type: z.enum(['نظري', 'عملي']),
    room: label,
    floor: label.default(''),
  })).min(1).max(300),
  floorRules: z.array(z.object({ prefix: label, floor: label })).max(60).default([]),
});

async function readBody(req: IncomingMessage & { body?: unknown }): Promise<unknown> {
  if (req.body !== undefined) {
    const body = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body;
    const size = Buffer.byteLength(typeof body === 'string' ? body : JSON.stringify(body));
    if (size > maxBodyBytes) throw new RangeError();
    return body;
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const part of req.iterator({ destroyOnReturn: false })) {
    const chunk = Buffer.from(part);
    size += chunk.length;
    if (size > maxBodyBytes) {
      req.resume();
      throw new RangeError();
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function sendError(res: ServerResponse, status: number, message: string, forBrowser: boolean, locale: 'ar' | 'en' = 'ar') {
  res.statusCode = status;
  if (!forBrowser) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: message }));
    return;
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  const title = locale === 'en' ? 'Could not export the timetable' : 'تعذّر تصدير الجدول';
  res.end(`<!doctype html><html lang="${locale}" dir="${locale === 'en' ? 'ltr' : 'rtl'}"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title}</title>
    <style>body{margin:10vh auto;padding:0 1.5rem;max-width:34rem;font:1.05rem system-ui,sans-serif;color:#14254d;background:#f3f6ff}a{color:#154cce}</style>
    </head><body><h1>${title}</h1><p>${locale === 'en' ? 'Return to Jadwali and try exporting again.' : message}</p><p><a href="/">${locale === 'en' ? 'Back to Jadwali' : 'العودة إلى جدولي'}</a></p></body></html>`);
}

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendError(res, 405, 'طريقة الطلب غير مدعومة.', false);
  }

  const mediaType = req.headers['content-type']?.split(';')[0].trim();
  const forBrowser = mediaType === 'application/x-www-form-urlencoded';
  if (!forBrowser && mediaType !== 'application/json') {
    return sendError(res, 415, 'صيغة الطلب غير مدعومة.', false);
  }
  if (Number(req.headers['content-length']) > maxBodyBytes) {
    return sendError(res, 413, 'الجدول أكبر من الحد المسموح للتصدير.', forBrowser);
  }

  let data: z.infer<typeof timetable>;
  let disposition = 'attachment';
  let locale: 'ar' | 'en' = 'ar';
  try {
    const raw = await readBody(req);
    if (forBrowser) {
      const form = new URLSearchParams(typeof raw === 'string' ? raw : z.record(z.string(), z.string()).parse(raw));
      locale = form.get('locale') === 'en' ? 'en' : 'ar';
      data = timetable.parse(JSON.parse(form.get('payload') ?? ''));
      if (form.get('disposition') === 'inline') disposition = 'inline';
    } else {
      data = timetable.parse(typeof raw === 'string' ? JSON.parse(raw) : raw);
    }
    locale = data.locale ?? locale;
  } catch (error) {
    if (error instanceof RangeError) {
      return sendError(res, 413, 'الجدول أكبر من الحد المسموح للتصدير.', forBrowser);
    }
    return sendError(res, 400, 'تعذّرت قراءة بيانات الجدول. افتح جدولي وحاول مرة أخرى.', forBrowser, locale);
  }

  try {
    const pdf = await renderScheduleVectorPdf(data);
    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${disposition}; filename="schedule.pdf"`,
      'Content-Length': String(pdf.length),
    });
    res.end(pdf);
  } catch (error) {
    console.error('PDF generation failed:', error instanceof Error ? error.message : 'unknown error');
    sendError(res, 500, 'تعذّر إنشاء الملف. حاول مرة أخرى.', forBrowser, locale);
  }
}
