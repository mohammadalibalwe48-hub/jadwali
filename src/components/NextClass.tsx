import { useLocale } from '../locale';
import type { LectureSession } from '../types';
import { nextMeeting } from '../utils/semester';

const units = ['day', 'hour', 'minute'] as const;
export function NextClass({ sessions, now }: { sessions: LectureSession[]; now: Date }) {
  const { t, locationName, locale, dayName } = useLocale();
  const next = nextMeeting(sessions, now);
  if (!next) return null;
  const { session, starts, offset } = next;
  const minutes = Math.ceil((+starts - +now) / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const date = offset === 0 ? t("اليوم") : offset === 1 ? t("غداً") : dayName(session.day);
  const countdown = [days, hours % 24, minutes % 60]
    .flatMap((value, index) => value ? [new Intl.NumberFormat(locale, {
      style: 'unit', unit: units[index], unitDisplay: 'long', numberingSystem: 'latn',
    }).format(value)] : []).join(t(' و', ' and '));

  return (
    <section className="next-class" aria-labelledby="next-class-title">
      <div className="next-class-main">
        <div className="next-class-heading">
          <h3 id="next-class-title">{t("المحاضرة القادمة")}</h3>
          <p className="next-class-countdown">{minutes > 0 ? t(`بعد ${countdown}`, `In ${countdown}`) : t("تبدأ الآن")}</p>
        </div>
        <p className="next-class-subject" dir="auto">{session.courseName}</p>
      </div>
      <dl className="next-class-details">
        <div><dt>{date}</dt><dd className="next-time"><bdi dir="ltr">{session.startTime}–{session.endTime}</bdi></dd></div>
        <div><dt>{t("القاعة")}</dt><dd><bdi>{locationName(session.room || '—')}</bdi></dd></div>
        <div><dt>{t("الطابق")}</dt><dd>{session.floor === 'غير محدّد' ? '—'  : locationName(session.floor || '—')}</dd></div>
      </dl>
    </section>
  );
}
