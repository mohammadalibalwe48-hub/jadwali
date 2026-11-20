import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true } });

try {
  const { buildCalendar, nextMeeting, validSemester } = await vite.ssrLoadModule('/src/utils/semester.ts');
  const { todayAgenda } = await vite.ssrLoadModule('/src/utils/today.ts');
  const { EMPTY_ATTENDANCE, attendanceSummary, courseKey, setMark } = await vite.ssrLoadModule('/src/utils/attendance.ts');
  const { backupHash, decryptBackup, encryptBackup, newRecoveryCode } = await vite.ssrLoadModule('/src/services/backup.ts');
  const session = {
    id: 'class-1', day: 'الأحد', startTime: '08:30', endTime: '10:00', courseCode: 'CS101',
    courseName: 'مهارات الحاسوب, مختبر;\nالمقرر الدراسي', type: 'عملي', room: 'S-07', floor: 'الثاني', floorAuto: true,
  };
  const later = { ...session, id: 'class-2', startTime: '10:30', endTime: '12:00' };
  assert.equal(nextMeeting([later, session], new Date(2026, 10, 22, 8)).session.id, session.id);
  assert.equal(nextMeeting([later, session], new Date(2026, 10, 22, 9)).session.id, later.id);
  const afterHours = nextMeeting([session], new Date(2026, 10, 22, 13));
  assert.equal(afterHours.offset, 7);
  assert.equal(afterHours.starts.getDate(), 29);
  assert.equal(nextMeeting([{ ...session, startTime: '25:00' }], new Date()), null);

  const overlapping = { ...session, id: 'overlapping', startTime: '09:00', endTime: '09:30' };
  const tomorrow = { ...session, id: 'tomorrow', day: 'الإثنين' };
  const invalid = { ...session, id: 'invalid', endTime: '08:00' };
  const agenda = (hours, minutes = 0) => todayAgenda([later, overlapping, session, tomorrow, invalid],
    new Date(2026, 10, 22, hours, minutes)).map(({ session, gap, status }) => [session.id, gap, status]);
  assert.deepEqual(agenda(9), [
    [session.id, 0, 'ongoing'], [overlapping.id, 0, 'ongoing'], [later.id, 30, 'upcoming'],
  ]);
  assert.deepEqual(agenda(10, 15), [
    [session.id, 0, 'ended'], [overlapping.id, 0, 'ended'], [later.id, 15, 'upcoming'],
  ]);
  assert.ok(agenda(12).every(([, , status]) => status === 'ended'));
  assert.deepEqual(todayAgenda([session], new Date(2026, 10, 23, 8)), []);

  assert.equal(validSemester('2026-02-30', '2026-03-03'), false);
  assert.equal(validSemester('2026-09-20', '2026-07-01'), false);
  const ics = buildCalendar([session], '2026-11-18', '2026-11-29', 15, new Date('2026-11-18T20:00:00Z'));
  assert.ok(ics.split('\r\n').every((line) => Buffer.byteLength(line) <= 75));
  const unfolded = ics.replace(/\r\n /g, '');
  assert.match(unfolded, /DTSTART:20261122T083000\r\nDTEND:20261122T100000\r\nRRULE:FREQ=WEEKLY;COUNT=2/);
  assert.ok(unfolded.includes('مهارات الحاسوب\\, مختبر\\;\\nالمقرر الدراسي'));
  assert.ok(unfolded.includes('LOCATION:S-07 · الثاني'));
  assert.ok(unfolded.includes('TRIGGER:-PT15M'));
  assert.throws(() => buildCalendar([session], '2026-11-18', '2026-11-21', 0));

  const course = courseKey(session);
  let attendance = { ...EMPTY_ATTENDANCE, limits: { [course]: 3 } };
  attendance = setMark(attendance, session, '2026-11-15', 'present');
  attendance = setMark(attendance, session, '2026-11-22', 'missed');
  attendance = setMark(attendance, later, '2026-11-22', 'late');
  const [summary] = attendanceSummary([session], attendance);
  assert.deepEqual(summary, { key: course, name: session.courseName, missed: 1, present: 1, late: 1, limit: 3, remaining: 2 });
  attendance = setMark(attendance, session, '2026-11-22', 'missed');
  assert.equal(attendanceSummary([], attendance)[0].remaining, 3);

  const data = { version: 1, sessions: [session, later], metadata: { title: 'جدولي', subtitle: '', semester: '' }, floorRules: [], attendance };
  const code = newRecoveryCode();
  const envelope = await encryptBackup(code, data);
  assert.equal(code.length, 43);
  assert.ok(!JSON.stringify(envelope).includes('CS101'));
  assert.deepEqual(await decryptBackup(code, envelope), data);
  assert.equal(await backupHash(await decryptBackup(code, envelope)), await backupHash(data));
  assert.notEqual((await encryptBackup(code, data)).iv, envelope.iv);
  await assert.rejects(decryptBackup(newRecoveryCode(), envelope));
  const changed = (envelope.data[0] === 'A' ? 'B' : 'A') + envelope.data.slice(1);
  await assert.rejects(decryptBackup(code, { ...envelope, data: changed }));
  console.log('Next class, semester calendar, attendance, and encrypted backups passed.');
} finally {
  await vite.close();
}
