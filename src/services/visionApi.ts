import type { ScanResult } from '../ocr/scheduleLayouts';
import { MAX_VISION_BODY, MAX_VISION_SCREENS, type VisionOptions } from '../ocr/visionSettings';

async function resizedImage(file: File, size: number, quality: number): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const ratio = Math.min(1, size / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const issues: Record<string, string> = {
  unreadable: 'تجاوز النموذج بعض الحقول غير المقروءة. جرّب صورة أوضح.',
  missing_catalog: 'أرفق لقطة تظهر أسماء ورموز المقررات لإكمال جدول البوابة.',
  ambiguous_join: 'تعذّر تحديد أي صور تعود إلى الجدول نفسه. اختر صور جدول واحد.',
  cropped: 'بعض الخلايا مقصوصة. أضف لقطة تغطي الأيام والأوقات الناقصة.',
};

export async function askVision(files: File[], options: VisionOptions): Promise<ScanResult> {
  if (!files.length || files.length > MAX_VISION_SCREENS) {
    throw new Error(`اختر من صورة واحدة إلى ${MAX_VISION_SCREENS} صور للمسح بالنموذج.`);
  }
  let body = '';
  for (const [size, quality] of [[2100, 0.9], [1650, 0.87], [1300, 0.81]]) {
    const images = [];
    for (const file of files) images.push(await resizedImage(file, size, quality));
    body = JSON.stringify({ mode: options.mode, images });
    if (body.length <= MAX_VISION_BODY) break;
  }
  if (body.length > MAX_VISION_BODY) throw new Error('حجم الصور كبير. اختر عدداً أقل منها.');
  const credential = options.credential.trim();
  const response = await fetch('/api/vision', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(credential ? { Authorization: `Bearer ${credential}` } : {}) },
    body,
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'تعذّر المسح بالنموذج.');
  return { sessions: result.sessions, notices: (result.issues as string[]).map((issue) => issues[issue]).filter(Boolean) };
}
