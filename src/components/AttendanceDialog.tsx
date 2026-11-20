import { ClipboardCheck } from 'lucide-react';
import { useLocale } from '../locale';
import { useState, type Dispatch, type SetStateAction } from 'react';
import type { LectureSession } from '../types';
import { attendanceSummary, type Attendance } from '../utils/attendance';
import { DAYS_ORDER } from '../types';
import { localDate, parseCivilDate } from '../utils/semester';
import { AttendanceControls } from './AttendanceControls';
import { fieldStyle, ToolDialog } from './ToolDialog';

export function AttendanceDialog({ sessions, attendance, onChange, onClose }: {
  sessions: LectureSession[]; attendance: Attendance; onChange: Dispatch<SetStateAction<Attendance>>; onClose: () => void;
}) {
  const { t, typeName } = useLocale();
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
    <ToolDialog title={t("متابعة الحضور")} icon={ClipboardCheck} onClose={onClose}>
      <label className="grid gap-1 text-xs font-bold">{t("تاريخ المحاضرات")}<input type="date" dir="ltr" max={today} value={date} className={fieldStyle} onChange={(event) => setDate(event.target.value)} />
      </label>
      {meetings.length === 0 && <p className="text-sm text-[var(--muted)]">{canMark ? t("لا توجد محاضرات في هذا اليوم.") : t("اختر اليوم أو تاريخاً سابقاً.")}</p>}
      {meetings.map((session) => (
        <div key={session.id} className="space-y-2 rounded-md border border-[var(--line)] bg-white p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-1.5 text-sm">
            <span className="font-bold">{session.courseName} <span className="text-xs font-medium text-[var(--muted)]">· {typeName(session.type)}</span></span>
            <bdi className="font-mono-num text-xs">{session.startTime} – {session.endTime}</bdi>
          </div>
          <AttendanceControls session={session} date={date} attendance={attendance} onChange={onChange} />
        </div>
      ))}
      {summary.length > 0 && <section className="space-y-2 border-t border-[var(--line)] pt-4">
        <h3 className="text-sm font-bold">{t("الغياب حسب المادة")}</h3>
        <p className="text-xs text-[var(--muted)]">{t("حدّد الغيابات المسموحة لكل مادة. يُسجّل التأخّر بشكل منفصل.")}</p>
        {summary.map((course) => <div key={course.key} className="flex flex-wrap items-center justify-between gap-2.5 rounded-md bg-white p-3">
          <div className="space-y-1">
            <p className="text-sm font-bold">{course.name}</p>
            <p className="text-xs text-[var(--muted)]">{course.present}{' ' + t("حضور ·") + ' '}{course.late}{' ' + t("تأخّر ·") + ' '}{course.missed}{' ' + t("غياب")}</p>
            {course.remaining !== undefined && <p className={`text-xs font-bold ${course.remaining === 0 ? 'text-red-800' : 'text-[var(--success)]'}`}>{t("الغيابات المتبقية") + ' '}{course.remaining}</p>}
          </div>
          <label className="grid w-24 gap-1 text-[11px] font-bold">{t("حدّ الغياب")}<input aria-label={t(`حدّ الغياب ${course.name}`, `Absence limit for ${course.name}`)} className={fieldStyle} type="number" min={0} max={100} step={1} inputMode="numeric"
              placeholder="—" value={course.limit ?? ''} onChange={(event) => updateLimit(course.key, event.target.value)} />
          </label>
        </div>)}
      </section>}
    </ToolDialog>
  );
}
