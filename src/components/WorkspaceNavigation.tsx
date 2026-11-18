import {
  CalendarDays, CalendarRange, ChevronLeft, ClipboardCheck, Cloud, Download, FileText, Image,
  Layers, MoreHorizontal, Settings2, Smartphone,
} from 'lucide-react';
import { ToolDialog } from './ToolDialog';

export type WorkspaceTool = 'attendance' | 'export' | 'pdf' | 'calendar' | 'image' |
  'floor' | 'settings' | 'install' | 'backup' | 'more';

const schedule = { id: 'schedule', label: 'الجدول', Icon: CalendarDays } as const;
const attendance = { id: 'attendance', label: 'الحضور', Icon: ClipboardCheck } as const;
const exportsTool = { id: 'export', label: 'التصدير', Icon: Download } as const;
const floor = { id: 'floor', label: 'الطوابق', Icon: Layers, detail: 'ربط رموز القاعات بالطوابق' } as const;
const settings = { id: 'settings', label: 'الإعدادات', Icon: Settings2, detail: 'إدارة بيانات جدولك' } as const;
const install = { id: 'install', label: 'تثبيت التطبيق', Icon: Smartphone, detail: 'فتح الجدول من الشاشة الرئيسية' } as const;
const backup = { id: 'backup', label: 'نسخ ومزامنة', Icon: Cloud, detail: 'ربط أجهزتك بنسخة مشفّرة' } as const;
const more = { id: 'more', label: 'المزيد', Icon: MoreHorizontal } as const;

const exportOptions = [
  { id: 'pdf', label: 'تصدير PDF', detail: 'جدول للطباعة أو المشاركة', Icon: FileText },
  { id: 'calendar', label: 'التقويم', detail: 'مواعيد الفصل بصيغة ICS', Icon: CalendarRange },
  { id: 'image', label: 'مشاركة صورة', detail: 'صورة للواتساب أو شاشة القفل', Icon: Image },
] as const;

interface NavigationProps {
  onTool: (tool: WorkspaceTool, launcher: HTMLButtonElement) => void;
  onSchedule: () => void;
}

export function JadwaliBrand({ onSchedule }: Pick<NavigationProps, 'onSchedule'>) {
  return (
    <button className="workspace-brand" type="button" onClick={onSchedule} aria-label="جدولي، الصفحة الرئيسية">
      <span className="brand-mark"><CalendarDays size={22} strokeWidth={2} aria-hidden="true" /></span>
      <span>جدولي</span>
    </button>
  );
}

export function WorkspaceNavigation({ onTool, onSchedule }: NavigationProps) {
  function item({ id, label, Icon }: { id: WorkspaceTool | 'schedule'; label: string; Icon: typeof CalendarDays }) {
    return (
      <button key={id} type="button" className="workspace-nav-item" aria-current={id === 'schedule' ? 'page' : undefined}
        onClick={(event) => id === 'schedule' ? onSchedule() : onTool(id, event.currentTarget)}>
        <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
        <span>{label}</span>
      </button>
    );
  }

  return (
    <>
      <aside className="workspace-rail">
        <JadwaliBrand onSchedule={onSchedule} />
        <nav className="workspace-rail-nav" aria-label="التنقّل الرئيسي">
          <div className="workspace-rail-section">{[schedule, attendance, exportsTool, floor].map(item)}</div>
          <div className="workspace-rail-section">{[backup, install, settings].map(item)}</div>
        </nav>
      </aside>
      <nav className="workspace-dock" aria-label="التنقّل الرئيسي">
        {[schedule, attendance, exportsTool, more].map(item)}
      </nav>
    </>
  );
}

export function WorkspaceMenu({ type, hasSchedule, onTool, onClose }: {
  type: 'export' | 'more'; hasSchedule: boolean; onTool: (tool: WorkspaceTool) => void; onClose: () => void;
}) {
  const exportMenu = type === 'export';
  const options = exportMenu ? exportOptions : [floor, backup, install, settings];

  return (
    <ToolDialog title={exportMenu ? 'تصدير الجدول' : 'المزيد'} onClose={onClose}>
      {exportMenu && !hasSchedule ? <p className="dialog-note">أضف محاضرة إلى جدولك لتتمكّن من تصديره.</p> : (
        <div className="workspace-menu">
          {options.map(({ id, label, Icon, detail }) => (
            <button key={id} type="button" className="workspace-menu-option" onClick={() => onTool(id)}>
              <span className="tool-tile"><Icon size={20} aria-hidden="true" /></span>
              <span className="workspace-menu-copy"><strong>{label}</strong><small>{detail}</small></span>
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </ToolDialog>
  );
}
