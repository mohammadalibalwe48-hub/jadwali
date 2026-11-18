import { BookOpen, Calendar, CalendarDays, CalendarOff, ChevronLeft, LayoutList, MapPin, Plus, Table2 } from 'lucide-react';
import { DAYS_ORDER, type DayOfWeek, type LectureSession } from '../types';
import { courseKey } from '../utils/attendance';

export type DayFilter = DayOfWeek | 'الكل';
type ViewMode = 'agenda' | 'table';
export type WeekGroup = { day: DayOfWeek; meetings: LectureSession[] };

const daysShort = ['سبت', 'أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة'];

function Room({ session }: { session: LectureSession }) {
  const room = session.room || '—';
  const floor = session.floor && session.floor !== '—' && session.floor !== 'غير محدّد'
    ? `الطابق ${session.floor}` : '';
  return (
    <span className="meeting-room">
      <span><MapPin aria-hidden="true" size={14} /><bdi>{room}</bdi></span>
      {floor && <small>{floor}</small>}
    </span>
  );
}

function Course({ session }: { session: LectureSession }) {
  return (
    <span className="meeting-course">
      <strong dir="auto">{session.courseName}</strong>
      <span className="meeting-meta">
        <span className="meeting-type" data-practical={session.type === 'عملي'}>{session.type}</span>
        {session.courseCode && <bdi className="course-code">{session.courseCode}</bdi>}
      </span>
    </span>
  );
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
  const visible = groups.filter(({ day, meetings }) => (selectedDay === 'الكل' || selectedDay === day) && meetings.length);
  return (
    <section className="schedule-board surface" aria-labelledby="schedule-board-title">
      <div className="schedule-board-head">
        <h2 id="schedule-board-title">الجدول الأسبوعي</h2>
        <div className="view-switch" role="group" aria-label="طريقة عرض المحاضرات">
          <button className="view-option" type="button" aria-pressed={view === 'agenda'} onClick={() => onView('agenda')}>
            <LayoutList size={15} aria-hidden="true" /> قائمة
          </button>
          <button className="view-option" type="button" aria-pressed={view === 'table'} onClick={() => onView('table')}>
            <Table2 size={15} aria-hidden="true" /> جدول
          </button>
        </div>
      </div>
      <div className="week-selector" role="group" aria-label="أيام الجدول">
        <button className="week-day week-all" type="button" aria-pressed={selectedDay === 'الكل'} onClick={() => onDay('الكل')}>
          <CalendarDays size={16} aria-hidden="true" /> <span>الكل</span>
        </button>
        {groups.map(({ day, meetings }, index) => (
          <button type="button" className="week-day" key={day} aria-pressed={selectedDay === day}
            aria-label={day} data-today={today === day} onClick={() => onDay(day)}>
            <span><span className="day-full">{day}</span><span className="day-short">{daysShort[index]}</span></span>
            <span className="week-day-count" data-empty={meetings.length === 0}>{meetings.length}</span>
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <div className="day-empty">
          <span className="tool-tile"><CalendarOff size={22} aria-hidden="true" /></span>
          <h3>لا توجد محاضرات يوم {selectedDay}</h3>
          <button type="button" className="button button-secondary" onClick={onNew}><Plus size={16} aria-hidden="true" /> إضافة محاضرة</button>
        </div>
      ) : view === 'agenda' ? (
        <div className="agenda">
          {visible.map(({ day, meetings }) => (
            <section key={day} className="agenda-day" aria-label={day}>
              <h3><span>{day}</span>{today === day && <span className="today-label">اليوم</span>}</h3>
              {meetings.map((session) => (
                <button className="meeting-row" type="button" key={session.id} onClick={() => onEdit(session)}>
                  <span className="meeting-time" dir="ltr"><strong>{session.startTime}</strong><small>{session.endTime}</small></span>
                  <Course session={session} />
                  <Room session={session} />
                  <ChevronLeft size={15} aria-hidden="true" className="meeting-arrow" />
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
                    <td><span className="meeting-time" dir="ltr"><strong>{session.startTime}</strong><small>{session.endTime}</small></span></td>
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

export function WeekOverview({ groups, today }: { groups: WeekGroup[]; today: DayOfWeek }) {
  const total = groups.reduce((sum, group) => sum + group.meetings.length, 0);
  const courses = new Set(groups.flatMap(({ meetings }) => meetings.map(courseKey))).size;
  const days = groups.filter(({ meetings }) => meetings.length > 0).length;
  const scale = Math.max(...groups.map(({ meetings }) => meetings.length), 1);
  const counts = [
    { label: 'مواد', value: courses, Icon: BookOpen },
    { label: 'محاضرات', value: total, Icon: Calendar },
    { label: 'أيام دوام', value: days, Icon: CalendarDays },
  ];
  return (
    <section className="week-overview surface" aria-labelledby="week-overview-title">
      <h2 id="week-overview-title">نظرة على الأسبوع</h2>
      <dl className="overview-metrics">
        {counts.map(({ label, value, Icon }) => <div key={label}><dt><Icon size={15} aria-hidden="true" />{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <ul className="week-chart" aria-label="عدد المحاضرات حسب اليوم">
        {groups.map(({ day, meetings }, index) => (
          <li key={day} data-today={day === today} aria-label={`${day}: ${meetings.length}`}>
            <span className="chart-track" aria-hidden="true"><span style={{ height: `${meetings.length / scale * 100}%` }} /></span>
            <span>{daysShort[index]}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export const weekGroups = (sessions: LectureSession[]): WeekGroup[] => DAYS_ORDER.map((day) => ({
  day, meetings: sessions.filter((session) => session.day === day).sort((a, b) => a.startTime.localeCompare(b.startTime)),
}));
