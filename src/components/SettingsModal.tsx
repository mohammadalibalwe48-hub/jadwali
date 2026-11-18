import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { secondaryStyle, ToolDialog } from './ToolDialog';

export function SettingsModal({ hasSessions, onClose, onClearAll }: {
  hasSessions: boolean;
  onClose: () => void;
  onClearAll: () => void;
}) {
  const [confirm, setConfirm] = useState(false);

  return (
    <ToolDialog title="الإعدادات" onClose={onClose}>
      <p className="dialog-note">يُحفظ جدولك في هذا المتصفح. عند استيراد صورة، تُرسل للقراءة. يمكنك تفعيل المزامنة لربط أجهزتك بنسخة مشفّرة.</p>
      {hasSessions ? (
        <div className="settings-danger">
          {confirm && <p className="dialog-note">سيتم مسح كل المحاضرات من جدولك الحالي. هل تريد المتابعة؟</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="button button-danger" onClick={() => {
              if (!confirm) { setConfirm(true); return; }
              onClearAll();
              onClose();
            }}><Trash2 size={16} aria-hidden="true" />{confirm ? 'تأكيد مسح الجدول' : 'مسح الجدول الحالي'}</button>
            {confirm && <button type="button" className={secondaryStyle} onClick={() => setConfirm(false)}>إلغاء</button>}
          </div>
        </div>
      ) : <p className="dialog-note">الجدول الحالي فارغ.</p>}
    </ToolDialog>
  );
}
