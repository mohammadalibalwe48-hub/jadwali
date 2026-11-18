import { z } from 'zod';

export const MAX_BACKUP_BYTES = 512 * 1024;
export const envelopeSchema = z.object({
  version: z.literal(1),
  iv: z.string().regex(/^[A-Za-z0-9_-]{16}$/),
  data: z.string().min(22).max(MAX_BACKUP_BYTES - 128).regex(/^[A-Za-z0-9_-]+$/),
}).strict();
export type Envelope = z.infer<typeof envelopeSchema>;

