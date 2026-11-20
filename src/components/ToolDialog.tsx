import { useLocale } from '../locale';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X, type LucideIcon } from 'lucide-react';

export function ToolDialog({
  title, onClose, children, footer, size = 'normal', closeLabel, closeDisabled = false, icon: Icon,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'normal' | 'wide';
  closeLabel?: string;
  closeDisabled?: boolean;
  icon?: LucideIcon;
}) {
  const { t } = useLocale();
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
        <div className="dialog-heading">{Icon && <span><Icon size={20} aria-hidden="true" /></span>}<h2 id={titleId}>{title}</h2></div>
        <button type="button" aria-label={closeLabel ?? t("إغلاق")} disabled={closeDisabled} onClick={onClose} className="icon-button">
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
