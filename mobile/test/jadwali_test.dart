import 'dart:convert';
// ignore: deprecated_member_use
import "package:flutter/material.dart";

import 'package:flutter_test/flutter_test.dart';
import 'package:jadwali/main.dart';
import 'package:jadwali/schedule.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  test(
    'past meetings recur and calendar export respects the selected range',
    () {
      final monday = Lecture(
        '1',
        'Studio, A',
        1,
        540,
        600,
        'F-03',
        'First',
        true,
      );
      final tuesday = Lecture('2', 'Physics', 2, 540, 600, '', '', false);
      final now = DateTime(2026, 11, 23, 9, 15);
      expect(nextLecture([monday, tuesday], now)?.lecture.id, '2');
      expect(nextLecture([monday], now)?.starts, DateTime(2026, 11, 30, 9));
      expect(Lecture.read(monday.toJson())?.identity, monday.identity);
      final ics = calendarExport([monday], now, DateTime(2026, 11, 30));
      expect(ics, contains('RRULE:FREQ=WEEKLY;COUNT=2;BYDAY=MO'));
      expect(ics, contains(r'SUMMARY:Studio\, A'));
    },
  );

  testWidgets('completes onboarding, saves a class and records attendance', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    SharedPreferences.setMockInitialValues({});
    final preferences = await SharedPreferences.getInstance();
    await tester.pumpWidget(Jadwali(preferences: preferences));
    await tester.pumpAndSettle();
    expect(find.text('Make time for class.'), findsOneWidget);

    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    expect(find.text('Build your timetable.'), findsOneWidget);
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Get started'));
    await tester.pumpAndSettle();
    expect(preferences.getBool('introduced'), true);

    await tester.tap(find.text('Add class'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(EditableText).first, 'Linear algebra');
    await tester.ensureVisible(find.text('Save class'));
    await tester.tap(find.text('Save class'));
    await tester.pumpAndSettle();
    expect(find.text('Next class'), findsOneWidget);

    await tester.tap(find.text('Attendance'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(ChoiceChip, 'Present'));
    await tester.pumpAndSettle();
    final data = jsonDecode(preferences.getString('schedule')!) as Map;
    expect((data['sessions'] as List).single['courseName'], 'Linear algebra');
    expect((data['attendance'] as Map).values.single, 'present');

    tester.view.physicalSize = const Size(320, 740);
    await tester.pumpAndSettle();
    await tester.tap(find.text('More'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Arabic interface'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('الجدول'));
    await tester.pumpAndSettle();
    expect(find.text('المحاضرة القادمة'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
