import { isSameMeeting } from '../types';

export interface OcrWord {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface OcrLine {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  words: OcrWord[];
}

export interface OcrPagePayload {
  width: number;
  height: number;
  warmRows?: number[];
  coolRows?: number[];
  arLines: OcrLine[];
  enLines: OcrLine[];
}

export interface ParsedRawSession {
  day: string;
  startTime: string;
  endTime: string;
  courseName: string;
  courseCode?: string;
  type: 'نظري' | 'عملي';
  room: string;
}

const DAY_PATTERNS: Array<{ day: string; regex: RegExp }> = [
  { day: 'السبت', regex: /(?:السبت|سبت|\bsat(?:urday)?\b)/i },
  { day: 'الأحد', regex: /(?:الأحد|الاحد|أحد|احد|\bsun(?:day)?\b)/i },
  { day: 'الإثنين', regex: /(?:الإثنين|الاثنين|إثنين|اثنين|\bmon(?:day)?\b)/i },
  { day: 'الثلاثاء', regex: /(?:الثلاثاء|ثلاثاء|\btue(?:sday)?\b)/i },
  { day: 'الأربعاء', regex: /(?:الأربعاء|الاربعاء|أربعاء|اربعاء|\bwed(?:nesday)?\b)/i },
  { day: 'الخميس', regex: /(?:الخميس|خميس|\bthu(?:rsday)?\b)/i },
  { day: 'الجمعة', regex: /(?:الجمعة|الجمعه|جمعة|جمعه|\bfri(?:day)?\b)/i },
];

const KNOWN_COURSE_MAP: Array<{
  code?: string;
  test: (s: string) => boolean;
  canonical: (numSuffix: string) => string;
}> = [
  {
    code: 'CEDC101',
    test: (s) =>
      /CEDC\s*101/i.test(s) ||
      (/تحليل|يل/.test(s) && /ريا/.test(s)) ||
      /math.*analysis|calculus/i.test(s),
    canonical: (n) => `تحليل رياضي ${n || '1'}`.trim(),
  },
  {
    code: 'CECC122',
    test: (s) => /CECC\s*122/i.test(s) || /مصفوفات|matrix/i.test(s),
    canonical: () => 'الجبر الخطي ونظرية المصفوفات',
  },
  {
    code: 'CEDC102',
    test: (s) =>
      /CEDC\s*102/i.test(s) ||
      (/جبر|جبز|جر/.test(s) && /خط/.test(s)) ||
      /linear\s*algebra/i.test(s),
    canonical: () => 'الجبر الخطي',
  },
  {
    code: 'CEFC101',
    test: (s) => /CEFC\s*101/i.test(s) || /فيزياء|physics/i.test(s),
    canonical: (n) => `الفيزياء ${n || '1'}`.trim(),
  },
  {
    code: 'UNRC101',
    test: (s) =>
      /UNRC\s*101/i.test(s) ||
      (/مهارات/.test(s) && /حاسوب/.test(s)) ||
      /computer\s*skills|\bicdl\b/i.test(s),
    canonical: () => 'مهارات الحاسوب',
  },
  {
    code: 'UNRC103',
    test: (s) =>
      /UNRC\s*103/i.test(s) ||
      /إنكليزي|انكليزي|إنجليزي|انجليزي|\benglish\b/i.test(s),
    canonical: (n) => `اللغة الإنكليزية ${n || '1'}`.trim(),
  },
  {
    code: 'UNRC102',
    test: (s) =>
      /UNRC\s*102/i.test(s) || (/عربي/.test(s) && /لغ|لف/.test(s)) || /\barabic\b/i.test(s),
    canonical: () => 'اللغة العربية',
  },
  {
    test: (s) => /غرضية|كائنية|\boop\b|object[\s-]*oriented/i.test(s),
    canonical: () => 'البرمجة غرضية التوجه',
  },
  {
    test: (s) => /برمجة|\bprogramming\b/i.test(s),
    canonical: (n) => `البرمجة ${n || '1'}`.trim(),
  },
  {
    test: (s) => /بنى\s*المعطيات|هياكل\s*البيانات|data\s*structures/i.test(s),
    canonical: () => 'بنى المعطيات',
  },
  {
    test: (s) => /خوارزميات|algorithms/i.test(s),
    canonical: () => 'الخوارزميات',
  },
  {
    test: (s) => /متقطعة|discrete\s*math/i.test(s),
    canonical: () => 'الرياضيات المتقطعة',
  },
  {
    test: (s) => /منطقية|digital\s*logic|logic\s*design|logic\s*circuits/i.test(s),
    canonical: () => 'الدارات المنطقية',
  },
  {
    test: (s) => /دارات\s*كهربائية|electric.*circuits|circuits\s*[12I]/i.test(s),
    canonical: (n) => `الدارات الكهربائية ${n}`.trim(),
  },
  {
    test: (s) => /إلكترونيات|الكترونيات|electronics/i.test(s),
    canonical: (n) => `الإلكترونيات ${n}`.trim(),
  },
  {
    test: (s) => /احتمالات|إحصاء|احصاء|probability|statistics/i.test(s),
    canonical: () => 'الاحتمالات والإحصاء',
  },
  {
    test: (s) => /تفاضلية|differential\s*equations/i.test(s),
    canonical: () => 'المعادلات التفاضلية',
  },
  {
    test: (s) => /تحليل\s*عددي|numerical/i.test(s),
    canonical: () => 'التحليل العددي',
  },
  {
    test: (s) => /روبوت|robotics/i.test(s),
    canonical: () => 'مبادئ الروبوتية',
  },
  {
    test: (s) => /ذكاء\s*صنعي|ذكاء\s*اصطناعي|artificial\s*intelligence|\bai\b/i.test(s),
    canonical: () => 'الذكاء الصنعي',
  },
  {
    test: (s) => /قواعد\s*معطيات|قواعد\s*بيانات|database/i.test(s),
    canonical: (n) => `قواعد المعطيات ${n}`.trim(),
  },
  {
    test: (s) => /نظم\s*تشغيل|operating\s*systems/i.test(s),
    canonical: () => 'نظم التشغيل',
  },
  {
    test: (s) => /شبكات|networks/i.test(s),
    canonical: (n) => `الشبكات الحاسوبية ${n}`.trim(),
  },
  {
    test: (s) => /كيمياء|chemistry/i.test(s),
    canonical: () => 'الكيمياء العامة',
  },
  {
    test: (s) => (/رسم/.test(s) && /هندس/.test(s)) || /engineering\s*drawing/i.test(s),
    canonical: () => 'الرسم الهندسي',
  },
  {
    test: (s) => /ميكانيك|mechanics|statics|dynamics/i.test(s),
    canonical: () => 'الميكانيك الهندسي',
  },
];

export function courseNameForCode(code: string | undefined): string | undefined {
  return KNOWN_COURSE_MAP.find((entry) => entry.code && entry.code === code)?.canonical('');
}

function to24h(hStr: string, mStr: string, rawContext = ''): string {
  let h = parseInt(hStr, 10);
  const m = mStr.padStart(2, '0');
  if (/pm|م/i.test(rawContext) && h < 12) h += 12;
  else if (!/am|ص/i.test(rawContext) && h >= 1 && h <= 7) h += 12;
  return `${String(h).padStart(2, '0')}:${m}`;
}

function add90Min(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const total = h * 60 + m + 90;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function normalizeArabicDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹]/g, (digit) => String(digit.charCodeAt(0) & 15));
}

