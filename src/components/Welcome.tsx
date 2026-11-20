import { ArrowUpRight, ImagePlus, Plus, RotateCcw } from 'lucide-react';
import artwork from '../assets/schedule-transformation.svg';
import { useLocale } from '../locale';

export function Welcome({ onUpload, onNew, onRestore, onDrop }: {
  onUpload: () => void;
  onNew: () => void;
  onRestore: (launcher: HTMLButtonElement) => void;
  onDrop: (files: File[]) => void;
}) {
  const { t } = useLocale();
  return <section className="welcome" aria-labelledby="welcome-title"
    onDragOver={(event) => event.preventDefault()}
    onDrop={(event) => { event.preventDefault(); onDrop(Array.from(event.dataTransfer.files)); }}>
    <div className="welcome-copy">
      <h1 id="welcome-title">{t('من صورة جدول', 'From photo')}<br />
        <em>{t('إلى أسبوع مرتب.', 'to timetable.')}</em></h1>
      <p>{t('حوّل صورة جدولك الجامعي إلى جدول أسبوعي واضح. راجع المحاضرات وصدّر نسخة PDF جاهزة للمشاركة.',
        'Turn a screenshot of your university schedule into a clear weekly timetable. Review your classes and export a PDF to share.')}</p>
      <div className="welcome-actions">
        <button className="button button-coral" type="button" onClick={onUpload}>
          <ImagePlus size={19} aria-hidden="true" />{t('استيراد صورة')}<ArrowUpRight className="directional-arrow" size={17} aria-hidden="true" />
        </button>
        <button className="button button-outline" type="button" onClick={onNew}>
          <Plus size={18} aria-hidden="true" />{t('إضافة محاضرة')}
        </button>
      </div>
      <button className="welcome-restore" type="button" onClick={(event) => onRestore(event.currentTarget)}>
        <RotateCcw size={15} aria-hidden="true" />{t('استعادة جدول من جهاز آخر')}
      </button>
    </div>
    <div className="welcome-art">
      <img src={artwork} alt="" width={660} height={480} fetchPriority="high" />
    </div>
  </section>;
}
