import type { LectureSession } from '../types';

export type AttendanceMark = 'present' | 'late' | 'missed';

export interface AttendanceEntry {
  sessionId: string;
  date: string;
  course: string;
  name: string;
  mark: AttendanceMark;
}

export interface Attendance {
  records: AttendanceEntry[];
  limits: Partial<Record<string, number>>;
}

export const EMPTY_ATTENDANCE: Attendance = { records: [], limits: {} };

export function courseKey(session: LectureSession) {
  const code = session.courseCode?.normalize('NFKC').trim().toUpperCase();
  const name = session.courseName.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
  return code ? `code:${code}` : `name:${name}`;
}

export function setMark(attendance: Attendance, session: LectureSession, date: string, mark: AttendanceMark) {
  const course = courseKey(session);
  const existing = attendance.records.find((entry) => entry.sessionId === session.id && entry.date === date);
  const records = attendance.records.filter((entry) => entry !== existing);
  if (existing?.mark !== mark) records.push({ sessionId: session.id, date, course, name: session.courseName, mark });
  return { ...attendance, records };
}

export function attendanceSummary(sessions: LectureSession[], attendance: Attendance) {
  const courses = new Map<string, { name: string; present: number; late: number; missed: number }>();
  const getCourse = (key: string, name: string) => {
    const course = courses.get(key) ?? { name, present: 0, late: 0, missed: 0 };
    courses.set(key, course);
    return course;
  };
  for (const session of sessions) getCourse(courseKey(session), session.courseName);
  for (const record of attendance.records) getCourse(record.course, record.name)[record.mark]++;
  return Array.from(courses, ([key, course]) => {
    const limit = attendance.limits[key];
    return { key, ...course, limit, remaining: limit === undefined ? undefined : Math.max(0, limit - course.missed) };
  });
}
