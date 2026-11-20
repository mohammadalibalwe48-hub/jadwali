import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import puppeteer from 'puppeteer-core';

const titles = {
  computer: 'مهارات الحاسوب',
  physics: 'الفيزياء 1',
  calculus: 'تحليل رياضي 1',
  english: 'اللغة الإنكليزية 1',
  arabic: 'اللغة العربية',
  algebra: 'الجبر الخطي',
  matrices: 'الجبر الخطي ونظرية المصفوفات',
};
const days = ['السبت','الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة'];
// Rows transcribed from the three reference weekly schedules, without personal details.
const schedules = [
  [
    [0,'computer','14:30','16:00','L-12'], [1,'calculus','10:00','11:30','L-12'],
    [1,'physics','13:00','14:30','B-06',1], [2,'english','10:00','11:30','المدرّج'],
    [2,'computer','13:00','14:30','S-07',1], [3,'algebra','13:00','14:30','S-01B',1],
    [4,'calculus','10:00','11:30','S-01B',1], [6,'algebra','08:30','10:00','F-03'],
    [6,'physics','11:30','13:00','F-03'],
  ],
  [
    [0,'physics','08:30','10:00','B-06',1], [0,'computer','10:00','11:30','L-02',1],
    [0,'computer','11:30','13:00','L-12'], [1,'calculus','08:30','10:00','L-12'],
    [3,'algebra','11:30','13:00','S-01B',1], [4,'calculus','08:30','10:00','S-01B',1],
    [6,'algebra','08:30','10:00','F-03'], [6,'physics','11:30','13:00','F-03'],
  ],
  [
    [1,'computer','08:30','10:00','S-07',1], [1,'matrices','10:30','12:30','S-03'],
    [2,'arabic','11:30','13:00','L-14'], [2,'matrices','13:00','14:30','F-02B',1],
    [4,'computer','08:30','10:00','المدرّج'], [4,'physics','10:00','11:30','B-06',1],
    [6,'physics','11:30','13:00','S-03'],
  ],
];

function renderWeekly(rows, titles, days, style) {
  const canvas = document.createElement('canvas');
  canvas.width = 1000;
  canvas.height = 372 + rows.length * 94;
  const ctx = canvas.getContext('2d');
  const text = (value, x, y, options = {}) => {
    const { size = 26, color = '#163344', align = 'center', font = 'Noto Sans Arabic', weight = 600 } = options;
    ctx.font = `${weight} ${size}px "${font}"`;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.fillText(value, x, y);
  };
  const rect = (fill, x, y, w, h) => { ctx.fillStyle = fill; ctx.fillRect(x, y, w, h); };
  rect('#fff', 0, 0, 1000, canvas.height);
  rect(['#104b50','#21455b','#323d60'][style], 0, 0, 1000, 223);
  text('جدول المحاضرات الأسبوعي', 947, 123, { size: 59, color:'#fff', align:'right' });
  text('الفصل الأول 2026 / 2027', 947, 186, { size: 25, color:'#e9f2f5', align:'right' });
  for (const [title, x] of [['القاعة',105], ['الوقت (٢٤ ساعة)',318], ['المادة',786], ['اليوم',918]]) {
    text(title, x, 267, { color:'#52636d', size:23 });
  }
  let y = 294;
  for (let at = 0; at < rows.length;) {
    const d = rows[at][0];
    let until = at + 1;
    while (rows[until]?.[0] === d) until++;
    rect(style === 2 ? '#eeeef7' : '#eaf3f4', 831, y, 126, (until-at)*94);
    rect('#cbd8da', 39, y, 918, 2);
    text(days[d], 890, y + (style === 2 ? (until-at)*47 : 48), { size:24 });
    for (; at < until; at++) {
      const [,title,start,end,room,practical] = rows[at];
      text(titles[title], 806, y+40, { size:27,align:'right' });
      text(`${start} – ${end}`, 316, y+55, { font:'Arial', size:26, weight:400 });
      text(room, 103, y+55, { font:room.startsWith('ال')?'Noto Sans Arabic':'Arial', weight:700 });
      rect(practical?'#f6e8d6':'#e1edf3', 743, y+55, 64, 27);
      text(practical?'عملي':'نظري', 774, y+75, { size:16 });
      y += 94;
      if (at + 1 < until) rect('#e6e6e6', 39, y, 775, 1);
    }
  }
  rect('#eaf3f4', 39, y+21, 918, 61);
  text('أيام بلا محاضرات', 929, y+57, { size:21, align:'right' });
  text(days.filter((_,i)=>!rows.some(row=>row[0]===i)).join('، '), 701, y+57,{size:20,align:'right'});
  return canvas.toDataURL('image/png').split(',')[1];
}

