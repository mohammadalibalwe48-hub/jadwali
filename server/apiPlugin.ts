import type { Plugin } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { renderScheduleVectorPdf } from './pdfGenerator';

function readJsonBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export function dawamnaApiPlugin(): Plugin {
  return {
    name: 'dawamna-local-pdf-api',
    configureServer(server) {
      server.middlewares.use(async (req, res: ServerResponse, next) => {
        const url = req.url?.split('?')[0];

        if (req.method === 'POST' && url === '/api/pdf') {
          try {
            const body = await readJsonBody(req);
            const pdfBuffer = await renderScheduleVectorPdf(body);
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename="schedule.pdf"');
            res.setHeader('Content-Length', String(pdfBuffer.length));
            res.end(pdfBuffer);
            return;
          } catch (err: any) {
            console.error('PDF endpoint error:', err);
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ error: err?.message || 'تعذّر إنشاء ملف الـ PDF.' }));
            return;
          }
        }

        next();
      });
    },
  };
}
