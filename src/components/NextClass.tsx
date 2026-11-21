import { CalendarClock, Clock3, Layers, MapPin } from 'lucide-react';
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
        <h2 id="next-class-title"><CalendarClock size={18} aria-hidden="true" />{t("المحاضرة القادمة")}</h2>
        <p className="next-class-subject" dir="auto">{session.courseName}</p>
        <p className="next-class-time">
          <span>{date}</span>
          <bdi dir="ltr">{session.startTime}–{session.endTime}</bdi>
        </p>
        <p className="next-class-countdown">
          <Clock3 size={15} aria-hidden="true" />
          <span>{minutes > 0 ? t(`بعد ${countdown}`, `In ${countdown}`) : t("تبدأ الآن")}</span>
        </p>
      </div>
      <dl className="next-class-details">
        <div>
          <dt><MapPin size={15} aria-hidden="true" />{t("القاعة")}</dt>
          <dd><bdi>{locationName(session.room || '—')}</bdi></dd>
        </div>
        <div>
          <dt><Layers size={15} aria-hidden="true" />{t("الطابق")}</dt>
          <dd><bdi>{session.floor === 'غير محدّد' ? '—' : locationName(session.floor || '—')}</bdi></dd>
        </div>
      </dl>
    </section>
  );
}
