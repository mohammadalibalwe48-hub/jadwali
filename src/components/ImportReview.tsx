import { ImageThumbnails, ScanStatus } from './UploadDialog';
import { useLocale } from '../locale';
import { useRef, useState } from 'react';
import { ClipboardCheck, Plus, RotateCw } from 'lucide-react';
import { primaryStyle, secondaryStyle, ToolDialog } from './ToolDialog';
import type { LectureSession } from '../types';

interface Props {
  files: File[];
  sessions: LectureSession[];
  notices: string[];
  busy: boolean;
  onClose: () => void;
  onAddImages: (files: File[]) => void;
  onRetry?: () => void;
  onImport: (sessions: LectureSession[]) => void;
}

export function ImportReview({ files, sessions, notices, busy, onClose, onAddImages, onRetry, onImport }: Props) {
  const { t, dayName, typeName, locationName } = useLocale();
  const input = useRef<HTMLInputElement>(null);
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const selected = sessions.filter(({ id }) => !excluded.has(id));

  return (
    <ToolDialog title={t("مراجعة استيراد الجدول")} onClose={onClose} closeLabel={t("إغلاق المراجعة")} closeDisabled={busy} size="wide" icon={ClipboardCheck} footer={
      <>
        <span className="flex items-center gap-2 text-xs text-[var(--muted)]" aria-live="polite">
          {!busy && t(`المحدّد ${selected.length} من ${sessions.length}`, `${selected.length} of ${sessions.length} selected`)}
        </span>
        <button type="button" disabled={busy || !selected.length} onClick={() => onImport(selected)} className={primaryStyle}>{t("إضافة المحدّد")}</button>
      </>
    }>
      {busy && <ScanStatus />}
      {!busy && <details className="review-files"><summary>{t('الصور المصدر', 'Source images')} <bdi>({files.length})</bdi></summary><ImageThumbnails files={files} /></details>}
      {!busy && (notices.length > 0 || sessions.length === 0) && (
        <div role={onRetry ? 'alert' : 'status'} className={`notice ${onRetry ? 'notice-error' : 'notice-warning'}`}>
          {(notices.length ? notices : ['لم تظهر محاضرات كاملة. أضف صوراً أوضح للجدول.'])
            .map((notice) => <p key={notice}>{t(notice)}</p>)}
        </div>
      )}

      {!busy && sessions.length > 0 && (
        <div className="review-list">
          {sessions.map((session) => (
            <label key={session.id} className="review-row">
              <input type="checkbox" disabled={busy} checked={!excluded.has(session.id)}
                onChange={(event) => {
                  const checked = event.target.checked;
                  setExcluded((prior) => {
                    const next = new Set(prior);
                    if (checked) next.delete(session.id);
                    else next.add(session.id);
                    return next;
                  });
                }} className="h-4 w-4 accent-[var(--brand)]" />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold" dir="auto">{session.courseName}</span>
                <span className="flex flex-wrap items-center gap-x-2 text-xs text-[var(--muted)]">
                  <span>{dayName(session.day)}</span>
                  <span dir="ltr">{session.startTime}–{session.endTime}</span>
                  <span dir="auto">{locationName(session.room)}</span>
                  <span>{typeName(session.type)}</span>
                </span>
              </span>
            </label>
          ))}
        </div>
      )}

      {!busy && <div className="flex flex-wrap gap-2">
        <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(event) => {
          const added = Array.from(event.target.files ?? []);
          event.target.value = '';
          if (added.length) onAddImages(added);
        }} />
        <button type="button" disabled={busy} onClick={() => input.current?.click()}
          className={secondaryStyle}>
          <Plus className="h-4 w-4" />{' ' + t("أضف لقطات لهذا الجدول")}</button>
        {onRetry && (
          <button type="button" disabled={busy} onClick={onRetry}
            className={secondaryStyle}>
            <RotateCw className="h-4 w-4" />{' ' + t("أعد القراءة")}</button>
        )}
      </div>}
    </ToolDialog>
  );
}
