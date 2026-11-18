import { useId } from 'react';
import { CalendarRange, ChevronLeft, LayoutList, Plus, Table2 } from 'lucide-react';
import { DAYS_ORDER, type DayOfWeek, type LectureSession } from '../types';

export type DayFilter = DayOfWeek | 'الكل';
type ViewMode = 'agenda' | 'table';
export type WeekGroup = { day: DayOfWeek; meetings: LectureSession[] };

const daysShort = ['سبت', 'أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة'];

function Room({ session }: { session: LectureSession }) {
  const room = session.room || '—';
  const floor = session.floor && session.floor !== '—' && session.floor !== 'غير محدّد' ? session.floor : '';
  return (
    <span className="meeting-room">
      <bdi>{room}</bdi>
      {floor && <small>الطابق {floor}</small>}
    </span>
  );
}

function Course({ session }: { session: LectureSession }) {
  return (
    <span className="meeting-course">
      <strong dir="auto">{session.courseName}</strong>
      <span className="meeting-meta">
        <span className="meeting-type" data-practical={session.type === 'عملي'}>{session.type}</span>
        {session.courseCode && <bdi>{session.courseCode}</bdi>}
      </span>
    </span>
  );
}

function MeetingTime({ session }: { session: LectureSession }) {
  return <span className="meeting-time"><bdi>{session.startTime}</bdi><bdi>{session.endTime}</bdi></span>;
}

export function ScheduleBoard({ groups, today, selectedDay, onDay, view, onView, onNew, onEdit }: {
  groups: WeekGroup[];
  today: DayOfWeek;
  selectedDay: DayFilter;
  onDay: (day: DayFilter) => void;
  view: ViewMode;
  onView: (view: ViewMode) => void;
  onNew: () => void;
  onEdit: (session: LectureSession) => void;
}) {
  const countId = useId();
  const visible = groups.filter(({ day, meetings }) => (selectedDay === 'الكل' || selectedDay === day) && meetings.length);
  return (
    <section className="schedule-board" aria-labelledby="schedule-board-title">
      <div className="schedule-heading">
        <h2 id="schedule-board-title">الجدول الأسبوعي</h2>
        <div className="view-switch" role="group" aria-label="طريقة عرض المحاضرات">
          <button className="view-option" type="button" aria-pressed={view === 'agenda'} onClick={() => onView('agenda')}><LayoutList size={15} aria-hidden="true" /> قائمة</button>
          <button className="view-option" type="button" aria-pressed={view === 'table'} onClick={() => onView('table')}><Table2 size={14} aria-hidden="true" /> جدول</button>
        </div>
      </div>
      <div className="week-selector" role="group" aria-label="أيام الجدول">
        <button className="week-day week-all" type="button" aria-pressed={selectedDay === 'الكل'} onClick={() => onDay('الكل')}>
          <span>الأسبوع</span><CalendarRange size={15} aria-hidden="true" />
        </button>
        {groups.map(({ day, meetings }, index) => (
          <button type="button" className="week-day" key={day} aria-pressed={selectedDay === day}
            aria-label={day} aria-describedby={`${countId}-${index}`} data-today={today === day} onClick={() => onDay(day)}>
            <span className="day-full">{day}</span><span className="day-short">{daysShort[index]}</span>
            <span className="week-count" aria-hidden="true" data-empty={meetings.length === 0}><bdi>{meetings.length}</bdi></span>
            <span className="sr-only" id={`${countId}-${index}`}>عدد المحاضرات {meetings.length}</span>
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <div className="day-empty">
          <h3>لا توجد محاضرات يوم {selectedDay}</h3>
          <button type="button" className="button button-secondary" onClick={onNew}><Plus size={16} aria-hidden="true" /> إضافة محاضرة</button>
        </div>
      ) : view === 'agenda' ? (
        <div className="agenda">
          <div className="agenda-columns" aria-hidden="true"><span>الوقت</span><span>المحاضرة</span><span>القاعة</span></div>
          {visible.map(({ day, meetings }) => (
            <section key={day} className="agenda-day" data-today={today === day} aria-label={day}>
              <h3><span>{day}</span>{today === day && <span className="today-label">اليوم</span>}</h3>
              {meetings.map((session) => (
                <button className="meeting-row" type="button" key={session.id} onClick={() => onEdit(session)}>
                  <MeetingTime session={session} />
                  <Course session={session} />
                  <Room session={session} />
                  <ChevronLeft size={16} aria-hidden="true" className="meeting-arrow" />
                </button>
              ))}
            </section>
          ))}
        </div>
      ) : (
        <div className="schedule-table-scroll" tabIndex={0} role="region" aria-label="جدول المحاضرات">
          <table className="schedule-table">
            <thead><tr><th scope="col">اليوم</th><th scope="col">الوقت</th><th scope="col">المحاضرة</th><th scope="col">القاعة</th></tr></thead>
            {visible.map(({ day, meetings }) => (
              <tbody key={day}>
                {meetings.map((session, index) => (
                  <tr key={session.id}>
                    {index === 0 && <th scope="rowgroup" rowSpan={meetings.length}>{day}{today === day && <span className="today-label">اليوم</span>}</th>}
                    <td><MeetingTime session={session} /></td>
                    <td><button type="button" className="table-course" onClick={() => onEdit(session)}><Course session={session} /></button></td>
                    <td><Room session={session} /></td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      )}
    </section>
  );
}

export const weekGroups = (sessions: LectureSession[]): WeekGroup[] => DAYS_ORDER.map((day) => ({
  day, meetings: sessions.filter((session) => session.day === day).sort((a, b) => a.startTime.localeCompare(b.startTime)),
}));
