import { displayDay, displayLocation, displayType, type Locale } from '../localeText';
import { brandPaths } from '../brand';
import { courseTone } from './courseTone';
import { DAYS_ORDER, type LectureSession, type ScheduleMetadata } from '../types';

type Context = CanvasRenderingContext2D;
const WIDTH = 1080;
const INK = '#302941';
const BLUE = '#382d58';
const PALE = '#f4e8e4';
const PAPER = '#f8f3eb';
const courseColors = ['#3967db', '#1a8296', '#bc456b', '#8b58c0', '#a66a1c'];
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

export async function createTimetableImages(sessions: LectureSession[], meta: ScheduleMetadata, wallpaper: boolean, locale: Locale = 'ar'): Promise<File[]> {
  await loadFont();
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  const height = wallpaper ? 2340 : 1920;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  const rtl = locale === 'ar';
  const leading = rtl ? RIGHT : MARGIN;
  const trailing = rtl ? MARGIN : RIGHT;
  const inward = rtl ? -1 : 1;
  const direction = rtl ? 'rtl' : 'ltr';
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
    ctx.fillStyle = wallpaper ? BLUE : PAPER;
    ctx.fillRect(0, 0, WIDTH, height);
    if (!wallpaper) {
      rectangle(ctx, 0, 0, WIDTH, 232, 0, BLUE);
    }
    const titleY = wallpaper ? 438 : 119;
    const fallback = 'الجدول الدراسي الأسبوعي';
    const title = meta.title.trim();
    text(ctx, !title || title === fallback ? (rtl ? fallback : 'Weekly timetable') : title, leading, titleY, 56,
      { bold: true, color: '#FFF', max: 950, direction });
    const semester = !rtl && meta.semester === 'الفصل الأول 2026 / 2027' ? 'First term 2026 / 2027' : meta.semester;
    const subtitle = [meta.subtitle, semester].filter((part) => part.trim()).join(' · ')
      .replace(/\d{4}\s*\/\s*\d{4}/g, (year) => '\u2066' + year + '\u2069');
    if (subtitle) text(ctx, subtitle, leading, titleY + 58, 32, { color: PALE, max: 950, direction });

    let y = top;
    for (const { session, names, height, showDay } of rows) {
      if (showDay) {
        text(ctx, displayDay(session.day, locale), leading, y + 39, 36, { bold: true, color: wallpaper ? PALE : INK, direction });
        y += 65;
      }
      rectangle(ctx, MARGIN, y, WIDTH - MARGIN * 2, height - 9, 18, '#FFFFFF');
      ctx.fillStyle = courseColors[courseTone(session)];
      ctx.fillRect(rtl ? RIGHT - 19 : MARGIN + 13, y + 22, 6, height - 53);
      for (const [line, name] of names.entries()) text(ctx, name, leading + inward * 34, y + 44 + line * 37, 37, { bold: true, max: 560, direction });
      const details = [displayType(session.type, locale), displayLocation(session.room, locale), session.floor && session.floor !== '—' ? (rtl ? 'طابق ' : 'Floor ') + displayLocation(session.floor, locale) : '']
        .filter((part) => part && part !== '—').map((part) => '\u2068' + part + '\u2069').join(' · ');
      text(ctx, details, leading + inward * 34, y + height - 24, 25, { color: '#61546b', max: 560, direction });
      const time = '\u2066' + session.startTime + ' – ' + session.endTime + '\u2069';
      text(ctx, time, trailing - inward * 26, y + 54, 31, { direction: rtl ? 'ltr' : 'rtl', max: 288, bold: true });
      y += height;
    }
    const foot = wallpaper ? PALE : '#61546b';
    const footY = height - (wallpaper ? 125 : 60);
    const markX = rtl ? RIGHT - 30 : MARGIN;
    rectangle(ctx, markX, footY - 25, 30, 30, 8, '#644984');
    ctx.save();
    ctx.translate(markX, footY - 25);
    ctx.scale(30 / 48, 30 / 48);
    for (const [key, color] of [['top', '#fff'], ['middle', '#f4cba5'], ['bottom', '#fff'], ['tile', '#f38d80']] as const) {
      ctx.fillStyle = color;
      ctx.fill(new Path2D(brandPaths[key]));
    }
    ctx.restore();
    text(ctx, rtl ? 'جدولي' : 'Jadwali', leading + inward * 40, footY, 27, { color: foot, bold: true, direction });
    if (pages.length > 1) text(ctx, '\u2066' + (index + 1) + ' / ' + pages.length + '\u2069', trailing, footY, 25,
      { color: foot, direction: rtl ? 'ltr' : 'rtl' });
    const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Image export failed'));
    }, 'image/png'));
    const suffix = pages.length > 1 ? `-${index + 1}` : '';
    files.push(new File([png], `jadwali-${wallpaper ? 'wallpaper' : 'timetable'}${suffix}.png`, { type: 'image/png' }));
  }
  return files;
}
