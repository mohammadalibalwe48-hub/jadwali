import React, { useState } from 'react';
import { Plus, Trash2, RotateCcw } from 'lucide-react';
import { ToolDialog } from './ToolDialog';
import type { FloorRule } from '../types';
import { DEFAULT_FLOOR_RULES } from '../utils/floorMapper';

interface FloorRulesModalProps {
  rules: FloorRule[];
  onClose: () => void;
  onSaveRules: (rules: FloorRule[]) => void;
}

export const FloorRulesModal: React.FC<FloorRulesModalProps> = ({
  rules,
  onClose,
  onSaveRules,
}) => {
  const [draftRules, setDraftRules] = useState<FloorRule[]>(rules);
  const [newPrefix, setNewPrefix] = useState('');
  const [newFloor, setNewFloor] = useState('');


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
    <ToolDialog title="دليل رموز الطوابق" onClose={onClose}>
      <p className="dialog-note">يُستخدم الرمز الأول للقاعة لتحديد طابقها تلقائياً.</p>
      <div className="divide-y divide-[var(--line)] border border-[var(--line)] rounded-md bg-[var(--soft)]">
        {draftRules.map((rule) => (
          <div
            key={rule.id}
            className="flex items-center justify-between gap-3 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <span
                dir="ltr"
                className="inline-flex items-center justify-center min-w-11 px-2.5 py-1 rounded-md bg-white border border-[var(--line)] text-[var(--ink)] font-mono-num font-bold text-xs"
              >
                {rule.prefix}
              </span>
              <div>
                <div className="text-sm font-bold text-[var(--ink)]">الطابق {rule.floor}</div>
                <div className="text-[11px] font-mono-num text-[var(--muted)]" dir="ltr">
                  {rule.example}
                </div>
              </div>
            </div>
            <button
              type="button" aria-label={`حذف قاعدة ${rule.prefix}`}
              onClick={() => setDraftRules((prev) => prev.filter((r) => r.id !== rule.id))}
              className="p-1.5 text-[var(--muted)] hover:text-[#B42318] rounded-md transition cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={handleAdd} className="flex items-end gap-2">
        <div className="w-24">
          <label htmlFor="floor-prefix" className="block text-[11px] font-semibold text-[var(--muted)] mb-1">الرمز</label>
          <input id="floor-prefix"
            type="text"
            dir="auto"
            placeholder="T"
            value={newPrefix}
            onChange={(e) => setNewPrefix(e.target.value)}
            className="w-full rounded-md bg-[var(--soft)] border border-[var(--line)] px-3 py-2 text-sm font-mono-num font-bold focus:bg-white focus:border-[var(--ink)] focus:outline-none"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="floor-name" className="block text-[11px] font-semibold text-[var(--muted)] mb-1">الطابق</label>
          <input id="floor-name"
            type="text"
            placeholder="الثالث"
            value={newFloor}
            onChange={(e) => setNewFloor(e.target.value)}
            className="w-full rounded-md bg-[var(--soft)] border border-[var(--line)] px-3 py-2 text-sm font-semibold focus:bg-white focus:border-[var(--ink)] focus:outline-none"
          />
        </div>
        <button
          type="submit" aria-label="إضافة قاعدة"
          className="p-2.5 rounded-md bg-[var(--soft)] border border-[var(--line)] text-[var(--ink)] hover:bg-[var(--hover)] transition cursor-pointer"
        >
          <Plus className="w-4 h-4" />
        </button>
      </form>

      <div className="flex items-center justify-between pt-3 border-t border-[var(--line)]">
        <button
          type="button"
          onClick={() => setDraftRules(DEFAULT_FLOOR_RULES)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted)] hover:text-[var(--ink)] cursor-pointer"
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
          className="px-5 py-2.5 rounded-md text-xs font-bold bg-[var(--brand)] text-white hover:bg-[var(--brand-hover)] transition cursor-pointer"
        >
          تطبيق
        </button>
      </div>
    </ToolDialog>
  );
};
