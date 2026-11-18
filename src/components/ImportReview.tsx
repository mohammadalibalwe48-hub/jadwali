import { useEffect, useRef, useState } from 'react';
import { Loader2, Plus, RotateCw, X } from 'lucide-react';
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
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const selected = sessions.filter(({ id }) => !excluded.has(id));

  return (
    <dialog
      ref={dialog}
      aria-labelledby="import-review-title"
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      className="m-auto max-h-[88dvh] w-[min(92vw,42rem)] rounded-3xl border border-[#DFDDD4] bg-white text-[#141413] shadow-xl backdrop:bg-black/35"
    >
      <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-[#E6E4DC] bg-white px-5 py-4">
        <h2 id="import-review-title" className="text-lg font-bold">مراجعة استيراد الجدول</h2>
        <button type="button" disabled={busy} onClick={onClose} aria-label="إغلاق المراجعة" className="rounded-full p-2 hover:bg-[#F5F4EF] disabled:opacity-50">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4 px-5 py-4">
        {(notices.length > 0 || sessions.length === 0) && (
          <div role="status" className="space-y-1 rounded-2xl bg-[#F5F4EF] px-4 py-3 text-sm">
            {(notices.length ? notices : ['لم تظهر محاضرات كاملة. أضف صوراً أوضح للجدول.'])
              .map((notice) => <p key={notice}>{notice}</p>)}
          </div>
        )}

        {sessions.length > 0 && (
          <div className="divide-y divide-[#E6E4DC] rounded-2xl border border-[#E6E4DC]">
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
                  }} className="h-4 w-4 accent-[#141413]" />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{session.courseName}</span>
                  <span className="flex flex-wrap items-center gap-x-2 text-xs text-[#6B6962]">
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
            className="inline-flex items-center gap-1 rounded-full border border-[#DFDDD4] px-3 py-2 text-xs font-semibold disabled:opacity-50">
            <Plus className="h-4 w-4" /> أضف لقطات لهذا الجدول
          </button>
          {onRetry && (
            <button type="button" disabled={busy} onClick={onRetry}
              className="inline-flex items-center gap-1 rounded-full border border-[#DFDDD4] px-3 py-2 text-xs font-semibold disabled:opacity-50">
              <RotateCw className="h-4 w-4" /> أعد القراءة
            </button>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-[#E6E4DC] bg-white px-5 py-3">
        <span className="flex items-center gap-2 text-xs text-[#6B6962]" aria-live="polite">
          {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> جاري قراءة الصور…</> : `المحدّد ${selected.length} من ${sessions.length}`}
        </span>
        <button type="button" disabled={busy || !selected.length} onClick={() => onImport(selected)}
          className="rounded-full bg-[#141413] px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
          إضافة المحدّد
        </button>
      </div>
    </dialog>
  );
}
