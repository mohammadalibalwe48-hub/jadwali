import { useEffect, useState } from 'react';
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
  const date = offset === 0 ? 'اليوم' : offset === 1 ? 'غداً' : session.day;
  const countdown = [Math.floor(hours / 24), hours % 24, minutes % 60]
    .flatMap((value, index) => value ? [units[index].format(value)] : []).join(' و');
  const floor = session.floor && session.floor !== '—' && session.floor !== 'غير محدّد' ? session.floor : '—';

  return (
    <section className="next-class" aria-labelledby="next-class-title">
      <h2 id="next-class-title">المحاضرة القادمة</h2>
      <p className="next-class-subject" dir="auto">{session.courseName}</p>
      <div className="next-class-timing">
        <span>{date}</span><bdi>{session.startTime} – {session.endTime}</bdi>
      </div>
      <dl className="next-class-location">
        <div><dt>القاعة</dt><dd><bdi>{session.room || '—'}</bdi></dd></div>
        <div><dt>الطابق</dt><dd>{floor}</dd></div>
      </dl>
      <p className="next-class-countdown">{minutes > 0 ? `بعد ${countdown}` : 'الآن'}</p>
    </section>
  );
}
