import puppeteer, { type Browser } from 'puppeteer-core';
import chromium from '@sparticuz/chromium';
import fs from 'node:fs';

const LOCAL_BROWSER_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
];

let sharedBrowser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (sharedBrowser && sharedBrowser.connected) {
    return sharedBrowser;
  }

  const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

  if (isServerless) {
    const executablePath = await chromium.executablePath();
    sharedBrowser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: true,
    });
    return sharedBrowser;
  }

  const localPath = LOCAL_BROWSER_PATHS.find((p) => fs.existsSync(p));
  if (!localPath) {
    const executablePath = await chromium.executablePath();
    sharedBrowser = await puppeteer.launch({
      args: chromium.args,
      executablePath,
      headless: true,
    });
    return sharedBrowser;
  }

  sharedBrowser = await puppeteer.launch({
    executablePath: localPath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--font-render-hinting=none'],
  });
  return sharedBrowser;
}

const DAYS_ORDER = [
  'السبت',
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
];

export interface PdfSession {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  courseName: string;
  courseCode?: string;
  type: 'نظري' | 'عملي';
  room: string;
  floor: string;
}

export interface PdfFloorRule {
  prefix: string;
  floor: string;
}

export interface PdfRequestPayload {
  metadata: {
    title: string;
    subtitle?: string;
    semester: string;
  };
  sessions: PdfSession[];
  floorRules: PdfFloorRule[];
}

