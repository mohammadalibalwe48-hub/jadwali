import { Wordmark } from './Brand';
import { useLocale } from '../locale';
import {
  CalendarDays, CalendarRange, ChevronLeft, Globe2, ClipboardCheck, Cloud, Download, FileText, Image, Layers, MoreHorizontal, Settings2, Smartphone,
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
  const { t, locale, setLocale } = useLocale();
  return (
    <header className="workspace-header">
      <div className="workspace-header-inner">
        <button className="workspace-brand" type="button" onClick={onSchedule} aria-label={t("جدولي، الصفحة الرئيسية")}>
          <Wordmark />
        </button>
        <nav className="workspace-nav" aria-label={t("التنقّل الرئيسي")}>
          <button type="button" className="workspace-nav-item" aria-current="page" onClick={onSchedule}><CalendarDays size={17} aria-hidden="true" />{t("الجدول")}</button>
          <button type="button" className="workspace-nav-item" aria-haspopup="dialog"
            onClick={(event) => onTool('attendance', event.currentTarget)}><ClipboardCheck size={17} aria-hidden="true" />{t("الحضور")}</button>
          <button type="button" className="workspace-nav-item nav-export" aria-label={t("التصدير")} aria-haspopup="dialog"
            onClick={(event) => onTool('export', event.currentTarget)}><Download size={17} aria-hidden="true" />{t("التصدير")}</button>
          <button type="button" className="workspace-nav-item nav-more" aria-label={t("المزيد")} aria-haspopup="dialog"
            onClick={(event) => onTool('more', event.currentTarget)}><MoreHorizontal size={21} aria-hidden="true" /><span>{t("المزيد")}</span></button>
        </nav>
        <button type="button" className="language-switch" lang={locale === 'ar' ? 'en' : 'ar'}
          aria-label={t('التبديل إلى الإنجليزية', 'Switch to Arabic')}
          onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}>
          <Globe2 size={17} aria-hidden="true" />{locale === 'ar' ? 'English' : 'العربية'}
        </button>
      </div>
    </header>
  );
}

export function WorkspaceMenu({ type, hasSchedule, onTool, onClose }: {
  type: 'export' | 'more'; hasSchedule: boolean; onTool: (tool: WorkspaceTool) => void; onClose: () => void;
}) {
  const { t } = useLocale();
  const exportMenu = type === 'export';
  const options = exportMenu ? exportOptions : moreOptions;

  return (
    <ToolDialog title={exportMenu ? t("تصدير الجدول") : t("المزيد")} icon={exportMenu ? Download : MoreHorizontal} onClose={onClose}>
      {exportMenu && !hasSchedule ? <p className="dialog-note">{t("أضف محاضرة إلى جدولك لتتمكّن من تصديره.")}</p> : (
        <div className="workspace-menu">
          {options.map(({ id, label, Icon, detail }) => (
            <button key={id} type="button" className="workspace-menu-option" onClick={() => onTool(id)}>
              <Icon className="menu-icon" size={19} aria-hidden="true" />
              <span className="workspace-menu-copy"><strong>{t(label)}</strong><small>{t(detail)}</small></span>
              <ChevronLeft className="menu-arrow" size={15} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </ToolDialog>
  );
}
