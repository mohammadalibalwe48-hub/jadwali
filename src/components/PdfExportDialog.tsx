import { Download, Eye } from 'lucide-react';
import type { FloorRule, LectureSession, ScheduleMetadata } from '../types';
import { primaryStyle, secondaryStyle, ToolDialog } from './ToolDialog';

interface Props {
  metadata: ScheduleMetadata;
  sessions: LectureSession[];
  floorRules: FloorRule[];
  onClose: () => void;
}

export function PdfExportDialog({ metadata, sessions, floorRules, onClose }: Props) {
  return (
    <ToolDialog title="تصدير PDF" onClose={onClose} closeLabel="إغلاق التصدير">
      <p id="pdf-export-help" className="dialog-note">
        على <bdi>iPhone</bdi>، يمكنك فتح المعاينة ثم اختيار «حفظ في الملفات» من قائمة المشاركة.
      </p>
      <form action="/api/pdf" method="post" rel="noopener" aria-describedby="pdf-export-help" className="flex flex-wrap gap-2">
        <input type="hidden" name="payload" value={JSON.stringify({ metadata, sessions, floorRules })} />
        <button type="submit" name="disposition" value="attachment" className={primaryStyle}>
          <Download size={17} aria-hidden="true" /> تنزيل PDF
        </button>
        <button type="submit" name="disposition" value="inline" formTarget="_blank" className={secondaryStyle}>
          <Eye size={17} aria-hidden="true" /> فتح المعاينة
        </button>
      </form>
    </ToolDialog>
  );
}
