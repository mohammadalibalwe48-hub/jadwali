import { brandPaths } from '../brand';
import { useLocale } from '../locale';

export function BrandMark({ size = 40 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
    <rect width="48" height="48" rx="13" fill="#795344" />
    <path d={brandPaths.top} fill="#fff" />
    <path d={brandPaths.middle} fill="#e6bd8b" />
    <path d={brandPaths.bottom} fill="#fff" />
    <path d={brandPaths.tile} fill="#e3a192" />
  </svg>;
}

export function Wordmark() {
  const { locale } = useLocale();
  return <span className="wordmark"><BrandMark /><span>{locale === 'ar' ? 'جدولي' : 'Jadwali'}</span></span>;
}
