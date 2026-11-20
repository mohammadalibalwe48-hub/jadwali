import { useState } from 'react';
import { Download, Eye, FileText } from 'lucide-react';
import type { FloorRule, LectureSession, ScheduleMetadata } from '../types';
import { useLocale } from '../locale';
import { primaryStyle, secondaryStyle, ToolDialog } from './ToolDialog';

interface Props {
  metadata: ScheduleMetadata;
  sessions: LectureSession[];
  floorRules: FloorRule[];
  onClose: () => void;
}

export function PdfExportDialog({ metadata, sessions, floorRules, onClose }: Props) {
  const { t, locale } = useLocale();
  const [requested, setRequested] = useState(false);
  return (
    <ToolDialog title={t('تصدير PDF')} icon={FileText} onClose={onClose} closeLabel={t('إغلاق التصدير')}>
      <div className="pdf-summary">
        <span className="tool-icon"><FileText size={25} aria-hidden="true" /></span>
        <div>
          <strong dir="auto">{metadata.title && metadata.title !== 'الجدول الدراسي الأسبوعي'
            ? metadata.title : t('الجدول الأسبوعي')}</strong>
          <small>{t(`PDF بحجم A4 · ${sessions.length} محاضرة`, `A4 PDF · ${sessions.length} ${sessions.length === 1 ? 'class' : 'classes'}`)}</small>
        </div>
      </div>
      <form action="/api/pdf" method="post" rel="noopener" onSubmit={() => setRequested(true)}
        aria-describedby="pdf-export-help" className="pdf-actions">
        <input type="hidden" name="payload" value={JSON.stringify({ metadata, sessions, floorRules, locale })} />
        <input type="hidden" name="locale" value={locale} />
        <button type="submit" name="disposition" value="attachment" className={primaryStyle}>
          <Download size={17} aria-hidden="true" />{t('تنزيل PDF')}
        </button>
        <button type="submit" name="disposition" value="inline" formTarget="_blank" className={secondaryStyle}>
          <Eye size={17} aria-hidden="true" />{t('فتح المعاينة')}
        </button>
      </form>
      {requested && <p className="notice notice-success" role="status">
        {t('أُرسل طلب الملف إلى المتصفح.', 'PDF requested. Your browser will open or save the file.')}
      </p>}
      <p id="pdf-export-help" className="dialog-note">
        {t('على iPhone، افتح المعاينة ثم اختر «حفظ في الملفات» من قائمة المشاركة.',
          'On iPhone, open the preview and choose Save to Files from the share menu.')}
      </p>
    </ToolDialog>
  );
}
