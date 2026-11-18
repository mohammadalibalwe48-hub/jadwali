import { useEffect, useRef } from 'react';
import { Download, Eye, X } from 'lucide-react';
import type { FloorRule, LectureSession, ScheduleMetadata } from '../types';

interface Props {
  metadata: ScheduleMetadata;
  sessions: LectureSession[];
  floorRules: FloorRule[];
  onClose: () => void;
}

export function PdfExportDialog({ metadata, sessions, floorRules, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="pdf-export-title"
      aria-describedby="pdf-export-help"
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      className="m-auto w-[min(92vw,25rem)] rounded-[24px] border border-[#DFDDD4] bg-white px-5 py-4 text-[#141413] shadow-xl backdrop:bg-black/35"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="pdf-export-title" className="text-lg font-bold">تصدير الجدول</h2>
        <button type="button" onClick={onClose} aria-label="إغلاق التصدير"
          className="rounded-full p-2 hover:bg-[#F5F4EF]">
          <X className="h-4 w-4" />
        </button>
      </div>
      {/* A native submission lets the browser handle the HTTP PDF directly from the tap. */}
      <form action="/api/pdf" method="post" rel="noopener" className="grid grid-cols-2 gap-2">
        <input type="hidden" name="payload" value={JSON.stringify({ metadata, sessions, floorRules })} />
        <button type="submit" name="disposition" value="attachment"
          className="flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#141413] px-2 py-2 text-sm font-semibold text-white">
          <Download className="h-4 w-4" />
          تنزيل PDF
        </button>
        <button type="submit" name="disposition" value="inline" formTarget="_blank"
          className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#DFDDD4] px-2 py-2 text-sm font-semibold">
          <Eye className="h-4 w-4" />
          فتح المعاينة
        </button>
      </form>
      <p id="pdf-export-help" className="mt-4 text-xs leading-relaxed text-[#6B6962]">
        على <bdi>iPhone</bdi>، يمكنك فتح المعاينة ثم اختيار «حفظ في الملفات» من قائمة المشاركة.
      </p>
    </dialog>
  );
}
