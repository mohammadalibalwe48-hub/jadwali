import { courseTone } from '../utils/courseTone';
import { useLocale } from '../locale';
import { Coffee, Clock3 } from 'lucide-react';
import type { Dispatch, SetStateAction } from 'react';
import type { LectureSession } from '../types';
import type { Attendance } from '../utils/attendance';
import { localDate } from '../utils/semester';
import { todayAgenda } from '../utils/today';
import { AttendanceControls } from './AttendanceControls';

export function TodayView({ sessions, now, attendance, onAttendance }: {
  sessions: LectureSession[];
  now: Date;
  attendance: Attendance;
  onAttendance: Dispatch<SetStateAction<Attendance>>;
}) {
  const { t, locationName, locale } = useLocale();
  const minutes = new Intl.NumberFormat(locale, { style: 'unit', unit: 'minute', unitDisplay: 'long', numberingSystem: 'latn' });
  const agenda = todayAgenda(sessions, now);
  const remaining = agenda.filter(({ status }) => status !== 'ended');
  const completed = agenda.filter(({ status }) => status === 'ended');
  const date = localDate(now);

  function renderMeeting({ session, status, gap }: (typeof agenda)[number]) {
    return (
      <li key={session.id}>
        {gap > 0 && <p className="today-gap"><Coffee size={14} aria-hidden="true" />{t("استراحة ·") + ' '}{minutes.format(gap)}</p>}
        <div className="today-meeting" data-status={status}>
          <div className="today-meeting-time">
            <time dateTime={session.startTime}><bdi dir="ltr">{session.startTime}</bdi></time>
            <time dateTime={session.endTime}><bdi dir="ltr">{session.endTime}</bdi></time>
          </div>
          <div className="today-meeting-info" data-course-tone={courseTone(session)}>
            {status === 'ongoing' && <p className="today-live">{t("جارية الآن")}</p>}
            <h3 dir="auto">{session.courseName}</h3>
            <p className="today-location">{t("القاعة") + ' '}<bdi>{locationName(session.room || '—')}</bdi>{' ' + t("· الطابق") + ' '}<bdi>{locationName(session.floor || '—')}</bdi>
            </p>
          </div>
          {status !== 'upcoming' && <AttendanceControls session={session} date={date}
            attendance={attendance} onChange={onAttendance} />}
        </div>
      </li>
    );
  }

  return (
    <section className="today-view" aria-labelledby="today-view-title">
      <div className="today-heading">
        <Clock3 aria-hidden="true" size={20} /><h2 id="today-view-title">{t("جدول اليوم")}</h2>
      </div>
      {remaining.length > 0 ? <ol className="today-meetings">{remaining.map(renderMeeting)}</ol> :
        <p className="today-empty">{completed.length ? t("انتهت محاضرات اليوم.") : t("لا توجد محاضرات اليوم.")}</p>}
      {completed.length > 0 && <details className="today-completed" key={date}>
        <summary>{t("المحاضرات المنتهية") + ' '}<bdi>({completed.length})</bdi></summary>
        <ol className="today-meetings">{completed.map(renderMeeting)}</ol>
      </details>}
    </section>
  );
}
