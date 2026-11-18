import type { DayOfWeek } from '../types';
import {
  clusterWordsIntoRows, courseNameForCode, normalizeArabicDigits,
  type OcrPagePayload, type OcrWord, type ParsedRawSession,
} from './scheduleOcrParser';
import { normalizeHeader, readCode, readDay, readMeetings, readRoom, type GridText } from './scheduleGridParser';

export interface ScanResult {
  sessions: ParsedRawSession[];
  notices: string[];
}

type Words = { ar: OcrWord[]; en: OcrWord[] };
type Band = { top: number; bottom: number };
type CatalogRow = Pick<ParsedRawSession, 'courseCode' | 'courseName'>;
type PortalMeeting = Omit<ParsedRawSession, 'courseCode' | 'courseName'> & { row: number };

export interface PortalFragment {
  rowHeights: number[];
  catalog?: (CatalogRow | null)[];
  meetings: PortalMeeting[];
}

const middleX = (word: OcrWord) => word.x + word.w / 2;
const middleY = (word: OcrWord) => word.y + word.h / 2;

function gather(page: OcrPagePayload): Words {
  const unique = (words: OcrWord[]) => words.filter((word, i) => words.findIndex((other) =>
    other.text === word.text && Math.abs(other.x - word.x) < 3 && Math.abs(other.y - word.y) < 3) === i);
  return {
    ar: unique(page.arLines.flatMap((line) => line.words)),
    en: unique(page.enLines.flatMap((line) => line.words)),
  };
}

function visualText(words: OcrWord[], rtl: boolean): string {
  if (!words.length) return '';
  const heights = words.map((word) => word.h).sort((a, b) => a - b);
  return clusterWordsIntoRows(words, Math.max(3, heights[Math.floor(heights.length / 2)] * 0.55))
    .map((row) => (rtl && row.some((word) => /\p{Script=Arabic}/u.test(word.text)) ? row.reverse() : row)
      .map((word) => word.text).join(' ')).join('\n');
}

function box(words: Words, band: Band, left: number, right: number): GridText {
  const inside = (word: OcrWord) => middleX(word) >= left && middleX(word) < right &&
    middleY(word) >= band.top && middleY(word) < band.bottom;
  return { ar: visualText(words.ar.filter(inside), true), en: visualText(words.en.filter(inside), false) };
}

function possibleDays(words: Words, band: Band): Array<{ day: DayOfWeek; word: OcrWord }> {
  return Object.entries(words).flatMap(([language, list]) => list.flatMap((word: OcrWord) => {
    if (middleY(word) < band.top || middleY(word) >= band.bottom) return [];
    const day = readDay({ ar: language === 'ar' ? word.text : '', en: language === 'en' ? word.text : '' });
    return day ? [{ day, word }] : [];
  }));
}

function cleanedTitle(text: string): string {
  return normalizeArabicDigits(text).replace(/\p{Cf}/gu, '').replace(/\s+/g, ' ').trim()
    .replace(/^مها\s*ر[از]\s*ت\s*الحا\s*سوب$/, 'مهارات الحاسوب');
}

const practical = /(?:^|\s)(?:عملي|عملى|مخبر|practical|lab|tutorial)(?=\s|$)/i;
const theoretical = /(?:^|\s)(?:نظري|نظرى|lecture|theory)(?=\s|$)/i;
const badgeWords = /(?:^|\s)(?:(?:عملي|عملى|نظري|نظرى|practical|theory|lecture|tutorial))(?=\s|$)/gi;

