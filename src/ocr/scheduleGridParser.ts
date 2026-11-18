import { DAYS_ORDER, type DayOfWeek, type SessionType } from '../types';
import { courseNameForCode, normalizeArabicDigits, normalizeAsciiDigits, type ParsedRawSession } from './scheduleOcrParser';

export interface GridText {
  ar: string;
  en: string;
  retry?: string;
}

const ARABIC_DAYS = ['سبت', 'احد', 'اثنين', 'ثلاثاء', 'اربعاء', 'خميس', 'جمعه'];
const ENGLISH_DAYS = [/^sat(?:urday)?$/, /^sun(?:day)?$/, /^mon(?:day)?$/, /^tue(?:s|sday)?$/,
  /^wed(?:s|nesday)?$/, /^thu(?:r|rs|rsday)?$/, /^fri(?:day)?$/];

export function normalizeHeader(text: string): string {
  return text.normalize('NFKC').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه')
    .replace(/[\u0640\u064b-\u065f]/g, '').replace(/[^\p{L}\s]/gu, '').trim().toLowerCase();
}

export function readDay(cell: GridText): DayOfWeek | undefined {
  const ar = normalizeHeader(cell.ar).replace(/^يوم\s+/, '').replace(/^ال/, '');
  const en = normalizeHeader(cell.en).replace(/\s+/g, '');
  const a = ARABIC_DAYS.indexOf(ar);
  const e = ENGLISH_DAYS.findIndex((day) => day.test(en));
  return DAYS_ORDER[a === -1 ? e : a];
}

export function readCode(text: string): string | undefined {
  const match = normalizeArabicDigits(text).match(/^\s*([a-z]{2,8})\s*[-_]?\s*(\d{2,5}[a-z]?)\s*$/i);
  return match ? (match[1] + match[2]).toUpperCase() : undefined;
}

const TITLE_HEADER = /(?:اسم\s*(?:المقرر|الماده|المساق)|^(?:المقرر|الماده|المساق)$|\b(?:course|subject)(?:\s+(?:title|name))?$)/i;
const CODE_HEADER = /(?:رمز\s*(?:المقرر|الماده|المساق)|\b(?:course\s+)?code\b)/i;
const TYPE_MARKER = /(?:^|\s)([TP])\s*$/i;

function typeIn(text: string): SessionType | undefined {
  if (/عملي|مخبر|\b(?:P|lab|practical|tutorial)\b/i.test(text)) return 'عملي';
  if (/نظري|محاضرة|\b(?:T|theory|lecture)\b/i.test(text)) return 'نظري';
}

export function readRoom(text: string): { room: string; hint?: SessionType; nextHint?: SessionType } {
  const value = text.trim();
  if (/مدر[ّ]?ج/.test(value)) return { room: 'المدرّج' };
  const match = value.match(/\b([a-z]{2,10})[- ]+(\d{1,4}[a-z]?)\b/i) ||
    value.match(/(?:^|\s)([A-Z85$])\s*[-–.]?\s*([0OIL\d]{1,3})(A|B8?|8)?\s*([TP])?[|]?\s*$/i);
  if (!match) return { room: '—' };
  if (match[1].length > 1) {
    if (/^(?:am|pm|class|lecture|theory)$/i.test(match[1])) return { room: '—' };
    if (/^room$/i.test(match[1])) return { room: match[2] };
    return { room: `${match[1]}-${match[2]}`, hint: typeIn(match[1]) };
  }
  const prefix = ({ '8': 'B', '5': 'S', '$': 'S' } as Record<string, string>)[match[1]] || match[1].toUpperCase();
  let number = match[2].toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1');
  let suffix = match[3]?.toUpperCase()[0].replace('8', 'B') ?? '';
  if (!suffix && /^(?:S|F)$/.test(prefix) && number.length === 3 && number.endsWith('8')) {
    number = number.slice(0, 2);
    suffix = 'B';
  }
  const hint = typeIn(match[4] ?? '');
  return { room: `${prefix}-${number}${suffix}`, hint, nextHint: hint };
}

const CLOCK = '(\\d{1,2})\\s*[:.：]\\s*(\\d{2})\\s*(am|pm|ص|م)?';
const RANGE = new RegExp(`(?<![\\d:])${CLOCK}\\s*(?:[-–—−~→/]+|to\\b|إلى|الى|حتى)?\\s*${CLOCK}(?![\\d:])`, 'gi');

function timeValue(hour: string, minutes: string, period: string | undefined): number {
  let h = Number(hour);
  if (h > 23 || Number(minutes) > 59 || (period && (h < 1 || h > 12))) return NaN;
  if (period) h = h % 12 + (/pm|م/i.test(period) ? 12 : 0);
  return h * 60 + Number(minutes);
}

function formatTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

type Meeting = Pick<ParsedRawSession, 'startTime' | 'endTime' | 'room'> & { type?: SessionType };

