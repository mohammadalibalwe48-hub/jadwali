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
