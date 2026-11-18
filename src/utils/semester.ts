import { DAYS_ORDER, type LectureSession } from '../types';

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export function localDate(date = new Date()) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function scheduleDay(date: Date) {
  return DAYS_ORDER[(date.getDay() + 1) % 7];
}

export function parseCivilDate(value: string): Date | null {
  if (!ISO_DAY.test(value)) return null;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

export function nextMeeting(sessions: LectureSession[], now: Date) {
  const ordered = sessions.filter((session) => TIME.test(session.startTime))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const date = new Date(now);
  for (let offset = 0; offset <= 7; offset++) {
    const day = scheduleDay(date);
    for (const session of ordered) {
      if (session.day !== day) continue;
      const [hours, minutes] = session.startTime.split(':').map(Number);
      const starts = new Date(date);
      starts.setHours(hours, minutes, 0, 0);
      if (starts >= now) return { session, starts, offset };
    }
    date.setDate(date.getDate() + 1);
  }
  return null;
}

export function canExportMeeting(session: LectureSession) {
  return DAYS_ORDER.includes(session.day) && TIME.test(session.startTime) &&
    TIME.test(session.endTime) && session.startTime < session.endTime;
}

export function validSemester(from: string, through: string) {
  const start = parseCivilDate(from);
  const end = parseCivilDate(through);
  return !!start && !!end && +end >= +start && (+end - +start) / DAY_MS <= 366;
}

function escapeText(text: string) {
  return text.replace(/\\/g, '\\\\').replace(/\r\n?|\n/g, '\\n').replace(/[;,]/g, '\\$&');
}

function fold(line: string) {
  const encoder = new TextEncoder();
  let width = 0;
  let result = '';
  for (const character of line) {
    const bytes = encoder.encode(character).length;
    if (width + bytes > 75) {
      result += '\r\n ';
      width = 1;
    }
    result += character;
    width += bytes;
  }
  return result;
}

export function buildCalendar(sessions: LectureSession[], from: string, through: string, reminder: number, now = new Date()) {
  if (!validSemester(from, through) || ![0, 5, 10, 15, 30, 60].includes(reminder)) {
    throw new Error('Invalid calendar dates or reminder');
  }
  const start = parseCivilDate(from)!;
  const end = parseCivilDate(through)!;
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Jadwali//Semester Schedule//AR', 'CALSCALE:GREGORIAN'];
  let total = 0;
  for (const session of sessions) {
    if (!canExportMeeting(session)) continue;
    const weekday = (DAYS_ORDER.indexOf(session.day) + 6) % 7;
    const offset = (weekday - start.getUTCDay() + 7) % 7;
    const first = new Date(+start + offset * DAY_MS);
    if (first > end) continue;
    const count = Math.floor((+end - +first) / (7 * DAY_MS)) + 1;
    const date = first.toISOString().slice(0, 10).replaceAll('-', '');
    const name = `${session.courseName} (${session.type})`;
    const location = [session.room, session.floor].filter((part) => part && part !== '—').join(' · ');
    lines.push('BEGIN:VEVENT',
      `UID:${encodeURIComponent(session.id)}-${from}@jadwali.app`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${date}T${session.startTime.replace(':', '')}00`,
      `DTEND:${date}T${session.endTime.replace(':', '')}00`,
      `RRULE:FREQ=WEEKLY;COUNT=${count}`,
      `SUMMARY:${escapeText(name)}`);
    if (location) lines.push(`LOCATION:${escapeText(location)}`);
    if (session.courseCode) lines.push(`DESCRIPTION:${escapeText(session.courseCode)}`);
    if (reminder) lines.push('BEGIN:VALARM', `TRIGGER:-PT${reminder}M`, 'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(name)}`, 'END:VALARM');
    lines.push('END:VEVENT');
    total++;
  }
  if (!total) throw new Error('No meetings in selected date range');
  return [...lines, 'END:VCALENDAR', ''].map(fold).join('\r\n');
}
