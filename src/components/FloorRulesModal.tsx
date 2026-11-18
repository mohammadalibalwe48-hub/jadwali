import React, { useState } from 'react';
import { X, Plus, Trash2, RotateCcw } from 'lucide-react';
import type { FloorRule } from '../types';
import { DEFAULT_FLOOR_RULES } from '../utils/floorMapper';

interface FloorRulesModalProps {
  isOpen: boolean;
  rules: FloorRule[];
  onClose: () => void;
  onSaveRules: (rules: FloorRule[]) => void;
}

export const FloorRulesModal: React.FC<FloorRulesModalProps> = ({
  isOpen,
  rules,
  onClose,
  onSaveRules,
}) => {
  const [draftRules, setDraftRules] = useState<FloorRule[]>(rules);
  const [newPrefix, setNewPrefix] = useState('');
  const [newFloor, setNewFloor] = useState('');

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPrefix.trim() || !newFloor.trim()) return;
    const prefix = newPrefix.trim();
    setDraftRules((prev) => [
      ...prev,
      {
        id: `rule-${Date.now()}`,
        prefix,
        floor: newFloor.trim(),
        example: `${prefix}-01`,
      },
    ]);
    setNewPrefix('');
    setNewFloor('');
  };

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
          <div>
            <h3 className="text-base font-bold text-[#141413]">دليل رموز الطوابق</h3>
            <p className="text-xs text-[#6B6962] mt-0.5">
              يُطبّق تلقائياً حسب أول حرف من رمز القاعة
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[#6B6962] hover:bg-[#F5F4EF] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[75dvh] overflow-y-auto">
          <div className="divide-y divide-[#ECEAE3] border border-[#E6E4DC] rounded-2xl bg-[#FAF9F5]">
            {draftRules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between gap-3 px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <span
                    dir="ltr"
                    className="inline-flex items-center justify-center min-w-11 px-2.5 py-1 rounded-lg bg-white border border-[#DFDDD4] text-[#141413] font-mono-num font-bold text-xs"
                  >
                    {rule.prefix}
                  </span>
                  <div>
                    <div className="text-sm font-bold text-[#141413]">الطابق {rule.floor}</div>
                    <div className="text-[11px] font-mono-num text-[#78766F]" dir="ltr">
                      {rule.example}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDraftRules((prev) => prev.filter((r) => r.id !== rule.id))}
                  className="p-1.5 text-[#8C8980] hover:text-[#B42318] rounded-lg transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={handleAdd} className="flex items-end gap-2">
            <div className="w-24">
              <label className="block text-[11px] font-semibold text-[#6B6962] mb-1">الرمز</label>
              <input
                type="text"
                dir="auto"
                placeholder="T"
                value={newPrefix}
                onChange={(e) => setNewPrefix(e.target.value)}
                className="w-full rounded-xl bg-[#FAF9F5] border border-[#E2DFD7] px-3 py-2 text-sm font-mono-num font-bold focus:bg-white focus:border-[#141413] focus:outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[11px] font-semibold text-[#6B6962] mb-1">الطابق</label>
              <input
                type="text"
                placeholder="الثالث"
                value={newFloor}
                onChange={(e) => setNewFloor(e.target.value)}
                className="w-full rounded-xl bg-[#FAF9F5] border border-[#E2DFD7] px-3 py-2 text-sm font-semibold focus:bg-white focus:border-[#141413] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="p-2.5 rounded-xl bg-[#F5F4EF] border border-[#E2DFD7] text-[#141413] hover:bg-[#EAE8E0] transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
            </button>
          </form>

          <div className="flex items-center justify-between pt-3 border-t border-[#ECEAE3]">
            <button
              type="button"
              onClick={() => setDraftRules(DEFAULT_FLOOR_RULES)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6B6962] hover:text-[#141413] cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              الافتراضي
            </button>
            <button
              type="button"
              onClick={() => {
                onSaveRules(draftRules);
                onClose();
              }}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#141413] text-white hover:bg-[#2A2927] transition cursor-pointer"
            >
              تطبيق
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
