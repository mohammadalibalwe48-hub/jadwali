import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function ToolDialog({
  title, onClose, children, footer, size = 'normal', closeLabel = 'إغلاق', closeDisabled = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'normal' | 'wide';
  closeLabel?: string;
  closeDisabled?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog ref={ref} aria-labelledby={titleId} className="workspace-dialog" data-size={size}
      onCancel={(event) => { event.preventDefault(); if (!closeDisabled) onClose(); }}
      onClick={(event) => { if (event.target === event.currentTarget && !closeDisabled) onClose(); }}>
      <div className="dialog-header">
        <h2 id={titleId}>{title}</h2>
        <button type="button" aria-label={closeLabel} disabled={closeDisabled} onClick={onClose} className="icon-button">
          <X size={19} aria-hidden="true" />
        </button>
      </div>
      <div className="dialog-body space-y-4">{children}</div>
      {footer && <div className="dialog-footer">{footer}</div>}
    </dialog>
  );
}

export const fieldStyle = 'dialog-field';
export const primaryStyle = 'button button-primary';
export const secondaryStyle = 'button button-secondary';