/** Day labels in exported weekly tables can span several meeting rows. */
export async function readGroupedWeek(
  page: OcrPagePayload,
  daySeparators: (x: number) => number[],
  readDayCell: (band: Band, left: number, right: number) => Promise<DayOfWeek | undefined>,
): Promise<ScanResult | null> {
  const words = gather(page);
  const headers = [
    /^(?:اليوم|day|weekday)$/,
    /^(?:الماده|المقرر|المساق|course|subject)$/,
    /^(?:الوقت|التوقيت|الساعه|time|hours?)$/,
    /^(?:القاعه|المكان|room|location|venue)$/,
  ];
  const all = [...words.ar, ...words.en];
  let columns: OcrWord[] | undefined;
  for (const day of all.filter((word) => headers[0].test(normalizeHeader(word.text)))) {
    const nearby = all.filter((word) => Math.abs(middleY(word) - middleY(day)) < page.width * 0.04);
    const matches = headers.map((pattern) => nearby.find((word) => pattern.test(normalizeHeader(word.text))));
    if (!matches.every((word): word is OcrWord => Boolean(word))) continue;
    const centers = matches.map(middleX);
    if (centers.every((x, i) => i === 0 || x < centers[i - 1]) ||
      centers.every((x, i) => i === 0 || x > centers[i - 1])) {
      columns = matches;
      break;
    }
  }
  if (!columns) return null;
  const [dayHeader, titleHeader, timeHeader, roomHeader] = columns;
  const rtl = middleX(dayHeader) > middleX(roomHeader);
  const from = Math.max(...columns.map((word) => word.y + word.h));
  const titleDayEdge = (middleX(titleHeader) + middleX(dayHeader)) / 2;
  const timeRoomEdge = (middleX(timeHeader) + middleX(roomHeader)) / 2;
  const initialTimeTitleEdge = (middleX(titleHeader) + middleX(timeHeader)) / 2;
  const timeLeft = Math.min(timeRoomEdge, initialTimeTitleEdge);
  const timeRight = Math.max(timeRoomEdge, initialTimeTitleEdge);
  const footer = page.arLines.find((line) => line.y > from &&
    /بلا\s*محاضرات|بدون\s*محاضرات|أيام\s*العطلة/.test(line.text));
  const end = footer?.y ?? page.height;

  const anchors = [words.en, words.ar].flatMap((list) => {
    const timeWords = list.filter((word) => middleY(word) > from && middleY(word) < end &&
      middleX(word) >= timeLeft && middleX(word) < timeRight);
    return clusterWordsIntoRows(timeWords, Math.max(timeHeader.h * 0.55, 5)).flatMap((row) => {
      const parts = row.filter((word) => /^(?:[\d٠-٩۰-۹Oo:：.\-–—−~/]+|am|pm|م|ص|to|إلى|حتى)$/i.test(word.text.trim()));
      const text = parts.map((word) => word.text).join(' ');
      const meeting = readMeetings({ en: text, ar: '' })[0];
      if (!meeting) return [];
      return [{
        meeting, y: parts.reduce((total, word) => total + middleY(word), 0) / parts.length,
        titleEdge: rtl ? Math.max(...parts.map((word) => word.x + word.w)) : Math.min(...parts.map((word) => word.x)),
      }];
    });
  });
  const times = anchors.filter((anchor, i) => anchors.findIndex((other) => Math.abs(other.y - anchor.y) < timeHeader.h) === i)
    .sort((a, b) => a.y - b.y);
  if (!times.length) return { sessions: [], notices: [] };

  const gaps = times.slice(1).map((row, i) => row.y - times[i].y).sort((a, b) => a - b);
  const gap = gaps[Math.floor(gaps.length / 2)] ?? timeHeader.h * 4;
  const bands = times.map(({ y }, i) => ({
    top: Math.max(from, y - gap * 0.55, i > 0 ? (times[i - 1].y + y) / 2 : 0),
    bottom: Math.min(end, y + gap * 0.65, i + 1 < times.length ? (times[i + 1].y + y) / 2 : end),
  }));
  const dayColumn = (word: OcrWord) => rtl ? middleX(word) >= titleDayEdge : middleX(word) < titleDayEdge;
  const rules = daySeparators(middleX(dayHeader));
  const dayByRow = new Map<number, DayOfWeek>();
  for (const { day, word } of possibleDays(words, { top: from, bottom: end })) {
    if (!dayColumn(word)) continue;
    const center = middleY(word);
    const topRule = [...rules].reverse().find((y) => y < word.y && y >= from - gap * 0.12);
    const ruleRow = topRule === undefined ? -1 : times.findIndex(({ y }) => y > topRule);
    const closeRow = bands.findIndex((band) => center >= band.top && center < band.bottom);
    const row = ruleRow >= 0 && center >= times[ruleRow].y - gap * 0.48 &&
      center - times[ruleRow].y < gap * 2.9 && Math.abs(times[ruleRow].y - topRule!) < gap * 0.72
      ? ruleRow : closeRow;
    if (row >= 0 && !dayByRow.has(row)) dayByRow.set(row, day);
  }

  const groups = rules.filter((y) => y >= from - gap * 0.12 && y < times.at(-1)!.y).flatMap((top) => {
    const start = times.findIndex(({ y }) => y > top);
    return start >= 0 && times[start].y - top < gap * 0.72 ? [{ top, start }] : [];
  }).filter(({ start }, i, list) => list.findIndex((other) => other.start === start) === i);
  for (const [i, group] of groups.entries()) {
    if (dayByRow.has(group.start)) continue;
    const bottom = groups[i + 1]?.top ?? Math.min(end, times.at(-1)!.y + gap * 0.6);
    const left = rtl ? titleDayEdge - page.width * 0.026 : Math.max(0, middleX(dayHeader) - page.width * 0.13);
    const right = rtl ? Math.min(page.width, middleX(dayHeader) + page.width * 0.1) : titleDayEdge + page.width * 0.026;
    const day = await readDayCell({ top: group.top + 4, bottom: bottom - 4 }, left, right);
    if (day) dayByRow.set(group.start, day);
  }

  let day: DayOfWeek | undefined;
  let skippedRows = 0;
  const sessions = times.flatMap(({ meeting, titleEdge }, i) => {
    day = dayByRow.get(i) ?? (groups.some(({ start }) => start === i) ? undefined : day);
    const band = bands[i];
    const innerEdge = titleEdge + (rtl ? 1 : -1) * page.width * 0.009;
    const title = box(words, band, Math.min(titleDayEdge, innerEdge), Math.max(titleDayEdge, innerEdge));
    const location = box(words, band, rtl ? 0 : timeRoomEdge, rtl ? timeRoomEdge : page.width);
    const ar = title.ar.replace(badgeWords, ' ');
    const en = title.en.replace(badgeWords, ' ');
    const courseCode = en.split('\n').map(readCode).find(Boolean);
    const courseName = /\p{Script=Arabic}{2}/u.test(titleHeader.text)
      ? cleanedTitle(ar.replace(/[^\p{Script=Arabic}\d\s()&-]/gu, ''))
      : cleanedTitle(en.split('\n').filter((line) => !readCode(line)).join(' '));
    if (!day || (!courseName && !courseCode)) {
      skippedRows++;
      return [];
    }
    const arabicRoom = readRoom(location.ar).room;
    const room = arabicRoom === 'المدرّج' ? arabicRoom : readRoom(location.en).room;
    const explicitType = theoretical.test(title.ar) || theoretical.test(title.en) ? 'نظري' :
      practical.test(title.ar) || practical.test(title.en) ? 'عملي' : undefined;
    const badgeBand = (y: number) => y >= times[i].y + timeHeader.h * 0.45 && y < band.bottom;
    const warm = (page.warmRows ?? []).filter(badgeBand).length;
    const cool = (page.coolRows ?? []).filter(badgeBand).length;
    return [{
      ...meeting, day, courseCode,
      courseName: courseName || courseNameForCode(courseCode) || courseCode!,
      room: room !== '—' ? room : arabicRoom,
      type: explicitType || (warm > cool ? 'عملي' : 'نظري'),
    } satisfies ParsedRawSession];
  });
  return { sessions, notices: skippedRows ? ['تعذّرت قراءة اليوم أو اسم المادة في بعض الصفوف. أضف لقطة أوضح لاستكمالها.'] : [] };
}

