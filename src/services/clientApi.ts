import {
  DAYS_ORDER,
  type DayOfWeek,
  type FloorRule,
  type LectureSession,
  type ScheduleMetadata,
} from '../types';
import { cleanRoomCode, detectFloorFromRoom } from '../utils/floorMapper';
import { runPureBrowserOcr } from '../ocr/browserOcr';

function normalizeDay(raw: string): DayOfWeek {
  const s = (raw || '').trim();
  if (s.includes('سبت') || /sat/i.test(s)) return 'السبت';
  if (s.includes('أحد') || s.includes('احد') || /sun/i.test(s)) return 'الأحد';
  if (s.includes('اثنين') || s.includes('إثنين') || /mon/i.test(s)) return 'الإثنين';
  if (s.includes('ثلاثاء') || /tue/i.test(s)) return 'الثلاثاء';
  if (s.includes('أربعاء') || s.includes('اربعاء') || /wed/i.test(s)) return 'الأربعاء';
  if (s.includes('خميس') || /thu/i.test(s)) return 'الخميس';
  if (s.includes('جمعة') || s.includes('جمعه') || /fri/i.test(s)) return 'الجمعة';
  return DAYS_ORDER.find((d) => d === s) || 'السبت';
}

export async function uploadAndExtractSchedule(
  files: File[],
  floorRules: FloorRule[]
): Promise<{
  metadata: ScheduleMetadata;
  sessions: LectureSession[];
}> {
  const rawList = await runPureBrowserOcr(files);

  const sessions: LectureSession[] = rawList.map((item, idx) => {
    const { room, hintedType } = cleanRoomCode(String(item.room || ''));
    const rawType = String(item.type || '');
    const type: 'نظري' | 'عملي' =
      rawType.includes('عمل') || /^p|lab/i.test(rawType)
        ? 'عملي'
        : rawType.includes('نظر') || /^t/i.test(rawType)
        ? 'نظري'
        : hintedType || 'نظري';

    const finalRoom = room || '—';
    return {
      id: `s-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      day: normalizeDay(item.day),
      startTime: item.startTime || '10:00',
      endTime: item.endTime || '11:30',
      courseName: String(item.courseName || 'محاضرة جامعية').trim(),
      courseCode: item.courseCode ? String(item.courseCode).trim().toUpperCase() : '',
      type,
      room: finalRoom,
      floor: finalRoom === '—' ? '—' : detectFloorFromRoom(finalRoom, floorRules),
      floorAuto: true,
    };
  });

  sessions.sort((a, b) => {
    const d = DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day);
    if (d !== 0) return d;
    return a.startTime.localeCompare(b.startTime);
  });

  return {
    metadata: {
      title: 'الجدول الدراسي الأسبوعي',
      subtitle: '',
      semester: 'الفصل الأول 2026 / 2027',
    },
    sessions,
  };
}

export async function generateVectorPdfFile(
  metadata: ScheduleMetadata,
  sessions: LectureSession[],
  floorRules: FloorRule[]
): Promise<{ blob: Blob; file: File; url: string }> {
  const response = await fetch('/api/pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ metadata, sessions, floorRules }),
  });

  if (!response.ok) {
    let errText = 'تعذّر إنشاء ملف PDF';
    try {
      const errJson = await response.json();
      if (errJson?.error) errText = errJson.error;
    } catch {
      // ignore
    }
    throw new Error(errText);
  }

  const blob = await response.blob();
  const file = new File([blob], 'schedule.pdf', { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  return { blob, file, url };
}