function escapeHtml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildSwissScheduleHtml(data: PdfRequestPayload): string {
  const sorted = [...(data.sessions || [])].sort((a, b) => {
    const d = DAYS_ORDER.indexOf(a.day) - DAYS_ORDER.indexOf(b.day);
    if (d !== 0) return d;
    return a.startTime.localeCompare(b.startTime);
  });

  const activeDays = new Set(sorted.map((s) => s.day));
  const offDays = DAYS_ORDER.filter((d) => !activeDays.has(d));
  const uniqueCourses = new Set(sorted.map((s) => s.courseName.trim())).size;

  const count = sorted.length;
  const rowPadY = count > 12 ? '8px' : count > 9 ? '11px' : '14px';
  const baseFont = count > 12 ? '13px' : '14.5px';

  const groupedByDay = DAYS_ORDER.map((day) => ({
    day,
    items: sorted.filter((s) => s.day === day),
  })).filter((g) => g.items.length > 0);

  const rowsHtml = groupedByDay
    .map((group, gIdx) =>
      group.items
        .map((item, idx) => {
          const isFirstOfDay = idx === 0;
          const topBorder =
            gIdx === 0 && idx === 0
              ? 'none'
              : isFirstOfDay
              ? '1.5px solid #181816'
              : '1px solid #E6E4DD';
          const isPractical = item.type === 'عملي';

          return `
            <tr style="border-top: ${topBorder};">
              ${
                isFirstOfDay
                  ? `<td rowspan="${group.items.length}" class="day-cell">${escapeHtml(
                      group.day
                    )}</td>`
                  : ''
              }
              <td class="time-cell" dir="ltr">${escapeHtml(item.startTime)} – ${escapeHtml(
            item.endTime
          )}</td>
              <td class="course-cell">
                <div class="course-title">${escapeHtml(item.courseName)}</div>
                ${
                  item.courseCode
                    ? `<div class="course-code" dir="ltr">${escapeHtml(item.courseCode)}</div>`
                    : ''
                }
              </td>
              <td class="type-cell">
                <span class="badge ${isPractical ? 'badge-prac' : 'badge-theo'}">${escapeHtml(
            item.type
          )}</span>
              </td>
              <td class="room-cell" dir="ltr">${escapeHtml(item.room)}</td>
              <td class="floor-cell">${escapeHtml(item.floor || '—')}</td>
            </tr>
          `;
        })
        .join('')
    )
    .join('');

  const legend = (data.floorRules || [])
    .map((r) => `<span><strong dir="ltr">${escapeHtml(r.prefix)}</strong> ${escapeHtml(r.floor)}</span>`)
    .join('<span class="dot">·</span>');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: 210mm;
      height: 297mm;
      overflow: hidden;
      background: #FFFFFF;
      color: #141413;
      font-family: 'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, sans-serif;
    }
    .page {
      width: 210mm;
      height: 297mm;
      padding: 14mm 15mm;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .top-block {
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-bottom: 16px;
      border-bottom: 2.5px solid #141413;
    }
    .eyebrow {
      font-size: 12px;
      font-weight: 600;
      color: #6B6963;
      margin-bottom: 4px;
    }
    .title {
      margin: 0;
      font-size: 26px;
      font-weight: 700;
      color: #141413;
      line-height: 1.2;
    }
    .subtitle {
      margin-top: 4px;
      font-size: 13px;
      color: #57554F;
      font-weight: 500;
    }
    .stats {
      display: flex;
      gap: 18px;
      text-align: left;
    }
    .stat-box {
      border-right: 1.5px solid #E5E3DC;
      padding-right: 14px;
    }
    .stat-val {
      font-family: 'JetBrains Mono', monospace;
      font-size: 22px;
      font-weight: 700;
      color: #141413;
      line-height: 1.1;
    }
    .stat-lbl {
      font-size: 11.5px;
      font-weight: 600;
      color: #6B6963;
      margin-top: 2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: ${baseFont};
      border-bottom: 2px solid #141413;
    }
    thead tr {
      background: #F6F5F0;
      border-top: 1.5px solid #141413;
      border-bottom: 1.5px solid #141413;
    }
    th {
      padding: 10px 12px;
      font-size: 12px;
      font-weight: 700;
      color: #3D3C38;
      text-align: right;
    }
    th.center { text-align: center; }
    td {
      padding: ${rowPadY} 12px;
      vertical-align: middle;
    }
    .day-cell {
      font-weight: 700;
      font-size: 15px;
      color: #141413;
      background: #FAF9F6;
      border-left: 1px solid #E6E4DD;
      width: 13%;
      vertical-align: middle;
    }
    .time-cell {
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      font-weight: 600;
      color: #2C2B28;
      text-align: right;
      width: 20%;
      white-space: nowrap;
    }
    .course-cell { width: 33%; }
    .course-title { font-weight: 700; color: #141413; }
    .course-code {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 500;
      color: #78766F;
      margin-top: 1px;
      display: inline-block;
    }
    .type-cell { text-align: center; width: 11%; }
    .badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 700;
    }
    .badge-theo {
      background: #EBF2FA;
      color: #1E3A5F;
    }
    .badge-prac {
      background: #FEF0E6;
      color: #9A3412;
    }
    .room-cell {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 700;
      font-size: 14px;
      text-align: center;
      color: #141413;
      width: 11%;
    }
    .floor-cell {
      text-align: center;
      font-weight: 600;
      color: #3D3C38;
      width: 12%;
    }
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 12px;
      border-top: 1px solid #E5E3DC;
      font-size: 12px;
      color: #57554F;
    }
    .footer strong { color: #141413; }
    .legend { display: flex; align-items: center; gap: 8px; }
    .dot { color: #B8B5AC; }
  </style>
</head>
<body>
  <div class="page">
    <div class="top-block">
      <div class="header">
        <div>
          <div class="eyebrow">${escapeHtml(data.metadata?.semester || 'الفصل الأول 2026 / 2027')}</div>
          <h1 class="title">${escapeHtml(data.metadata?.title || 'الجدول الدراسي الأسبوعي')}</h1>
          ${
            data.metadata?.subtitle
              ? `<div class="subtitle">${escapeHtml(data.metadata.subtitle)}</div>`
              : ''
          }
        </div>
        <div class="stats">
          <div class="stat-box">
            <div class="stat-val">${uniqueCourses}</div>
            <div class="stat-lbl">مواد دراسية</div>
          </div>
          <div class="stat-box">
            <div class="stat-val">${sorted.length}</div>
            <div class="stat-lbl">جلسات أسبوعية</div>
          </div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>اليوم</th>
            <th>الوقت</th>
            <th>المادة</th>
            <th class="center">النوع</th>
            <th class="center">القاعة</th>
            <th class="center">الطابق</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>

    <div class="footer">
      <div>
        <strong>أيام بدون محاضرات:</strong> ${
          offDays.length > 0 ? escapeHtml(offDays.join('، ')) : 'لا يوجد'
        }
      </div>
      <div class="legend">
        <strong>دليل الطوابق:</strong> ${legend}
      </div>
    </div>
  </div>
</body>
</html>`;
}

export async function renderScheduleVectorPdf(payload: PdfRequestPayload): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    const html = buildSwissScheduleHtml(payload);
    // On Vercel serverless Linux without default Arabic system fonts, wait up to 4s for Google Fonts IBM Plex Sans Arabic!
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 6000 }).catch(() => {});
    await Promise.race([
      page.evaluate(() => (document.fonts ? document.fonts.ready : Promise.resolve())),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
    const pdfUint8 = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      pageRanges: '1',
    });
    return Buffer.from(pdfUint8);
  } finally {
    await page.close().catch(() => {});
  }
}
