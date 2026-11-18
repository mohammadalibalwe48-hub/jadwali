export type DayOfWeek =
  | 'السبت'
  | 'الأحد'
  | 'الإثنين'
  | 'الثلاثاء'
  | 'الأربعاء'
  | 'الخميس'
  | 'الجمعة';

export const DAYS_ORDER: DayOfWeek[] = [
  'السبت',
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
];

export type SessionType = 'نظري' | 'عملي';

export interface LectureSession {
  id: string;
  day: DayOfWeek;
  startTime: string; // HH:MM (24-hour)
  endTime: string;   // HH:MM (24-hour)
  courseName: string;
  courseCode?: string;
  type: SessionType;
  room: string;
  floor: string;
  floorAuto: boolean;
}

type MeetingIdentity = Pick<LectureSession, 'startTime' | 'endTime' | 'courseName' | 'courseCode' | 'room'> & {
  day: string;
};

export function isSameMeeting(a: MeetingIdentity, b: MeetingIdentity): boolean {
  return a.day === b.day && a.startTime === b.startTime && a.endTime === b.endTime && a.room === b.room &&
    (a.courseCode && b.courseCode ? a.courseCode === b.courseCode : a.courseName === b.courseName);
}

export interface FloorRule {
  id: string;
  prefix: string;
  floor: string;
  example: string;
}

export interface ScheduleMetadata {
  title: string;
  subtitle: string;
  semester: string;
}