function renderPortal(part, titles, days) {
  const canvas = document.createElement('canvas');
  canvas.width = 720; canvas.height = 1280;
  const ctx = canvas.getContext('2d');
  const fill = (c,x,y,w,h)=>{ctx.fillStyle=c;ctx.fillRect(x,y,w,h);};
  const text = (value, x, y, rtl = false) => {
    ctx.fillStyle = '#505050'; ctx.textAlign = 'right';
    ctx.font = rtl ? '21px "Noto Sans Arabic"' : '22px Arial';
    ctx.fillText(value,x,y);
  };
  fill('#f2f2f2',0,0,720,1280);
  fill('#fff',30,215,660,895);
  const y = part === 0 ? 304 : 444;
  text('جدول المحاضرات',650,y-163,true);
  text('الفصل الأول 2026/2027',318,160,true);
  fill('#fff',72,y-100,575,100);
  fill('#9c86db',72,y,575,4);
  const bounds=[y+4,y+116,y+233,y+340,y+460];
  for (let i=0;i<4;i++) fill(i%2?'#fff':'#f3f3f3',72,bounds[i],575,bounds[i+1]-bounds[i]);
  fill('#dff4e8',72,bounds[4],575,72);
  if (part === 0) {
    text('اسم المقرر',501,y-48,true);
    text('رمز المقرر',210,y-48,true);
    ['computer','physics','arabic','matrices'].forEach((key,index) => {
      text(titles[key],617,bounds[index]+65,true);
      text(['UNRC101','CEFC101','UNRC102','CECC122'][index],210,bounds[index]+65);
    });
  } else {
    const xByPart=[[],[257,452,629],[192,366,539],[209,381,547]];
    const columnDays=[[],[2,1,0],[5,4,3],[6,5,4]][part];
    columnDays.forEach((d,i)=>text(days[d],xByPart[part][i],y-51,true));
    const cell=(row,col,range,room)=>{
      const x=xByPart[part][col]+42;
      text(range,x,bounds[row]+48);
      text(room,x,bounds[row]+87,room==='مدرج');
    };
    if(part===1) { cell(0,1,'P 08:30-10:00','S-07');cell(2,0,'T 11:30-01:00','L-14');cell(3,0,'P 01:00-02:30','F-02B');cell(3,1,'T 10:30-12:30','S-03'); }
    if(part===2) { cell(0,1,'T 08:30-10:00','مدرج');cell(1,1,'P 10:00-11:30','B-06'); }
    if(part===3) { cell(0,2,'T 08:30-10:00','مدرج');cell(1,0,'T 11:30-01:00','S-03');cell(1,2,'P 10:00-11:30','B-06'); }
  }
  return canvas.toDataURL('image/png').split(',')[1];
}

const browser = await puppeteer.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox','--ignore-certificate-errors'],
  headless: true,
});
const directory = await mkdtemp(join(tmpdir(),'jadwali-import-'));
const page = await browser.newPage();
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
await page.evaluateOnNewDocument(() => localStorage.clear());
const errors = [];
let scanRequests = 0;
let navigation = 0;
let expectedImageCount = 1;
let scanResponse = { sessions: [], issues: [] };
let scanStatus = 200;
let responseGate;
await page.setRequestInterception(true);
page.on('request', async (request) => {
  if (new URL(request.url()).pathname !== '/api/vision') return request.continue();
  scanRequests++;
  assert.equal(request.method(), 'POST');
  assert.equal(request.headers().authorization, undefined);
  const body = JSON.parse(request.postData());
  assert.deepEqual(Object.keys(body), ['images']);
  assert.equal(body.images.length, expectedImageCount);
  assert.ok(body.images.every((image) => image.startsWith('data:image/jpeg;base64,')));
  if (responseGate) await responseGate;
  await request.respond({ status: scanStatus, contentType: 'application/json', body: JSON.stringify(scanResponse) });
});

const scanMeetings = (rows) => ({
  sessions: rows.map(([day, title, startTime, endTime, room, practical]) => ({
    day: days[day], courseName: titles[title], startTime, endTime, room, type: practical ? 'عملي' : 'نظري',
  })),
  issues: [],
});

page.on('pageerror', (error) => errors.push(error.message));

