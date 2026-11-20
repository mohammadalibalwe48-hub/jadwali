import type { LectureSession } from '../types';
import { canExportMeeting, scheduleDay } from './semester';

function minutesOfDay(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function todayAgenda(sessions: LectureSession[], now: Date) {
  const day = scheduleDay(now);
  const minute = now.getHours() * 60 + now.getMinutes();
  const ordered = sessions.filter((session) => session.day === day && canExportMeeting(session))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  let occupiedUntil: number | undefined;

  return ordered.map((session) => {
    const start = minutesOfDay(session.startTime);
    const end = minutesOfDay(session.endTime);
    const gap = occupiedUntil === undefined ? 0 : Math.max(0, start - Math.max(minute, occupiedUntil));
    occupiedUntil = Math.max(occupiedUntil ?? end, end);
    const status = end <= minute ? 'ended' : start <= minute ? 'ongoing' : 'upcoming';
    return { session, gap, status };
  });
}