export function normalizeAsciiDigits(str: string): string {
  return normalizeArabicDigits(str)
    .replace(/(\d)\s*[Oo]/g, '$10')
    .replace(/[Oo]\s*(\d)/g, '0$1')
    .replace(/:\s*[Oo]{2}\b/g, ':00');
}

function isOffDayFooterLine(text: string): boolean {
  return /بلا\s*محاضرات|محاضرات\s*بلا|بدون\s*محاضرات|أيام\s*العطلة/.test(text);
}

function deduplicateWords(words: OcrWord[], tol = 14): OcrWord[] {
  const out: OcrWord[] = [];
  for (const w of words) {
    const t = w.text.trim();
    if (!t) continue;
    const cx = w.x + w.w / 2;
    const cy = w.y + w.h / 2;
    const dup = out.some(
      (o) =>
        o.text.toLowerCase() === t.toLowerCase() &&
        Math.abs(o.x + o.w / 2 - cx) < tol &&
        Math.abs(o.y + o.h / 2 - cy) < tol
    );
    if (!dup) out.push(w);
  }
  return out;
}

function extractCourseFromCell(
  arWordsRtl: OcrWord[],
  enWordsLtr: OcrWord[]
): {
  courseName: string;
  courseCode?: string;
  typeHint?: 'نظري' | 'عملي';
} {
  const rtlArabic = arWordsRtl.map((w) => w.text).join(' ').replace(/\u0640/g, '');
  const ltrEnglish = enWordsLtr.map((w) => w.text).join(' ');
  const combined = `${rtlArabic} ${ltrEnglish}`.replace(/\u0640/g, '');

  let typeHint: 'نظري' | 'عملي' | undefined;
  if (/عملي|عملى|مخبر/.test(rtlArabic) || /\b(?:practical|lab)\b/i.test(ltrEnglish)) {
    typeHint = 'عملي';
  } else if (/نظري|نظرى|نظر|محاضرة/.test(rtlArabic) || /\b(?:theory|lecture)\b/i.test(ltrEnglish)) {
    typeHint = 'نظري';
  } else if (/\(\s*P\s*\)|\[P\]/.test(ltrEnglish) || (!rtlArabic && /\bP\b/.test(ltrEnglish))) {
    typeHint = 'عملي';
  } else if (/\(\s*T\s*\)|\[T\]/.test(ltrEnglish) || (!rtlArabic && /\bT\b/.test(ltrEnglish))) {
    typeHint = 'نظري';
  }

  const codeMatch = ltrEnglish.match(/\b([A-Z]{3,4})\s*[-_]?\s*(\d{3})\b/i);
  const detectedCode = codeMatch
    ? `${codeMatch[1].toUpperCase()}${codeMatch[2]}`
    : undefined;

  let levelNum = '';
  const numMatch =
    combined.match(
      /(?:رياضي|الفيزياء|فيزياء|الإنكليزية|الانكليزية|إنكليزي|انكليزي|البرمجة|برمجة|الكهربائية|الإلكترونيات|المعطيات|الشبكات|analysis|calculus|physics|english|programming|circuits|electronics|database|networks)\s*([123])/i
    ) || ltrEnglish.match(/\b(III|II|I)\b/);
  if (numMatch) {
    const raw = numMatch[1];
    levelNum = raw === 'III' ? '3' : raw === 'II' ? '2' : raw === 'I' ? '1' : raw;
  } else if (detectedCode) {
    if (detectedCode.endsWith('101') || detectedCode.endsWith('103')) levelNum = '1';
  }

  for (const entry of KNOWN_COURSE_MAP) {
    if (entry.test(combined)) {
      return {
        courseName: entry.canonical(levelNum),
        courseCode: detectedCode || entry.code,
        typeHint,
      };
    }
  }

  const cleanedArabic = rtlArabic
    .replace(
      /(?:السبت|الأحد|الاحد|الإثنين|الاثنين|الثلاثاء|الأربعاء|الاربعاء|الخميس|الجمعة|نظري|نظرى|نظر|عملي|عملى|المدرّج|المدرج|المددج|المدزج|المدتج|مدرج|القاعة|قاعة|الطابق|اليوم|الوقت|المادة|النوع|شعبة|فئة)/g,
      ' '
    )
    .replace(/\b\d{2,}\b/g, ' ')
    .replace(/[^\u0600-\u06FF1-4\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleanedArabic.length >= 4) {
    return {
      courseName: cleanedArabic,
      courseCode: detectedCode,
      typeHint,
    };
  }

  const cleanedEnglish = ltrEnglish
    .replace(/\b[A-Z]{3,4}\s*[-_]?\s*\d{3}\b/gi, ' ')
    .replace(/\b[BFSLG85$A-Z]\s*[-–]?\s*[0OILl\d]{1,3}[AB8TP]?\b/gi, ' ')
    .replace(
      /\b(?:sat(?:urday)?|sun(?:day)?|mon(?:day)?|tue(?:sday)?|wed(?:nesday)?|thu(?:rsday)?|fri(?:day)?)\b/gi,
      ' '
    )
    .replace(/\b(?:theory|practical|lab|lecture|lec|room|sec(?:tion)?|group|dr|eng)\b/gi, ' ')
    .replace(/\d{1,2}\s*[:.]\s*\d{2}/g, ' ')
    .replace(/\b[TP]\b/g, ' ')
    .replace(/[^A-Za-z1-4\s&]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleanedEnglish.length >= 4) {
    return {
      courseName: cleanedEnglish,
      courseCode: detectedCode,
      typeHint,
    };
  }

  return {
    courseName: detectedCode ? `مادة ${detectedCode}` : 'محاضرة جامعية',
    courseCode: detectedCode,
    typeHint,
  };
}

interface TimeAnchor {
  start: string;
  end: string;
  cx: number;
  cy: number;
  h: number;
}

interface DayAnchor {
  day: string;
  cx: number;
  cy: number;
}

interface RoomAnchor {
  room: string;
  hintedType?: 'نظري' | 'عملي';
  cx: number;
  cy: number;
  h: number;
}

function normalizeRoomToken(
  prefixRaw: string,
  numRaw: string,
  tailType?: string
): {
  room: string;
  hintedType?: 'نظري' | 'عملي';
} {
  let prefix = prefixRaw.toUpperCase();
  if (prefix === '8') prefix = 'B';
  if (prefix === '5' || prefix === '$') prefix = 'S';

  const cleanedNum = numRaw
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/[IL|]/g, '1')
    .replace(/\s+/g, '');

  let digitsOnly = cleanedNum.replace(/[AB]/g, '');
  let suffix = cleanedNum.match(/[AB]/)?.[0] || '';
  if (!suffix && digitsOnly.length === 3 && digitsOnly.endsWith('8')) {
    digitsOnly = digitsOnly.slice(0, 2);
    suffix = 'B';
  }
  const padded = digitsOnly.padStart(2, '0');
  return {
    room: `${prefix}-${padded}${suffix}`,
    hintedType: tailType ? (tailType.toUpperCase() === 'T' ? 'نظري' : 'عملي') : undefined,
  };
}

