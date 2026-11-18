import { existsSync, readFileSync } from 'node:fs';
import puppeteer, { type Browser } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import { DAYS_ORDER, type FloorRule, type LectureSession, type ScheduleMetadata } from '../src/types.js';

const localBrowserPaths = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
];

let browserPromise: Promise<Browser> | undefined;

function getBrowser(): Promise<Browser> {
  browserPromise ??= (async () => {
    const localPath = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
      ? undefined
      : localBrowserPaths.find((path) => existsSync(path));
    const browser = await puppeteer.launch({
      executablePath: localPath ?? await chromium.executablePath(),
      args: localPath ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'] : chromium.args,
      headless: true,
    });
    browser.once('disconnected', () => { browserPromise = undefined; });
    return browser;
  })().catch((error) => {
    browserPromise = undefined;
    throw error;
  });
  return browserPromise;
}

export interface PdfRequestPayload {
  metadata?: Partial<ScheduleMetadata>;
  sessions: Pick<LectureSession, 'day' | 'startTime' | 'endTime' | 'courseName' | 'courseCode' | 'type' | 'room' | 'floor'>[];
  floorRules: Pick<FloorRule, 'prefix' | 'floor'>[];
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

let embeddedFonts: string | undefined;

function fontStyle(): string {
  // Noto Sans Arabic 5.3.0 from Fontsource, licensed under the SIL OFL.
  const subsets = {
    latin: 'U+0000-00FF, U+2000-206F, U+20AC, U+2212',
    arabic: 'U+0600-06FF, U+0750-077F, U+0870-08FF, U+200C-200E, U+FB50-FDFF, U+FE70-FEFF',
  };
  embeddedFonts ??= Object.entries(subsets).flatMap(([subset, range]) => [400, 700].map((weight) => {
    const location = new URL(`./fonts/noto-sans-arabic-${subset}-${weight}.woff2`, import.meta.url);
    return `@font-face {
      font-family: Schedule;
      src: url(data:font/woff2;base64,${readFileSync(location).toString('base64')}) format('woff2');
      font-weight: ${weight};
      unicode-range: ${range};
    }`;
  })).join('\n');
  return embeddedFonts;
}

function buildScheduleHtml({ metadata, sessions, floorRules }: PdfRequestPayload): string {
  const groups = DAYS_ORDER.map((day) => ({
    day,
    meetings: sessions.filter((item) => item.day === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
  }));
  const offDays = groups.filter(({ meetings }) => !meetings.length).map(({ day }) => day);
  const courseCount = new Set(sessions.map(({ courseCode, courseName }) =>
    courseCode?.trim().toUpperCase() || courseName.trim())).size;
  const title = escapeHtml(metadata?.title?.trim() || 'الجدول الدراسي الأسبوعي');
  const semester = escapeHtml(metadata?.semester?.trim() || '').replace(
    /[\d٠-٩]{4}\s*[\/–-]\s*[\d٠-٩]{4}/g, (years) => `<bdi dir="ltr">${years}</bdi>`,
  );
  const subtitle = metadata?.subtitle?.trim();
  const countFormat = new Intl.NumberFormat('ar');
  const tableRows = groups.filter(({ meetings }) => meetings.length).map(({ day, meetings }) => `
    <tbody${meetings.length <= 6 ? ' class="keep-together"' : ''}>
      <tr class="day"><th scope="rowgroup" colspan="3">${escapeHtml(day)}</th></tr>
      ${meetings.map((item) => `
        <tr class="meeting">
          <td class="time"><bdi dir="ltr">${escapeHtml(item.startTime)}–${escapeHtml(item.endTime)}</bdi></td>
          <td>
            <strong class="course" dir="auto">${escapeHtml(item.courseName)}</strong>
            <div class="course-details">
              <span class="type ${item.type === 'عملي' ? 'practical' : 'theory'}">${escapeHtml(item.type)}</span>
              ${item.courseCode ? `<bdi class="code" dir="ltr">${escapeHtml(item.courseCode)}</bdi>` : ''}
            </div>
          </td>
          <td>
            <strong class="room" dir="auto">${escapeHtml(item.room || '—')}</strong>
            ${item.floor && item.floor !== '—' ? `<span class="floor" dir="auto">${escapeHtml(item.floor)}</span>` : ''}
          </td>
        </tr>
      `).join('')}
    </tbody>
  `).join('');
  const floorLegend = floorRules.map(({ prefix, floor }) =>
    `<span><bdi><strong>${escapeHtml(prefix)}</strong></bdi> <bdi>${escapeHtml(floor)}</bdi></span>`).join('');

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    ${fontStyle()}
    @page { size: A4 portrait; margin: 12mm 13mm; }
    * { box-sizing: border-box; }
    html { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    body { margin: 0; color: #132d30; background: #fff; font-family: Schedule, sans-serif; font-size: 13px; line-height: 1.46; }
    header {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 20px;
      align-items: center;
      padding: 17px 20px;
      background: #eaf4f1;
      border-top: 4px solid #1d5652;
      border-radius: 0 0 10px 10px;
      break-inside: avoid;
      margin-bottom: 16px;
    }
    h1 { font-size: 30px; line-height: 1.3; margin: 2px 0; font-weight: 700; overflow-wrap: anywhere; }
    .semester { font-size: 12px; font-weight: 700; color: #2f5b56; overflow-wrap: anywhere; }
    .subtitle { margin-top: 4px; color: #3e5558; overflow-wrap: anywhere; }
    dl { display: flex; gap: 14px; margin: 0; text-align: center; }
    dl div { min-width: 61px; padding: 3px 8px; border-inline-start: 1px solid #bed5cf; }
    dt { font-size: 10px; color: #3e5558; }
    dd { margin: 0; font-size: 22px; line-height: 1.1; font-weight: 700; font-variant-numeric: tabular-nums; }
    table { width: 100%; table-layout: fixed; border-collapse: collapse; }
    col.time-column { width: 23%; } col.course-column { width: 56%; } col.location-column { width: 21%; }
    thead { display: table-header-group; }
    thead th { background: #1d5652; color: #fff; padding: 7px 12px; font-size: 11px; text-align: right; }
    tbody.keep-together, tr { break-inside: avoid; }
    .day { break-after: avoid; }
    .day th {
      background: #edf5f3;
      padding: 4px 12px;
      border-top: 2px solid #fff;
      border-bottom: 1px solid #c8dcd8;
      color: #1b514c;
      text-align: right;
      font-size: 13px;
      font-weight: 700;
    }
    td { padding: 6px 12px; border-bottom: 1px solid #e2e9e7; vertical-align: middle; overflow-wrap: anywhere; }
    .meeting:nth-child(odd) { background: #fafcfb; }
    .time { font-variant-numeric: tabular-nums; font-size: 14px; font-weight: 700; }
    .time bdi { white-space: nowrap; }
    .course { display: block; text-align: right; font-size: 15px; font-weight: 700; }
    .course-details { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 2px; }
    .type { display: inline-block; padding: 0 7px; font-size: 10px; font-weight: 700; border-radius: 4px; }
    .theory { background: #e4edf7; color: #244768; }
    .practical { background: #fbebd8; color: #77451d; }
    .code { font-size: 10px; font-weight: 700; color: #415a5b; }
    .room { display: block; text-align: right; font-size: 14px; font-weight: 700; }
    .floor { display: block; text-align: right; font-size: 11px; color: #465a5d; }
    .compact td { padding-top: 4px; padding-bottom: 4px; }
    .compact .day th { padding-top: 3px; padding-bottom: 3px; }
    footer { margin-top: 13px; color: #40585b; font-size: 11px; break-inside: avoid; }
    .off-days { padding: 6px 12px; background: #edf5f3; border-inline-start: 3px solid #1d5652; border-radius: 4px; }
    .off-days strong { margin-inline-end: 8px; color: #1b514c; }
    .legend { display: flex; align-items: baseline; flex-wrap: wrap; gap: 3px 12px; padding: 8px 0 0; }
    .legend span { max-width: 100%; overflow-wrap: anywhere; }
  </style>
</head>
<body>
  <main${sessions.length > 12 ? ' class="compact"' : ''}>
    <header>
      <div>
        ${semester ? `<div class="semester">${semester}</div>` : ''}
        <h1 dir="auto">${title}</h1>
        ${subtitle ? `<div class="subtitle" dir="auto">${escapeHtml(subtitle)}</div>` : ''}
      </div>
      <dl>
        <div><dd>${countFormat.format(courseCount)}</dd><dt>مواد دراسية</dt></div>
        <div><dd>${countFormat.format(sessions.length)}</dd><dt>محاضرات أسبوعية</dt></div>
      </dl>
    </header>
    <table aria-label="المحاضرات الأسبوعية">
      <colgroup><col class="time-column"><col class="course-column"><col class="location-column"></colgroup>
      <thead><tr><th scope="col">الوقت (24 ساعة)</th><th scope="col">المادة</th><th scope="col">القاعة والطابق</th></tr></thead>
      ${tableRows}
    </table>
    ${offDays.length || floorLegend ? `
      <footer>
        ${offDays.length ? `<div class="off-days"><strong>أيام بلا محاضرات</strong> ${escapeHtml(offDays.join('، '))}</div>` : ''}
        ${floorLegend ? `<div class="legend"><strong>دليل الطوابق</strong>${floorLegend}</div>` : ''}
      </footer>
    ` : ''}
  </main>
</body>
</html>`;
}

export async function renderScheduleVectorPdf(payload: PdfRequestPayload): Promise<Buffer> {
  const page = await (await getBrowser()).newPage();
  try {
    await page.setContent(buildScheduleHtml(payload), { waitUntil: 'load' });
    return Buffer.from(await page.pdf({
      preferCSSPageSize: true,
      printBackground: true,
      waitForFonts: true,
    }));
  } finally {
    await page.close().catch(() => {});
  }
}
