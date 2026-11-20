import { useLocale } from '../locale';
import type { Dispatch, SetStateAction } from 'react';
import type { LectureSession } from '../types';
import { setMark, type Attendance, type AttendanceMark } from '../utils/attendance';

const marks: { value: AttendanceMark; label: string; active: string }[] = [
  { value: 'present', label: 'حاضر', active: 'mark-present' },
  { value: 'late', label: 'متأخر', active: 'mark-late' },
  { value: 'missed', label: 'غائب', active: 'mark-missed' },
];

export function AttendanceControls({ session, date, attendance, onChange }: {
  session: LectureSession; date: string; attendance: Attendance; onChange: Dispatch<SetStateAction<Attendance>>;
}) {
  const { t } = useLocale();
  const current = attendance.records.find((record) => record.sessionId === session.id && record.date === date)?.mark;
  return (
    <div role="group" aria-label={t(`حضور ${session.courseName} ${session.startTime}`, `Attendance for ${session.courseName} at ${session.startTime}`)} className="grid grid-cols-3 gap-1.5">
      {marks.map((mark) => <button type="button" key={mark.value} aria-pressed={current === mark.value}
        className={`rounded-md border px-1 py-2 text-xs font-bold ${current === mark.value ? mark.active : 'border-[var(--line)] bg-[var(--soft)]'}`}
        onClick={() => onChange((previous) => setMark(previous, session, date, mark.value))}>{t(mark.label)}</button>)}
    </div>
  );
}
