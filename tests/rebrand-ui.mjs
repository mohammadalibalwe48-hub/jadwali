import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import puppeteer from 'puppeteer-core';

const url = process.env.JADWALI_TEST_URL ?? 'http://localhost:5173';
const browser = await puppeteer.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});
const fixtures = await mkdtemp(join(tmpdir(), 'jadwali-ui-'));
const widths = [320, 375, 390, 430, 768, 1024, 1280, 1440, 1920];
const screenshots = process.env.JADWALI_SCREENSHOTS;
const classes = [
  { courseName: 'هندسة البرمجيات', courseCode: 'CS304', day: 'الأحد', startTime: '09:00', endTime: '10:00', type: 'نظري', room: 'S-07', floor: 'الثاني' },
  { courseName: 'Database Systems', courseCode: 'CS220', day: 'الأحد', startTime: '10:30', endTime: '12:00', type: 'عملي', room: 'B-12', floor: 'القبو' },
  { courseName: 'شبكات الحاسوب', courseCode: 'CS310', day: 'الإثنين', startTime: '13:00', endTime: '14:30', type: 'نظري', room: 'F-04', floor: 'الأول' },
];

try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.setDefaultTimeout(8000);
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await page.evaluateOnNewDocument(() => {
    const NativeDate = Date;
    window.Date = class extends NativeDate {
      constructor(...args) { super(...(args.length ? args : [new NativeDate(2026, 10, 22, 9, 15)])); }
      static now() { return Number(new Date()); }
    };
  });

  async function assertFits(selector) {
    await page.waitForSelector(selector);
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    const metrics = await page.$eval(selector, (element) => {
      const { left, right } = element.getBoundingClientRect();
      return { width: innerWidth, documentWidth: document.documentElement.scrollWidth,
        left, right, contentWidth: element.scrollWidth, clientWidth: element.clientWidth };
    });
    const { width, documentWidth, left, right, contentWidth, clientWidth } = metrics;
    assert.ok(documentWidth <= width && left >= -1 && right <= width + 1 && contentWidth <= clientWidth + 1,
      `${selector} overflows at ${page.viewport().width}px (${JSON.stringify(metrics)})`);
  }

  async function checkWidths(selector) {
    for (const width of widths) {
      const mobile = width <= 430;
      await page.setViewport({ width, height: 940, isMobile: mobile, hasTouch: mobile });
      await assertFits(selector);
    }
  }

  async function capture(names) {
    if (!screenshots) return;
    for (const [name, width, height] of names) {
      await page.setViewport({ width, height, isMobile: width <= 430, hasTouch: width <= 430 });
      await page.evaluate(() => { window.scrollTo(0, 0); });
      await page.screenshot({ path: join(screenshots, name) });
    }
  }

  async function click(selector) {
    await page.$eval(selector, (element) => element.scrollIntoView({ block: 'center' }));
    await page.click(selector);
  }

  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.waitForSelector('.welcome h1');
  assert.equal(await page.$eval('html', (el) => el.dir), 'rtl');
  assert.equal(await page.$eval('.welcome-copy', (el) => getComputedStyle(el).animationName), 'none');
  await checkWidths('.welcome');
  await capture([['jadwali-rebrand-home.png', 1440, 940], ['jadwali-rebrand-mobile.png', 390, 844]]);

  await click('.language-switch');
  await page.waitForFunction(() => document.documentElement.lang === 'en' && document.documentElement.dir === 'ltr');
  assert.match(await page.$eval('h1', (el) => el.textContent), /From photo/);
  await checkWidths('.welcome');
  await capture([['jadwali-rebrand-english.png', 1440, 940]]);

  await page.setViewport({ width: 320, height: 744, isMobile: true, hasTouch: true });
  await click('.welcome .button-coral');
  await page.waitForSelector('dialog[open] .drop-zone');
  await assertFits('dialog[open]');
  assert.match(await page.$eval('dialog h2', (el) => el.textContent), /Import a timetable/);
  assert.equal(await page.$eval('input[capture]', (el) => el.getAttribute('capture')), 'environment');

  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, 300, 150);
    ctx.fillStyle = '#154cce';
    ctx.fillRect(0, 0, 300, 30);
    ctx.fillStyle = '#d6e1f6';
    for (let row = 1; row < 4; row++) ctx.fillRect(12, 34 * row + 8, 276, 14);
    return canvas.toDataURL().split(',')[1];
  });
  const input = await page.waitForSelector('dialog input[type=file][multiple]');
  const [first, second, invalid] = ['first.png', 'second.png', 'invalid.txt'].map((name) => join(fixtures, name));
  await writeFile(first, Buffer.from(png, 'base64'));
  await writeFile(second, Buffer.from(png, 'base64'));
  await writeFile(invalid, 'not an image');
  await input.uploadFile(invalid);
  await page.waitForSelector('.notice-error');
  assert.equal(await page.$eval('[data-scan-images]', (el) => el.disabled), true);
  await input.uploadFile(first, second);
  await page.waitForFunction(() => document.querySelectorAll('.file-list li').length === 2);
  await click('.file-list li:first-child button');
  assert.equal(await page.$eval('.file-list li bdi', (el) => el.textContent), 'second.png');
  const [chooser] = await Promise.all([
    page.waitForFileChooser(),
    click('dialog .dialog-body > .button-secondary'),
  ]);
  await chooser.accept([first]);
  await page.waitForFunction(() => document.querySelector('.file-list li bdi')?.textContent === 'first.png');
  assert.equal((await page.$$('.file-list li')).length, 1);
  await capture([['jadwali-rebrand-upload.png', 390, 844]]);
  await page.keyboard.press('Escape');

  await page.evaluate((samples) => localStorage.setItem('jadwali_user_sessions_v2', JSON.stringify(
    samples.map((session, index) => ({ ...session, id: String(index), floorAuto: false })),
  )), classes);
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForSelector('.schedule-board');
  assert.equal(await page.$eval('html', (el) => el.dir), 'ltr');
  assert.match(await page.$eval('.agenda-day h3', (el) => el.textContent), /Sunday/);
  assert.match(await page.$eval('.today-location', (el) => el.textContent), /Second/);
  await checkWidths('.schedule-board');
  await capture([['jadwali-rebrand-schedule.png', 1440, 900]]);

  await click('.language-switch');
  await page.waitForFunction(() => document.documentElement.dir === 'rtl');
  await checkWidths('.schedule-board');
  await capture([['jadwali-rebrand-schedule-ar.png', 1440, 900], ['jadwali-rebrand-schedule-mobile.png', 390, 844]]);
  await click('.week-day[aria-label="الإثنين"]');
  assert.equal((await page.$$('.meeting-row')).length, 1);
  await click('.view-option:last-child');
  await page.waitForSelector('.schedule-table-scroll');
  await assertFits('.schedule-table-scroll');
  await click('.table-course');
  await page.waitForSelector('#editor-course');
  assert.equal(await page.$eval('#editor-course', (el) => el.value), classes[2].courseName);
  await page.keyboard.press('Escape');

  await click('.nav-export');
  await click('.workspace-menu-option:first-child');
  await page.waitForSelector('.pdf-summary');
  assert.equal(await page.$eval('form[action="/api/pdf"] input[name=payload]', (el) => JSON.parse(el.value).sessions.length), classes.length);
  await capture([['jadwali-rebrand-pdf.png', 390, 844]]);
  await page.keyboard.press('Escape');
  await page.setViewport({ width: 320, height: 744, isMobile: true, hasTouch: true });
  for (const [button, index, title] of [
    ['.nav-export', 2, /تصدير إلى التقويم/],
    ['.nav-export', 3, /مشاركة الجدول كصورة/],
    ['.nav-more', 1, /دليل رموز الطوابق/],
    ['.nav-more', 2, /النسخ الاحتياطي والمزامنة/],
    ['.nav-more', 3, /تثبيت جدولي/],
    ['.nav-more', 4, /الإعدادات/],
  ]) {
    await click(button);
    await click(`.workspace-menu-option:nth-child(${index})`);
    await page.waitForSelector('dialog[open]');
    assert.match(await page.$eval('dialog h2', (el) => el.textContent), title);
    if (index === 3 && button === '.nav-export') {
      await page.waitForSelector('dialog img[alt="معاينة صورة الجدول"]');
    }
    await assertFits('dialog[open]');
    await page.keyboard.press('Escape');
    await page.waitForSelector('dialog[open]', { hidden: true });
  }
  await click('.workspace-nav-item:nth-child(2)');
  await page.waitForSelector('dialog[open] input[type=date]');
  await assertFits('dialog[open]');
  await page.keyboard.press('Escape');
  assert.deepEqual(errors, []);
  console.log('Brand UI passed at all nine widths in Arabic and English, including upload controls, locale persistence, agenda, editor and tool dialogs.');
} finally {
  await browser.close();
  await rm(fixtures, { recursive: true, force: true });
}
