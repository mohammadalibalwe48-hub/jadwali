import {
  CalendarDays, CalendarRange, ChevronLeft, ClipboardCheck, Cloud, Download, FileText, Image, Layers, MoreHorizontal, Settings2, Smartphone,
} from 'lucide-react';
import { ToolDialog } from './ToolDialog';

export type WorkspaceTool = 'attendance' | 'export' | 'pdf' | 'calendar' | 'image' |
  'floor' | 'settings' | 'install' | 'backup' | 'more';

const exportOptions = [
  { id: 'pdf', label: 'تصدير PDF', detail: 'جدول للطباعة أو المشاركة', Icon: FileText },
  { id: 'calendar', label: 'التقويم', detail: 'مواعيد الفصل بصيغة ICS', Icon: CalendarRange },
  { id: 'image', label: 'مشاركة صورة', detail: 'صورة للواتساب أو شاشة القفل', Icon: Image },
] as const;

const moreOptions = [
  { id: 'floor', label: 'الطوابق', detail: 'ربط رموز القاعات بالطوابق', Icon: Layers },
  { id: 'backup', label: 'نسخ ومزامنة', detail: 'ربط أجهزتك بنسخة مشفّرة', Icon: Cloud },
  { id: 'install', label: 'تثبيت التطبيق', detail: 'فتح الجدول من الشاشة الرئيسية', Icon: Smartphone },
  { id: 'settings', label: 'الإعدادات', detail: 'إدارة بيانات جدولك', Icon: Settings2 },
] as const;

interface NavigationProps {
  onTool: (tool: WorkspaceTool, launcher: HTMLButtonElement) => void;
  onSchedule: () => void;
}

export function WorkspaceNavigation({ onTool, onSchedule }: NavigationProps) {
  return (
    <header className="workspace-header">
      <div className="workspace-header-inner">
        <button className="workspace-brand" type="button" onClick={onSchedule} aria-label="جدولي، الصفحة الرئيسية">
          <span className="brand-mark"><CalendarRange size={19} aria-hidden="true" /></span>
          <span>جدولي</span>
        </button>
        <nav className="workspace-nav" aria-label="التنقّل الرئيسي">
          <button type="button" className="workspace-nav-item" aria-current="page" onClick={onSchedule}><CalendarDays size={17} aria-hidden="true" />الجدول</button>
          <button type="button" className="workspace-nav-item" aria-haspopup="dialog"
            onClick={(event) => onTool('attendance', event.currentTarget)}><ClipboardCheck size={17} aria-hidden="true" />الحضور</button>
          <button type="button" className="workspace-nav-item nav-export" aria-label="التصدير" aria-haspopup="dialog"
            onClick={(event) => onTool('export', event.currentTarget)}><Download size={17} aria-hidden="true" />التصدير</button>
          <button type="button" className="workspace-nav-item nav-more" aria-label="المزيد" aria-haspopup="dialog"
            onClick={(event) => onTool('more', event.currentTarget)}><MoreHorizontal size={21} aria-hidden="true" /><span>المزيد</span></button>
        </nav>
      </div>
    </header>
  );
}

export function WorkspaceMenu({ type, hasSchedule, onTool, onClose }: {
  type: 'export' | 'more'; hasSchedule: boolean; onTool: (tool: WorkspaceTool) => void; onClose: () => void;
}) {
  const exportMenu = type === 'export';
  const options = exportMenu ? exportOptions : moreOptions;

  return (
    <ToolDialog title={exportMenu ? 'تصدير الجدول' : 'المزيد'} onClose={onClose}>
      {exportMenu && !hasSchedule ? <p className="dialog-note">أضف محاضرة إلى جدولك لتتمكّن من تصديره.</p> : (
        <div className="workspace-menu">
          {options.map(({ id, label, Icon, detail }) => (
            <button key={id} type="button" className="workspace-menu-option" onClick={() => onTool(id)}>
              <Icon className="menu-icon" size={19} aria-hidden="true" />
              <span className="workspace-menu-copy"><strong>{label}</strong><small>{detail}</small></span>
              <ChevronLeft className="menu-arrow" size={15} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </ToolDialog>
  );
}
