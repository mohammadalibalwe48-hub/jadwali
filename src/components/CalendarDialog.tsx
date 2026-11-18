import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import type { LectureSession } from '../types';
import { buildCalendar, validSemester } from '../utils/semester';
import { fieldStyle, primaryStyle, ToolDialog } from './ToolDialog';

export function CalendarDialog({ sessions, onClose }: { sessions: LectureSession[]; onClose: () => void }) {
  const [from, setFrom] = useState('');
  const [through, setThrough] = useState('');
  const [reminder, setReminder] = useState(15);
  const [error, setError] = useState('');

  function exportCalendar() {
    try {
      const contents = buildCalendar(sessions, from, through, reminder);
      const file = new File([contents], 'jadwali-semester.ics', { type: 'text/calendar' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(file);
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 60_000);
      setError('');
    } catch {
      setError('لا توجد محاضرات بأوقات صالحة ضمن هذه التواريخ.');
    }
  }

  return (
    <ToolDialog title="تصدير إلى التقويم" onClose={onClose}>
      <p className="text-sm leading-relaxed text-[#5F5D55]">تُصدّر المحاضرات أسبوعياً بين التاريخين، بالتوقيت المحلي لتقويمك.</p>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); exportCalendar(); }}>
        <div className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2">
          <label className="grid min-w-0 gap-1 text-xs font-bold">بداية الفصل
            <input type="date" dir="ltr" required className={fieldStyle} value={from} onChange={(event) => setFrom(event.target.value)} />
          </label>
          <label className="grid min-w-0 gap-1 text-xs font-bold">نهاية الفصل
            <input type="date" dir="ltr" required min={from || undefined} className={fieldStyle} value={through} onChange={(event) => setThrough(event.target.value)} />
          </label>
        </div>
        <label className="grid gap-1 text-xs font-bold">التذكير قبل المحاضرة
          <select className={fieldStyle} value={reminder} onChange={(event) => setReminder(Number(event.target.value))}>
            <option value={0}>بدون تذكير مرفق</option>
            {[5, 10, 15, 30, 60].map((minutes) => <option key={minutes} value={minutes}>{minutes} دقيقة</option>)}
          </select>
        </label>
        {from && through && !validSemester(from, through) && <p role="alert" className="text-xs text-red-800">اختر فترة مرتّبة تمتد حتى سنة واحدة.</p>}
        {error && <p className="text-xs text-red-800" role="alert">{error}</p>}
        <button className={primaryStyle} disabled={!validSemester(from, through)}><CalendarDays size={16} /> تنزيل ملف التقويم (.ics)</button>
      </form>
      <div className="rounded-xl bg-white p-3 text-xs leading-relaxed text-[#5F5D55]">
        <p>في تقويم Apple على Mac، افتح الملف وحدّد التقويم. على iPhone، يمكنك فتح الملف كمرفق في تطبيق البريد ثم إضافة المحاضرات. في Google Calendar على الكمبيوتر، اختر الإعدادات ثم الاستيراد والتصدير. في Outlook، اختر إضافة تقويم ثم التحميل من ملف. يمكنك ضبط التذكيرات من تطبيق التقويم بعد الاستيراد.</p>
      </div>
    </ToolDialog>
  );
}