/** The portal preserves row order and alternating row heights while scrolling sideways. */
export function readPortalFragment(page: OcrPagePayload, header: Band, bands: Band[]): PortalFragment | null {
  const words = gather(page);
  const headings = box(words, header, 0, page.width);
  const label = normalizeHeader(headings.ar);
  const hasCatalog = /رمز\s*(?:المقرر|الماده|المساق)/.test(label) &&
    /اسم\s*(?:المقرر|الماده|المساق)/.test(label);
  const possible = possibleDays(words, header);
  const days = possible.filter(({ day }, i) => possible.findIndex((other) => other.day === day) === i)
    .sort((a, b) => a.word.x - b.word.x);
  if (!hasCatalog && days.length < 2) return null;
  const rowHeights = bands.map(({ top, bottom }) => (bottom - top) / page.width);
  const titleHeader = words.ar.find((word) => middleY(word) >= header.top && middleY(word) < header.bottom &&
    normalizeHeader(word.text) === 'اسم');
  const codeHeader = words.ar.find((word) => middleY(word) >= header.top && middleY(word) < header.bottom &&
    normalizeHeader(word.text) === 'رمز');
  const titleOnRight = !titleHeader || !codeHeader || middleX(titleHeader) > middleX(codeHeader);
  const catalog = hasCatalog ? bands.map((band) => {
    const word = words.en.find((item) => middleY(item) >= band.top && middleY(item) < band.bottom && readCode(item.text));
    if (!word) return null;
    const edge = titleOnRight ? word.x + word.w + page.width * 0.01 : word.x - page.width * 0.01;
    const text = box(words, band, titleOnRight ? edge : 0, titleOnRight ? page.width : edge);
    const courseCode = readCode(word.text);
    const name = text.ar.replace(/[^\p{Script=Arabic}\d\s()&-]/gu, '').replace(/\p{Cf}/gu, '');
    const courseName = /\p{Script=Arabic}{2}/u.test(name) ? cleanedTitle(name) : courseNameForCode(courseCode);
    return courseCode && courseName ? { courseCode, courseName } : null;
  }) : undefined;

  const meetings: PortalMeeting[] = [];
  if (days.length >= 2) {
    const gaps = days.slice(1).map(({ word }, i) => middleX(word) - middleX(days[i].word)).sort((a, b) => a - b);
    const columnWidth = gaps[Math.floor(gaps.length / 2)];
    const rightEdge = (word: OcrWord) => word.x + word.w + columnWidth * 0.28;
    for (const [row, band] of bands.entries()) {
      for (const { day, word } of days) {
        const right = rightEdge(word);
        const cell = box(words, band, right - columnWidth * 1.02, right + columnWidth * 0.08);
        const rowMeetings = readMeetings(cell);
        const arabicRoom = rowMeetings.length === 1 && /مد[ربز][جحخ]/.test(normalizeHeader(cell.ar).replace(/\s/g, ''))
          ? 'المدرّج' : undefined;
        for (const meeting of rowMeetings) {
          // This portal uses 12-hour afternoon values without a period marker.
          const afternoon = Number(meeting.startTime.slice(0, 2)) >= 1 &&
            Number(meeting.endTime.slice(0, 2)) <= 7 && !/\b(?:am|pm)\b|صباحًا|مساءً/i.test(cell.en + cell.ar);
          const afterNoon = (time: string) => String(Number(time.slice(0, 2)) + 12) + time.slice(2);
          meetings.push({
            ...meeting, day, row, room: arabicRoom ?? meeting.room, type: meeting.type ?? 'نظري',
            startTime: afternoon ? afterNoon(meeting.startTime) : meeting.startTime,
            endTime: afternoon ? afterNoon(meeting.endTime) : meeting.endTime,
          });
        }
      }
    }
  }
  return { rowHeights, catalog, meetings };
}

