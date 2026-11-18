import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

export function ToolDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog ref={ref} aria-labelledby={titleId}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-auto rounded-[24px] border border-[#E2DFD7] bg-[#F5F4EF] text-[#141413] shadow-xl backdrop:bg-black/45">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-[#E2DFD7] bg-[#F5F4EF] px-4 py-3 sm:px-5">
        <h2 id={titleId} className="text-base font-bold">{title}</h2>
        <button type="button" aria-label="إغلاق" onClick={onClose} className="rounded-full bg-white p-2 hover:bg-[#E8E6DF]"><X size={17} /></button>
      </div>
      <div className="space-y-4 p-4 sm:p-5">{children}</div>
    </dialog>
  );
}

export const fieldStyle = 'w-full min-w-0 rounded-xl border border-[#DCD9CF] bg-white px-3 py-2.5 text-sm';
export const primaryStyle = 'inline-flex items-center justify-center gap-2 rounded-xl bg-[#173832] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#235047] disabled:opacity-50';
export const secondaryStyle = 'inline-flex items-center justify-center gap-2 rounded-xl border border-[#DCD9CF] bg-white px-4 py-2.5 text-sm font-semibold hover:bg-[#EAE8E0] disabled:opacity-50';
