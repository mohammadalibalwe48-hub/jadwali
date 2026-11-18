import type { LectureSession } from '../types.js';

export const MAX_VISION_SCREENS = 8;
export const MAX_VISION_BODY = 4_000_000;

export type ScannedMeeting = Pick<LectureSession,
  'day' | 'startTime' | 'endTime' | 'courseName' | 'courseCode' | 'room' | 'type'
>;
