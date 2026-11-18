import { useRef, useState } from 'react';
import { Loader2, Plus, RotateCw } from 'lucide-react';
import { primaryStyle, secondaryStyle, ToolDialog } from './ToolDialog';
import type { LectureSession } from '../types';

interface Props {
  sessions: LectureSession[];
  notices: string[];
  busy: boolean;
  onClose: () => void;
  onAddImages: (files: File[]) => void;
  onRetry?: () => void;
  onImport: (sessions: LectureSession[]) => void;
}

export function ImportReview({ sessions, notices, busy, onClose, onAddImages, onRetry, onImport }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const selected = sessions.filter(({ id }) => !excluded.has(id));

  return (
    <ToolDialog title="مراجعة استيراد الجدول" onClose={onClose} closeLabel="إغلاق المراجعة" closeDisabled={busy} size="wide" footer={
      <>
        <span className="flex items-center gap-2 text-xs text-[var(--muted)]" aria-live="polite">
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> جاري قراءة الصور…</> : `المحدّد ${selected.length} من ${sessions.length}`}
        </span>
        <button type="button" disabled={busy || !selected.length} onClick={() => onImport(selected)} className={primaryStyle}>
          إضافة المحدّد
        </button>
      </>
    }>
      {(notices.length > 0 || sessions.length === 0) && (
        <div role="status" className="space-y-1 rounded-md bg-[var(--soft)] px-4 py-3 text-sm">
          {(notices.length ? notices : ['لم تظهر محاضرات كاملة. أضف صوراً أوضح للجدول.'])
            .map((notice) => <p key={notice}>{notice}</p>)}
        </div>
      )}

      {sessions.length > 0 && (
        <div className="divide-y divide-[var(--line)] rounded-md border border-[var(--line)]">
          {sessions.map((session) => (
            <label key={session.id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm">
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
                <span className="block font-semibold">{session.courseName}</span>
                <span className="flex flex-wrap items-center gap-x-2 text-xs text-[var(--muted)]">
                  <span>{session.day}</span>
                  <span dir="ltr">{session.startTime}–{session.endTime}</span>
                  <span dir="auto">{session.room}</span>
                  <span>{session.type}</span>
                </span>
              </span>
            </label>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <input ref={input} type="file" accept="image/*" multiple className="hidden" onChange={(event) => {
          const added = Array.from(event.target.files ?? []);
          event.target.value = '';
          if (added.length) onAddImages(added);
        }} />
        <button type="button" disabled={busy} onClick={() => input.current?.click()}
          className={secondaryStyle}>
          <Plus className="h-4 w-4" /> أضف لقطات لهذا الجدول
        </button>
        {onRetry && (
          <button type="button" disabled={busy} onClick={onRetry}
            className={secondaryStyle}>
            <RotateCw className="h-4 w-4" /> أعد القراءة
          </button>
        )}
      </div>
    </ToolDialog>
  );
}
