import { z } from 'zod';
import { DAYS_ORDER, type FloorRule, type LectureSession, type ScheduleMetadata } from '../types';
import { envelopeSchema, MAX_BACKUP_BYTES, type Envelope } from './backupProtocol';
import type { Attendance } from '../utils/attendance';

export interface ScheduleBackup {
  version: 1;
  sessions: LectureSession[];
  metadata: ScheduleMetadata;
  floorRules: FloorRule[];
  attendance: Attendance;
}

const text = z.string();
const sessionSchema = z.object({
  id: text, day: z.enum(DAYS_ORDER), startTime: text, endTime: text,
  courseName: text, courseCode: text.optional(), type: z.enum(['نظري', 'عملي']),
  room: text, floor: text.default(''), floorAuto: z.boolean().default(false),
});
const backupSchema: z.ZodType<ScheduleBackup> = z.object({
  version: z.literal(1),
  sessions: z.array(sessionSchema),
  metadata: z.object({ title: text, subtitle: text, semester: text }),
  floorRules: z.array(z.object({ id: text, prefix: text, floor: text, example: text })),
  attendance: z.object({
    records: z.array(z.object({
      sessionId: text, date: text.regex(/^\d{4}-\d{2}-\d{2}$/),
      course: text, name: text, mark: z.enum(['present', 'late', 'missed']),
    })),
    limits: z.record(text, z.number().int().min(0).max(100)),
  }),
});

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const recoveryPattern = /^[A-Za-z0-9_-]{43}$/;
const context = encoder.encode('jadwali-backup-v1');

function encode(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function decode(value: string) {
  return Uint8Array.from(atob(value.replaceAll('-', '+').replaceAll('_', '/')), (byte) => byte.charCodeAt(0));
}

export function newRecoveryCode() {
  return encode(crypto.getRandomValues(new Uint8Array(32)));
}

function keyFor(code: string) {
  return crypto.subtle.importKey('raw', decode(code), 'AES-GCM', false, ['encrypt', 'decrypt']);
}

async function authorization(code: string) {
  if (!recoveryPattern.test(code) || encode(decode(code)) !== code) throw new Error('invalid_code');
  const token = await crypto.subtle.digest('SHA-256', encoder.encode(`jadwali-backup-access-v1:${code}`));
  return 'Bearer ' + encode(new Uint8Array(token));
}

function stableJson(value: unknown) {
  return JSON.stringify(value, (_key, nested: unknown) => {
    if (!nested || typeof nested !== 'object' || Array.isArray(nested)) return nested;
    const record = nested as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, record[key]]));
  });
}

export async function backupHash(backup: ScheduleBackup) {
  const hash = await crypto.subtle.digest('SHA-256', encoder.encode(stableJson(backupSchema.parse(backup))));
  return encode(new Uint8Array(hash));
}

export async function encryptBackup(code: string, backup: ScheduleBackup): Promise<Envelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: context }, await keyFor(code), encoder.encode(stableJson(backupSchema.parse(backup))),
  );
  const data = encode(new Uint8Array(encrypted));
  if (data.length > MAX_BACKUP_BYTES - 128) throw new Error('too_large');
  return { version: 1, iv: encode(iv), data };
}

export async function decryptBackup(code: string, value: unknown) {
  const envelope = envelopeSchema.parse(value);
  const contents = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: decode(envelope.iv), additionalData: context }, await keyFor(code), decode(envelope.data),
  );
  return backupSchema.parse(JSON.parse(decoder.decode(contents)));
}

async function request(code: string, method: 'GET' | 'PUT' | 'DELETE', etag?: string, body?: string) {
  const headers = new Headers({ Authorization: await authorization(code) });
  if (method === 'PUT') {
    headers.set('Content-Type', 'application/json');
  }
  if (etag) headers.set(method === 'GET' ? 'If-None-Match' : 'If-Match', etag);
  return fetch('/api/backup', { method, headers, body, cache: 'no-store', signal: AbortSignal.timeout(15_000) });
}

export async function downloadBackup(code: string, knownEtag?: string) {
  const response = await request(code, 'GET', knownEtag);
  if (response.status === 304) return null;
  if (!response.ok) throw new Error(response.status === 404 ? 'not_found' : 'storage_error');
  const etag = response.headers.get('ETag');
  if (!etag) throw new Error('storage_error');
  return { snapshot: await decryptBackup(code, await response.json()), etag };
}

export async function uploadBackup(code: string, backup: ScheduleBackup, knownEtag?: string) {
  const body = JSON.stringify(await encryptBackup(code, backup));
  const response = await request(code, 'PUT', knownEtag, body);
  if (response.status === 412) return null;
  const etag = response.headers.get('ETag');
  if (!response.ok || !etag) throw new Error('storage_error');
  return etag;
}

export async function deleteBackup(code: string, etag: string) {
  const response = await request(code, 'DELETE', etag);
  if (response.status === 412) throw new Error('updated_remotely');
  if (!response.ok) throw new Error('storage_error');
}