export function readMeetings(cell: GridText): Meeting[] {
  const read = (raw: string) => {
    const text = normalizeAsciiDigits(raw.normalize('NFKC'))
      .replace(/\b(a|p)\.?\s*m\.?/gi, '$1m').replace(/\b(\d{1,2})\s*;\s*(?=\d{2}\b)/g, '$1:');
    const ranges = [...text.matchAll(RANGE)];
    let cue = typeIn(text.slice(0, ranges[0]?.index ?? 0));
    return ranges.flatMap((range, index) => {
      const next = ranges[index + 1];
      const last = range.index + range[0].length;
      const between = text.slice(last, next?.index);
      const nextCue = next ? between.match(TYPE_MARKER) : null;
      const details = nextCue ? between.slice(0, nextCue.index) : between;
      const { room, hint, nextHint } = readRoom(details);
      let start = timeValue(range[1], range[2], range[3] || range[6]);
      let end = timeValue(range[4], range[5], range[6] || range[3]);
      if (end <= start && !range[3] && /pm|م/i.test(range[6] ?? '') && Number(range[1]) < 12) start -= 720;
      if (end <= start && !range[6] && /am|ص/i.test(range[3] ?? '')) end += 720;
      if (end <= start && !range[3] && !range[6] && Number(range[1]) >= 8 && Number(range[4]) >= 1 && Number(range[4]) <= 7) end += 720;
      const trailingCue = next && !nextCue ? nextHint : undefined;
      const type = cue || (trailingCue ? undefined : hint) || typeIn(details);
      cue = nextCue ? typeIn(nextCue[1]) : trailingCue;
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 480 || end >= 1440) return [];
      return [{ startTime: formatTime(start), endTime: formatTime(end), room, type }];
    });
  };
  const first = read(cell.en);
  const retry = read(cell.retry ?? '');
  const arabic = read(cell.ar);
  const options = [first, retry, arabic];
  const best = options.reduce((a, b) => b.length > a.length ? b : a);
  return best.map((meeting) => {
    const sameRange = (other: Meeting) => other.startTime === meeting.startTime && other.endTime === meeting.endTime;
    const english = first.find(sameRange);
    const checked = retry.find(sameRange);
    const alternate = arabic.find(sameRange);
    return {
      ...meeting,
      room: [english?.room, checked?.room, alternate?.room].find((room) => room && room !== '—') || '—',
      type: checked?.type || english?.type || alternate?.type,
    };
  });
}

function inferDays(days: (DayOfWeek | undefined)[], metadata: Set<number>): (DayOfWeek | undefined)[] {
  const recognized = days.flatMap((day, col) => day ? [{ day, col }] : []);
  if (recognized.length < 2) return days;
  const possibilities = [1, -1].flatMap((step) => {
    const first = recognized[0];
    const index = DAYS_ORDER.indexOf(first.day);
    const dayAt = (col: number) => DAYS_ORDER[((index + (col - first.col) * step) % 7 + 7) % 7];
    if (!recognized.every(({ day, col }) => day === dayAt(col))) return [];
    return [dayAt];
  });
  if (possibilities.length !== 1) return days;
  const between = recognized.at(-1)!.col - recognized[0].col + 1;
  // Fill interior gaps. At the edges require a complete, unambiguous weekday block.
  const blocks = days.flatMap((_, start) => {
    if (start + 7 > days.length || start > recognized[0].col || start + 7 <= recognized.at(-1)!.col) return [];
    return Array.from({ length: 7 }, (_, offset) => start + offset).some((col) => metadata.has(col)) ? [] : [start];
  });
  const block = blocks.length === 1 ? blocks[0] : -1;
  return days.map((day, col) => day || (
    (col >= recognized[0].col && col < recognized[0].col + between) ||
    (block >= 0 && col >= block && col < block + 7)
      ? possibilities[0](col)
      : undefined
  ));
}

