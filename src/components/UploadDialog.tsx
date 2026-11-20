import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, ScanLine, X } from 'lucide-react';
import { useLocale } from '../locale';
import { MAX_VISION_SCREENS } from '../services/visionSettings';
import { ToolDialog } from './ToolDialog';

function Thumbnail({ file }: { file: File }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const source = URL.createObjectURL(file);
    setUrl(source);
    return () => URL.revokeObjectURL(source);
  }, [file]);
  return url ? <img src={url} alt="" width={64} height={52} /> : null;
}

export function ImageThumbnails({ files, onRemove }: { files: File[]; onRemove?: (index: number) => void }) {
  const { t } = useLocale();
  return <ul className="file-list">{files.map((file, index) => (
    <li key={`${file.name}-${file.lastModified}-${index}`}>
      <Thumbnail file={file} />
      <bdi title={file.name}>{file.name}</bdi>
      {onRemove && <button type="button" className="icon-button" aria-label={t(`إزالة ${file.name}`, `Remove ${file.name}`)}
        onClick={() => onRemove(index)}><X size={17} aria-hidden="true" /></button>}
    </li>
  ))}</ul>;
}

export function ScanStatus() {
  const { t } = useLocale();
  const status = useRef<HTMLDivElement>(null);
  useEffect(() => status.current?.focus(), []);
  return <div ref={status} tabIndex={-1} className="scan-status" role="status">
    <span className="scan-graphic" aria-hidden="true"><ScanLine size={40} /></span>
    <strong>{t('جاري قراءة الصور…')}</strong>
    <p>{t('نستخرج أسماء المقررات والأيام والأوقات. ستراجع النتائج قبل حفظها.',
      'We’re reading course names, days, and times. You’ll review the results before saving.')}</p>
  </div>;
}

export function UploadDialog({ files, busy, error, onAdd, onReplace, onRemove, onScan, onClose }: {
  files: File[];
  busy: boolean;
  error: string;
  onAdd: (files: File[]) => void;
  onReplace: (files: File[]) => void;
  onRemove: (index: number) => void;
  onScan: () => void;
  onClose: () => void;
}) {
  const { t } = useLocale();
  const [dragging, setDragging] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const replace = useRef(false);

  return <ToolDialog title={t('استيراد جدول جامعي', 'Import a timetable')} size="wide" onClose={onClose} closeDisabled={busy}
    icon={ImagePlus} footer={busy ? undefined : <>
      <span className="dialog-note">{t(`${files.length} من ${MAX_VISION_SCREENS} صور`, `${files.length} of ${MAX_VISION_SCREENS} images`)}</span>
      <button type="button" className="button button-coral" disabled={!files.length} onClick={onScan} data-scan-images>
        <ScanLine size={18} aria-hidden="true" />{t('قراءة الجدول', 'Scan timetable')}
      </button>
    </>}>
    {busy ? <ScanStatus /> : <>
      <input ref={picker} type="file" accept="image/*" multiple hidden onChange={(event) => {
        const selected = Array.from(event.target.files ?? []);
        event.target.value = '';
        if (selected.length) (replace.current ? onReplace : onAdd)(selected);
      }} />
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(event) => {
        const selected = Array.from(event.target.files ?? []);
        event.target.value = '';
        if (selected.length) onAdd(selected);
      }} />
      <div className="drop-zone" data-active={dragging}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={(event) => { if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          onAdd(Array.from(event.dataTransfer.files));
        }}>
        <span className="drop-icon"><ImagePlus size={30} aria-hidden="true" /></span>
        <strong>{t('أضف صور الجدول', 'Add your timetable images')}</strong>
        <p>{t(`اسحب الصور هنا أو اخترها من جهازك. حتى ${MAX_VISION_SCREENS} صور للجدول نفسه.`,
          `Drop images here or choose them from your device. Up to ${MAX_VISION_SCREENS} images of the same timetable.`)}</p>
        <div className="drop-actions">
          <button className="button button-primary" type="button" onClick={() => { replace.current = false; picker.current?.click(); }}>
            {t('اختيار الصور', 'Choose images')}
          </button>
          <button className="button button-secondary camera-action" type="button" onClick={() => camera.current?.click()}>
            <Camera size={17} aria-hidden="true" />{t('الكاميرا', 'Camera')}
          </button>
        </div>
      </div>
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      {files.length > 0 && <>
        <ImageThumbnails files={files} onRemove={onRemove} />
        <button type="button" className="button button-secondary" onClick={() => { replace.current = true; picker.current?.click(); }}>
          {t('استبدال الصور', 'Replace images')}
        </button>
      </>}
    </>}
  </ToolDialog>;
}
