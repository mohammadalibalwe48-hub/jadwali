import { useEffect, useState } from 'react';
import { CalendarClock } from 'lucide-react';
import type { LectureSession } from '../types';
import { nextMeeting } from '../utils/semester';

const units = (['day', 'hour', 'minute'] as const).map((unit) =>
  new Intl.NumberFormat('ar', { style: 'unit', unit, unitDisplay: 'long', numberingSystem: 'latn' }));

export function NextClass({ sessions }: { sessions: LectureSession[] }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = window.setInterval(update, 10_000);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);

  const next = nextMeeting(sessions, now);
  if (!next) return null;
  const { session, starts, offset } = next;
  const minutes = Math.ceil((+starts - +now) / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const date = offset === 0 ? 'اليوم' : offset === 1 ? 'غداً' : session.day;
  const countdown = [days, hours % 24, minutes % 60]
    .flatMap((value, index) => value ? [units[index].format(value)] : []).join(' و');
  const reading = minutes === 0 ? 'الآن' : days > 0 ? String(days) : hours > 0
    ? `${hours}:${String(minutes % 60).padStart(2, '0')}` : String(minutes);
  const readingUnit = minutes === 0 ? '' : days > 0 ? 'يوم' : hours > 0 ? 'ساعة ودقيقة' : 'دقيقة';
  const knownFloor = session.floor && session.floor !== '—' && session.floor !== 'غير محدّد';

  return (
    <section className="next-class" aria-labelledby="next-class-title">
      <div className="next-class-main">
        <h2 id="next-class-title"><CalendarClock size={17} strokeWidth={1.7} aria-hidden="true" /> المحاضرة القادمة</h2>
        <p className="next-class-subject" dir="auto">{session.courseName}</p>
        <dl className="next-class-details">
          <div><dt>{date}</dt><dd className="next-time"><bdi>{session.startTime}–{session.endTime}</bdi></dd></div>
          <div><dt>القاعة</dt><dd><bdi>{session.room || '—'}</bdi></dd></div>
          <div><dt>الطابق</dt><dd>{knownFloor ? session.floor : '—'}</dd></div>
        </dl>
      </div>
      <div className="next-class-clock">
        <div className="clock-dial" aria-hidden="true">
          <div className="clock-reading">
            <bdi>{reading}</bdi>
            {readingUnit && <span>{readingUnit}</span>}
          </div>
        </div>
        <p className="next-class-countdown">{minutes > 0 ? `بعد ${countdown}` : 'تبدأ الآن'}</p>
      </div>
    </section>
  );
}
