import { courseTone } from '../utils/courseTone';
import { useLocale } from '../locale';
import { Pencil, Plus } from 'lucide-react';
import { DAYS_ORDER, type DayOfWeek, type LectureSession } from '../types';

export type DayFilter = DayOfWeek | 'الكل';
type ViewMode = 'agenda' | 'table';
export type WeekGroup = { day: DayOfWeek; meetings: LectureSession[] };

const daysShort = ['سبت', 'أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة'];

function Room({ session }: { session: LectureSession }) {
  const { t, locationName } = useLocale();
  const room = session.room || '—';
  const floor = session.floor && session.floor !== '—' && session.floor !== 'غير محدّد' ? session.floor : '';
  return (
    <span className="meeting-room">
      <bdi>{locationName(room)}</bdi>
      {floor && <small>{t("الطابق") + ' '}{locationName(floor)}</small>}
    </span>
  );
}

function Course({ session }: { session: LectureSession }) {
  const { typeName } = useLocale();
  return (
    <span className="meeting-course" data-course-tone={courseTone(session)}>
      <strong dir="auto">{session.courseName}</strong>
      <span className="meeting-meta">
        <span className="meeting-type" data-practical={session.type === 'عملي'}>{typeName(session.type)}</span>
        {session.courseCode && <><span aria-hidden="true">·</span><bdi>{session.courseCode}</bdi></>}
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
  const { t, locale, dayName } = useLocale();
  const visible = groups.filter(({ day, meetings }) => (selectedDay === 'الكل' || selectedDay === day) && meetings.length);
  return (
    <section className="schedule-board" aria-labelledby="schedule-board-title">
      <div className="schedule-heading">
        <h2 id="schedule-board-title">{t("الجدول الأسبوعي")}</h2>
        <div className="view-switch" role="group" aria-label={t("طريقة عرض المحاضرات")}>
          <button className="view-option" type="button" aria-pressed={view === 'agenda'} onClick={() => onView('agenda')}>{t("قائمة")}</button>
          <button className="view-option" type="button" aria-pressed={view === 'table'} onClick={() => onView('table')}>{t("جدول")}</button>
        </div>
      </div>
      <div className="week-selector" role="group" aria-label={t("أيام الجدول")}>
        <button className="week-day week-all" type="button" aria-pressed={selectedDay === 'الكل'} onClick={() => onDay('الكل')}>{t("الأسبوع")}</button>
        {groups.map(({ day }, index) => (
          <button type="button" className="week-day" key={day} aria-pressed={selectedDay === day}
            aria-label={dayName(day)} aria-current={today === day ? 'date' : undefined} onClick={() => onDay(day)}>
            <span className="day-full">{dayName(day)}</span><span className="day-short">{locale === 'ar' ? daysShort[index] : dayName(day, true)}</span>
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <div className="day-empty">
          <h3>{selectedDay === 'الكل' ? t('لا توجد محاضرات في الجدول.', 'No scheduled classes.') : t(`لا توجد محاضرات يوم ${selectedDay}`, `No classes on ${dayName(selectedDay)}`)}</h3>
          <button type="button" className="button button-secondary" onClick={onNew}><Plus size={16} aria-hidden="true" />{' ' + t("إضافة محاضرة")}</button>
        </div>
      ) : view === 'agenda' ? (
        <div className="agenda" key={selectedDay}>
          {visible.map(({ day, meetings }) => (
            <section key={day} className="agenda-day" data-today={today === day} aria-label={dayName(day)}>
              <h3><span>{dayName(day)}</span>{today === day && <span className="today-label">{t("اليوم")}</span>}</h3>
              <ul className="agenda-sessions">
                {meetings.map((session) => (
                  <li key={session.id}>
                    <button className="meeting-row" type="button" onClick={() => onEdit(session)}>
                      <MeetingTime session={session} />
                      <Course session={session} />
                      <Room session={session} />
                      <Pencil size={15} strokeWidth={1.6} aria-hidden="true" className="meeting-edit" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <div className="schedule-table-scroll" key={selectedDay} tabIndex={0} role="region" aria-label={t("جدول المحاضرات")}>
          <table className="schedule-table">
            <thead><tr><th scope="col">{t("اليوم", "Day")}</th><th scope="col">{t("الوقت")}</th><th scope="col">{t("المحاضرة")}</th><th scope="col">{t("القاعة")}</th></tr></thead>
            {visible.map(({ day, meetings }) => (
              <tbody key={day}>
                {meetings.map((session, index) => (
                  <tr key={session.id}>
                    {index === 0 && <th scope="rowgroup" rowSpan={meetings.length}>{dayName(day)}{today === day && <span className="today-label">{t("اليوم")}</span>}</th>}
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
