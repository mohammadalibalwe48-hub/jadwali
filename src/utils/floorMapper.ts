import type { FloorRule } from '../types';

export const DEFAULT_FLOOR_RULES: FloorRule[] = [
  { id: 'rule-b', prefix: 'B', floor: 'القبو', example: 'B-01, B-06' },
  { id: 'rule-aud', prefix: 'المدرّج', floor: 'الأرضي', example: 'المدرّج / مدرج' },
  { id: 'rule-f', prefix: 'F', floor: 'الأول', example: 'F-01A, F-03' },
  { id: 'rule-s', prefix: 'S', floor: 'الثاني', example: 'S-01B, S-07' },
  { id: 'rule-l', prefix: 'L', floor: 'الخامس', example: 'L-02, L-12' },
];

/**
 * Normalizes a room code and strips accidental trailing session-type letters (like L-02T -> L-02)
 * while preserving valid sub-room suffixes like A or B (e.g. S-01B, F-01A).
 */
export function cleanRoomCode(rawRoom: string): { room: string; hintedType?: 'نظري' | 'عملي' } {
  const trimmed = rawRoom.trim();
  if (!trimmed) return { room: '' };

  if (
    trimmed.includes('مدرج') ||
    trimmed.includes('مدرّج') ||
    trimmed.toLowerCase().includes('auditorium')
  ) {
    return { room: 'المدرّج' };
  }

  // Match pattern like L-02T or B-06P where T/P is stuck to the room number
  const stuckTypeMatch = trimmed.match(/^([A-Za-z]-\d{1,3}[ABab]?)\s*([TPtp])$/);
  if (stuckTypeMatch) {
    const clean = stuckTypeMatch[1].toUpperCase();
    const typeChar = stuckTypeMatch[2].toUpperCase();
    return {
      room: clean,
      hintedType: typeChar === 'T' ? 'نظري' : 'عملي',
    };
  }

  // Normalize standard code casing e.g. s-01b -> S-01B
  if (/^[A-Za-z]\s*-?\s*\d/.test(trimmed)) {
    const normalized = trimmed
      .toUpperCase()
      .replace(/^([A-Z])\s*(\d)/, '$1-$2')
      .replace(/\s+/g, '');
    return { room: normalized };
  }

  return { room: trimmed };
}

/**
 * Automatically maps a room code (e.g. B-06, S-01B, L-12, المدرّج) to its floor name.
 */
export function detectFloorFromRoom(room: string, rules: FloorRule[] = DEFAULT_FLOOR_RULES): string {
  const clean = room.trim();
  if (!clean) return '';

  const normalizedArabic = clean.replace(/ّ/g, '');

  // Check auditorium / ground floor keywords first
  if (
    normalizedArabic.includes('مدرج') ||
    clean.toLowerCase().includes('auditorium') ||
    clean.toUpperCase().startsWith('G-') ||
    clean.toUpperCase() === 'G'
  ) {
    const audRule = rules.find(
      (r) => r.prefix.replace(/ّ/g, '').includes('مدرج') || r.prefix.toUpperCase() === 'G'
    );
    return audRule ? audRule.floor : 'الأرضي';
  }

  // Match letter prefix (e.g., B-06 -> B, S-01B -> S, L-12 -> L)
  const prefixMatch = clean.toUpperCase().match(/^([A-Z])/);
  if (prefixMatch) {
    const letter = prefixMatch[1];
    const matched = rules.find((r) => r.prefix.toUpperCase() === letter);
    if (matched) {
      return matched.floor;
    }
  }

  // Direct substring check for custom Arabic rules
  for (const rule of rules) {
    const cleanPrefix = rule.prefix.trim().replace(/ّ/g, '');
    if (cleanPrefix.length > 1 && normalizedArabic.includes(cleanPrefix)) {
      return rule.floor;
    }
  }

  return 'غير محدّد';
}
