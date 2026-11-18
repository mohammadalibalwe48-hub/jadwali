import { useEffect, useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import type { LectureSession, ScheduleMetadata } from '../types';
import { primaryStyle, secondaryStyle, ToolDialog } from './ToolDialog';

interface ImagePage { file: File; url: string }

export function ImageDialog({ sessions, metadata, onClose }: {
  sessions: LectureSession[]; metadata: ScheduleMetadata; onClose: () => void;
}) {
  const [wallpaper, setWallpaper] = useState(false);
  const [pages, setPages] = useState<ImagePage[]>([]);
  const [page, setPage] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    let urls: string[] = [];
    setPages([]);
    setPage(0);
    setError('');
    import('../utils/scheduleImage').then(({ createTimetableImages }) => createTimetableImages(sessions, metadata, wallpaper)).then((files) => {
      if (cancelled) return;
      urls = files.map((file) => URL.createObjectURL(file));
      setPages(files.map((file, index) => ({ file, url: urls[index] })));
    }).catch(() => { if (!cancelled) setError('تعذّر تجهيز الصورة. أعد المحاولة.'); });
    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [sessions, metadata, wallpaper]);

  const selected = pages[page];
  const shareable = !!selected && !!navigator.canShare?.({ files: [selected.file] });
  async function share() {
    if (!selected) return;
    setError('');
    try {
      await navigator.share({ files: [selected.file] });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setError('تعذّرت المشاركة. نزّل الصورة ثم أرسلها من تطبيق الصور.');
    }
  }

  return (
    <ToolDialog title="مشاركة الجدول كصورة" onClose={onClose}>
      <div role="group" aria-label="تنسيق الصورة" className="flex gap-2">
        {[false, true].map((mode) => <button key={String(mode)} type="button" aria-pressed={wallpaper === mode}
          className={wallpaper === mode ? primaryStyle : secondaryStyle} onClick={() => setWallpaper(mode)}>
          {mode ? 'خلفية شاشة القفل' : 'صورة للمشاركة'}
        </button>)}
      </div>
      {wallpaper && <p className="text-xs text-[#5F5D55]">تترك الخلفية مساحة لساعة شاشة القفل. احفظ الصورة واخترها من إعدادات الخلفية.</p>}
      {selected ? <>
        <img className="mx-auto max-h-[42dvh] rounded-xl border border-[#DCD9CF] object-contain" src={selected.url} width={1080} height={wallpaper ? 2340 : 1920} style={{ width: 'auto', height: 'auto' }} alt="معاينة صورة الجدول" />
        {pages.length > 1 && <div className="flex items-center justify-between gap-2 text-xs">
          <button type="button" className={secondaryStyle} disabled={page === 0} onClick={() => setPage(page - 1)}>السابق</button>
          <span>صورة {page + 1} من {pages.length}</span>
          <button type="button" className={secondaryStyle} disabled={page + 1 >= pages.length} onClick={() => setPage(page + 1)}>التالي</button>
        </div>}
        <div className="flex flex-wrap gap-2">
          {shareable && <button type="button" className={primaryStyle} onClick={() => void share()}><Share2 size={16} /> مشاركة الصورة</button>}
          <a className={shareable ? secondaryStyle : primaryStyle} href={selected.url} download={selected.file.name}><Download size={16} /> تنزيل PNG</a>
        </div>
      </> : !error && <p className="text-sm" role="status">جارٍ تجهيز الصورة…</p>}
      {error && <p className="text-sm text-red-800" role="alert">{error}</p>}
    </ToolDialog>
  );
}
