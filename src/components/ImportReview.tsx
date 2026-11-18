import { useEffect, useRef, useState } from 'react';
import { Loader2, Plus, ScanLine, X } from 'lucide-react';
import type { LectureSession } from '../types';
import type { VisionMode, VisionOptions } from '../ocr/visionSettings';

interface Props {
  sessions: LectureSession[];
  notices: string[];
  busy: boolean;
  onClose: () => void;
  onAddImages: (files: File[]) => void;
  onScanWithModel: (options: VisionOptions) => void;
  onImport: (sessions: LectureSession[]) => void;
}

export function ImportReview({ sessions, notices, busy, onClose, onAddImages, onScanWithModel, onImport }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const [capabilities, setCapabilities] = useState({ ollama: false, requiresCode: false });
  const [mode, setMode] = useState<VisionMode>('gateway');
  const [credential, setCredential] = useState('');
  const [showVision, setShowVision] = useState(false);

  useEffect(() => {
    dialog.current?.showModal();
    const controller = new AbortController();
    fetch('/api/vision', { signal: controller.signal }).then(async (response) => {
      if (!response.ok) return;
      const settings = await response.json();
      setCapabilities(settings);
      if (settings.ollama) setMode('ollama');
    }).catch(() => {});
    return () => controller.abort();
  }, []);

  const selected = sessions.filter(({ id }) => !excluded.has(id));
  const needsCredential = mode === 'gateway' || capabilities.requiresCode;

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
            {(notices.length ? notices : ['لم تظهر محاضرات كاملة. أضف صوراً أوضح أو جرّب المسح بالنموذج.'])
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
          <button type="button" disabled={busy} onClick={() => setShowVision((shown) => !shown)} aria-expanded={showVision}
            className="inline-flex items-center gap-1 rounded-full border border-[#DFDDD4] px-3 py-2 text-xs font-semibold disabled:opacity-50">
            <ScanLine className="h-4 w-4" /> مسح بنموذج رؤية
          </button>
        </div>

        {showVision && (
          <form className="space-y-3 rounded-2xl border border-[#E6E4DC] p-3 text-sm" onSubmit={(event) => {
            event.preventDefault();
            onScanWithModel({ mode, credential });
            setCredential('');
          }}>
            <label className="grid gap-1">
              <span>خدمة قراءة الصور</span>
              <select value={mode} disabled={busy} onChange={(event) => { setMode(event.target.value as VisionMode); setCredential(''); }}
                className="rounded-xl border border-[#DFDDD4] bg-white px-3 py-2">
                {capabilities.ollama && <option value="ollama">Ollama · Qwen3-VL</option>}
                <option value="gateway">Vercel AI Gateway</option>
              </select>
            </label>
            {needsCredential && <label className="grid gap-1">
              <span>{mode === 'gateway' ? 'مفتاح Vercel AI Gateway' : 'رمز الوصول إلى Ollama'}</span>
              <input type="password" value={credential} onChange={(event) => setCredential(event.target.value)}
                required maxLength={1024} disabled={busy} autoComplete="off" dir="ltr" className="rounded-xl border border-[#DFDDD4] px-3 py-2" />
            </label>}
            <p className="text-xs leading-relaxed text-[#6B6962]">
              {mode === 'gateway' ? 'تُرسل الصور إلى خدمة النموذج عند الضغط على بدء المسح، وقد تُحتسب تكلفة على مفتاحك.' :
                'تُرسل الصور إلى خادم Ollama المهيّأ لهذه النسخة.'}
            </p>
            <button type="submit" disabled={busy} className="rounded-full bg-[#141413] px-4 py-2 text-xs font-bold text-white disabled:opacity-50">
              بدء المسح
            </button>
          </form>
        )}
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
