import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHash } from 'node:crypto';
import { del, get, put, BlobPreconditionFailedError } from '@vercel/blob';
import { envelopeSchema, MAX_BACKUP_BYTES } from '../src/services/backupProtocol.js';

const etagPattern = /^(?:W\/)?"[A-Za-z0-9_:-]{1,128}"$/;

async function readEnvelope(req: IncomingMessage & { body?: unknown }) {
  if (Number(req.headers['content-length']) > MAX_BACKUP_BYTES) throw new RangeError();
  let body = req.body;
  if (body === undefined) {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const part of req.iterator({ destroyOnReturn: false })) {
      const chunk = Buffer.from(part);
      size += chunk.length;
      if (size > MAX_BACKUP_BYTES) {
        req.resume();
        throw new RangeError();
      }
      chunks.push(chunk);
    }
    body = Buffer.concat(chunks);
  }
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  if (typeof body === 'string') {
    if (Buffer.byteLength(body) > MAX_BACKUP_BYTES) throw new RangeError();
    body = JSON.parse(body);
  }
  return envelopeSchema.parse(body);
}

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Type', 'application/json');
  const send = (status: number) => { res.statusCode = status; res.end(); };
  if (req.method !== 'GET' && req.method !== 'PUT' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'GET, PUT, DELETE');
    return send(405);
  }
  const token = req.headers.authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
  if (!token) return send(401);
  if (!process.env.BLOB_STORE_ID && !process.env.BLOB_READ_WRITE_TOKEN) return send(503);
  const revision = req.method === 'GET' ? req.headers['if-none-match'] : req.headers['if-match'];
  if (revision !== undefined && (typeof revision !== 'string' || !etagPattern.test(revision))) return send(400);
  // Vercel marks the response ETag weak after compression; Blob expects its original revision.
  const tag = revision?.replace(/^W\//, '');
  const pathname = `backups/v1/${createHash('sha256').update(token).digest('hex')}.json`;

  try {
    if (req.method === 'GET') {
      const backup = await get(pathname, { access: 'private', useCache: false, ifNoneMatch: tag });
      if (!backup) return send(404);
      const etag = backup.blob.etag || tag;
      if (etag) res.setHeader('ETag', etag);
      if (backup.statusCode === 304) return send(304);
      if (backup.blob.size > MAX_BACKUP_BYTES) return send(502);
      res.end(await new Response(backup.stream).text());
      return;
    }

    if (req.method === 'DELETE') {
      if (!tag) return send(428);
      await del(pathname, { ifMatch: tag });
      return send(204);
    }

    if (req.headers['content-type']?.split(';')[0].trim() !== 'application/json') return send(415);
    let envelope;
    try {
      envelope = await readEnvelope(req);
    } catch (error) {
      return send(error instanceof RangeError ? 413 : 400);
    }

    const backup = await put(pathname, JSON.stringify(envelope), {
      access: 'private', addRandomSuffix: false, contentType: 'application/json', ifMatch: tag,
    });
    res.setHeader('ETag', backup.etag);
    return send(204);
  } catch (error) {
    if (error instanceof BlobPreconditionFailedError) return send(412);
    console.error('Encrypted backup storage request failed', error instanceof Error ? error.name : 'unknown');
    return send(503);
  }
}
