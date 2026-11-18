import { useEffect, useState } from 'react';
import { Clock3, Layers, MapPin } from 'lucide-react';
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

  return (
    <section className="mb-4 rounded-[22px] bg-[#173832] text-white px-4 py-4 sm:px-5 sm:py-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-[#D5F0E8]">
        <h2 className="flex items-center gap-1.5"><Clock3 size={15} aria-hidden="true" /> المحاضرة القادمة</h2>
        <span className="rounded-full bg-white/10 px-2.5 py-1">{minutes > 0 ? `بعد ${countdown}` : 'الآن'}</span>
      </div>
      <p className="mt-2.5 text-lg sm:text-xl font-bold break-words">{session.courseName} <span className="text-xs font-medium text-[#D5F0E8]">· {session.type}</span></p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
        <span>{date} · <bdi className="font-mono-num">{session.startTime} – {session.endTime}</bdi></span>
        <span className="flex items-center gap-1"><MapPin size={14} aria-hidden="true" /> القاعة <bdi>{session.room || '—'}</bdi></span>
        <span className="flex items-center gap-1"><Layers size={14} aria-hidden="true" /> الطابق {session.floor || '—'}</span>
      </div>
    </section>
  );
}
