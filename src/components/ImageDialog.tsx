import { useLocale } from '../locale';
import { useEffect, useState } from 'react';
import { Image, Download, Share2 } from 'lucide-react';
import type { LectureSession, ScheduleMetadata } from '../types';
import { primaryStyle, secondaryStyle, ToolDialog } from './ToolDialog';

interface ImagePage { file: File; url: string }

export function ImageDialog({ sessions, metadata, onClose }: {
  sessions: LectureSession[]; metadata: ScheduleMetadata; onClose: () => void;
}) {
  const { t, locale } = useLocale();
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
    import('../utils/scheduleImage').then(({ createTimetableImages }) => createTimetableImages(sessions, metadata, wallpaper, locale)).then((files) => {
      if (cancelled) return;
      urls = files.map((file) => URL.createObjectURL(file));
      setPages(files.map((file, index) => ({ file, url: urls[index] })));
    }).catch(() => { if (!cancelled) setError("تعذّر تجهيز الصورة. أعد المحاولة."); });
    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [sessions, metadata, wallpaper, locale]);

  const selected = pages[page];
  const shareable = !!selected && !!navigator.canShare?.({ files: [selected.file] });
  async function share() {
    if (!selected) return;
    setError('');
    try {
      await navigator.share({ files: [selected.file] });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setError("تعذّرت المشاركة. نزّل الصورة ثم أرسلها من تطبيق الصور.");
    }
  }

  return (
    <ToolDialog title={t("مشاركة الجدول كصورة")} icon={Image} onClose={onClose}>
      <div role="group" aria-label={t("تنسيق الصورة")} className="flex gap-2">
        {[false, true].map((mode) => <button key={String(mode)} type="button" aria-pressed={wallpaper === mode}
          className={wallpaper === mode ? primaryStyle : secondaryStyle} onClick={() => setWallpaper(mode)}>
          {mode ? t("خلفية شاشة القفل") : t("صورة للمشاركة")}
        </button>)}
      </div>
      {wallpaper && <p className="text-xs text-[var(--muted)]">{t("تترك الخلفية مساحة لساعة شاشة القفل. احفظ الصورة واخترها من إعدادات الخلفية.")}</p>}
      {selected ? <>
        <img className="mx-auto max-h-[42dvh] rounded-md border border-[var(--line)] object-contain" src={selected.url} width={1080} height={wallpaper ? 2340 : 1920} style={{ width: 'auto', height: 'auto' }} alt={t("معاينة صورة الجدول")} />
        {pages.length > 1 && <div className="flex items-center justify-between gap-2 text-xs">
          <button type="button" className={secondaryStyle} disabled={page === 0} onClick={() => setPage(page - 1)}>{t("السابق")}</button>
          <span>{t("صورة") + ' '}{page + 1}{' ' + t("من") + ' '}{pages.length}</span>
          <button type="button" className={secondaryStyle} disabled={page + 1 >= pages.length} onClick={() => setPage(page + 1)}>{t("التالي")}</button>
        </div>}
        <div className="flex flex-wrap gap-2">
          {shareable && <button type="button" className={primaryStyle} onClick={() => void share()}><Share2 size={16} />{' ' + t("مشاركة الصورة")}</button>}
          <a className={shareable ? secondaryStyle : primaryStyle} href={selected.url} download={selected.file.name}><Download size={16} />{' ' + t("تنزيل PNG")}</a>
        </div>
      </> : !error && <p className="text-sm" role="status">{t("جارٍ تجهيز الصورة…")}</p>}
      {error && <p className="text-sm text-red-800" role="alert">{t(error)}</p>}
    </ToolDialog>
  );
}
