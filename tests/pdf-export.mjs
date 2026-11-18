import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const endpoint = new URL('/api/pdf', process.env.JADWALI_TEST_URL ?? 'http://localhost:5173');
const days = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
const subjects = ['الفيزياء 1', 'مهارات الحاسوب', 'الجبر الخطي ونظرية المصفوفات', 'Physics and Applications'];
const times = ['08:30', '10:00', '11:30', '13:00', '14:30', '16:00', '17:30'];
const schedule = {
  metadata: { title: 'الجدول الدراسي الأسبوعي', subtitle: 'كلية الهندسة', semester: 'الفصل الأول 2026 / 2027' },
  floorRules: [{ prefix: 'B', floor: 'القبو' }, { prefix: 'المدرّج', floor: 'الأرضي' }],
  sessions: Array.from({ length: 42 }, (_, index) => ({
    day: days[index % days.length],
    startTime: times[Math.floor(index / days.length)],
    endTime: times[Math.floor(index / days.length) + 1],
    courseName: subjects[index % subjects.length],
    courseCode: `EXPORT-${String(index + 1).padStart(2, '0')}`,
    room: index % 2 ? 'B-06' : 'المدرّج',
    floor: index % 2 ? 'القبو' : 'الأرضي',
    type: index % 3 ? 'نظري' : 'عملي',
  })),
};

const short = { ...schedule, sessions: schedule.sessions.slice(0, 9) };
const directory = await mkdtemp(join(tmpdir(), 'jadwali-pdf-'));
try {
  const cases = [
    { name: 'download', body: new URLSearchParams({ payload: JSON.stringify(short), disposition: 'attachment' }), disposition: 'attachment', sessions: short.sessions, onePage: true },
    { name: 'preview', body: new URLSearchParams({ payload: JSON.stringify(schedule), disposition: 'inline' }), disposition: 'inline', sessions: schedule.sessions, onePage: false },
    { name: 'json', body: JSON.stringify(short), disposition: 'attachment', sessions: short.sessions, onePage: true },
  ];

  for (const test of cases) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: typeof test.body === 'string' ? { 'Content-Type': 'application/json' } : {},
      body: test.body,
    });
    assert.equal(response.status, 200, response.ok ? undefined : await response.text());
    assert.equal(response.headers.get('content-type'), 'application/pdf');
    assert.equal(response.headers.get('content-disposition'), `${test.disposition}; filename="schedule.pdf"`);
    assert.match(response.headers.get('cache-control'), /no-store/);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
    const path = join(directory, `${test.name}.pdf`);
    await writeFile(path, bytes);
    const info = execFileSync('pdfinfo', [path], { encoding: 'utf8' });
    const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
    if (test.onePage) assert.equal(pages, 1);
    else assert.ok(pages > 1, 'the long schedule should paginate');
    const contents = execFileSync('pdftotext', [path, '-'], { encoding: 'utf8' });
    for (const { courseCode } of test.sessions) assert.ok(contents.includes(courseCode), `Missing ${courseCode}`);
    const fonts = execFileSync('pdffonts', [path], { encoding: 'utf8' });
    assert.match(fonts, /NotoSansArabic.*yes\s+yes\s+yes/);
    console.log(`${test.name} PDF passed (${test.sessions.length} meetings, ${pages} page(s))`);
  }

  const invalid = await fetch(endpoint, { method: 'POST', body: new URLSearchParams({ payload: 'invalid' }) });
  assert.equal(invalid.status, 400);
  assert.match(invalid.headers.get('content-type'), /text\/html/);
  assert.match(await invalid.text(), /العودة إلى جدولي/);
} finally {
  await rm(directory, { recursive: true, force: true });
}