function clusterWordsIntoRows(words: OcrWord[], rowTol: number): OcrWord[][] {
  const sorted = [...words].sort((a, b) => a.y + a.h / 2 - (b.y + b.h / 2));
  const rows: Array<{ cy: number; items: OcrWord[] }> = [];

  for (const w of sorted) {
    const wcy = w.y + w.h / 2;
    const match = rows.find((r) => Math.abs(r.cy - wcy) <= rowTol);
    if (match) {
      match.items.push(w);
      match.cy = match.items.reduce((s, x) => s + x.y + x.h / 2, 0) / match.items.length;
    } else {
      rows.push({ cy: wcy, items: [w] });
    }
  }

  return rows.map((r) => r.items.sort((a, b) => a.x - b.x));
}

export function parseScheduleFromOcr(payloads: OcrPagePayload[]): ParsedRawSession[] {
  const allResults: Array<ParsedRawSession & { _explicit?: boolean }> = [];

  for (const payload of payloads) {
    const {
      arLines = [],
      enLines = [],
      warmRows = [],
      coolRows = [],
      width = 1000,
      height = 1000,
    } = payload;

    // Exclude off-day summary footers (including split words on the same footer y-band!)
    const footerYs = arLines.filter((l) => isOffDayFooterLine(l.text)).map((l) => l.y);
    const validArLines = arLines.filter(
      (l) => !isOffDayFooterLine(l.text) && !footerYs.some((fy) => Math.abs(l.y - fy) < 28)
    );
    const validEnLines = enLines.filter(
      (l) => !footerYs.some((fy) => Math.abs(l.y - fy) < 28)
    );

    const arWords = deduplicateWords(validArLines.flatMap((l) => l.words || []));
    const enWords = deduplicateWords(validEnLines.flatMap((l) => l.words || []));

    const medianWordH =
      enWords.length > 0
        ? [...enWords].map((w) => w.h).sort((a, b) => a - b)[Math.floor(enWords.length / 2)]
        : Math.max(height * 0.02, 18);
    const rowTol = Math.max(medianWordH * 0.85, height * 0.015, 15);

    // 1. Day Anchors
    const dayAnchors: DayAnchor[] = [];
    for (const w of [...arWords, ...enWords]) {
      for (const dp of DAY_PATTERNS) {
        if (dp.regex.test(w.text)) {
          const cx = w.x + w.w / 2;
          const cy = w.y + w.h / 2;
          if (
            !dayAnchors.some(
              (d) => d.day === dp.day && Math.hypot(d.cx - cx, d.cy - cy) < rowTol * 1.8
            )
          ) {
            dayAnchors.push({ day: dp.day, cx, cy });
          }
        }
      }
    }

    // 2. Time Anchors
    const timeAnchors: TimeAnchor[] = [];
    const enVisualRows = clusterWordsIntoRows(enWords, rowTol);
    const arVisualRows = clusterWordsIntoRows(arWords, rowTol);

    for (const rowWords of [...enVisualRows, ...arVisualRows]) {
      let joined = '';
      const charWordMap: OcrWord[] = [];
      for (const w of rowWords) {
        const normText = normalizeAsciiDigits(w.text);
        if (joined.length > 0) {
          joined += ' ';
          charWordMap.push(w);
        }
        for (let c = 0; c < normText.length; c++) {
          joined += normText[c];
          charWordMap.push(w);
        }
      }

      const rangeRegex =
        /(\d{1,2})\s*[:.]\s*(\d{2})[^0-9\n]{1,6}(\d{1,2})\s*[:.]\s*(\d{2})/gi;
      let m: RegExpExecArray | null;
      let matchedRangesInRow = 0;

      while ((m = rangeRegex.exec(joined)) !== null) {
        const h1 = parseInt(m[1], 10);
        const h2 = parseInt(m[3], 10);
        if (h1 > 23 || h2 > 23 || Number(m[2]) > 59 || Number(m[4]) > 59) continue;

        const wStart = charWordMap[m.index] || rowWords[0];
        const wEnd =
          charWordMap[Math.min(m.index + m[0].length - 1, charWordMap.length - 1)] || wStart;

        if (Math.abs(wEnd.x + wEnd.w - wStart.x) > width * 0.3) {
          continue;
        }

        const t1 = to24h(m[1], m[2], m[0]);
        const t2 = to24h(m[3], m[4], m[0]);
        const [start, end] = t1 <= t2 ? [t1, t2] : [t2, t1];
        const cx = (wStart.x + wEnd.x + wEnd.w) / 2;
        const cy = (wStart.y + wStart.h / 2 + wEnd.y + wEnd.h / 2) / 2;
        const h = Math.max(wStart.h, wEnd.h);

        matchedRangesInRow++;
        if (
          !timeAnchors.some(
            (t) => Math.abs(t.cy - cy) <= rowTol * 1.25 && Math.abs(t.cx - cx) < width * 0.08
          )
        ) {
          timeAnchors.push({ start, end, cx, cy, h });
        }
      }

      if (matchedRangesInRow === 0) {
        const singleRegex = /\b(\d{1,2})\s*[:.]\s*(\d{2})\b/g;
        let sm: RegExpExecArray | null;
        while ((sm = singleRegex.exec(joined)) !== null) {
          const hh = parseInt(sm[1], 10);
          if (hh < 1 || hh > 21 || Number(sm[2]) > 59) continue;
          const w = charWordMap[sm.index] || rowWords[0];
          const start = to24h(sm[1], sm[2], joined);
          const end = add90Min(start);
          const cx = w.x + w.w / 2;
          const cy = w.y + w.h / 2;
          if (
            !timeAnchors.some(
              (t) => Math.abs(t.cy - cy) <= rowTol * 1.25 && Math.abs(t.cx - cx) < width * 0.08
            )
          ) {
            timeAnchors.push({ start, end, cx, cy, h: w.h });
          }
        }
      }
    }

    if (!dayAnchors.length || !timeAnchors.length) continue;

    // 3. Room Anchors (handles S-OIB, $-01B, S018, 5-07, 8-06, المدرّج, المددج, المدتج!)
    const roomAnchors: RoomAnchor[] = [];
    for (const words of [...enVisualRows, ...arVisualRows]) {
      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        const nextW = words[i + 1];
        const clean = w.text.replace(/[()[\],.]/g, '').trim();

        if (/مدرج|مدرّج|مددج|مدزج|مدتج|المددج|المدزج|المدتج/.test(clean)) {
          const cx = w.x + w.w / 2;
          const cy = w.y + w.h / 2;
          if (
            !roomAnchors.some(
              (r) => Math.abs(r.cy - cy) <= rowTol * 1.3 && Math.abs(r.cx - cx) < width * 0.1
            )
          ) {
            roomAnchors.push({ room: 'المدرّج', cx, cy, h: w.h });
          }
          continue;
        }

        const m1 =
          clean.match(/^([BFSLG85$])\s*[-–]\s*([0OILl\d]{1,2}[AB8]?)([TP])?$/i) ||
          clean.match(/^([BFSL$])\s*([0OILl\d]{2,3}[AB8]?)([TP])?$/i) ||
          clean.match(/^([A-Z])\s*[-–]\s*([0OILl\d]{1,3}[AB]?)([TP])?$/i);

        if (m1) {
          let tailSuffix = '';
          if (
            nextW &&
            /^[ABab]$/.test(nextW.text.trim()) &&
            nextW.x - (w.x + w.w) < medianWordH * 1.6
          ) {
            tailSuffix = nextW.text.trim().toUpperCase();
          }
          const { room, hintedType } = normalizeRoomToken(m1[1], m1[2] + tailSuffix, m1[3]);
          const cx = w.x + w.w / 2;
          const cy = w.y + w.h / 2;
          if (
            !roomAnchors.some(
              (r) => Math.abs(r.cy - cy) <= rowTol * 1.25 && Math.abs(r.cx - cx) < width * 0.08
            )
          ) {
            roomAnchors.push({ room, hintedType, cx, cy, h: w.h });
          }
          continue;
        }

        if (nextW && nextW.x - (w.x + w.w) < medianWordH * 1.6) {
          const twoTok = `${clean}${nextW.text.replace(/[()[\],.]/g, '').trim()}`;
          const m2 = twoTok.match(/^([BFSLG85$])[-–]?([0OILl\d]{2,3}[AB8]?)([TP])?$/i);
          if (m2) {
            const { room, hintedType } = normalizeRoomToken(m2[1], m2[2], m2[3]);
            const cx = (w.x + nextW.x + nextW.w) / 2;
            const cy = w.y + w.h / 2;
            if (
              !roomAnchors.some(
                (r) => Math.abs(r.cy - cy) <= rowTol * 1.25 && Math.abs(r.cx - cx) < width * 0.08
              )
            ) {
              roomAnchors.push({ room, hintedType, cx, cy, h: w.h });
            }
          }
        }
      }
    }

    // 4. Layout Mode Detection
    const uniqueDays = new Set(dayAnchors.map((d) => d.day)).size;
    const dayXSpread =
      dayAnchors.length >= 2
        ? Math.max(...dayAnchors.map((d) => d.cx)) - Math.min(...dayAnchors.map((d) => d.cx))
        : 0;
    const dayYSpread =
      dayAnchors.length >= 2
        ? Math.max(...dayAnchors.map((d) => d.cy)) - Math.min(...dayAnchors.map((d) => d.cy))
        : 0;
    const timeXSpread =
      timeAnchors.length >= 2
        ? Math.max(...timeAnchors.map((t) => t.cx)) - Math.min(...timeAnchors.map((t) => t.cx))
        : 0;
    const timeYSpread =
      timeAnchors.length >= 2
        ? Math.max(...timeAnchors.map((t) => t.cy)) - Math.min(...timeAnchors.map((t) => t.cy))
        : 9999;

    const isDayRowsTimeCols =
      uniqueDays >= 3 &&
      timeAnchors.length >= 2 &&
      timeXSpread > timeYSpread * 1.7 &&
      dayYSpread > dayXSpread * 1.4;

    const isDayColsTimeRows =
      !isDayRowsTimeCols &&
      uniqueDays >= 3 &&
      timeAnchors.length >= 2 &&
      dayXSpread > dayYSpread * 1.7 &&
      timeYSpread > timeXSpread * 1.4;

    const sortedDayRows = [...dayAnchors].sort((a, b) => a.cy - b.cy);
    const sortedDayCols = [...dayAnchors].sort((a, b) => a.cx - b.cx);
    const sortedTimeCols = [...timeAnchors].sort((a, b) => a.cx - b.cx);
    const sortedTimeRows = [...timeAnchors].sort((a, b) => a.cy - b.cy);

    let adaptiveRy = Math.max(medianWordH * 1.9, height * 0.038);
    if (!isDayRowsTimeCols && !isDayColsTimeRows && roomAnchors.length >= 2) {
      const ys = roomAnchors.map((r) => r.cy).sort((a, b) => a - b);
      let minGap = Infinity;
      for (let i = 1; i < ys.length; i++) {
        const gap = ys[i] - ys[i - 1];
        if (gap > rowTol * 1.2 && gap < minGap) minGap = gap;
      }
      if (minGap < Infinity) {
        adaptiveRy = Math.min(Math.max(minGap * 0.46, rowTol * 1.4), height * 0.085);
      }
    }

    if (roomAnchors.length > 0) {
      for (const rm of roomAnchors) {
        let bestDay = 'السبت';
        let startTime = '10:00';
        let endTime = '11:30';
        let xMin = 0;
        let xMax = width;
        let yMin = Math.max(0, rm.cy - adaptiveRy);
        let yMax = Math.min(height, rm.cy + adaptiveRy);

        if (isDayRowsTimeCols) {
          let dIdx = 0;
          let bestDistY = Infinity;
          sortedDayRows.forEach((d, idx) => {
            const dist = Math.abs(d.cy - rm.cy);
            if (dist < bestDistY) {
              bestDistY = dist;
              dIdx = idx;
            }
          });
          bestDay = sortedDayRows[dIdx].day;
          yMin = dIdx > 0 ? (sortedDayRows[dIdx - 1].cy + sortedDayRows[dIdx].cy) / 2 : 0;
          yMax =
            dIdx + 1 < sortedDayRows.length
              ? (sortedDayRows[dIdx].cy + sortedDayRows[dIdx + 1].cy) / 2
              : height;

          let tIdx = 0;
          let bestDistX = Infinity;
          sortedTimeCols.forEach((t, idx) => {
            const dist = Math.abs(t.cx - rm.cx);
            if (dist < bestDistX) {
              bestDistX = dist;
              tIdx = idx;
            }
          });
          startTime = sortedTimeCols[tIdx].start;
          endTime = sortedTimeCols[tIdx].end;
          xMin = tIdx > 0 ? (sortedTimeCols[tIdx - 1].cx + sortedTimeCols[tIdx].cx) / 2 : 0;
          xMax =
            tIdx + 1 < sortedTimeCols.length
              ? (sortedTimeCols[tIdx].cx + sortedTimeCols[tIdx + 1].cx) / 2
              : width;
        } else if (isDayColsTimeRows) {
          let dIdx = 0;
          let bestDistX = Infinity;
          sortedDayCols.forEach((d, idx) => {
            const dist = Math.abs(d.cx - rm.cx);
            if (dist < bestDistX) {
              bestDistX = dist;
              dIdx = idx;
            }
          });
          bestDay = sortedDayCols[dIdx].day;
          xMin = dIdx > 0 ? (sortedDayCols[dIdx - 1].cx + sortedDayCols[dIdx].cx) / 2 : 0;
          xMax =
            dIdx + 1 < sortedDayCols.length
              ? (sortedDayCols[dIdx].cx + sortedDayCols[dIdx + 1].cx) / 2
              : width;

          let tIdx = 0;
          let bestDistY = Infinity;
          sortedTimeRows.forEach((t, idx) => {
            const dist = Math.abs(t.cy - rm.cy);
            if (dist < bestDistY) {
              bestDistY = dist;
              tIdx = idx;
            }
          });
          startTime = sortedTimeRows[tIdx].start;
          endTime = sortedTimeRows[tIdx].end;
          yMin = rm.cy - height * 0.06;
          yMax = rm.cy + height * 0.06;
        } else {
          if (dayAnchors.length > 0) {
            const sameRow = dayAnchors.filter((d) => Math.abs(d.cy - rm.cy) <= rowTol * 1.5);
            if (sameRow.length > 0) {
              sameRow.sort((a, b) => Math.abs(a.cy - rm.cy) - Math.abs(b.cy - rm.cy));
              bestDay = sameRow[0].day;
            } else {
              const above = dayAnchors
                .filter((d) => d.cy <= rm.cy + rowTol * 1.5)
                .sort((a, b) => b.cy - a.cy);
              bestDay = above[0]?.day || dayAnchors[0].day;
            }
          }

          if (timeAnchors.length > 0) {
            const sortedRow = [...timeAnchors].sort(
              (a, b) => Math.abs(a.cy - rm.cy) - Math.abs(b.cy - rm.cy)
            );
            startTime = sortedRow[0].start;
            endTime = sortedRow[0].end;
          }
        }

        const cellArWords = arWords
          .filter((w) => {
            const wcx = w.x + w.w / 2;
            const wcy = w.y + w.h / 2;
            return wcx >= xMin && wcx <= xMax && wcy >= yMin && wcy <= yMax;
          })
          .sort((a, b) => b.x - a.x);

        const cellEnWords = enWords
          .filter((w) => {
            const wcx = w.x + w.w / 2;
            const wcy = w.y + w.h / 2;
            return wcx >= xMin && wcx <= xMax && wcy >= yMin && wcy <= yMax;
          })
          .sort((a, b) => a.x - b.x);

        const { courseName, courseCode, typeHint } = extractCourseFromCell(
          cellArWords,
          cellEnWords
        );

        let colorBadgeHint: 'نظري' | 'عملي' | undefined;
        if (!isDayRowsTimeCols && !isDayColsTimeRows) {
          const warmHits = warmRows.filter((wy) => wy >= yMin && wy <= yMax).length;
          const coolHits = coolRows.filter((cy) => cy >= yMin && cy <= yMax).length;
          if (warmHits > coolHits && warmHits >= 1) colorBadgeHint = 'عملي';
          else if (coolHits > warmHits && coolHits >= 1) colorBadgeHint = 'نظري';
        }

        const explicitCue = Boolean(rm.hintedType || typeHint || colorBadgeHint);
        allResults.push({
          day: bestDay,
          startTime,
          endTime,
          courseName,
          courseCode,
          type: rm.hintedType || typeHint || colorBadgeHint || 'نظري',
          room: rm.room,
          _explicit: explicitCue,
        });
      }
    } else if (timeAnchors.length > 0) {
      for (const ta of timeAnchors) {
        let bestDay = 'السبت';
        if (dayAnchors.length > 0) {
          const above = dayAnchors
            .filter((d) => d.cy <= ta.cy + adaptiveRy)
            .sort((a, b) => b.cy - a.cy);
          bestDay = above[0]?.day || dayAnchors[0].day;
        }
        const rowAr = arWords
          .filter((w) => Math.abs(w.y + w.h / 2 - ta.cy) <= adaptiveRy)
          .sort((a, b) => b.x - a.x);
        const rowEn = enWords
          .filter((w) => Math.abs(w.y + w.h / 2 - ta.cy) <= adaptiveRy)
          .sort((a, b) => a.x - b.x);
        const { courseName, courseCode, typeHint } = extractCourseFromCell(rowAr, rowEn);
        allResults.push({
          day: bestDay,
          startTime: ta.start,
          endTime: ta.end,
          courseName,
          courseCode,
          type: typeHint || 'نظري',
          room: '—',
        });
      }
    }
  }

  const deduped = distinctMeetings(allResults);
  const byCourse = new Map<string, Array<ParsedRawSession & { _explicit?: boolean }>>();
  for (const s of deduped) {
    const list = byCourse.get(s.courseName) || [];
    list.push(s);
    byCourse.set(s.courseName, list);
  }
  for (const group of byCourse.values()) {
    if (group.length === 2) {
      const [a, b] = group;
      if (a._explicit && !b._explicit) {
        b.type = a.type === 'نظري' ? 'عملي' : 'نظري';
      } else if (b._explicit && !a._explicit) {
        a.type = b.type === 'نظري' ? 'عملي' : 'نظري';
      }
    }
  }

  return deduped.map(({ _explicit, ...session }) => session);
}

export function distinctMeetings<T extends ParsedRawSession>(sessions: T[]): T[] {
  const distinct: T[] = [];
  for (const session of sessions) {
    if (!distinct.some((other) => isSameMeeting(session, other))) distinct.push(session);
  }
  return distinct;
}
