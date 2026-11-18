import { DAYS_ORDER, type LectureSession, type ScheduleMetadata } from '../types';

type Context = CanvasRenderingContext2D;
const WIDTH = 1080;
const INK = '#173832';
const MINT = '#D5F0E8';
const PAPER = '#F5F4EF';
const FAMILIES = '"Jadwali Image", Arial, sans-serif';
const MARGIN = 64;
const RIGHT = WIDTH - MARGIN;

function text(ctx: Context, value: string, x: number, y: number, size: number, options: {
  color?: string; bold?: boolean; direction?: 'rtl' | 'ltr'; max?: number;
} = {}) {
  const { color = INK, bold = false, direction = 'rtl', max } = options;
  ctx.direction = direction;
  ctx.textAlign = direction === 'rtl' ? 'right' : 'left';
  ctx.font = `${bold ? '700' : '400'} ${size}px ${FAMILIES}`;
  ctx.fillStyle = color;
  if (max) ctx.fillText(value, x, y, max);
  else ctx.fillText(value, x, y);
}

function lines(ctx: Context, value: string, size: number, width: number) {
  ctx.font = `700 ${size}px ${FAMILIES}`;
  const result: string[] = [];
  let line = '';
  for (const word of value.trim().split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) {
      result.push(line);
      line = word;
    } else line = next;
  }
  if (line) result.push(line);
  if (result.length > 2) {
    let tail = result[1];
    while (tail && ctx.measureText(tail + '…').width > width) tail = tail.slice(0, -1);
    return [result[0], tail + '…'];
  }
  return result;
}

function rectangle(ctx: Context, x: number, y: number, width: number, height: number, radius: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

type Row = { session: LectureSession; names: string[]; height: number; showDay: boolean };

async function loadFont() {
  if (!document.fonts) return;
  await Promise.allSettled([
    document.fonts.load('700 34px "Jadwali Image"', 'جدولي حضور ABC'),
    document.fonts.load('400 28px "Jadwali Image"', 'جدولي ABC'),
  ]);
}

export async function createTimetableImages(sessions: LectureSession[], meta: ScheduleMetadata, wallpaper: boolean): Promise<File[]> {
  await loadFont();
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  const height = wallpaper ? 2340 : 1920;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  const top = wallpaper ? 558 : 278;
  const bottom = height - (wallpaper ? 185 : 115);
  const pages: Row[][] = [];
  let page: Row[] = [];
  let occupied = top;
  for (const day of DAYS_ORDER) {
    const meetings = sessions.filter((session) => session.day === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (const [index, session] of meetings.entries()) {
      const names = lines(ctx, session.courseName, 37, 560);
      const height = names.length > 1 ? 140 : 108;
      let showDay = index === 0;
      if (occupied + height + (showDay ? 65 : 0) > bottom) {
        pages.push(page);
        page = [];
        occupied = top;
        showDay = true;
      }
      page.push({ session, names, height, showDay });
      occupied += height + (showDay ? 65 : 0);
    }
  }
  if (page.length) pages.push(page);

  const files: File[] = [];
  for (const [index, rows] of pages.entries()) {
    ctx.fillStyle = wallpaper ? INK : PAPER;
    ctx.fillRect(0, 0, WIDTH, height);
    if (!wallpaper) {
      rectangle(ctx, 0, 0, WIDTH, 232, 0, INK);
    }
    const titleY = wallpaper ? 438 : 119;
    text(ctx, meta.title.trim() || 'الجدول الدراسي الأسبوعي', RIGHT, titleY, 56, { bold: true, color: '#FFFFFF', max: 950 });
    const subtitle = [meta.subtitle, meta.semester].filter((part) => part.trim()).join(' · ')
      .replace(/\d{4}\s*\/\s*\d{4}/g, (year) => '\u2066' + year + '\u2069');
    if (subtitle) text(ctx, subtitle, RIGHT, titleY + 58, 32, { color: MINT, max: 950 });

    let y = top;
    for (const { session, names, height, showDay } of rows) {
      if (showDay) {
        text(ctx, session.day, RIGHT, y + 39, 36, { bold: true, color: wallpaper ? MINT : INK });
        y += 65;
      }
      rectangle(ctx, MARGIN, y, WIDTH - MARGIN * 2, height - 9, 18, '#FFFFFF');
      ctx.fillStyle = session.type === 'عملي' ? '#B4572D' : '#508C79';
      ctx.fillRect(RIGHT - 19, y + 22, 6, height - 53);
      for (const [line, name] of names.entries()) text(ctx, name, RIGHT - 34, y + 44 + line * 37, 37, { bold: true, max: 560 });
      const details = [session.type, session.room, session.floor && session.floor !== '—' ? 'طابق ' + session.floor : '']
        .filter((part) => part && part !== '—').map((part) => '\u2068' + part + '\u2069').join(' · ');
      text(ctx, details, RIGHT - 34, y + height - 24, 25, { color: '#4C615B', max: 560 });
      text(ctx, `${session.startTime} – ${session.endTime}`, MARGIN + 26, y + 54, 31, { direction: 'ltr', max: 288, bold: true });
      y += height;
    }
    const foot = wallpaper ? MINT : '#4C615B';
    text(ctx, 'جدولي', RIGHT, height - (wallpaper ? 125 : 60), 27, { color: foot, bold: true });
    if (pages.length > 1) text(ctx, `${index + 1} / ${pages.length}`, MARGIN, height - (wallpaper ? 125 : 60), 25, { color: foot, direction: 'ltr' });
    const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Image export failed'));
    }, 'image/png'));
    const suffix = pages.length > 1 ? `-${index + 1}` : '';
    files.push(new File([png], `jadwali-${wallpaper ? 'wallpaper' : 'timetable'}${suffix}.png`, { type: 'image/png' }));
  }
  return files;
}