export function combinePortalFragments(fragments: PortalFragment[]): ScanResult {
  const catalogues = fragments.filter((item) => item.catalog?.some(Boolean));
  const sessions: ParsedRawSession[] = [];
  let unresolved = false;
  for (const fragment of fragments.filter((item) => item.meetings.length)) {
    const compatible = catalogues.filter((item) =>
      item.rowHeights.length === fragment.rowHeights.length &&
      item.rowHeights.every((h, i) => Math.abs(h - fragment.rowHeights[i]) <= Math.max(0.023, h * 0.16)));
    for (const { row, ...meeting } of fragment.meetings) {
      const choices = compatible.map((item) => item.catalog?.[row]).filter((item): item is CatalogRow => Boolean(item));
      if (!choices.length || !choices.every((item) => item.courseCode === choices[0].courseCode)) {
        unresolved = true;
        continue;
      }
      sessions.push({ ...meeting, ...choices[0] });
    }
  }
  const onlyCatalog = !sessions.length && catalogues.length > 0 && !unresolved;
  const notices = unresolved
    ? ['أرفق لقطة عمود أسماء ورموز المواد من نفس جدول البوابة، مع إبقاء ترتيب الصفوف كما هو.']
    : onlyCatalog ? ['تمت قراءة أسماء المواد. أرفق لقطات الأعمدة التي تظهر الأيام والأوقات لإكمال الاستيراد.'] : [];
  return { sessions, notices };
}