async function upload(files, keepReview = false) {
  if (!keepReview) {
    const url = new URL(process.env.JADWALI_TEST_URL ?? 'http://localhost:5173');
    url.searchParams.set('test', String(++navigation));
    await page.goto(url.toString());
    await page.click('.welcome .button-coral');
  }
  const selector = keepReview ? 'dialog input[type=file]' : 'input[type=file]';
  const input = await page.waitForSelector(selector);
  const previousRequests = scanRequests;
  await input.uploadFile(...files);
  if (!keepReview) {
    await page.waitForSelector('.file-list img');
    assert.equal(scanRequests, previousRequests, 'Selecting images should not start OCR');
    if (previousRequests === 0) {
      let release;
      responseGate = new Promise((resolve) => { release = resolve; });
      try {
        await page.click('[data-scan-images]');
        await page.waitForSelector('.scan-status', { visible: true });
        assert.equal(await page.$('.review-list'), null);
      } finally {
        release();
        responseGate = undefined;
      }
    } else {
      await page.click('[data-scan-images]');
    }
  }
  await page.waitForFunction(() => {
    const dialog = document.querySelector('dialog[open]');
    return dialog && dialog.textContent.includes('مراجعة استيراد الجدول') && !dialog.querySelector('.scan-status');
  }, { timeout: 90000 });
}

async function importMeetings(expected) {
  const review = await page.$$eval('dialog input[type=checkbox]', inputs => inputs.length);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.jadwali_user_sessions_v2).length), 0);
  const summary = await page.$eval('dialog', dialog => dialog.innerText);
  assert.equal(review, expected.length, summary);
  assert.equal(await page.$('dialog input[type=password]'), null);
  await page.evaluate(() => Array.from(document.querySelectorAll('dialog button')).find(button => button.textContent.trim()==='إضافة المحدّد').click());
  await page.waitForFunction((n) => JSON.parse(localStorage.jadwali_user_sessions_v2).length === n, {}, expected.length);
  const actual = await page.evaluate(() => JSON.parse(localStorage.jadwali_user_sessions_v2).map(item =>
    [item.day,item.courseName,item.startTime,item.endTime,item.room,item.type]));
  const canonical = (s) => s.normalize('NFKC').replace(/[\u064b-\u065f]/g, '').replace(/[إأ]/g, 'ا');
  assert.deepEqual(actual.map(row => row.map(canonical)), expected.map(([day,title,start,end,room,p]) =>
    [days[day],titles[title],start,end,room,p?'عملي':'نظري'].map(canonical)));
}

try {
  for (const [index, rows] of schedules.entries()) {
    const fixture = join(directory,`weekly-${index}.png`);
    await writeFile(fixture, Buffer.from(await page.evaluate(renderWeekly, rows, titles, days, index),'base64'));
    scanResponse = scanMeetings(rows);
    await upload([fixture]);
    await importMeetings(rows);
    console.log(`Weekly review ${index+1} passed (${rows.length} mocked meetings)`);
  }

  const portal = [];
  for (let part=0;part<4;part++) {
    const path = join(directory,`portal-${part}.png`);
    await writeFile(path,Buffer.from(await page.evaluate(renderPortal, part, titles, days),'base64'));
    portal.push(path);
  }
  expectedImageCount = 3;
  scanResponse = { sessions: [], issues: ['missing_catalog'] };
  await upload(portal.slice(1));
  assert.equal(await page.$$eval('dialog input[type=checkbox]', inputs => inputs.length), 0);
  assert.match(await page.$eval('dialog', dialog => dialog.innerText), /أرفق لقطة تظهر أسماء/);

  expectedImageCount = 4;
  scanStatus = 429;
  scanResponse = { error: 'قارئ الصور مشغول' };
  await upload([portal[0]], true);
  assert.match(await page.$eval('dialog', dialog => dialog.innerText), /قارئ الصور مشغول/);

  scanStatus = 200;
  scanResponse = scanMeetings(schedules[2]);
  await page.evaluate(() => Array.from(document.querySelectorAll('dialog button')).find(button => button.textContent.trim()==='أعد القراءة').click());
  await page.waitForFunction(() => document.querySelectorAll('dialog input[type=checkbox]').length === 7);
  await importMeetings(schedules[2]);
  assert.equal(scanRequests, 6);
  console.log('Split screenshot upload, missing catalog, and retry passed.');
  assert.deepEqual(errors,[]);
} finally {
  await browser.close();
  await rm(directory, { recursive: true, force:true });
}