function parseCourseRows(grid: GridText[][]): ParsedRawSession[] | null {
  for (let header = 0; header < grid.length - 1; header++) {
    const labels = grid[header];
    const days = labels.map(readDay);
    if (new Set(days.filter(Boolean)).size < 2) continue;
    const rows = grid.slice(header + 1);
    const normalizedLabels = labels.map((cell) => `${normalizeHeader(cell.ar)}|${normalizeHeader(cell.en)}`);
    const columnFor = (pattern: RegExp) =>
      normalizedLabels.findIndex((label, i) => !days[i] && label.split('|').some((part) => pattern.test(part)));
    let codeCol = columnFor(CODE_HEADER);
    const titleCol = columnFor(TITLE_HEADER);
    if (codeCol < 0) {
      codeCol = labels.findIndex((_, col) => !days[col] && col !== titleCol &&
        rows.filter((row) => readCode(row[col].en)).length >= Math.min(2, rows.length));
    }
    if (codeCol < 0 && titleCol < 0) continue;
    const metadata = new Set([codeCol, titleCol]);
    normalizedLabels.forEach((label, col) => {
      if (/الفئه|الشعبه|الساعات|credits|section|group/.test(label)) metadata.add(col);
    });
    const weekdays = inferDays(days, metadata);
    return rows.flatMap((row) => {
      const courseCode = readCode(row[codeCol]?.en ?? '');
      const arTitle = (row[titleCol]?.ar ?? '').replace(/[^\u0600-\u06ff\d\s()&-]/g, '').trim();
      const enTitle = (row[titleCol]?.en ?? '').replace(/\s+/g, ' ').trim();
      const courseName = (/\p{Script=Arabic}{2}/u.test(arTitle) ? arTitle.replace(/\s+/g, ' ') : '') ||
        (normalizeHeader(labels[titleCol]?.ar ?? '') && courseNameForCode(courseCode)) ||
        (/[a-z]{3}/i.test(enTitle) ? enTitle : '') || (courseCode ? courseNameForCode(courseCode) || `مادة ${courseCode}` : '');
      if (!courseName) return [];
      return weekdays.flatMap((day, col) => day && !metadata.has(col)
        ? readMeetings(row[col]).map((meeting) => ({ ...meeting, type: meeting.type || 'نظري', day, courseCode, courseName }))
        : []);
    });
  }
  return null;
}

function parseTimeRows(grid: GridText[][]): ParsedRawSession[] | null {
  for (let header = 0; header < grid.length - 1; header++) {
    const labels = grid[header];
    const days = labels.map(readDay);
    if (new Set(days.filter(Boolean)).size < 2) continue;
    const rows = grid.slice(header + 1);
    const slots = labels.map((label, col) => {
      if (days[col]) return null;
      const hasTimeLabel = /^(?:الوقت|التوقيت|الساعه)$/.test(normalizeHeader(label.ar)) ||
        /^(?:time|hour|period)$/.test(normalizeHeader(label.en));
      const times = rows.map((row) => {
        const found = readMeetings(row[col]);
        return found.length === 1 && found[0].room === '—' ? found[0] : null;
      });
      const count = times.filter(Boolean).length;
      return count >= (hasTimeLabel ? 1 : 2) ? { col, times, score: count + (hasTimeLabel ? rows.length : 0) } : null;
    }).filter((slot) => slot !== null).sort((a, b) => b.score - a.score);
    if (!slots.length || slots[0].score === slots[1]?.score) continue;
    const { col: timeCol, times } = slots[0];
    const weekdays = inferDays(days, new Set([timeCol]));
    return rows.flatMap((row, rowIndex) => {
      const time = times[rowIndex];
      if (!time) return [];
      return weekdays.flatMap((day, col) => {
        if (!day || col === timeCol) return [];
        const cell = row[col];
        const lines = cell.en.split('\n').map((line) => line.trim()).filter(Boolean);
        const courseCode = lines.map(readCode).find((code) => code !== undefined);
        const room = lines.length > 1 ? readRoom(lines.at(-1)!).room : '—';
        const title = (text: string) => text.split('\n').map((line) => line.trim())
          .filter((line, index, source) => !readCode(line) &&
            !(index === source.length - 1 && source.length > 1 && readRoom(line).room !== '—') &&
            !/^(?:[PT]|lecture|theory|lab|practical|نظري|عملي)$/i.test(line))
          .join(' ').replace(/\s+/g, ' ').trim();
        const arabicTitle = (normalizeHeader(labels[col].ar) && !ENGLISH_DAYS.some((pattern) => pattern.test(normalizeHeader(labels[col].en))) ? title(cell.ar) : '').replace(/[^\p{Script=Arabic}\d\s()&-]/gu, '').trim();
        const englishTitle = title(cell.en);
        const courseName = /\p{Script=Arabic}{2}/u.test(arabicTitle) ? arabicTitle :
          /[a-z]{3}/i.test(englishTitle) ? englishTitle :
          courseCode ? courseNameForCode(courseCode) || `مادة ${courseCode}` : '';
        if (!courseName) return [];
        return [{
          day, startTime: time.startTime, endTime: time.endTime, courseName, courseCode, room,
          type: typeIn(`${cell.ar} ${cell.en}`) || 'نظري',
        }];
      });
    });
  }
  return null;
}

export function parseScheduleGrid(grid: GridText[][]): ParsedRawSession[] | null {
  if (!grid.length) return null;
  const transposed = grid[0].map((_, col) => grid.map((row) => row[col]));
  let recognized = false;
  for (const layout of [grid, transposed]) {
    for (const parse of [parseCourseRows, parseTimeRows]) {
      const sessions = parse(layout);
      if (sessions?.length) return sessions;
      recognized ||= sessions !== null;
    }
  }
  return recognized ? [] : null;
}
