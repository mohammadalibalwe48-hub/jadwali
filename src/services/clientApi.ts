import {
  DAYS_ORDER,
  isSameMeeting,
  type FloorRule,
  type LectureSession,
} from '../types';
import { cleanRoomCode, detectFloorFromRoom } from '../utils/floorMapper';
import { askVision } from './visionApi';

export async function uploadAndExtractSchedule(
  files: File[],
  floorRules: FloorRule[]
): Promise<{ sessions: LectureSession[]; notices: string[] }> {
  const result = await askVision(files);
  const sessions: LectureSession[] = [];
  for (const item of result.sessions) {
    const { room } = cleanRoomCode(item.room);
    const finalRoom = room || '—';
    const session: LectureSession = {
      ...item,
      id: crypto.randomUUID(),
      courseCode: item.courseCode?.trim().toUpperCase(),
      room: finalRoom,
      floor: finalRoom === '—' ? '—' : detectFloorFromRoom(finalRoom, floorRules),
      floorAuto: true,
    };
    if (!sessions.some((other) => isSameMeeting(other, session))) sessions.push(session);
  }

  sessions.sort((a, b) => {
    const day = DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day);
    return day || a.startTime.localeCompare(b.startTime);
  });
  return { sessions, notices: result.notices };
}
