import React from 'react';
import { X, Trash2 } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  hasSessions: boolean;
  onClose: () => void;
  onClearAll: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  hasSessions,
  onClose,
  onClearAll,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#141413]/45 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-sheet-up bg-white w-full sm:max-w-md rounded-t-[26px] sm:rounded-[22px] border border-[#E6E4DC] shadow-2xl overflow-hidden"
      >
        <div className="sm:hidden flex justify-center pt-2.5 pb-1">
          <div className="w-10 h-1 rounded-full bg-[#D8D5CD]" />
        </div>

        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#ECEAE3]">
          <h3 className="text-base font-bold text-[#141413]">الإعدادات</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#6B6962] hover:bg-[#F5F4EF] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-[#6B6962] leading-relaxed">
            يعمل قارئ الجداول مباشرة على جهازك عبر محرك قراءة ضوئية (OCR) بدون استخدام الذكاء
            الاصطناعي، وتُحفظ تعديلات جدولك محلياً على متصفحك.
          </p>

          {hasSessions ? (
            <button
              type="button"
              onClick={() => {
                onClearAll();
                onClose();
              }}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-[#B42318] bg-[#FEF3F2] hover:bg-[#FEE4E2] transition cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              مسح الجدول الحالي بالكامل
            </button>
          ) : (
            <div className="text-xs text-[#8C8980] text-center py-2">الجدول الحالي فارغ.</div>
          )}
        </div>
      </div>
    </div>
  );
};
