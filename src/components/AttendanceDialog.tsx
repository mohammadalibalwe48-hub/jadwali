import { useState, type Dispatch, type SetStateAction } from 'react';
import type { LectureSession } from '../types';
import { attendanceSummary, setMark, type Attendance, type AttendanceMark } from '../utils/attendance';
import { DAYS_ORDER } from '../types';
import { localDate, parseCivilDate } from '../utils/semester';
import { fieldStyle, ToolDialog } from './ToolDialog';

const marks: { value: AttendanceMark; label: string; active: string }[] = [
  { value: 'present', label: 'حاضر', active: 'bg-[#D8EFE4] text-[#15382D] border-[#96BDAA]' },
  { value: 'late', label: 'متأخر', active: 'bg-[#FAECCC] text-[#664508] border-[#DEC080]' },
  { value: 'missed', label: 'غائب', active: 'bg-[#FCE3E0] text-[#831F18] border-[#E1AEAA]' },
];

export function AttendanceDialog({ sessions, attendance, onChange, onClose }: {
  sessions: LectureSession[]; attendance: Attendance; onChange: Dispatch<SetStateAction<Attendance>>; onClose: () => void;
}) {
  const today = localDate();
  const [date, setDate] = useState(today);
  const civilDate = parseCivilDate(date);
  const day = civilDate ? DAYS_ORDER[(civilDate.getUTCDay() + 1) % 7] : null;
  const canMark = !!day && date <= today;
  const meetings = canMark ? sessions.filter((session) => session.day === day) : [];
  const summary = attendanceSummary(sessions, attendance);

  function updateLimit(course: string, raw: string) {
    const limit = Number(raw);
    if (raw && (!Number.isInteger(limit) || limit < 0 || limit > 100)) return;
    onChange((previous) => {
      const limits = { ...previous.limits };
      if (raw === '') delete limits[course];
      else limits[course] = limit;
      return { ...previous, limits };
    });
  }

  return (
    <ToolDialog title="متابعة الحضور" onClose={onClose}>
      <label className="grid gap-1 text-xs font-bold">تاريخ المحاضرات
        <input type="date" dir="ltr" max={today} value={date} className={fieldStyle} onChange={(event) => setDate(event.target.value)} />
      </label>
      {meetings.length === 0 && <p className="text-sm text-[#5F5D55]">{canMark ? 'لا توجد محاضرات في هذا اليوم.' : 'اختر اليوم أو تاريخاً سابقاً.'}</p>}
      {meetings.map((session) => {
        const current = attendance.records.find((record) => record.sessionId === session.id && record.date === date)?.mark;
        return (
          <div key={session.id} className="space-y-2 rounded-xl border border-[#E2DFD7] bg-white p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-1.5 text-sm">
              <span className="font-bold">{session.courseName} <span className="text-xs font-medium text-[#6B6962]">· {session.type}</span></span>
              <bdi className="font-mono-num text-xs">{session.startTime} – {session.endTime}</bdi>
            </div>
            <div role="group" aria-label={session.courseName} className="grid grid-cols-3 gap-1.5">
              {marks.map((mark) => <button type="button" key={mark.value} aria-pressed={current === mark.value}
                className={`rounded-lg border px-1 py-2 text-xs font-bold ${current === mark.value ? mark.active : 'border-[#E2DFD7] bg-[#FAF9F5]'}`}
                onClick={() => onChange((previous) => setMark(previous, session, date, mark.value))}>{mark.label}</button>)}
            </div>
          </div>
        );
      })}
      {summary.length > 0 && <section className="space-y-2 border-t border-[#E2DFD7] pt-4">
        <h3 className="text-sm font-bold">الغياب حسب المادة</h3>
        <p className="text-xs text-[#5F5D55]">حدّد الغيابات المسموحة لكل مادة. يُسجّل التأخّر بشكل منفصل.</p>
        {summary.map((course) => <div key={course.key} className="flex flex-wrap items-center justify-between gap-2.5 rounded-xl bg-white p-3">
          <div className="space-y-1">
            <p className="text-sm font-bold">{course.name}</p>
            <p className="text-xs text-[#5F5D55]">{course.present} حضور · {course.late} تأخّر · {course.missed} غياب</p>
            {course.remaining !== undefined && <p className={`text-xs font-bold ${course.remaining === 0 ? 'text-red-800' : 'text-[#235047]'}`}>الغيابات المتبقية {course.remaining}</p>}
          </div>
          <label className="grid w-24 gap-1 text-[11px] font-bold">حدّ الغياب
            <input aria-label={`حدّ الغياب ${course.name}`} className={fieldStyle} type="number" min={0} max={100} step={1} inputMode="numeric"
              placeholder="—" value={course.limit ?? ''} onChange={(event) => updateLimit(course.key, event.target.value)} />
          </label>
        </div>)}
      </section>}
    </ToolDialog>
  );
}
